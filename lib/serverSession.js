import nookies from 'nookies';

import { admin } from './firebaseAdmin';
import { redirectToLogin } from './loginRedirect';
import { isUserAccountActive } from './userStatus';

/**
 * Guard de sessão para `getServerSideProps`.
 *
 * Devolve `null` quando há sessão válida, ou o objeto de redirect quando não
 * há. Serve para as páginas que só validavam no cliente: mostravam a shell do
 * dashboard e só depois saltavam, com comportamento diferente das rotas que já
 * bloqueavam no servidor.
 *
 * Falha a fechar: se o Admin SDK estiver indisponível, manda para o login em
 * vez de deixar passar. Ao contrário do rate limit, aqui a decisão é de
 * autorização e o custo de errar para o lado permissivo é maior.
 *
 * Vive num módulo separado de `loginRedirect` de propósito: aquele é
 * importado por componentes de cliente, e juntar aqui o `firebase-admin`
 * arrastava-o para o bundle do browser, que rebenta ao tentar resolver `net`.
 */
export async function requireSession(context) {
  try {
    const cookies = nookies.get(context);
    if (!cookies?.token) return redirectToLogin(context);

    const decodedToken = await admin.auth().verifyIdToken(cookies.token, true);
    const userDoc = await admin
      .firestore()
      .collection('users')
      .doc(decodedToken.uid)
      .get();

    if (!userDoc.exists || !isUserAccountActive(userDoc.data())) {
      return redirectToLogin(context);
    }

    return null;
  } catch (error) {
    return redirectToLogin(context);
  }
}

/**
 * Guard do painel do candidato.
 *
 * Antes bastava ter sessão: uma empresa ou um admin abria `/dashboard/candidato`,
 * preenchia o formulário de perfil todo e só ao gravar é que rebentava — com
 * "Apenas candidatos podem gerir certificados", que nem sequer descreve o
 * problema. Todos os links que apontam para esta página são fluxos de
 * candidato, e `/dashboard` reencaminha cada tipo de conta para o seu painel.
 */
export async function requireCandidateSession(context) {
  try {
    const cookies = nookies.get(context);
    if (!cookies?.token) return redirectToLogin(context);

    const decodedToken = await admin.auth().verifyIdToken(cookies.token, true);
    const userDoc = await admin
      .firestore()
      .collection('users')
      .doc(decodedToken.uid)
      .get();

    if (!userDoc.exists || !isUserAccountActive(userDoc.data())) {
      return redirectToLogin(context);
    }

    if (userDoc.data().userType !== 'candidato') {
      return { redirect: { destination: '/dashboard', permanent: false } };
    }

    return null;
  } catch (error) {
    return redirectToLogin(context);
  }
}

/**
 * Guard das páginas que só fazem sentido para uma empresa com sessão.
 *
 * Sem isto, uma pessoa sem conta chegava ao formulário de publicar vaga vindo
 * da página /empresas, preenchia os quatro passos e só ao submeter é que
 * descobria que precisava de conta — com o trabalho todo por gravar.
 *
 * Quem não tem sessão vai para o login com o destino preservado, e volta ao
 * formulário depois de entrar (ou de criar conta). Quem tem sessão mas não é
 * empresa vai para o seu próprio painel.
 */
export async function requireCompanySession(context) {
  try {
    const cookies = nookies.get(context);
    if (!cookies?.token) return redirectToLogin(context);

    const decodedToken = await admin.auth().verifyIdToken(cookies.token, true);
    const userDoc = await admin
      .firestore()
      .collection('users')
      .doc(decodedToken.uid)
      .get();

    if (!userDoc.exists || !isUserAccountActive(userDoc.data())) {
      return redirectToLogin(context);
    }

    const { userType } = userDoc.data();
    if (userType !== 'empresa' && userType !== 'admin') {
      return { redirect: { destination: '/dashboard', permanent: false } };
    }

    return null;
  } catch (error) {
    return redirectToLogin(context);
  }
}
