import type { GetServerSidePropsContext } from 'next';

const verifyIdToken = jest.fn();
const docGet = jest.fn();
const getEmpresaPlanSummary = jest.fn();

let mockCookies: Record<string, string> = {};

jest.mock('nookies', () => ({
  __esModule: true,
  default: { get: () => mockCookies },
  get: () => mockCookies,
}));

jest.mock('../../../lib/firebaseAdmin', () => ({
  admin: {
    auth: () => ({ verifyIdToken }),
    firestore: () => ({
      collection: (nome: string) => ({
        doc: (id: string) => ({ get: () => docGet(nome, id) }),
      }),
    }),
  },
}));

// A página é pesada do lado do cliente; o alvo aqui é só o `getServerSideProps`.
jest.mock('../../../components/PublicPageShell', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../../lib/firebase', () => ({
  app: {},
  auth: {},
  db: {},
  storage: {},
}));

jest.mock('../../../lib/empresaPlanFeatures', () => ({
  getEmpresaPlanSummary: (...args: unknown[]) => getEmpresaPlanSummary(...args),
  getEmpresaPlanFeatures: jest.fn(),
  normalizeEmpresaPlanId: jest.fn(),
}));

import { getServerSideProps } from '../../../pages/candidatos/[id]';

// A rota pública só mostra candidatos verificados.
const CANDIDATO = {
  userType: 'candidato',
  fullName: 'Ana de Sousa',
  headline: 'Gestora de projetos',
  email: 'ana@exemplo.st',
  phone: '+239 900 0000',
  verified: true,
};

const PERFIL_PUBLICO = {
  settings: { privacy: { profileVisibility: 'public' } },
  headline: 'Gestora de projetos',
  // O formulário do candidato grava a localização em `city`, não em `location`.
  city: 'Água Grande',
  objectiveAspiration: 'Liderar equipas de produto em São Tomé.',
  certifications: 'PMP - PMI\nScrum Master I',
};

function contexto() {
  return {
    params: { id: 'candidato-1' },
    resolvedUrl: '/candidatos/candidato-1',
    req: { headers: {} },
    res: { setHeader: jest.fn() },
  } as unknown as GetServerSidePropsContext;
}

