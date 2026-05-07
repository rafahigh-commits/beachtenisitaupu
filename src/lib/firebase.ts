// Firebase Cloud Messaging client setup.
//
// As credenciais são lidas de variáveis VITE_FIREBASE_* (ver .env.example e
// docs/PUSH_NOTIFICATIONS.md). Se faltar alguma, a integração fica desativada
// (não quebra a app).

import { initializeApp, type FirebaseApp } from "firebase/app";
import { getMessaging, getToken, onMessage, type Messaging } from "firebase/messaging";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

export const firebaseEnabled =
  !!(config.apiKey && config.projectId && config.messagingSenderId && config.appId && VAPID_KEY);

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

export function getFirebaseMessaging(): Messaging | null {
  if (!firebaseEnabled) return null;
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator) || !("Notification" in window)) return null;
  if (!app) app = initializeApp(config as Required<typeof config>);
  if (!messaging) messaging = getMessaging(app);
  return messaging;
}

export { getToken, onMessage };
