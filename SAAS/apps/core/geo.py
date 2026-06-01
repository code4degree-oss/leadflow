import math
import logging
from typing import Tuple

logger = logging.getLogger(__name__)

class GeoService:
    @staticmethod
    def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        Calculate the great circle distance between two points 
        on the earth (specified in decimal degrees)
        """
        R = 6371000  # Earth radius in meters
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlam = math.radians(lon2 - lon1)
        a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2)**2
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    @staticmethod
    def point_in_polygon(pt_lat: float, pt_lng: float, polygon_coords: list) -> bool:
        """
        Check if a point is inside a polygon using ray casting.
        """
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

    @classmethod
    def check_geofence(cls, user, lat: float, lng: float) -> Tuple[bool, str]:
        """
        Check if the user is within their authorized geofence.
        Returns a tuple of (authorized: bool, reason: str).
        """
        from apps.accounts.models import RoleChoices
        
        client = getattr(user, 'client', None)
        if not client or not client.geofencing_enabled:
            return True, "Geofencing disabled"
            
        exempt_roles = [RoleChoices.SUPER_ADMIN, RoleChoices.CLIENT_ADMIN, RoleChoices.MANAGER]
        if user.role in exempt_roles or user.geofencing_exempt:
            return True, "User is exempt from geofencing"

        if lat is None or lng is None:
            return False, "Location verification required"

        try:
            lat = float(lat)
            lng = float(lng)
        except (ValueError, TypeError):
            return False, "Invalid location data"

        locations = client.geofence_locations.all()
        if not locations.exists():
            # If no locations are defined, but geofencing is "enabled", what's the expected behavior?
            # Typically it defaults to allowing access if no zones are configured.
            return True, "No geofence zones configured"

        for loc in locations:
            if loc.geofence_type == 'POLYGON' and loc.polygon_coords:
                if cls.point_in_polygon(lat, lng, loc.polygon_coords):
                    return True, "Inside polygon zone"
            else:
                if loc.latitude and loc.longitude:
                    distance = cls.haversine(lat, lng, float(loc.latitude), float(loc.longitude))
                    if distance <= loc.radius_meters:
                        return True, f"Inside circle zone ({distance:.1f}m away)"

        return False, "Outside authorized zone"
