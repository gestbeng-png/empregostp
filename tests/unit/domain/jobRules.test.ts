import {
  computeExpiresAt,
  deadlineToUtc,
  dueExpiryWarning,
  extensionCost,
  formatDeadline,
  formatStpDate,
  isAcceptingApplications,
} from '@/domain/jobs/deadlines';
import { detectMultipleRoles } from '@/domain/jobs/multiRole';
import type { QualityInput } from '@/domain/jobs/qualityScore';
import { computeQualityScore } from '@/domain/jobs/qualityScore';
import type { RiskInput } from '@/domain/jobs/riskScore';
import {
  computeRiskScore,
  EMPLOYER_REVIEW_MESSAGE,
} from '@/domain/jobs/riskScore';

describe('F1.1 — uma função por vaga', () => {
  it.each([
    'Gestor(a) de Redes Sociais (Social Media Manager)',
    'Técnico de Redes e Sistemas',
    'Empregado/a de Mesa',
    'Contabilista Sénior',
    'Assistente Administrativo',
    'Motorista de Pesados',
  ])('%s → uma função', (title) => {
    expect(detectMultipleRoles(title).verdict).toBe('SINGLE');
  });

  it.each([
    ['Contabilista / Secretária', ['Contabilista', 'Secretária']],
    [
      'Motorista, Segurança, Jardineiro',
      ['Motorista', 'Segurança', 'Jardineiro'],
    ],
    ['Rececionista e Empregado de Mesa', ['Rececionista', 'Empregado de Mesa']],
    [
      'Cozinheiro ou Ajudante de Cozinha',
      ['Cozinheiro', 'Ajudante de Cozinha'],
    ],
  ])('%s → várias funções, com sugestão de divisão', (title, parts) => {
    expect(detectMultipleRoles(title)).toEqual({ verdict: 'MULTIPLE', parts });
  });

  it('caso duvidoso vai para revisão em vez de bloquear', () => {
    expect(
      detectMultipleRoles('Técnico de Manutenção / Refrigeração').verdict,
    ).toBe('REVIEW');
  });
});

const complete: QualityInput = {
  title: 'Contabilista Sénior',
  description: 'x'.repeat(320),
  responsibilities: ['a', 'b', 'c'],
  requirements: ['a', 'b'],
  skills: ['Excel', 'SNC', 'IVA'],
  salaryType: 'RANGE',
  district: 'agua-grande',
  workMode: 'PRESENCIAL',
  employmentType: 'TEMPO_INTEIRO',
  applicationDeadline: new Date('2026-11-15T23:59:59.999Z'),
  organizationVerification: 'ORGANIZATION_VERIFIED',
};

describe('F1.2 — quality score', () => {
  it('a vaga completa soma 100 pontos', () => {
    const result = computeQualityScore(complete);
    expect(result.score).toBe(100);
    expect(result.band).toBe('COMPLETE');
    expect(result.missing).toEqual([]);
  });

  it.each([
    [{ title: 'CONTABILISTA SÉNIOR' }, 'TITLE', 10],
    [{ title: 'Contabilista / Secretária' }, 'TITLE', 10],
    [{ title: 'Contabil 🔥 Sénior' }, 'TITLE', 10],
    [{ title: 'Caixa' }, 'TITLE', 10],
    [{ description: '<p>' + 'x'.repeat(299) + '</p>' }, 'DESCRIPTION', 15],
    [{ responsibilities: ['a', 'b', ' '] }, 'RESPONSIBILITIES', 10],
    [{ requirements: ['a'] }, 'REQUIREMENTS', 10],
    [{ skills: ['Excel', 'SNC'] }, 'SKILLS', 10],
    [{ salaryType: 'NEGOTIABLE' as const }, 'SALARY', 10],
    [{ salaryType: 'UNDISCLOSED' as const }, 'SALARY', 15],
    [{ workMode: null }, 'LOCATION_MODE', 10],
    [{ employmentType: null }, 'CONTRACT', 5],
    [{ applicationDeadline: null }, 'DEADLINE', 5],
    [
      { organizationVerification: 'CONTACT_VERIFIED' as const },
      'ORGANIZATION',
      5,
    ],
    [{ organizationVerification: 'REGISTERED' as const }, 'ORGANIZATION', 10],
  ])('%o perde %s (%i)', (change, criterion, lost) => {
    const result = computeQualityScore({ ...complete, ...change });
    expect(result.score).toBe(100 - lost);
    expect(result.missing[0]).toMatchObject({ criterion, points: lost });
  });

  it('bandas: < 50 bloqueia, 50–69 publica com sugestões, ≥ 70 completa', () => {
    const empty: QualityInput = {
      ...complete,
      description: '',
      responsibilities: [],
      requirements: [],
      skills: [],
      salaryType: 'UNDISCLOSED',
    };
    expect(computeQualityScore(empty)).toMatchObject({
      score: 40,
      band: 'BLOCKED',
    });
    expect(
      computeQualityScore({ ...empty, skills: ['a', 'b', 'c'] }).band,
    ).toBe('PUBLISHABLE');
    const missing = computeQualityScore(empty).missing.map(
      (item) => item.points,
    );
    expect(missing).toEqual([...missing].sort((a, b) => b - a));
  });
});

