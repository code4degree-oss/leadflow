from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import BaseModel
from apps.accounts.models import User

class LeadStatus(models.TextChoices):
    NEW = "NEW", _("New")
    CALLED = "CALLED", _("Called")
    NOT_ANSWERED = "NOT_ANSWERED", _("Not Answered")
    INTERESTED = "INTERESTED", _("Interested")
    SITE_VISIT = "SITE_VISIT", _("Site Visit")
    WON = "WON", _("Won")
    LOST = "LOST", _("Lost")
    INVALID_NUMBER = "INVALID_NUMBER", _("Invalid Number")

class SiteVisitStatus(models.TextChoices):
    SCHEDULED = "SCHEDULED", _("Scheduled")
    COMPLETED = "COMPLETED", _("Completed")
    CANCELLED = "CANCELLED", _("Cancelled")


class LeadSource(models.TextChoices):
    FACEBOOK = "FACEBOOK", _("Facebook Ads")
    GOOGLE = "GOOGLE", _("Google Ads")
    WEBSITE = "WEBSITE", _("Website")
    MANUAL = "MANUAL", _("Manual Upload")
    OTHER = "OTHER", _("Other")


class LeadBatchStatus(models.TextChoices):
    PENDING = "PENDING", _("Pending")
    PROCESSING = "PROCESSING", _("Processing")
    COMPLETED = "COMPLETED", _("Completed")
    FAILED = "FAILED", _("Failed")


class LeadBatch(BaseModel):
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name="uploaded_lead_batches"
    )
    name = models.CharField(max_length=255, blank=True, default='', help_text="Batch source name provided during upload")
    file = models.FileField(upload_to="lead_uploads/%Y/%m/")
    status = models.CharField(
        max_length=20,
        choices=LeadBatchStatus.choices,
        default=LeadBatchStatus.PENDING
    )
    
    # Simple stats tracking
    total_rows = models.IntegerField(default=0)
    imported_count = models.IntegerField(default=0)
    failed_count = models.IntegerField(default=0)
    
    # File metadata for validation & security
    file_size = models.BigIntegerField(null=True, blank=True, help_text="File size in bytes")
    mime_type = models.CharField(max_length=100, blank=True, default='', help_text="MIME type of uploaded file")
    checksum = models.CharField(max_length=64, blank=True, default='', help_text="SHA-256 checksum for integrity verification")
    
    # Store errors line by line for user feedback
    error_log = models.JSONField(default=dict, blank=True)
    
    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Batch {self.id} - {self.status}"


class Project(BaseModel):
    """
    Configurable project names per client.
    Admin manages these (e.g. "Tower A - Sunrise Heights", "Plot Phase 2").
    Telecallers select from dropdown when logging calls.
    """
    name = models.CharField(max_length=255)
    location = models.CharField(max_length=255, blank=True, default='')
    description = models.TextField(blank=True, default='')
    price_range = models.CharField(max_length=100, blank=True, default='', help_text="e.g. 65L – 1.2Cr")
    is_active = models.BooleanField(default=True)

    # 1BHK inventory
    has_1bhk = models.BooleanField(default=False)
    total_1bhk = models.IntegerField(default=0)
    available_1bhk = models.IntegerField(default=0)

    # 2BHK inventory
    has_2bhk = models.BooleanField(default=False)
    total_2bhk = models.IntegerField(default=0)
    available_2bhk = models.IntegerField(default=0)

    # 3BHK inventory
    has_3bhk = models.BooleanField(default=False)
    total_3bhk = models.IntegerField(default=0)
    available_3bhk = models.IntegerField(default=0)

    class Meta:
        ordering = ['name']
        unique_together = [['client', 'name']]

    def __str__(self):
        return self.name


