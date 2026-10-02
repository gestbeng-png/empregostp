import { sendEmail } from '../../../lib/email';
import { admin } from '../../../lib/firebaseAdmin';
import contactHandler from '../../../pages/api/contact/index';

jest.mock('../../../lib/firebaseAdmin', () => ({
  admin: { firestore: jest.fn() },
}));

jest.mock('../../../lib/apiRateLimit', () => ({
  enforceApiRateLimit: jest.fn().mockResolvedValue(true),
  getClientIp: jest.fn(() => '127.0.0.1'),
}));

jest.mock('../../../lib/email', () => ({
  isEmailConfigured: jest.fn(() => true),
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../lib/serverLog', () => ({ logServerError: jest.fn() }));

const firestoreMock = admin.firestore as unknown as jest.Mock;
const sendEmailMock = jest.mocked(sendEmail);

function criarResposta() {
  const resposta = { json: jest.fn(), setHeader: jest.fn(), status: jest.fn() };
  resposta.json.mockReturnValue(resposta);
  resposta.setHeader.mockReturnValue(resposta);
  resposta.status.mockReturnValue(resposta);
  return resposta;
}

function envioFeito() {
  const chamada = sendEmailMock.mock.calls[0];
  if (!chamada) throw new Error('sendEmail não foi chamado.');
  return chamada[0];
}

describe('formulário de carreiras (POST /api/contact)', () => {
  let addMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    addMock = jest.fn().mockResolvedValue({ id: 'msg-1' });
    firestoreMock.mockReturnValue({ collection: () => ({ add: addMock }) });
    (admin.firestore as unknown as { FieldValue: unknown }).FieldValue = {
      serverTimestamp: jest.fn(() => 'ts'),
    };
  });

  function pedido(corpo: Record<string, unknown>) {
    return { method: 'POST', headers: {}, body: corpo };
  }

  const candidatura = {
    name: 'Ana Trindade',
    email: 'ana@exemplo.com',
    subject: 'carreira',
    message: 'Sou designer e gostava de ajudar na experiência dos candidatos.',
    source: 'carreiras',
  };

  it('envia para a caixa institucional com o email do candidato em resposta', async () => {
    const resposta = criarResposta();
    await contactHandler(pedido(candidatura), resposta);

    const enviado = envioFeito();
    expect(enviado.to).toBe('contacto@empregostp.com');
    expect(enviado.replyTo).toBe('ana@exemplo.com');
    expect(resposta.status).toHaveBeenCalledWith(201);
  });

  it('distingue a candidatura de uma mensagem de contacto comum', async () => {
    const resposta = criarResposta();
    await contactHandler(pedido(candidatura), resposta);

    const enviado = envioFeito();
    expect(enviado.subject).toBe(
      // O remetente já é "EmpregoSTP": repetir a marca no assunto rouba
      // espaço à parte que distingue a mensagem na lista do Gmail.
      'Candidatura espontânea: Ana Trindade',
    );
    expect(enviado.html).toContain('EmpregoSTP &middot; Carreiras');
    expect(enviado.html).toContain('Quer juntar-se à equipa');
  });

  it('guarda a mensagem com a origem carreiras', async () => {
    await contactHandler(pedido(candidatura), criarResposta());

    expect(addMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'carreira',
        source: 'carreiras',
        status: 'new',
      }),
    );
  });

  it('mantém o formato antigo para o formulário de contacto', async () => {
    const resposta = criarResposta();
    await contactHandler(
      pedido({
        name: 'João Carvalho',
        email: 'joao@exemplo.com',
        subject: 'empresa',
        message: 'Queria saber como publicar vagas.',
      }),
      resposta,
    );

    const enviado = envioFeito();
    expect(enviado.subject).toBe('Contacto · Sou empresa — João Carvalho');
    expect(enviado.html).toContain('EmpregoSTP &middot; Contacto');
  });

  it('recusa uma candidatura sem email válido', async () => {
    const resposta = criarResposta();
    await contactHandler(
      pedido({ ...candidatura, email: 'sem-arroba' }),
      resposta,
    );

    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(resposta.status).toHaveBeenCalledWith(400);
  });
});
