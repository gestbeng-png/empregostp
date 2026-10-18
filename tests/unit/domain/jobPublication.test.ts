import { planJobBackfillWrite, planJobExpand } from '@/domain/jobs/expand';
import { detectMultipleRoles } from '@/domain/jobs/multiRole';
import {
  decidePublication,
  findAccidentalDuplicate,
  normalizeJobTitle,
} from '@/domain/jobs/publication';
import type { QualityResult } from '@/domain/jobs/qualityScore';
import type { RiskResult } from '@/domain/jobs/riskScore';
import {
  mapLegacyCategory,
  mapLegacyEducation,
  mapLegacyEmploymentType,
  mapLegacySeniority,
} from '@/domain/jobs/taxonomy';

const quality = (score: number): QualityResult => ({
  score,
  band: score < 50 ? 'BLOCKED' : score < 70 ? 'PUBLISHABLE' : 'COMPLETE',
  breakdown: {} as QualityResult['breakdown'],
  missing: [{ criterion: 'SALARY', points: 15, label: 'Divulgue o salário' }],
});
const risk = (score: number): RiskResult => ({
  score,
  signals: [],
  requiresReview: score >= 40,
  openP1Case: score >= 70,
});
const base = {
  multiRole: detectMultipleRoles('Contabilista'),
  quality: quality(75),
  risk: risk(0),
  organizationVerification: 'CONTACT_VERIFIED' as const,
  organizationHasApprovedJob: true,
  duplicateOfJobId: null,
  platformModerationForced: false,
};

describe('E3 — decisão de publicação', () => {
  test('vaga completa de organização verificada com histórico publica', () => {
    expect(decidePublication(base)).toEqual({ kind: 'PUBLISH' });
  });

  test('F1.1: várias funções bloqueiam com proposta de divisão', () => {
    expect(
      decidePublication({
        ...base,
        multiRole: detectMultipleRoles('Motorista / Cozinheiro'),
      }),
    ).toMatchObject({
      kind: 'BLOCKED',
      code: 'JOB_MULTIPLE_ROLES',
      message:
        'Cada anúncio deve corresponder a uma única função. Crie uma vaga para cada função.',
      splitTitles: ['Motorista', 'Cozinheiro'],
    });
  });

  test('F1.2: qualidade < 50 bloqueia com o que falta', () => {
    expect(decidePublication({ ...base, quality: quality(49) })).toMatchObject({
      kind: 'BLOCKED',
      code: 'JOB_QUALITY_TOO_LOW',
      missing: [{ criterion: 'SALARY' }],
    });
    expect(decidePublication({ ...base, quality: quality(50) }).kind).toBe(
      'PUBLISH',
    );
  });

  test('F1.13: duplicado acidental bloqueia antes da qualidade', () => {
    expect(
      decidePublication({
        ...base,
        quality: quality(10),
        duplicateOfJobId: 'j9',
      }),
    ).toMatchObject({ code: 'JOB_DUPLICATE', duplicateOfJobId: 'j9' });
  });

  test('primeira vaga vai sempre para revisão', () => {
    expect(
      decidePublication({ ...base, organizationHasApprovedJob: false }),
    ).toEqual({
      kind: 'REVIEW',
      reasons: ['FIRST_JOB'],
      openModerationCase: false,
    });
  });

  test('risco ≥ 40 revê; ≥ 70 abre caso P1; organização não verificada revê', () => {
    expect(decidePublication({ ...base, risk: risk(40) })).toMatchObject({
      kind: 'REVIEW',
      reasons: ['RISK'],
      openModerationCase: false,
    });
    expect(decidePublication({ ...base, risk: risk(70) })).toMatchObject({
      openModerationCase: true,
    });
    expect(
      decidePublication({ ...base, organizationVerification: 'REGISTERED' }),
    ).toMatchObject({ reasons: ['ORGANIZATION_NOT_VERIFIED'] });
    expect(
      decidePublication({ ...base, platformModerationForced: true }),
    ).toMatchObject({
      reasons: ['PLATFORM_MODERATION'],
    });
  });

  test('título duvidoso encaminha para revisão em vez de bloquear', () => {
    const review = detectMultipleRoles('Técnico, Redes');
    if (review.verdict === 'REVIEW')
      expect(decidePublication({ ...base, multiRole: review })).toMatchObject({
        reasons: ['TITLE_REVIEW'],
      });
  });
});

