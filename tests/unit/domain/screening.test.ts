import { canUseFeature } from '@/domain/entitlements/canUseFeature';
import { decidePublication } from '@/domain/jobs/publication';
import {
  detectProtectedTerms,
  evaluateKnockout,
  SCREENING_LIBRARY,
  validateScreeningQuestions,
} from '@/domain/jobs/screening';
import { evaluateJobSubmission } from '@/domain/jobs/submission';

const q = (extra: Record<string, unknown>) => ({
  type: 'BOOLEAN',
  label: 'Tem carta de condução B?',
  ...extra,
});

describe('F3.3 — perguntas de triagem', () => {
  test('o plano gratuito permite 3; o máximo absoluto é 8', () => {
    const free = canUseFeature(
      { type: 'ORGANIZATION', id: 'o' },
      'SCREENING_QUESTIONS',
      [],
      { now: 0, v2Enabled: true },
    );
    expect(free.limit).toBe(3);
    expect(
      validateScreeningQuestions(
        [q({}), q({ id: 'b' }), q({ id: 'c' }), q({ id: 'd' })],
        3,
      ),
    ).toMatchObject({
      ok: false,
      code: 'SCREENING_LIMIT',
      message: 'Pode usar até 3 perguntas de triagem nesta vaga.',
    });
    expect(
      validateScreeningQuestions(
        Array.from({ length: 9 }, (_, i) => q({ id: `q${i}` })),
        100,
      ),
    ).toMatchObject({
      code: 'SCREENING_LIMIT',
    });
  });

  test.each([
    'Qual é a sua idade?',
    'É casado ou solteiro?',
    'Tem filhos?',
    'Qual a sua religião?',
    'Qual a sua nacionalidade?',
    'Tem boa aparência?',
    'Está grávida?',
  ])('H8: «%s» é recusada', (label) => {
    expect(validateScreeningQuestions([q({ label })], 8)).toMatchObject({
      ok: false,
      code: 'SCREENING_PROTECTED_ATTRIBUTE',
    });
  });

  test('a biblioteca de perguntas frequentes é toda válida', () => {
    const result = validateScreeningQuestions(
      SCREENING_LIBRARY.map((item, i) => ({ ...item, id: `lib${i}` })),
      8,
    );
    expect(result.ok).toBe(true);
  });

  test('escolha exige ≥ 2 opções e o eliminatório tem de ser coerente com o tipo', () => {
    expect(
      validateScreeningQuestions(
        [{ type: 'SINGLE_CHOICE', label: 'Qual o turno?', options: ['Manhã'] }],
        8,
      ).ok,
    ).toBe(false);
    expect(
      validateScreeningQuestions([q({ knockout: { expected: 'sim' } })], 8).ok,
    ).toBe(false);
    expect(
      validateScreeningQuestions(
        [
          {
            type: 'NUMBER',
            label: 'Anos de experiência?',
            knockout: { expected: { min: 2 } },
          },
        ],
        8,
      ),
    ).toMatchObject({
      ok: true,
      questions: [{ knockout: { expected: { min: 2 } }, required: true }],
    });
    expect(validateScreeningQuestions([q({ id: 'a' }), q({ id: 'a' })], 8)).toMatchObject({
      ok: false,
    });
  });
});

describe('F3.4 — eliminatórios nunca rejeitam, só marcam', () => {
  const v = validateScreeningQuestions(
    [
      q({ id: 'carta', knockout: { expected: true } }),
      {
        id: 'anos',
        type: 'NUMBER',
        label: 'Anos de experiência?',
        knockout: { expected: { min: 3 } },
      },
      {
        id: 'turnos',
        type: 'MULTIPLE_CHOICE',
        label: 'Que turnos aceita?',
        options: ['Dia', 'Noite'],
        knockout: { expected: ['Noite'] },
      },
    ],
    8,
  );
  const questions = v.ok ? v.questions : [];
  test('só falha com resposta explicitamente contrária', () => {
    expect(
      evaluateKnockout(questions, [
        { questionId: 'carta', value: false },
        { questionId: 'anos', value: 2 },
        { questionId: 'turnos', value: ['Dia'] },
      ]),
    ).toEqual(['carta', 'anos', 'turnos']);
    expect(
      evaluateKnockout(questions, [
        { questionId: 'carta', value: true },
        { questionId: 'anos', value: 3 },
      ]),
    ).toEqual([]);
    expect(
      evaluateKnockout(questions, [{ questionId: 'carta', value: '' }]),
    ).toEqual([]);
    expect(evaluateKnockout(questions, [])).toEqual([]);
  });
});

describe('H8 — termos discriminatórios no texto da vaga', () => {
  test('deteção por palavra inteira, sem acentos', () => {
    expect(
      detectProtectedTerms(
        'Procuramos SENHORA solteira, até 30 anos, boa aparência',
      ),
    ).toEqual(expect.arrayContaining(['solteira', 'boa aparencia']));
    expect(detectProtectedTerms('Gestão de pessoal e operações')).toEqual([]);
  });
  test('vão para revisão humana com aviso ao empregador', () => {
    const result = evaluateJobSubmission({
      payload: {
        titulo: 'Rececionista',
        descricao:
          'Hotel procura rececionista solteira com boa aparência. '.repeat(8),
        responsabilidades: 'Check-in\nCheck-out\nReservas',
        requisitos: 'Francês\nInglês',
        palavrasChave: ['Atendimento', 'Francês', 'Reservas'],
        localizacao: 'São Tomé',
        remoto: false,
        tipoContrato: 'Tempo Integral',
        salarioDe: '6000',
        dataFecho: '2026-11-30',
      },
      company: { verificationStatus: 'verified' },
      companyCreatedAt: new Date('2025-01-01'),
      existingJobs: [
        {
          id: 'x',
          titulo: 'Outra',
          status: 'closed',
          publishedAt: new Date('2026-01-01'),
        },
      ],
      platformModerationForced: false,
      now: new Date('2026-10-10T00:00:00Z'),
    });
    expect(result.protectedTerms).toEqual(
      expect.arrayContaining(['solteira', 'boa aparencia']),
    );
    expect(result.decision).toMatchObject({
      kind: 'REVIEW',
      reasons: ['PROTECTED_TERMS'],
    });
    expect(
      decidePublication({
        multiRole: { verdict: 'SINGLE', parts: [] },
        quality: {
          score: 80,
          band: 'COMPLETE',
          breakdown: {} as never,
          missing: [],
        },
        risk: {
          score: 0,
          signals: [],
          requiresReview: false,
          openP1Case: false,
        },
        organizationVerification: 'ORGANIZATION_VERIFIED',
        organizationHasApprovedJob: true,
        duplicateOfJobId: null,
        platformModerationForced: false,
      }),
    ).toEqual({ kind: 'PUBLISH' });
  });
});
