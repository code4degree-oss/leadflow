# 🔔 Firebase Push Notifications — Complete Integration Guide

> Step-by-step guide to integrate Firebase Cloud Messaging (FCM) into the DY LeadFlow CRM for real-time push notifications.

---

## Prerequisites

- Node.js 18+ installed
- A Google account
- Access to the Django backend (`SAAS/`) and Next.js frontend (`leadflow-crm-frontend/leadflow/`)
- Your production domain (e.g., `app.dyleadflow.in`)

---

## Phase 1: Firebase Console Setup

### Step 1.1 — Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **Add Project**
3. Name it: `DY LeadFlow-CRM-Production`
4. Disable Google Analytics (optional for notifications)
5. Click **Create Project**

### Step 1.2 — Register Your Web App

1. On the project overview, click the **Web icon** (`</>`)
2. App nickname: `DY LeadFlow Frontend`
3. Check **"Also set up Firebase Hosting"** → Skip for now
4. Click **Register app**
5. **Copy the `firebaseConfig` object** — you'll need it in Step 2.2

```javascript
// Example — replace with YOUR actual values:
const firebaseConfig = {
  apiKey: "AIzaSyD...",
  authDomain: "dyleadflow-crm.firebaseapp.com",
  projectId: "dyleadflow-crm",
  storageBucket: "dyleadflow-crm.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### Step 1.3 — Get Your VAPID Key (Web Push Certificate)

1. Go to ⚙️ **Project Settings** → **Cloud Messaging** tab
2. Scroll to **Web configuration** section
3. Click **Generate key pair**
4. **Save this VAPID key** — you'll need it in Step 2.4

### Step 1.4 — Download Backend Service Account Key

1. Go to ⚙️ **Project Settings** → **Service Accounts** tab
2. Click **Generate new private key**
3. Download the `.json` file
4. **Rename it** to: `firebase-service-account.json`
5. **Add to `.gitignore`** — NEVER commit this file!

---

## Phase 2: Next.js Frontend Setup

### Step 2.1 — Install Firebase SDK

```bash
cd leadflow-crm-frontend/leadflow
npm install firebase
```

### Step 2.2 — Create Firebase Configuration

Create file: `leadflow-crm-frontend/leadflow/lib/firebase.js`

```javascript
import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  // ⚠️ PASTE YOUR CONFIG FROM STEP 1.2 HERE
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase (prevent duplicate initialization)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

let messaging = null;

// Only initialize messaging in the browser (not during SSR)
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  try {
    messaging = getMessaging(app);
  } catch (err) {
    console.warn("Firebase Messaging not supported in this browser:", err);
  }
}

export { app, messaging, getToken, onMessage };
```

### Step 2.3 — Create Service Worker for Background Notifications

Create file: `leadflow-crm-frontend/leadflow/public/firebase-messaging-sw.js`

```javascript
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// ⚠️ PASTE THE SAME CONFIG FROM STEP 1.2 HERE
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Handle background notifications (when tab is not in focus)
messaging.onBackgroundMessage((payload) => {
  console.log("[SW] Background message:", payload);

  const title = payload.notification?.title || "DY LeadFlow Notification";
  const options = {
    body: payload.notification?.body || "You have a new update.",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: payload.data || {},
    // Open app when notification is clicked
    actions: [
      { action: "open", title: "Open App" }
    ]
  };

  self.registration.showNotification(title, options);
});

// Handle notification click → open the app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      // If the app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      return clients.openWindow("/");
    })
  );
});
```

### Step 2.4 — Create Notification Hook

Create file: `leadflow-crm-frontend/leadflow/hooks/useFirebaseMessaging.js`

```javascript
import { useEffect, useState } from "react";
import { messaging, getToken, onMessage } from "../lib/firebase";
import { fetchWithAuth } from "../utils/api";

const VAPID_KEY = "YOUR_VAPID_KEY_FROM_STEP_1_3"; // ⚠️ Replace this!

