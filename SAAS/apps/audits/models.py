from django.db import models
from django.conf import settings
from django.core.exceptions import PermissionDenied
from apps.core.models import BaseModel

class AuditLog(BaseModel):
    """
    Tracks critical system actions for compliance and debugging.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="audit_logs"
    )
    action = models.CharField(max_length=100)  # e.g., "LEAD_MERGE", "LEAD_REASSIGN"
    resource_type = models.CharField(max_length=50) # e.g., "Lead"
    resource_id = models.CharField(max_length=255, null=True, blank=True)
    changes = models.JSONField(default=dict, blank=True) # Before/After diffs
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        """Only allow INSERT, never UPDATE. Enforces immutability."""
        if self.pk and AuditLog.objects.filter(pk=self.pk).exists():
            raise PermissionDenied("Audit logs are immutable and cannot be modified.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        """Block all deletions. Audit logs must be permanent."""
        raise PermissionDenied("Audit logs are immutable and cannot be deleted.")

    def __str__(self):
        return f"{self.user} - {self.action} - {self.created_at}"

class LoginHistory(BaseModel):
    """
    Tracks user login locations for security monitoring.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="login_history"
    )
    ip_address = models.GenericIPAddressField()
    city = models.CharField(max_length=255, blank=True)
    country = models.CharField(max_length=255, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    is_suspicious = models.BooleanField(default=False)
    suspicious_reason = models.TextField(blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user} - {self.ip_address} - {self.created_at}"
