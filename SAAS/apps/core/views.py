from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.response import Response
from rest_framework import status
import logging

logger = logging.getLogger(__name__)


class ForceLogoutAwareTokenRefreshView(TokenRefreshView):
    """
    Custom refresh view that rejects refresh tokens issued before a force logout.
    Without this, the frontend would silently re-authenticate employees
    and the force logout feature would be completely bypassed.
    """
    def post(self, request, *args, **kwargs):
        refresh_token_str = request.data.get('refresh')
        if refresh_token_str:
            try:
                token = RefreshToken(refresh_token_str)
                user_id = token.get('user_id')
                
                if user_id:
                    from apps.accounts.models import User, RoleChoices
                    user = User.objects.select_related('client').get(id=user_id)
                    client = getattr(user, 'client', None)
                    
                    if (client and client.force_logout_until 
                            and user.role != RoleChoices.CLIENT_ADMIN):
                        iat = token.get('iat')
                        if iat and iat < client.force_logout_until.timestamp():
                            return Response(
                                {"detail": "Session expired by admin. Please log in again.", "code": "force_logout"},
                                status=status.HTTP_401_UNAUTHORIZED
                            )
            except Exception as e:
                logger.warning(f"Force logout refresh check error: {e}")
                # Let the parent handle invalid tokens naturally
        
        return super().post(request, *args, **kwargs)
