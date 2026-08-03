import {
  canUploadCertificate,
  PLAN_FEATURES,
} from '../../../lib/candidatePlanFeatures';

const CANDIDATE_PLAN_IDS = [
  'basic_candidato',
  'verification_candidato',
  'professional_candidato',
  'unlimited_candidato',
] as const;

describe('upload de certificados — nunca é exclusivo de plano', () => {
  test.each(CANDIDATE_PLAN_IDS)(
    '%s permite adicionar o primeiro certificado',
    (planId) => {
      const access = canUploadCertificate(planId, 0);
      expect(access.allowed).toBe(true);
      expect(access.code).not.toBe('FEATURE_PRO_ONLY');
    },
  );

  test.each(CANDIDATE_PLAN_IDS)(
    '%s declara canUploadCertificates: true no catálogo de planos',
    (planId) => {
      expect(PLAN_FEATURES[planId].canUploadCertificates).toBe(true);
    },
  );

  test('Básico e Verificação passam a ter o mesmo limite que o Profissional (5)', () => {
    expect(PLAN_FEATURES.basic_candidato.maxCertificates).toBe(5);
    expect(PLAN_FEATURES.verification_candidato.maxCertificates).toBe(5);
    expect(PLAN_FEATURES.professional_candidato.maxCertificates).toBe(5);
  });

  test('Premium continua ilimitado', () => {
    expect(PLAN_FEATURES.unlimited_candidato.maxCertificates).toBeNull();
    const access = canUploadCertificate('unlimited_candidato', 999);
    expect(access.allowed).toBe(true);
  });

  test('o limite continua a bloquear ao atingir a quota (não é mais "exclusivo", mas continua limitado)', () => {
    const access = canUploadCertificate('basic_candidato', 5);
    expect(access.allowed).toBe(false);
    expect(access.code).toBe('CERTIFICATES_LIMIT_REACHED');
  });
});
