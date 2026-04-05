import firebase_admin
from firebase_admin import credentials, messaging
from django.conf import settings
import os

_firebase_initialized = False

def init_firebase():
    global _firebase_initialized
    if _firebase_initialized:
        return
    
    # Check if we have a service account JSON file
    cred_path = getattr(settings, 'FIREBASE_SERVICE_ACCOUNT_PATH', None)
    
    if cred_path and os.path.exists(cred_path):
        try:
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
            _firebase_initialized = True
            print(f"[FIREBASE] Initialized securely with Admin SDK")
        except Exception as e:
            print(f"[FIREBASE] Failed to initialize: {e}")
    else:
        print(f"[FIREBASE] Warning: FIREBASE_SERVICE_ACCOUNT_PATH not found or invalid. Push Notifications will not be sent.")


def send_push_notification(user, title, body, data=None):
    """
    Sends an FCM push notification to all devices registered by the user.
    """
    init_firebase()
    if not _firebase_initialized:
        return False

    if data is None:
        data = {}

    from apps.accounts.models import FCMDevice
    devices = FCMDevice.objects.filter(user=user, is_active=True)
    
    tokens = list(devices.values_list('registration_id', flat=True))
    if not tokens:
        return False

    message = messaging.MulticastMessage(
        notification=messaging.Notification(
            title=title,
            body=body,
        ),
        android=messaging.AndroidConfig(
            notification=messaging.AndroidNotification(
                sound='default',
                channel_id='leadflow_notifications'
            )
        ),
        apns=messaging.APNSConfig(
            payload=messaging.APNSPayload(
                aps=messaging.Aps(sound='default')
            )
        ),
        data=data,
        tokens=tokens,
    )

    try:
        response = messaging.send_each_for_multicast(message)
        # Handle failures (e.g. invalid tokens to deactivate)
        if response.failure_count > 0:
            for idx, resp in enumerate(response.responses):
                if not resp.success:
                    # Token invalid, delete or deactivate
                    err = resp.exception
                    if err:
                        devices.filter(registration_id=tokens[idx]).update(is_active=False)
        return True
    except Exception as e:
        print(f"[FIREBASE] Send Error: {e}")
        return False


def send_broadcast_notification(title, body, data=None):
    """
    Sends an FCM push notification to ALL active device tokens in the system.
    Used by Super Admin for platform-wide announcements (e.g. Happy New Year).
    FCM multicast limit is 500 tokens per call, so we batch them.
    Returns (success_count, failure_count).
    """
    init_firebase()
    if not _firebase_initialized:
        return 0, 0

    if data is None:
        data = {}

    from apps.accounts.models import FCMDevice
    all_devices = FCMDevice.objects.filter(is_active=True)
    all_tokens = list(all_devices.values_list('registration_id', flat=True))

    if not all_tokens:
        return 0, 0

    total_success = 0
    total_failure = 0

    # Process in batches of 500 (FCM multicast limit)
    for i in range(0, len(all_tokens), 500):
        batch_tokens = all_tokens[i:i + 500]

        message = messaging.MulticastMessage(
            notification=messaging.Notification(
                title=title,
                body=body,
            ),
            android=messaging.AndroidConfig(
                notification=messaging.AndroidNotification(
                    sound='default',
                    channel_id='leadflow_notifications'
                )
            ),
            apns=messaging.APNSConfig(
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(sound='default')
                )
            ),
            data=data,
            tokens=batch_tokens,
        )

        try:
            response = messaging.send_each_for_multicast(message)
            total_success += response.success_count
            total_failure += response.failure_count

            # Deactivate invalid tokens
            if response.failure_count > 0:
                for idx, resp in enumerate(response.responses):
                    if not resp.success and resp.exception:
                        all_devices.filter(registration_id=batch_tokens[idx]).update(is_active=False)
        except Exception as e:
            print(f"[FIREBASE] Broadcast batch error: {e}")
            total_failure += len(batch_tokens)

    print(f"[FIREBASE] Broadcast complete: {total_success} sent, {total_failure} failed out of {len(all_tokens)} total")
    return total_success, total_failure
