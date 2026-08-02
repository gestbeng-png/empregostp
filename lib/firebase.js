import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import {
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  setPersistence,
} from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { createFirebaseClientConfig } from "./firebaseClientConfig";

const firebaseConfig = createFirebaseClientConfig({
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID:
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
});

// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const analytics = typeof window !== "undefined" ? getAnalytics(app) : null;

// Configurar persistência de autenticação
if (typeof window !== 'undefined') {
  if (
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true' &&
    !window.__EMPREGOSTP_FIREBASE_EMULATORS_CONNECTED__
  ) {
    const authHost =
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
    const firestoreHost =
      process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
    const [firestoreHostname, firestorePortValue] = firestoreHost.split(':');
    const firestorePort = Number(firestorePortValue || 8080);

    connectAuthEmulator(auth, `http://${authHost}`, {
      disableWarnings: true,
    });
    connectFirestoreEmulator(db, firestoreHostname, firestorePort);
    window.__EMPREGOSTP_FIREBASE_EMULATORS_CONNECTED__ = true;
  }

  setPersistence(auth, browserLocalPersistence);
}

export { auth, db, app, storage };
export default app;
