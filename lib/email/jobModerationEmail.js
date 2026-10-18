import { escapeHtml } from '../escapeHtml.js';
import { botao, painel, paragrafo, renderEmail } from './emailLayout.js';

// Email para a empresa quando o admin aprova ou rejeita uma vaga.

export function decisionEmail({
  approved,
  jobTitle,
  reason,
  site = 'https://empregostp.com',
}) {
  const titulo = escapeHtml(jobTitle || 'a sua vaga');

  const corpo = approved
    ? paragrafo(
        `A vaga <b style="color:#0f1b34;">${titulo}</b> foi aprovada e já está publicada. Os candidatos podem candidatar-se a partir de agora.`,
      ) +
      botao({
        label: 'Ver a vaga publicada',
        url: `${site}/dashboard/empresa?tab=jobs`,
      })
    : paragrafo(
        `A vaga <b style="color:#0f1b34;">${titulo}</b> não foi aprovada pela equipa de moderação.`,
      ) +
      (reason ? painel(escapeHtml(reason), { titulo: 'Motivo' }) : '') +
      paragrafo(
        'Pode corrigir os pontos indicados e submeter a vaga novamente.',
      ) +
      botao({
        label: 'Editar e submeter de novo',
        url: `${site}/dashboard/empresa?tab=jobs`,
      });

  const html = renderEmail({
    eyebrow: 'Moderação',
    titulo: approved ? 'Vaga aprovada' : 'Vaga não aprovada',
    preheader: approved
      ? `${jobTitle} está publicada e a receber candidaturas.`
      : `${jobTitle} precisa de correções antes de ser publicada.`,
    corpo,
    rodape: 'Recebe este email porque tem uma conta de empresa no EmpregoSTP.',
    site,
  });

  const text = approved
    ? `Vaga aprovada\n\nA vaga "${jobTitle}" foi aprovada e já está publicada no EmpregoSTP.\n\nVer: ${site}/dashboard/empresa?tab=jobs`
    : `Vaga não aprovada\n\nA vaga "${jobTitle}" não foi aprovada.${reason ? `\n\nMotivo: ${reason}` : ''}\n\nPode corrigir e submeter de novo: ${site}/dashboard/empresa?tab=jobs`;

  return {
    subject: approved
      ? `Vaga aprovada: ${jobTitle}`
      : `Vaga não aprovada: ${jobTitle}`,
    html,
    text,
  };
}

export default decisionEmail;
