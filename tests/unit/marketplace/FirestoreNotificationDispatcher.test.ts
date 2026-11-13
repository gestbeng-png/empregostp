import { FirestoreNotificationDispatcher } from '@/infrastructure/firebase/marketplace/FirestoreNotificationDispatcher';

function firestoreFor(application: Record<string, unknown>) {
  const written: Record<string, unknown>[] = [];
  const notifications = new Map<string, Record<string, unknown>>();
  const create = jest.fn(async (id: string, value: Record<string, unknown>) => {
    if (notifications.has(id))
      throw Object.assign(new Error('Already exists'), { code: 6 });
    notifications.set(id, { ...value });
    written.push({ id, ...value });
  });
  const db = {
    collection: () => ({
      doc: (id: string) => ({
        get: async () => ({ data: () => application }),
        set: async (value: Record<string, unknown>) => {
          notifications.set(id, { ...value });
          written.push({ id, ...value });
        },
        create: (value: Record<string, unknown>) => create(id, value),
      }),
    }),
  } as never;
  return { db, written, notifications, create };
}

describe('FirestoreNotificationDispatcher', () => {
  const event = {
    id: 'event-1',
    type: 'entity_status_changed',
    schemaVersion: 1 as const,
    payload: {
      entityId: 'application-1',
      entityKind: 'Application',
      version: 2,
    },
    status: 'PROCESSING' as const,
    attempts: 0,
    createdAtMs: 1,
    nextAttemptAtMs: 1,
  };

  it('cria uma notificação in-app para o candidato, de forma idempotente', async () => {
    const { db, written } = firestoreFor({ candidateUserId: 'candidate-1' });
    const dispatcher = new FirestoreNotificationDispatcher(db, () => 123);
    await dispatcher.deliver(event, 'event-1:dispatch_in_app_notification');
    await dispatcher.deliver(event, 'event-1:dispatch_in_app_notification');

    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({
      userId: 'candidate-1',
      entityId: 'application-1',
      type: 'APPLICATION_STATUS_CHANGED',
      read: false,
      createdAtMs: 123,
    });
  });

  it('um replay não apaga a leitura nem altera a data original da notificação', async () => {
    const { db, written, notifications } = firestoreFor({
      candidateUserId: 'candidate-1',
    });
    let now = 123;
    const dispatcher = new FirestoreNotificationDispatcher(db, () => now);
    await dispatcher.deliver(event, 'event-1:dispatch_in_app_notification');
    const id = String(written[0]?.id);
    const read = { ...notifications.get(id), read: true, readAt: 'read-time' };
    notifications.set(id, read);
    now = 456;

    await dispatcher.deliver(event, 'event-1:dispatch_in_app_notification');

    expect(notifications.get(id)).toEqual(read);
    expect(written).toHaveLength(1);
  });

  it('propaga falhas de escrita para o outbox voltar a tentar a entrega', async () => {
    const { db, create } = firestoreFor({ candidateUserId: 'candidate-1' });
    const error = Object.assign(new Error('Unavailable'), { code: 14 });
    create.mockRejectedValueOnce(error);

    await expect(
      new FirestoreNotificationDispatcher(db).deliver(
        event,
        'event-1:dispatch_in_app_notification',
      ),
    ).rejects.toBe(error);
  });

  it('notifica ofertas e ignora entidades sem destinatário', async () => {
    const missing = firestoreFor({});
    const dispatcher = new FirestoreNotificationDispatcher(missing.db);
    await dispatcher.deliver(event, 'event-1:dispatch_in_app_notification');
    await dispatcher.deliver(
      { ...event, payload: { ...event.payload, entityKind: 'Offer' } },
      'event-1:dispatch_in_app_notification',
    );
    expect(missing.written).toHaveLength(0);

    const offer = firestoreFor({ candidateUserId: 'candidate-2' });
    await new FirestoreNotificationDispatcher(offer.db).deliver(
      { ...event, payload: { ...event.payload, entityKind: 'Offer' } },
      'event-1:dispatch_in_app_notification',
    );
    expect(offer.written[0]).toMatchObject({
      userId: 'candidate-2',
      type: 'OFFER_STATUS_CHANGED',
    });
  });
});
