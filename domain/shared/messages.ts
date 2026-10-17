export const DOMAIN_MESSAGES = Object.freeze({
  INVALID_TRANSITION: 'Esta mudança de estado não é permitida.',
  TRANSITION_FORBIDDEN: 'Não tem permissão para esta mudança.',
  TRANSITION_GUARD_FAILED: 'Faltam condições para concluir esta mudança.',
  VERSION_CONFLICT: 'O registo foi atualizado. Recarregue antes de continuar.',
  FEATURE_DISABLED: 'Esta funcionalidade ainda não está disponível.',
  FORBIDDEN: 'Não tem permissão para esta operação.',
  IDEMPOTENCY_CONFLICT: 'Esta chave já foi utilizada para outro pedido.',
  INVALID_INPUT: 'O pedido contém dados inválidos.',
  NOT_FOUND: 'O registo não foi encontrado.',
  LEGACY_STATUS_UNMAPPED:
    'Esta mudança ainda não pode ser feita enquanto o sistema anterior estiver ativo.',
});
