import math
import uuid
import requests
import logging
from datetime import timedelta
from django.utils import timezone
from django.conf import settings
from apps.audits.models import LoginHistory

class GeoLocationService:
    """
    Service for Geo-IP lookups with cost-savings and security checks.
    """

    @staticmethod
    def haversine(lat1, lon1, lat2, lon2):
        """
        Calculate the great circle distance in kilometers between two points 
        on the earth (specified in decimal degrees)
        """
        # Convert decimal degrees to radians 
        lat1, lon1, lat2, lon2 = map(math.radians, [float(lat1), float(lon1), float(lat2), float(lon2)])

        # Haversine formula 
        dlon = lon2 - lon1 
        dlat = lat2 - lat1 
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a)) 
        r = 6371 # Radius of earth in kilometers. Use 3956 for miles
        return c * r

    @classmethod
    def get_geo_data(cls, ip_address, user):
        """
        Fetches Geo data for an IP. 
        Implements cost-savings: Reuse data if same IP logged in within 5 minutes.
        """
        # 1. Cost Savings: Check cache (database)
        recent_login = LoginHistory.objects.filter(
            ip_address=ip_address,
            created_at__gte=timezone.now() - timedelta(minutes=5)
        ).first()

        if recent_login:
            return {
                "city": recent_login.city,
                "country": recent_login.country,
                "latitude": recent_login.latitude,
                "longitude": recent_login.longitude,
                "cached": True
            }

        # 2. External API Call
        # If running on localhost, use a fallback IP for testing
        lookup_ip = ip_address
        if ip_address in ['127.0.0.1', '::1', 'localhost']:
            # Use Google Public DNS IP for a consistent "real" lookup during dev
            lookup_ip = '8.8.8.8' 

        try:
            # Using ip-api.com (free for non-commercial use)
            response = requests.get(f"http://ip-api.com/json/{lookup_ip}?fields=status,message,country,city,lat,lon", timeout=3)
            data = response.json()
            
            if data.get('status') == 'success':
                return {
                    "city": data.get('city', 'Unknown'),
                    "country": data.get('country', 'Unknown'),
                    "latitude": data.get('lat'),
                    "longitude": data.get('lon'),
                    "cached": False
                }
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error(f"GeoIP API failed: {str(e)}")

        # 3. Fallback to Safe Default (Mumbai) if API fails
        return {
            "city": "Mumbai",
            "country": "India",
            "latitude": 19.0760,
            "longitude": 72.8777,
            "cached": False,
            "fallback": True
        }

    @classmethod
    def check_suspicious(cls, user, current_lat, current_lon):
        """
        Detects impossible travel using Haversine formula.
        """
        last_login = LoginHistory.objects.filter(user=user).first()
        if not last_login or not last_login.latitude:
            return False, ""

        distance = cls.haversine(
            last_login.latitude, last_login.longitude,
            current_lat, current_lon
        )
        
        time_diff = (timezone.now() - last_login.created_at).total_seconds() / 3600 # hours
        
        if time_diff < 0.01: # Too close in time
            return False, ""

        speed = distance / time_diff # km/h
        
        if speed > 800: # Impossible speed (roughly speed of a commercial jet)
            return True, f"Impossible travel detected: {int(speed)} km/h. Last login from {last_login.city}."
            
        return False, ""


class AuditService:
    """
    Utility to record changes and actions in the AuditLog.
    """

    @staticmethod
    def record_action(user, action, resource_type, resource_id=None, changes=None, ip=None):
        """
        Creates an audit log entry.
        """
        from apps.audits.models import AuditLog
        
        # Ensure changes are JSON serializable (convert UUIDs to strings)
        if isinstance(changes, dict):
            changes = {k: (str(v) if isinstance(v, uuid.UUID) else v) for k, v in changes.items()}
        
        AuditLog.objects.create(
            user=user,
            client=user.client if user and hasattr(user, 'client') else None,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id else None,
            changes=changes or {},
            ip_address=ip
        )
