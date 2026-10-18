import { FirestoreBulkActionService } from '@/infrastructure/firebase/applications/FirestoreBulkActionService';

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

let NOW = 1_960_000_000_000;
const company = 'company-1';

function setup(
  count: number,
  extra: Record<string, Record<string, unknown>> = {},
) {
  const seed: Record<string, Record<string, unknown>> = {
    [`users/${company}`]: { userType: 'empresa' },
    'users/other': { userType: 'empresa' },
    ...extra,
  };
  for (let i = 1; i <= count; i++)
    seed[`applications/app-${i}`] = {
      v2Status: 'UNDER_REVIEW',
      status: 'analysis',
      version: 2,
      organizationId: company,
      candidateUserId: `c${i}`,
      jobId: 'job-1',
      candidateSnapshot: { fullName: `Pessoa${i} Apelido` },
      jobSnapshot: { titulo: 'Motorista', companyName: 'Transportes X' },
      timeline: [],
    };
  const fake = createFakeFirestore(seed);
  return {
    ...fake,
    service: new FirestoreBulkActionService(fake.db, () => NOW),
  };
}
const ids = (n: number) => Array.from({ length: n }, (_, i) => `app-${i + 1}`);

describe('F3.2 — ações em lote', () => {
  beforeEach(() => {
    NOW = 1_960_000_000_000;
  });

  test('preparar diz o número exato e mostra a mensagem; nada muda antes de executar', async () => {
    const { service, docs } = setup(3);
    const prepared = await service.prepare(company, {
      applicationIds: ids(3),
      to: 'REJECTED',
      closedReason: 'NOT_SELECTED',
    });
    expect(prepared).toMatchObject({
      ok: true,
      value: {
        count: 3,
        confirmationText:
          'Vai marcar 3 candidaturas como «Não selecionada» e enviar esta mensagem.',
        messagePreview: expect.stringMatching(
          /^Olá Pessoa1, obrigado pelo interesse na vaga de Motorista na Transportes X\./,
        ),
      },
    });
    expect(docs.get('applications/app-1')).toMatchObject({
      v2Status: 'UNDER_REVIEW',
    });
  });

  test('executar antes dos 10 s é recusado; depois aplica a cada uma com a mensagem personalizada', async () => {
    const { service, docs } = setup(3);
    const prepared = await service.prepare(company, {
      applicationIds: ids(3),
      to: 'REJECTED',
      closedReason: 'NOT_SELECTED',
    });
    const bulkId = prepared.ok ? prepared.value.bulkId : '';
    expect(await service.execute(company, bulkId)).toMatchObject({
      ok: false,
      error: { message: 'Aguarde o fim do período para desfazer.' },
    });
    NOW += 10_000;
    expect(await service.execute(company, bulkId)).toEqual({
      ok: true,
      value: { updated: 3, failed: 0 },
    });
    expect(docs.get('applications/app-2')).toMatchObject({
      v2Status: 'REJECTED',
      closedReason: 'NOT_SELECTED',
    });
    const history = [...docs.entries()]
      .filter(([p]) => p.startsWith('applicationsStatusHistory/'))
      .map(([, d]) => d);
    expect(
      history.find((h) => h.entityId === 'app-2')?.candidateVisibleNote,
    ).toMatch(/^Olá Pessoa2,/);
    expect(
      [...docs.values()].find(
        (d) => d.action === 'applications_bulk_transition',
      ),
    ).toMatchObject({ metadata: { count: 3, updated: 3 } });
    expect(await service.execute(company, bulkId)).toMatchObject({ ok: false });
  });

  test('desfazer dentro dos 10 s: nenhuma mudança e nenhuma mensagem', async () => {
    const { service, docs } = setup(2);
    const prepared = await service.prepare(company, {
      applicationIds: ids(2),
      to: 'SHORTLISTED',
    });
    const bulkId = prepared.ok ? prepared.value.bulkId : '';
    expect(await service.cancel('other', bulkId)).toMatchObject({ ok: false });
    expect(await service.cancel(company, bulkId)).toEqual({
      ok: true,
      value: { status: 'CANCELLED' },
    });
    NOW += 60_000;
    expect(await service.execute(company, bulkId)).toMatchObject({ ok: false });
    expect([...docs.keys()].some((p) => p.startsWith('outboxEvents/'))).toBe(
      false,
    );
  });

  test('≥ 20 exige escrever o número; o gratuito tem até 20 por ação', async () => {
    const { service } = setup(21);
    expect(
      await service.prepare(company, {
        applicationIds: ids(20),
        to: 'SHORTLISTED',
      }),
    ).toMatchObject({
      ok: false,
      error: { message: 'Escreva 20 para confirmar.' },
    });
    expect(
      await service.prepare(company, {
        applicationIds: ids(20),
        to: 'SHORTLISTED',
        typedCount: 20,
      }),
    ).toMatchObject({ ok: true });
    expect(
      await service.prepare(company, {
        applicationIds: ids(21),
        to: 'SHORTLISTED',
        typedCount: 21,
      }),
    ).toMatchObject({
      ok: false,
      error: {
        message:
          'No seu plano, cada ação em lote pode ter até 20 candidaturas.',
      },
    });
  });

  test('rejeitar sem motivo, outra empresa, organizações misturadas', async () => {
    const { service } = setup(2, {
      'applications/foreign': {
        v2Status: 'UNDER_REVIEW',
        organizationId: 'org-b',
        version: 1,
      },
    });
    expect(
      await service.prepare(company, {
        applicationIds: ids(2),
        to: 'REJECTED',
      }),
    ).toMatchObject({ ok: false });
    expect(
      await service.prepare('other', {
        applicationIds: ids(2),
        to: 'SHORTLISTED',
      }),
    ).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(
      await service.prepare(company, {
        applicationIds: [...ids(2), 'foreign'],
        to: 'SHORTLISTED',
      }),
    ).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    });
  });

  test('F3.6: modelos da organização com variáveis permitidas', async () => {
    const { service } = setup(1);
    expect(await service.templates(company, company)).toMatchObject({
      ok: true,
      value: { NOT_SELECTED: expect.stringContaining('{nome}') },
    });
    expect(
      await service.saveTemplates(company, company, {
        NOT_SELECTED: 'Olá {nome}, o motivo foi {motivo} e obrigado.',
      }),
    ).toMatchObject({ ok: false });
    expect(
      await service.saveTemplates(company, company, {
        NOT_SELECTED: 'Olá {nome}, obrigado pelo interesse em {vaga}.',
      }),
    ).toMatchObject({ ok: true });
    const prepared = await service.prepare(company, {
      applicationIds: ids(1),
      to: 'REJECTED',
      closedReason: 'NOT_SELECTED',
    });
    expect(prepared.ok && prepared.value.messagePreview).toBe(
      'Olá Pessoa1, obrigado pelo interesse em Motorista.',
    );
    expect(
      await service.saveTemplates('other', company, { NOT_SELECTED: 'x' }),
    ).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
  });
});
