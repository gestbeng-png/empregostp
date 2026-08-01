import { createHash } from 'crypto';
import { Timestamp } from 'firebase-admin/firestore';

function normalizePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Deriva um id de documento Firestore válido e sem colisões a partir da
 * chave lógica do chamador (ex.: `${rota}_${ip}` ou `${rota}_${uid}`).
 *
 * Um id só com caracteres permitidos ([a-zA-Z0-9_-]) não chega: colapsar
 * tudo o resto para "_" torna a sanitização não-injetiva (`a:b` e `a_b`
 * produziam o mesmo id), permitindo que duas chaves distintas partilhem o
 * mesmo orçamento de pedidos. O sufixo hash garante unicidade prática; o
 * prefixo legível existe só para facilitar inspeção manual na consola.
 */
function toRateLimitDocId(key) {
  const raw = String(key);
  const digest = createHash('sha256').update(raw).digest('hex');
  const readablePrefix = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
  return `${readablePrefix}--${digest}`;
}

/**
 * Limite distribuído por janela fixa, persistido no Firestore.
 *
 * Ao contrário de um contador em memória, esta transação é partilhada entre
 * todas as instâncias serverless e não pode ser contornada mudando de instância.
 */
export async function consumeFirestoreRateLimit({
  firestore,
  key,
  limit = 5,
  windowMs = 60_000,
  now = Date.now(),
}) {
  if (!firestore || !key) {
    throw new Error('Firestore e chave são obrigatórios para o rate limit.');
  }

  const normalizedLimit = normalizePositiveInteger(limit, 5);
  const normalizedWindow = normalizePositiveInteger(windowMs, 60_000);
  const timestamp = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  const docId = toRateLimitDocId(key);
  const reference = firestore.collection('apiRateLimits').doc(docId);

  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const data = snapshot.exists ? snapshot.data() || {} : {};
    const previousWindowStart = Number(data.windowStartedAtMs) || 0;
    const withinWindow =
      previousWindowStart > 0 &&
      timestamp >= previousWindowStart &&
      timestamp - previousWindowStart < normalizedWindow;
    const currentCount = withinWindow ? Number(data.count) || 0 : 0;

    if (currentCount >= normalizedLimit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil(
            (normalizedWindow - (timestamp - previousWindowStart)) / 1000,
          ),
        ),
      };
    }

    const nextCount = currentCount + 1;
    const windowStartedAtMs = withinWindow
      ? previousWindowStart
      : timestamp;

    transaction.set(
      reference,
      {
        count: nextCount,
        windowStartedAtMs,
        // Tipo Timestamp (não número) é exigido para que uma política de
        // TTL do Firestore consiga apagar automaticamente estes documentos.
        expiresAt: Timestamp.fromMillis(windowStartedAtMs + normalizedWindow),
        updatedAtMs: timestamp,
      },
      { merge: true },
    );

    return {
      allowed: true,
      remaining: Math.max(0, normalizedLimit - nextCount),
      retryAfterSeconds: 0,
    };
  });
}
