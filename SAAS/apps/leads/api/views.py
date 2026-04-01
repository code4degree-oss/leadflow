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
        
        # Date filter for history view — filter by last_interaction_at date
        date_param = self.request.query_params.get('date')
        if date_param:
            try:
                from datetime import datetime as dt
                filter_date = dt.strptime(date_param, '%Y-%m-%d').date()
                qs = qs.filter(last_interaction_at__date=filter_date)
            except (ValueError, TypeError):
                pass
        
        # Exclude uncontacted leads (for history view)
        exclude_new = self.request.query_params.get('exclude_new')
        if exclude_new == 'true':
            qs = qs.exclude(status__in=[LeadStatus.NEW, 'IMPORTED'])
        
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

    @action(detail=False, methods=['post'], url_path='pull-leads', permission_classes=[IsTelecallerOrHigher])
    def pull_leads(self, request):
        """Telecallers can pull a batch of NEW, unassigned leads from the global pool."""
        if request.user.role not in [RoleChoices.TELECALLER, RoleChoices.CLIENT_ADMIN, RoleChoices.SUPER_ADMIN]:
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)
            
        try:
            count = int(request.data.get('count', 10))
        except ValueError:
            count = 10
        count = min(count, 25)

        unassigned_leads = Lead.objects.filter(
            client=request.user.client,
            assigned_to__isnull=True,
            status=LeadStatus.NEW,
            is_archived=False
        ).order_by('created_at')[:count]

        assigned_count = 0
        for lead in unassigned_leads:
            lead.assigned_to = request.user
            lead.save(update_fields=['assigned_to'])
            assigned_count += 1
            
            ActivityTimeline.objects.create(
                client=lead.client, lead=lead, performed_by=request.user,
                activity_type=ActivityType.ASSIGNED,
                title=f"Lead pulled from unassigned pool",
                metadata={'assigned_to': request.user.email}
            )

        return Response({"detail": f"Successfully pulled {assigned_count} leads.", "pulled_count": assigned_count})

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
            
            # Log the call itself (counts toward daily target)
            ActivityTimeline.objects.create(
                client=lead.client, lead=lead, performed_by=request.user,
                activity_type=ActivityType.CALL_LOGGED,
                title=f"Call logged \u2014 callback requested",
                metadata={'outcome': outcome, 'old_status': old_status}
            )
            
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

        elif outcome == 'WON':
            old_status = lead.status
            lead.status = LeadStatus.WON
            lead.last_interaction_at = timezone.now()
            lead.save()
            ActivityTimeline.objects.create(
                client=lead.client, lead=lead, performed_by=request.user,
                activity_type=ActivityType.CALL_LOGGED,
                title=f"🎉 Lead marked as WON by {request.user.first_name} {request.user.last_name}",
                metadata={'outcome': outcome, 'old_status': old_status, 'new_status': 'WON',
                          'telecaller': request.user.email,
                          'field_agent': lead.field_agent.email if lead.field_agent else None}
            )
            AuditService.record_action(
                user=request.user,
                action="LEAD_WON",
                resource_type="Lead",
                resource_id=lead.id,
                changes={'old_status': old_status, 'telecaller': request.user.email,
                         'field_agent': lead.field_agent.email if lead.field_agent else None}
            )
            return Response({"detail": "🎉 Lead marked as WON!", "status": lead.status})

        elif outcome == 'LOST':
            return self._handle_lost(lead, request)

        elif outcome == 'INVALID_NUMBER':
            old_status = lead.status
            lead.status = LeadStatus.LOST
            lead.lost_count = 4 # Skip recirculation
            lead.save()
            ActivityTimeline.objects.create(
                client=lead.client, lead=lead, performed_by=request.user,
                activity_type=ActivityType.CALL_LOGGED,
                title=f"Call logged \\u2014 marked Invalid Number (escalated to admin)",
                metadata={'outcome': 'INVALID_NUMBER', 'old_status': old_status}
            )
            return Response({"detail": "Lead marked as Invalid Number (Lost).", "status": lead.status})

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
        - lost_count < 4: move to unassigned pool, reset to NEW
        - lost_count >= 4: mark LOST, lands in admin review queue
        """
        lead.lost_count += 1
        lead.last_interaction_at = timezone.now()

        if lead.lost_count < 4:
            # Place it back in the unassigned pool
            assigned_to_email = lead.assigned_to.email if lead.assigned_to else None
            lead.assigned_to = None
            lead.status = LeadStatus.NEW
            lead.save()

            ActivityTimeline.objects.create(
                client=lead.client, lead=lead, performed_by=request.user,
                activity_type=ActivityType.CALL_LOGGED,
                title=f"Call logged \u2014 marked Lost (placed in unassigned pool, count: {lead.lost_count}/4)",
                metadata={'outcome': 'LOST', 'lost_count': lead.lost_count, 'unassigned_from': assigned_to_email}
            )

            AuditService.record_action(
                user=request.user,
                action="LEAD_LOST_UNASSIGN",
                resource_type="Lead",
                resource_id=lead.id,
                changes={
                    "lost_count": lead.lost_count,
                    "unassigned_from": assigned_to_email
                }
            )

            return Response({
                "detail": f"Lead moved to unassigned pool (lost count: {lead.lost_count}/4).",
                "lost_count": lead.lost_count,
                "status": lead.status,
                "assigned_to": None
            })
        else:
            # Escalate to admin review queue
            lead.status = LeadStatus.LOST
            lead.save()

            ActivityTimeline.objects.create(
                client=lead.client, lead=lead, performed_by=request.user,
                activity_type=ActivityType.CALL_LOGGED,
                title=f"Call logged \u2014 marked Lost (escalated to admin, count: {lead.lost_count})",
                metadata={'outcome': 'LOST', 'lost_count': lead.lost_count}
            )

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

    @action(detail=False, methods=['get'], url_path='critical-followups', permission_classes=[IsClientAdmin])
    def critical_followups(self, request):
        """Returns hot leads whose next_call_at or followups are overdue by > 30 mins."""
        thirty_mins_ago = timezone.now() - datetime.timedelta(minutes=30)
        
        overdue_leads = Lead.objects.filter(
            client=request.user.client,
            is_hot=True,
            next_call_at__lt=thirty_mins_ago,
            is_archived=False
        ).exclude(status__in=[LeadStatus.WON, LeadStatus.LOST]).select_related('assigned_to')
        
        serializer = self.get_serializer(overdue_leads, many=True)
        return Response(serializer.data)

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

        # Calculate today's progress for current user
        today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + datetime.timedelta(days=1)
        
        calls_today = ActivityTimeline.objects.filter(
            client=request.user.client,
            performed_by=request.user,
            activity_type=ActivityType.CALL_LOGGED,
            created_at__gte=today_start,
            created_at__lt=today_end
        ).count()

        return Response({
            "status_counts": formatted_stats,
            "total_leads": total_leads,
            "source_performance": source_performance,
            "team_performance": team_stats,
            "recent_activity": recent_data,
            "conversion_rate": round((formatted_stats.get('WON', 0) / total_leads * 100), 2) if total_leads > 0 else 0,
            "calls_today": calls_today,
        })

    @action(detail=False, methods=['get'], url_path='performance-report', permission_classes=[IsClientAdmin])
    def performance_report(self, request):
        """Detailed performance report for the Client Admin Dashboard."""
        client = request.user.client
        today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + datetime.timedelta(days=1)
        month_start = today_start.replace(day=1)
        
        # 1. KPIs
        total_calls_today = ActivityTimeline.objects.filter(
            client=client, activity_type=ActivityType.CALL_LOGGED, created_at__gte=today_start, created_at__lt=today_end
        ).count()
        
        leads_won_month = Lead.objects.filter(client=client, status=LeadStatus.WON, updated_at__gte=month_start).count()
        
        site_visits_month = ActivityTimeline.objects.filter(
            client=client, activity_type=ActivityType.SITE_VISIT_SCHEDULED, created_at__gte=month_start
        ).count()
        
        total_leads = Lead.objects.filter(client=client).count()
        total_won = Lead.objects.filter(client=client, status=LeadStatus.WON).count()
        conversion_rate = round((total_won / total_leads * 100), 1) if total_leads > 0 else 0

        # 2. Outcome Breakdown (Today)
        todays_calls = ActivityTimeline.objects.filter(
            client=client, activity_type=ActivityType.CALL_LOGGED, created_at__gte=today_start, created_at__lt=today_end
        )
        outcomes = {}
        for call in todays_calls:
            outcome = call.metadata.get('outcome', 'UNKNOWN') if call.metadata else 'UNKNOWN'
            outcomes[outcome] = outcomes.get(outcome, 0) + 1
            
        outcome_breakdown = [{"name": k, "value": v} for k, v in outcomes.items()]

        # 3. Activity Stream (Live)
        recent_activities = ActivityTimeline.objects.filter(
            client=client
        ).select_related('performed_by').order_by('-created_at')[:12]
        
        activity_stream = []
        for act in recent_activities:
            activity_stream.append({
                "id": act.id,
                "title": act.title,
                "user": f"{act.performed_by.first_name} {act.performed_by.last_name}" if act.performed_by else "System",
                "time": act.created_at.strftime("%I:%M %p"),
                "type": act.activity_type
            })

        # 4. Employee Performance Array
        employees = User.objects.filter(
            client=client, 
            role__in=[RoleChoices.TELECALLER, RoleChoices.FIELD_AGENT], 
            is_active=True
        )
        
        user_stats = {emp.id: {
            "id": emp.id,
            "name": f"{emp.first_name} {emp.last_name}",
            "role": emp.role,
            "calls_today": 0,
            "won_today": 0,
            "lost_today": 0,
            "visits_today": 0,
            "target": client.daily_telecaller_target if emp.role == RoleChoices.TELECALLER else client.daily_field_agent_target,
            "last_login": emp.last_login.strftime("%I:%M %p") if emp.last_login else "N/A"
        } for emp in employees}

        for call in todays_calls:
            uid = call.performed_by_id
            if uid in user_stats:
                user_stats[uid]["calls_today"] += 1
                outcome = call.metadata.get('outcome', '') if call.metadata else ''
                if outcome == 'WON':
                    user_stats[uid]["won_today"] += 1
                elif outcome == 'LOST':
                    user_stats[uid]["lost_today"] += 1
                elif "WON" in str(call.metadata.get('new_status', '')):
                    user_stats[uid]["won_today"] += 1

        visits_today = ActivityTimeline.objects.filter(
            client=client, activity_type=ActivityType.SITE_VISIT_SCHEDULED, created_at__gte=today_start, created_at__lt=today_end
        )
        for visit in visits_today:
            uid = visit.performed_by_id
            if uid in user_stats:
                user_stats[uid]["visits_today"] += 1

        team_performance = list(user_stats.values())
        team_performance.sort(key=lambda x: x["calls_today"], reverse=True)

        return Response({
            "kpis": {
                "total_calls_today": total_calls_today,
                "leads_won_month": leads_won_month,
                "site_visits_month": site_visits_month,
                "conversion_rate": conversion_rate
            },
            "outcome_breakdown": outcome_breakdown,
            "activity_stream": activity_stream,
            "team_performance": team_performance,
            "target_telecaller": client.daily_telecaller_target
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


    @action(detail=False, methods=['get'], url_path='field-agents')
    def field_agents(self, request):
        """Returns field agents in the same client for telecaller assignment."""
        agents = User.objects.filter(
            client=request.user.client,
            role=RoleChoices.FIELD_AGENT,
            is_active=True
        ).values('id', 'first_name', 'last_name', 'email', 'role')
        return Response(list(agents))

    @action(detail=False, methods=['get'], url_path='daily-target')
    def daily_target(self, request):
        """Returns the daily target set by the client admin and today's progress."""
        client = request.user.client
        if not client:
            return Response({"detail": "No client account."}, status=status.HTTP_400_BAD_REQUEST)
        
        today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + datetime.timedelta(days=1)
        
        calls_today = ActivityTimeline.objects.filter(
            client=client,
            performed_by=request.user,
            activity_type=ActivityType.CALL_LOGGED,
            created_at__gte=today_start,
            created_at__lt=today_end
        ).count()
        
        target = client.daily_telecaller_target if request.user.role == RoleChoices.TELECALLER else client.daily_field_agent_target
        
        # Auto-calculate: Add pending overdue/today tasks to the target dynamically
        # We need to dedupe followups and scheduled leads, since follow-ups also update the lead's next_call_at
        pending_followups_qs = FollowUpReminder.objects.filter(
            client=client, created_by=request.user, is_completed=False, scheduled_at__lt=today_end
        )
        pending_followups_count = pending_followups_qs.count()
        pending_followups_lead_ids = list(pending_followups_qs.values_list('lead_id', flat=True))
        
        pending_leads_count = Lead.objects.filter(
            client=client, next_call_at__lt=today_end
        ).exclude(
            status__in=[LeadStatus.WON, 'LOST', 'IMPORTED']
        ).exclude(
            id__in=pending_followups_lead_ids
        ).count()
        
        total_dynamic_target = target + pending_followups_count + pending_leads_count
        
        return Response({
            "target": total_dynamic_target,
            "progress": calls_today,
            "telecaller_target": client.daily_telecaller_target,
            "field_agent_target": client.daily_field_agent_target,
            "base_target": target,
        })

    @action(detail=False, methods=['put'], url_path='set-daily-target', permission_classes=[IsClientAdmin])
    def set_daily_target(self, request):
        """Admin updates the daily target for telecallers and/or field agents."""
        client = request.user.client
        if not client:
            return Response({"detail": "No client account."}, status=status.HTTP_400_BAD_REQUEST)
        
        tc_target = request.data.get('telecaller_target')
        fa_target = request.data.get('field_agent_target')
        
        if tc_target is not None:
            client.daily_telecaller_target = int(tc_target)
        if fa_target is not None:
            client.daily_field_agent_target = int(fa_target)
        client.save()
        
        return Response({
            "detail": "Daily targets updated.",
            "telecaller_target": client.daily_telecaller_target,
            "field_agent_target": client.daily_field_agent_target,
        })

    @action(detail=False, methods=['get'], url_path='won-leads')
    def won_leads(self, request):
        """Returns all WON leads with both telecaller and field agent names."""
        qs = self.get_queryset().filter(status=LeadStatus.WON).select_related(
            'assigned_to', 'field_agent', 'project'
        ).order_by('-updated_at')
        
        results = []
        for lead in qs:
            tc_name = ''
            fa_name = ''
            if lead.assigned_to:
                tc_name = f"{lead.assigned_to.first_name} {lead.assigned_to.last_name}".strip() or lead.assigned_to.email
            if lead.field_agent:
                fa_name = f"{lead.field_agent.first_name} {lead.field_agent.last_name}".strip() or lead.field_agent.email
            
            results.append({
                'id': str(lead.id),
                'first_name': lead.first_name,
                'last_name': lead.last_name,
                'phone': lead.phone,
                'email': lead.email,
                'project_name': lead.project.name if lead.project else None,
                'budget': str(lead.budget) if lead.budget else None,
                'telecaller_name': tc_name,
                'field_agent_name': fa_name,
                'won_date': lead.updated_at.isoformat() if lead.updated_at else None,
                'source': lead.source,
            })
        
        return Response(results)

    @action(detail=False, methods=['post'], url_path='bulk-assign', permission_classes=[IsClientAdmin])
    def bulk_assign(self, request):
        """
        Admin bulk-assigns leads. Supports:
        - mode: 'manual' (assign to specific user), 'round_robin', 'load_balance'
        - user_id: target user (for manual mode)
        - count: number of leads to assign
        - status_filter: 'NEW' (default) or 'all'
        """
        mode = request.data.get('mode', 'manual')
        user_id = request.data.get('user_id')
        count = int(request.data.get('count', 10))
        status_filter = request.data.get('status_filter', 'NEW')
        
        # Get unassigned or all new leads
        base_qs = Lead.objects.filter(client=request.user.client)
        if status_filter == 'NEW':
            base_qs = base_qs.filter(status__in=[LeadStatus.NEW, 'IMPORTED'])
        
        unassigned = base_qs.filter(assigned_to__isnull=True).order_by('created_at')[:count]
        leads_to_assign = list(unassigned)
        
        if not leads_to_assign:
            return Response({"detail": "No unassigned leads found matching criteria."}, status=status.HTTP_400_BAD_REQUEST)
        
        if mode == 'manual':
            if not user_id:
                return Response({"detail": "user_id is required for manual assignment."}, status=status.HTTP_400_BAD_REQUEST)
            try:
                target_user = User.objects.get(id=user_id, client=request.user.client, is_active=True)
            except User.DoesNotExist:
                return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
            
            assigned_count = 0
            for lead in leads_to_assign:
                # If assigning to field agent, set field_agent; if telecaller, set assigned_to
                if target_user.role == RoleChoices.FIELD_AGENT:
                    lead.field_agent = target_user
                    lead.assigned_to = target_user  # Also set assigned_to for visibility
                else:
                    lead.assigned_to = target_user
                lead.save(update_fields=['assigned_to', 'field_agent'])
                assigned_count += 1
            
            return Response({"detail": f"Successfully assigned {assigned_count} leads to {target_user.first_name} {target_user.last_name}."})
        
        elif mode == 'round_robin':
            users_qs = User.objects.filter(
                client=request.user.client,
                role__in=[RoleChoices.TELECALLER, RoleChoices.FIELD_AGENT],
                is_active=True
            ).order_by('id')
            users = list(users_qs)
            
            if not users:
                return Response({"detail": "No active telecallers or field agents found."}, status=status.HTTP_400_BAD_REQUEST)
            
            assigned_count = 0
            for i, lead in enumerate(leads_to_assign):
                target = users[i % len(users)]
                if target.role == RoleChoices.FIELD_AGENT:
                    lead.field_agent = target
                lead.assigned_to = target
                lead.save(update_fields=['assigned_to', 'field_agent'])
                assigned_count += 1
            
            return Response({"detail": f"Round-robin assigned {assigned_count} leads across {len(users)} users."})
        
        elif mode == 'load_balance':
            # Assign to user with fewest currently assigned leads
            users_qs = User.objects.filter(
                client=request.user.client,
                role__in=[RoleChoices.TELECALLER, RoleChoices.FIELD_AGENT],
                is_active=True
            ).annotate(
                active_leads=Count('assigned_leads', filter=Q(assigned_leads__status__in=[LeadStatus.NEW, LeadStatus.CALLED, LeadStatus.NOT_ANSWERED, LeadStatus.INTERESTED]))
            ).order_by('active_leads')
            
            users = list(users_qs)
            if not users:
                return Response({"detail": "No active employees found."}, status=status.HTTP_400_BAD_REQUEST)
            
            assigned_count = 0
            for i, lead in enumerate(leads_to_assign):
                target = users[i % len(users)]
                if target.role == RoleChoices.FIELD_AGENT:
                    lead.field_agent = target
                lead.assigned_to = target
                lead.save(update_fields=['assigned_to', 'field_agent'])
                assigned_count += 1
            
            return Response({"detail": f"Load-balanced {assigned_count} leads across {len(users)} users."})
        
        return Response({"detail": "Invalid mode. Use 'manual', 'round_robin', or 'load_balance'."}, status=status.HTTP_400_BAD_REQUEST)


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
