import logging
from celery import shared_task

logger = logging.getLogger(__name__)

@shared_task(name="apps.audits.tasks.record_login_history_task")
def record_login_history_task(user_id, client_id, ip, req_lat, req_lng):
    try:
        from apps.accounts.models import User
        from apps.audits.models import LoginHistory
        from apps.audits.services import GeoLocationService
        
        user = User.objects.select_related('client').get(id=user_id)
        client = user.client

        # Get approximate geo data (mostly for city/country text layout)
        geo_data = GeoLocationService.get_geo_data(ip, user)
        
        # Use precise GPS coordinates if frontend provided them,
        # otherwise fallback to the IP-based approximate coordinates
        final_lat = geo_data['latitude']
        final_lng = geo_data['longitude']
        
        if req_lat and req_lng:
            try:
                final_lat = float(req_lat)
                final_lng = float(req_lng)
            except (ValueError, TypeError):
                pass
        
        is_suspicious, reason = GeoLocationService.check_suspicious(
            user, final_lat, final_lng
        )
        LoginHistory.objects.create(
            user=user,
            client=client,
            ip_address=ip,
            city=geo_data['city'],
            country=geo_data['country'],
            latitude=final_lat,
            longitude=final_lng,
            is_suspicious=is_suspicious,
            suspicious_reason=reason
        )
    except Exception as e:
        logger.error(f"[LOGIN_HISTORY] Failed to record: {e}")

@shared_task(name="apps.audits.tasks.notify_admin_login_task")
def notify_admin_login_task(user_id, client_id):
    try:
        from apps.accounts.models import User, RoleChoices
        from apps.core.firebase import send_push_notification
        
        user = User.objects.get(id=user_id)
        client_id = user.client_id
        if not client_id:
            return
            
        admins = User.objects.filter(client_id=client_id, role=RoleChoices.CLIENT_ADMIN, is_active=True)
        for admin in admins:
            send_push_notification(
                user=admin,
                title="Employee Login Alert",
                body=f"{user.first_name} {user.last_name}".strip() or f"{user.email}",
                data={"type": "login_alert", "employee_id": str(user.id)}
            )
    except Exception as e:
        logger.error(f"[NOTIFY_LOGIN] Failed to notify: {e}")
