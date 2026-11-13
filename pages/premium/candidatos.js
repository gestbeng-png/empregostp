import { buildLoginUrl } from '../../lib/loginRedirect';
import { requireSessionAccount } from '../../lib/serverSession';

const PLANS_DESTINATION = '/dashboard/candidato?tab=plans';

export default function PremiumCandidatosRedirect() {
  return null;
}

// Não confundir uma sessão de outro tipo com um visitante sem sessão:
// empresa/admin regressam ao próprio painel, sem abrir o painel de candidato.
export async function getServerSideProps(context) {
  const session = await requireSessionAccount(context);

  return {
    redirect: {
      destination: session.redirect
        ? buildLoginUrl(PLANS_DESTINATION)
        : session.accountType === 'candidato'
          ? PLANS_DESTINATION
          : '/dashboard',
      permanent: false,
    },
  };
}
