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
                    
                    # ── Geofence Check on Refresh ──
                    # Only enforce for employees with geofencing active
                    if client and client.geofencing_enabled:
                        exempt_roles = [RoleChoices.SUPER_ADMIN, RoleChoices.CLIENT_ADMIN, RoleChoices.MANAGER]
                        if user.role not in exempt_roles and not user.geofencing_exempt:
                            lat = request.data.get('latitude')
                            lng = request.data.get('longitude')
                            
                            # If frontend didn't send coordinates, block the refresh
                            if lat is None or lng is None or lat == '' or lng == '':
                                logger.warning(f"[GEOFENCE-REFRESH] BLOCKED {user.email} — no coordinates on refresh")
                                return Response(
                                    {"detail": "Location verification required. Please log in again.", "code": "geofence_required"},
                                    status=status.HTTP_401_UNAUTHORIZED
                                )
                            
                            try:
                                lat, lng = float(lat), float(lng)
                            except (ValueError, TypeError):
                                return Response(
                                    {"detail": "Invalid location data. Please log in again.", "code": "geofence_invalid"},
                                    status=status.HTTP_401_UNAUTHORIZED
                                )
                            
                            # Run the same geofence validation as the login endpoint
                            locations = client.geofence_locations.all()
                            if locations.exists():
                                authorized = False
                                for loc in locations:
                                    if loc.geofence_type == 'POLYGON' and loc.polygon_coords:
                                        if self._point_in_polygon(lat, lng, loc.polygon_coords):
                                            authorized = True
                                            break
                                    else:
                                        if loc.latitude and loc.longitude:
                                            distance = self._haversine(lat, lng, float(loc.latitude), float(loc.longitude))
                                            if distance <= loc.radius_meters:
                                                authorized = True
                                                break
                                
                                if not authorized:
                                    logger.warning(f"[GEOFENCE-REFRESH] BLOCKED {user.email} — outside authorized zone (lat={lat}, lng={lng})")
                                    return Response(
                                        {"detail": "Session expired: You are outside your authorized work area. Please return and log in again.", "code": "geofence_blocked"},
                                        status=status.HTTP_401_UNAUTHORIZED
                                    )
                                
                                logger.info(f"[GEOFENCE-REFRESH] ALLOWED {user.email}")
                            
            except Exception as e:
                logger.warning(f"Force logout/geofence refresh check error: {e}")
                # Let the parent handle invalid tokens naturally
        
        return super().post(request, *args, **kwargs)

    @staticmethod
    def _haversine(lat1, lon1, lat2, lon2):
        R = 6371000
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlam = math.radians(lon2 - lon1)
        a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2)**2
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    @staticmethod
    def _point_in_polygon(pt_lat, pt_lng, polygon_coords):
        n = len(polygon_coords)
        if n < 3:
            return False
        inside = False
        j = n - 1
        for i in range(n):
            yi = float(polygon_coords[i]['lat'])
            xi = float(polygon_coords[i]['lng'])
            yj = float(polygon_coords[j]['lat'])
            xj = float(polygon_coords[j]['lng'])
            if ((yi > pt_lat) != (yj > pt_lat)) and \
               (pt_lng < (xj - xi) * (pt_lat - yi) / (yj - yi) + xi):
                inside = not inside
            j = i
        return inside
