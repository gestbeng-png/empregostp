import { FirestoreNotificationDispatcher } from '@/infrastructure/firebase/marketplace/FirestoreNotificationDispatcher';

function firestoreFor(application: Record<string, unknown>) {
  const written: Record<string, unknown>[] = [];
  const db = {
    collection: () => ({
      doc: (id: string) => ({
        get: async () =>
          ({ data: () => application }),
        set: async (value: Record<string, unknown>) => {
          written.push({ id, ...value });
        },
      }),
    }),
  } as never;
  return { db, written };
}

describe('FirestoreNotificationDispatcher', () => {
  const event = {
    id: 'event-1',
    type: 'entity_status_changed',
    schemaVersion: 1 as const,
    payload: { entityId: 'application-1', entityKind: 'Application', version: 2 },
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

    expect(written).toHaveLength(2);
    expect(written[0]).toMatchObject({
      userId: 'candidate-1',
      entityId: 'application-1',
      type: 'APPLICATION_STATUS_CHANGED',
      read: false,
      createdAtMs: 123,
    });
    expect(written[0]?.id).toBe(written[1]?.id);
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
