import {
  buildJobApplicationPolicy,
  evaluateCandidateJobAccess,
  getJobApplicationPolicy,
} from '@/lib/applicationPolicy';
import {
  CANDIDATE_PLAN_CATALOG,
  getCandidatePlanBenefits,
} from '@/lib/candidateCatalog';
import {
  PLAN_FEATURES,
  canApplyToJob,
  canSaveJob,
  canUseCvGenerator,
  canVerifyProfile,
  getPlanSummary,
} from '@/lib/candidatePlanFeatures';

const tiers = Object.keys(PLAN_FEATURES) as Array<keyof typeof PLAN_FEATURES>;

describe('ADR-016 — nenhum plano compra candidaturas, prioridade ou destaque (F2.1/G2.1/K1)', () => {
  test.each(tiers)('%s: grátis o que F2.1 manda dar a todos', (tier) => {
    expect(PLAN_FEATURES[tier]).toMatchObject({
      maxApplicationsPerMonth: null,
      canSaveJobs: true,
      maxSavedJobs: null,
      canReceiveNotifications: true,
      canReceivePersonalizedJobs: true,
      canReceiveRecommendations: true,
      canApplyToFeaturedJobs: true,
      canAccessPremiumJobs: true,
      canAccessEarlyAccessJobs: true,
      canUseCoverLetter: true,
      canUseCvGenerator: true,
      curriculoDestacado: false,
      priorityInSearch: false,
      applicationPriorityLevel: 0,
    });
  });

  test('o plano gratuito candidata-se sem contar candidaturas', async () => {
    const admin = {
      firestore: () => {
        throw new Error('não devia consultar');
      },
    };
    await expect(
      canApplyToJob('u1', 'basic_candidato', admin),
    ).resolves.toEqual({ allowed: true });
    expect(PLAN_FEATURES.basic_candidato.canApplyToFeaturedJobs).toBe(true);
    expect(PLAN_FEATURES.basic_candidato.canUseCoverLetter).toBe(true);
    expect(canUseCvGenerator('basic_candidato').allowed).toBe(true);
    await expect(canSaveJob('u1', 'basic_candidato', admin)).resolves.toEqual({
      allowed: true,
    });
  });

  test('os planos pagos vendem serviços, não vantagem', () => {
    expect(PLAN_FEATURES.verification_candidato.canVerifyProfile).toBe(true);
    expect(PLAN_FEATURES.professional_candidato).toMatchObject({
      canSeeWhoViewedProfile: true,
      canViewStats: true,
    });
    expect(PLAN_FEATURES.unlimited_candidato).toMatchObject({
      canVerifyProfile: true,
      supportLevel: 'vip',
    });
    expect(PLAN_FEATURES.basic_candidato.canVerifyProfile).toBe(false);
  });

  test('Premium ativo inclui o pedido de verificação sem contratar outro plano', () => {
    const active = getPlanSummary({
      currentPlan: 'unlimited_candidato',
      planEndDate: new Date(Date.now() + 86400000),
    });
    expect(canVerifyProfile(active.planId)).toEqual({ allowed: true });
    expect(active.features.canVerifyProfile).toBe(true);

    const expired = getPlanSummary({
      currentPlan: 'unlimited_candidato',
      planEndDate: new Date(Date.now() - 86400000),
    });
    expect(expired.features.canVerifyProfile).toBe(false);
  });

  test('mantém a verificação visível sem duplicar nem alterar os benefícios do admin', () => {
    const features = [
      ...Array.from({ length: 8 }, (_, index) => `Benefício ${index + 1}`),
      'Verificação incluída',
    ];
    const original = [...features];
    expect(getCandidatePlanBenefits('unlimited_candidato', features)).toEqual([
      'Verificação incluída',
      ...features.slice(0, 8),
    ]);
    expect(features).toEqual(original);
    expect(
      getCandidatePlanBenefits('professional_candidato', features.slice(0, 8)),
    ).toEqual(features.slice(0, 8));
  });

  test('vagas «premium»/acesso antecipado deixam de existir para qualquer plano', () => {
    expect(
      buildJobApplicationPolicy({
        premiumOnly: true,
        earlyAccessHours: 24,
        requireCoverLetter: true,
      }),
    ).toMatchObject({
      premiumOnly: false,
      earlyAccessHours: 0,
      earlyAccessUntil: null,
      requireCoverLetter: true,
    });
    // Vagas antigas ainda marcadas como premium: o plano gratuito acede na mesma.
    expect(
      evaluateCandidateJobAccess(
        { premiumOnly: true, earlyAccessUntil: '2999-01-01T00:00:00Z' },
        'basic_candidato',
      ).allowed,
    ).toBe(true);
  });

  test('o catálogo não promete o que é proibido', () => {
    const text = JSON.stringify(CANDIDATE_PLAN_CATALOG).toLowerCase();
    for (const forbidden of [
      'candidaturas por mês',
      'candidaturas/mês',
      'prioridade nas candidaturas',
      'prioridade máxima',
      'currículo em destaque',
      'acesso antecipado',
      'vagas em destaque',
      'vagas salvas',
    ])
      expect(text).not.toContain(forbidden);
    expect(CANDIDATE_PLAN_CATALOG.map((plan) => plan.id)).toEqual(tiers);
    expect(CANDIDATE_PLAN_CATALOG.map((plan) => plan.price)).toEqual([
      0, 20, 50, 200,
    ]);
  });

  test.each(tiers)(
    '%s: os campos antigos da vaga nunca reintroduzem paywall ou janela paga',
    (tier) => {
      const oldJob = {
        premiumOnly: true,
        earlyAccessHours: 72,
        earlyAccessUntil: '2999-01-01T00:00:00Z',
        applicationPremium: { premiumOnly: true, requireCoverLetter: true },
      };
      expect(getJobApplicationPolicy(oldJob)).toMatchObject({
        premiumOnly: false,
        earlyAccessHours: 0,
        earlyAccessUntil: null,
        isEarlyAccessActive: false,
        requireCoverLetter: true,
      });
      expect(evaluateCandidateJobAccess(oldJob, tier)).toMatchObject({
        allowed: true,
        candidateAccess: {
          priorityApplied: false,
          highlighted: false,
          priorityLevel: 0,
        },
      });
    },
  );
});
