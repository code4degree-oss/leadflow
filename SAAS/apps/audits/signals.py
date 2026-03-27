from django.contrib.auth.signals import user_logged_in
from django.dispatch import receiver
from ipware import get_client_ip
from apps.audits.models import LoginHistory
from apps.audits.services import GeoLocationService

@receiver(user_logged_in)
def track_login_geo(sender, request, user, **kwargs):
    """
    Signal receiver to capture Geo location on every login.
    """
    ip, is_routable = get_client_ip(request)
    if not ip:
        return

    # Get Geo data (with cost-saving cache check)
    geo_data = GeoLocationService.get_geo_data(ip, user)
    
    # Check for suspicious "impossible travel"
    is_suspicious, reason = GeoLocationService.check_suspicious(
        user, geo_data['latitude'], geo_data['longitude']
    )
    
    # Record Login History
    LoginHistory.objects.create(
        user=user,
        client=user.client if hasattr(user, 'client') else None,
        ip_address=ip,
        city=geo_data['city'],
        country=geo_data['country'],
        latitude=geo_data['latitude'],
        longitude=geo_data['longitude'],
        is_suspicious=is_suspicious,
        suspicious_reason=reason
    )
