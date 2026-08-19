import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  setPersistence,
} from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage } from 'firebase/storage';
import { createFirebaseClientConfig } from './firebaseClientConfig';

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
const useFirebaseEmulators =
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true';

// Analytics inicializa internamente Firebase Installations. Nenhum dos dois
// deve sequer entrar no bundle inicial nem arrancar em QA local: além de
// poluir métricas, Installations pode fazer pedidos ao projeto real mesmo
// quando Auth/Firestore usam emuladores.
if (typeof window !== 'undefined' && !useFirebaseEmulators) {
  void import('firebase/analytics')
    .then(({ getAnalytics }) => getAnalytics(app))
    .catch(() => {
      // Analytics é complementar e não deve impedir a utilização da app em
      // browsers que não o suportam (incluindo contextos de privacidade).
    });
}

// Configurar persistência de autenticação
if (typeof window !== 'undefined') {
  if (
    useFirebaseEmulators &&
    !window.__EMPREGOSTP_FIREBASE_EMULATORS_CONNECTED__
  ) {
    const authHost =
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
    const firestoreHost =
      process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
    const storageHost =
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST ||
      '127.0.0.1:9199';
    const [firestoreHostname, firestorePortValue] = firestoreHost.split(':');
    const firestorePort = Number(firestorePortValue || 8080);
    const [storageHostname, storagePortValue] = storageHost.split(':');
    const storagePort = Number(storagePortValue || 9199);

    connectAuthEmulator(auth, `http://${authHost}`, {
      disableWarnings: true,
    });
    connectFirestoreEmulator(db, firestoreHostname, firestorePort);
    connectStorageEmulator(storage, storageHostname, storagePort);
    window.__EMPREGOSTP_FIREBASE_EMULATORS_CONNECTED__ = true;
  }

  setPersistence(auth, browserLocalPersistence);
}

export { auth, db, app, storage };
export default app;
