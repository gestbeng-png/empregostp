export const teamRoleLabel = (role) =>
  ({
    OWNER: 'Proprietário',
    ADMIN: 'Administrador',
    RECRUITER: 'Recrutador',
    REVIEWER: 'Avaliador',
  })[role] || 'Membro';
export const teamRoleDescription = (role) =>
  ({
    OWNER: 'Gere toda a organização e a propriedade.',
    ADMIN: 'Gere processos, convites e membros.',
    RECRUITER: 'Gere as candidaturas das vagas que lhe são atribuídas.',
    REVIEWER:
      'Consulta candidaturas e adiciona avaliações e notas; não altera estados.',
  })[role] || '';
// Os códigos de domínio (E4, E3) nunca aparecem crus no ecrã.
const CLOSED_REASON_LABELS = {
  NOT_SELECTED: 'Não selecionado(a)',
  HARD_REQUIREMENT_NOT_MET: 'Não cumpre um requisito obrigatório',
  KNOCKOUT_ANSWER: 'Resposta eliminatória',
  POSITION_FILLED: 'Posição preenchida',
  POSITION_CLOSED: 'Processo encerrado',
  POSITION_CANCELLED: 'Posição cancelada',
  DUPLICATE: 'Candidatura duplicada',
  SPAM: 'Spam',
  HIRE_ANNULLED: 'Contratação anulada',
  OTHER: 'Outro motivo',
};
export const closedReasonLabel = (reason) =>
  CLOSED_REASON_LABELS[reason] || 'Outro motivo';
export const closedReasonOptions = (reasons) =>
  reasons
    .filter((reason) => reason !== 'HIRE_ANNULLED')
    .map((reason) => [reason, closedReasonLabel(reason)]);
const JOB_STATUS_LABELS = {
  draft: 'Rascunho',
  pending_review: 'Em revisão',
  published: 'Publicada',
  active: 'Publicada',
  paused: 'Pausada',
  expired: 'Expirada',
  closed: 'Fechada',
  filled: 'Preenchida',
  rejected: 'Rejeitada',
  archived: 'Arquivada',
};
export const jobStatusLabel = (status) =>
  JOB_STATUS_LABELS[String(status || '').toLowerCase()] || 'Sem estado';
export function recruitmentDate(value) {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('pt-PT', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Africa/Sao_Tome',
      }).format(date)
    : 'Data não disponível';
}
export function invitationPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/equipa/convite?'))
    return null;
  try {
    const url = new URL(value, 'https://empregostp.invalid');
    return url.origin === 'https://empregostp.invalid' &&
      url.pathname === '/equipa/convite' &&
      url.searchParams.get('i') &&
      url.searchParams.get('t') &&
      !url.hash
      ? value
      : null;
  } catch {
    return null;
  }
}
