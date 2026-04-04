import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyDY7ZM-tGsB6yU40HYDejGKbsu75cNdz1E",
  authDomain: "dyleadflow.firebaseapp.com",
  projectId: "dyleadflow",
  storageBucket: "dyleadflow.firebasestorage.app",
  messagingSenderId: "993295898933",
  appId: "1:993295898933:web:f19048285ba1de8ff5147c",
  measurementId: "G-XM8E8YDBGJ"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

let analytics = null;
let messaging = null;

if (typeof window !== "undefined") {
  analytics = getAnalytics(app);
  if ('serviceWorker' in navigator) {
    try {
      messaging = getMessaging(app);
    } catch (e) {
      console.warn("Firebase Messaging not supported locally or failed:", e);
    }
  }
}

export const requestForToken = async () => {
  if (!messaging) return null;
  try {
    const currentToken = await getToken(messaging, { 
      // VAPID key is typically required for Web Push. We will try to fetch it.
      // vapidKey: process.env.NEXT_PUBLIC_VAPID_KEY
    });
    if (currentToken) {
      return currentToken;
    } else {
      console.log('No registration token available. Request permission to generate one.');
      return null;
    }
  } catch (err) {
    console.log('An error occurred while retrieving token. ', err);
    return null;
  }
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    if (!messaging) return;
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });

export { app, analytics, messaging };