export function useFirebaseMessaging() {
  const [fcmToken, setFcmToken] = useState(null);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    async function setupFCM() {
      // Only run in browser and when user is logged in
      if (!messaging || typeof window === "undefined") return;
      
      const accessToken = localStorage.getItem("access_token");
      if (!accessToken) return;

      try {
        // 1. Request notification permission
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          console.warn("Notification permission denied");
          return;
        }

        // 2. Register service worker
        const registration = await navigator.serviceWorker.register(
          "/firebase-messaging-sw.js"
        );

        // 3. Get FCM device token
        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: registration,
        });

        if (token) {
          console.log("FCM Token:", token);
          setFcmToken(token);

          // 4. Send token to Django backend
          try {
            await fetchWithAuth("/accounts/devices/register/", {
              method: "POST",
              body: JSON.stringify({ token }),
            });
            console.log("FCM token registered with backend");
          } catch (err) {
            console.warn("Failed to register FCM token:", err);
          }
        }

        // 5. Listen for foreground messages
        onMessage(messaging, (payload) => {
          console.log("Foreground message:", payload);
          setNotification({
            title: payload.notification?.title || "New Notification",
            body: payload.notification?.body || "",
            data: payload.data || {},
          });

          // Auto-clear after 10 seconds
          setTimeout(() => setNotification(null), 10000);
        });
      } catch (err) {
        console.error("FCM setup error:", err);
      }
    }

    setupFCM();
  }, []);

  const clearNotification = () => setNotification(null);

  return { fcmToken, notification, clearNotification };
}
```

### Step 2.5 — Integrate into Your App

Update `leadflow-crm-frontend/leadflow/pages/_app.js`:

```javascript
import '../styles/globals.css'
import { ThemeProvider } from 'next-themes'
import RouteGuard from '../components/RouteGuard'
import ReminderPopup from '../components/ReminderPopup'
import { useFirebaseMessaging } from '../hooks/useFirebaseMessaging'

function FirebaseNotificationBanner() {
  const { notification, clearNotification } = useFirebaseMessaging()
  
  if (!notification) return null
  
  return (
    <div className="fixed top-4 right-4 z-[200] max-w-sm w-full animate-in slide-in-from-top-4 fade-in">
      <div className="bg-card border border-accent/30 shadow-2xl shadow-accent/10 rounded-2xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-txt">{notification.title}</div>
            <div className="text-xs text-txt2 mt-0.5">{notification.body}</div>
          </div>
          <button onClick={clearNotification} className="text-txt3 hover:text-txt p-1">✕</button>
        </div>
      </div>
    </div>
  )
}

export default function App({ Component, pageProps }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark">
      <RouteGuard>
        <Component {...pageProps} />
        <ReminderPopup />
        <FirebaseNotificationBanner />
      </RouteGuard>
    </ThemeProvider>
  )
}
```

---

## Phase 3: Django Backend Setup

### Step 3.1 — Install Firebase Admin SDK

```bash
cd SAAS
source venv/bin/activate   # or venv\Scripts\activate on Windows
pip install firebase-admin
pip freeze > requirements/base.txt
```

### Step 3.2 — Place Service Account Key

1. Copy `firebase-service-account.json` (from Step 1.4) into:
   ```
   SAAS/firebase-service-account.json
   ```

2. **Add to `.gitignore`:**
   ```
   firebase-service-account.json
   ```

### Step 3.3 — Initialize Firebase in Django

Add to `SAAS/config/settings.py` (at the bottom):

```python
# ──────────────────────────────────────
# Firebase Cloud Messaging Configuration
# ──────────────────────────────────────
import firebase_admin
from firebase_admin import credentials
import os

FIREBASE_CREDENTIALS_PATH = os.path.join(BASE_DIR, 'firebase-service-account.json')

if os.path.exists(FIREBASE_CREDENTIALS_PATH) and not firebase_admin._apps:
    cred = credentials.Certificate(FIREBASE_CREDENTIALS_PATH)
    firebase_admin.initialize_app(cred)