describe('F1.13 — duplicados acidentais', () => {
  const now = new Date('2026-10-10T00:00:00Z');
  const existing = [
    {
      id: 'a',
      title: 'Contabilista Sénior!',
      district: 'agua-grande',
      status: 'PUBLISHED',
      createdAt: new Date('2026-09-20T00:00:00Z'),
    },
    {
      id: 'b',
      title: 'Motorista',
      district: 'lobata',
      status: 'CLOSED',
      createdAt: new Date('2026-10-01T00:00:00Z'),
    },
    {
      id: 'c',
      title: 'Cozinheiro',
      district: null,
      status: 'PENDING_REVIEW',
      createdAt: new Date('2026-08-01T00:00:00Z'),
    },
  ];
  test('mesmo título normalizado + distrito + aberta nos últimos 30 dias', () => {
    expect(
      findAccidentalDuplicate(
        { title: 'contabilista senior', district: 'agua-grande' },
        existing,
        now,
      ),
    ).toBe('a');
  });
  test('outro distrito, fechada ou antiga não contam', () => {
    expect(
      findAccidentalDuplicate(
        { title: 'Contabilista Sénior', district: 'lobata' },
        existing,
        now,
      ),
    ).toBeNull();
    expect(
      findAccidentalDuplicate(
        { title: 'Motorista', district: 'lobata' },
        existing,
        now,
      ),
    ).toBeNull();
    expect(
      findAccidentalDuplicate(
        { title: 'Cozinheiro', district: null },
        existing,
        now,
      ),
    ).toBeNull();
  });
  test('normalização', () => {
    expect(normalizeJobTitle('  Técnico(a) de Informática — Sénior ')).toBe(
      'tecnico a de informatica senior',
    );
  });
});

describe('B9/B10 — correspondência com o formulário atual', () => {
  test.each([
    ['Marketing Digital', 'comunicacao-marketing'],
    ['Programação', 'tecnologias-informacao'],
    ['Gestão e Administração', 'administracao-secretariado'],
    ['Finanças', 'contabilidade-financas'],
    ['Jurídico', 'direito'],
    ['Saúde', 'saude'],
    ['Turismo', 'turismo'],
    ['Engenharia', null],
    ['Astronomia', null],
    ['', null],
  ])('categoria %s → %s', (legacy, slug) => {
    expect(mapLegacyCategory(legacy)).toBe(slug);
  });
  test.each([
    ['Tempo Integral', 'TEMPO_INTEIRO'],
    ['Meio Período', 'TEMPO_PARCIAL'],
    ['Contrato', 'CONTRATO_TERMO'],
    ['Estágio', 'ESTAGIO'],
    ['Freelance', 'FREELANCE'],
    ['Voluntariado', 'VOLUNTARIADO'],
    ['CONSULTORIA', 'CONSULTORIA'],
    ['Biscate', null],
  ])('contrato %s → %s', (legacy, value) => {
    expect(mapLegacyEmploymentType(legacy)).toBe(value);
  });
  test('senioridade e formação', () => {
    expect(mapLegacySeniority('Júnior (0-2 anos)')).toBe('JUNIOR');
    expect(mapLegacySeniority('Pleno (2-5 anos)')).toBe('INTERMEDIO');
    expect(mapLegacySeniority('Sénior (5+ anos)')).toBe('SENIOR');
    expect(mapLegacySeniority('Especialista')).toBeNull();
    expect(mapLegacyEducation('Ensino Secundário')).toBe('ENSINO_SECUNDARIO');
    expect(mapLegacyEducation('Não exigido')).toBe('NENHUM');
  });
});

