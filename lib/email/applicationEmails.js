import { escapeHtml } from '../escapeHtml.js';
import {
  botao,
  etiquetas,
  factos,
  paragrafo,
  renderEmail,
} from './emailLayout.js';

// Email enviado à empresa quando recebe uma nova candidatura.

export function buildNewApplicationEmail({
  candidateName,
  jobTitle,
  compatibilityLabel,
  compatibilityScore,
  hasCoverLetter,
  priorityApplied,
  site = 'https://empregostp.com',
}) {
  const candidato = candidateName || 'Um candidato';
  const vaga = jobTitle || 'a sua vaga';
  const pontuacao = Number(compatibilityScore) || 0;

  const corpo =
    paragrafo(
      `<b style="color:#0f1b34;">${escapeHtml(candidato)}</b> candidatou-se à sua vaga.`,
    ) +
    factos([
      { etiqueta: 'Vaga', valor: escapeHtml(vaga) },
      { etiqueta: 'Candidato', valor: escapeHtml(candidato) },
      {
        etiqueta: 'Compatibilidade',
        valor: pontuacao
          ? `${pontuacao}%${compatibilityLabel ? ` <span style="font-weight:400;color:#7a869c;">· ${escapeHtml(compatibilityLabel)}</span>` : ''}`
          : '',
      },
    ]) +
    etiquetas([
      priorityApplied ? 'Candidatura prioritária' : null,
      hasCoverLetter ? 'Com carta de apresentação' : null,
    ]) +
    botao({
      label: 'Ver candidatura',
      url: `${site}/dashboard/empresa?tab=applications`,
    });

  return {
    subject: `${priorityApplied ? 'Candidatura prioritária' : 'Nova candidatura'}: ${vaga}`,
    html: renderEmail({
      eyebrow: 'Candidaturas',
      titulo: 'Nova candidatura recebida',
      preheader: `${candidato} candidatou-se a ${vaga}.`,
      corpo,
      rodape: 'Recebe este email porque tem uma vaga publicada no EmpregoSTP.',
      site,
    }),
    text: `Nova candidatura\n\n${candidato} candidatou-se à vaga "${vaga}".\n${pontuacao ? `Compatibilidade: ${pontuacao}%\n` : ''}${priorityApplied ? 'Candidatura prioritária\n' : ''}${hasCoverLetter ? 'Com carta de apresentação\n' : ''}\nVer: ${site}/dashboard/empresa?tab=applications`,
  };
}

export default buildNewApplicationEmail;
