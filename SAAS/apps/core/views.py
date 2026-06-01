from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.response import Response
from rest_framework import status
import math
import logging

logger = logging.getLogger(__name__)


class ForceLogoutAwareTokenRefreshView(TokenRefreshView):
    """
    Custom refresh view that:
    1. Rejects refresh tokens issued before a force logout
    2. Enforces geofencing on token refresh (prevents employees from
       refreshing sessions outside the authorized zone)
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
                    
                    # ── Force Logout Check ──
                    if (client and client.force_logout_until 
                            and user.role != RoleChoices.CLIENT_ADMIN):
                        iat = token.get('iat')
                        if iat and iat < client.force_logout_until.timestamp():
                            return Response(
                                {"detail": "Session expired by admin. Please log in again.", "code": "force_logout"},
                                status=status.HTTP_401_UNAUTHORIZED
                            )
                                 # ── Geofencing Check on Refresh ──
                    from apps.core.geo import GeoService
                    lat = request.data.get('latitude')
                    lng = request.data.get('longitude')
                    
                    authorized, reason = GeoService.check_geofence(user, lat, lng)
                    if not authorized:
                        logger.warning(f"[GEOFENCE-REFRESH] BLOCKED {user.email} — {reason}")
                        msg = "Session expired: You are outside your authorized work area. Please return and log in again."
                        code = "geofence_blocked"
                        if "required" in reason.lower():
                            msg = "Location verification required. Please log in again."
                            code = "geofence_required"
                        elif "invalid" in reason.lower():
                            msg = "Invalid location data. Please log in again."
                            code = "geofence_invalid"
                            
                        return Response(
                            {"detail": msg, "code": code},
                            status=status.HTTP_401_UNAUTHORIZED
                        )
                    
                    if client and client.geofencing_enabled:
                        logger.info(f"[GEOFENCE-REFRESH] ALLOWED {user.email} — {reason}")
                            
            except Exception as e:
                logger.warning(f"Force logout/geofence refresh check error: {e}")
                # Let the parent handle invalid tokens naturally
        
        return super().post(request, *args, **kwargs)
