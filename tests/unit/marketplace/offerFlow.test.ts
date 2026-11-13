import type { Firestore } from 'firebase-admin/firestore';

import { candidateStatusLabel } from '@/domain/applications/candidateView';
import { resolveRecruitmentNotice } from '@/infrastructure/firebase/marketplace/RecruitmentNotificationResolver';
import { FirestoreOfferService } from '@/infrastructure/firebase/offers/FirestoreOfferService';

import { createFakeFirestore } from '../../helpers/fakeFirestore';

jest.mock('firebase-admin/firestore', () => ({
  Timestamp: { fromMillis: (ms: number) => ({ ms, toMillis: () => ms }) },
}));

const NOW = Date.parse('2026-10-24T10:00:00Z');
const company = 'company-1';
const candidate = 'cand-1';

function seed(
  status = 'SHORTLISTED',
  extra: Record<string, Record<string, unknown>> = {},
) {
  return createFakeFirestore({
    [`users/${company}`]: { userType: 'empresa', email: 'rh@empresa.st' },
    [`users/${candidate}`]: { userType: 'candidato' },
    'applications/app-1': {
      v2Status: status,
      status: 'analysis',
      version: 3,
      organizationId: company,
      candidateUserId: candidate,
      jobId: 'job-1',
    },
    ...extra,
  });
}

let keys = 0;
const offerInput = (extra: Record<string, unknown> = {}) => ({
  action: 'send',
  idempotencyKey: `key-${String(++keys).padStart(16, '0')}`,
  amountMinor: 1_500_000,
  currency: 'STN',
  period: 'MONTH',
  startDate: '2026-11-02',
  expiresAt: '2026-10-31T23:59:59Z',
  message: 'Bem-vinda à equipa.',
  ...extra,
});
const act = (db: Firestore, uid: string, input: Record<string, unknown>) =>
  new FirestoreOfferService(db, () => NOW).act(uid, 'app-1', input);

function history(docs: Map<string, Record<string, unknown>>) {
  return [...docs.entries()]
    .filter(([path]) => path.startsWith('applicationsStatusHistory/'))
    .map(([, value]) => value);
}

describe('rótulo da candidatura quando a proposta termina', () => {
  test.each([
    [null, 'Proposta recusada'],
    ['OFFER_WITHDRAWN', 'Proposta retirada'],
    ['OFFER_EXPIRED', 'Proposta expirada'],
  ])('motivo %s → %s', (reason, label) => {
    expect(candidateStatusLabel('OFFER_DECLINED', reason)).toBe(label);
  });
});

describe('fluxo da proposta de emprego', () => {
  test('enviar move a candidatura para OFFER e o candidato pode aceitar', async () => {
    const { db, docs } = seed();
    const sent = await act(db, company, offerInput());
    expect(sent.ok).toBe(true);
    const offer = (sent as { value: { offer: Record<string, unknown> } }).value
      .offer;
    expect(offer).toMatchObject({ status: 'SENT', amountMinor: 1_500_000 });
    expect(docs.get('applications/app-1')).toMatchObject({ v2Status: 'OFFER' });

    const accepted = await act(db, candidate, {
      action: 'accept',
      idempotencyKey: 'accept-key-0000000001',
      offerId: offer.id,
      expectedVersion: offer.version,
    });
    expect(accepted.ok).toBe(true);
    expect(docs.get(`offers/${String(offer.id)}`)).toMatchObject({
      v2Status: 'ACCEPTED',
    });
    // Aceitar não contrata: a empresa confirma a contratação depois.
    expect(docs.get('applications/app-1')).toMatchObject({ v2Status: 'OFFER' });
  });

  test('recusar fecha a candidatura como «Proposta recusada»', async () => {
    const { db, docs } = seed();
    const sent = await act(db, company, offerInput());
    const offer = (sent as { value: { offer: Record<string, unknown> } }).value
      .offer;
    await act(db, candidate, {
      action: 'decline',
      idempotencyKey: 'decline-key-000000001',
      offerId: offer.id,
      expectedVersion: offer.version,
    });
    const app = docs.get('applications/app-1');
    expect(app).toMatchObject({
      v2Status: 'OFFER_DECLINED',
      closedReason: null,
    });
    expect(
      candidateStatusLabel('OFFER_DECLINED', app?.closedReason as null),
    ).toBe('Proposta recusada');
  });

  test('retirar a proposta liberta a candidatura em vez de a deixar presa', async () => {
    const { db, docs } = seed('INTERVIEW');
    const sent = await act(db, company, offerInput());
    const offer = (sent as { value: { offer: Record<string, unknown> } }).value
      .offer;
    const withdrawn = await act(db, company, {
      action: 'withdraw',
      idempotencyKey: 'withdraw-key-00000001',
      offerId: offer.id,
      expectedVersion: offer.version,
    });
    expect(withdrawn.ok).toBe(true);
    expect(docs.get('applications/app-1')).toMatchObject({
      v2Status: 'OFFER_DECLINED',
      closedReason: 'OFFER_WITHDRAWN',
    });
    expect(history(docs).at(-1)).toMatchObject({
      to: 'OFFER_DECLINED',
      closedReason: 'OFFER_WITHDRAWN',
      candidateVisibleNote: 'A empresa retirou a proposta.',
    });
  });

  test('o candidato não pode agir antes de a proposta ser enviada', async () => {
    const { db } = seed();
    const draft = await act(db, company, offerInput({ action: 'save' }));
    const offer = (draft as { value: { offer: Record<string, unknown> } }).value
      .offer;
    const accepted = await act(db, candidate, {
      action: 'accept',
      idempotencyKey: 'accept-key-0000000002',
      offerId: offer.id,
      expectedVersion: offer.version,
    });
    expect(accepted.ok).toBe(false);
  });

  test('sem pré-seleção ou entrevista não há proposta', async () => {
    const { db } = seed('SUBMITTED');
    const sent = await act(db, company, offerInput());
    expect(sent).toMatchObject({
      ok: false,
      error: { code: 'INVALID_TRANSITION' },
    });
  });
});

