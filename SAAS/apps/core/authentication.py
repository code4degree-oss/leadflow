from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed
from apps.accounts.models import RoleChoices

class CustomJWTAuthentication(JWTAuthentication):
    """
    Custom JWT Authentication that checks if the token was issued before a forced logout.
    """
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        
        # Check if a forced logout was triggered for this client
        if user.client and user.client.force_logout_until:
            # We don't want to log out the Client Admin who pressed the button
            if user.role != RoleChoices.CLIENT_ADMIN:
                iat = validated_token.get('iat')
                if iat and iat < user.client.force_logout_until.timestamp():
                    raise AuthenticationFailed("Session expired by admin. Please log in again.", code="force_logout")
                    
        return user
