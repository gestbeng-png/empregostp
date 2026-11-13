import { FirestoreInterviewService } from '@/infrastructure/firebase/interviews/FirestoreInterviewService';

import { createFakeFirestore } from '../../helpers/fakeFirestore';

jest.mock('firebase-admin/firestore', () => ({
  Timestamp: {
    fromMillis: (ms: number) => ({
      ms,
      toMillis: () => ms,
      toDate: () => new Date(ms),
    }),
  },
}));

let NOW = Date.parse('2026-10-10T10:00:00Z');
const company = 'company-1';
const KEY = 'interview-key-0000000001';

function setup(app: Record<string, unknown> = {}) {
  const fake = createFakeFirestore({
    [`users/${company}`]: { userType: 'empresa' },
    'users/other': { userType: 'empresa' },
    'users/cand-1': { userType: 'candidato' },
    'applications/app-1': {
      v2Status: 'SUBMITTED',
      status: 'pending',
      version: 1,
      organizationId: company,
      candidateUserId: 'cand-1',
      jobId: 'job-1',
      jobSnapshot: { titulo: 'Motorista', companyName: 'Transportes X' },
      ...app,
    },
  });
  const service = new FirestoreInterviewService(fake.db, () => NOW);
  return { ...fake, service };
}
const valid = {
  type: 'PRESENCIAL',
  startsAt: '2026-10-12T09:00:00Z',
  location: 'Sede, Água Grande',
  candidateMessage: 'Traga o BI.',
};
const entries = (docs: Map<string, Record<string, unknown>>, prefix: string) =>
  [...docs.entries()].filter(([p]) => p.startsWith(prefix)).map(([, d]) => d);

