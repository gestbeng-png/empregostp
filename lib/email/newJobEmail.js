import { escapeHtml } from '../escapeHtml.js';
import { botao, factos, paragrafo, renderEmail } from './emailLayout.js';

// Aviso aos candidatos subscritos quando sai uma vaga nova.

export function buildNewJobEmail({
  job = {},
  jobId,
  site = 'https://empregostp.com',
}) {
  const titulo = job.titulo || job.title || 'Nova vaga';
  const empresa = job.empresaNome || job.companyName || 'Empresa';
  const local = job.localizacao || job.location || 'São Tomé e Príncipe';
  const contrato = job.tipoContrato || job.contractType || '';
  const url = `${site}/vaga/${jobId}`;

  const corpo =
    paragrafo(
      `<b style="color:#0f1b34;">${escapeHtml(empresa)}</b> publicou uma vaga que pode interessar-lhe.`,
    ) +
    factos([
      { etiqueta: 'Vaga', valor: escapeHtml(titulo) },
      { etiqueta: 'Empresa', valor: escapeHtml(empresa) },
      { etiqueta: 'Local', valor: escapeHtml(local) },
      { etiqueta: 'Contrato', valor: contrato ? escapeHtml(contrato) : '' },
    ]) +
    botao({ label: 'Ver vaga e candidatar-me', url });

  return {
    subject: `Nova vaga: ${titulo}`,
    html: renderEmail({
      eyebrow: 'Nova vaga',
      titulo,
      preheader: `${empresa} · ${local}${contrato ? ` · ${contrato}` : ''}`,
      corpo,
      rodape: `Recebe este aviso porque tem as notificações de novas vagas activas. Pode desligá-las nas <a href="${site}/dashboard/candidato?tab=settings" style="color:#2f6edb;">Definições</a> do seu painel.`,
      site,
    }),
    text: `Nova vaga: ${titulo}\n\nEmpresa: ${empresa}\nLocal: ${local}${contrato ? `\nContrato: ${contrato}` : ''}\n\nVer vaga: ${url}\n\nPara deixar de receber estes avisos, vá a Definições no seu painel.`,
  };
}

export default buildNewJobEmail;
