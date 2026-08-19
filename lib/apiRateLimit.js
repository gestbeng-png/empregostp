import { admin } from './firebaseAdmin';
import { consumeFirestoreRateLimit } from './firestoreRateLimit';
import { logServerWarning } from './serverLog';

const DEFAULT_MESSAGE = 'Demasiados pedidos. Tente novamente dentro de um minuto.';

export function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

/**
 * Guard de rate limit por IP para rotas de API, persistido no Firestore.
 *
 * Devolve `true` quando o pedido pode prosseguir. Quando o limite esgota,
 * escreve a resposta 429 (com `Retry-After`) e devolve `false` — a rota só
 * precisa de retornar cedo.
 *
 * Falha aberto por omissão: se a verificação no Firestore rebentar, o pedido
 * prossegue e fica um aviso classificado. Rotas com efeitos sensíveis (email,
 * configuração de conta) ativam `failClosed`; nessas, indisponibilidade do
 * limitador devolve 503 e o efeito não é executado.
 */
export async function enforceApiRateLimit(
  req,
  res,
  {
    scope,
    limit,
    windowMs = 60_000,
    message = DEFAULT_MESSAGE,
    failClosed = false,
    partition = '',
  },
) {
  const normalizedPartition = String(partition || '').trim();
  let result;
  try {
    result = await consumeFirestoreRateLimit({
      firestore: admin.firestore(),
      key: `${scope}_${normalizedPartition || getClientIp(req)}`,
      limit,
      windowMs,
    });
  } catch (error) {
    logServerWarning('rate_limit.check_failed', error);
    if (failClosed) {
      res.status(503).json({
        error:
          'Não foi possível validar o limite de pedidos. Tente novamente mais tarde.',
      });
      return false;
    }
    return true;
  }

  res.setHeader('X-RateLimit-Remaining', String(result.remaining));
  if (!result.allowed) {
    res.setHeader('Retry-After', String(result.retryAfterSeconds));
    res.status(429).json({ error: message });
    return false;
  }
  return true;
}
