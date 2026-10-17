import { formatStpDate, isAcceptingApplications } from '../jobs/deadlines';

/**
 * F2.2 — requisitos para candidatar, verificados no servidor (F2.1: a
 * candidatura é gratuita — nenhum requisito depende de plano ou pagamento).
 * Devolve todas as falhas pela ordem da especificação; o servidor recusa se
 * houver alguma, a UI mostra-as antes de submeter.
 */
export type EligibilityCode =
  | 'NOT_AUTHENTICATED'
  | 'CONTACT_NOT_VERIFIED'
  | 'ACCOUNT_SUSPENDED'
  | 'JOB_NOT_ACCEPTING'
  | 'ALREADY_APPLIED'
  | 'PROFILE_INCOMPLETE'
  | 'SCREENING_UNANSWERED'
  | 'RATE_LIMITED'
  | 'IDEMPOTENCY_KEY_MISSING';

export interface EligibilityInput {
  now: Date;
  candidate: {
    authenticated: boolean;
    emailVerified: boolean;
    phoneVerified: boolean;
    suspended: boolean;
    name: string;
    /** Distrito ou "fora de STP". */
    hasDistrictOrAbroad: boolean;
    hasCv: boolean;
    experienceOrEducationCount: number;
  };
  job: {
    status: string;
    applicationMethod: string;
    applicationDeadline: Date | null;
    expiresAt: Date | null;
  };
  /** Candidatura anterior à mesma vaga que não seja DRAFT (inclui WITHDRAWN). */
  previousApplication: { submittedAt: Date } | null;
  requiredQuestionIds: readonly string[];
  answeredQuestionIds: readonly string[];
  rateLimitAllowed: boolean;
  idempotencyKey: string | null;
}

export interface EligibilityFailure {
  code: EligibilityCode;
  message: string;
}

export function alreadyAppliedFailure(submittedAt: Date): EligibilityFailure {
  return {
    code: 'ALREADY_APPLIED',
    message: `Já se candidatou a esta vaga em ${formatStpDate(
      submittedAt,
    )}. Acompanhe aqui.`,
  };
}

export function checkApplicationEligibility(
  input: EligibilityInput,
): EligibilityFailure[] {
  const failures: EligibilityFailure[] = [];
  const { candidate } = input;
  if (!candidate.authenticated) {
    return [
      {
        code: 'NOT_AUTHENTICATED',
        message: 'Inicie sessão ou registe-se para se candidatar.',
      },
    ];
  }
  if (!candidate.emailVerified && !candidate.phoneVerified)
    failures.push({
      code: 'CONTACT_NOT_VERIFIED',
      message: 'Confirme o seu email ou telemóvel para se candidatar.',
    });
  if (candidate.suspended)
    failures.push({
      code: 'ACCOUNT_SUSPENDED',
      message: 'A sua conta está suspensa. Contacte o EmpregoSTP.',
    });
  if (!isAcceptingApplications(input.job, input.now))
    failures.push({
      code: 'JOB_NOT_ACCEPTING',
      message: 'Esta vaga já não aceita candidaturas.',
    });
  if (input.previousApplication)
    failures.push(alreadyAppliedFailure(input.previousApplication.submittedAt));
  const hasProfileContent =
    candidate.hasCv || candidate.experienceOrEducationCount >= 1;
  if (
    !candidate.name.trim() ||
    !candidate.hasDistrictOrAbroad ||
    !hasProfileContent
  )
    failures.push({
      code: 'PROFILE_INCOMPLETE',
      message:
        'Complete o perfil: nome, distrito e um CV (ou pelo menos uma experiência ou formação).',
    });
  const answered = new Set(input.answeredQuestionIds);
  if (input.requiredQuestionIds.some((id) => !answered.has(id)))
    failures.push({
      code: 'SCREENING_UNANSWERED',
      message: 'Responda a todas as perguntas obrigatórias.',
    });
  if (!input.rateLimitAllowed)
    failures.push({
      code: 'RATE_LIMITED',
      message:
        'Fez muitas candidaturas em pouco tempo. Tente novamente dentro de alguns minutos.',
    });
  if (!input.idempotencyKey)
    failures.push({
      code: 'IDEMPOTENCY_KEY_MISSING',
      message: 'O pedido está incompleto. Atualize a página e tente novamente.',
    });
  return failures;
}
