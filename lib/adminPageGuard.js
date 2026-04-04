import nookies from 'nookies';
import { admin } from './firebaseAdmin';

const LOGIN_REDIRECT = { redirect: { destination: '/login', permanent: false } };
const DASHBOARD_REDIRECT = { redirect: { destination: '/dashboard', permanent: false } };

export async function requireAdminPageAuth(context) {
  try {
    const cookies = nookies.get(context);
    if (!cookies?.token) {
      return { ok: false, ...LOGIN_REDIRECT };
    }

    const decodedToken = await admin.auth().verifyIdToken(cookies.token);
    const userDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
    if (!userDoc.exists || userDoc.data().userType !== 'admin') {
      return { ok: false, ...DASHBOARD_REDIRECT };
    }

    return {
      ok: true,
      uid: decodedToken.uid,
      userData: userDoc.data() || {}
    };
  } catch (error) {
    console.error('Admin SSR guard failed:', error);
    return { ok: false, ...LOGIN_REDIRECT };
  }
}
