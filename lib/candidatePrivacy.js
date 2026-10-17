const PROFILE_VISIBILITIES = new Set(['public', 'recruiters', 'private']);

/**
 * Normaliza as preferências de privacidade guardadas no perfil.
 * Os valores por omissão correspondem aos apresentados na área do candidato.
 */
export function getCandidatePrivacy(profile = {}) {
  const persisted = profile?.settings?.privacy || {};
  // Com eliminação pedida (H5), o perfil sai de imediato de pesquisas e
  // páginas públicas. Cancelar o pedido devolve a escolha guardada.
  const profileVisibility =
    profile?.pendingDeletion === true
      ? 'private'
      : PROFILE_VISIBILITIES.has(persisted.profileVisibility)
        ? persisted.profileVisibility
        : 'recruiters';

  return {
    profileVisibility,
    showContactInfo:
      typeof persisted.showContactInfo === 'boolean'
        ? persisted.showContactInfo
        : false,
    allowSearchEngines:
      typeof persisted.allowSearchEngines === 'boolean'
        ? persisted.allowSearchEngines
        : false,
    showActivityStatus:
      typeof persisted.showActivityStatus === 'boolean'
        ? persisted.showActivityStatus
        : true,
  };
}

export function canViewerAccessCandidate(privacy, viewer = {}) {
  if (viewer.isOwner || viewer.isAdmin) return true;
  if (privacy.profileVisibility === 'private') return false;
  if (privacy.profileVisibility === 'recruiters') {
    return Boolean(viewer.isEmpresa);
  }
  return privacy.profileVisibility === 'public';
}

export function canCandidateAppearInTalentPool(profile = {}) {
  return getCandidatePrivacy(profile).profileVisibility !== 'private';
}

export function canCandidateAppearPublicly(profile = {}) {
  return getCandidatePrivacy(profile).profileVisibility === 'public';
}

export function canIndexCandidateProfile(privacy) {
  return (
    privacy.profileVisibility === 'public' && privacy.allowSearchEngines === true
  );
}
