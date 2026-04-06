from rest_framework import viewsets, mixins
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend

from apps.api.mixins import TenantQuerySetMixin
from apps.api.permissions import IsClientAdmin
from apps.audits.models import AuditLog, LoginHistory
from apps.audits.api.serializers import AuditLogSerializer, LoginHistorySerializer


class AuditLogViewSet(TenantQuerySetMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """
    Read-only API for audit logs. No create/update/delete allowed.
    Audit logs are immutable — enforced at both model and API level.
    """
    serializer_class = AuditLogSerializer
    permission_classes = [IsClientAdmin]
    queryset = AuditLog.objects.select_related('user', 'client').all()
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['action', 'resource_type', 'user']
    search_fields = ['action', 'resource_type', 'user__email']
    ordering_fields = ['created_at', 'action']


class LoginHistoryViewSet(TenantQuerySetMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """
    Read-only API for login history. Supports filtering by suspicious status and date range.
    """
    serializer_class = LoginHistorySerializer
    permission_classes = [IsClientAdmin]
    queryset = LoginHistory.objects.select_related('user', 'client').all()
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['is_suspicious', 'user', 'city', 'country']
    search_fields = ['user__email', 'city', 'ip_address']
    ordering_fields = ['created_at']

    def get_queryset(self):
        qs = super().get_queryset()
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)
        return qs
