from django.contrib import admin
from apps.accounts.models import RoleChoices


class MultiTenantModelAdmin(admin.ModelAdmin):
    """
    Base ModelAdmin for all tenant-specific models in LeadFlow CRM.
    Ensures that users (who are not Super Admins) can only see and edit
    data belonging to their own ClientAccount.
    """

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if not request.user.is_authenticated:
            return qs.none()
        if request.user.is_superuser or request.user.role == RoleChoices.SUPER_ADMIN:
            return qs
        if request.user.client:
            return qs.filter(client=request.user.client)
        return qs.none()

    def save_model(self, request, obj, form, change):
        """
        If a non-superadmin is creating an object, automatically set its client
        to the user's client.
        """
        if not change:
            if not getattr(obj, "client_id", None) and request.user.client:
                obj.client = request.user.client
        super().save_model(request, obj, form, change)

    def has_change_permission(self, request, obj=None):
        if not obj:
            return True
        if not request.user.is_authenticated:
            return False
        if request.user.is_superuser or request.user.role == RoleChoices.SUPER_ADMIN:
            return True
        # Enforce that users can only change their own client's objects
        return obj.client_id == request.user.client_id

    def has_delete_permission(self, request, obj=None):
        if not obj:
            return True
        if not request.user.is_authenticated:
            return False
        if request.user.is_superuser or request.user.role == RoleChoices.SUPER_ADMIN:
            return True
        return obj.client_id == request.user.client_id
