"""
Celery tasks for subscription lifecycle management.

- check_subscription_expiry: Runs daily to auto-suspend expired clients
  and create in-app notifications for expiring subscriptions.
"""
from datetime import timedelta

from celery import shared_task
from django.utils import timezone


@shared_task
def check_subscription_expiry():
    """
    Daily task that:
    1. Auto-suspends clients whose valid_until has passed.
    2. Creates in-app notifications for clients expiring in 7 days.
    """
    from apps.clients.models import ClientAccount
    from apps.accounts.models import Notification

    today = timezone.now().date()

    # ── 1. Auto-suspend expired clients ──────────────────────────────────
    expired = ClientAccount.objects.filter(
        valid_until__lt=today,
        is_active=True
    )
    suspended_count = 0
    for client in expired:
        client.is_active = False
        client.save(update_fields=['is_active', 'updated_at'])
        suspended_count += 1

        # Notify the Client Admin about auto-suspension
        admin_user = client.users.filter(role='CLIENT_ADMIN').first()
        if admin_user:
            Notification.objects.create(
                user=admin_user,
                type='subscription_expired',
                title='Subscription Expired',
                message=(
                    f'Your subscription expired on {client.valid_until}. '
                    f'Your account has been suspended. '
                    f'Please contact support to renew and regain access. '
                    f'Your data is safe and will be available once renewed.'
                )
            )

    # ── 2. Notify clients expiring in exactly 7 days ─────────────────────
    warning_date = today + timedelta(days=7)
    expiring_soon = ClientAccount.objects.filter(
        valid_until=warning_date,
        is_active=True
    )
    notified_count = 0
    for client in expiring_soon:
        admin_user = client.users.filter(role='CLIENT_ADMIN').first()
        if admin_user:
            # Avoid duplicate notifications for the same expiry
            already_notified = Notification.objects.filter(
                user=admin_user,
                type='subscription_warning',
                created_at__date=today
            ).exists()
            if not already_notified:
                Notification.objects.create(
                    user=admin_user,
                    type='subscription_warning',
                    title='Subscription Expiring Soon',
                    message=(
                        f'Your plan expires in 7 days on {client.valid_until}. '
                        f'Please contact your administrator to renew your subscription '
                        f'to avoid service interruption.'
                    )
                )
                notified_count += 1

    return f"Suspended: {suspended_count}, Warned: {notified_count}"
