/**
 * D7 — ações do ATS atual (`status`: analysis/interview/approved/rejected)
 * sobre candidaturas v2. Cada ação vira o caminho mínimo de transições E4,
 * todas validadas pela máquina de estados (ator EMPLOYER), para o candidato
 * ver o mesmo que a empresa decidiu. «Aprovada» no modelo antigo é a decisão
 * final positiva: contratação marcada diretamente (E5.5, DIRECT_MARK).
 */
import { assertTransition } from './states';
import type { ApplicationStatus } from './states';

export type LegacyAtsStatus =
  'pending' | 'analysis' | 'interview' | 'approved' | 'rejected';

export type LegacyAtsPlan =
  | {
      ok: true;
      steps: ApplicationStatus[];
      closedReason: 'NOT_SELECTED' | null;
      createsHire: boolean;
    }
  | { ok: false; code: 'TRANSITION_NOT_ALLOWED' };

const PATHS: Readonly<
  Record<
    LegacyAtsStatus,
    Partial<Record<ApplicationStatus, ApplicationStatus[]>>
  >
> = {
  // Voltar a «pendente» não existe (não se desfaz a 1.ª leitura).
  pending: { SUBMITTED: [] },
  analysis: {
    SUBMITTED: ['UNDER_REVIEW'],
    UNDER_REVIEW: [],
    SHORTLISTED: [],
    INTERVIEW: ['UNDER_REVIEW'],
  },
  interview: {
    SUBMITTED: ['UNDER_REVIEW', 'INTERVIEW'],
    UNDER_REVIEW: ['INTERVIEW'],
    SHORTLISTED: ['INTERVIEW'],
    INTERVIEW: [],
  },
  approved: {
    SUBMITTED: ['UNDER_REVIEW', 'SHORTLISTED', 'HIRED'],
    UNDER_REVIEW: ['SHORTLISTED', 'HIRED'],
    SHORTLISTED: ['HIRED'],
    INTERVIEW: ['HIRED'],
    HIRED: [],
  },
  rejected: {
    SUBMITTED: ['REJECTED'],
    UNDER_REVIEW: ['REJECTED'],
    SHORTLISTED: ['REJECTED'],
    INTERVIEW: ['REJECTED'],
    OFFER: ['REJECTED'],
    OFFER_DECLINED: ['REJECTED'],
    REJECTED: [],
  },
};

/** Motivo técnico para recuos que a máquina exige justificar (INTERVIEW → UNDER_REVIEW). */
export const LEGACY_ATS_REASON = 'LEGACY_ATS_STATUS_CHANGE';

export function planLegacyAtsTransition(
  current: ApplicationStatus,
  target: LegacyAtsStatus,
): LegacyAtsPlan {
  const steps = PATHS[target]?.[current];
  if (!steps) return { ok: false, code: 'TRANSITION_NOT_ALLOWED' };
  let from = current;
  for (const to of steps) {
    const check = assertTransition(from, to, 'EMPLOYER', {
      reason: LEGACY_ATS_REASON,
      guards: { hireConfirmed: true, hasClosedReason: true },
    });
    if (!check.ok) return { ok: false, code: 'TRANSITION_NOT_ALLOWED' };
    from = to;
  }
  return {
    ok: true,
    steps: [...steps],
    closedReason: steps.includes('REJECTED') ? 'NOT_SELECTED' : null,
    createsHire: steps.includes('HIRED'),
  };
}
