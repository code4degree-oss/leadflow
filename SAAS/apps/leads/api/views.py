from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser

from apps.api.mixins import TenantQuerySetMixin
from apps.api.permissions import IsClientAdmin, IsTelecallerOrHigher
from apps.leads.api.serializers import (
    LeadSerializer, LeadBatchSerializer, SiteVisitSerializer,
    FollowUpReminderSerializer, CallLogSerializer, ActivityTimelineSerializer,
    ProjectSerializer
)
from apps.leads.models import Lead, LeadBatch, SiteVisit, LeadStatus, FollowUpReminder, ActivityTimeline, ActivityType, Project
import datetime
from apps.leads.tasks import process_lead_batch
from apps.leads.services import LeadDistributionService, LeadOperationService
from apps.leads.exporters import LeadExportService
from apps.audits.services import AuditService
from apps.accounts.models import User, RoleChoices
from django.db.models import Count, Q
from django.utils import timezone


class LeadViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    """
    API endpoint that allows leads to be viewed, created, or edited.
    Strictly isolated by client_id via the TenantQuerySetMixin.
    Telecallers only see their own assigned leads.
    """
    serializer_class = LeadSerializer
    permission_classes = [IsTelecallerOrHigher]
    filterset_fields = ['status', 'source', 'is_hot']
    search_fields = ['first_name', 'last_name', 'phone', 'email']
    
    queryset = Lead.objects.select_related('assigned_to', 'client', 'field_agent', 'project').all()

    def get_queryset(self):
        qs = super().get_queryset()
        # Telecaller isolation: only see own assigned leads
        if self.request.user.role == RoleChoices.TELECALLER:
            qs = qs.filter(assigned_to=self.request.user)
        return qs

    def perform_create(self, serializer):
        serializer.save(client=self.request.user.client)

    def perform_update(self, serializer):
        serializer.save(last_interaction_at=timezone.now())

    # ──────────────────────────────────────────────
    # Lead Distribution Actions
    # ──────────────────────────────────────────────

    @action(detail=False, methods=['post'], url_path='assign-round-robin')
    def assign_round_robin(self, request):
        unassigned_leads = self.get_queryset().filter(assigned_to__isnull=True)
        if not unassigned_leads.exists():
            return Response({"detail": "No unassigned leads found."}, status=status.HTTP_400_BAD_REQUEST)
            
        assigned_count = LeadDistributionService.assign_round_robin(unassigned_leads, request.user.client)
        return Response({"detail": f"Successfully assigned {assigned_count} leads via Round-Robin."})

    @action(detail=True, methods=['post'], url_path='manual-assign')
    def manual_assign(self, request, pk=None):
        lead = self.get_object()
        user_id = request.data.get('user_id')
        
        if not user_id:
            return Response({"error": "user_id is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        success, message = LeadDistributionService.assign_manual(lead, user_id, request.user.client)
        
        if success:
            return Response({"detail": message})
        return Response({"error": message}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], url_path='bulk-reassign')
    def bulk_reassign(self, request):
        from_user = request.data.get('from_user')
        to_user = request.data.get('to_user')
        lead_status = request.data.get('status')

        if not from_user or not to_user:
            return Response({"error": "from_user and to_user are required"}, status=status.HTTP_400_BAD_REQUEST)

        count = LeadOperationService.bulk_reassign(
            request.user.client, from_user, to_user, performer=request.user, status=lead_status
        )
        return Response({"detail": f"Successfully reassigned {count} leads."})

    @action(detail=True, methods=['post'], url_path='merge')
    def merge(self, request, pk=None):
        duplicate_id = request.data.get('duplicate_id')
        if not duplicate_id:
            return Response({"error": "duplicate_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        success, message = LeadOperationService.merge_leads(
            request.user.client, pk, duplicate_id, performer=request.user
        )
        if success:
            return Response({"detail": message})
        return Response({"error": message}, status=status.HTTP_400_BAD_REQUEST)

    # ──────────────────────────────────────────────
    # Call Logging & Lost-Lead Escalation
    # ──────────────────────────────────────────────

    @action(detail=True, methods=['post'], url_path='log-call')
    def log_call(self, request, pk=None):
        """
        Log a call outcome with mandatory next_call_at scheduling.
        Also handles project, field_agent, budget, area updates.
        """
        lead = self.get_object()
        serializer = CallLogSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Update lead fields
        if data.get('notes'):
            lead.notes = data['notes']
        if data.get('budget') is not None:
            lead.budget = data['budget']
        if data.get('interested_flat'):
            lead.interested_flat = data['interested_flat']
        if data.get('area'):
            lead.area = data['area']

        # Update project if provided
        project_id = data.get('project_id')
        if project_id:
            try:
                lead.project = Project.objects.get(id=project_id, client=lead.client)
            except Project.DoesNotExist:
                pass

        # Update field agent if provided
        field_agent_id = data.get('field_agent_id')
        if field_agent_id:
            try:
                agent = User.objects.get(id=field_agent_id, client=lead.client, role=RoleChoices.FIELD_AGENT, is_active=True)
                lead.field_agent = agent
            except User.DoesNotExist:
                pass

        lead.last_interaction_at = timezone.now()
        outcome = data['outcome']

        # Set next_call_at (mandatory for all except LOST)
        next_call_at = data.get('next_call_at')
        if next_call_at:
            lead.next_call_at = next_call_at

        if outcome == 'INTERESTED':
            old_status = lead.status
            lead.status = LeadStatus.INTERESTED
            lead.save()
            ActivityTimeline.objects.create(
                client=lead.client, lead=lead, performed_by=request.user,
                activity_type=ActivityType.CALL_LOGGED,
                title=f"Call logged \u2014 marked Interested (next: {lead.next_call_at.strftime('%d %b') if lead.next_call_at else 'N/A'})",
                metadata={'outcome': outcome, 'old_status': old_status, 'new_status': lead.status, 'next_call_at': str(lead.next_call_at)}
            )
            return Response({"detail": "Lead marked as interested.", "status": lead.status})

        elif outcome == 'CALLED':
            old_status = lead.status
            lead.status = LeadStatus.CALLED
            lead.save()
            ActivityTimeline.objects.create(
                client=lead.client, lead=lead, performed_by=request.user,
                activity_type=ActivityType.CALL_LOGGED,
                title=f"Call logged \u2014 general call (next: {lead.next_call_at.strftime('%d %b') if lead.next_call_at else 'N/A'})",
                metadata={'outcome': outcome, 'old_status': old_status, 'new_status': lead.status}
            )
            return Response({"detail": "Call logged.", "status": lead.status})

        elif outcome == 'NOT_ANSWERED':
            old_status = lead.status
            lead.status = LeadStatus.NOT_ANSWERED
            # Auto-schedule for next business day at 9 AM
            tomorrow = timezone.now() + datetime.timedelta(days=1)
            while tomorrow.weekday() in (5, 6):  # Skip Saturday/Sunday
                tomorrow += datetime.timedelta(days=1)
            lead.next_call_at = tomorrow.replace(hour=9, minute=0, second=0, microsecond=0)
            lead.save()
            ActivityTimeline.objects.create(
                client=lead.client, lead=lead, performed_by=request.user,
                activity_type=ActivityType.CALL_LOGGED,
                title=f"Call attempted \u2014 not answered (auto-retry: {lead.next_call_at.strftime('%d %b, %I:%M %p')})",
                metadata={'outcome': outcome, 'old_status': old_status, 'auto_retry': str(lead.next_call_at)}
            )
            return Response({"detail": f"Not answered. Auto-scheduled for {lead.next_call_at.strftime('%d %b %Y, %I:%M %p')}.", "status": lead.status, "next_call_at": str(lead.next_call_at)})

        elif outcome == 'CALLBACK':
            old_status = lead.status
            lead.status = LeadStatus.CALLED
            lead.save()
            
            follow_up_at = data.get('follow_up_at')
            if follow_up_at:
                FollowUpReminder.objects.create(
                    client=lead.client, lead=lead, created_by=request.user,
                    scheduled_at=follow_up_at,
                    note=data.get('follow_up_note', '')
                )
                ActivityTimeline.objects.create(
                    client=lead.client, lead=lead, performed_by=request.user,
                    activity_type=ActivityType.FOLLOW_UP_SET,
                    title=f"Follow-up scheduled for {follow_up_at.strftime('%d %b %Y, %I:%M %p')}",
                    metadata={'outcome': outcome, 'follow_up_at': str(follow_up_at), 'old_status': old_status}
                )
            
            return Response({"detail": "Callback scheduled.", "status": lead.status})

        elif outcome == 'LOST':
            return self._handle_lost(lead, request)

        lead.save()
        return Response({"detail": "Call logged.", "status": lead.status})

    # ──────────────────────────────────────────────
    # Hot Lead & Field Agent Actions
    # ──────────────────────────────────────────────

    @action(detail=True, methods=['post'], url_path='toggle-hot')
    def toggle_hot(self, request, pk=None):
        """Toggle hot lead flag."""
        lead = self.get_object()
        lead.is_hot = not lead.is_hot
        lead.save(update_fields=['is_hot'])
        ActivityTimeline.objects.create(
            client=lead.client, lead=lead, performed_by=request.user,
            activity_type=ActivityType.STATUS_CHANGE,
            title=f"Lead {'marked as HOT \U0001f525' if lead.is_hot else 'unmarked as hot'}",
            metadata={'is_hot': lead.is_hot}
        )
        return Response({"detail": f"Lead {'marked hot' if lead.is_hot else 'unmarked'}.", "is_hot": lead.is_hot})

    @action(detail=True, methods=['post'], url_path='assign-field-agent')
    def assign_field_agent(self, request, pk=None):
        """Assign a field agent to this lead."""
        lead = self.get_object()
        agent_id = request.data.get('agent_id')
        if not agent_id:
            return Response({"error": "agent_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            agent = User.objects.get(id=agent_id, client=lead.client, role=RoleChoices.FIELD_AGENT, is_active=True)
        except User.DoesNotExist:
            return Response({"error": "Field agent not found"}, status=status.HTTP_404_NOT_FOUND)
        lead.field_agent = agent
        lead.save(update_fields=['field_agent'])
        ActivityTimeline.objects.create(
            client=lead.client, lead=lead, performed_by=request.user,
            activity_type=ActivityType.ASSIGNED,
            title=f"Field agent assigned: {agent.first_name} {agent.last_name}",
            metadata={'field_agent_id': str(agent.id), 'field_agent_email': agent.email}
        )
        return Response({"detail": f"Field agent {agent.email} assigned."})


    # ──────────────────────────────────────────────
    # Lead Timeline & Follow-ups
    # ──────────────────────────────────────────────

    @action(detail=True, methods=['get'], url_path='timeline')
    def timeline(self, request, pk=None):
        """Returns the activity timeline for a specific lead."""
        lead = self.get_object()
        events = ActivityTimeline.objects.filter(
            lead=lead
        ).select_related('performed_by').order_by('-created_at')[:50]
        serializer = ActivityTimelineSerializer(events, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='follow-ups')
    def follow_ups(self, request, pk=None):
        """Returns all follow-up reminders for a specific lead."""
        lead = self.get_object()
        reminders = FollowUpReminder.objects.filter(
            lead=lead
        ).select_related('created_by').order_by('-scheduled_at')
        serializer = FollowUpReminderSerializer(reminders, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='mark-lost')
    def mark_lost(self, request, pk=None):
        """Standalone mark-lost endpoint with escalation logic."""
        lead = self.get_object()
        return self._handle_lost(lead, request)

    def _handle_lost(self, lead, request):
        """
        Lost-lead escalation logic:
        - lost_count < 4: auto-reassign to next telecaller, reset to NEW
        - lost_count >= 4: mark LOST, lands in admin review queue
        """
        lead.lost_count += 1
        lead.last_interaction_at = timezone.now()

        if lead.lost_count < 4:
            # Auto-reassign to next available telecaller (excluding current)
            telecallers = list(User.objects.filter(
                client=lead.client,
                role=RoleChoices.TELECALLER,
                is_active=True
            ).exclude(id=lead.assigned_to_id).order_by('id'))

            if telecallers:
                # Simple round-robin: pick next available
                lead.assigned_to = telecallers[0]
            
            lead.status = LeadStatus.NEW
            lead.save()

            AuditService.record_action(
                user=request.user,
                action="LEAD_LOST_REASSIGN",
                resource_type="Lead",
                resource_id=lead.id,
                changes={
                    "lost_count": lead.lost_count,
                    "reassigned_to": lead.assigned_to.email if lead.assigned_to else None
                }
            )

            return Response({
                "detail": f"Lead auto-reassigned (lost count: {lead.lost_count}/4).",
                "lost_count": lead.lost_count,
                "status": lead.status,
                "reassigned_to": lead.assigned_to.email if lead.assigned_to else None
            })
        else:
            # Escalate to admin review queue
            lead.status = LeadStatus.LOST
            lead.save()

            AuditService.record_action(
                user=request.user,
                action="LEAD_ESCALATED",
                resource_type="Lead",
                resource_id=lead.id,
                changes={"lost_count": lead.lost_count}
            )

            return Response({
                "detail": "Lead escalated to admin review (lost 4+ times).",
                "lost_count": lead.lost_count,
                "status": lead.status
            })

    # ──────────────────────────────────────────────
    # Admin Lost-Leads Queue
    # ──────────────────────────────────────────────

    @action(detail=False, methods=['get'], url_path='lost-queue', permission_classes=[IsClientAdmin])
    def lost_queue(self, request):
        """Returns leads that have been lost 4+ times for admin review."""
        qs = Lead.objects.filter(
            client=request.user.client,
            lost_count__gte=4,
            status=LeadStatus.LOST,
            is_archived=False
        ).select_related('assigned_to')
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='admin-reassign', permission_classes=[IsClientAdmin])
    def admin_reassign(self, request, pk=None):
        """Admin reassigns a lost lead to a telecaller, resetting lost_count and status."""
        lead = self.get_object()
        user_id = request.data.get('user_id')

        if not user_id:
            return Response({"error": "user_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            target_user = User.objects.get(
                id=user_id, client=request.user.client, is_active=True
            )
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        lead.assigned_to = target_user
        lead.status = LeadStatus.NEW
        lead.lost_count = 0
        lead.save()

        AuditService.record_action(
            user=request.user,
            action="ADMIN_REASSIGN_LOST",
            resource_type="Lead",
            resource_id=lead.id,
            changes={"reassigned_to": target_user.email}
        )

        return Response({"detail": f"Lead reassigned to {target_user.email}, counters reset."})

    @action(detail=True, methods=['delete'], url_path='permanent-delete', permission_classes=[IsClientAdmin])
    def permanent_delete(self, request, pk=None):
        """Admin permanently deletes a lost lead."""
        lead = self.get_object()
        lead_id = str(lead.id)
        lead.delete()

        AuditService.record_action(
            user=request.user,
            action="LEAD_PERMANENT_DELETE",
            resource_type="Lead",
            changes={"deleted_lead_id": lead_id}
        )
        return Response({"detail": "Lead permanently deleted."}, status=status.HTTP_204_NO_CONTENT)

    # ──────────────────────────────────────────────
    # Contact Reveal (for masked contacts)
    # ──────────────────────────────────────────────

    @action(detail=True, methods=['get'], url_path='reveal-contact')
    def reveal_contact(self, request, pk=None):
        """Returns unmasked phone and email for the telecaller after explicit action."""
        lead = self.get_object()
        
        AuditService.record_action(
            user=request.user,
            action="CONTACT_REVEAL",
            resource_type="Lead",
            resource_id=lead.id,
        )
        
        return Response({
            "phone": lead.phone,
            "email": lead.email
        })

    # ──────────────────────────────────────────────
    # Stats & Export & Batch Progress
    # ──────────────────────────────────────────────

    @action(detail=False, methods=['get'], url_path='batch-progress', permission_classes=[IsClientAdmin])
    def batch_progress(self, request):
        """Returns progress stats for each uploaded batch (source)."""
        qs = self.get_queryset()
        
        # Group by 'source' and annotate counts
        batch_counts = qs.values('source').annotate(
            total=Count('id'),
            new_leads=Count('id', filter=Q(status__in=[LeadStatus.NEW, LeadStatus.IMPORTED])),
            in_progress=Count('id', filter=Q(status__in=[LeadStatus.CALLED, LeadStatus.CALLBACK, LeadStatus.INTERESTED, LeadStatus.SITE_VISIT, LeadStatus.NOT_ANSWERED])),
            covered=Count('id', filter=~Q(status__in=[LeadStatus.NEW, LeadStatus.IMPORTED])),
            won=Count('id', filter=Q(status=LeadStatus.WON)),
            lost=Count('id', filter=Q(status=LeadStatus.LOST))
        ).order_by('-total')

        results = []
        for b in batch_counts:
            # Skip empty sources or default "Manual Entry" if desired, but good to see all
            source_name = b['source'] or "Unknown/Manual"
            total = b['total']
            covered = b['covered']
            progress_pct = round((covered / total * 100), 1) if total > 0 else 0
            
            results.append({
                "source": source_name,
                "total": total,
                "new_leads": b['new_leads'],
                "in_progress": b['in_progress'],
                "covered": covered,
                "won": b['won'],
                "lost": b['lost'],
                "progress_percentage": progress_pct
            })
            
        return Response(results)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        queryset = self.get_queryset()
        
        is_admin = request.user.role in [RoleChoices.CLIENT_ADMIN, RoleChoices.SUPER_ADMIN] or request.user.is_superuser
        if not is_admin:
            queryset = queryset.filter(assigned_to=request.user)

        status_counts = queryset.values('status').annotate(count=Count('id'))
        stats_map = {item['status']: item['count'] for item in status_counts}
        lead_statuses = ['NEW', 'CALLED', 'NOT_ANSWERED', 'INTERESTED', 'SITE_VISIT', 'WON', 'LOST']
        formatted_stats = {s: stats_map.get(s, 0) for s in lead_statuses}
        total_leads = sum(formatted_stats.values())
        
        source_counts = queryset.values('source').annotate(
            total=Count('id'),
            won=Count('id', filter=Q(status='WON'))
        )
        source_performance = [
            {
                "source": item['source'],
                "count": item['total'],
                "conversion_rate": round((item['won'] / item['total'] * 100), 2) if item['total'] > 0 else 0
            } for item in source_counts
        ]

        team_stats = []
        if is_admin:
            team_counts = queryset.values('assigned_to__email', 'assigned_to__first_name').annotate(
                total=Count('id'),
                won=Count('id', filter=Q(status='WON')),
                interested=Count('id', filter=Q(status='INTERESTED'))
            ).filter(assigned_to__isnull=False)
            
            team_stats = [
                {
                    "user": item['assigned_to__first_name'] or item['assigned_to__email'],
                    "total": item['total'],
                    "won": item['won'],
                    "interested": item['interested'],
                    "conversion": round((item['won'] / item['total'] * 100), 2) if item['total'] > 0 else 0
                } for item in team_counts
            ]

        recent_leads = queryset.order_by('-updated_at')[:5]
        recent_data = LeadSerializer(recent_leads, many=True, context={'request': request}).data

        return Response({
            "status_counts": formatted_stats,
            "total_leads": total_leads,
            "source_performance": source_performance,
            "team_performance": team_stats,
            "recent_activity": recent_data,
            "conversion_rate": round((formatted_stats.get('WON', 0) / total_leads * 100), 2) if total_leads > 0 else 0
        })

    @action(detail=False, methods=['get'])
    def export(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        format = request.query_params.get('format', 'csv')

        AuditService.record_action(
            user=request.user,
            action="LEAD_EXPORT",
            resource_type="Lead",
            changes={"format": format, "count": queryset.count()},
            ip=request.META.get('REMOTE_ADDR')
        )

        if format == 'excel':
            return LeadExportService.export_to_excel(queryset)
        return LeadExportService.export_to_csv(queryset)


class LeadBatchViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    serializer_class = LeadBatchSerializer
    permission_classes = [IsClientAdmin]
    parser_classes = [MultiPartParser, FormParser]
    
    queryset = LeadBatch.objects.select_related('uploaded_by', 'client').all()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        batch = serializer.save(
            client=request.user.client,
            uploaded_by=request.user
        )

        # Process synchronously (no Celery worker needed for dev)
        try:
            from apps.leads.services import UploadService
            UploadService.process_batch(str(batch.id))
        except Exception as e:
            batch.refresh_from_db()
            return Response({
                "detail": f"Upload failed: {str(e)}",
                "total_rows": batch.total_rows or 0,
                "imported_count": batch.imported_count or 0,
                "failed_count": batch.failed_count or 0,
                "error_log": batch.error_log or {},
            }, status=status.HTTP_400_BAD_REQUEST)

        # Refresh from DB to get the updated stats
        batch.refresh_from_db()
        return Response({
            "id": str(batch.id),
            "status": batch.status,
            "total_rows": batch.total_rows or 0,
            "imported_count": batch.imported_count or 0,
            "failed_count": batch.failed_count or 0,
            "error_log": batch.error_log or {},
        }, status=status.HTTP_201_CREATED)


class SiteVisitViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    serializer_class = SiteVisitSerializer
    permission_classes = [IsTelecallerOrHigher]
    queryset = SiteVisit.objects.all()

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.role == RoleChoices.FIELD_AGENT:
            return qs.filter(agent=self.request.user)
        return qs

    def perform_create(self, serializer):
        agent = self.request.user
        serializer.save(
            client=self.request.user.client,
            agent=agent
        )
        
        lead = serializer.validated_data['lead']
        lead.last_interaction_at = timezone.now()
        if lead.status != 'WON' and lead.status != 'LOST':
            lead.status = 'SITE_VISIT'
        lead.save()


class FollowUpReminderViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    """
    CRUD for follow-up reminders. Telecallers see only their own.
    """
    serializer_class = FollowUpReminderSerializer
    permission_classes = [IsTelecallerOrHigher]
    queryset = FollowUpReminder.objects.select_related('lead', 'created_by').all()

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.role == RoleChoices.TELECALLER:
            qs = qs.filter(created_by=self.request.user)
        return qs

    def perform_create(self, serializer):
        serializer.save(
            client=self.request.user.client,
            created_by=self.request.user
        )

    @action(detail=False, methods=['get'], url_path='upcoming')
    def upcoming(self, request):
        """Get upcoming (not completed) reminders for the current user."""
        qs = self.get_queryset().filter(
            is_completed=False,
            scheduled_at__gte=timezone.now()
        ).order_by('scheduled_at')[:20]
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)


class ProjectViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    """
    CRUD for projects. Admin manages these, telecallers can list.
    """
    serializer_class = ProjectSerializer
    permission_classes = [IsTelecallerOrHigher]
    queryset = Project.objects.all()

    def get_queryset(self):
        qs = super().get_queryset()
        # Only show active projects for non-admin users
        if self.request.user.role in (RoleChoices.TELECALLER, RoleChoices.FIELD_AGENT):
            qs = qs.filter(is_active=True)
        return qs

    def perform_create(self, serializer):
        serializer.save(client=self.request.user.client)

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsClientAdmin()]
        return super().get_permissions()
