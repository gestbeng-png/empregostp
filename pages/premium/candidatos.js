import nookies from 'nookies';

import { admin } from '../../lib/firebaseAdmin';
import { buildLoginUrl } from '../../lib/loginRedirect';

const PLANS_DESTINATION = '/dashboard/candidato?tab=plans';

export default function PremiumCandidatosRedirect() {
  return null;
}

// Os planos vivem na tab do dashboard, por isso esta página encaminha para lá.
// Só que um visitante sem sessão não pode usar o dashboard: era enviado para
// lá, o guard atirava-o ao login e a intenção perdia-se pelo caminho — logo no
// CTA de upgrade das ferramentas premium. Sem sessão vai direto ao login, com
// os planos guardados como destino de retorno.
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
