from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from apps.accounts.models import User, RoleChoices
import math

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Custom JWT Serializer that adds `role` and `client_id` directly 
    into the access and refresh tokens.
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

    def validate(self, attrs):
        data = super().validate(attrs)
        
        # Add extra responses to the payload
        data['role'] = self.user.role
        data['email'] = self.user.email
        data['first_name'] = self.user.first_name
        data['last_name'] = self.user.last_name
        data['must_change_password'] = self.user.must_change_password
        if self.user.client_id:
            data['client_id'] = str(self.user.client_id)

        # Check Geofencing
        client = getattr(self.user, 'client', None)
        if client:
            data['subscription_active'] = client.is_active
            data['valid_until'] = str(client.valid_until) if client.valid_until else None
            data['subscription_status'] = client.subscription_status
            data['days_remaining'] = client.days_remaining

            # Apply Geofence checks purely for standard employees (not Super or Client Admins)
            if client.geofencing_enabled and not self.user.geofencing_exempt and self.user.role not in [RoleChoices.SUPER_ADMIN, RoleChoices.CLIENT_ADMIN, RoleChoices.MANAGER]:
                request = self.context.get('request')
                if not request:
                    raise serializers.ValidationError({"detail": "Context error: unable to process GPS coordinates."})
                
                lat = request.data.get('latitude')
                lng = request.data.get('longitude')
                
                if not lat or not lng:
                    raise serializers.ValidationError({"detail": "Location coordinates are required for login. Please enable GPS sensors."})
                
                try:
                    lat, lng = float(lat), float(lng)
                except ValueError:
                    raise serializers.ValidationError({"detail": "Invalid coordinates format."})
                
                locations = client.geofence_locations.all()
                if not locations.exists():
                    raise serializers.ValidationError({"detail": "Geofencing enabled but no locations are configured. Contact Admin."})
                
                def haversine(lat1, lon1, lat2, lon2):
                    R = 6371000  # Earth radius in meters
                    phi1, phi2 = math.radians(lat1), math.radians(lat2)
                    dphi, dlam = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
                    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2)**2
                    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
                
                def point_in_polygon(lat, lng, polygon_coords):
                    """Ray-casting algorithm to check if a point is inside a polygon."""
                    n = len(polygon_coords)
                    if n < 3:
                        return False
                    inside = False
                    j = n - 1
                    for i in range(n):
                        yi, xi = polygon_coords[i]['lat'], polygon_coords[i]['lng']
                        yj, xj = polygon_coords[j]['lat'], polygon_coords[j]['lng']
                        if ((yi > lat) != (yj > lat)) and (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi):
                            inside = not inside
                        j = i
                    return inside

                authorized = False
                for loc in locations:
                    if loc.geofence_type == 'POLYGON' and loc.polygon_coords:
                        # Polygon-based check
                        if point_in_polygon(lat, lng, loc.polygon_coords):
                            authorized = True
                            break
                    else:
                        # Circle-based check (default)
                        if loc.latitude and loc.longitude:
                            distance = haversine(lat, lng, float(loc.latitude), float(loc.longitude))
                            if distance <= loc.radius_meters:
                                authorized = True
                                break
                        
                if not authorized:
                    raise serializers.ValidationError({"detail": "Login Blocked: You are outside your organization's authorized geofenced working area."})
            
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
