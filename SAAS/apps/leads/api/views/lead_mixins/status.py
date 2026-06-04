from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from apps.accounts.models import User, RoleChoices
from apps.leads.models import LeadStatus, ActivityTimeline, ActivityType, Notification, NotificationType
from apps.audits.services import AuditService

class LeadStatusMixin:
    @action(detail=True, methods=['post'], url_path='toggle-hot')
    def toggle_hot(self, request, pk=None):
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

    @action(detail=True, methods=['post'], url_path='mark-lost')
    def mark_lost(self, request, pk=None):
        lead = self.get_object()
        return self._handle_lost(lead, request)

    def _handle_lost(self, lead, request):
        lead.lost_count += 1
        lead.last_interaction_at = timezone.now()
        lead.status = LeadStatus.LOST
        lead.next_call_at = None
        lead.save()

        ActivityTimeline.objects.create(
            client=lead.client, lead=lead, performed_by=request.user,
            activity_type=ActivityType.CALL_LOGGED,
            title="Call logged \u2014 marked Lost",
            metadata={'outcome': 'LOST', 'lost_count': lead.lost_count}
        )

        AuditService.record_action(
            user=request.user,
            action="LEAD_LOST",
            resource_type="Lead",
            resource_id=lead.id,
            changes={"lost_count": lead.lost_count}
        )

        lead_name = f"{lead.first_name} {lead.last_name}".strip()
        tc_name = f"{request.user.first_name} {request.user.last_name}".strip()
        admins = User.objects.filter(client=lead.client, role=RoleChoices.CLIENT_ADMIN, is_active=True)
        for admin in admins:
            Notification.objects.create(
                client=lead.client, user=admin,
                title=f"Lead {lead_name} marked lost",
                message=f"By {tc_name} (Lost count: {lead.lost_count})",
                notif_type=NotificationType.LOST, lead=lead,
            )

        return Response({
            "detail": "Lead marked as Lost.",
            "lost_count": lead.lost_count,
            "status": lead.status
        })