describe('Fase 3 — entrevistas (E6)', () => {
  beforeEach(() => {
    NOW = Date.parse('2026-10-10T10:00:00Z');
  });

  test('marcar: entrevista + candidatura a INTERVIEW (via UNDER_REVIEW) numa transação; duplo clique idempotente', async () => {
    const { service, docs } = setup();
    const first = await service.schedule(company, 'app-1', valid, KEY);
    const second = await service.schedule(company, 'app-1', valid, KEY);
    expect(first).toMatchObject({ ok: true, value: { replayed: false } });
    expect(second).toMatchObject({ ok: true, value: { replayed: true } });
    expect(entries(docs, 'interviews/')).toHaveLength(1);
    expect(docs.get('applications/app-1')).toMatchObject({
      v2Status: 'INTERVIEW',
      status: 'interview',
      version: 3,
      interviewDetails: {
        mode: 'presencial',
        location: 'Sede, Água Grande',
        status: 'scheduled',
      },
    });
    expect(
      entries(docs, 'applicationsStatusHistory/').map((h) => h.to),
    ).toEqual(['UNDER_REVIEW', 'INTERVIEW']);
    expect(entries(docs, 'outboxEvents/')).toHaveLength(2);
  });

  test('outra empresa, dados inválidos e candidatura terminal', async () => {
    expect(
      await setup().service.schedule('other', 'app-1', valid, KEY),
    ).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(
      await setup().service.schedule(
        company,
        'app-1',
        { ...valid, location: '' },
        KEY,
      ),
    ).toMatchObject({
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        message: 'Indique o local da entrevista.',
      },
    });
    const { service, docs } = setup({
      v2Status: 'WITHDRAWN',
      status: 'withdrawn',
    });
    expect(await service.schedule(company, 'app-1', valid, KEY)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_TRANSITION' },
    });
    expect(entries(docs, 'interviews/')).toHaveLength(0);
  });

  test('candidato confirma; só o próprio', async () => {
    const { service } = setup();
    const scheduled = await service.schedule(company, 'app-1', valid, KEY);
    const id = scheduled.ok ? scheduled.value.interviewId : '';
    expect(await service.confirm('cand-2', id)).toMatchObject({
      ok: false,
      error: { code: 'FORBIDDEN' },
    });
    expect(await service.confirm('cand-1', id)).toMatchObject({
      ok: true,
      value: { status: 'CONFIRMED' },
    });
  });

  test('reagendamento: pedido com proposta → nova hora pela empresa; aviso a partir de 3', async () => {
    const { service, docs } = setup();
    const scheduled = await service.schedule(company, 'app-1', valid, KEY);
    const id = scheduled.ok ? scheduled.value.interviewId : '';
    expect(await service.requestReschedule('cand-1', id, '')).toMatchObject({
      ok: false,
      error: { code: 'TRANSITION_GUARD_FAILED' },
    });
    let last;
    for (let round = 1; round <= 3; round++) {
      expect(
        await service.requestReschedule(
          'cand-1',
          id,
          'Pode ser na sexta de manhã?',
        ),
      ).toMatchObject({ ok: true });
      last = await service.reschedule(company, id, {
        ...valid,
        startsAt: `2026-10-1${round + 2}T09:00:00Z`,
      });
      expect(last).toMatchObject({ ok: true, value: { status: 'SCHEDULED' } });
    }
    expect(last).toMatchObject({
      value: { warning: 'Esta entrevista já foi reagendada 3 vezes.' },
    });
    expect(docs.get(`interviews/${id}`)).toMatchObject({
      rescheduleCount: 3,
      remindersSent: [],
    });
  });

  test('a agenda do candidato (interviewDetails) acompanha cada mudança', async () => {
    const { service, docs } = setup();
    const scheduled = await service.schedule(company, 'app-1', valid, KEY);
    const id = scheduled.ok ? scheduled.value.interviewId : '';
    const details = () => docs.get('applications/app-1')?.interviewDetails;

    await service.confirm('cand-1', id);
    expect(details()).toMatchObject({ interviewId: id, status: 'confirmed' });

    await service.requestReschedule('cand-1', id, 'Pode ser na sexta?');
    expect(details()).toMatchObject({ status: 'reschedule_requested' });

    await service.reschedule(company, id, {
      ...valid,
      startsAt: '2026-10-15T09:00:00Z',
      location: 'Filial, Lobata',
    });
    expect(details()).toMatchObject({
      status: 'scheduled',
      scheduledAt: '2026-10-15T09:00:00.000Z',
      location: 'Filial, Lobata',
    });

    await service.cancel(company, id, 'Vaga suspensa', 'ORGANIZATION');
    expect(details()).toBeNull();
  });

  test('concluir/faltou só depois da hora; cancelar com motivo por qualquer lado', async () => {
    const { service } = setup();
    const scheduled = await service.schedule(company, 'app-1', valid, KEY);
    const id = scheduled.ok ? scheduled.value.interviewId : '';
    expect(await service.finish(company, id, 'COMPLETED')).toMatchObject({
      ok: false,
      error: { code: 'TRANSITION_GUARD_FAILED' },
    });
    NOW = Date.parse('2026-10-12T10:00:00Z');
    expect(await service.finish(company, id, 'NO_SHOW')).toMatchObject({
      ok: true,
      value: { status: 'NO_SHOW' },
    });
    const other = setup();
    const s2 = await other.service.schedule(
      company,
      'app-1',
      { ...valid, startsAt: '2026-10-20T09:00:00Z' },
      KEY,
    );
    const id2 = s2.ok ? s2.value.interviewId : '';
    expect(
      await other.service.cancel('cand-1', id2, '', 'CANDIDATE'),
    ).toMatchObject({ ok: false, error: { code: 'TRANSITION_GUARD_FAILED' } });
    expect(
      await other.service.cancel(
        'cand-1',
        id2,
        'Aceitei outra proposta',
        'CANDIDATE',
      ),
    ).toMatchObject({ ok: true, value: { status: 'CANCELLED' } });
  });

  test('feedback é interno e por entrevistador; .ics para candidato e empresa, nunca para terceiros', async () => {
    const { service, docs } = setup();
    const scheduled = await service.schedule(company, 'app-1', valid, KEY);
    const id = scheduled.ok ? scheduled.value.interviewId : '';
    expect(
      await service.feedback(company, id, {
        recommendation: 'AVANCAR',
        notes: 'Muito bom',
      }),
    ).toMatchObject({ ok: true });
    expect(
      await service.feedback('cand-1', id, { recommendation: 'AVANCAR' }),
    ).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(
      await service.feedback(company, id, { recommendation: 'TALVEZ' }),
    ).toMatchObject({ ok: false });
    expect(docs.get(`interviewFeedback/${id}_${company}`)).toMatchObject({
      recommendation: 'AVANCAR',
      notes: 'Muito bom',
    });
    const calendar = await service.calendar('cand-1', id);
    expect(calendar.ok && calendar.value.ics).toContain(
      'SUMMARY:Entrevista: Motorista — Transportes X',
    );
    expect(calendar.ok && JSON.stringify(calendar.value.view)).not.toContain(
      'Muito bom',
    );
    expect((await service.calendar(company, id)).ok).toBe(true);
    expect(await service.calendar('other', id)).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    });
  });
});
