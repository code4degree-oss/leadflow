from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ["email"]
    list_display = ["email", "first_name", "last_name", "role", "is_staff", "is_active"]
    search_fields = ["email", "first_name", "last_name"]
    list_filter = ["role", "is_staff", "is_superuser", "is_active"]
    
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal info", {"fields": ("first_name", "last_name", "phone")}),
        ("Role & Permissions", {
            "fields": (
                "role",
                "is_active",
                "is_staff",
                "is_superuser",
                "groups",
                "user_permissions",
            ),
        }),
        ("Important dates", {"fields": ("last_login",)}),
    )
    
    # Required for Django admin to use email instead of username
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("email", "role", "password"),
        }),
    )