describe('perfil público do candidato visto por uma empresa', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCookies = { token: 'token-empresa' };
    verifyIdToken.mockResolvedValue({ uid: 'empresa-1' });
    getEmpresaPlanSummary.mockReturnValue({
      planName: 'Profissional',
      features: { accessTalentPool: true, canViewCandidateContact: true },
    });

    docGet.mockImplementation((colecao: string, id: string) => {
      if (colecao === 'users' && id === 'empresa-1') {
        return Promise.resolve({
          exists: true,
          data: () => ({ userType: 'empresa' }),
        });
      }
      if (colecao === 'users') {
        return Promise.resolve({ exists: true, data: () => CANDIDATO });
      }
      return Promise.resolve({ exists: true, data: () => PERFIL_PUBLICO });
    });
  });

  test('nenhuma prop sai como undefined — o Next recusaria serializar', async () => {
    const resultado = (await getServerSideProps(contexto())) as {
      props: { viewerAccess: Record<string, unknown> };
    };

    const valoresIndefinidos = Object.entries(
      resultado.props.viewerAccess,
    ).filter(([, valor]) => valor === undefined);

    expect(valoresIndefinidos).toEqual([]);
    expect(JSON.stringify(resultado.props)).toEqual(expect.any(String));
  });

  test('Premium ativo sem flags recebe selo e não dá 404 no perfil público', async () => {
    const existingGet = docGet.getMockImplementation();
    docGet.mockImplementation((collection: string, id: string) => {
      if (collection === 'users' && id === 'candidato-1') {
        return Promise.resolve({
          exists: true,
          data: () => ({
            ...CANDIDATO,
            verified: false,
            verificationStatus: 'pending',
            currentPlan: 'unlimited_candidato',
            planEndDate: '2099-01-01',
          }),
        });
      }
      return existingGet?.(collection, id);
    });
    const result = await getServerSideProps(contexto());
    expect(result).toMatchObject({
      props: {
        candidato: {
          verified: true,
          paidVerified: true,
          qualifiedVerified: false,
        },
      },
    });
  });

  test('a empresa é reconhecida como tal, e não como admin nem dona do perfil', async () => {
    const resultado = (await getServerSideProps(contexto())) as {
      props: { viewerAccess: Record<string, unknown> };
    };

    expect(resultado.props.viewerAccess).toMatchObject({
      userType: 'empresa',
      isEmpresa: true,
      isAdmin: false,
      isOwner: false,
      planName: 'Profissional',
    });
  });

  test('sem sessão, o visitante fica com o acesso mínimo e serializável', async () => {
    mockCookies = {};

    const resultado = (await getServerSideProps(contexto())) as {
      props: { viewerAccess: Record<string, unknown> };
    };

    expect(resultado.props.viewerAccess).toMatchObject({
      userType: 'guest',
      isEmpresa: false,
      isAdmin: false,
      canViewDetailedInfo: false,
      planName: null,
    });
  });

  test('a localização vem de `profiles.city`, o campo que o formulário grava', async () => {
    const resultado = (await getServerSideProps(contexto())) as {
      props: { candidato: Record<string, unknown> };
    };

    expect(resultado.props.candidato.location).toBe('Água Grande');
  });

  test('o título profissional aparece mesmo sem acesso ao banco de talentos', async () => {
    getEmpresaPlanSummary.mockReturnValue({
      planName: 'Básico',
      features: { accessTalentPool: false, canViewCandidateContact: false },
    });

    const resultado = (await getServerSideProps(contexto())) as {
      props: { candidato: Record<string, unknown> };
    };

    expect(resultado.props.candidato).toMatchObject({
      headline: 'Gestora de projetos',
      objectiveAspiration: '',
      certifications: [],
    });
  });

  test('o plano PRO permite mensagem mesmo quando o candidato esconde contactos', async () => {
    getEmpresaPlanSummary.mockReturnValue({
      planName: 'PRO',
      features: {
        accessTalentPool: true,
        canViewCandidateContact: true,
        canSendDirectMessages: true,
      },
    });

    const resultado = (await getServerSideProps(contexto())) as {
      props: {
        candidato: Record<string, unknown>;
        viewerAccess: Record<string, unknown>;
      };
    };

    expect(resultado.props.viewerAccess).toMatchObject({
      canMessageCandidate: true,
      canViewContactDetails: false,
      contactHiddenByCandidate: true,
    });
    expect(resultado.props.candidato).toMatchObject({
      email: '',
      phone: '',
      hasCv: false,
    });
  });

  test('quando o candidato mostra os contactos, o plano PRO vê-os', async () => {
    getEmpresaPlanSummary.mockReturnValue({
      planName: 'PRO',
      features: {
        accessTalentPool: true,
        canViewCandidateContact: true,
        canSendDirectMessages: true,
      },
    });
    docGet.mockImplementation((colecao: string, id: string) => {
      if (colecao === 'users' && id === 'empresa-1') {
        return Promise.resolve({
          exists: true,
          data: () => ({ userType: 'empresa' }),
        });
      }
      if (colecao === 'users') {
        return Promise.resolve({ exists: true, data: () => CANDIDATO });
      }
      return Promise.resolve({
        exists: true,
        data: () => ({
          ...PERFIL_PUBLICO,
          settings: {
            privacy: { profileVisibility: 'public', showContactInfo: true },
          },
        }),
      });
    });

    const resultado = (await getServerSideProps(contexto())) as {
      props: {
        candidato: Record<string, unknown>;
        viewerAccess: Record<string, unknown>;
      };
    };

    expect(resultado.props.viewerAccess).toMatchObject({
      canMessageCandidate: true,
      canViewContactDetails: true,
      contactHiddenByCandidate: false,
    });
    expect(resultado.props.candidato).toMatchObject({
      email: 'ana@exemplo.st',
      phone: '+239 900 0000',
    });
  });

  test('com acesso ao banco de talentos, objetivo e certificações são expostos', async () => {
    const resultado = (await getServerSideProps(contexto())) as {
      props: { candidato: Record<string, unknown> };
    };

    expect(resultado.props.candidato).toMatchObject({
      objectiveAspiration: 'Liderar equipas de produto em São Tomé.',
      certifications: ['PMP - PMI', 'Scrum Master I'],
    });
  });
});

