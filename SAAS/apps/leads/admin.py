from django.contrib import admin
from apps.core.admin import MultiTenantModelAdmin
from .models import Lead

@admin.register(Lead)
class LeadAdmin(MultiTenantModelAdmin):
    list_display = ('first_name', 'last_name', 'phone', 'status', 'source', 'assigned_to', 'client', 'created_at')
    search_fields = ('first_name', 'last_name', 'phone', 'email')
    list_filter = ('status', 'source', 'client')
    
    # Optimize foreign key lookups in admin
    raw_id_fields = ('assigned_to', 'client')
    
    fieldsets = (
        ("Basic Info", {
            "fields": (
                "client", 
                ("first_name", "last_name"),
                ("phone", "email")
            )
        }),
        ("Lead Details", {
            "fields": (
                "status",
                "source",
                "assigned_to",
                "next_call_at"
            )
        }),
    )

    def get_readonly_fields(self, request, obj=None):
        """Make client read-only for non-superadmins after creation."""
        from apps.accounts.models import RoleChoices
        if not request.user.is_authenticated:
            return ('client',)
        if getattr(obj, "pk", None) and not (request.user.is_superuser or request.user.role == RoleChoices.SUPER_ADMIN):
            return ('client',)
        return ()
