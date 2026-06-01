from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
import datetime
from apps.api.mixins import TenantQuerySetMixin
from apps.api.permissions import IsTelecallerOrHigher
from apps.leads.api.serializers import NotificationSerializer
from apps.leads.models import Notification, NotificationType, FollowUpReminder

class NotificationViewSet(TenantQuerySetMixin, viewsets.GenericViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsTelecallerOrHigher]
    queryset = Notification.objects.all()

    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user)

    def list(self, request):
        qs = self.get_queryset()[:30]
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        count = self.get_queryset().filter(is_read=False).count()
        return Response({'count': count})

    @action(detail=True, methods=['post'])
    def read(self, request, pk=None):
        notif = self.get_object()
        notif.is_read = True
        notif.save(update_fields=['is_read'])
        return Response({'status': 'ok'})

    @action(detail=False, methods=['post'])
    def read_all(self, request):
        self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response({'status': 'ok'})

    @action(detail=False, methods=['post'])
    def check_reminders(self, request):
        now = timezone.now()
        window = now + datetime.timedelta(minutes=5)

        upcoming = FollowUpReminder.objects.filter(
            client=request.user.client,
            scheduled_at__gte=now,
            scheduled_at__lte=window,
            is_completed=False
        ).select_related('lead', 'created_by')

        created = 0
        for reminder in upcoming:
            if not reminder.created_by:
                continue
            exists = Notification.objects.filter(
                user=reminder.created_by,
                lead=reminder.lead,
                notif_type=NotificationType.REMINDER,
                created_at__gte=now - datetime.timedelta(minutes=10)
            ).exists()
            if not exists:
                lead_name = f"{reminder.lead.first_name} {reminder.lead.last_name}".strip()
                mins = max(1, int((reminder.scheduled_at - now).total_seconds() // 60))
                Notification.objects.create(
                    client=request.user.client,
                    user=reminder.created_by,
                    title=f"📞 Call {lead_name} in {mins} min",
                    message=reminder.note or f"Scheduled follow-up with {lead_name}",
                    notif_type=NotificationType.REMINDER,
                    lead=reminder.lead,
                )
                created += 1

        return Response({'created': created})
