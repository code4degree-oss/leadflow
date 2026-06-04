from rest_framework import viewsets
from django.utils import timezone
from apps.api.mixins import TenantQuerySetMixin
from apps.api.permissions import IsFieldAgentOrHigher
from apps.accounts.models import RoleChoices
from apps.leads.api.serializers import SiteVisitSerializer
from apps.leads.models import SiteVisit, LeadStatus, ActivityTimeline, ActivityType, Notification, NotificationType

class SiteVisitViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    serializer_class = SiteVisitSerializer
    permission_classes = [IsFieldAgentOrHigher]
    queryset = SiteVisit.objects.select_related('lead', 'lead__assigned_to', 'lead__project', 'agent').all()

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.role == RoleChoices.FIELD_AGENT:
            qs = qs.filter(agent=self.request.user)
        
        visit_status = self.request.query_params.get('status')
        if visit_status:
            qs = qs.filter(status=visit_status)
            
        agent_id = self.request.query_params.get('agent_id')
        if agent_id:
            qs = qs.filter(agent_id=agent_id)
            
        project_id = self.request.query_params.get('project_id')
        if project_id:
            qs = qs.filter(lead__project_id=project_id)
            
        date_param = self.request.query_params.get('date')
        if date_param:
            from django.db.models import Q
            try:
                from datetime import datetime as dt
                filter_date = dt.strptime(date_param, '%Y-%m-%d').date()
                qs = qs.filter(Q(scheduled_at__date=filter_date) | Q(completed_at__date=filter_date))
            except (ValueError, TypeError):
                pass
                
        return qs.order_by('-scheduled_at')

    def perform_create(self, serializer):
        agent = self.request.user
        visit = serializer.save(
            client=self.request.user.client,
            agent=agent
        )

        lead = visit.lead
        lead.last_interaction_at = timezone.now()

        outcome_raw = visit.outcome or ''
        outcome = outcome_raw.upper()

        if outcome == 'WON':
            lead.status = LeadStatus.WON
        elif outcome == 'LOST' or outcome == 'NOT_INTERESTED':
            lead.status = LeadStatus.SITE_VISIT
        elif outcome == 'INTERESTED':
            lead.status = LeadStatus.INTERESTED
        else:
            lead.status = LeadStatus.SITE_VISIT

        lead.save()

        agent_name = f"{agent.first_name} {agent.last_name}".strip() or agent.email
        ActivityTimeline.objects.create(
            client=lead.client,
            lead=lead,
            performed_by=agent,
            activity_type=ActivityType.SITE_VISIT_COMPLETED if visit.status == 'COMPLETED' else ActivityType.SITE_VISIT_SCHEDULED,
            title=f"Site visit {'completed' if visit.status == 'COMPLETED' else 'scheduled'} by {agent_name} \u2014 Outcome: {outcome or 'Pending'}",
            metadata={
                'visit_id': str(visit.id),
                'outcome': outcome,
                'notes': visit.notes,
                'agent': agent.email,
            }
        )

        if lead.assigned_to and visit.status == 'COMPLETED':
            lead_name = f"{lead.first_name} {lead.last_name}".strip()
            Notification.objects.create(
                client=lead.client,
                user=lead.assigned_to,
                title=f"Site Visit Completed: {lead_name}",
                message=f"Field agent {agent_name} marked outcome as '{outcome}'. Notes: {visit.notes[:100] if visit.notes else 'N/A'}",
                notif_type=NotificationType.REMINDER,
                lead=lead,
            )
