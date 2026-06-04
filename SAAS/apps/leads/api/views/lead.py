from rest_framework import viewsets
from django.db.models import Q
from django.utils import timezone
from apps.api.mixins import TenantQuerySetMixin
from apps.api.permissions import IsFieldAgentOrHigher
from apps.accounts.models import RoleChoices
from apps.leads.models import Lead, LeadStatus
from apps.leads.api.serializers import LeadSerializer

# Import mixins
from .lead_mixins.distribution import LeadDistributionMixin
from .lead_mixins.calls import LeadCallsMixin
from .lead_mixins.status import LeadStatusMixin
from .lead_mixins.queue import LeadQueueMixin
from .lead_mixins.analytics import LeadAnalyticsMixin
from .lead_mixins.bulk import LeadBulkMixin
from .lead_mixins.timeline import LeadTimelineMixin
from .lead_mixins.misc import LeadMiscMixin

class LeadViewSet(
    LeadDistributionMixin,
    LeadCallsMixin,
    LeadStatusMixin,
    LeadQueueMixin,
    LeadAnalyticsMixin,
    LeadBulkMixin,
    LeadTimelineMixin,
    LeadMiscMixin,
    TenantQuerySetMixin,
    viewsets.ModelViewSet
):
    """
    API endpoint that allows leads to be viewed, created, or edited.
    Strictly isolated by client_id via the TenantQuerySetMixin.
    Telecallers only see their own assigned leads.
    """
    serializer_class = LeadSerializer
    permission_classes = [IsFieldAgentOrHigher]
    filterset_fields = ['status', 'source', 'is_hot']
    search_fields = ['first_name', 'last_name', 'phone', 'email']
    
    queryset = Lead.objects.select_related('assigned_to', 'client', 'field_agent', 'project').all()

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.role == RoleChoices.TELECALLER:
            qs = qs.filter(assigned_to=self.request.user)
        elif self.request.user.role == RoleChoices.FIELD_AGENT:
            qs = qs.filter(Q(assigned_to=self.request.user) | Q(field_agent=self.request.user)).distinct()
        
        date_param = self.request.query_params.get('date')
        if date_param:
            try:
                from datetime import datetime as dt
                filter_date = dt.strptime(date_param, '%Y-%m-%d').date()
                qs = qs.filter(last_interaction_at__date=filter_date)
            except (ValueError, TypeError):
                pass
        
        exclude_new = self.request.query_params.get('exclude_new')
        if exclude_new == 'true':
            qs = qs.exclude(status__in=[LeadStatus.NEW, 'IMPORTED'])

        exclude_closed = self.request.query_params.get('exclude_closed')
        if exclude_closed == 'true':
            qs = qs.exclude(status__in=[LeadStatus.WON, LeadStatus.LOST, LeadStatus.INVALID_NUMBER])
        
        # Filter by batch ID for batch-to-leads navigation
        batch_id = self.request.query_params.get('batch_id')
        if batch_id:
            qs = qs.filter(batch_id=batch_id)
        
        return qs

    def perform_create(self, serializer):
        serializer.save(client=self.request.user.client)

    def perform_update(self, serializer):
        serializer.save(last_interaction_at=timezone.now())
