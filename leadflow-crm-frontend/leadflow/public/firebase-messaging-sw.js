importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDY7ZM-tGsB6yU40HYDejGKbsu75cNdz1E",
  authDomain: "dyleadflow.firebaseapp.com",
  projectId: "dyleadflow",
  storageBucket: "dyleadflow.firebasestorage.app",
  messagingSenderId: "993295898933",
  appId: "1:993295898933:web:f19048285ba1de8ff5147c"
};

// Initialize Firebase in the Service Worker
firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.ico', // You can add a custom icon for notifications here
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
