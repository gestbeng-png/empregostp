import { admin } from './firebaseAdmin';
import { sendEmail } from './email';

// Emails de autenticação (confirmação de conta e recuperação de senha) com a
// marca EmpregoSTP, em português e SEM qualquer referência ao Firebase.
//
// Estratégia: geramos o link de ação no servidor (Admin SDK), extraímos apenas
// o `oobCode` e embrulhamo-lo num link do NOSSO domínio (/verificar-email,
// /redefinir-senha). O utilizador nunca vê `firebaseapp.com`. As páginas de
// destino aplicam o código através do SDK cliente (applyActionCode /
// confirmPasswordReset).

const BRAND_NAME = 'EmpregoSTP';

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
 * Determina o URL base do site (para construir os links dos emails).
 * Prefere a origem do pedido (funciona em localhost e produção), depois a
 * variável de ambiente e, por fim, o host do pedido.
 */
export function resolveBaseUrl(req) {
  const stripTrailingSlash = (value) => String(value || '').replace(/\/$/, '');

  const origin = req?.headers?.origin;
  if (origin) return stripTrailingSlash(origin);

  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl) return stripTrailingSlash(envUrl);

  const host = req?.headers?.host;
  if (host) {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    return `${proto}://${host}`;
  }

  return 'https://empregostp.vercel.app';
}

/**
 * Template HTML partilhado dos emails de autenticação.
 */
function renderAuthEmail({ heading, intro, buttonLabel, buttonUrl, note }) {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${BRAND_NAME}</title>
</head>
<body style="margin:0;padding:0;background-color:#eef2f9;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e2b4d;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef2f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 18px 40px rgba(30,43,77,0.12);">
          <tr>
            <td style="background:linear-gradient(135deg,#2057d7,#5fb8f5);padding:28px 32px;">
              <span style="display:inline-block;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">Emprego<span style="color:#c9f2d8;">STP</span></span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#1e2b4d;">${heading}</h1>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4a5678;">${intro}</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                <tr>
                  <td align="center" style="border-radius:14px;background:linear-gradient(135deg,#2057d7,#5fb8f5);">
                    <a href="${buttonUrl}" target="_blank" style="display:inline-block;padding:15px 34px;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;border-radius:14px;">${buttonLabel}</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#8a93ab;">Se o botão não funcionar, copie e cole este link no seu navegador:</p>
              <p style="margin:0 0 24px;font-size:13px;line-height:1.6;word-break:break-all;"><a href="${buttonUrl}" target="_blank" style="color:#2057d7;">${buttonUrl}</a></p>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#8a93ab;">${note}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background-color:#f6f8fc;border-top:1px solid #e6ebf5;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#9aa3ba;text-align:center;">© ${year} ${BRAND_NAME} — A sua plataforma de emprego em São Tomé e Príncipe.<br/>Este é um email automático, por favor não responda.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Gera o link de confirmação e envia o email de verificação com a marca EmpregoSTP.
 * @param {{ email: string, baseUrl: string, name?: string }} params
 */
export async function sendVerificationEmail({ email, baseUrl, name }) {
  const actionLink = await admin.auth().generateEmailVerificationLink(email);
  const oobCode = extractOobCode(actionLink);
  if (!oobCode) {
    throw new Error('Não foi possível gerar o código de verificação.');
  }

  const verifyUrl = `${baseUrl}/verificar-email?oobCode=${encodeURIComponent(oobCode)}`;
  const greeting = name ? `Olá ${name},` : 'Olá,';

  const html = renderAuthEmail({
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