describe('expiração da proposta', () => {
  const expired = (status: string) =>
    seed('OFFER', {
      'offers/offer-1': {
        applicationId: 'app-1',
        organizationId: company,
        v2Status: status,
        version: 2,
      },
    });

  test('proposta expirada liberta a candidatura como «Proposta expirada»', async () => {
    const { db, docs } = expired('EXPIRED');
    const service = new FirestoreOfferService(db, () => NOW);
    expect(await service.releaseAfterExpiry('app-1')).toBe(true);
    const app = docs.get('applications/app-1');
    expect(app).toMatchObject({
      v2Status: 'OFFER_DECLINED',
      closedReason: 'OFFER_EXPIRED',
      version: 4,
    });
    expect(candidateStatusLabel('OFFER_DECLINED', 'OFFER_EXPIRED')).toBe(
      'Proposta expirada',
    );
    // Segunda passagem do cron: nada muda.
    expect(await service.releaseAfterExpiry('app-1')).toBe(false);
  });

  test.each(['SENT', 'ACCEPTED'])(
    'com uma proposta %s a candidatura fica como está',
    async (status) => {
      const { db, docs } = expired(status);
      expect(
        await new FirestoreOfferService(db, () => NOW).releaseAfterExpiry(
          'app-1',
        ),
      ).toBe(false);
      expect(docs.get('applications/app-1')).toMatchObject({
        v2Status: 'OFFER',
      });
    },
  );
});

describe('quem é avisado', () => {
  const event = (entityId: string) => ({
    id: 'event-1',
    type: 'entity_status_changed',
    schemaVersion: 1 as const,
    payload: { entityId, entityKind: 'Offer', version: 2 },
    status: 'PROCESSING' as const,
    attempts: 0,
    createdAtMs: 1,
    nextAttemptAtMs: 1,
  });
  const offerDb = (v2Status: string) =>
    seed('OFFER', {
      'offers/offer-1': {
        applicationId: 'app-1',
        organizationId: company,
        candidateUserId: candidate,
        v2Status,
      },
    }).db;

  test('a resposta do candidato chega à empresa', async () => {
    const notice = await resolveRecruitmentNotice(
      offerDb('ACCEPTED'),
      event('offer-1'),
    );
    expect(notice).toMatchObject({
      userId: company,
      email: 'rh@empresa.st',
      type: 'OFFER_ACCEPTED',
      path: '/dashboard/recrutamento',
    });
  });

  test('uma proposta enviada chega ao candidato com um título claro', async () => {
    const notice = await resolveRecruitmentNotice(
      offerDb('SENT'),
      event('offer-1'),
    );
    expect(notice).toMatchObject({
      userId: candidate,
      type: 'OFFER_STATUS_CHANGED',
      title: 'Recebeu uma proposta de emprego',
      path: '/dashboard/candidato/candidaturas',
    });
  });
});

describe('avisos da candidatura', () => {
  const applicationEvent = {
    id: 'event-2',
    type: 'entity_status_changed',
    schemaVersion: 1 as const,
    payload: { entityId: 'app-1', entityKind: 'Application', version: 1 },
    status: 'PROCESSING' as const,
    attempts: 0,
    createdAtMs: 1,
    nextAttemptAtMs: 1,
  };
  const applicationDb = (status: string) =>
    createFakeFirestore({
      [`users/${candidate}`]: {
        userType: 'candidato',
        email: 'ana@exemplo.st',
      },
      'applications/app-1': {
        v2Status: status,
        organizationId: company,
        candidateUserId: candidate,
      },
    }).db;

  test('ao submeter sai só o email «Candidatura recebida» (o painel já tem o aviso)', async () => {
    expect(
      await resolveRecruitmentNotice(
        applicationDb('SUBMITTED'),
        applicationEvent,
      ),
    ).toMatchObject({
      userId: null,
      email: 'ana@exemplo.st',
      title: 'Candidatura recebida',
    });
  });

  test('a pré-seleção é interna e não gera aviso', async () => {
    expect(
      await resolveRecruitmentNotice(
        applicationDb('SHORTLISTED'),
        applicationEvent,
      ),
    ).toBeNull();
  });

  test('as outras mudanças dizem o que aconteceu', async () => {
    expect(
      await resolveRecruitmentNotice(
        applicationDb('UNDER_REVIEW'),
        applicationEvent,
      ),
    ).toMatchObject({
      userId: candidate,
      title: 'A sua candidatura está em análise',
    });
  });
});
