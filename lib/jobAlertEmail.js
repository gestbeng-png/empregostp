import { getEffectiveJobStatus } from './jobExpiration';

function parseMoney(value) {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const digits = String(value).replace(/[^\d]/g, '');
  return digits ? Number(digits) : 0;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalize(value) {
  return String(value ?? '').toLowerCase().trim();
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
    if (tipoContrato && normalize(job.tipoContrato) !== tipoContrato) return false;
    if (categoria && normalize(job.categoria) !== categoria) return false;
    if (modalidade === 'remoto' && !isRemoteJob(job)) return false;
    if (modalidade === 'hibrido' && !isHybridJob(job)) return false;
    if (
      modalidade === 'presencial' &&
      (isRemoteJob(job) || isHybridJob(job))
    ) {
      return false;
    }
    if (experiencia && getExperienceBucket(job) !== experiencia) return false;
    if (minSalary > 0) {
      const salary = parseMoney(job.salarioAte) || parseMoney(job.salarioDe) || 0;
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
    parts.push(`a partir de ${Number(filters.minSalary).toLocaleString('pt-PT')} STD`);
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
  const safeUnsubscribeUrl = unsubscribeUrl
    ? escapeHtml(unsubscribeUrl)
    : '';
  const summary = activeFiltersSummary(filters);
  const count = jobs.length;

  const jobsHtml = jobs
    .map((job) => {
      const url = `${site}/vaga/${job.id}`;
      const title = escapeHtml(job.titulo || 'Vaga');
      const company = escapeHtml(job.empresaNome || job.companyName || 'Empresa');
      const location = escapeHtml(job.localizacao || 'São Tomé e Príncipe');
      const contract = escapeHtml(job.tipoContrato || '');
      const salary = escapeHtml(formatSalary(job));

      const metaBits = [location, contract, salary].filter(Boolean).join(' &nbsp;·&nbsp; ');

      return `
        <tr>
          <td style="padding:0 0 12px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5ecf6;border-radius:12px;background:#ffffff;">
              <tr>
                <td style="padding:16px 18px;">
                  <a href="${url}" style="text-decoration:none;color:#14264f;font-size:16px;font-weight:700;line-height:1.3;">${title}</a>
                  <div style="margin-top:4px;color:#5b6b88;font-size:13px;">${company}</div>
                  <div style="margin-top:8px;color:#6b7a97;font-size:12px;">${metaBits}</div>
                  <a href="${url}" style="display:inline-block;margin-top:12px;padding:8px 14px;background:#2f6edb;color:#ffffff;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;">Ver vaga →</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
    })
    .join('');

  const emptyHtml = `
    <tr><td style="padding:8px 0 4px;color:#5b6b88;font-size:14px;line-height:1.6;">
      De momento não há vagas publicadas com estes filtros. Guardámos o teu alerta e
      avisamos-te assim que surgir uma nova vaga a corresponder.
    </td></tr>`;

  const html = `<!doctype html>
<html lang="pt">
  <body style="margin:0;padding:0;background:#f4f7fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fc;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
            <tr>
              <td style="padding:22px 24px;background:linear-gradient(135deg,#14264f,#0c1834);border-radius:16px 16px 0 0;">
                <div style="color:#d9ff3f;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">EmpregoSTP · Alerta de vagas</div>
                <div style="margin-top:6px;color:#ffffff;font-size:20px;font-weight:800;">
                  ${count > 0 ? `${count} vaga${count === 1 ? '' : 's'} publicada${count === 1 ? '' : 's'} para ti` : 'Alerta ativado'}
                </div>
                ${summary ? `<div style="margin-top:6px;color:#c7d3ea;font-size:13px;">Filtros: ${escapeHtml(summary)}</div>` : ''}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 24px;background:#ffffff;border-radius:0 0 16px 16px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${count > 0 ? jobsHtml : emptyHtml}
                </table>
                ${
                  count > 0
                    ? `<div style="margin-top:8px;text-align:center;">
                         <a href="${site}/vagas" style="color:#2f6edb;font-size:13px;font-weight:600;text-decoration:none;">Ver todas as vagas no EmpregoSTP →</a>
                       </div>`
                    : ''
                }
                <div style="margin-top:20px;padding-top:16px;border-top:1px solid #eef2f8;color:#9aa7bf;font-size:11px;line-height:1.6;">
                  Recebeste este email porque ativaste um alerta de vagas no EmpregoSTP.
                  ${
                    safeUnsubscribeUrl
                      ? `<br><a href="${safeUnsubscribeUrl}" style="color:#667793;text-decoration:underline;">Cancelar este alerta</a>`
                      : ''
                  }
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = count > 0
    ? [
        `EmpregoSTP — ${count} vaga(s) publicada(s) para ti`,
        summary ? `Filtros: ${summary}` : '',
        '',
        ...jobs.map((job) => {
          const bits = [job.localizacao, job.tipoContrato, formatSalary(job)].filter(Boolean).join(' · ');
          return `• ${job.titulo || 'Vaga'} — ${job.empresaNome || job.companyName || 'Empresa'}${bits ? ` (${bits})` : ''}\n  ${site}/vaga/${job.id}`;
        }),
        '',
        `Ver todas: ${site}/vagas`,
        unsubscribeUrl ? `Cancelar este alerta: ${unsubscribeUrl}` : '',
      ].filter(Boolean).join('\n')
    : [
        'Alerta ativado no EmpregoSTP. Ainda não há vagas com estes filtros — avisamos-te assim que surgir uma.',
        unsubscribeUrl ? `Cancelar este alerta: ${unsubscribeUrl}` : '',
      ].filter(Boolean).join('\n\n');

  const subject = count > 0
    ? `${count} vaga${count === 1 ? '' : 's'} para ti no EmpregoSTP`
    : 'Alerta de vagas ativado no EmpregoSTP';

  return { subject, html, text };
}
