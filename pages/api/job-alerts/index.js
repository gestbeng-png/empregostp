import { admin } from '../../../lib/firebaseAdmin';
import { enforceApiRateLimit, getClientIp } from '../../../lib/apiRateLimit';
import { sendEmail, isEmailConfigured } from '../../../lib/email';
import { filterPublishedJobs, buildJobAlertEmail } from '../../../lib/jobAlertEmail';
import { logServerError } from '../../../lib/serverLog';

// Regista a subscrição do alerta e envia de imediato um email com todas as
// vagas publicadas que correspondem aos filtros. O envio periódico de futuras
// vagas continua a poder ser feito por um processo agendado à parte.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function baseUrl(req) {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  }
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return host ? `${proto}://${host}` : '';
}

function sanitize(value, max = 120) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

async function fetchPublishedJobs() {
  const snapshot = await admin
    .firestore()
    .collection('jobs')
    .orderBy('createdAt', 'desc')
    .get();

  const jobs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  // Anexa o nome da empresa para o email ficar mais legível.
  const companyIds = [...new Set(jobs.map((j) => j.companyId).filter(Boolean))];
  if (companyIds.length) {
    const refs = companyIds.map((id) =>
      admin.firestore().collection('users').doc(id),
    );
    const companyDocs = await admin.firestore().getAll(...refs);
    const namesById = new Map();
    companyDocs.forEach((doc) => {
      if (doc.exists) {
        const data = doc.data() || {};
        namesById.set(doc.id, data.name || data.fullName || 'Empresa');
      }
    });
    jobs.forEach((job) => {
      job.empresaNome = namesById.get(job.companyId) || job.empresaNome || job.companyName || 'Empresa';
    });
  }

  return jobs;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Rate limit: no máximo 3 subscrições por minuto por IP
  if (
    !(await enforceApiRateLimit(req, res, { scope: 'job_alerts', limit: 3 }))
  ) {
    return;
  }

  try {
    const email = sanitize(req.body?.email, 160).toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Introduza um email válido.' });
    }

    const rawFilters = req.body?.filters || {};
    const filters = {
      search: sanitize(rawFilters.search, 120),
      localizacao: sanitize(rawFilters.localizacao),
      tipoContrato: sanitize(rawFilters.tipoContrato),
      categoria: sanitize(rawFilters.categoria),
      modalidade: sanitize(rawFilters.modalidade),
      experiencia: sanitize(rawFilters.experiencia),
      minSalary: Number.isFinite(Number(rawFilters.minSalary))
        ? Math.max(0, Math.round(Number(rawFilters.minSalary)))
        : 0,
    };

    // Guardar a subscrição (para futuros envios agendados).
    await admin.firestore().collection('jobAlerts').add({
      email,
      filters,
      active: true,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      userAgent: req.headers['user-agent'] || null,
      ip: getClientIp(req),
    });

    // Reunir as vagas publicadas que correspondem aos filtros e enviar já o email.
    const allJobs = await fetchPublishedJobs();
    const matchingJobs = filterPublishedJobs(allJobs, filters).slice(0, 30);
    const { subject, html, text } = buildJobAlertEmail({
      jobs: matchingJobs,
      filters,
      baseUrl: baseUrl(req),
    });

    if (!isEmailConfigured()) {
      // Subscrição guardada, mas o provedor de email ainda não está configurado.
      return res.status(202).json({
        message:
          'Alerta guardado. O envio de email ainda não está ativo — falta configurar a chave do serviço de email.',
        emailSent: false,
        matches: matchingJobs.length,
      });
    }

    try {
      await sendEmail({ to: email, subject, html, text });
    } catch (emailError) {
      logServerError('job_alerts.enviar_email_de_alerta_failed', emailError);
      return res.status(202).json({
        message:
          'Alerta guardado, mas não foi possível enviar o email agora. Vamos tentar de novo mais tarde.',
        emailSent: false,
        matches: matchingJobs.length,
      });
    }

    return res.status(201).json({
      message:
        matchingJobs.length > 0
          ? `Enviámos para ${email} um email com ${matchingJobs.length} vaga${matchingJobs.length === 1 ? '' : 's'} publicada${matchingJobs.length === 1 ? '' : 's'}.`
          : `Alerta ativado! De momento não há vagas com estes filtros — avisamos-te por email assim que surgir uma.`,
      emailSent: true,
      matches: matchingJobs.length,
    });
  } catch (error) {
    logServerError('job_alerts.registar_alerta_de_vagas_failed', error);
    return res.status(500).json({ error: 'Não foi possível ativar o alerta.' });
  }
}
