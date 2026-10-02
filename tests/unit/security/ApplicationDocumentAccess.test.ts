import { requireActiveApiUser } from '../../../lib/apiUserAuth';
import { admin } from '../../../lib/firebaseAdmin';
import { findExistingStorageFile } from '../../../lib/storageBucket';
import handler from '../../../pages/api/files/application-document';

jest.mock('../../../lib/firebaseAdmin', () => {
  const mockedAdmin = { auth: jest.fn(), firestore: jest.fn() };
  return { __esModule: true, admin: mockedAdmin, default: mockedAdmin };
});
jest.mock('../../../lib/apiUserAuth', () => ({
  requireActiveApiUser: jest.fn(),
}));
jest.mock('../../../lib/storageBucket', () => ({
  findExistingStorageFile: jest.fn(),
}));
jest.mock('../../../lib/serverLog', () => ({ logServerError: jest.fn() }));

const firestoreMock = admin.firestore as unknown as jest.Mock;
const mockedAuth = jest.mocked(requireActiveApiUser);
const mockedFile = jest.mocked(findExistingStorageFile);

const CANDIDATURA = {
  companyId: 'empresa-dona',
  candidateId: 'candidato-1',
  applicationForm: {
    documents: {
      criminal_record: {
        url: 'https://firebasestorage.googleapis.com/v0/b/b/o/candidaturas%2Fcandidato-1%2Fvaga-1%2Fr.pdf',
        storagePath: 'candidaturas/candidato-1/vaga-1/r.pdf',
        name: 'registo.pdf',
      },
    },
  },
};

function comUtilizador(uid: string, userType: string) {
  mockedAuth.mockResolvedValue({
    uid,
    userData: { userType },
  } as unknown as Awaited<ReturnType<typeof requireActiveApiUser>>);
}

function pedido(body: Record<string, unknown>) {
  const res = { json: jest.fn(), setHeader: jest.fn(), status: jest.fn() };
  res.json.mockReturnValue(res);
  res.status.mockReturnValue(res);
  return { req: { method: 'POST', body } as never, res };
}

describe('acesso aos documentos de uma candidatura', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    firestoreMock.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest
            .fn()
            .mockResolvedValue({ exists: true, data: () => CANDIDATURA }),
        }),
      }),
    });
    mockedFile.mockResolvedValue({
      getSignedUrl: jest.fn().mockResolvedValue(['https://assinado/r.pdf']),
    } as never);
  });

  const corpo = { applicationId: 'app-1', documentType: 'criminal_record' };

  test('a empresa dona da vaga abre o documento', async () => {
    comUtilizador('empresa-dona', 'empresa');
    const { req, res } = pedido(corpo);

    await handler(req, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://assinado/r.pdf' }),
    );
  });

  test('outra empresa não abre, mesmo estando autenticada', async () => {
    comUtilizador('empresa-intrusa', 'empresa');
    const { req, res } = pedido(corpo);

    await handler(req, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('outro candidato não abre o documento alheio', async () => {
    comUtilizador('candidato-2', 'candidato');
    const { req, res } = pedido(corpo);

    await handler(req, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('o próprio candidato abre o seu documento', async () => {
    comUtilizador('candidato-1', 'candidato');
    const { req, res } = pedido(corpo);

    await handler(req, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('um caminho fora da pasta do candidato é recusado', async () => {
    firestoreMock.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              ...CANDIDATURA,
              applicationForm: {
                documents: {
                  criminal_record: {
                    storagePath: 'candidaturas/outra-pessoa/vaga-1/r.pdf',
                    name: 'r.pdf',
                  },
                },
              },
            }),
          }),
        }),
      }),
    });
    comUtilizador('empresa-dona', 'empresa');
    const { req, res } = pedido(corpo);

    await handler(req, res as never);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
