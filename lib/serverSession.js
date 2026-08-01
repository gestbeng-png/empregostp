import nookies from 'nookies';

import { admin } from './firebaseAdmin';
import { redirectToLogin } from './loginRedirect';

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

    await admin.auth().verifyIdToken(cookies.token);
    return null;
  } catch (error) {
    return redirectToLogin(context);
  }
}
