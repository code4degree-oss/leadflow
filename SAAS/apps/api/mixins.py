from apps.accounts.models import RoleChoices

class TenantQuerySetMixin:
    """
    Apply this mixin to any DRF GenericAPIView / ViewSet to automatically
    filter querysets by the requesting user's ClientAccount.
    
    If the user is a SUPER_ADMIN, it returns all records.
    Otherwise, it restricts data to `request.user.client_id`.
    """
    def get_queryset(self):
        qs = super().get_queryset()
        
        # SuperAdmins can see everything across all tenants
        if self.request.user.role == RoleChoices.SUPER_ADMIN:
            return qs
            
        # Standard users only see data for their tenant
        if self.request.user.client_id:
            return qs.filter(client_id=self.request.user.client_id)
            
        # Failsafe: if a user is not a superadmin and has no client, they see nothing.
        return qs.none()
