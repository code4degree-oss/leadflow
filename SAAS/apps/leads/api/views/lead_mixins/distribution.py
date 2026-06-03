from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from apps.leads.services import LeadDistributionService, LeadOperationService
from apps.accounts.models import User, RoleChoices
from apps.leads.models import Lead, LeadStatus, ActivityTimeline, ActivityType

class LeadDistributionMixin:
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

    @action(detail=False, methods=['post'], url_path='pull-leads')
    def pull_leads(self, request):
        if request.user.role not in [RoleChoices.TELECALLER, RoleChoices.CLIENT_ADMIN, RoleChoices.SUPER_ADMIN, RoleChoices.MANAGER]:
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)
            
        try:
            count = int(request.data.get('count', 10))
        except ValueError:
            count = 10
        count = min(count, 25)

        assigned_count = 0
        from django.db import transaction
        with transaction.atomic():
            unassigned_leads = Lead.objects.select_for_update(skip_locked=True).filter(
                client=request.user.client,
                assigned_to__isnull=True,
                status=LeadStatus.NEW,
                is_archived=False
            ).order_by('created_at')[:count]

            leads_to_update = []
            activities = []

            for lead in unassigned_leads:
                lead.assigned_to = request.user
                leads_to_update.append(lead)
                
                activities.append(
                    ActivityTimeline(
                        client=lead.client, lead=lead, performed_by=request.user,
                        activity_type=ActivityType.ASSIGNED,
                        title="Lead pulled from unassigned pool",
                        metadata={'assigned_to': request.user.email}
                    )
                )
            
            if leads_to_update:
                Lead.objects.bulk_update(leads_to_update, ['assigned_to'])
                ActivityTimeline.objects.bulk_create(activities)
                assigned_count = len(leads_to_update)

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

    @action(detail=False, methods=['post'], url_path='bulk-assign')
    def bulk_assign(self, request):
        """
        Flexible bulk assignment endpoint supporting manual, round-robin, and load-balanced modes.
        Used by the frontend's "Assign Leads" tab.
        """
        from apps.api.permissions import IsClientAdmin
        if request.user.role not in ['CLIENT_ADMIN', 'SUPER_ADMIN', 'MANAGER']:
            return Response({"error": "Only admins/managers can bulk assign."}, status=status.HTTP_403_FORBIDDEN)

        mode = request.data.get('mode', 'manual')
        count = min(int(request.data.get('count', 10)), 500)
        status_filter = request.data.get('status_filter', 'NEW')
        target_user_ids = request.data.get('target_user_ids', [])
        from_user_id = request.data.get('from_user_id', '')

        client = request.user.client

        # Build the queryset of leads to assign
        if from_user_id:
            # Redistribute FROM a specific user
            queryset = Lead.objects.filter(
                client=client,
                assigned_to_id=from_user_id,
                is_archived=False
            )
        else:
            # Only unassigned leads
            queryset = Lead.objects.filter(
                client=client,
                assigned_to__isnull=True,
                is_archived=False
            )

        if status_filter == 'NEW':
            queryset = queryset.filter(status=LeadStatus.NEW)

        queryset = queryset.order_by('created_at')[:count]
        leads_list = list(queryset)

        if not leads_list:
            return Response({"detail": "No matching leads found to assign."}, status=status.HTTP_400_BAD_REQUEST)

        if mode == 'manual':
            if len(target_user_ids) != 1:
                return Response({"error": "Manual mode requires exactly one target user."}, status=status.HTTP_400_BAD_REQUEST)
            try:
                target_user = User.objects.get(id=target_user_ids[0], client=client, is_active=True)
            except User.DoesNotExist:
                return Response({"error": "Target user not found."}, status=status.HTTP_404_NOT_FOUND)

            from django.utils import timezone
            for lead in leads_list:
                lead.assigned_to = target_user
                lead.updated_at = timezone.now()
            Lead.objects.bulk_update(leads_list, ['assigned_to', 'updated_at'], batch_size=500)
            assigned_count = len(leads_list)

        elif mode == 'round_robin':
            if len(target_user_ids) < 2:
                return Response({"error": "Round-robin requires at least 2 target users."}, status=status.HTTP_400_BAD_REQUEST)
            agents = list(User.objects.filter(id__in=target_user_ids, client=client, is_active=True).order_by('id'))
            if not agents:
                return Response({"error": "No valid target users found."}, status=status.HTTP_404_NOT_FOUND)

            from django.utils import timezone
            agent_count = len(agents)
            for i, lead in enumerate(leads_list):
                lead.assigned_to = agents[i % agent_count]
                lead.updated_at = timezone.now()
            Lead.objects.bulk_update(leads_list, ['assigned_to', 'updated_at'], batch_size=500)
            assigned_count = len(leads_list)

        elif mode == 'load_balance':
            assigned_count = LeadDistributionService.assign_load_balanced(leads_list, client)

        else:
            return Response({"error": f"Unknown mode: {mode}"}, status=status.HTTP_400_BAD_REQUEST)

        # Log action
        from apps.audits.services import AuditService
        AuditService.record_action(
            user=request.user,
            action="BULK_ASSIGN",
            resource_type="Lead",
            changes={"mode": mode, "count": assigned_count, "from_user_id": from_user_id}
        )

        return Response({"detail": f"Successfully assigned {assigned_count} leads via {mode.replace('_', ' ')}."})

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
