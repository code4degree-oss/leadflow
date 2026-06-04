from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
import datetime
from apps.api.mixins import TenantQuerySetMixin
from apps.api.permissions import IsTelecallerOrHigher
from apps.accounts.models import RoleChoices
from apps.leads.api.serializers import FollowUpReminderSerializer
from apps.leads.models import FollowUpReminder

class FollowUpReminderViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
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
        qs = self.get_queryset().filter(
            is_completed=False,
            scheduled_at__gte=timezone.now() - datetime.timedelta(minutes=10)
        ).order_by('scheduled_at')[:20]
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)