describe('perfil existente não é confundido com falta de sessão', () => {
  function install({
    viewer = 'guest',
    visibility = 'recruiters',
    viewerStatus = 'active',
    exists = true,
    candidate = CANDIDATO,
  } = {}) {
    mockCookies = viewer === 'guest' ? {} : { token: 'viewer-token' };
    const viewerUid = viewer === 'owner' ? 'candidato-1' : 'viewer-1';
    verifyIdToken.mockResolvedValue({ uid: viewerUid });
    docGet.mockImplementation(async (collection: string, id: string) => {
      if (collection === 'users' && id === 'viewer-1') {
        return {
          exists: true,
          data: () => ({ userType: viewer, status: viewerStatus }),
        };
      }
      if (collection === 'users') return { exists, data: () => candidate };
      return {
        exists: true,
        data: () => ({
          ...PERFIL_PUBLICO,
          settings: {
            privacy: { profileVisibility: visibility, showContactInfo: false },
          },
        }),
      };
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    getEmpresaPlanSummary.mockReturnValue({
      planName: 'Profissional',
      features: { accessTalentPool: true },
    });
    install();
  });

  test('sem cookie, encaminha para login e preserva o perfil pedido sem devolver dados privados', async () => {
    const ctx = contexto();
    ctx.resolvedUrl += '?source=verified';
    await expect(getServerSideProps(ctx)).resolves.toEqual({
      redirect: {
        destination:
          '/login?redirect=%2Fcandidatos%2Fcandidato-1%3Fsource%3Dverified',
        permanent: false,
      },
    });
  });

  test('sessão expirada não transforma um perfil verificado num 404', async () => {
    install({ viewer: 'admin' });
    verifyIdToken.mockRejectedValueOnce(new Error('expired'));
    await expect(getServerSideProps(contexto())).resolves.toEqual({
      redirect: {
        destination: '/login?redirect=%2Fcandidatos%2Fcandidato-1',
        permanent: false,
      },
    });
    expect(verifyIdToken).toHaveBeenCalledWith('viewer-token', true);
  });

  test.each(['admin', 'empresa', 'owner'])(
    'uma sessão válida %s abre o perfil reservado a recrutadores',
    async (viewer) => {
      install({ viewer });
      const result = (await getServerSideProps(contexto())) as {
        props: {
          candidato: Record<string, unknown>;
          viewerAccess: Record<string, unknown>;
        };
      };
      expect(result.props.candidato).toMatchObject({
        id: 'candidato-1',
        verified: true,
      });
      expect(result.props.viewerAccess).toMatchObject({
        isAdmin: viewer === 'admin',
        isEmpresa: viewer === 'empresa',
        isOwner: viewer === 'owner',
      });
    },
  );

  test('admin não ganha edição nem se torna dono do candidato ao abrir o perfil', async () => {
    install({ viewer: 'admin' });
    const result = (await getServerSideProps(contexto())) as {
      props: { viewerAccess: Record<string, unknown> };
    };
    expect(result.props.viewerAccess).toMatchObject({
      userType: 'admin',
      isAdmin: true,
      isOwner: false,
      isEmpresa: false,
    });
  });

  test('perfil público continua a abrir sem autenticação e sem contactos', async () => {
    install({ visibility: 'public' });
    const result = (await getServerSideProps(contexto())) as {
      props: { candidato: Record<string, unknown> };
    };
    expect(result.props.candidato).toMatchObject({
      verified: true,
      email: '',
      phone: '',
      hasCv: false,
    });
  });

  test.each(['guest', 'empresa', 'candidato'])(
    'perfil privado continua oculto para %s',
    async (viewer) => {
      install({ viewer, visibility: 'private' });
      await expect(getServerSideProps(contexto())).resolves.toEqual({
        notFound: true,
      });
    },
  );

  test('outra conta de candidato não herda acesso de recrutador', async () => {
    install({ viewer: 'candidato' });
    // Perfil reservado a empresas: a página explica a reserva em vez de um 404
    // que parecia avaria a quem vinha de /verificados. O contrato é não enviar
    // nenhum dado do candidato nesta resposta.
    const result = (await getServerSideProps(contexto())) as {
      props?: Record<string, unknown>;
    };
    expect(result).toEqual({ props: { restricted: true } });
    expect(result.props).not.toHaveProperty('candidato');
    expect(JSON.stringify(result)).not.toContain('@');
  });

  test.each(['suspended', 'disabled', 'inactive', 'deleted'])(
    'a conta admin %s não pode ler o perfil',
    async (viewerStatus) => {
      install({ viewer: 'admin', viewerStatus });
      const result = await getServerSideProps(contexto());
      expect(result).toHaveProperty('redirect');
      expect(result).not.toHaveProperty('props');
    },
  );

  test('perfil inexistente mantém o verdadeiro 404', async () => {
    install({ exists: false });
    await expect(getServerSideProps(contexto())).resolves.toEqual({
      notFound: true,
    });
  });

  test('candidato não verificado não aparece publicamente', async () => {
    install({
      visibility: 'public',
      candidate: { ...CANDIDATO, verified: false },
    });
    await expect(getServerSideProps(contexto())).resolves.toEqual({
      notFound: true,
    });
  });

  test('resposta personalizada não pode ficar em cache', async () => {
    const ctx = contexto();
    await getServerSideProps(ctx);
    expect(ctx.res.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'private, no-store, max-age=0',
    );
  });

  test('falha do Firestore não é apresentada como candidato inexistente nem expõe detalhes no log', async () => {
    const log = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    docGet.mockRejectedValueOnce(new Error('private-canary@example.test'));
    try {
      await expect(getServerSideProps(contexto())).rejects.toThrow(
        'Não foi possível carregar o perfil. Tente novamente.',
      );
      expect(JSON.stringify(log.mock.calls)).not.toContain('private-canary');
    } finally {
      log.mockRestore();
    }
  });
});
