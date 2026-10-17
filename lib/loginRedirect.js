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
const LOGIN_PATH = '/login';
const VALIDATION_ORIGIN = 'https://empregostp.invalid';

function decodeForValidation(value) {
  let decoded = value;

  // O router já descodifica uma vez, mas entradas duplamente codificadas
  // continuam perigosas quando o browser as normaliza ao navegar.
  for (let index = 0; index < 3; index += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      return null;
    }
  }

  return decoded;
}

/**
 * Valida o destino no ponto em que ele é consumido pelo login.
 *
 * `buildLoginUrl` protege os links criados pela aplicação, mas o parâmetro
 * também pode ser escrito diretamente por um atacante. Por isso o consumidor
 * nunca deve usar `router.query.redirect` sem voltar a passar por esta função.
 */
export function sanitizeLoginRedirect(destination) {
  if (typeof destination !== 'string') return null;

  const target = destination.trim();
  if (!target) return null;

  const decodedTarget = decodeForValidation(target);
  if (!decodedTarget) return null;

  // Tem de ser um caminho absoluto do próprio site: "/x" sim, "//outro" não
  // (o browser lê "//" como protocolo relativo e sai do domínio).
  if (
    !target.startsWith('/') ||
    target.startsWith('//') ||
    !decodedTarget.startsWith('/') ||
    decodedTarget.startsWith('//') ||
    decodedTarget.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(decodedTarget)
  ) {
    return null;
  }

  try {
    const parsed = new URL(target, VALIDATION_ORIGIN);
    if (parsed.origin !== VALIDATION_ORIGIN) return null;
  } catch {
    return null;
  }

  // Voltar ao login depois do login não é destino nenhum.
  if (
    decodedTarget === LOGIN_PATH ||
    decodedTarget.startsWith(`${LOGIN_PATH}?`) ||
    decodedTarget.startsWith(`${LOGIN_PATH}#`)
  ) {
    return null;
  }

  return target;
}

export function buildLoginUrl(destination) {
  const target = sanitizeLoginRedirect(destination);
  if (!target) return LOGIN_PATH;

  return `${LOGIN_PATH}?redirect=${encodeURIComponent(target)}`;
}

/** Mantém os links existentes (?redirect=) e aceita o alias do wireframe. */
export function readLoginRedirect(query = {}) {
  const value = query.redirect ?? query.returnTo;
  return sanitizeLoginRedirect(Array.isArray(value) ? value[0] : value);
}

export function buildRegisterUrl(destination) {
  const target = sanitizeLoginRedirect(destination);
  return target
    ? `/register?redirect=${encodeURIComponent(target)}`
    : '/register';
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
