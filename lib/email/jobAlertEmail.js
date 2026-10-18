import { escapeHtml } from '../escapeHtml.js';
import { CORES, renderEmail } from './emailLayout.js';
import { getEffectiveJobStatus } from '../jobExpiration.js';

function parseMoney(value) {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const digits = String(value).replace(/[^\d]/g, '');
  return digits ? Number(digits) : 0;
}

function normalize(value) {
  return String(value ?? '')
    .toLowerCase()
    .trim();
}

function matchesSearch(job, term) {
  const haystack = [
    job.titulo,
    job.descricao,
    job.localizacao,
    job.categoria,
    job.tipoContrato,
    job.empresaNome,
    job.companyName,
    Array.isArray(job.palavrasChave) ? job.palavrasChave.join(' ') : '',
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(term);
}

function isRemoteJob(job) {
  const text = `${job.modalidade || ''} ${job.regime || ''}`.toLowerCase();
  return Boolean(job.remoto) || text.includes('remoto');
}

function isHybridJob(job) {
  const text =
    `${job.modalidade || ''} ${job.regime || ''} ${job.localizacao || ''}`.toLowerCase();
  return text.includes('hibrido') || text.includes('híbrido');
}

function getExperienceBucket(job) {
  const text =
    `${job.nivelExperiencia || ''} ${job.experiencia || ''}`.toLowerCase();
  if (
    text.includes('5+') ||
    text.includes('+5') ||
    text.includes('sénior') ||
    text.includes('senior')
  ) {
    return '5+';
  }
  if (text.includes('3-5') || text.includes('3 a 5')) return '3-5';
  if (
    text.includes('1-3') ||
    text.includes('1 a 3') ||
    text.includes('júnior') ||
    text.includes('junior')
  ) {
    return '1-3';
  }
  if (
    text.includes('sem') ||
    text.includes('entry') ||
    text.includes('0-2') ||
    text.includes('iniciante')
  ) {
    return 'sem';
  }
  return '';
}

/**
 * Devolve apenas as vagas publicadas (status efetivo "active") que
 * correspondem aos filtros escolhidos pelo utilizador.
 */
export function filterPublishedJobs(jobs = [], filters = {}) {
  const term = normalize(filters.search);
  const localizacao = normalize(filters.localizacao);
  const tipoContrato = normalize(filters.tipoContrato);
  const categoria = normalize(filters.categoria);
  const modalidade = normalize(filters.modalidade);
  const experiencia = normalize(filters.experiencia);
  const minSalary = Number.isFinite(Number(filters.minSalary))
    ? Math.max(0, Number(filters.minSalary))
    : 0;

  return jobs.filter((job) => {
    if (getEffectiveJobStatus(job) !== 'active') return false;
    if (term && !matchesSearch(job, term)) return false;
    if (localizacao && normalize(job.localizacao) !== localizacao) return false;
    if (tipoContrato && normalize(job.tipoContrato) !== tipoContrato)
      return false;
    if (categoria && normalize(job.categoria) !== categoria) return false;
    if (modalidade === 'remoto' && !isRemoteJob(job)) return false;
    if (modalidade === 'hibrido' && !isHybridJob(job)) return false;
    if (modalidade === 'presencial' && (isRemoteJob(job) || isHybridJob(job))) {
      return false;
    }
    if (experiencia && getExperienceBucket(job) !== experiencia) return false;
    if (minSalary > 0) {
      const salary =
        parseMoney(job.salarioAte) || parseMoney(job.salarioDe) || 0;
      if (salary < minSalary) return false;
    }
    return true;
  });
}

function formatSalary(job) {
  const de = parseMoney(job.salarioDe);
  const ate = parseMoney(job.salarioAte);
  if (!de && !ate) return '';
  const fmt = (n) => `${n.toLocaleString('pt-PT')} STD`;
  if (de && ate) return `${fmt(de)} – ${fmt(ate)}`;
  return fmt(de || ate);
}

function activeFiltersSummary(filters = {}) {
  const parts = [];
  if (filters.search) parts.push(`“${filters.search}”`);
  if (filters.categoria) parts.push(filters.categoria);
  if (filters.localizacao) parts.push(filters.localizacao);
  if (filters.tipoContrato) parts.push(filters.tipoContrato);
  if (filters.modalidade) parts.push(filters.modalidade);
  if (filters.experiencia) parts.push(filters.experiencia);
  if (Number(filters.minSalary) > 0) {
    parts.push(
      `a partir de ${Number(filters.minSalary).toLocaleString('pt-PT')} STD`,
    );
  }
  return parts.join(' · ');
}

/**
 * Constrói o HTML (e versão texto) do email de alerta com as vagas publicadas.
 */
export function buildJobAlertEmail({
  jobs = [],
  filters = {},
  baseUrl = '',
  unsubscribeUrl = '',
}) {
  const site = String(baseUrl || '').replace(/\/$/, '');
  const safeUnsubscribeUrl = unsubscribeUrl ? escapeHtml(unsubscribeUrl) : '';
  const summary = activeFiltersSummary(filters);
  const count = jobs.length;

  const jobsHtml = jobs
    .map((job) => {
      const url = `${site}/vaga/${job.id}`;
      const title = escapeHtml(job.titulo || 'Vaga');
      const company = escapeHtml(
        job.empresaNome || job.companyName || 'Empresa',
      );
      const location = escapeHtml(job.localizacao || 'São Tomé e Príncipe');
      const contract = escapeHtml(job.tipoContrato || '');
      const salary = escapeHtml(formatSalary(job));

      const metaBits = [location, contract, salary]
        .filter(Boolean)
        .join(' &nbsp;·&nbsp; ');

      return `
        <tr>
          <td style="padding:0 0 12px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${CORES.borda};border-radius:12px;background:${CORES.superficie};">
              <tr>
                <td style="padding:18px 20px;">
                  <a href="${url}" style="text-decoration:none;color:${CORES.tinta};font-size:17px;font-weight:700;line-height:1.35;">${title}</a>
                  <div style="margin-top:5px;color:${CORES.texto};font-size:14px;font-weight:600;">${company}</div>
                  ${metaBits ? `<div style="margin-top:9px;color:${CORES.suave};font-size:12.5px;line-height:1.6;">${metaBits}</div>` : ''}
                  <a href="${url}" style="display:inline-block;margin-top:14px;padding:9px 16px;background:${CORES.primaria};color:#ffffff;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;">Ver vaga</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
    })
    .join('');

  const emptyHtml = `
    <tr><td style="padding:2px 0 4px;color:${CORES.texto};font-size:15px;line-height:1.65;">
      De momento não há vagas publicadas com estes filtros. Guardámos o seu alerta e
      avisamos assim que surgir uma vaga a corresponder.
    </td></tr>`;

  const corpo = `
    ${summary ? `<p style="margin:0 0 16px;color:${CORES.suave};font-size:13px;line-height:1.6;">Filtros: <b style="color:${CORES.texto};">${escapeHtml(summary)}</b></p>` : ''}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${count > 0 ? jobsHtml : emptyHtml}
    </table>
    ${
      count > 0
        ? `<div style="margin-top:14px;text-align:center;">
             <a href="${site}/vagas" style="color:${CORES.primaria};font-size:13px;font-weight:600;text-decoration:none;">Ver todas as vagas no EmpregoSTP</a>
           </div>`
        : ''
    }`;

  const html = renderEmail({
    eyebrow: 'Alerta de vagas',
    titulo:
      count > 0
        ? `${count} vaga${count === 1 ? '' : 's'} para si`
        : 'Alerta ativado',
    preheader:
      count > 0
        ? jobs
            .slice(0, 3)
            .map((job) => job.titulo || 'Vaga')
            .join(' · ')
        : 'Avisamos assim que surgir uma vaga a corresponder aos seus filtros.',
    corpo,
    rodape: `Recebeu este email porque ativou um alerta de vagas no EmpregoSTP.${
      safeUnsubscribeUrl
        ? ` <a href="${safeUnsubscribeUrl}" style="color:${CORES.primaria};">Cancelar este alerta</a>.`
        : ''
    }`,
    site,
  });

  const text =
    count > 0
      ? [
          `${count} vaga(s) publicada(s) para si`,
          summary ? `Filtros: ${summary}` : '',
          '',
          ...jobs.map((job) => {
            const bits = [job.localizacao, job.tipoContrato, formatSalary(job)]
              .filter(Boolean)
              .join(' · ');
            return `• ${job.titulo || 'Vaga'} — ${job.empresaNome || job.companyName || 'Empresa'}${bits ? ` (${bits})` : ''}\n  ${site}/vaga/${job.id}`;
          }),
          '',
          `Ver todas: ${site}/vagas`,
          unsubscribeUrl ? `Cancelar este alerta: ${unsubscribeUrl}` : '',
        ]
          .filter(Boolean)
          .join('\n')
      : [
          'Alerta ativado. Ainda não há vagas com estes filtros — avisamos assim que surgir uma.',
          unsubscribeUrl ? `Cancelar este alerta: ${unsubscribeUrl}` : '',
        ]
          .filter(Boolean)
          .join('\n\n');

  // Tratamento formal ("si"/"seu") em todos os emails: a plataforma fala com
  // empresas e candidatos, e o remetente já identifica a marca no assunto.
  const subject =
    count > 0
      ? `${count} vaga${count === 1 ? '' : 's'} para si`
      : 'Alerta de vagas ativado';

  return { subject, html, text };
}
