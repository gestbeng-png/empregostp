import { requireActiveApiUser } from '../../../lib/apiUserAuth';
import { admin } from '../../../lib/firebaseAdmin';
import handler from '../../../pages/api/profile/update';

jest.mock('../../../lib/firebaseAdmin', () => {
  const firestore = Object.assign(jest.fn(), {
    FieldValue: { serverTimestamp: jest.fn(() => 'server-timestamp') },
  });
  const mockedAdmin = { auth: jest.fn(), firestore };
  return { __esModule: true, admin: mockedAdmin, default: mockedAdmin };
});

jest.mock('../../../lib/apiUserAuth', () => ({
  requireActiveApiUser: jest.fn(),
}));

jest.mock('../../../lib/serverLog', () => ({ logServerError: jest.fn() }));

const firestoreMock = admin.firestore as unknown as jest.Mock;
const mockedAuth = jest.mocked(requireActiveApiUser);

const CERTIFICADOS = ['https://exemplo.st/cert-a.pdf'];

function montarFirestore(certificadosGuardados: string[]) {
  const profileSet = jest.fn().mockResolvedValue(undefined);
  const profileRef = {
    set: profileSet,
    get: jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({ certificateFiles: certificadosGuardados }),
    }),
  };
  firestoreMock.mockReturnValue({
    collection: jest.fn().mockReturnValue({
      doc: jest.fn().mockReturnValue(profileRef),
    }),
  });
  return { profileSet };
}

function montarUtilizador(userType: string) {
  const update = jest.fn().mockResolvedValue(undefined);
  mockedAuth.mockResolvedValue({
    uid: 'user-1',
    userData: { userType, email: 'pessoa@exemplo.st' },
    userRef: {
      update,
      get: jest.fn().mockResolvedValue({ data: () => ({ userType }) }),
    },
  } as unknown as Awaited<ReturnType<typeof requireActiveApiUser>>);
  return { update };
}

function pedido(body: Record<string, unknown>) {
  const res = {
    json: jest.fn(),
    setHeader: jest.fn(),
    status: jest.fn(),
  };
  res.json.mockReturnValue(res);
  res.status.mockReturnValue(res);
  return { req: { method: 'POST', body } as never, res };
}

describe('gravação de perfil com certificados inalterados', () => {
  beforeEach(() => jest.clearAllMocks());

  test('empresa não edita um perfil de candidato, mesmo com certificados inalterados', async () => {
    montarFirestore(CERTIFICADOS);
    montarUtilizador('empresa');
    const { req, res } = pedido({
      bio: 'Uma bio nova.',
      certificateFiles: [...CERTIFICADOS],
    });

    await handler(req, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('mudar a lista continua a ser exclusivo de candidatos', async () => {
    montarFirestore(CERTIFICADOS);
    montarUtilizador('empresa');
    const { req, res } = pedido({
      bio: 'Uma bio nova.',
      certificateFiles: [...CERTIFICADOS, 'https://exemplo.st/cert-b.pdf'],
    });

    await handler(req, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Apenas candidatos podem editar este perfil.',
    });
  });

  test.each(['admin', 'empresa', 'desconhecido'])(
    'a conta %s não altera sequer campos básicos de candidato',
    async (role) => {
      const { profileSet } = montarFirestore(CERTIFICADOS);
      const { update } = montarUtilizador(role);
      const { req, res } = pedido({ name: 'Alterado', bio: 'Alterada' });
      await handler(req, res as never);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(update).not.toHaveBeenCalled();
      expect(profileSet).not.toHaveBeenCalled();
    },
  );

  test('o resto do perfil é gravado mesmo quando os certificados não mudam', async () => {
    const { profileSet } = montarFirestore(CERTIFICADOS);
    montarUtilizador('candidato');
    const { req, res } = pedido({
      bio: 'Uma bio nova.',
      location: 'Água Grande',
      certificateFiles: [...CERTIFICADOS],
    });

    await handler(req, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(profileSet).toHaveBeenCalledWith(
      expect.objectContaining({ bio: 'Uma bio nova.', city: 'Água Grande' }),
      { merge: true },
    );
    // Não foi tocado, por isso não deve ser reescrito.
    expect(profileSet.mock.calls[0]?.[0]).not.toHaveProperty(
      'certificateFiles',
    );
  });
});
