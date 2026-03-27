from django.contrib import admin
from .models import ClientAccount

@admin.register(ClientAccount)
class ClientAccountAdmin(admin.ModelAdmin):
    list_display = ('name', 'subdomain', 'is_active', 'max_users', 'created_at')
    search_fields = ('name', 'subdomain')
    list_filter = ('is_active',)
    
    def has_module_permission(self, request):
        from apps.accounts.models import RoleChoices
        if not request.user.is_authenticated:
            return False
        return request.user.is_superuser or request.user.role == RoleChoices.SUPER_ADMIN
