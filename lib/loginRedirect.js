/**
 * Compõe o URL de login preservando o destino pretendido.
 *
 * Existia o padrão certo em duas páginas e o padrão errado em quinze: quem
 * pedia uma página protegida sem sessão era enviado para o login e, depois de
 * autenticar, largado num destino genérico. `pages/login.js` já sabe ler
 * `?redirect=`; faltava alguém escrevê-lo.
 *
 * Só aceita caminhos internos. Um destino absoluto tornaria o login um open
 * redirect utilizável para phishing — a vítima veria o nosso domínio no ecrã
 * de autenticação e seria atirada para outro sítio a seguir.
 */
export function buildLoginUrl(destination) {
  if (typeof destination !== 'string') return '/login';

  const target = destination.trim();
  if (!target) return '/login';

  // Tem de ser um caminho absoluto do próprio site: "/x" sim, "//outro" não
  // (o browser lê "//" como protocolo relativo e sai do domínio).
  if (!target.startsWith('/') || target.startsWith('//')) return '/login';

  // Voltar ao login depois do login não é destino nenhum.
  if (target === '/login' || target.startsWith('/login?')) return '/login';

  return `/login?redirect=${encodeURIComponent(target)}`;
}

/**
 * Resposta de `getServerSideProps` que manda para o login sem perder o
 * destino. Aceita o caminho ou o próprio contexto, para as rotas poderem
 * passar `context` diretamente.
 */
export function redirectToLogin(destinationOrContext) {
  const destination =
    typeof destinationOrContext === 'string'
      ? destinationOrContext
      : destinationOrContext?.resolvedUrl;

  return {
    redirect: {
      destination: buildLoginUrl(destination),
      permanent: false,
    },
  };
}
