import { sendEmail } from '../../../lib/email';
import { admin } from '../../../lib/firebaseAdmin';
import broadcastHandler from '../../../pages/api/newsletter/broadcast';

jest.mock('../../../lib/firebaseAdmin', () => ({
  admin: { auth: jest.fn(), firestore: jest.fn() },
}));

jest.mock('../../../lib/email', () => ({
  isEmailConfigured: jest.fn(() => true),
  sendEmail: jest.fn().mockResolvedValue(undefined),
  getDefaultFrom: jest.fn(() => 'EmpregoSTP <contacto@empregostp.com>'),
}));

jest.mock('../../../lib/serverLog', () => ({ logServerError: jest.fn() }));

const authMock = admin.auth as unknown as jest.Mock;
const firestoreMock = admin.firestore as unknown as jest.Mock;
const sendEmailMock = jest.mocked(sendEmail);

function criarResposta() {
  const resposta = { json: jest.fn(), setHeader: jest.fn(), status: jest.fn() };
  resposta.json.mockReturnValue(resposta);
  resposta.setHeader.mockReturnValue(resposta);
  resposta.status.mockReturnValue(resposta);
  return resposta;
}

const doc = (dados: Record<string, unknown>) => ({ data: () => dados });

/** O primeiro envio, já com o tipo estreitado (o TS não sabe que existe). */
function primeiroEnvio() {
  const chamada = sendEmailMock.mock.calls[0];
  if (!chamada) throw new Error('sendEmail não foi chamado.');
  return chamada[0];
}

/**
 * Monta o Firestore mínimo que a rota percorre: o admin autenticado, a notícia
 * publicada, os subscritores da newsletter e os utilizadores registados.
 */
function montarFirestore({
  subscritores = [] as Record<string, unknown>[],
  utilizadores = [] as Record<string, unknown>[],
  noticia = { status: 'published', title: 'Nova parceria' } as Record<
    string,
    unknown
  >,
}) {
  const postRef = {
    get: jest.fn().mockResolvedValue({ exists: true, data: () => noticia }),
    set: jest.fn(),
  };

  const firestore = () => ({
    collection: (nome: string) => {
      if (nome === 'users') {
        return {
          doc: () => ({
            get: jest
              .fn()
              .mockResolvedValue({
                exists: true,
                data: () => ({ userType: 'admin' }),
              }),
          }),
          get: jest.fn().mockResolvedValue({ docs: utilizadores.map(doc) }),
        };
      }
      if (nome === 'newsletterSubscribers') {
        return {
          where: () => ({
            get: jest.fn().mockResolvedValue({ docs: subscritores.map(doc) }),
          }),
        };
      }
      return { doc: () => postRef };
    },
  });

  return { firestore, postRef };
}

describe('destinatários da newsletter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authMock.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'admin-1' }),
    });
    // O FieldValue vive no próprio mock de admin.firestore, não no objecto que
    // ele devolve — a rota chama admin.firestore.FieldValue.serverTimestamp().
    (admin.firestore as unknown as { FieldValue: unknown }).FieldValue = {
      serverTimestamp: jest.fn(() => 'ts'),
    };
  });

  function pedido() {
    return {
      method: 'POST',
      headers: { authorization: 'Bearer token', host: 'empregostp.com' },
      body: { postId: 'noticia-1', type: 'news' },
    };
  }

  it('junta subscritores e utilizadores registados, sem duplicados', async () => {
    const { firestore } = montarFirestore({
      subscritores: [
        { email: 'subscritor@exemplo.com' },
        { email: 'ambos@exemplo.com' },
      ],
      utilizadores: [
        { email: 'candidato@exemplo.com' },
        { email: 'AMBOS@exemplo.com' },
      ],
    });
    firestoreMock.mockImplementation(firestore);

    const resposta = criarResposta();
    await broadcastHandler(pedido(), resposta);

    const bcc = primeiroEnvio().bcc as string[];
    expect(bcc.sort()).toEqual([
      'ambos@exemplo.com',
      'candidato@exemplo.com',
      'subscritor@exemplo.com',
    ]);
    expect(resposta.json).toHaveBeenCalledWith(
      expect.objectContaining({ sent: 3 }),
    );
  });

  it('não envia a quem desligou as notificações', async () => {
    const { firestore } = montarFirestore({
      utilizadores: [
        { email: 'quer@exemplo.com' },
        {
          email: 'nao-quer@exemplo.com',
          settings: { notifications: { jobAlerts: false } },
        },
      ],
    });
    firestoreMock.mockImplementation(firestore);

    const resposta = criarResposta();
    await broadcastHandler(pedido(), resposta);

    expect(primeiroEnvio().bcc).toEqual(['quer@exemplo.com']);
    expect(resposta.json).toHaveBeenCalledWith(
      expect.objectContaining({ sent: 1, skipped: 1 }),
    );
  });

  it('ignora utilizadores sem email válido', async () => {
    const { firestore } = montarFirestore({
      utilizadores: [
        { email: 'bom@exemplo.com' },
        { email: 'sem-arroba' },
        { nome: 'sem email' },
      ],
    });
    firestoreMock.mockImplementation(firestore);

    const resposta = criarResposta();
    await broadcastHandler(pedido(), resposta);

    expect(primeiroEnvio().bcc).toEqual(['bom@exemplo.com']);
  });

  it('não reenvia uma notícia já difundida', async () => {
    const { firestore } = montarFirestore({
      utilizadores: [{ email: 'alguem@exemplo.com' }],
      noticia: { status: 'published', newsletterSentAt: 'ontem' },
    });
    firestoreMock.mockImplementation(firestore);

    const resposta = criarResposta();
    await broadcastHandler(pedido(), resposta);

    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(resposta.json).toHaveBeenCalledWith(
      expect.objectContaining({ alreadySent: true }),
    );
  });
});
