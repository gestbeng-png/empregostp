import nodemailer from 'nodemailer';

// Envio de emails via Brevo (ex-Sendinblue).
//
// Duas formas de configurar (a API HTTP tem prioridade, por ser a mais fiável
// em ambientes serverless onde as portas SMTP podem estar bloqueadas):
//
//   1) API HTTP  -> BREVO_API_KEY        (chave "xkeysib-..." em Brevo > SMTP & API > API Keys)
//   2) SMTP relay-> BREVO_SMTP_LOGIN     (o login SMTP, ex.: 9a1b2c001@smtp-brevo.com)
//                   BREVO_SMTP_KEY       (a "SMTP key" gerada no mesmo painel)
//   3) Zoho SMTP -> ZOHO_SMTP_USER       (contacto@empregostp.com)
//                   ZOHO_SMTP_PASSWORD   (palavra-passe de aplicação do Zoho)
//
// O Zoho não exige DMARC nem autenticação de domínio adicional: o
// `include:zoho.eu` do SPF e os MX já tratam disso. Em contrapartida tem
// limites diários de envio por conta, ao contrário do Brevo.
//
// Em qualquer dos casos o remetente tem de ser um endereço verificado no Brevo:
//   EMAIL_FROM_ADDRESS  -> contacto@empregostp.com
//   EMAIL_FROM_NAME     -> ex.: EmpregoSTP (opcional, prefixo do "De:")
//
// Nota: mantém-se o fallback para Gmail SMTP (GMAIL_USER / GMAIL_APP_PASSWORD)
// para o serviço não parar enquanto o Brevo não estiver configurado.

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

let transporter = null;
let transporterKey = '';

function brevoApiKey() {
  return (process.env.BREVO_API_KEY || '').trim();
}

function smtpConfig() {
  const brevoLogin = (process.env.BREVO_SMTP_LOGIN || '').trim();
  const brevoKey = (process.env.BREVO_SMTP_KEY || '').trim();
  if (brevoLogin && brevoKey) {
    return {
      key: `brevo:${brevoLogin}`,
      options: {
        host: process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com',
        port: Number(process.env.BREVO_SMTP_PORT || 587),
        secure: false,
        auth: { user: brevoLogin, pass: brevoKey },
      },
    };
  }

  const zohoUser = (process.env.ZOHO_SMTP_USER || '').trim();
  const zohoPass = (process.env.ZOHO_SMTP_PASSWORD || '').trim();
  if (zohoUser && zohoPass) {
    return {
      key: `zoho:${zohoUser}`,
      options: {
        host: process.env.ZOHO_SMTP_HOST || 'smtp.zoho.eu',
        port: Number(process.env.ZOHO_SMTP_PORT || 587),
        secure: false,
        requireTLS: true,
        auth: { user: zohoUser, pass: zohoPass },
      },
    };
  }

  const gmailUser = (process.env.GMAIL_USER || '').trim();
  const gmailPass = (process.env.GMAIL_APP_PASSWORD || '').trim();
  if (gmailUser && gmailPass) {
    return {
      key: `gmail:${gmailUser}`,
      options: { service: 'gmail', auth: { user: gmailUser, pass: gmailPass } },
    };
  }

  return null;
}

function getTransporter() {
  const config = smtpConfig();
  if (!config) return null;
  if (!transporter || transporterKey !== config.key) {
    transporter = nodemailer.createTransport(config.options);
    transporterKey = config.key;
  }
  return transporter;
}

export function isEmailConfigured() {
  return Boolean(brevoApiKey() || smtpConfig());
}

// O Gmail obriga o "De:" a ser a conta autenticada: manda 553/555 ou reescreve
// o cabeçalho. No fallback usamos por isso o endereço do Gmail e deixamos o
// endereço institucional só no Reply-To, para as respostas irem à mesma para o
// sítio certo. Com o Brevo não há esta limitação.
function usingGmailFallback() {
  return !brevoApiKey() && smtpConfig()?.key.startsWith('gmail:');
}

