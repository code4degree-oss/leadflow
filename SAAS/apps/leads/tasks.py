import logging
from celery import shared_task
from django.utils import timezone
from datetime import timedelta

from apps.leads.models import Lead, LeadBatch, LeadBatchStatus, LeadStatus
from apps.leads.services import UploadService

logger = logging.getLogger(__name__)

@shared_task(name="apps.leads.tasks.process_lead_batch")
def process_lead_batch(batch_id):
    """
    Asynchronous task to process a LeadBatch (CSV/Excel upload).
    """
    logger.info(f"Starting background processing for LeadBatch: {batch_id}")
    try:
        UploadService.process_batch(batch_id)
        logger.info(f"Successfully processed LeadBatch: {batch_id}")
    except Exception as e:
        logger.error(f"Failed to process LeadBatch {batch_id}: {str(e)}")
        # Update batch status to FAILED if not already handled in service
        try:
            batch = LeadBatch.objects.get(id=batch_id)
            if batch.status != LeadBatchStatus.COMPLETED:
                batch.status = LeadBatchStatus.FAILED
                batch.error_log = {"global": f"System error during background processing: {str(e)}"}
                batch.save()
        except LeadBatch.DoesNotExist:
            pass

@shared_task(name="apps.leads.tasks.check_lead_aging")
def check_lead_aging():
    """
    Periodic task to detect leads that haven't been touched in X days.
    (Phase 7 Automation)
    """
    aging_threshold = timezone.now() - timedelta(days=7)
    
    # Multi-tenant logic: Process each client separately to maintain isolation
    from apps.clients.models import ClientAccount
    clients = ClientAccount.objects.filter(is_active=True)
    
    total_processed = 0
    for client in clients:
        inactive_leads = Lead.objects.filter(
            client=client,
            status__in=[LeadStatus.CALLED, LeadStatus.INTERESTED],
            updated_at__lt=aging_threshold
        )
        
        count = inactive_leads.count()
        if count > 0:
            logger.info(f"Found {count} aging leads for client {client.name}. Triggering alerts...")
            # Phase 7 logic...
            total_processed += count
    
    return f"Processed {total_processed} aging leads across all clients."

@shared_task(name="apps.leads.tasks.reminder_engine")
def reminder_engine():
    """
    Periodic task to check for next_call_at reminders.
    (Phase 7 Automation)
    """
    now = timezone.now()
    from apps.clients.models import ClientAccount
    clients = ClientAccount.objects.filter(is_active=True)
    
    total_triggered = 0
    for client in clients:
        due_reminders = Lead.objects.filter(
            client=client,
            next_call_at__lte=now,
            status__in=[LeadStatus.NEW, LeadStatus.CALLED, LeadStatus.INTERESTED]
        ).select_related('assigned_to')
        
        count = due_reminders.count()
        if count > 0:
            logger.info(f"Triggering {count} reminders for client {client.name}...")
            for lead in due_reminders:
                if lead.assigned_to:
                    logger.info(f"Reminder for {lead.assigned_to.email}: Call {lead.first_name} ({lead.phone})")
            total_triggered += count
                
    return f"Triggered {total_triggered} reminders across all clients."

@shared_task(name="apps.leads.tasks.reassign_stale_leads")
def reassign_stale_leads():
    """
    Periodic task to unassign leads that haven't been touched in 48 hours.
    (Phase 11 Automation)
    """
    threshold = timezone.now() - timedelta(hours=48)
    
    from apps.clients.models import ClientAccount
    clients = ClientAccount.objects.filter(is_active=True)
    
    total_reassigned = 0
    for client in clients:
        # Leads with no interaction or movement for 48 hours revert to general queue
        stale_leads = Lead.objects.filter(
            client=client,
            assigned_to__isnull=False,
            last_interaction_at__lt=threshold,
            status__in=[LeadStatus.NEW, LeadStatus.CALLED, LeadStatus.INTERESTED]
        )
        
        count = stale_leads.count()
        if count > 0:
            logger.info(f"Reassigning {count} stale leads for client {client.name} to general pool.")
            # Unassign and reset to NEW status for re-distribution
            stale_leads.update(assigned_to=None, status=LeadStatus.NEW)
            total_reassigned += count
            
    return f"Automatically reassigned {total_reassigned} stale leads across multi-tenant platform."
