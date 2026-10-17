import { admin } from '../../../lib/firebaseAdmin';
import { enforceApiRateLimit, getClientIp } from '../../../lib/apiRateLimit';
import { sendEmail, isEmailConfigured } from '../../../lib/email';
import {
  filterPublishedJobs,
  buildJobAlertEmail,
} from '../../../lib/jobAlertEmail';
import {
  buildJobAlertFilterKey,
  buildJobAlertId,
  buildJobAlertUnsubscribeUrl,
  createJobAlertUnsubscribeToken,
  findEquivalentActiveJobAlert,
  getCanonicalJobAlertSiteUrl,
  hashJobAlertUnsubscribeToken,
} from '../../../lib/jobAlertSubscription';
import { logServerError } from '../../../lib/serverLog';
import { requireActiveApiUser } from '../../../lib/apiUserAuth';
import { isJobAlertActive } from '../../../lib/jobAlertDelivery';

// Regista a subscrição do alerta e envia de imediato um email com todas as
// vagas publicadas que correspondem aos filtros. As vagas publicadas depois
// chegam por lib/jobAlertDelivery.js, chamado em cada publicação.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
      job.empresaNome =
        namesById.get(job.companyId) ||
        job.empresaNome ||
        job.companyName ||
        'Empresa';
    });
  }

  return jobs;
}

function toIso(value) {
  if (!value) return null;
  const date =
    typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * C08 — o titular gere os alertas do próprio email no painel.
 *   GET            → alertas ativos
 *   DELETE ?id=…   → cancela um alerta (o de outra pessoa responde 404)
 */
async function handleOwnAlerts(req, res) {
  const authResult = await requireActiveApiUser(req, res, { adminApp: admin });
  if (!authResult) return;
  const email = String(
    authResult.userData.email || authResult.decodedToken.email || '',
  )
    .trim()
    .toLowerCase();
  if (!email) return res.status(200).json({ alerts: [] });

  try {
    const alertsCollection = admin.firestore().collection('jobAlerts');
    if (req.method === 'GET') {
      const snapshot = await alertsCollection.where('email', '==', email).get();
      const alerts = snapshot.docs
        .map((doc) => ({ id: doc.id, data: doc.data() || {} }))
        .filter(({ data }) => isJobAlertActive(data))
        .map(({ id, data }) => ({
          id,
          filters: data.filters || {},
          createdAt: toIso(data.createdAt),
          lastNotifiedAt: toIso(data.lastNotifiedAt),
        }));
      return res.status(200).json({ alerts });
    }

    const id = String(req.query?.id || '').trim();
    const alertRef = /^[A-Za-z0-9_-]{1,128}$/.test(id)
      ? alertsCollection.doc(id)
      : null;
    const alertDoc = alertRef ? await alertRef.get() : null;
    if (
      !alertDoc?.exists ||
      String(alertDoc.data()?.email || '').toLowerCase() !== email
    ) {
      return res.status(404).json({ error: 'Alerta não encontrado.' });
    }
    if (isJobAlertActive(alertDoc.data())) {
      await alertRef.update({
        active: false,
        status: 'unsubscribed',
        unsubscribedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    return res.status(200).json({ id, cancelled: true });
  } catch (error) {
    logServerError('job_alerts.gerir_alertas_failed', error);
    return res.status(500).json({
      error: 'Não foi possível carregar os alertas. Tente novamente.',
    });
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET' || req.method === 'DELETE') {
    res.setHeader('Cache-Control', 'no-store');
    return handleOwnAlerts(req, res);
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
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

    const firestore = admin.firestore();
    const alertsCollection = firestore.collection('jobAlerts');
    const filterKey = buildJobAlertFilterKey(filters);
    const existingSnapshot = await alertsCollection
      .where('email', '==', email)
      .get();
    const equivalentAlert = findEquivalentActiveJobAlert(
      existingSnapshot.docs,
      filters,
    );

    if (
      equivalentAlert &&
      equivalentAlert.data()?.unsubscribeTokenHash &&
      equivalentAlert.data()?.confirmationEmailSent === true
    ) {
      return res.status(200).json({
        message: 'Este alerta já está ativo com os mesmos filtros.',
        emailSent: false,
        deduplicated: true,
      });
    }

    const unsubscribeToken = createJobAlertUnsubscribeToken();
    const unsubscribeTokenHash = hashJobAlertUnsubscribeToken(unsubscribeToken);
    let alertRef =
      equivalentAlert?.ref ||
      alertsCollection.doc(buildJobAlertId(email, filters));
    let duplicateCreatedConcurrently = false;
    const now = admin.firestore.FieldValue.serverTimestamp();
    const alertData = {
      email,
      filters,
      filterKey,
      active: true,
      status: 'active',
      unsubscribeTokenHash,
      confirmationEmailSent: false,
      createdAt: now,
      updatedAt: now,
      userAgent: req.headers['user-agent'] || null,
      ip: getClientIp(req),
    };

    if (equivalentAlert) {
      await alertRef.set(alertData, { merge: true });
    } else {
      await firestore.runTransaction(async (transaction) => {
        const current = await transaction.get(alertRef);
        const currentData = current.exists ? current.data() || {} : {};
        const isEquivalentActive =
          current.exists &&
          currentData.active !== false &&
          currentData.status !== 'unsubscribed' &&
          (currentData.filterKey ||
            buildJobAlertFilterKey(currentData.filters || {})) === filterKey;

        if (
          isEquivalentActive &&
          currentData.unsubscribeTokenHash &&
          currentData.confirmationEmailSent === true
        ) {
          duplicateCreatedConcurrently = true;
          return;
        }

        transaction.set(alertRef, alertData, { merge: true });
      });
    }

    if (duplicateCreatedConcurrently) {
      return res.status(200).json({
        message: 'Este alerta já está ativo com os mesmos filtros.',
        emailSent: false,
        deduplicated: true,
      });
    }

    // Reunir as vagas publicadas que correspondem aos filtros e enviar já o email.
    const allJobs = await fetchPublishedJobs();
    const matchingJobs = filterPublishedJobs(allJobs, filters).slice(0, 30);
    const siteUrl = getCanonicalJobAlertSiteUrl();
    const unsubscribeUrl = buildJobAlertUnsubscribeUrl(
      alertRef.id,
      unsubscribeToken,
      siteUrl,
    );
    const { subject, html, text } = buildJobAlertEmail({
      jobs: matchingJobs,
      filters,
      baseUrl: siteUrl,
      unsubscribeUrl,
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
      try {
        await alertRef.update({
          confirmationEmailSent: true,
          confirmationEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (updateError) {
        logServerError('job_alerts.marcar_email_enviado_failed', updateError);
      }
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
