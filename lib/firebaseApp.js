import { getApp, getApps, initializeApp } from 'firebase/app';
import { createFirebaseClientConfig } from './firebaseClientConfig';
import { mayCollectPageAnalytics } from './analyticsPrivacy';
import { afterDelay, runOnFirstInteraction } from './runOnFirstInteraction';

// Shared application identity only: no Firestore/Storage dependency here.
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
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// O Google Analytics (gtag.js, ~160 KB) só carrega na primeira interação —
// toque, tecla ou scroll — ou, sem interação, passados alguns segundos, para
// não competir com o carregamento inicial nem perder as visitas que saem sem
// interagir.
const ANALYTICS_FALLBACK_MS = 5000;

function startAnalytics() {
  void import('firebase/analytics')
    .then(({ getAnalytics }) => {
      if (mayCollectPageAnalytics(window.location)) getAnalytics(app);
    })
    .catch(() => {
      // Optional analytics must never block authentication or rendering.
    });
}

if (typeof window !== 'undefined' && mayCollectPageAnalytics(window.location)) {
  runOnFirstInteraction(startAnalytics, afterDelay(ANALYTICS_FALLBACK_MS));
}
export { app };
export default app;
