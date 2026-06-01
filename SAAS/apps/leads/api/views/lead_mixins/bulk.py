from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from apps.api.permissions import IsClientAdmin
from apps.audits.services import AuditService
from apps.accounts.models import User, RoleChoices

class LeadBulkMixin:
    @action(detail=False, methods=['post'], url_path='bulk-delete', permission_classes=[IsClientAdmin])
    def bulk_delete(self, request):
        password = request.data.get('password')
        if not password or not request.user.check_password(password):
            return Response({"error": "Invalid or missing password for bulk deletion."}, status=status.HTTP_403_FORBIDDEN)
            
        confirmation = request.data.get('confirmation')
        if confirmation != "DELETE_ALL":
            return Response({"error": "Please provide confirmation string 'DELETE_ALL'."}, status=status.HTTP_400_BAD_REQUEST)

        queryset = self.get_queryset()
        count, _ = queryset.delete()

        AuditService.record_action(
            user=request.user,
            action="BULK_DELETE_ALL_LEADS",
            resource_type="Lead",
            changes={"deleted_count": count}
        )
        return Response({"detail": f"Successfully deleted {count} leads."}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['delete'], url_path='bulk-delete-batch', permission_classes=[IsClientAdmin])
    def bulk_delete_batch(self, request):
        source_name = request.data.get('source')
        if not source_name:
            return Response({"error": "Batch source name is required."}, status=status.HTTP_400_BAD_REQUEST)
        
        from apps.leads.models import LeadBatch
        queryset = self.get_queryset().filter(source=source_name)
        count, _ = queryset.delete()

        # Clean up LeadBatch as well if it exists
        LeadBatch.objects.filter(client=request.user.client, name=source_name).delete()

        AuditService.record_action(
            user=request.user,
            action="BULK_DELETE_BATCH",
            resource_type="Lead",
            changes={"source": source_name, "deleted_count": count}
        )
        return Response({"detail": f"Successfully deleted {count} leads from batch '{source_name}'."}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['delete'], url_path='permanent-delete', permission_classes=[IsClientAdmin])
    def permanent_delete(self, request, pk=None):
        lead = self.get_object()
        lead_id = str(lead.id)
        lead.delete()

        AuditService.record_action(
            user=request.user,
            action="LEAD_PERMANENT_DELETE",
            resource_type="Lead",
            changes={"deleted_lead_id": lead_id}
        )
        return Response({"detail": "Lead permanently deleted."}, status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get'], url_path='field-agents')
    def field_agents(self, request):
        agents = User.objects.filter(
            client=request.user.client,
            role=RoleChoices.FIELD_AGENT,
            is_active=True
        ).values('id', 'first_name', 'last_name', 'email', 'role')
        return Response(list(agents))
