import { escapeHtml } from '../escapeHtml.js';
import { factos, painel, paragrafo, renderEmail } from './emailLayout.js';

// Notificação para a caixa institucional quando alguém escreve pelo formulário
// de contacto ou pelo de carreiras.

export function notificationEmail({
  name,
  email,
  phone,
  subject,
  subjectLabel,
  message,
  site = 'https://empregostp.com',
}) {
  // O formulário de carreiras entra pela mesma rota, mas quem recebe precisa de
  // distinguir uma candidatura espontânea de um pedido de apoio.
  const carreiras = subject === 'carreira';
  const mensagemHtml = escapeHtml(message).replace(/\n/g, '<br />');

  const corpo =
    paragrafo(
      carreiras
        ? `<b style="color:#0f1b34;">${escapeHtml(name)}</b> quer juntar-se à equipa.`
        : `<b style="color:#0f1b34;">${escapeHtml(name)}</b> enviou uma mensagem pelo site.`,
    ) +
    factos([
      { etiqueta: 'Nome', valor: escapeHtml(name) },
      {
        etiqueta: 'Email',
        valor: `<a href="mailto:${escapeHtml(email)}" style="color:#2f6edb;text-decoration:none;">${escapeHtml(email)}</a>`,
      },
      { etiqueta: 'Telefone', valor: phone ? escapeHtml(phone) : '' },
      {
        etiqueta: 'Assunto',
        valor: carreiras ? '' : escapeHtml(subjectLabel || ''),
      },
    ]) +
    painel(mensagemHtml, { titulo: 'Mensagem' }) +
    paragrafo(
      `Responda a este email para falar diretamente com ${escapeHtml(name)}.`,
      {
        suave: true,
      },
    );

  return {
    subject: carreiras
      ? `Candidatura espontânea: ${name}`
      : `Contacto · ${subjectLabel} — ${name}`,
    html: renderEmail({
      eyebrow: carreiras ? 'Carreiras' : 'Contacto',
      titulo: carreiras
        ? 'Quer juntar-se à equipa'
        : 'Nova mensagem de contacto',
      preheader: `${name} · ${email}`,
      corpo,
      site,
    }),
    text: `${carreiras ? 'Quer juntar-se à equipa' : 'Nova mensagem de contacto'}\n\nNome: ${name}\nEmail: ${email}${phone ? `\nTelefone: ${phone}` : ''}${carreiras ? '' : `\nAssunto: ${subjectLabel}`}\n\n${message}`,
  };
}

export default notificationEmail;
