import nookies from 'nookies';
import { admin } from './firebaseAdmin';
import { isUserAccountActive } from './userStatus';
import { buildLoginUrl } from './loginRedirect';

const DASHBOARD_REDIRECT = { redirect: { destination: '/dashboard', permanent: false } };

// Perder o destino mandava o admin para um sítio genérico depois de
// autenticar. `buildLoginUrl` só aceita caminhos internos, por isso o
// parâmetro não pode ser usado como open redirect.
function loginRedirect(context) {
  return {
    redirect: {
      destination: buildLoginUrl(context?.resolvedUrl),
      permanent: false,
    },
  };
}

export async function requireAdminPageAuth(context) {
  try {
    const cookies = nookies.get(context);
    if (!cookies?.token) {
      return { ok: false, ...loginRedirect(context) };
    }

    const decodedToken = await admin.auth().verifyIdToken(cookies.token, true);
    const userDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
    if (
      !userDoc.exists ||
      userDoc.data().userType !== 'admin' ||
      !isUserAccountActive(userDoc.data())
    ) {
      return { ok: false, ...DASHBOARD_REDIRECT };
    }

    return {
      ok: true,
      uid: decodedToken.uid,
      userData: userDoc.data() || {}
    };
  } catch (error) {
    console.error('Admin SSR guard failed:', error);
    return { ok: false, ...loginRedirect(context) };
  }
}
