import {
  evaluateJobSubmission,
  organizationVerificationOf,
} from '@/domain/jobs/submission';

const now = new Date('2026-10-10T10:00:00Z');
const goodPayload = {
  titulo: 'Contabilista',
  descricao:
    'Procuramos um contabilista para a nossa equipa em São Tomé. Vai acompanhar o fecho mensal de contas, preparar declarações fiscais e apoiar a gestão na análise de custos. Oferecemos formação contínua, ambiente estável e possibilidade de progressão dentro da organização ao longo dos próximos anos.',
  responsabilidades: 'Fecho de contas\nDeclarações fiscais\nRelatórios mensais',
  requisitos: 'Licenciatura em contabilidade\n3 anos de experiência',
  palavrasChave: ['Contabilidade SNC', 'Excel', 'Fiscalidade'],
  localizacao: 'São Tomé',
  remoto: false,
  tipoContrato: 'Tempo Integral',
  salarioDe: '8000',
  salarioAte: '12000',
  dataFecho: '2026-11-15',
  categoria: 'Finanças',
};
const verifiedCompany = {
  verificationStatus: 'verified',
  createdAt: new Date('2025-01-01'),
};
const approvedHistory = [
  {
    id: 'old',
    titulo: 'Motorista',
    status: 'closed',
    publishedAt: new Date('2026-01-01'),
  },
];

const evaluate = (
  overrides: Partial<Parameters<typeof evaluateJobSubmission>[0]> = {},
) =>
  evaluateJobSubmission({
    payload: goodPayload,
    company: verifiedCompany,
    companyCreatedAt: new Date('2025-01-01'),
    existingJobs: approvedHistory,
    platformModerationForced: false,
    now,
    ...overrides,
  });

describe('F1 — avaliação de submissão pelo formulário atual', () => {
  test('vaga completa de empresa verificada com histórico publica', () => {
    const result = evaluate();
    expect(result.decision).toEqual({ kind: 'PUBLISH' });
    expect(result.quality.score).toBeGreaterThanOrEqual(70);
    expect(result.risk.score).toBeLessThan(40);
    expect(result.expand.fields).toMatchObject({
      district: 'agua-grande',
      workMode: 'PRESENCIAL',
      employmentType: 'TEMPO_INTEIRO',
    });
  });

  test('pedido de dinheiro ao candidato (+60) vai para revisão sem caso P1', () => {
    const result = evaluate({
      payload: {
        ...goodPayload,
        descricao: `${goodPayload.descricao} Os candidatos devem pagar uma taxa de inscrição de 500 Db.`,
      },
    });
    expect(result.risk.signals).toEqual(
      expect.arrayContaining(['ASKS_FOR_MONEY']),
    );
    expect(result.decision).toMatchObject({
      kind: 'REVIEW',
      reasons: ['RISK'],
      openModerationCase: false,
    });
  });

  test('dinheiro + promessa de visto (≥ 70) abre caso P1', () => {
    const result = evaluate({
      payload: {
        ...goodPayload,
        descricao: `${goodPayload.descricao} Pagar taxa de inscrição para tratar do visto de trabalho no estrangeiro.`,
      },
      company: {},
    });
    expect(result.risk.score).toBeGreaterThanOrEqual(70);
    expect(result.decision).toMatchObject({
      kind: 'REVIEW',
      openModerationCase: true,
    });
  });

  test('primeira vaga e empresa não verificada vão para revisão', () => {
    expect(evaluate({ existingJobs: [], company: {} }).decision).toMatchObject({
      kind: 'REVIEW',
      reasons: ['ORGANIZATION_NOT_VERIFIED', 'FIRST_JOB'],
    });
  });

  test('duplicado acidental e multi-função bloqueiam', () => {
    expect(
      evaluate({
        existingJobs: [
          ...approvedHistory,
          {
            id: 'dup',
            titulo: 'contabilista',
            status: 'active',
            localizacao: 'Água Grande',
            createdAt: new Date('2026-10-01'),
          },
        ],
      }).decision,
    ).toMatchObject({
      kind: 'BLOCKED',
      code: 'JOB_DUPLICATE',
      duplicateOfJobId: 'dup',
    });
    expect(
      evaluate({
        payload: { ...goodPayload, titulo: 'Contabilista / Motorista' },
      }).decision,
    ).toMatchObject({ code: 'JOB_MULTIPLE_ROLES' });
  });

  test('vaga pobre é bloqueada com o que falta', () => {
    expect(
      evaluate({
        payload: {
          titulo: 'Ajudante',
          descricao: 'Curta.',
          localizacao: 'Neves',
          tipoContrato: 'Contrato',
        },
      }).decision,
    ).toMatchObject({ kind: 'BLOCKED', code: 'JOB_QUALITY_TOO_LOW' });
  });

  test('moderação forçada pela plataforma é respeitada', () => {
    expect(evaluate({ platformModerationForced: true }).decision).toMatchObject(
      {
        kind: 'REVIEW',
        reasons: ['PLATFORM_MODERATION'],
      },
    );
  });

  test('nível de verificação: email verificado não chega para CONTACT_VERIFIED', () => {
    expect(organizationVerificationOf({ emailVerified: true })).toBe(
      'REGISTERED',
    );
    expect(organizationVerificationOf({ verificationStatus: 'approved' })).toBe(
      'ORGANIZATION_VERIFIED',
    );
    expect(
      organizationVerificationOf({ verificationLevel: 'TRUSTED_PARTNER' }),
    ).toBe('TRUSTED_PARTNER');
  });
});
