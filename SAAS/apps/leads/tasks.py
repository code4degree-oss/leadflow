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
    Periodic task to detect and alert on stale leads.
    Thresholds: NEW > 24h, CALLED > 48h, INTERESTED > 72h without interaction.
    Creates in-app notifications for both the assigned agent and client admins.
    """
    from apps.clients.models import ClientAccount
    from apps.leads.models import ActivityTimeline, ActivityType, Notification, NotificationType
    from apps.accounts.models import User, RoleChoices
    
    now = timezone.now()
    
    # Configurable aging thresholds per status
    thresholds = {
        LeadStatus.NEW: timedelta(hours=24),
        LeadStatus.CALLED: timedelta(hours=48),
        LeadStatus.INTERESTED: timedelta(hours=72),
    }
    
    clients = ClientAccount.objects.filter(is_active=True)
    total_flagged = 0
    
    for client in clients:
        admins = list(User.objects.filter(client=client, role=RoleChoices.CLIENT_ADMIN, is_active=True))
        
        for lead_status, threshold in thresholds.items():
            cutoff = now - threshold
            
            # Find stale leads that haven't been flagged recently (avoid duplicate alerts)
            stale_leads = Lead.objects.filter(
                client=client,
                status=lead_status,
                is_archived=False,
                updated_at__lt=cutoff
            ).select_related('assigned_to')
            
            # Exclude leads that were already flagged as ESCALATED in the last 24h
            recently_flagged_ids = ActivityTimeline.objects.filter(
                client=client,
                activity_type=ActivityType.ESCALATED,
                created_at__gte=now - timedelta(hours=24)
            ).values_list('lead_id', flat=True)
            
            stale_leads = stale_leads.exclude(id__in=recently_flagged_ids)
            
            for lead in stale_leads:
                hours_idle = int((now - lead.updated_at).total_seconds() / 3600)
                lead_name = f"{lead.first_name} {lead.last_name}".strip()
                
                # Create escalation timeline entry
                ActivityTimeline.objects.create(
                    client=client,
                    lead=lead,
                    performed_by=None,
                    activity_type=ActivityType.ESCALATED,
                    title=f"⚠️ Lead stale — {lead_status} for {hours_idle}h with no activity",
                    metadata={'status': lead_status, 'hours_idle': hours_idle}
                )
                
                # Notify assigned agent
                if lead.assigned_to:
                    Notification.objects.create(
                        client=client,
                        user=lead.assigned_to,
                        title=f"⚠️ Stale Lead: {lead_name}",
                        message=f"This lead has been in {lead_status} for {hours_idle} hours. Please follow up immediately.",
                        notif_type=NotificationType.AGED,
                        lead=lead,
                    )
                
                # Notify admins
                for admin in admins:
                    Notification.objects.create(
                        client=client,
                        user=admin,
                        title=f"⚠️ Aged Lead Alert: {lead_name}",
                        message=f"Lead in {lead_status} for {hours_idle}h. Assigned to: {lead.assigned_to.email if lead.assigned_to else 'Unassigned'}",
                        notif_type=NotificationType.AGED,
                        lead=lead,
                    )
                
                total_flagged += 1
    
    logger.info(f"[LEAD_AGING] Flagged {total_flagged} stale leads across all clients.")
    return f"Flagged {total_flagged} stale leads across all clients."

@shared_task(name="apps.leads.tasks.reminder_engine")
def reminder_engine():
    """
    Periodic task to check for due follow-up reminders and next_call_at.
    Creates notifications for agents with due reminders.
    """
    now = timezone.now()
    from apps.clients.models import ClientAccount
    from apps.leads.models import FollowUpReminder, Notification, NotificationType
    
    clients = ClientAccount.objects.filter(is_active=True)
    total_triggered = 0
    
    for client in clients:
        # Check FollowUpReminder objects
        due_reminders = FollowUpReminder.objects.filter(
            client=client,
            is_completed=False,
            scheduled_at__lte=now
        ).select_related('lead', 'created_by')
        
        for reminder in due_reminders:
            lead = reminder.lead
            lead_name = f"{lead.first_name} {lead.last_name}".strip()
            user = reminder.created_by
            
            if user:
                # Check if notification already sent for this reminder
                existing = Notification.objects.filter(
                    client=client,
                    user=user,
                    lead=lead,
                    notif_type=NotificationType.FOLLOW_UP,
                    created_at__gte=now - timedelta(hours=1)
                ).exists()
                
                if not existing:
                    Notification.objects.create(
                        client=client,
                        user=user,
                        title=f"📞 Follow-up Due: {lead_name}",
                        message=reminder.note or f"Scheduled follow-up for {lead.phone}",
                        notif_type=NotificationType.FOLLOW_UP,
                        lead=lead,
                    )
                    total_triggered += 1
        
        # Also check next_call_at on leads directly
        due_calls = Lead.objects.filter(
            client=client,
            next_call_at__lte=now,
            status__in=[LeadStatus.NEW, LeadStatus.CALLED, LeadStatus.INTERESTED],
            assigned_to__isnull=False
        ).select_related('assigned_to')
        
        for lead in due_calls:
            lead_name = f"{lead.first_name} {lead.last_name}".strip()
            existing = Notification.objects.filter(
                client=client,
                user=lead.assigned_to,
                lead=lead,
                notif_type=NotificationType.FOLLOW_UP,
                created_at__gte=now - timedelta(hours=2)
            ).exists()
            
            if not existing:
                Notification.objects.create(
                    client=client,
                    user=lead.assigned_to,
                    title=f"📞 Call Due: {lead_name}",
                    message=f"Scheduled call for {lead.phone} is now due.",
                    notif_type=NotificationType.FOLLOW_UP,
                    lead=lead,
                )
                total_triggered += 1
                
    logger.info(f"[REMINDER_ENGINE] Triggered {total_triggered} reminders across all clients.")
    return f"Triggered {total_triggered} reminders across all clients."

@shared_task(name="apps.leads.tasks.reassign_stale_leads")
def reassign_stale_leads():
    """
    Periodic task to unassign leads that haven't been touched in 48 hours.
    Creates notifications before unassigning to alert agents and admins.
    """
    threshold = timezone.now() - timedelta(hours=48)
    
    from apps.clients.models import ClientAccount
    from apps.leads.models import ActivityTimeline, ActivityType, Notification, NotificationType
    from apps.accounts.models import User, RoleChoices
    
    clients = ClientAccount.objects.filter(is_active=True)
    total_reassigned = 0
    
    for client in clients:
        admins = list(User.objects.filter(client=client, role=RoleChoices.CLIENT_ADMIN, is_active=True))
        
        stale_leads = Lead.objects.filter(
            client=client,
            assigned_to__isnull=False,
            last_interaction_at__lt=threshold,
            status__in=[LeadStatus.NEW, LeadStatus.CALLED, LeadStatus.INTERESTED]
        ).select_related('assigned_to')
        
        count = stale_leads.count()
        if count > 0:
            logger.info(f"Reassigning {count} stale leads for client {client.name} to general pool.")
            
            # Create notifications before unassigning
            for lead in stale_leads[:50]:  # Cap notifications to avoid flooding
                lead_name = f"{lead.first_name} {lead.last_name}".strip()
                
                # Notify the original assignee
                if lead.assigned_to:
                    Notification.objects.create(
                        client=client,
                        user=lead.assigned_to,
                        title=f"🔄 Lead Auto-Unassigned: {lead_name}",
                        message=f"No interaction for 48+ hours. Moved to general pool.",
                        notif_type=NotificationType.AGED,
                        lead=lead,
                    )
                
                # Log timeline
                ActivityTimeline.objects.create(
                    client=client,
                    lead=lead,
                    performed_by=None,
                    activity_type=ActivityType.REASSIGNED,
                    title=f"🔄 Auto-unassigned — no interaction for 48+ hours",
                    metadata={'previous_assignee': lead.assigned_to.email if lead.assigned_to else None}
                )
            
            # Perform the actual unassignment
            stale_leads.update(assigned_to=None, status=LeadStatus.NEW)
            total_reassigned += count
            
    return f"Automatically reassigned {total_reassigned} stale leads across multi-tenant platform."

@shared_task(name="apps.leads.tasks.send_push_notification_task")
def send_push_notification_task(notif_id):
    """
    Asynchronously sends a push notification to avoid blocking DB transactions.
    """
    from apps.leads.models import Notification
    from apps.core.firebase import send_push_notification
    try:
        instance = Notification.objects.get(id=notif_id)
        data = {
            'notif_id': str(instance.id),
            'notif_type': instance.notif_type,
        }
        if instance.lead_id:
            data['lead_id'] = str(instance.lead_id)
            
        send_push_notification(
            user=instance.user,
            title=instance.title,
            body=instance.message,
            data=data
        )
    except Notification.DoesNotExist:
        pass
    except Exception as e:
        logger.error(f"Failed to send push notification {notif_id}: {e}")
