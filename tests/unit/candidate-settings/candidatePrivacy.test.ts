import {
  canCandidateAppearPublicly,
  canCandidateAppearInTalentPool,
  canIndexCandidateProfile,
  canViewerAccessCandidate,
  getCandidatePrivacy,
} from '../../../lib/candidatePrivacy';

describe('privacidade do perfil de candidato', () => {
  test('aplica por omissão a visibilidade apenas para empresas', () => {
    const privacy = getCandidatePrivacy({});

    expect(privacy.profileVisibility).toBe('recruiters');
    expect(canViewerAccessCandidate(privacy, { isEmpresa: true })).toBe(true);
    expect(canViewerAccessCandidate(privacy, {})).toBe(false);
    expect(canCandidateAppearPublicly({})).toBe(false);
    expect(canIndexCandidateProfile(privacy)).toBe(false);
  });

  test('um perfil privado só é acessível pelo próprio candidato ou admin', () => {
    const privacy = getCandidatePrivacy({
      settings: {
        privacy: {
          profileVisibility: 'private',
          showContactInfo: true,
          allowSearchEngines: true,
          showActivityStatus: false,
        },
      },
    });

    expect(canViewerAccessCandidate(privacy, { isEmpresa: true })).toBe(false);
    expect(canViewerAccessCandidate(privacy, { isOwner: true })).toBe(true);
    expect(canViewerAccessCandidate(privacy, { isAdmin: true })).toBe(true);
    expect(canCandidateAppearInTalentPool({ settings: { privacy } })).toBe(
      false,
    );
    expect(canIndexCandidateProfile(privacy)).toBe(false);
  });

  test('só permite indexar um perfil público com consentimento explícito', () => {
    const privacy = getCandidatePrivacy({
      settings: {
        privacy: {
          profileVisibility: 'public',
          showContactInfo: false,
          allowSearchEngines: true,
          showActivityStatus: true,
        },
      },
    });

    expect(canViewerAccessCandidate(privacy, {})).toBe(true);
    expect(
      canCandidateAppearPublicly({
        settings: { privacy: { profileVisibility: 'public' } },
      }),
    ).toBe(true);
    expect(canIndexCandidateProfile(privacy)).toBe(true);
  });
});
