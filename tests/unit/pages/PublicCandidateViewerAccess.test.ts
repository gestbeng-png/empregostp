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
    req: { headers: {} },
    res: {},
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