class Lead(BaseModel):
    """
    Core Lead model. Inherits BaseModel, so it gets client isolation, UUID pk, and timestamps automatically.
    """
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150, blank=True)
    
    # Phone number is indexed because we will do fuzzy matching and duplication detection on it
    phone = models.CharField(max_length=20, db_index=True)
    email = models.EmailField(blank=True, null=True)
    
    status = models.CharField(
        max_length=20, 
        choices=LeadStatus.choices, 
        default=LeadStatus.NEW,
        db_index=True
    )
    
    source = models.CharField(
        max_length=255,
        default=LeadSource.OTHER
    )
    
    assigned_to = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_leads"
    )
    
    # Scheduling and automated follow-ups
    next_call_at = models.DateTimeField(null=True, blank=True, db_index=True)
    
    # Deduplication tracking (Phase 5)
    phone_hash = models.CharField(max_length=64, blank=True, null=True, db_index=True, help_text="SHA-256 hash of normalized phone")
    
    # Linking lead to the batch it was uploaded in
    batch = models.ForeignKey(
        LeadBatch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="leads"
    )

    is_archived = models.BooleanField(default=False, db_index=True)

    # Track activity for stale lead logic (Phase 11)
    last_interaction_at = models.DateTimeField(null=True, blank=True, db_index=True)

    # Lost-lead escalation counter
    lost_count = models.IntegerField(default=0, help_text="Number of times this lead has been marked lost")

    # Call logging fields
    budget = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, help_text="Lead's stated budget")
    interested_flat = models.CharField(max_length=200, blank=True, null=True, help_text="Which flat/unit the lead is interested in")
    area = models.CharField(max_length=255, blank=True, default='', help_text="Preferred area/location of the lead")
    notes = models.TextField(blank=True, default='', help_text="Telecaller notes from calls")

    # Hot lead flag — marks potential buyer, independent of status
    is_hot = models.BooleanField(default=False, db_index=True, help_text="Potential buyer flag")

    # Field agent assignment (for site visits)
    field_agent = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="field_leads",
        help_text="Assigned field agent for site visits"
    )

    # Interested project (dropdown)
    project = models.ForeignKey(
        Project,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="leads",
        help_text="Project the lead is interested in"
    )

    class Meta:
        ordering = ['-created_at']
        
        # Ensures that phone numbers are unique PER CLIENT, not globally
        unique_together = [['client', 'phone'], ['client', 'phone_hash']]
        
        indexes = [
            models.Index(fields=['client', 'status']),
            models.Index(fields=['client', 'assigned_to']),
            models.Index(fields=['client', 'lost_count']),
            models.Index(fields=['client', 'created_at']),
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['client', 'source']),
            models.Index(fields=['client', 'is_deleted']),
        ]

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.phone})"


class SiteVisit(BaseModel):
    """
    Tracks field agent visits to lead locations.
    """
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name="visits")
    agent = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="site_visits")
    
    scheduled_at = models.DateTimeField()
    completed_at = models.DateTimeField(null=True, blank=True)
    
    status = models.CharField(
        max_length=20, 
        choices=SiteVisitStatus.choices, 
        default=SiteVisitStatus.SCHEDULED
    )
    
    outcome = models.CharField(max_length=50, blank=True, null=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-scheduled_at']
        indexes = [
            models.Index(fields=['client', 'agent', 'status']),
            models.Index(fields=['client', 'scheduled_at']),
        ]

    def __str__(self):
        return f"Visit for {self.lead} by {self.agent} at {self.scheduled_at}"


class FollowUpReminder(BaseModel):
    """
    Telecaller follow-up reminders. Email fires 30 min before scheduled_at.
    """
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name="reminders")
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="reminders")
    
    scheduled_at = models.DateTimeField(db_index=True, help_text="When the follow-up call should happen")
    note = models.TextField(blank=True, default='')
    
    is_completed = models.BooleanField(default=False)
    is_push_sent = models.BooleanField(default=False, help_text="Whether the 5-min push reminder was sent")
    email_sent = models.BooleanField(default=False, help_text="Whether the 30-min reminder email was sent")

    class Meta:
        ordering = ['scheduled_at']
        indexes = [
            models.Index(fields=['created_by', 'is_completed']),
            models.Index(fields=['scheduled_at', 'email_sent']),
        ]

    def __str__(self):
        return f"Reminder for {self.lead} at {self.scheduled_at}"


class LeadAssignmentHistory(BaseModel):
    """
    Audit trail for every lead assignment/reassignment.
    Answers: WHO was assigned this lead WHEN, and WHO made the change.
    """
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='assignment_history')
    from_user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='leads_transferred_from',
        help_text="Previous assignee (null if first assignment)"
    )
    to_user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='leads_transferred_to',
        help_text="New assignee"
    )
    changed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='assignment_changes_made',
        help_text="User who performed the reassignment"
    )
    reason = models.CharField(max_length=255, blank=True, default='', help_text="e.g., round-robin, manual, lost-escalation")

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['lead', 'created_at']),
            models.Index(fields=['client', 'to_user']),
        ]

    def __str__(self):
        return f"{self.lead} | {self.from_user} → {self.to_user} at {self.created_at}"


