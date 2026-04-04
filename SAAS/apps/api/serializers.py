from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from apps.accounts.models import User, RoleChoices
import math
import logging

logger = logging.getLogger(__name__)

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Custom JWT Serializer that adds `role` and `client_id` directly 
    into the access and refresh tokens.
    Also enforces geofencing at the serializer level to prevent token
    generation for unauthorized locations.
    """
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        # Add custom claims
        token['role'] = user.role
        token['client_id'] = str(user.client_id) if user.client_id else None
        token['email'] = user.email
        token['must_change_password'] = user.must_change_password

        return token

    def _check_geofence(self, user):
        """
        Enforce geofencing. Raises serializers.ValidationError if the user
        is outside all authorized zones.
        """
        client = getattr(user, 'client', None)
        if not client:
            return  # Super admin, no client

        exempt_roles = [RoleChoices.SUPER_ADMIN, RoleChoices.CLIENT_ADMIN, RoleChoices.MANAGER]
        if not client.geofencing_enabled or user.geofencing_exempt or user.role in exempt_roles:
            return  # Geofencing not applicable

        # Get coordinates from the original request
        request = self.context.get('request')
        if not request:
            return

        lat = request.data.get('latitude')
        lng = request.data.get('longitude')

        logger.info(f"[GEOFENCE-SERIALIZER] User={user.email}, Role={user.role}, lat={lat}, lng={lng}")

        if lat is None or lng is None or lat == '' or lng == '':
            raise serializers.ValidationError(
                "Location coordinates are required for login. Please enable GPS/location services in your browser."
            )

        try:
            lat, lng = float(lat), float(lng)
        except (ValueError, TypeError):
            raise serializers.ValidationError("Invalid GPS coordinates format.")

        locations = client.geofence_locations.all()
        if not locations.exists():
            raise serializers.ValidationError(
                "Geofencing is enabled but no authorized locations have been configured. Please contact your administrator."
            )

        def haversine(lat1, lon1, lat2, lon2):
            R = 6371000
            phi1, phi2 = math.radians(lat1), math.radians(lat2)
            dphi = math.radians(lat2 - lat1)
            dlam = math.radians(lon2 - lon1)
            a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
            return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        def point_in_polygon(pt_lat, pt_lng, polygon_coords):
            n = len(polygon_coords)
            if n < 3:
                return False
            inside = False
            j = n - 1
            for i in range(n):
                yi, xi = float(polygon_coords[i]['lat']), float(polygon_coords[i]['lng'])
                yj, xj = float(polygon_coords[j]['lat']), float(polygon_coords[j]['lng'])
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
                if loc.latitude and loc.longitude:
                    distance = haversine(lat, lng, float(loc.latitude), float(loc.longitude))
                    logger.info(f"[GEOFENCE-SERIALIZER] Checking {loc.name}: distance={distance:.0f}m, radius={loc.radius_meters}m")
                    if distance <= loc.radius_meters:
                        authorized = True
                        break

        if not authorized:
            logger.warning(f"[GEOFENCE-SERIALIZER] BLOCKED {user.email} — outside all authorized zones")
            raise serializers.ValidationError(
                "Login Blocked: You are outside your organization's authorized geofenced working area."
            )

        logger.info(f"[GEOFENCE-SERIALIZER] ALLOWED {user.email}")

    def validate(self, attrs):
        data = super().validate(attrs)
        
        # Enforce geofencing BEFORE returning tokens
        self._check_geofence(self.user)

        # Add extra responses to the payload
        data['role'] = self.user.role
        data['email'] = self.user.email
        data['first_name'] = self.user.first_name
        data['last_name'] = self.user.last_name
        data['must_change_password'] = self.user.must_change_password
        if self.user.client_id:
            data['client_id'] = str(self.user.client_id)

        # Add subscription info
        client = getattr(self.user, 'client', None)
        if client:
            data['subscription_active'] = client.is_active
            data['valid_until'] = str(client.valid_until) if client.valid_until else None
            data['subscription_status'] = client.subscription_status
            data['days_remaining'] = client.days_remaining
            
        return data


class UserMeSerializer(serializers.ModelSerializer):
    """
    Serializer for the /auth/me/ endpoint to return logged-in user details.
    """
    client_name = serializers.CharField(source='client.name', read_only=True)
    
    class Meta:
        model = User
        fields = [
            'id', 
            'email', 
            'first_name', 
            'last_name', 
            'role', 
            'client_id',
            'client_name',
            'is_active'
        ]
