import { SubmitReport } from '@/application/reports/SubmitReport';
import type {
  NewReport,
  ReportOutcome,
} from '@/application/reports/SubmitReport';

const NOW = new Date('2026-10-09T10:00:00Z');

function setup(
  options: { flag?: boolean; allowed?: boolean; outcome?: ReportOutcome } = {},
) {
  const submitted: NewReport[] = [];
  const useCase = new SubmitReport(
    {
      enabled: async (key) => key === 'V2_MODERATION' && options.flag !== false,
    },
    {
      submit: async (report) => {
        submitted.push(report);
        return (
          options.outcome ?? {
            kind: 'CREATED',
            reportId: 'r1',
            targetHidden: true,
          }
        );
      },
    },
    async () => options.allowed !== false,
    () => NOW,
  );
  return { useCase, submitted };
}
const ctx = { environment: 'production' as const };
const valid = {
  reporterUserId: 'u1',
  reporterRole: 'CANDIDATE' as const,
  targetType: 'JOB',
  targetId: 'job1',
  reason: 'ASKED_FOR_MONEY',
  details: '  Pediram 500 Db de inscrição  ',
};

describe('E9 — SubmitReport', () => {
  test('flag desligada: nada é gravado', async () => {
    const { useCase, submitted } = setup({ flag: false });
    expect(await useCase.execute(valid, ctx)).toEqual({
      ok: false,
      code: 'FEATURE_DISABLED',
    });
    expect(submitted).toHaveLength(0);
  });

  test('grava com prioridade, SLA e detalhes aparados; nunca revela a ocultação', async () => {
    const { useCase, submitted } = setup();
    const result = await useCase.execute(valid, ctx);
    expect(result).toEqual({
      ok: true,
      reportId: 'r1',
      alreadyReported: false,
    });
    expect(result).not.toHaveProperty('targetHidden');
    expect(submitted[0]).toMatchObject({
      priority: 'P1',
      details: 'Pediram 500 Db de inscrição',
      dueAt: new Date('2026-10-10T10:00:00Z'),
    });
  });

  test.each([
    [{ targetType: 'NOPE' }],
    [{ targetId: '../x' }],
    [{ targetId: 42 }],
    [{ reason: 'MEAN' }],
    [{ details: { html: '<b>' } }],
  ])('entrada inválida %p', async (patch) => {
    const { useCase, submitted } = setup();
    expect(await useCase.execute({ ...valid, ...patch }, ctx)).toEqual({
      ok: false,
      code: 'INVALID_INPUT',
    });
    expect(submitted).toHaveLength(0);
  });

  test('limite diário (D13) e alvo inexistente', async () => {
    expect(await setup({ allowed: false }).useCase.execute(valid, ctx)).toEqual(
      {
        ok: false,
        code: 'RATE_LIMITED',
      },
    );
    expect(
      await setup({ outcome: { kind: 'TARGET_NOT_FOUND' } }).useCase.execute(
        valid,
        ctx,
      ),
    ).toEqual({ ok: false, code: 'NOT_FOUND' });
  });

  test('repetir a denúncia é idempotente', async () => {
    expect(
      await setup({
        outcome: { kind: 'ALREADY_REPORTED', reportId: 'r1' },
      }).useCase.execute(valid, ctx),
    ).toEqual({ ok: true, reportId: 'r1', alreadyReported: true });
  });

  test.each(['MODERATOR', 'ADMIN', 'REVIEWER', 'SUPPORT', 'NONE'] as const)(
    'H3: %s não abre denúncias',
    async (reporterRole) => {
      const { useCase, submitted } = setup();
      expect(await useCase.execute({ ...valid, reporterRole }, ctx)).toEqual({
        ok: false,
        code: 'FORBIDDEN',
      });
      expect(submitted).toHaveLength(0);
    },
  );

  test.each([
    'CANDIDATE',
    'OWNER',
    'ORG_ADMIN',
    'RECRUITER',
    'ORG_REVIEWER',
  ] as const)('H3: %s pode denunciar', async (reporterRole) => {
    expect(
      (await setup().useCase.execute({ ...valid, reporterRole }, ctx)).ok,
    ).toBe(true);
  });
});
