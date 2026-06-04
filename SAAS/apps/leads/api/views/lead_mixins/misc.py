from rest_framework.decorators import action
from rest_framework.response import Response
from apps.audits.services import AuditService
from apps.leads.exporters import LeadExportService

class LeadMiscMixin:
    @action(detail=False, methods=['post'], url_path='quick-add')
    def quick_add(self, request):
        from apps.accounts.models import RoleChoices
        if request.user.role not in [RoleChoices.MANAGER, RoleChoices.CLIENT_ADMIN, RoleChoices.SUPER_ADMIN]:
            return Response({"error": "Unauthorized. Only Managers/Admins can quick-add leads."}, status=403)
            
        data = request.data
        if not data.get('phone') or not data.get('first_name'):
            return Response({"error": "First name and phone number are required."}, status=400)
            
        from apps.leads.models import Lead, LeadStatus, ActivityTimeline, ActivityType
        
        # Create lead
        lead = Lead.objects.create(
            client=request.user.client,
            first_name=data.get('first_name'),
            last_name=data.get('last_name', ''),
            phone=data.get('phone'),
            email=data.get('email', ''),
            budget=data.get('budget', None) or None,
            area=data.get('area', ''),
            notes=data.get('notes', ''),
            is_hot=data.get('is_hot', False), # No longer forced to True
            source='WHATSAPP' if data.get('is_whatsapp') else 'MANUAL',
            status=LeadStatus.NEW
        )
        
        # Log activity
        ActivityTimeline.objects.create(
            client=lead.client, lead=lead, performed_by=request.user,
            activity_type=ActivityType.IMPORTED,
            title="Lead manually added",
            metadata={'source': lead.source}
        )
        
        # Manual Assignment
        assigned_to_id = data.get('assigned_to_id')
        if assigned_to_id:
            from apps.leads.services import LeadDistributionService
            LeadDistributionService.assign_manual(lead, assigned_to_id, request.user.client)
        
        from apps.leads.api.serializers import LeadSerializer
        lead.refresh_from_db()
        return Response(LeadSerializer(lead).data, status=201)

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
