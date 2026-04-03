from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.api.serializers import CustomTokenObtainPairSerializer, UserMeSerializer
from apps.accounts.models import RoleChoices
import math
import logging

logger = logging.getLogger(__name__)


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Login endpoint that returns JWT Access and Refresh tokens.
    Uses our CustomTokenObtainPairSerializer to include role and client info.
    Enforces geofencing checks in the view layer for reliable blocking.
    """
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        # First, let SimpleJWT authenticate and generate tokens normally
        response = super().post(request, *args, **kwargs)

        # If authentication failed, return as-is (401/400)
        if response.status_code != 200:
            return response

        # Authentication succeeded — now enforce geofencing
        # We need to look up the user from the validated data
        email = request.data.get('email', '').strip()
        from apps.accounts.models import User
        try:
            user = User.objects.select_related('client').get(email=email)
        except User.DoesNotExist:
            return response  # Shouldn't happen if auth passed

        client = user.client
        if not client:
            return response  # Super admin, no client

        # Only enforce for standard employees
        exempt_roles = [RoleChoices.SUPER_ADMIN, RoleChoices.CLIENT_ADMIN, RoleChoices.MANAGER]
        if not client.geofencing_enabled or user.geofencing_exempt or user.role in exempt_roles:
            return response  # Geofencing not applicable

        # ── Geofencing is ACTIVE for this user ──
        lat = request.data.get('latitude')
        lng = request.data.get('longitude')

        logger.info(f"[GEOFENCE] User={email}, Role={user.role}, lat={lat}, lng={lng}")

        if lat is None or lng is None or lat == '' or lng == '':
            return Response(
                {"detail": "Location coordinates are required for login. Please enable GPS/location services in your browser."},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            lat, lng = float(lat), float(lng)
        except (ValueError, TypeError):
            return Response(
                {"detail": "Invalid GPS coordinates format."},
                status=status.HTTP_403_FORBIDDEN
            )

        locations = client.geofence_locations.all()
        if not locations.exists():
            return Response(
                {"detail": "Geofencing is enabled but no authorized locations have been configured. Please contact your administrator."},
                status=status.HTTP_403_FORBIDDEN
            )

        # Check if user is within any authorized zone
        def haversine(lat1, lon1, lat2, lon2):
            R = 6371000  # Earth radius in meters
            phi1, phi2 = math.radians(lat1), math.radians(lat2)
            dphi = math.radians(lat2 - lat1)
            dlam = math.radians(lon2 - lon1)
            a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2)**2
            return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        def point_in_polygon(pt_lat, pt_lng, polygon_coords):
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

        authorized = False
        for loc in locations:
            if loc.geofence_type == 'POLYGON' and loc.polygon_coords:
                if point_in_polygon(lat, lng, loc.polygon_coords):
                    authorized = True
                    break
            else:
                # Circle-based check
                if loc.latitude and loc.longitude:
                    distance = haversine(lat, lng, float(loc.latitude), float(loc.longitude))
                    logger.info(f"[GEOFENCE] Checking {loc.name}: distance={distance:.0f}m, radius={loc.radius_meters}m")
                    if distance <= loc.radius_meters:
                        authorized = True
                        break

        if not authorized:
            logger.warning(f"[GEOFENCE] BLOCKED {email} — outside all authorized zones")
            return Response(
                {"detail": "Login Blocked: You are outside your organization's authorized geofenced working area."},
                status=status.HTTP_403_FORBIDDEN
            )

        logger.info(f"[GEOFENCE] ALLOWED {email}")
        return response


class UserMeView(APIView):
    """
    Returns the profile information of the currently authenticated user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserMeSerializer(request.user)
        data = serializer.data
        data['must_change_password'] = request.user.must_change_password
        return Response(data)


class ChangePasswordView(APIView):
    """
    Allows an authenticated user to change their password.
    Also clears the must_change_password flag.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')

        if not old_password or not new_password:
            return Response(
                {"detail": "Both old_password and new_password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user

        if not user.check_password(old_password):
            return Response(
                {"detail": "Old password is incorrect."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(new_password) < 8:
            return Response(
                {"detail": "New password must be at least 8 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.must_change_password = False
        user.save()

        return Response({"detail": "Password changed successfully."})
