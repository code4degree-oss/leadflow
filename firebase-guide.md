# Firebase Push Notifications Setup Guide

This guide details the steps required to integrate Firebase Cloud Messaging (FCM) into your Leadflow CRM to send real-time push notifications to users.

## Phase 1: Firebase Project Setup

1. **Create a Firebase Project:**
   - Go to the [Firebase Console](https://console.firebase.google.com/).
   - Click **Add Project** and give it a name like `Leadflow-CRM`.

2. **Register Your Web App:**
   - On the project overview page, click the **Web icon (`</>`)**.
   - Register your app (e.g., `Leadflow Frontend`).
   - Copy the `firebaseConfig` block provided (you will need this for Next.js).

3. **Get Your VAPID Key (Web Push Certificate):**
   - Go to **Project Settings** (gear icon top left) -> **Cloud Messaging** tab.
   - Scroll down to the **Web configuration** section.
   - Click **Generate key pair**. Save this string; it is your VAPID key.

4. **Get Backend Service Account Credentials:**
   - Go to **Project Settings** -> **Service Accounts** tab.
   - Click **Generate new private key**.
   - This downloads a `.json` file containing admin credentials. **Keep this secret!** You will deploy this to your Django server.

---

## Phase 2: Next.js Frontend Configuration

Your Next.js frontend needs to request permission from the user, generate a unique "Device Token", and listen for incoming messages.

### 1. Install Firebase SDK
```bash
npm install firebase
```

### 2. Initialize Firebase
Create `lib/firebase.js` in your Next.js project:
```javascript
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
let messaging;

// Prevent SSR issues by only initializing in the browser
if (typeof window !== "undefined") {
  messaging = getMessaging(app);
}

export { messaging, getToken, onMessage };
```

### 3. Setup the Service Worker
Create a file named `firebase-messaging-sw.js` in your Next.js `public/` folder to handle messages when the app is in the background:
```javascript
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

// Use the exact same config object
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  projectId: "YOUR_PROJECT",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: "/favicon.ico"
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
```

### 4. Implement Permission and Token Retrieval
Add this logic in your dashboard layout or home page (e.g., `pages/_app.js` or a `DashboardLayout` component):
```javascript
import { useEffect } from 'react';
import { messaging, getToken } from "../lib/firebase";

export default function App({ Component, pageProps }) {
  useEffect(() => {
    async function setupNotifications() {
      try {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          const token = await getToken(messaging, { 
            vapidKey: "YOUR_VAPID_KEY_FROM_PHASE_1_STEP_3" 
          });
          
          console.log("Device Token:", token);
          
          // TODO: POST this `token` to your Django backend via an API endpoint
          // so Django knows which device belongs to the logged-in user.
        }
      } catch (error) {
        console.error("Error setting up notifications:", error);
      }
    }

    setupNotifications();
  }, []);

  return <Component {...pageProps} />;
}
```

---

## Phase 3: Django Backend Configuration

The backend stores the frontend device tokens and uses the Firebase Admin SDK to push messages to them.

### 1. Install Firebase Admin SDK
```bash
pip install firebase-admin
```

### 2. Initialize Firebase Admin
Place your downloaded `service-account.json` securely on your backend (add it to `.gitignore`!).
Add the following to your `settings.py` or `apps.py`:
```python
import firebase_admin
from firebase_admin import credentials
import os
from django.conf import settings

cred_path = os.path.join(settings.BASE_DIR, 'firebase-service-account.json')

if not firebase_admin._apps:
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)
```

### 3. Create a Database Model for Tokens
You need a model to store the tokens for each user. In one of your apps (e.g., `accounts/models.py`):
```python
from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class FCMDevice(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="fcm_devices")
    token = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.email} - {self.token[:8]}..."
```
*(Run `python manage.py makemigrations` and `python manage.py migrate` after creating this.)*

> [!NOTE]
> You must also create an API View/Endpoint to receive the token from the Next.js frontend (Phase 2, Step 4) and save it to this model.

### 4. Sending a Notification
Whenever a significant event occurs (e.g., a lead is assigned), use this helper function to push the notification:
```python
from firebase_admin import messaging
from .models import FCMDevice

def send_push_notification(user, title, body):
    """
    Sends a push notification to all active devices of a specific user.
    """
    devices = FCMDevice.objects.filter(user=user)
    
    if not devices.exists():
        return
        
    tokens = [device.token for device in devices]
    
    message = messaging.MulticastMessage(
        notification=messaging.Notification(
            title=title,
            body=body,
        ),
        tokens=tokens,
    )
    
    response = messaging.send_each_for_multicast(message)
    print(f'Successfully sent {response.success_count} messages')
```

---

## Summary Workflow
1. User logs into your Next.js application.
2. The browser asks the user for Notification Permissions.
3. If allowed, Next.js gets an FCM token from Firebase and safely sends it to the Django Backend.
4. Django saves the user and token mapping in the `FCMDevice` table.
5. When an event happens (e.g. Lead assigned), Django fetches the user's tokens and calls `send_push_notification()`.
6. Firebase immediately pushes the alert securely to the user's browser!
