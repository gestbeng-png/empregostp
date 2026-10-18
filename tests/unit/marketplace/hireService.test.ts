import {
  hireFollowUpStage,
  parseStartDate,
  positionsSummary,
} from '@/domain/hires/confirmation';
import { FirestoreHireService } from '@/infrastructure/firebase/hires/FirestoreHireService';

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
const DAY = 86_400_000;
const company = 'company-1';

function setup(
  apps: Record<string, Record<string, unknown>>,
  extra: Record<string, Record<string, unknown>> = {},
) {
  const seed: Record<string, Record<string, unknown>> = {
    [`users/${company}`]: { userType: 'empresa' },
    'users/other': { userType: 'empresa' },
    'users/admin-1': { userType: 'admin' },
    'users/cand-1': { userType: 'candidato' },
    'jobs/job-1': {
      titulo: 'Operador',
      vagasDisponiveis: 2,
      companyId: company,
    },
    ...extra,
  };
  for (const [id, data] of Object.entries(apps))
    seed[`applications/${id}`] = {
      status: 'analysis',
      version: 2,
      organizationId: company,
      jobId: 'job-1',
      candidateUserId: 'cand-1',
      source: 'whatsapp',
      ...data,
    };
  const fake = createFakeFirestore(seed);
  return {
    ...fake,
    service: new FirestoreHireService(fake.db, () => NOW),
  };
}
const all = (docs: Map<string, Record<string, unknown>>, prefix: string) =>
  [...docs.entries()].filter(([p]) => p.startsWith(prefix)).map(([, d]) => d);

