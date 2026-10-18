import type { EligibilityInput } from '@/domain/applications/eligibility';
import { checkApplicationEligibility } from '@/domain/applications/eligibility';

const now = new Date('2026-10-08T10:00:00Z');
const ok: EligibilityInput = {
  now,
  candidate: {
    authenticated: true,
    emailVerified: false,
    phoneVerified: true,
    suspended: false,
    name: 'Maria Costa',
    hasDistrictOrAbroad: true,
    hasCv: false,
    experienceOrEducationCount: 1,
  },
  job: {
    status: 'PUBLISHED',
    applicationMethod: 'INTERNAL',
    applicationDeadline: new Date('2026-10-20T23:59:59.999Z'),
    expiresAt: new Date('2026-10-20T23:59:59.999Z'),
  },
  previousApplication: null,
  requiredQuestionIds: ['q1'],
  answeredQuestionIds: ['q1', 'q2'],
  rateLimitAllowed: true,
  idempotencyKey: 'f1b2c3d4-0000-4000-8000-000000000001',
};

const codes = (input: EligibilityInput) =>
  checkApplicationEligibility(input).map((failure) => failure.code);

describe('F2.2 — requisitos para candidatar', () => {
  it('telemóvel verificado chega (email ou telefone)', () => {
    expect(checkApplicationEligibility(ok)).toEqual([]);
  });

  it('sem sessão: só pede para entrar ou registar', () => {
    expect(
      codes({ ...ok, candidate: { ...ok.candidate, authenticated: false } }),
    ).toEqual(['NOT_AUTHENTICATED']);
  });

  it.each([
    [
      { candidate: { ...ok.candidate, phoneVerified: false } },
      'CONTACT_NOT_VERIFIED',
    ],
    [{ candidate: { ...ok.candidate, suspended: true } }, 'ACCOUNT_SUSPENDED'],
    [{ job: { ...ok.job, status: 'PAUSED' } }, 'JOB_NOT_ACCEPTING'],
    [{ now: new Date('2026-10-21T00:00:00Z') }, 'JOB_NOT_ACCEPTING'],
    [
      { job: { ...ok.job, applicationMethod: 'EXTERNAL_URL' } },
      'JOB_NOT_ACCEPTING',
    ],
    [
      {
        previousApplication: { submittedAt: new Date('2026-10-02T09:00:00Z') },
      },
      'ALREADY_APPLIED',
    ],
    [{ candidate: { ...ok.candidate, name: '  ' } }, 'PROFILE_INCOMPLETE'],
    [
      { candidate: { ...ok.candidate, hasDistrictOrAbroad: false } },
      'PROFILE_INCOMPLETE',
    ],
    [
      { candidate: { ...ok.candidate, experienceOrEducationCount: 0 } },
      'PROFILE_INCOMPLETE',
    ],
    [{ answeredQuestionIds: ['q2'] }, 'SCREENING_UNANSWERED'],
    [{ rateLimitAllowed: false }, 'RATE_LIMITED'],
    [{ idempotencyKey: null }, 'IDEMPOTENCY_KEY_MISSING'],
  ])('%o → %s', (change, code) => {
    expect(codes({ ...ok, ...change } as EligibilityInput)).toEqual([code]);
  });

  it('um CV dispensa experiência e formação', () => {
    expect(
      codes({
        ...ok,
        candidate: {
          ...ok.candidate,
          hasCv: true,
          experienceOrEducationCount: 0,
        },
      }),
    ).toEqual([]);
  });

  it('a mensagem de candidatura repetida tem a data no formato de STP', () => {
    const [failure] = checkApplicationEligibility({
      ...ok,
      previousApplication: { submittedAt: new Date('2026-10-12T09:00:00Z') },
    });
    expect(failure?.message).toBe(
      'Já se candidatou a esta vaga em 12 out. 2026. Acompanhe aqui.',
    );
  });

  it('F2.1: nenhum requisito depende de plano ou pagamento', () => {
    expect(Object.keys(ok)).not.toEqual(expect.arrayContaining(['plan']));
    expect(
      JSON.stringify(
        checkApplicationEligibility({ ...ok, rateLimitAllowed: false }),
      ),
    ).not.toMatch(/plano|premium|pagar|upgrade/i);
  });
});
