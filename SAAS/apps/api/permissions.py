
from django.utils import timezone
from rest_framework import permissions
from apps.accounts.models import RoleChoices


class BaseRolePermission(permissions.BasePermission):
    """
    Base class for role-based permissions.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)


class IsAccountActive(permissions.BasePermission):
    """
    Global guard that blocks requests when:
    1. The user must change their password first (must_change_password=True).
    2. The user's client subscription has expired (valid_until < today).

    Super Admins are exempt from all these checks.
    """
    # Endpoints that are always allowed even when password change is required
    EXEMPT_PATHS = (
        '/api/v1/auth/change-password/',
        '/api/v1/auth/login/',
        '/api/v1/auth/refresh/',
        '/api/v1/auth/me/',
    )

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return True  # Let other permission classes handle authentication

        # Super Admins bypass all tenant-level checks
        if user.role == RoleChoices.SUPER_ADMIN:
            return True

        # --- Password change enforcement ---
        if user.must_change_password:
            if request.path not in self.EXEMPT_PATHS:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied(
                    detail="You must change your password before continuing.",
                    code="password_change_required",
                )

        # --- Subscription / trial expiry check (no grace period) ---
        client = getattr(user, 'client', None)
        if client:
            if not client.is_active:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied(
                    detail="Your organization's account has been suspended. Please contact support.",
                    code="account_suspended",
                )
            
            if not client.valid_until:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied(
                    detail="Your subscription plan is missing or invalid. Please contact your administrator.",
                    code="subscription_expired",
                )
            elif timezone.now().date() > client.valid_until:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied(
                    detail="Your subscription has expired. Please contact your administrator to renew.",
                    code="subscription_expired",
                )

        return True


class IsSuperAdmin(BaseRolePermission):
    """
    Allows access only to Super Admins.
    """
    def has_permission(self, request, view):
        is_authenticated = super().has_permission(request, view)
        return is_authenticated and request.user.role == RoleChoices.SUPER_ADMIN


class IsClientAdmin(BaseRolePermission):
    """
    Allows access to Super Admins and Client Admins.
    """
    def has_permission(self, request, view):
        is_authenticated = super().has_permission(request, view)
        return is_authenticated and request.user.role in [
            RoleChoices.SUPER_ADMIN,
            RoleChoices.CLIENT_ADMIN
        ]


class IsManagerOrHigher(BaseRolePermission):
    """
    Allows access to Super Admin, Client Admin, and Managers.
    """
    def has_permission(self, request, view):
        is_authenticated = super().has_permission(request, view)
        return is_authenticated and request.user.role in [
            RoleChoices.SUPER_ADMIN,
            RoleChoices.CLIENT_ADMIN,
            RoleChoices.MANAGER
        ]


class IsTelecallerOrHigher(BaseRolePermission):
    """
    Allows access to all internal roles except Field Agents.
    Field Agents generally have a highly restricted mobile view.
    """
    def has_permission(self, request, view):
        is_authenticated = super().has_permission(request, view)
        return is_authenticated and request.user.role in [
            RoleChoices.SUPER_ADMIN,
            RoleChoices.CLIENT_ADMIN,
            RoleChoices.MANAGER,
            RoleChoices.TELECALLER
        ]


class IsFieldAgentOrHigher(BaseRolePermission):
    """
    Allows access to Field Agents and all higher roles (including Telecallers).
    """
    def has_permission(self, request, view):
        is_authenticated = super().has_permission(request, view)
        return is_authenticated and request.user.role in [
            RoleChoices.SUPER_ADMIN,
            RoleChoices.CLIENT_ADMIN,
            RoleChoices.MANAGER,
            RoleChoices.TELECALLER,
            RoleChoices.FIELD_AGENT
        ]
