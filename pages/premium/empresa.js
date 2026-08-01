import nookies from 'nookies';

import { admin } from '../../lib/firebaseAdmin';
import { buildLoginUrl } from '../../lib/loginRedirect';

const PLANS_DESTINATION = '/dashboard/empresa?tab=plans';

export default function PremiumEmpresaRedirect() {
  return null;
}

// Ver a nota em pages/premium/candidatos.js: sem sessão, encaminhar para o
// dashboard só produzia um salto extra até ao login e perdia a intenção.
export async function getServerSideProps(context) {
  let isAuthenticated = false;

  try {
    const cookies = nookies.get(context);
    if (cookies?.token) {
      await admin.auth().verifyIdToken(cookies.token);
      isAuthenticated = true;
    }
  } catch (error) {
    isAuthenticated = false;
  }

  return {
    redirect: {
      destination: isAuthenticated
        ? PLANS_DESTINATION
        : buildLoginUrl(PLANS_DESTINATION),
      permanent: false
    }
  };
}