describe('D7 — expand de vagas legadas', () => {
  test('vaga típica: distrito, salário em cêntimos, prazo STP e revisão do período', () => {
    const plan = planJobExpand({
      titulo: 'Contabilista',
      status: 'active',
      companyId: 'u1',
      localizacao: 'Neves',
      salarioDe: '5.000',
      salarioAte: '8000',
      tipoContrato: 'Tempo Integral',
      categoria: 'Finanças',
      dataFecho: '2026-11-15',
      vagasDisponiveis: '3',
      createdAt: new Date('2026-09-01T00:00:00Z'),
    });
    expect(plan.fields).toMatchObject({
      v2Status: 'PUBLISHED',
      version: 1,
      organizationId: 'u1',
      district: 'lemba',
      salaryType: 'RANGE',
      salaryMinMinor: 500000,
      salaryMaxMinor: 800000,
      salaryCurrency: 'STN',
      salaryPeriod: null,
      employmentType: 'TEMPO_INTEIRO',
      categoryId: 'contabilidade-financas',
      vacanciesCount: 3,
      applicationMethod: 'INTERNAL',
      applicationDeadline: new Date('2026-11-15T23:59:59.999Z'),
    });
    expect(plan.review).toEqual(['SALARY_PERIOD_MISSING']);
  });

  test('salário ≥ 1 000 000 após 2018 não é convertido às cegas', () => {
    const plan = planJobExpand({
      titulo: 'Gestor',
      localizacao: 'São Tomé',
      salarioDe: '3000000',
      tipoContrato: 'Contrato',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    expect(plan.fields.salaryNeedsReview).toBe(true);
    expect(plan.review).toContain('SALARY_SUSPECT_STD');
  });

  test('ambíguos vão para revisão; títulos multi-função só são marcados', () => {
    const plan = planJobExpand({
      titulo: 'Motorista / Cozinheiro',
      localizacao: 'São Tomé e Príncipe',
      salarioDe: 'a combinar',
      tipoContrato: 'Biscate',
      categoria: 'Engenharia',
      salarioAte: '1000',
    });
    expect(plan.review).toEqual(
      expect.arrayContaining([
        'LOCATION_UNMAPPED',
        'SALARY_UNPARSEABLE',
        'CATEGORY_UNMAPPED',
        'CONTRACT_UNMAPPED',
        'MULTI_ROLE_TITLE',
      ]),
    );
    expect(plan.fields.district).toBeNull();
    expect(plan.fields.legacyLocation).toBe('São Tomé e Príncipe');
  });

  test('remoto conta como localização; estado v2 existente é respeitado', () => {
    const plan = planJobExpand({
      remoto: true,
      v2Status: 'PAUSED',
      version: 7,
      tipoContrato: 'Freelance',
    });
    expect(plan.fields).toMatchObject({
      workMode: 'REMOTO',
      v2Status: 'PAUSED',
      version: 7,
    });
    expect(plan.review).not.toContain('LOCATION_UNMAPPED');
  });
});

describe('D7 migrate — o backfill só acrescenta', () => {
  test('nunca sobrescreve campos existentes, legados ou v2', () => {
    const write = planJobBackfillWrite({
      status: 'active',
      localizacao: 'Neves',
      district: 'caue',
      v2Status: 'PAUSED',
      version: 9,
      tipoContrato: 'Estágio',
    });
    expect(write?.set).not.toHaveProperty('district');
    expect(write?.set).not.toHaveProperty('v2Status');
    expect(write?.set).not.toHaveProperty('version');
    expect(write?.set).not.toHaveProperty('status');
    expect(write?.set).not.toHaveProperty('localizacao');
    expect(write?.set).toMatchObject({
      employmentType: 'ESTAGIO',
      expandVersion: 1,
    });
  });
  test('idempotente: vaga já expandida não é tocada', () => {
    expect(planJobBackfillWrite({ expandVersion: 1 })).toBeNull();
  });
});
