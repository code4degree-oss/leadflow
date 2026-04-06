from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed
import logging

logger = logging.getLogger(__name__)


class CustomJWTAuthentication(JWTAuthentication):
    """
    Custom JWT Authentication that checks if the token was issued before a forced logout.
    """
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        
        try:
            # Only check force logout for users that belong to a client tenant
            # SUPER_ADMIN users have client=None and should never be affected
            client = getattr(user, 'client', None)
            if client and client.force_logout_until:
                # Skip Client Admins — they triggered the logout
                from apps.accounts.models import RoleChoices
                if user.role != RoleChoices.CLIENT_ADMIN:
                    iat = validated_token.get('iat')
                    if iat and iat < client.force_logout_until.timestamp():
                        raise AuthenticationFailed(
                            "Session expired by admin. Please log in again.",
                            code="force_logout"
                        )
        except AuthenticationFailed:
            raise  # re-raise intentional logouts
        except Exception as e:
            # Never let a force-logout check crash unrelated API calls
            logger.warning(f"Force logout check failed for user {user.id}: {e}")
                    
        return user
