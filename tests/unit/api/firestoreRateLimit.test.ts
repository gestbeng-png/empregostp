import { consumeFirestoreRateLimit } from '../../../lib/firestoreRateLimit';

function createFakeFirestore() {
  const records = new Map<string, Record<string, unknown>>();

  return {
    records,
    collection: jest.fn(() => ({
      doc: jest.fn((id: string) => ({ id })),
    })),
    runTransaction: jest.fn(
      async (
        callback: (transaction: {
          get: (ref: { id: string }) => Promise<{
            exists: boolean;
            data: () => Record<string, unknown>;
          }>;
          set: (
            ref: { id: string },
            value: Record<string, unknown>,
            options: { merge: boolean },
          ) => void;
        }) => Promise<unknown>,
      ) =>
        callback({
          get: async (ref) => ({
            exists: records.has(ref.id),
            data: () => records.get(ref.id) || {},
          }),
          set: (ref, value, options) => {
            records.set(ref.id, {
              ...(options.merge ? records.get(ref.id) : {}),
              ...value,
            });
          },
        }),
    ),
  };
}

describe('rate limit distribuído', () => {
  test('bloqueia depois do limite e reinicia na janela seguinte', async () => {
    const firestore = createFakeFirestore();

    const first = await consumeFirestoreRateLimit({
      firestore,
      key: 'career_advice_user',
      limit: 2,
      windowMs: 60_000,
      now: 1_000,
    });
    const second = await consumeFirestoreRateLimit({
      firestore,
      key: 'career_advice_user',
      limit: 2,
      windowMs: 60_000,
      now: 2_000,
    });
    const blocked = await consumeFirestoreRateLimit({
      firestore,
      key: 'career_advice_user',
      limit: 2,
      windowMs: 60_000,
      now: 3_000,
    });
    const reset = await consumeFirestoreRateLimit({
      firestore,
      key: 'career_advice_user',
      limit: 2,
      windowMs: 60_000,
      now: 62_000,
    });

    expect(first).toMatchObject({ allowed: true, remaining: 1 });
    expect(second).toMatchObject({ allowed: true, remaining: 0 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(reset).toMatchObject({ allowed: true, remaining: 1 });
  });

  test('chaves distintas que colapsariam para o mesmo id sanitizado não partilham orçamento', async () => {
    // Antes da correção, caracteres fora de [a-zA-Z0-9_-] eram todos
    // convertidos para "_", tornando a sanitização não-injetiva: estas duas
    // chaves diferentes colidiam no mesmo documento Firestore.
    const firestore = createFakeFirestore();

    const first = await consumeFirestoreRateLimit({
      firestore,
      key: 'newsletter:1.2.3.4',
      limit: 1,
      windowMs: 60_000,
      now: 1_000,
    });
    expect(first).toMatchObject({ allowed: true, remaining: 0 });

    const second = await consumeFirestoreRateLimit({
      firestore,
      key: 'newsletter_1_2_3_4',
      limit: 1,
      windowMs: 60_000,
      now: 1_500,
    });

    expect(second).toMatchObject({ allowed: true, remaining: 0 });
    expect(firestore.records.size).toBe(2);
  });

  test('persiste a expiração como Firestore Timestamp para permitir política de TTL', async () => {
    // Um TTL policy do Firestore só apaga documentos automaticamente quando o
    // campo alvo é do tipo Timestamp — um número em milissegundos é ignorado
    // silenciosamente para sempre, deixando a coleção crescer sem limite.
    const firestore = createFakeFirestore();

    await consumeFirestoreRateLimit({
      firestore,
      key: 'contact_198.51.100.7',
      limit: 5,
      windowMs: 60_000,
      now: 10_000,
    });

    const [stored] = Array.from(firestore.records.values());
    expect(typeof (stored as { expiresAt?: { toMillis?: unknown } }).expiresAt?.toMillis).toBe(
      'function',
    );
    expect(
      (stored as { expiresAt: { toMillis: () => number } }).expiresAt.toMillis(),
    ).toBe(70_000);
  });
});
