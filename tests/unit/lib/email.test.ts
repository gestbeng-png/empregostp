import type * as ModuloEmail from '../../../lib/email';

// O nodemailer não traz tipos, por isso o mock é referenciado directamente em
// vez de importar o módulo (o prefixo `mock` é o que o jest.mock permite içar).
const mockCreateTransport = jest.fn();

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: { createTransport: mockCreateTransport },
}));

const VARIAVEIS = [
  'BREVO_API_KEY',
  'BREVO_SMTP_LOGIN',
  'BREVO_SMTP_KEY',
  'ZOHO_SMTP_USER',
  'ZOHO_SMTP_PASSWORD',
  'GMAIL_USER',
  'GMAIL_APP_PASSWORD',
  'EMAIL_FROM_ADDRESS',
  'EMAIL_REPLY_TO',
  'EMAIL_FROM_NAME',
] as const;

async function carregarModulo() {
  let modulo!: typeof ModuloEmail;
  await jest.isolateModulesAsync(async () => {
    modulo = await import('../../../lib/email');
  });
  return modulo;
}

describe('lib/email', () => {
  const originais = new Map<string, string | undefined>();
  let sendMailMock: jest.Mock;
  let fetchMock: jest.Mock;

  beforeAll(() => {
    VARIAVEIS.forEach((nome) => originais.set(nome, process.env[nome]));
  });

  beforeEach(() => {
    VARIAVEIS.forEach((nome) => Reflect.deleteProperty(process.env, nome));
    sendMailMock = jest.fn().mockResolvedValue({ messageId: 'smtp-1' });
    mockCreateTransport.mockReset();
    mockCreateTransport.mockReturnValue({ sendMail: sendMailMock } as never);
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      text: async () => JSON.stringify({ messageId: 'brevo-1' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterAll(() => {
    originais.forEach((valor, nome) => {
      if (valor === undefined) Reflect.deleteProperty(process.env, nome);
      else process.env[nome] = valor;
    });
  });

  it('não se considera configurado sem nenhum fornecedor', async () => {
    const { isEmailConfigured } = await carregarModulo();
    expect(isEmailConfigured()).toBe(false);
  });

  it('rejeita o envio sem fornecedor com o código EMAIL_NOT_CONFIGURED', async () => {
    const { sendEmail } = await carregarModulo();
    await expect(sendEmail({ to: 'a@b.com', subject: 'x', html: '<p>x</p>' })).rejects.toMatchObject({
      code: 'EMAIL_NOT_CONFIGURED',
    });
  });

  it('envia pela API do Brevo quando existe BREVO_API_KEY', async () => {
    process.env.BREVO_API_KEY = 'xkeysib-teste';
    process.env.EMAIL_FROM_ADDRESS = 'contacto@empregostp.com';
    process.env.EMAIL_REPLY_TO = 'contacto@empregostp.com';

    const { sendEmail } = await carregarModulo();
    const resultado = await sendEmail({
      to: 'candidato@exemplo.com',
      subject: 'Assunto',
      html: '<p>Olá</p>',
      text: 'Olá',
    });

    expect(sendMailMock).not.toHaveBeenCalled();
    expect(resultado).toEqual({ messageId: 'brevo-1' });

    const [url, opcoes] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect((opcoes.headers as Record<string, string>)['api-key']).toBe('xkeysib-teste');

    const payload = JSON.parse(opcoes.body as string);
    expect(payload.sender).toEqual({ name: 'EmpregoSTP', email: 'contacto@empregostp.com' });
    expect(payload.to).toEqual([{ email: 'candidato@exemplo.com' }]);
    expect(payload.replyTo).toEqual({ email: 'contacto@empregostp.com' });
    expect(payload.htmlContent).toBe('<p>Olá</p>');
  });

  it('converte a lista de bcc em destinatários separados', async () => {
    process.env.BREVO_API_KEY = 'xkeysib-teste';
    process.env.EMAIL_FROM_ADDRESS = 'contacto@empregostp.com';

    const { sendEmail, getDefaultFrom } = await carregarModulo();
    await sendEmail({
      to: getDefaultFrom(),
      bcc: ['um@exemplo.com', 'dois@exemplo.com'],
      subject: 'Nova vaga',
      html: '<p>vaga</p>',
    });

    const payload = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(payload.to).toEqual([{ name: 'EmpregoSTP', email: 'contacto@empregostp.com' }]);
    expect(payload.bcc).toEqual([{ email: 'um@exemplo.com' }, { email: 'dois@exemplo.com' }]);
  });

  it('propaga a falha da API do Brevo como EMAIL_SEND_FAILED', async () => {
    process.env.BREVO_API_KEY = 'xkeysib-teste';
    process.env.EMAIL_FROM_ADDRESS = 'contacto@empregostp.com';
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ message: 'Key not found' }),
    });

    const { sendEmail } = await carregarModulo();
    await expect(sendEmail({ to: 'a@b.com', subject: 'x', html: '<p>x</p>' })).rejects.toMatchObject({
      code: 'EMAIL_SEND_FAILED',
      message: expect.stringContaining('401'),
    });
  });

  it('usa o SMTP relay do Brevo quando não há chave de API', async () => {
    process.env.BREVO_SMTP_LOGIN = 'login@smtp-brevo.com';
    process.env.BREVO_SMTP_KEY = 'smtp-key';
    process.env.EMAIL_FROM_ADDRESS = 'contacto@empregostp.com';

    const { sendEmail } = await carregarModulo();
    await sendEmail({ to: 'a@b.com', subject: 'x', html: '<p>x</p>' });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'smtp-relay.brevo.com', port: 587 }),
    );
    expect(sendMailMock.mock.calls[0][0].from).toBe('EmpregoSTP <contacto@empregostp.com>');
  });

  it('usa o SMTP do Zoho quando não há Brevo, com o remetente institucional', async () => {
    process.env.ZOHO_SMTP_USER = 'contacto@empregostp.com';
    process.env.ZOHO_SMTP_PASSWORD = 'senha-app-zoho';
    process.env.EMAIL_FROM_ADDRESS = 'contacto@empregostp.com';

    const { sendEmail } = await carregarModulo();
    await sendEmail({ to: 'a@b.com', subject: 'x', html: '<p>x</p>' });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'smtp.zoho.eu', port: 587, requireTLS: true }),
    );
    // Ao contrário do Gmail, o Zoho não reescreve o remetente.
    expect(sendMailMock.mock.calls[0][0].from).toBe('EmpregoSTP <contacto@empregostp.com>');
  });

  it('o Brevo tem precedência sobre o Zoho', async () => {
    process.env.BREVO_API_KEY = 'xkeysib-teste';
    process.env.ZOHO_SMTP_USER = 'contacto@empregostp.com';
    process.env.ZOHO_SMTP_PASSWORD = 'senha-app-zoho';
    process.env.EMAIL_FROM_ADDRESS = 'contacto@empregostp.com';

    const { sendEmail } = await carregarModulo();
    await sendEmail({ to: 'a@b.com', subject: 'x', html: '<p>x</p>' });

    expect(fetchMock).toHaveBeenCalled();
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('no fallback Gmail mantém o "De:" da conta autenticada e o Reply-To institucional', async () => {
    process.env.GMAIL_USER = 'conta@gmail.com';
    process.env.GMAIL_APP_PASSWORD = 'senha-app';
    process.env.EMAIL_FROM_ADDRESS = 'contacto@empregostp.com';
    process.env.EMAIL_REPLY_TO = 'contacto@empregostp.com';

    const { sendEmail, getDefaultFrom } = await carregarModulo();
    await sendEmail({ to: 'a@b.com', subject: 'x', html: '<p>x</p>' });

    // O Gmail rejeita um "De:" que não seja a conta autenticada.
    expect(getDefaultFrom()).toBe('EmpregoSTP <conta@gmail.com>');
    expect(sendMailMock.mock.calls[0][0].from).toBe('EmpregoSTP <conta@gmail.com>');
    expect(sendMailMock.mock.calls[0][0].replyTo).toBe('contacto@empregostp.com');
  });

  it('com o Brevo ativo o "De:" volta a ser o endereço institucional', async () => {
    process.env.BREVO_API_KEY = 'xkeysib-teste';
    process.env.GMAIL_USER = 'conta@gmail.com';
    process.env.GMAIL_APP_PASSWORD = 'senha-app';
    process.env.EMAIL_FROM_ADDRESS = 'contacto@empregostp.com';

    const { getDefaultFrom } = await carregarModulo();
    expect(getDefaultFrom()).toBe('EmpregoSTP <contacto@empregostp.com>');
  });
});
