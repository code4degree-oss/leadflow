from rest_framework.decorators import action
from rest_framework.response import Response
from apps.audits.services import AuditService
from apps.leads.exporters import LeadExportService

class LeadMiscMixin:
    @action(detail=True, methods=['get'], url_path='reveal-contact')
    def reveal_contact(self, request, pk=None):
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
