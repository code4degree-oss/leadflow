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
