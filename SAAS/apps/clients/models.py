import uuid
from django.db import models
from django.utils import timezone

class ClientAccount(models.Model):
    """
    The core Multi-Tenancy model. Every record in the system (except SuperUser models)
    MUST belong to a ClientAccount.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, help_text="Company Name")
    subdomain = models.CharField(max_length=100, unique=True, null=True, blank=True, help_text="For future tenant-specific routing")
    
    is_active = models.BooleanField(default=True)
    max_users = models.IntegerField(default=5, help_text="Maximum allowed employees")
    storage_quota_mb = models.IntegerField(default=1024, help_text="File storage quota in MB")
    geofencing_enabled = models.BooleanField(default=False, help_text="Global toggle to enforce geolocation checking for employees")
    
    # Daily targets — configurable by client admin
    daily_telecaller_target = models.IntegerField(default=100, help_text="Daily call target per telecaller")
    daily_field_agent_target = models.IntegerField(default=8, help_text="Daily visit target per field agent")

    plan = models.CharField(max_length=20, choices=[('basic','Basic'),('pro','Pro'),('enterprise','Enterprise')], default='basic')
    trial_days = models.IntegerField(default=14, help_text="Number of trial days")
    subscription_start = models.DateField(null=True, blank=True, help_text="Subscription/trial start date")
    valid_until = models.DateField(null=True, blank=True, help_text="Subscription valid until date")

    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def subscription_status(self):
        """Returns: 'active', 'expiring_soon', 'expired', or 'no_plan'"""
        from datetime import timedelta
        if not self.valid_until:
            return 'no_plan'
        today = timezone.now().date()
        days_remaining = (self.valid_until - today).days
        if days_remaining > 7:
            return 'active'
        elif days_remaining >= 0:
            return 'expiring_soon'
        else:
            return 'expired'

    @property
    def days_remaining(self):
        if not self.valid_until:
            return None
        return (self.valid_until - timezone.now().date()).days

    def __str__(self):
        return self.name

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Client Account"
        verbose_name_plural = "Client Accounts"

class GeofenceType(models.TextChoices):
    CIRCLE = "CIRCLE", "Circle (radius-based)"
    POLYGON = "POLYGON", "Polygon (custom boundary)"


class ClientLocation(models.Model):
    """
    A permitted working geographical hub for a given client company.
    Supports both circle-based (Haversine) and polygon-based (ray-casting) geofencing.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey(ClientAccount, on_delete=models.CASCADE, related_name='geofence_locations', db_index=True)
    name = models.CharField(max_length=150, help_text="e.g., Main Office", default="Branch Office")
    
    geofence_type = models.CharField(
        max_length=10,
        choices=GeofenceType.choices,
        default=GeofenceType.CIRCLE,
        help_text="CIRCLE uses lat/lng/radius. POLYGON uses polygon_coords."
    )

    # Circle-based fields (used when geofence_type=CIRCLE)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    radius_meters = models.IntegerField(default=500, help_text="Permitted login radius around this coordinate")

    # Polygon-based fields (used when geofence_type=POLYGON)
    # Stores an ordered list of coordinates: [{"lat": 19.07, "lng": 72.87}, {"lat": 19.08, "lng": 72.88}, ...]
    polygon_coords = models.JSONField(
        default=list, blank=True,
        help_text="Ordered list of {lat, lng} points defining the polygon boundary"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.name} ({self.client.name}) [{self.geofence_type}]"
