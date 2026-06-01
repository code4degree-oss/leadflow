from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser

from apps.api.mixins import TenantQuerySetMixin
from apps.api.permissions import IsClientAdmin
from apps.leads.api.serializers import LeadBatchSerializer
from apps.leads.models import LeadBatch

class LeadBatchViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    serializer_class = LeadBatchSerializer
    permission_classes = [IsClientAdmin]
    parser_classes = [MultiPartParser, FormParser]
    
    queryset = LeadBatch.objects.select_related('uploaded_by', 'client').all()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        batch = serializer.save(
            client=request.user.client,
            uploaded_by=request.user
        )
        # Save batch source name from upload form
        batch_name = request.data.get('batch_name', '').strip() or 'Manual Upload'
        try:
            batch.name = batch_name
            batch.save(update_fields=['name'])
        except Exception as e:
            print(f"[BATCH UPLOAD] Warning: Could not save batch name: {e}")

        # Process asynchronously via Celery
        try:
            from apps.leads.tasks import process_lead_batch
            print(f"[BATCH UPLOAD] Queuing batch {batch.id} with name '{batch_name}' for async processing")
            process_lead_batch.delay(str(batch.id))
        except Exception as e:
            print(f"[BATCH UPLOAD] Exception during queuing process_batch: {e}")
            batch.refresh_from_db()
            return Response({
                "detail": f"Upload failed: {str(e)}",
                "total_rows": batch.total_rows or 0,
                "imported_count": batch.imported_count or 0,
                "failed_count": batch.failed_count or 0,
                "error_log": batch.error_log or {},
            }, status=status.HTTP_400_BAD_REQUEST)

        # Refresh from DB to get the updated stats
        batch.refresh_from_db()
        print(f"[BATCH UPLOAD] Result: status={batch.status}, total={batch.total_rows}, imported={batch.imported_count}, failed={batch.failed_count}, errors={batch.error_log}")
        
        response_data = {
            "id": str(batch.id),
            "status": batch.status,
            "total_rows": batch.total_rows or 0,
            "imported_count": batch.imported_count or 0,
            "failed_count": batch.failed_count or 0,
            "error_log": batch.error_log or {},
        }
        
        if batch.status == 'FAILED':
            return Response(response_data, status=status.HTTP_400_BAD_REQUEST)
        
        return Response(response_data, status=status.HTTP_201_CREATED)
