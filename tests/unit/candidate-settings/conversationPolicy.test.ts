import {
  canUsersContinueConversation,
  canUsersStartConversation,
} from '../../../lib/conversationPolicy';

describe('política de início de conversas', () => {
  test('permite conversas entre empresa e candidato disponível', () => {
    expect(
      canUsersStartConversation({
        requester: { userType: 'empresa' },
        participant: { userType: 'candidato' },
        participantProfile: {
          settings: { privacy: { profileVisibility: 'recruiters' } },
        },
      }),
    ).toEqual({ allowed: true });
  });

  test('bloqueia uma empresa quando o candidato escolheu perfil privado', () => {
    expect(
      canUsersStartConversation({
        requester: { userType: 'empresa' },
        participant: { userType: 'candidato' },
        participantProfile: {
          settings: { privacy: { profileVisibility: 'private' } },
        },
      }).allowed,
    ).toBe(false);
  });

  test('bloqueia um candidato privado antes de iniciar uma conversa que a empresa não poderia responder', () => {
    expect(
      canUsersStartConversation({
        requester: { userType: 'candidato' },
        requesterProfile: {
          settings: { privacy: { profileVisibility: 'private' } },
        },
        participant: { userType: 'empresa' },
      }).allowed,
    ).toBe(false);
  });

  test('bloqueia conversas diretas entre contas do mesmo tipo', () => {
    expect(
      canUsersStartConversation({
        requester: { userType: 'candidato' },
        participant: { userType: 'candidato' },
      }).allowed,
    ).toBe(false);
  });
});

describe('política de continuidade de conversas', () => {
  test('preserva respostas numa conversa existente entre empresa e candidato', () => {
    expect(
      canUsersContinueConversation({
        requester: { userType: 'empresa' },
        participant: { userType: 'candidato' },
      }),
    ).toEqual({ allowed: true });
  });

  test('bloqueia mensagens quando os papéis deixam de ser compatíveis', () => {
    expect(
      canUsersContinueConversation({
        requester: { userType: 'empresa' },
        participant: { userType: 'empresa' },
      }).allowed,
    ).toBe(false);
  });
});
