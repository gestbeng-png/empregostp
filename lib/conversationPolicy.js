import {
  canViewerAccessCandidate,
  getCandidatePrivacy,
} from './candidatePrivacy';

export function canUsersStartConversation({
  requester = {},
  participant = {},
  requesterProfile = {},
  participantProfile = {},
}) {
  const requesterType = requester.userType;
  const participantType = participant.userType;

  if (requesterType === 'admin') {
    return { allowed: true };
  }

  const complementaryRoles =
    (requesterType === 'empresa' && participantType === 'candidato') ||
    (requesterType === 'candidato' && participantType === 'empresa');

  if (!complementaryRoles) {
    return {
      allowed: false,
      reason:
        'As conversas diretas só podem ser iniciadas entre candidatos e empresas.',
    };
  }

  const candidateProfile =
    requesterType === 'candidato' ? requesterProfile : participantProfile;
  const privacy = getCandidatePrivacy(candidateProfile);
  if (
    !canViewerAccessCandidate(privacy, {
      isEmpresa: true,
    })
  ) {
    return {
      allowed: false,
      reason: 'Este candidato não está disponível para novas conversas.',
    };
  }

  return { allowed: true };
}

export function canUsersContinueConversation({
  requester = {},
  participant = {},
}) {
  if (requester.userType === 'admin') {
    return { allowed: true };
  }

  const complementaryRoles =
    (requester.userType === 'empresa' &&
      participant.userType === 'candidato') ||
    (requester.userType === 'candidato' &&
      participant.userType === 'empresa');

  if (!complementaryRoles) {
    return {
      allowed: false,
      reason:
        'Esta conversa já não pode receber mensagens porque os participantes deixaram de ser compatíveis.',
    };
  }

  return { allowed: true };
}
