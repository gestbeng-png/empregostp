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
      action: 'Pedir eliminação',
      cancel: 'Cancelar o pedido',
      cancelled: 'Pedido cancelado. A sua conta mantém-se.',
      confirmLabel: 'Escreva ELIMINAR para confirmar',
      description:
        'A eliminação remove o acesso ao perfil e aos dados associados.',
      kept:
        'As candidaturas ficam anonimizadas — as empresas veem «Candidato removido», sem contactos nem ficheiros — e as em curso são retiradas. Os comprovativos de pagamento mantêm-se pelo prazo fiscal.',
      loading: 'A verificar o estado da conta…',
      notice:
        'Durante 7 dias pode cancelar o pedido. Depois, o perfil, o CV, os documentos, os alertas, as vagas guardadas e as notificações são apagados e o acesso termina.',
      noticeTitle: 'Esta ação não pode ser desfeita depois do prazo',
      pendingDescription:
        'O perfil já não aparece em pesquisas. A conta é eliminada a partir de {date}.',
      pendingTitle: 'Eliminação pedida',
      reauthHint:
        'Por segurança, só é aceite nos 5 minutos seguintes a iniciar sessão.',
      requested: 'Pedido registado. Enviámos a confirmação para o seu email.',
      sending: 'A enviar…',
      support: 'Falar com o suporte',
      title: 'Eliminar conta',
    },
    exportData: {
      action: 'Descarregar os meus dados',
      description:
        'Um ficheiro com o perfil, as candidaturas, os alertas, as notificações e links para os seus ficheiros (válidos 48 horas).',
      done: 'Ficheiro descarregado.',
      preparing: 'A preparar…',
      title: 'Exportar dados',
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
  jobSafety: {
    notice: 'O EmpregoSTP nunca pede pagamentos para se candidatar.',
    noticeAction: 'Se lhe pedirem dinheiro, denuncie.',
    askedForMoney: 'Pediram-me dinheiro',
    reportTitle: 'Denunciar esta vaga',
    reasonLabel: 'Motivo',
    detailsLabel: 'O que aconteceu? (opcional)',
    detailsHint:
      'Não escreva palavras-passe nem dados bancários. A empresa nunca sabe quem denunciou.',
    submit: 'Enviar denúncia',
    sending: 'A enviar…',
    cancel: 'Cancelar',
    loginRequired: 'Inicie sessão para denunciar esta vaga.',
    login: 'Iniciar sessão',
    failed: 'Não foi possível enviar a denúncia. Tente novamente.',
    reasons: {
      ASKED_FOR_MONEY: 'Pediram-me dinheiro',
      FAKE_JOB: 'A vaga parece falsa',
      PHISHING: 'Pediram dados pessoais ou bancários suspeitos',
      DISCRIMINATION: 'Conteúdo discriminatório',
      INAPPROPRIATE: 'Conteúdo impróprio',
      SPAM: 'Spam ou publicidade',
      DUPLICATE: 'Vaga repetida',
      EXPIRED_STILL_LISTED: 'A vaga já foi preenchida ou encerrou',
      OTHER: 'Outro motivo',
    },
  },
} as const;
