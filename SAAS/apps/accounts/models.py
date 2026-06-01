from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import BaseModel
from .managers import CustomUserManager

class RoleChoices(models.TextChoices):
    SUPER_ADMIN = "SUPER_ADMIN", _("Super Admin")
    CLIENT_ADMIN = "CLIENT_ADMIN", _("Client Admin")
    MANAGER = "MANAGER", _("Manager")
    TELECALLER = "TELECALLER", _("Telecaller / Sales")
    FIELD_AGENT = "FIELD_AGENT", _("Field Agent")

class User(AbstractBaseUser, PermissionsMixin, BaseModel):
    """
    Custom User Model for DY LeadFlow CRM.
    Uses email as the username field.
    Inherits BaseModel for UUID primary key and timestamps.
    """
    email = models.EmailField(_("email address"), unique=True)
    first_name = models.CharField(_("first name"), max_length=150, blank=True)
    last_name = models.CharField(_("last name"), max_length=150, blank=True)
    phone = models.CharField(_("phone number"), max_length=20, blank=True, null=True)
    
    role = models.CharField(
        max_length=20,
        choices=RoleChoices.choices,
        default=RoleChoices.CLIENT_ADMIN,
    )
    
    # Multi-tenancy isolation
    # Nullable because SUPER_ADMIN users don't belong to any specific client
    client = models.ForeignKey(
        'clients.ClientAccount', 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True,
        related_name='users'
    )
    
    is_staff = models.BooleanField(
        _("staff status"),
        default=False,
        help_text=_("Designates whether the user can log into this admin site."),
    )
    is_active = models.BooleanField(
        _("active"),
        default=True,
        help_text=_(
            "Designates whether this user should be treated as active. "
            "Unselect this instead of deleting accounts."
        ),
    )
    must_change_password = models.BooleanField(
        _("must change password"),
        default=False,
        help_text=_(
            "When True, the user must change their password before "
            "accessing any other API endpoint."
        ),
    )
    geofencing_exempt = models.BooleanField(
        _("exempt from geofencing"),
        default=False,
        help_text=_("If True, this specific user overrides their organization's geofencing rules (useful for global agents).")
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = CustomUserManager()

    def __str__(self):
        return self.email


class PasswordHistory(models.Model):
    """
    Stores hashed passwords to prevent reuse.
    Keeps last N passwords per user for OWASP compliance.
    """
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='password_history')
    password_hash = models.CharField(max_length=255, help_text="Hashed password (same format as auth)")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = "Password Histories"

    def __str__(self):
        return f"{self.user.email} - {self.created_at}"


class LoginAttempt(models.Model):
    """
    Tracks login attempts for brute-force protection.
    After N failed attempts, the account should be temporarily locked.
    """
    id = models.AutoField(primary_key=True)
    email = models.EmailField(db_index=True, help_text="Email used in the attempt")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    success = models.BooleanField(default=False)
    attempted_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-attempted_at']
        indexes = [
            models.Index(fields=['email', 'attempted_at']),
        ]

    def __str__(self):
        status = "OK" if self.success else "FAIL"
        return f"{self.email} [{status}] - {self.attempted_at}"


class NotificationPreference(models.Model):
    """
    Per-user notification preferences. Replaces frontend-only toggles
    with a persistent, server-authoritative store.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='notification_prefs', primary_key=True)

    aged_lead_alerts = models.BooleanField(default=True, help_text="Notify when leads go idle beyond threshold")
    duplicate_lead_alerts = models.BooleanField(default=True, help_text="Notify when CSV upload contains duplicates")
    daily_performance_summary = models.BooleanField(default=True, help_text="Email summary of team performance")
    site_visit_reminders = models.BooleanField(default=True, help_text="Push notification before scheduled visits")
    lost_lead_notifications = models.BooleanField(default=False, help_text="Alert when lead is marked lost 4 times")

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"NotifPrefs: {self.user.email}"




class FCMDevice(models.Model):
    """
    Stores Firebase Cloud Messaging (FCM) push tokens for users.
    A user can have multiple devices (web, android, ios).
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='fcm_devices')
    registration_id = models.CharField(max_length=512, unique=True, help_text="The FCM registration token")
    device_type = models.CharField(max_length=20, default='web', help_text="web, android, or ios")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.user.email} - {self.device_type} (Active: {self.is_active})"