```

### Step 3.4 — Create FCM Device Model

Add to `SAAS/apps/accounts/models.py`:

```python
class FCMDevice(models.Model):
    """
    Stores Firebase Cloud Messaging device tokens per user.
    A user can have multiple devices (phone + browser + tablet).
    """
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='fcm_devices')
    token = models.CharField(max_length=500, unique=True, help_text="FCM device token")
    device_type = models.CharField(
        max_length=20, 
        choices=[('web', 'Web Browser'), ('android', 'Android'), ('ios', 'iOS')],
        default='web'
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "FCM Device"
        verbose_name_plural = "FCM Devices"

    def __str__(self):
        return f"{self.user.email} - {self.device_type} - {self.token[:12]}..."
```

Run migrations:
```bash
cd SAAS
python manage.py makemigrations accounts
python manage.py migrate
```

### Step 3.5 — Create Device Registration API

Add to `SAAS/apps/accounts/api/views.py`:

```python
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status as http_status

class FCMDeviceRegisterView(APIView):
    """
    Register or update an FCM device token for the logged-in user.
    Called by the frontend when the user grants notification permission.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        token = request.data.get('token')
        device_type = request.data.get('device_type', 'web')

        if not token:
            return Response(
                {"detail": "FCM token is required."},
                status=http_status.HTTP_400_BAD_REQUEST
            )

        from apps.accounts.models import FCMDevice

        # Update existing token or create new
        device, created = FCMDevice.objects.update_or_create(
            token=token,
            defaults={
                'user': request.user,
                'device_type': device_type,
                'is_active': True,
            }
        )

        return Response({
            "detail": "Device registered successfully.",
            "device_id": device.id,
            "created": created
        }, status=http_status.HTTP_201_CREATED if created else http_status.HTTP_200_OK)
```

Add URL route in `SAAS/apps/accounts/api/urls.py`:

```python
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserViewSet, ClientLocationViewSet, FCMDeviceRegisterView

router = DefaultRouter()
router.register(r'employees', UserViewSet, basename='employee')
router.register(r'locations', ClientLocationViewSet, basename='location')

urlpatterns = [
    path('', include(router.urls)),
    path('devices/register/', FCMDeviceRegisterView.as_view(), name='fcm-device-register'),
]
```

### Step 3.6 — Create Notification Send Utility

Create file: `SAAS/apps/accounts/notifications.py`

```python
"""
Firebase Cloud Messaging notification utility.
Use this to send push notifications from anywhere in the Django app.
"""
import logging
from firebase_admin import messaging

logger = logging.getLogger(__name__)


def send_push_notification(user, title, body, data=None):
    """
    Send a push notification to ALL active devices of a specific user.
    
    Args:
        user: User model instance
        title: Notification title (shown in system tray)
        body: Notification body text
        data: Optional dict of custom key-value pairs (for frontend routing)
    
    Returns:
        Number of successfully sent messages
    """
    from .models import FCMDevice
    
    devices = FCMDevice.objects.filter(user=user, is_active=True)
    if not devices.exists():
        logger.info(f"No active FCM devices for {user.email}")
        return 0

    tokens = list(devices.values_list('token', flat=True))
    
    message = messaging.MulticastMessage(
        notification=messaging.Notification(
            title=title,
            body=body,
        ),
        data=data or {},
        tokens=tokens,
    )

    try:
        response = messaging.send_each_for_multicast(message)
        
        # Deactivate invalid tokens
        for idx, send_response in enumerate(response.responses):
            if send_response.exception:
                error_code = send_response.exception.code if hasattr(send_response.exception, 'code') else None
                if error_code in ('NOT_FOUND', 'INVALID_ARGUMENT', 'UNREGISTERED'):
                    FCMDevice.objects.filter(token=tokens[idx]).update(is_active=False)
                    logger.warning(f"Deactivated stale FCM token for {user.email}")
        
        logger.info(f"FCM: Sent {response.success_count}/{len(tokens)} to {user.email}")
        return response.success_count
        
    except Exception as e:
        logger.error(f"FCM send error for {user.email}: {e}")
        return 0


def send_bulk_notification(users, title, body, data=None):
    """
    Send the same notification to multiple users.
    """
    total_sent = 0
    for user in users:
        total_sent += send_push_notification(user, title, body, data)
    return total_sent
```

### Step 3.7 — Add Notification Triggers

Add notifications to key events in `SAAS/apps/leads/api/views.py`:

```python
# At the top, add import:
from apps.accounts.notifications import send_push_notification

# ─── In the log_call method, after 'CALLBACK' outcome handling: ───
# After creating the FollowUpReminder, add:
if lead.assigned_to:
    send_push_notification(
        lead.assigned_to,
        "📞 Follow-up Scheduled",
        f"Reminder set for {lead.first_name} {lead.last_name} on {follow_up_at.strftime('%d %b at %I:%M %p')}",
        data={"type": "follow_up", "lead_id": str(lead.id)}
    )

# ─── In manual_assign, after successful assignment: ───
if lead.assigned_to:
    send_push_notification(
        lead.assigned_to,
        "📋 New Lead Assigned",
        f"You've been assigned: {lead.first_name} {lead.last_name} ({lead.phone})",
        data={"type": "lead_assigned", "lead_id": str(lead.id)}
    )

# ─── In _handle_lost, after auto-reassignment: ───
if lead.assigned_to:
    send_push_notification(
        lead.assigned_to,
        "🔄 Lead Reassigned to You",
        f"{lead.first_name} {lead.last_name} has been reassigned. Lost count: {lead.lost_count}/4",
        data={"type": "lead_reassigned", "lead_id": str(lead.id)}
    )
```

---

## Phase 4: Production Deployment

### Step 4.1 — Deploy Service Account Key to Server

```bash
# Copy to your Azure VM
scp firebase-service-account.json azureuser@YOUR_VM_IP:/home/azureuser/Saas-project/SAAS/

# Verify permissions
ssh azureuser@YOUR_VM_IP 'chmod 600 /home/azureuser/Saas-project/SAAS/firebase-service-account.json'
```

### Step 4.2 — Install Backend Dependency

```bash
ssh azureuser@YOUR_VM_IP
cd /home/azureuser/Saas-project/SAAS
source venv/bin/activate
pip install firebase-admin
python manage.py makemigrations accounts
python manage.py migrate
sudo systemctl restart gunicorn  # or your process manager
```

### Step 4.3 — Build and Deploy Frontend

```bash
cd leadflow-crm-frontend/leadflow
npm run build
# Deploy via your CI/CD pipeline or manual copy
```

### Step 4.4 — Verify HTTPS

> ⚠️ **IMPORTANT**: Firebase Cloud Messaging requires HTTPS in production.
> Your app must be served over HTTPS for service workers and push notifications to work.

---

## Phase 5: Testing Checklist

| Step | Test | Expected Result |
|------|------|----------------|
| 1 | Open the app in Chrome | Browser asks for notification permission |
| 2 | Click "Allow" | Console logs the FCM token |
| 3 | Check Django DB | `FCMDevice` table has the token |
| 4 | Assign a lead via admin panel | Telecaller gets a push notification |
| 5 | Set a follow-up callback | Notification sent confirming schedule |
| 6 | Close the browser tab | Background notification appears via service worker |
| 7 | Click the notification | App opens and focuses |

---

## Notification Events to Wire Up

Here are all the events where you should trigger `send_push_notification()`:

| Event | Who Gets Notified | Title |
|-------|------------------|-------|
| Lead assigned (round-robin or manual) | Assigned telecaller | "📋 New Lead Assigned" |
| Lead reassigned (lost escalation) | New telecaller | "🔄 Lead Reassigned" |
| Follow-up scheduled | Telecaller who created it | "📞 Follow-up Scheduled" |
| Reminder 10min before | Telecaller | "⏰ Follow-up in 10 minutes" |
| Lead marked as hot | Assigned telecaller | "🔥 Lead Marked Hot" |
| Site visit scheduled | Field agent | "📍 Site Visit Scheduled" |
| Lead converted (WON) | Admin | "🎉 Lead Converted!" |
| Subscription expiring | Client admin | "⚠️ Subscription Expiring" |

---

## Troubleshooting

### "Notification permission denied"
- User must manually enable notifications in browser settings
- Chrome: `Settings → Privacy → Site Settings → Notifications`

### "Service Worker registration failed"
- Ensure `firebase-messaging-sw.js` is in the `/public/` folder
- Verify it's accessible at `https://yourdomain.com/firebase-messaging-sw.js`
- Must be served over HTTPS

### "FCM token is null"
- Check VAPID key is correct
- Ensure service worker is registered before calling `getToken()`
- Check browser console for errors

### "Notifications work locally but not in production"
- Verify HTTPS is properly configured
- Check that `firebase-service-account.json` is on the server
- Verify Gunicorn/Django can read the file (permissions)

---

## File Summary

```
SAAS/
├── firebase-service-account.json     ← Download from Firebase (Step 1.4)
├── config/settings.py                ← Add Firebase init (Step 3.3)
├── apps/accounts/
│   ├── models.py                     ← Add FCMDevice model (Step 3.4)
│   ├── notifications.py              ← NEW: Send notification helper (Step 3.6)
│   └── api/
│       ├── views.py                  ← Add FCMDeviceRegisterView (Step 3.5)
│       └── urls.py                   ← Add register endpoint (Step 3.5)
└── apps/leads/api/views.py           ← Add send_push_notification calls (Step 3.7)

leadflow-crm-frontend/leadflow/
├── lib/firebase.js                   ← NEW: Firebase config (Step 2.2)
├── hooks/useFirebaseMessaging.js     ← NEW: FCM hook (Step 2.4)
├── public/firebase-messaging-sw.js   ← NEW: Background SW (Step 2.3)
└── pages/_app.js                     ← Add notification banner (Step 2.5)
```
