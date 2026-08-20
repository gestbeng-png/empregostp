export const pt = {
  common: {
    saving: 'A guardar...',
  },
  candidateSettings: {
    accountBadge: 'Conta de candidato',
    api: {
      candidateOnly: 'Esta área está disponível apenas para candidatos.',
      invalidPreferences: 'Confirme as preferências e tente novamente.',
      methodNotAllowed: 'Este pedido não está disponível.',
      notFound: 'Não encontrámos esta conta de candidato.',
      sessionExpired: 'A sessão terminou. Inicie sessão novamente.',
      unexpected:
        'Não foi possível concluir o pedido. Tente novamente em instantes.',
    },
    deleteAccount: {
      action: 'Contactar suporte',
      description:
        'A eliminação remove o acesso ao perfil e aos dados associados.',
      notice:
        'Fale com a equipa de suporte para confirmar a identidade e iniciar o pedido.',
      noticeTitle: 'Esta ação requer validação',
      title: 'Eliminar conta',
    },
    emptySearch: {
      description: 'Tente pesquisar por conta, alertas, privacidade ou idioma.',
      title: 'Nenhuma configuração encontrada',
    },
    feedback: {
      passwordSaved: 'Palavra-passe atualizada.',
      preferencesSaved: 'Preferências guardadas.',
      saveFailed:
        'Não foi possível guardar as preferências. Tente novamente em instantes.',
    },
    header: {
      eyebrow: 'Preferências',
      subtitle: 'Gerencie a sua conta, notificações e privacidade.',
      title: 'Configurações do sistema',
    },
    language: {
      description: 'Escolha o idioma usado nos menus e comunicações.',
      label: 'Idioma',
      options: {
        en: 'English',
        ptPT: 'Português',
        ptST: 'Português de São Tomé e Príncipe',
      },
      save: 'Guardar idioma',
      title: 'Idioma da plataforma',
    },
    navigation: {
      account: 'Conta',
      accountKeywords: 'palavra-passe segurança autenticação email',
      delete: 'Eliminar conta',
      deleteKeywords: 'apagar remover encerrar conta',
      label: 'Secções de configurações',
      language: 'Idioma',
      languageKeywords: 'português linguagem',
      notifications: 'Notificações',
      notificationsKeywords: 'alertas vagas mensagens entrevistas resumo',
      privacy: 'Privacidade',
      privacyKeywords: 'visibilidade perfil contactos pesquisa atividade',
    },
    notifications: {
      description: 'Controle a frequência e o tipo de comunicação recebida.',
      emailDescription:
        'Escolha os avisos que devem chegar à sua caixa de entrada.',
      emailTitle: 'Notificações por email',
      rows: {
        directMessages: {
          accountDescription:
            'Novas mensagens enviadas por empresas e recrutadores.',
          description:
            'Avisos quando uma empresa iniciar ou responder a uma conversa.',
          title: 'Mensagens diretas',
        },
        interviewUpdates: {
          accountDescription:
            'Agendamentos, alterações e lembretes de entrevistas.',
          description: 'Convites, reagendamentos e lembretes importantes.',
          title: 'Entrevistas',
        },
        jobAlerts: {
          accountDescription:
            'Vagas compatíveis com o seu perfil e preferências.',
          description: 'Sugestões de oportunidades alinhadas ao seu perfil.',
          title: 'Alertas de novas vagas',
        },
        platformUpdates: {
          description: 'Novidades relevantes sobre a sua conta e a plataforma.',
          title: 'Atualizações da plataforma',
        },
        weeklyDigest: {
          description: 'Um resumo das candidaturas, mensagens e oportunidades.',
          title: 'Resumo semanal',
        },
      },
      save: 'Guardar preferências',
      title: 'Preferências de notificações',
    },
    password: {
      confirmLabel: 'Confirmar nova palavra-passe',
      currentLabel: 'Palavra-passe atual',
      description: 'Atualize as credenciais usadas para entrar na plataforma.',
      errors: {
        generic:
          'Não foi possível alterar a palavra-passe. Tente novamente em instantes.',
        invalidCredential: 'A palavra-passe atual está incorreta.',
        mismatch: 'A confirmação não corresponde à nova palavra-passe.',
        offline:
          'Sem ligação à internet. Verifique a sua rede e tente novamente.',
        provider: 'Esta conta não permite alterar a palavra-passe nesta área.',
        recentLogin:
          'Inicie sessão novamente antes de alterar a palavra-passe.',
        tooManyRequests:
          'Foram feitas demasiadas tentativas. Aguarde alguns minutos.',
        weak: 'A nova palavra-passe deve ter pelo menos 8 caracteres.',
      },
      newLabel: 'Nova palavra-passe',
      providerDescription:
        'A palavra-passe desta conta é gerida pelo serviço usado no início de sessão.',
      providerTitle: 'Entrada gerida pelo seu provedor',
      save: 'Guardar palavra-passe',
      title: 'Segurança da conta',
      twoFactorDescription:
        'Uma camada adicional de segurança para a sua conta.',
      twoFactorLabel: 'Autenticação em dois passos',
      twoFactorSoon: 'Brevemente',
    },
    privacy: {
      description:
        'Defina quem pode encontrar e consultar as suas informações.',
      profileVisibility: 'Visibilidade do perfil',
      rows: {
        allowSearchEngines: {
          description: 'Autorizar a indexação pública do perfil profissional.',
          title: 'Permitir motores de pesquisa',
        },
        showActivityStatus: {
          description:
            'Indicar às empresas quando atualizou o perfil recentemente.',
          title: 'Mostrar estado de atividade',
        },
        showContactInfo: {
          description: 'Permitir que empresas vejam o seu email e telemóvel.',
          title: 'Mostrar contactos',
        },
      },
      save: 'Guardar privacidade',
      title: 'Privacidade do perfil',
      visibilityOptions: {
        private: 'Privado',
        public: 'Público',
        recruiters: 'Empresas registadas',
      },
    },
  },
} as const;
