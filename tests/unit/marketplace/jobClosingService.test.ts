import {
  FirestoreJobClosingService,
  validateCandidateMessage,
} from '@/infrastructure/firebase/jobs/FirestoreJobClosingService';

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

const NOW = Date.parse('2026-10-10T10:00:00Z');
const company = 'company-1';

function setup(
  job: Record<string, unknown>,
  extra: Record<string, Record<string, unknown>> = {},
) {
  const fake = createFakeFirestore({
    [`users/${company}`]: { userType: 'empresa' },
    'users/other': { userType: 'empresa' },
    'jobs/job-1': {
      titulo: 'Motorista',
      companyId: company,
      companyName: 'Transportes X',
      status: 'active',
      ...job,
    },
    ...extra,
  });
  return {
    ...fake,
    service: new FirestoreJobClosingService(
      fake.db,
      { enabled: async () => true },
      { environment: 'production' },
      () => NOW,
    ),
  };
}

describe('F1.9 — fecho de vaga com resultado obrigatório', () => {
  test('vaga legada: fecha, marca o fim e não cria v2Status', async () => {
    const { service, docs } = setup({});
    expect(await service.close(company, 'job-1', {})).toMatchObject({
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        message: 'Indique o resultado do processo.',
      },
    });
    const result = await service.close(company, 'job-1', {
      closeOutcome: 'NO_SUITABLE_CANDIDATE',
      improvement: 'Mais candidatos de Príncipe',
    });
    expect(result).toMatchObject({
      ok: true,
      value: {
        status: 'CLOSED',
        openApplicationsCloseAfter: '2026-10-17T10:00:00.000Z',
      },
    });
    expect(docs.get('jobs/job-1')).toMatchObject({
      status: 'closed',
      closeOutcome: 'NO_SUITABLE_CANDIDATE',
      jobEndState: 'CLOSED',
      jobEndPending: true,
      closeFeedback: 'Mais candidatos de Príncipe',
    });
    expect(docs.get('jobs/job-1')).not.toHaveProperty('v2Status');
  });

  test('vaga v2: transição validada, versão e histórico', async () => {
    const { service, docs } = setup({
      v2Status: 'PAUSED',
      status: 'inactive',
      version: 4,
    });
    expect(
      await service.close(company, 'job-1', {
        closeOutcome: 'POSITION_CANCELLED',
      }),
    ).toMatchObject({ ok: true });
    expect(docs.get('jobs/job-1')).toMatchObject({
      v2Status: 'CLOSED',
      status: 'closed',
      version: 5,
    });
    const history = [...docs.entries()]
      .filter(([p]) => p.startsWith('jobsStatusHistory/'))
      .map(([, d]) => d);
    expect(history).toEqual([
      expect.objectContaining({
        from: 'PAUSED',
        to: 'CLOSED',
        reason: 'POSITION_CANCELLED',
      }),
    ]);
  });

  test('«contratado via EmpregoSTP» exige contratação registada; «outro» exige texto', async () => {
    const { service } = setup({});
    expect(
      await service.close(company, 'job-1', {
        closeOutcome: 'HIRED_VIA_EMPREGOSTP',
      }),
    ).toMatchObject({
      ok: false,
      error: {
        code: 'TRANSITION_GUARD_FAILED',
        message: 'Selecione primeiro o candidato contratado no processo.',
      },
    });
    expect(
      await service.close(company, 'job-1', { closeOutcome: 'OTHER' }),
    ).toMatchObject({ ok: false });
    const hired = setup(
      {},
      { 'hires/a1': { jobId: 'job-1', status: 'ACTIVE' } },
    );
    expect(
      await hired.service.close(company, 'job-1', {
        closeOutcome: 'HIRED_VIA_EMPREGOSTP',
      }),
    ).toMatchObject({ ok: true });
  });

  test('outra empresa não fecha; vaga já fechada não volta a fechar', async () => {
    expect(
      await setup({}).service.close('other', 'job-1', {
        closeOutcome: 'OTHER',
        otherText: 'x y z',
      }),
    ).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(
      await setup({ status: 'closed' }).service.close(company, 'job-1', {
        closeOutcome: 'POSITION_ON_HOLD',
      }),
    ).toMatchObject({
      ok: false,
      error: { code: 'INVALID_TRANSITION' },
    });
  });

  test('F3.8: «preenchida» só depois da proposta do sistema', async () => {
    expect(
      await setup({}).service.confirmFilled(company, 'job-1'),
    ).toMatchObject({ ok: false, error: { code: 'TRANSITION_GUARD_FAILED' } });
    const { service, docs } = setup({
      v2Status: 'PUBLISHED',
      version: 2,
      fillProposedAt: NOW,
    });
    expect(await service.confirmFilled(company, 'job-1')).toMatchObject({
      ok: true,
      value: { status: 'FILLED' },
    });
    expect(docs.get('jobs/job-1')).toMatchObject({
      v2Status: 'FILLED',
      status: 'closed',
      jobEndState: 'FILLED',
      closeOutcome: 'HIRED_VIA_EMPREGOSTP',
    });
  });

  test('mensagem aos candidatos: pré-visualização e confirmação dentro dos 7 dias', async () => {
    const { service, docs } = setup({ status: 'closed', jobEndPending: true });
    expect(
      await service.previewClosingMessage(company, 'job-1', undefined),
    ).toMatchObject({
      ok: true,
      value: {
        preview: expect.stringMatching(
          /^Olá Ana, o processo de recrutamento para Motorista foi encerrado\./,
        ),
      },
    });
    expect(
      await service.confirmClosingMessage(
        company,
        'job-1',
        'Olá {nome}, o motivo é {motivo} e mais texto',
      ),
    ).toMatchObject({ ok: false });
    expect(
      await service.confirmClosingMessage(
        company,
        'job-1',
        'Olá {nome}, obrigado pela candidatura a {vaga}.',
      ),
    ).toMatchObject({ ok: true });
    expect(docs.get('jobs/job-1')).toMatchObject({
      jobEndMessageConfirmed: true,
      jobEndMessage: 'Olá {nome}, obrigado pela candidatura a {vaga}.',
    });
    expect(validateCandidateMessage('curta')).toBeNull();
  });
});
