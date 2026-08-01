import { canViewerAccessCandidate, getCandidatePrivacy } from './candidatePrivacy';

/**
 * Fonte única de verdade para o acesso a ficheiros pessoais de um candidato
 * (CV e certificados).
 *
 * As três vistas que expunham o CV — perfil público, ficha do candidato no
 * dashboard da empresa e talent pool — aplicavam esta mesma regra cada uma à
 * sua maneira. Concentrá-la aqui garante que a rota que assina os URLs decide
 * exatamente como a UI que os mostra.
 *
 * @returns {{ allowed: boolean, reason: string }}
 */
export function canViewerAccessCandidateFiles({
  candidateId,
  candidateProfile = {},
  viewer,
}) {
  if (!viewer || !viewer.uid) {
    return { allowed: false, reason: 'unauthenticated' };
  }

  if (viewer.uid === candidateId) {
    return { allowed: true, reason: 'owner' };
  }

  if (viewer.userType === 'admin') {
    return { allowed: true, reason: 'admin' };
  }

  if (viewer.userType !== 'empresa') {
    return { allowed: false, reason: 'forbidden_role' };
  }

  const privacy = getCandidatePrivacy(candidateProfile);
  const visibleToRecruiters = canViewerAccessCandidate(privacy, {
    isEmpresa: true,
  });

  if (!visibleToRecruiters || !privacy.showContactInfo) {
    return { allowed: false, reason: 'candidate_private' };
  }

  if (!viewer.planFeatures?.canViewCandidateContact) {
    return { allowed: false, reason: 'plan_required' };
  }

  return { allowed: true, reason: 'recruiter_contact' };
}
