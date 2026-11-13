import {
  getPlanSummary,
  hasActivePremiumVerification,
} from '../../../lib/candidatePlanFeatures';
import {
  buildCandidateVisibility,
  getCandidateVerification,
  isCandidateVerified,
} from '../../../lib/candidateProfileInsights';
import { getCandidateVerificationDisplayState } from '../../../lib/candidateVerificationDisplay';

const premium = {
  userType: 'candidato',
  currentPlan: 'unlimited_candidato',
  planStartDate: '2025-01-01T00:00:00Z',
  planEndDate: '2099-01-01T00:00:00Z',
};

describe('verificação automática do Premium', () => {
  test.each(['unverified', 'pending', 'rejected'])(
    'Premium já ativo com revisão %s recebe apenas o selo pago',
    (status) => {
      const user = {
        ...premium,
        verified: false,
        verificationStatus: status,
        verificationMethod: 'competencies',
        verificationItems: { competencies: { status } },
      };
      expect(hasActivePremiumVerification(user)).toBe(true);
      expect(isCandidateVerified(user)).toBe(true);
      expect(getCandidateVerification(user)).toMatchObject({
        paid: true,
        premiumVerified: true,
        qualified: false,
        types: ['paid'],
      });
      expect(buildCandidateVisibility(user)).toMatchObject({
        verified: true,
        paidVerified: true,
        premiumVerified: true,
        qualifiedVerified: false,
      });
      expect(
        getCandidateVerificationDisplayState({
          visibility: buildCandidateVisibility(user),
          record: {
            status,
            summary: { publicVerified: false },
            verificationMethod: 'competencies',
          },
          summary: { pendingCount: 1, status: 'pending' },
        }),
      ).toEqual({ active: true, pending: false, premiumActive: true });
    },
  );

  test.each([
    { currentPlan: 'unlimited_candidato' },
    { currentPlan: 'premium' },
    { currentPlan: 'premium_candidato' },
    { currentPlan: 'unlimited' },
    { planTierId: 'unlimited_candidato' },
    { planId: 'configured-plan', planName: 'Premium' },
  ])('reconhece um plano ativado legado sem migração: %j', (plan) => {
    expect(hasActivePremiumVerification(plan)).toBe(true);
  });

  test.each([
    {},
    { planName: 'Premium' },
    {
      currentPlan: 'basic_candidato',
      planName: 'Premium',
      planTierId: 'unlimited_candidato',
    },
    { currentPlan: 'professional_candidato', canVerifyProfile: true },
    { currentPlan: 'verification_candidato' },
    {
      currentPlan: 'custom-free',
      maxApplicationsPerMonth: null,
      canSeeWhoViewedProfile: true,
    },
    { pendingPlan: 'unlimited_candidato', paymentStatus: 'proof_submitted' },
    { ...premium, userType: 'empresa' },
    { ...premium, userType: 'admin' },
    { ...premium, status: 'suspended' },
    { ...premium, status: 'disabled' },
    { ...premium, verificationDisabled: true },
    { ...premium, planEndDate: '2020-01-01T00:00:00Z' },
    { ...premium, planEndDate: 'invalid' },
    { ...premium, planEndDate: {} },
    { ...premium, planStartDate: '2098-01-01T00:00:00Z' },
    { ...premium, planStartDate: 'invalid' },
  ])('não concede o benefício indevidamente: %j', (user) => {
    expect(hasActivePremiumVerification(user)).toBe(false);
  });

  test.each([
    new Date('2099-01-01T00:00:00Z'),
    { toDate: () => new Date('2099-01-01T00:00:00Z') },
    { toMillis: () => new Date('2099-01-01T00:00:00Z').getTime() },
    {
      seconds: new Date('2099-01-01T00:00:00Z').getTime() / 1000,
      nanoseconds: 0,
    },
    {
      _seconds: new Date('2099-01-01T00:00:00Z').getTime() / 1000,
      _nanoseconds: 0,
    },
    null,
  ])(
    'datas Firestore/JSON mantêm a verificação e o plano coerentes',
    (planEndDate) => {
      const user = { ...premium, planEndDate };
      expect(hasActivePremiumVerification(user)).toBe(true);
      expect(getPlanSummary(user).planId).toBe('unlimited_candidato');
    },
  );

  test('expiração retira só o benefício Premium e preserva competências aprovadas', () => {
    const user = {
      ...premium,
      verificationMethod: 'competencies',
      verificationItems: { competencies: { status: 'approved' } },
    };
    expect(getCandidateVerification(user).types).toEqual(['paid', 'qualified']);
    expect(
      getCandidateVerification({ ...user, planEndDate: '2020-01-01' }),
    ).toMatchObject({
      paid: false,
      premiumVerified: false,
      qualified: true,
      types: ['qualified'],
    });
  });

  test('alterar plano não deixa selo automático permanente; aprovação documental mantém-se', () => {
    expect(
      isCandidateVerified({ ...premium, currentPlan: 'basic_candidato' }),
    ).toBe(false);
    expect(
      getCandidateVerification({
        ...premium,
        planEndDate: '2020-01-01',
        verificationItems: { identity: { status: 'approved' } },
      }),
    ).toMatchObject({ paid: true, premiumVerified: false });
  });

  test('uma suspensão global pelo admin prevalece sobre os dois selos', () => {
    expect(
      getCandidateVerification({
        ...premium,
        verificationDisabled: true,
        verified: true,
        verificationMethod: 'competencies',
        verificationStatus: 'verified',
      }),
    ).toMatchObject({
      paid: false,
      premiumVerified: false,
      qualified: false,
      types: [],
    });
  });
});
