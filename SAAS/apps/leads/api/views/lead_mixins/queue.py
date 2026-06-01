from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
import datetime
from apps.api.permissions import IsManagerOrHigher, IsClientAdmin
from apps.accounts.models import User
from apps.leads.models import Lead, LeadStatus
from apps.audits.services import AuditService

class LeadQueueMixin:
    @action(detail=False, methods=['get'], url_path='critical-followups', permission_classes=[IsManagerOrHigher])
    def critical_followups(self, request):
        thirty_mins_ago = timezone.now() - datetime.timedelta(minutes=30)
        
        overdue_leads = Lead.objects.filter(
            client=request.user.client,
            is_hot=True,
            next_call_at__lt=thirty_mins_ago,
            is_archived=False
        ).exclude(status__in=[LeadStatus.WON, LeadStatus.LOST]).select_related('assigned_to')
        
        serializer = self.get_serializer(overdue_leads, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='lost-queue', permission_classes=[IsManagerOrHigher])
    def lost_queue(self, request):
        qs = Lead.objects.filter(
            client=request.user.client,
            status=LeadStatus.LOST,
            is_archived=False
        ).select_related('assigned_to')
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='admin-reassign', permission_classes=[IsClientAdmin])
    def admin_reassign(self, request, pk=None):
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
