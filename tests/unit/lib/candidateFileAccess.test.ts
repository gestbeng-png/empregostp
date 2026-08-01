import { canViewerAccessCandidateFiles } from '../../../lib/candidateFileAccess';

const publicProfile = { settings: { privacy: { profileVisibility: 'public' } } };

function empresaViewer(overrides = {}) {
  return {
    uid: 'company-1',
    userType: 'empresa',
    planFeatures: { canViewCandidateContact: true },
    ...overrides,
  };
}

describe('canViewerAccessCandidateFiles', () => {
  test('o dono acede sempre, mesmo com o perfil privado', () => {
    const decision = canViewerAccessCandidateFiles({
      candidateId: 'cand-1',
      candidateProfile: {
        settings: { privacy: { profileVisibility: 'private', showContactInfo: false } },
      },
      viewer: { uid: 'cand-1', userType: 'candidato' },
    });

    expect(decision).toEqual({ allowed: true, reason: 'owner' });
  });

  test('o administrador acede a qualquer candidato', () => {
    const decision = canViewerAccessCandidateFiles({
      candidateId: 'cand-1',
      candidateProfile: {
        settings: { privacy: { profileVisibility: 'private', showContactInfo: false } },
      },
      viewer: { uid: 'admin-1', userType: 'admin' },
    });

    expect(decision).toEqual({ allowed: true, reason: 'admin' });
  });

  test('empresa com plano e contacto partilhado acede', () => {
    const decision = canViewerAccessCandidateFiles({
      candidateId: 'cand-1',
      candidateProfile: {
        settings: {
          privacy: { profileVisibility: 'recruiters', showContactInfo: true },
        },
      },
      viewer: empresaViewer(),
    });

    expect(decision).toEqual({ allowed: true, reason: 'recruiter_contact' });
  });

  test('empresa sem a funcionalidade no plano é recusada', () => {
    const decision = canViewerAccessCandidateFiles({
      candidateId: 'cand-1',
      candidateProfile: {
        settings: {
          privacy: { profileVisibility: 'recruiters', showContactInfo: true },
        },
      },
      viewer: empresaViewer({ planFeatures: { canViewCandidateContact: false } }),
    });

    expect(decision).toEqual({ allowed: false, reason: 'plan_required' });
  });

  test('empresa é recusada quando o candidato não partilha contacto', () => {
    const decision = canViewerAccessCandidateFiles({
      candidateId: 'cand-1',
      candidateProfile: {
        settings: {
          privacy: { profileVisibility: 'recruiters', showContactInfo: false },
        },
      },
      viewer: empresaViewer(),
    });

    expect(decision).toEqual({ allowed: false, reason: 'candidate_private' });
  });

  test('empresa é recusada quando o perfil está privado, mesmo com plano', () => {
    const decision = canViewerAccessCandidateFiles({
      candidateId: 'cand-1',
      candidateProfile: {
        settings: {
          privacy: { profileVisibility: 'private', showContactInfo: true },
        },
      },
      viewer: empresaViewer(),
    });

    expect(decision).toEqual({ allowed: false, reason: 'candidate_private' });
  });

  test('outro candidato nunca acede, mesmo com o perfil público', () => {
    const decision = canViewerAccessCandidateFiles({
      candidateId: 'cand-1',
      candidateProfile: publicProfile,
      viewer: { uid: 'cand-2', userType: 'candidato' },
    });

    expect(decision).toEqual({ allowed: false, reason: 'forbidden_role' });
  });

  test('visitante sem sessão nunca acede a um perfil público', () => {
    const decision = canViewerAccessCandidateFiles({
      candidateId: 'cand-1',
      candidateProfile: publicProfile,
      viewer: null,
    });

    expect(decision).toEqual({ allowed: false, reason: 'unauthenticated' });
  });

  test('perfil público continua a exigir contacto partilhado para a empresa', () => {
    const decision = canViewerAccessCandidateFiles({
      candidateId: 'cand-1',
      candidateProfile: {
        settings: { privacy: { profileVisibility: 'public', showContactInfo: false } },
      },
      viewer: empresaViewer(),
    });

    expect(decision).toEqual({ allowed: false, reason: 'candidate_private' });
  });

  test('o default de privacidade (sem settings) não abre o CV a empresas', () => {
    // getCandidatePrivacy assume showContactInfo=false por omissão; um perfil
    // sem preferências gravadas não pode ficar mais exposto do que um explícito.
    const decision = canViewerAccessCandidateFiles({
      candidateId: 'cand-1',
      candidateProfile: {},
      viewer: empresaViewer(),
    });

    expect(decision).toEqual({ allowed: false, reason: 'candidate_private' });
  });
});