describe('E5/F3.8 — contratações', () => {
  beforeEach(() => {
    NOW = Date.parse('2026-10-10T10:00:00Z');
  });

  test('marcação direta: HIRED, Hire com origem, «1 de 2 posições»; repetir é idempotente', async () => {
    const { service, docs } = setup({ a1: { v2Status: 'INTERVIEW' } });
    const result = await service.markHired(company, 'a1', {
      startDate: '2026-11-02',
    });
    expect(result).toMatchObject({
      ok: true,
      value: {
        replayed: false,
        positions: '1 de 2 posições preenchidas',
        proposeFilled: false,
      },
    });
    expect(docs.get('applications/a1')).toMatchObject({
      v2Status: 'HIRED',
      status: 'approved',
      version: 3,
    });
    expect(docs.get('hires/a1')).toMatchObject({
      source: 'DIRECT_MARK',
      attributionSource: 'whatsapp',
      candidateConfirmation: 'PENDING',
      status: 'ACTIVE',
      organizationId: company,
    });
    expect(await service.markHired(company, 'a1', {})).toMatchObject({
      ok: true,
      value: { replayed: true },
    });
    expect(all(docs, 'hires/')).toHaveLength(1);
  });

  test('a 2.ª contratação completa as posições e PROPÕE «preenchida» (não fecha)', async () => {
    const { service, docs } = setup({
      a1: { v2Status: 'SHORTLISTED' },
      a2: { v2Status: 'UNDER_REVIEW', candidateUserId: 'cand-2' },
    });
    await service.markHired(company, 'a1', {});
    const second = await service.markHired(company, 'a2', {});
    expect(second).toMatchObject({
      ok: true,
      value: { positions: '2 de 2 posições preenchidas', proposeFilled: true },
    });
    expect(docs.get('jobs/job-1')).toMatchObject({
      hiresCount: 2,
      fillProposedAt: expect.anything(),
    });
    expect(docs.get('jobs/job-1')?.status).toBeUndefined();
    expect(
      all(docs, 'applicationsStatusHistory/')
        .filter((h) => h.entityId === 'a2')
        .map((h) => h.to),
    ).toEqual(['SHORTLISTED', 'HIRED']);
  });

  test('proposta: só depois de aceite pelo candidato', async () => {
    const pending = setup({ a1: { v2Status: 'OFFER' } });
    expect(await pending.service.markHired(company, 'a1', {})).toMatchObject({
      ok: false,
      error: { code: 'TRANSITION_GUARD_FAILED' },
    });
    const accepted = setup(
      { a1: { v2Status: 'OFFER' } },
      { 'offers/o1': { applicationId: 'a1', v2Status: 'ACCEPTED' } },
    );
    expect(await accepted.service.markHired(company, 'a1', {})).toMatchObject({
      ok: true,
    });
    expect(accepted.docs.get('hires/a1')).toMatchObject({ source: 'OFFER' });
  });

  test('outra empresa, estado terminal e data inválida', async () => {
    const { service } = setup({
      a1: { v2Status: 'INTERVIEW' },
      a2: { v2Status: 'WITHDRAWN' },
    });
    expect(await service.markHired('other', 'a1', {})).toMatchObject({
      ok: false,
      error: { code: 'FORBIDDEN' },
    });
    expect(await service.markHired(company, 'a2', {})).toMatchObject({
      ok: false,
      error: { code: 'INVALID_TRANSITION' },
    });
    expect(
      await service.markHired(company, 'a1', { startDate: '2026-02-31' }),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
  });

  test('confirmação aos 30 dias, NO_RESPONSE aos 14 e disputa → caso P3', async () => {
    const { service, docs } = setup({ a1: { v2Status: 'INTERVIEW' } });
    await service.markHired(company, 'a1', {});
    NOW += 29 * DAY;
    expect(await service.followUp()).toEqual({ requested: 0, noResponse: 0 });
    NOW += 1 * DAY;
    expect(await service.followUp()).toEqual({ requested: 1, noResponse: 0 });
    expect(
      all(docs, 'outboxEvents/').filter(
        (e) => e.type === 'hire_confirmation_request',
      ),
    ).toHaveLength(1);
    NOW += 14 * DAY;
    expect(await service.followUp()).toEqual({ requested: 0, noResponse: 1 });
    expect(docs.get('hires/a1')).toMatchObject({
      candidateConfirmation: 'NO_RESPONSE',
    });
    expect(
      await service.candidateRespond('cand-9', 'a1', 'CONFIRMED'),
    ).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(
      await service.candidateRespond('cand-1', 'a1', 'DISPUTED'),
    ).toMatchObject({ ok: true });
    expect(all(docs, 'moderationCases/')).toEqual([
      expect.objectContaining({ priority: 'P3', targetId: 'a1' }),
    ]);
  });

  test('anulação só pelo admin, com motivo; candidatura → REJECTED/HIRE_ANNULLED; auditada', async () => {
    const { service, docs } = setup({ a1: { v2Status: 'INTERVIEW' } });
    await service.markHired(company, 'a1', {});
    expect(await service.annul(company, 'a1', 'erro')).toMatchObject({
      ok: false,
      error: { code: 'FORBIDDEN' },
    });
    expect(await service.annul('admin-1', 'a1', '')).toMatchObject({
      ok: false,
      error: { code: 'TRANSITION_GUARD_FAILED' },
    });
    expect(
      await service.annul('admin-1', 'a1', 'Contratação registada por engano'),
    ).toMatchObject({ ok: true });
    expect(docs.get('applications/a1')).toMatchObject({
      v2Status: 'REJECTED',
      closedReason: 'HIRE_ANNULLED',
    });
    expect(all(docs, 'auditLogs/')).toEqual([
      expect.objectContaining({ action: 'hire_annulled', resourceId: 'a1' }),
    ]);
  });

  test('funções puras', () => {
    expect(positionsSummary(1, 0).label).toBe('Posição por preencher');
    expect(positionsSummary(1, 1)).toEqual({
      label: 'Posição preenchida',
      proposeFilled: true,
    });
    expect(parseStartDate('', new Date())).toBeNull();
    expect(parseStartDate('2030-01-01', new Date('2026-10-10'))).toBe(
      'INVALID',
    );
    expect(
      hireFollowUpStage(
        {
          status: 'ANNULLED',
          candidateConfirmation: 'PENDING',
          startDate: null,
          confirmedByEmployerAt: new Date(0),
          confirmationRequestedAt: null,
        },
        new Date(),
      ),
    ).toBeNull();
  });
});
