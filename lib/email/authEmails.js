import { admin } from '../firebaseAdmin.js';
import { sendEmail } from './index.js';
import { botao, paragrafo, renderEmail } from './emailLayout.js';
import { sanitizeLoginRedirect } from '../loginRedirect.js';

// Emails de autenticação (confirmação de conta e recuperação de senha) com a
// marca EmpregoSTP, em português e SEM qualquer referência ao Firebase.
//
// Estratégia: geramos o link de ação no servidor (Admin SDK), extraímos apenas
// o `oobCode` e embrulhamo-lo num link do NOSSO domínio (/verificar-email,
// /redefinir-senha). O utilizador nunca vê `firebaseapp.com`. As páginas de
// destino aplicam o código através do SDK cliente (applyActionCode /
// confirmPasswordReset).

const PRODUCTION_SITE_URL = 'https://empregostp.com';

/**
 * Extrai o oobCode de um link de ação gerado pelo Admin SDK.
 */
function extractOobCode(actionLink) {
  try {
    return new URL(actionLink).searchParams.get('oobCode') || '';
  } catch {
    return '';
  }
}

/**
 * Determina o URL base canónico do site para os links enviados por email.
 *
 * Origin, Host e X-Forwarded-* são dados do pedido e nunca participam nesta
 * decisão: aceitá-los permitiria a um atacante enviar o oobCode para o seu
 * próprio domínio. Em produção aceitamos apenas HTTPS configurado; localhost
 * HTTP é permitido exclusivamente fora de produção para desenvolvimento local.
 */
export function resolveBaseUrl(_req) {
  const configuredUrl =
    process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '';

  if (configuredUrl) {
    try {
      const parsed = new URL(String(configuredUrl).trim());
      const isLocalDevelopmentUrl =
        process.env.NODE_ENV !== 'production' &&
        parsed.protocol === 'http:' &&
        ['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname);

      if (parsed.protocol === 'https:' || isLocalDevelopmentUrl) {
        parsed.username = '';
        parsed.password = '';
        parsed.hash = '';
        parsed.search = '';
        parsed.pathname = parsed.pathname.replace(/\/$/, '');
        return parsed.toString().replace(/\/$/, '');
      }
    } catch {
      // Configuração inválida: usar o domínio canónico conhecido.
    }
  }

  return PRODUCTION_SITE_URL;
}

/**
 * Template HTML partilhado dos emails de autenticação.
 */
function renderAuthEmail({
  eyebrow,
  heading,
  intro,
  buttonLabel,
  buttonUrl,
  note,
  site,
}) {
  const corpo =
    paragrafo(intro) +
    botao({ label: buttonLabel, url: buttonUrl }) +
    paragrafo(
      'Se o botão não funcionar, copie e cole este endereço no navegador:',
      {
        suave: true,
      },
    ) +
    `<p style="margin:0 0 4px;font-size:13px;line-height:1.6;word-break:break-all;"><a href="${buttonUrl}" style="color:#2f6edb;">${buttonUrl}</a></p>`;

  return renderEmail({
    eyebrow,
    titulo: heading,
    preheader: note,
    corpo,
    rodape: `${note}<br />Este é um email automático — não é preciso responder.`,
    site,
  });
}

/**
 * Gera o link de confirmação e envia o email de verificação com a marca EmpregoSTP.
 * @param {{ email: string, baseUrl: string, name?: string, returnTo?: string }} params
 */
export async function sendVerificationEmail({
  email,
  baseUrl,
  name,
  returnTo,
}) {
  const actionLink = await admin.auth().generateEmailVerificationLink(email);
  const oobCode = extractOobCode(actionLink);
  if (!oobCode) {
    throw new Error('Não foi possível gerar o código de verificação.');
  }

  const destination = sanitizeLoginRedirect(returnTo);
  const verifyUrl = `${baseUrl}/verificar-email?oobCode=${encodeURIComponent(oobCode)}${destination ? `&returnTo=${encodeURIComponent(destination)}` : ''}`;
  const greeting = name ? `Olá ${name},` : 'Olá,';

  const html = renderAuthEmail({
    eyebrow: 'Conta',
    site: baseUrl,
    heading: 'Confirme o seu email',
    intro: `${greeting} obrigado por criar a sua conta no EmpregoSTP. Para começar a usar a plataforma, confirme o seu endereço de email clicando no botão abaixo.`,
    buttonLabel: 'Confirmar email',
    buttonUrl: verifyUrl,
    note: 'Se não foi você que criou esta conta, pode ignorar este email com segurança.',
  });

  const text = `Confirme o seu email no EmpregoSTP.\n\nAbra o link para confirmar a sua conta:\n${verifyUrl}\n\nSe não foi você que criou esta conta, ignore este email.`;

  await sendEmail({
    to: email,
    subject: 'Confirme a sua conta — EmpregoSTP',
    html,
    text,
  });
}

/**
 * Gera o link de redefinição de senha e envia o email com a marca EmpregoSTP.
 * @param {{ email: string, baseUrl: string }} params
 */
export async function sendResetPasswordEmail({ email, baseUrl }) {
  const actionLink = await admin.auth().generatePasswordResetLink(email);
  const oobCode = extractOobCode(actionLink);
  if (!oobCode) {
    throw new Error('Não foi possível gerar o código de recuperação.');
  }

  const resetUrl = `${baseUrl}/redefinir-senha?oobCode=${encodeURIComponent(oobCode)}`;

  const html = renderAuthEmail({
    eyebrow: 'Segurança',
    site: baseUrl,
    heading: 'Redefinir a sua senha',
    intro:
      'Recebemos um pedido para redefinir a senha da sua conta EmpregoSTP. Clique no botão abaixo para criar uma nova senha. O link é válido por tempo limitado.',
    buttonLabel: 'Redefinir senha',
    buttonUrl: resetUrl,
    note: 'Se não pediu para redefinir a senha, ignore este email — a sua senha atual continua ativa.',
  });

  const text = `Redefinição de senha no EmpregoSTP.\n\nAbra o link para criar uma nova senha:\n${resetUrl}\n\nSe não pediu isto, ignore este email.`;

  await sendEmail({
    to: email,
    subject: 'Recuperação de senha — EmpregoSTP',
    html,
    text,
  });
}