function getFromAddress() {
  return (
    (process.env.EMAIL_FROM_ADDRESS || '').trim() ||
    (process.env.GMAIL_USER || '').trim()
  );
}

// Respostas vão para a caixa institucional, não para o remetente técnico.
export function getReplyTo() {
  return (process.env.EMAIL_REPLY_TO || '').trim() || getFromAddress();
}

export function getDefaultFrom() {
  const address = usingGmailFallback()
    ? (process.env.GMAIL_USER || '').trim()
    : getFromAddress();
  const name = process.env.EMAIL_FROM_NAME || 'EmpregoSTP';
  return `${name} <${address}>`;
}

// Aceita "Nome <email@dominio>" ou só "email@dominio".
function parseAddress(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (match) {
    const name = match[1].replace(/^"|"$/g, '').trim();
    return name ? { name, email: match[2].trim() } : { email: match[2].trim() };
  }
  return { email: raw };
}

function toAddressList(value) {
  const items = Array.isArray(value) ? value : String(value || '').split(',');
  return items.map((item) => parseAddress(item)).filter((item) => item.email);
}

async function sendViaApi({ apiKey, to, bcc, subject, html, text, replyTo }) {
  const sender = parseAddress(getDefaultFrom());
  const payload = {
    sender,
    to: toAddressList(to),
    subject,
    ...(html ? { htmlContent: html } : {}),
    ...(text ? { textContent: text } : {}),
    ...(bcc ? { bcc: toAddressList(bcc) } : {}),
    ...(replyTo ? { replyTo: parseAddress(replyTo) } : {}),
  };

  const response = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await response.text();
  if (!response.ok) {
    let detalhe = body;
    try {
      const json = JSON.parse(body);
      detalhe = json.message || json.code || body;
    } catch {
      // resposta não-JSON: fica o texto cru
    }
    throw new Error(`Brevo respondeu ${response.status}: ${detalhe}`);
  }

  try {
    return JSON.parse(body);
  } catch {
    return { messageId: null };
  }
}

/**
 * Envia um email. Lança erro com `code` para o chamador poder distinguir
 * "não configurado" de "falha no envio".
 *
 * @param {object} opcoes
 * @param {string|string[]} [opcoes.to] Destinatário(s); por omissão, o remetente.
 * @param {string|string[]} [opcoes.bcc] Cópia oculta (usada nos envios em massa).
 * @param {string} [opcoes.subject]
 * @param {string} [opcoes.html]
 * @param {string} [opcoes.text]
 * @param {string} [opcoes.replyTo] Por omissão, EMAIL_REPLY_TO.
 */
export async function sendEmail({ to, bcc, subject, html, text, replyTo }) {
  const apiKey = brevoApiKey();
  const mailer = apiKey ? null : getTransporter();

  if (!apiKey && !mailer) {
    const error = new Error(
      'Serviço de email não configurado (falta BREVO_API_KEY ou BREVO_SMTP_LOGIN / BREVO_SMTP_KEY).',
    );
    error.code = 'EMAIL_NOT_CONFIGURED';
    throw error;
  }

  if (!getFromAddress()) {
    const error = new Error(
      'Serviço de email sem remetente (falta EMAIL_FROM_ADDRESS).',
    );
    error.code = 'EMAIL_NOT_CONFIGURED';
    throw error;
  }

  const destino = to || getDefaultFrom();
  const responderA = replyTo || getReplyTo();

  try {
    if (apiKey) {
      return await sendViaApi({
        apiKey,
        to: destino,
        bcc,
        subject,
        html,
        text,
        replyTo: responderA,
      });
    }
    return await mailer.sendMail({
      from: getDefaultFrom(),
      to: Array.isArray(destino) ? destino.join(', ') : destino,
      ...(bcc ? { bcc: Array.isArray(bcc) ? bcc.join(', ') : bcc } : {}),
      subject,
      html,
      text,
      ...(responderA ? { replyTo: responderA } : {}),
    });
  } catch (cause) {
    const err = new Error(cause?.message || 'Falha ao enviar email.');
    err.code = 'EMAIL_SEND_FAILED';
    err.details = cause;
    throw err;
  }
}