const now = new Date('2026-10-08T10:00:00Z');
const safe: RiskInput = {
  text: 'Contabilista. Responsável pela contabilidade da empresa.',
  applicationMethod: 'INTERNAL',
  contactEmail: 'rh@empresa.st',
  mentionsPersonalPhoneOrWhatsapp: false,
  links: [],
  salaryOutsideSanity: false,
  organizationVerification: 'CONTACT_VERIFIED',
  organizationCreatedAt: new Date('2026-01-01T00:00:00Z'),
  now,
  duplicateSimilarity: 0,
};

describe('F1.6 — riskScore', () => {
  it('vaga normal: 0, publica', () => {
    expect(computeRiskScore(safe)).toEqual({
      score: 0,
      signals: [],
      requiresReview: false,
      openP1Case: false,
    });
  });

  it.each([
    ['É necessário pagar uma taxa de inscrição de 500 Db.', 60],
    ['Enviar o comprovativo de depósito via Western Union.', 60],
    ['Les candidats doivent payer les frais d’inscription.', 60],
    ['Registration fee required before the interview.', 60],
  ])('pedido de dinheiro (%s) → +60, revisão', (text, score) => {
    const result = computeRiskScore({ ...safe, text });
    expect(result.signals).toContain('ASKS_FOR_MONEY');
    expect(result.score).toBe(score);
    expect(result.requiresReview).toBe(true);
  });

  it('dinheiro + estrangeiro + BI → caso P1', () => {
    const result = computeRiskScore({
      ...safe,
      text: 'Emprego no estrangeiro com visto. Pagar taxa e enviar cópia do BI e NIB.',
    });
    expect(result.signals).toEqual(
      expect.arrayContaining([
        'ASKS_FOR_MONEY',
        'ABROAD_WITH_COSTS',
        'IDENTITY_OR_BANK_DOCUMENTS',
      ]),
    );
    expect(result).toMatchObject({ score: 100, openP1Case: true });
  });

  it('contacto pessoal, email gratuito, link encurtado, salário, organização nova e duplicado', () => {
    const result = computeRiskScore({
      ...safe,
      applicationMethod: 'EXTERNAL_EMAIL',
      contactEmail: 'vagas.st@gmail.com',
      mentionsPersonalPhoneOrWhatsapp: true,
      organizationVerification: 'REGISTERED',
      links: ['https://bit.ly/abc'],
      salaryOutsideSanity: true,
      organizationCreatedAt: new Date(now.getTime() - 3_600_000),
      duplicateSimilarity: 0.93,
    });
    expect(result.signals.sort()).toEqual(
      [
        'DUPLICATE_CONTENT',
        'FREE_EMAIL_UNVERIFIED_ORG',
        'NEW_ORGANIZATION',
        'PERSONAL_CONTACT_ONLY',
        'SALARY_OUT_OF_RANGE',
        'SHORT_OR_BLOCKED_LINK',
      ].sort(),
    );
    expect(result.score).toBe(15 + 10 + 25 + 15 + 10 + 20);
  });

  it('verificação reduz o risco, nunca abaixo de 0', () => {
    expect(
      computeRiskScore({
        ...safe,
        text: 'Pagar caução.',
        organizationVerification: 'ORGANIZATION_VERIFIED',
      }).score,
    ).toBe(40);
    expect(
      computeRiskScore({ ...safe, organizationVerification: 'TRUSTED_PARTNER' })
        .score,
    ).toBe(0);
  });

  it('palavras inteiras: «pagamento mensal» não é «pagar»', () => {
    expect(
      computeRiskScore({ ...safe, text: 'Pagamento mensal ao trabalhador.' })
        .score,
    ).toBe(0);
  });

  it('o empregador só vê a mensagem genérica', () => {
    expect(EMPLOYER_REVIEW_MESSAGE).not.toMatch(/dinheiro|pagar|risco|sinal/i);
  });
});

