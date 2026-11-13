import { buildLoginUrl } from '../../lib/loginRedirect';
import { requireSessionAccount } from '../../lib/serverSession';

const PLANS_DESTINATION = '/dashboard/empresa?tab=plans';

export default function PremiumEmpresaRedirect() {
  return null;
}

// Ver a nota em pages/premium/candidatos.js: sem sessão, encaminhar para o
// dashboard só produzia um salto extra até ao login e perdia a intenção.
export async function getServerSideProps(context) {
  const session = await requireSessionAccount(context);

  return {
    redirect: {
      destination: session.redirect
        ? buildLoginUrl(PLANS_DESTINATION)
        : session.accountType === 'empresa'
          ? PLANS_DESTINATION
          : '/dashboard',
      permanent: false,
    },
  };
}
