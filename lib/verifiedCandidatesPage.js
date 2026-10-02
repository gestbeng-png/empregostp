import { admin } from './firebaseAdmin';
import { logServerError } from './serverLog';
import { fetchSpotlightCandidates } from './spotlightCandidates';

/**
 * `getServerSideProps` das três rotas que mostram a página de candidatos
 * (/candidatos, /candidatos/nacional e /candidatos/internacional).
 *
 * Vive num módulo separado de `spotlightCandidates` de propósito: aquele é
 * importado pelo componente da home, e juntar aqui o `firebase-admin`
 * arrastava-o para o bundle do browser, que rebenta ao tentar resolver `fs` e
 * `http2`. Aqui só entra por via do `getServerSideProps`, que o Next remove do
 * lado do cliente.
 *
 * A página é de marketing: se a leitura falhar, a secção dos verificados
 * simplesmente não aparece — não vale a pena deitar a página abaixo por isso.
 */
export async function getVerifiedCandidatesProps() {
  try {
    const candidatos = await fetchSpotlightCandidates(admin, { limite: 9 });
    return {
      props: { verifiedCandidates: JSON.parse(JSON.stringify(candidatos)) },
    };
  } catch (error) {
    logServerError('candidatos.carregar_verificados_falhou', error);
    return { props: { verifiedCandidates: [] } };
  }
}