describe('B4/F1.5 — prazos e expiração', () => {
  it('o prazo é o fim do dia em STP (UTC+0)', () => {
    expect(deadlineToUtc('2026-11-15')?.toISOString()).toBe(
      '2026-11-15T23:59:59.999Z',
    );
    expect(deadlineToUtc('2026-02-31')).toBeNull();
    expect(deadlineToUtc('15/11/2026')).toBeNull();
  });

  const publishedAt = new Date('2026-10-01T09:00:00Z');
  it('sem prazo: +30 dias; com prazo: o prazo, no máximo 90 dias; curada: 21 dias', () => {
    expect(
      computeExpiresAt({
        publishedAt,
        applicationDeadline: null,
      }).toISOString(),
    ).toBe('2026-10-31T09:00:00.000Z');
    const deadline = deadlineToUtc('2026-10-20');
    expect(
      computeExpiresAt({ publishedAt, applicationDeadline: deadline }),
    ).toEqual(deadline);
    expect(
      computeExpiresAt({
        publishedAt,
        applicationDeadline: deadlineToUtc('2027-06-01'),
      }).toISOString(),
    ).toBe('2026-12-30T09:00:00.000Z');
    expect(
      computeExpiresAt({
        publishedAt,
        applicationDeadline: null,
        curatedExternal: true,
      }).toISOString(),
    ).toBe('2026-10-22T09:00:00.000Z');
  });

  it('duas prorrogações grátis, depois consome entitlement', () => {
    expect([0, 1, 2, 3].map(extensionCost)).toEqual([
      'FREE',
      'FREE',
      'ENTITLEMENT',
      'ENTITLEMENT',
    ]);
  });

  it('avisos a 7 e a 2 dias', () => {
    const expiresAt = new Date('2026-10-20T23:59:59.999Z');
    expect(dueExpiryWarning(expiresAt, new Date('2026-10-14T08:00:00Z'))).toBe(
      7,
    );
    expect(dueExpiryWarning(expiresAt, new Date('2026-10-19T08:00:00Z'))).toBe(
      2,
    );
    expect(
      dueExpiryWarning(expiresAt, new Date('2026-10-17T08:00:00Z')),
    ).toBeNull();
  });

  it('o servidor recusa candidaturas depois do prazo, mesmo antes do cron', () => {
    const job = {
      status: 'PUBLISHED',
      applicationMethod: 'INTERNAL',
      applicationDeadline: deadlineToUtc('2026-10-08'),
      expiresAt: new Date('2026-11-30T00:00:00Z'),
    };
    expect(isAcceptingApplications(job, new Date('2026-10-08T23:59:00Z'))).toBe(
      true,
    );
    expect(isAcceptingApplications(job, new Date('2026-10-09T00:00:00Z'))).toBe(
      false,
    );
    expect(isAcceptingApplications({ ...job, status: 'PAUSED' }, now)).toBe(
      false,
    );
    expect(
      isAcceptingApplications(
        { ...job, applicationMethod: 'EXTERNAL_URL' },
        now,
      ),
    ).toBe(false);
  });

  it('datas no formato de STP, nunca americano', () => {
    expect(formatStpDate(new Date('2026-11-15T23:59:59Z'))).toBe(
      '15 nov. 2026',
    );
    const deadline = deadlineToUtc('2026-10-11') as Date;
    expect(formatDeadline(deadline, now)).toEqual({
      label: 'Candidaturas até 11 out. 2026',
      urgency: 'faltam 4 dias',
    });
    expect(
      formatDeadline(deadlineToUtc('2026-12-01') as Date, now).urgency,
    ).toBeNull();
  });
});
