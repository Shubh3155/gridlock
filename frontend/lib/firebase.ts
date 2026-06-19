import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, User } from "firebase/auth";
import { getMessaging, getToken, onMessage, Messaging } from "firebase/messaging";

// Fallback to mock credentials during build time if environment variables are not supplied
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "mock-firebase-api-key-value",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "mock-firebase-auth-domain",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "mock-firebase-project-id",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:1234567890:web:1234567890",
};

// Initialize Firebase app (idempotent, only on client/server safely)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export async function loginWithGoogle(): Promise<{ user: User; idToken: string }> {
  // Check if we are running with mock keys
  if (firebaseConfig.apiKey.startsWith("mock-")) {
    throw new Error("auth/configuration-not-found");
  }

  const result = await signInWithPopup(auth, googleProvider);
  const idToken = await result.user.getIdToken();
  return { user: result.user, idToken };
}

export async function requestNotificationPermission(
  idToken: string,
  registerCallback: (idToken: string, fcmToken: string) => Promise<any>
): Promise<string | null> {
  if (typeof window === "undefined") return null;

  try {
    const { isSupported } = await import("firebase/messaging");
    const supported = await isSupported();
    if (!supported) {
      console.warn("FCM is not supported in this browser environment.");
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("Notification permission was not granted.");
      return null;
    }

    const messaging = getMessaging(app);
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

    if (!vapidKey || vapidKey.startsWith("mock-")) {
      console.warn("FCM VAPID key is missing or unconfigured. Skipping push registration.");
      return null;
    }

    const fcmToken = await getToken(messaging, { vapidKey });
    if (fcmToken) {
      console.log("FCM Token retrieved successfully:", fcmToken);
      // Register with the backend
      await registerCallback(idToken, fcmToken);
      return fcmToken;
    } else {
      console.warn("No registration token available. Request permission to generate one.");
      return null;
    }
  } catch (error) {
    console.error("An error occurred while retrieving FCM token:", error);
    return null;
  }
}

export async function onForegroundMessage(callback: (payload: any) => void) {
  if (typeof window === "undefined") return;

  try {
    const { isSupported } = await import("firebase/messaging");
    const supported = await isSupported();
    if (!supported) return;

    // Skip messaging setup on mock credentials
    if (firebaseConfig.apiKey.startsWith("mock-")) {
      return;
    }

    const messaging = getMessaging(app);
    onMessage(messaging, callback);
  } catch (error) {
    console.error("Error setting up foreground message handler:", error);
  }
}