class ActivityType(models.TextChoices):
    STATUS_CHANGE = "STATUS_CHANGE", "Status Change"
    CALL_LOGGED = "CALL_LOGGED", "Call Logged"
    NOTE_ADDED = "NOTE_ADDED", "Note Added"
    ASSIGNED = "ASSIGNED", "Lead Assigned"
    REASSIGNED = "REASSIGNED", "Lead Reassigned"
    SITE_VISIT_SCHEDULED = "SITE_VISIT_SCHEDULED", "Site Visit Scheduled"
    SITE_VISIT_COMPLETED = "SITE_VISIT_COMPLETED", "Site Visit Completed"
    FOLLOW_UP_SET = "FOLLOW_UP_SET", "Follow-up Reminder Set"
    FOLLOW_UP_COMPLETED = "FOLLOW_UP_COMPLETED", "Follow-up Completed"
    ESCALATED = "ESCALATED", "Lead Escalated"
    IMPORTED = "IMPORTED", "Lead Imported from CSV"
    ARCHIVED = "ARCHIVED", "Lead Archived"
    RESTORED = "RESTORED", "Lead Restored"


class ActivityTimeline(BaseModel):
    """
    Unified activity log for every lead event.
    Powers the lead detail timeline UI, debugging, and analytics.
    """
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='timeline')
    performed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='activities',
        help_text="User who performed this action"
    )

    activity_type = models.CharField(
        max_length=30,
        choices=ActivityType.choices,
        db_index=True,
    )

    title = models.CharField(max_length=255, help_text="Human-readable summary, e.g. 'Status changed from NEW to CALLED'")
    
    # Optional structured data for the event (old/new values, metadata, etc.)
    metadata = models.JSONField(default=dict, blank=True, help_text="Extra context: old_status, new_status, call_duration, etc.")

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['lead', 'created_at']),
            models.Index(fields=['client', 'activity_type']),
            models.Index(fields=['performed_by', 'created_at']),
        ]

    def __str__(self):
        return f"[{self.activity_type}] {self.lead} - {self.title}"


class NotificationType(models.TextChoices):
    WON = "WON", _("Lead Won")
    LOST = "LOST", _("Lead Lost")
    REMINDER = "REMINDER", _("Call Reminder")
    ASSIGNMENT = "ASSIGNMENT", _("Lead Assigned")
    VISIT = "VISIT", _("Site Visit")
    UPLOAD = "UPLOAD", _("Leads Uploaded")
    INFO = "INFO", _("General Info")
    BROADCAST = "BROADCAST", _("Broadcast")
    SYSTEM = "SYSTEM", _("System")
    SUBSCRIPTION_WARNING = "SUBSCRIPTION_WARNING", _("Subscription Warning")
    SUBSCRIPTION_EXPIRED = "SUBSCRIPTION_EXPIRED", _("Subscription Expired")


class Notification(BaseModel):
    """
    In-app notification for all user roles.
    """
    user = models.ForeignKey(
        User, on_delete=models.CASCADE,
        related_name='lead_notifications',
        help_text="The recipient of this notification"
    )
    title = models.CharField(max_length=255)
    message = models.TextField(blank=True, default='')
    notif_type = models.CharField(
        max_length=20,
        choices=NotificationType.choices,
        default=NotificationType.INFO,
        db_index=True,
    )
    is_read = models.BooleanField(default=False, db_index=True)

    # Optional links to related objects for "View" action
    lead = models.ForeignKey(
        'Lead', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='notifications',
    )
    site_visit = models.ForeignKey(
        'SiteVisit', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='notifications',
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_read', 'created_at']),
            models.Index(fields=['client', 'user']),
        ]

    def __str__(self):
        return f"[{self.notif_type}] {self.user} - {self.title}"


from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

@receiver(post_save, sender=Notification)
def send_push_on_notification(sender, instance, created, **kwargs):
    """
    Listens for new in-app notifications and triggers an FCM Push Notification asynchronously.
    """
    if created:
        from apps.leads.tasks import send_push_notification_task
        transaction.on_commit(lambda: send_push_notification_task.delay(str(instance.id)))

