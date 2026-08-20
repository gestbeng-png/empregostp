// Deteção de falhas causadas por ausência de ligação à internet.
//
// Sem rede, o Firebase nem sempre devolve `auth/network-request-failed`: em
// vários browsers a chamada rebenta antes e chega até nós como
// `auth/internal-error`, o que mostrava ao utilizador uma mensagem genérica
// ("Email ou senha incorretos", "Tente novamente") sem qualquer relação com o
// problema real. Aqui centralizamos o diagnóstico e a mensagem em português.

export const OFFLINE_MESSAGE =
  'Sem ligação à internet. Verifique a sua rede e tente novamente.';

const NETWORK_ERROR_CODES = new Set([
  'auth/network-request-failed',
  'auth/timeout',
  'storage/retry-limit-exceeded',
  'unavailable',
  'deadline-exceeded',
]);

// Códigos que só são de rede quando há outros sinais (browser offline ou
// mensagem a falar de rede); caso contrário são erros reais do servidor.
const AMBIGUOUS_ERROR_CODES = new Set([
  'auth/internal-error',
  'internal',
  'auth/web-storage-unsupported',
]);

const NETWORK_MESSAGE_PATTERN =
  /failed to fetch|network\s*error|networkerror|network request failed|load failed|err_internet_disconnected|err_network|connection (?:refused|reset|closed)|offline/i;

export function isBrowserOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function messageLooksLikeNetwork(error) {
  const parts = [
    error?.message,
    error?.customData?.message,
    error?.cause?.message,
  ];

  return parts.some(
    (part) => typeof part === 'string' && NETWORK_MESSAGE_PATTERN.test(part),
  );
}

export function isNetworkError(error) {
  if (!error) return isBrowserOffline();

  const code = typeof error.code === 'string' ? error.code : '';

  if (NETWORK_ERROR_CODES.has(code)) return true;

  if (AMBIGUOUS_ERROR_CODES.has(code)) {
    return isBrowserOffline() || messageLooksLikeNetwork(error);
  }

  // `fetch` rejeitado por falta de rede chega como TypeError sem `code`.
  if (!code && messageLooksLikeNetwork(error)) return true;

  // Sem código conhecido, o estado do browser é o sinal mais fiável.
  return !code && isBrowserOffline();
}

export function getNetworkErrorMessage(error, fallback) {
  return isNetworkError(error) ? OFFLINE_MESSAGE : fallback;
}
