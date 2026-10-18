import { admin } from '../../../lib/firebaseAdmin';
import {
  canCreateJob,
  canHighlightJob,
  getEmpresaPlanSummary,
  getJobExpirationDate,
} from '../../../lib/empresaPlanFeatures';
import { buildJobApplicationPolicy } from '../../../lib/applicationPolicy';
import {
  getEffectiveJobStatus,
  syncExpiredJobStatus,
} from '../../../lib/jobExpiration';
import {
  JOB_STATUS_PENDING_REVIEW,
  isJobModerationEnabled,
} from '../../../lib/jobModeration';
import { logServerError, logServerWarning } from '../../../lib/serverLog';
import { normalizeSkillsAssessmentInput } from '../../../lib/skillsAssessment';
import { normalizeRequiredDocuments } from '../../../lib/applicationDocuments';
import { broadcastNewJob } from '../../../lib/newJobBroadcast';
import { evaluateJobSubmission } from '../../../domain/jobs/submission';
import { validateScreeningQuestions } from '../../../domain/jobs/screening';
import { canUseFeature } from '../../../domain/entitlements/canUseFeature';
import { EMPLOYER_REVIEW_MESSAGE } from '../../../domain/jobs/riskScore';
import {
  jobIdFor,
  persistJob,
} from '../../../infrastructure/firebase/jobs/FirestoreJobPublisher';

async function notifyAdminsOfReview(payload, jobId) {
  // Os admins recebem a nova vaga na fila de revisão; uma falha aqui não
  // impede a submissão da vaga.
  try {
    const adminsSnapshot = await admin
      .firestore()
      .collection('users')
      .where('userType', '==', 'admin')
      .get();
    await Promise.all(
      adminsSnapshot.docs.map((adminDoc) =>
        admin
          .firestore()
          .collection('notifications')
          .add({
            userId: adminDoc.id,
            type: 'JOB_REVIEW',
            title: 'Vaga aguarda revisão',
            message: `${payload.companyName || 'Uma empresa'} submeteu a vaga "${payload.titulo}" para revisão.`,
            icon: '📋',
            read: false,
            relatedId: jobId,
            relatedType: 'job',
            actionUrl: '/dashboard/admin/jobs?status=pending_review',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          }),
      ),
    );
  } catch (notificationError) {
    logServerWarning(
      'jobs.moderation_admin_notification_failed',
      notificationError,
    );
  }
}

async function createJob({
  req,
  res,
  auth,
  payload,
  moderationEnabled,
  warning,
}) {
  const now = new Date();
  // F3.3: perguntas de triagem — limite pelo entitlement (gratuito: 3).
  const screeningLimit =
    canUseFeature(
      { type: 'ORGANIZATION', id: auth.uid },
      'SCREENING_QUESTIONS',
      [],
      { now: now.getTime() },
    ).limit ?? 8;
  const screening = validateScreeningQuestions(
    req.body?.screeningQuestions,
    screeningLimit,
  );
  if (!screening.ok) {
    return res.status(422).json({
      error: { code: screening.code, message: screening.message },
      ...(screening.terms ? { terms: screening.terms } : {}),
    });
  }
  payload = { ...payload, screeningQuestions: screening.questions };
  const [existingSnapshot] = await Promise.all([
    admin
      .firestore()
      .collection('jobs')
      .where('companyId', '==', auth.uid)
      .limit(200)
      .get(),
  ]);
  const toDate = (value) =>
    value?.toDate ? value.toDate() : value ? new Date(value) : null;
  const evaluation = evaluateJobSubmission({
    payload,
    company: auth.userData,
    companyCreatedAt: toDate(auth.userData.createdAt),
    existingJobs: existingSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })),
    platformModerationForced: Boolean(moderationEnabled),
    now,
  });
  const { decision } = evaluation;
  if (decision.kind === 'BLOCKED') {
    return res.status(422).json({
      error: { code: decision.code, message: decision.message },
      ...(decision.code === 'JOB_MULTIPLE_ROLES'
        ? { splitTitles: decision.splitTitles }
        : {}),
      ...(decision.code === 'JOB_QUALITY_TOO_LOW'
        ? {
            missing: decision.missing.map(({ criterion, label }) => ({
              criterion,
              label,
            })),
          }
        : {}),
      ...(decision.code === 'JOB_DUPLICATE'
        ? { duplicateOfJobId: decision.duplicateOfJobId }
        : {}),
    });
  }
  const header = req.headers?.['idempotency-key'];
  const idempotencyKey =
    String((Array.isArray(header) ? header[0] : header) || '').trim() || null;
  const jobId = jobIdFor(admin.firestore(), auth.uid, idempotencyKey);
  const outcome = await persistJob(admin.firestore(), {
    jobId,
    ownerUserId: auth.uid,
    payload,
    evaluation,
    now,
  });
  const jobDoc = await admin.firestore().collection('jobs').doc(jobId).get();
  const job = buildJobResponse(jobDoc, jobDoc.data(), 0);
  if (outcome.kind === 'CREATED') {
    if (outcome.status === 'PUBLISHED') {
      try {
        await broadcastNewJob(admin, { job: jobDoc.data(), jobId, req });
      } catch (broadcastError) {
        logServerWarning('jobs.new_job_broadcast_failed', broadcastError);
      }
    } else {
      await notifyAdminsOfReview(payload, jobId);
    }
  }
  const published = String(outcome.status) === 'PUBLISHED';
  return res.status(outcome.kind === 'CREATED' ? 201 : 200).json({
    // F1.6: o empregador nunca vê os sinais de risco em detalhe.
    message: published ? 'Vaga criada com sucesso' : EMPLOYER_REVIEW_MESSAGE,
    warning,
    // F1.2: sugestões só quando publica com 50–69.
    suggestions: [
      ...(evaluation.quality.score < 70
        ? evaluation.quality.missing.map(({ label }) => label)
        : []),
      // H8: aviso ao empregador (a vaga vai para revisão humana).
      ...(evaluation.protectedTerms.length
        ? [
            `Retire referências a ${evaluation.protectedTerms.join(', ')}: não podem ser critério de seleção`,
          ]
        : []),
    ],
    job,
  });
}

function toIsoDateString(value) {
  if (!value) return '';
  try {
    const date = value.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString();
  } catch (error) {
    return '';
  }
}

function toMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function normalizeKeywords(value) {
  if (Array.isArray(value)) {
    return value.map((item) => `${item}`.trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function getBasicEmpresaUpdate() {
  return {
    currentPlan: 'basic_empresa',
    planId: 'basic_empresa',
    planName: 'Básico',
    planEndDate: null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

async function getAuthenticatedCompany(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token de autenticação não fornecido' });
    return null;
  }

  const token = authHeader.split('Bearer ')[1];
  const decodedToken = await admin.auth().verifyIdToken(token);
  const userDoc = await admin
    .firestore()
    .collection('users')
    .doc(decodedToken.uid)
    .get();

  if (!userDoc.exists) {
    res.status(404).json({ error: 'Utilizador não encontrado' });
    return null;
  }

  const userData = userDoc.data();
  if (userData.userType !== 'empresa') {
    res.status(403).json({ error: 'Somente empresas podem gerir vagas' });
    return null;
  }

  const planSummary = getEmpresaPlanSummary(userData);
  if (userData.currentPlan && userData.currentPlan !== planSummary.planId) {
    try {
      if (!planSummary.isActive) {
        await userDoc.ref.update(getBasicEmpresaUpdate());
      } else {
        await userDoc.ref.update({
          currentPlan: planSummary.planId,
          planId: planSummary.planId,
          planName: planSummary.planName || userData.planName || '',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (error) {
      logServerError(
        'jobs.sincronizar_plano_expirado_da_empresa_failed',
        error,
      );
    }
  }

  return {
    uid: decodedToken.uid,
    userDoc,
    userData,
    planSummary,
  };
}

function buildJobResponse(doc, data, applicationCount = 0) {
  const effectiveStatus = getEffectiveJobStatus(data);
  return {
    id: doc.id,
    ...data,
    status: effectiveStatus,
    createdAt:
      toIsoDateString(data.createdAt) || toIsoDateString(data.updatedAt),
    updatedAt:
      toIsoDateString(data.updatedAt) || toIsoDateString(data.createdAt),
    publishedAt: toIsoDateString(data.publishedAt),
    expiresAt: toIsoDateString(data.expiresAt),
    createdAtMillis: toMillis(data.createdAt),
    updatedAtMillis: toMillis(data.updatedAt),
    applicationCount,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res
      .status(405)
      .setHeader('Allow', ['GET', 'POST'])
      .json({ error: 'Método não permitido' });
  }

  try {
    const auth = await getAuthenticatedCompany(req, res);
    if (!auth) return;

    if (req.method === 'GET') {
      const [jobsSnapshot, applicationsSnapshot] = await Promise.all([
        admin
          .firestore()
          .collection('jobs')
          .where('companyId', '==', auth.uid)
          .get(),
        admin
          .firestore()
          .collection('applications')
          .where('companyId', '==', auth.uid)
          .get(),
      ]);

      const applicationCounts = {};
      applicationsSnapshot.forEach((doc) => {
        const application = doc.data();
        if (application.jobId) {
          applicationCounts[application.jobId] =
            (applicationCounts[application.jobId] || 0) + 1;
        }
      });

      const normalizedJobs = await Promise.all(
        jobsSnapshot.docs.map(async (doc) => {
          const synced = await syncExpiredJobStatus(doc.ref, doc.data(), admin);
          return buildJobResponse(
            doc,
            synced.jobData,
            applicationCounts[doc.id] || 0,
          );
        }),
      );

      const vagas = normalizedJobs.sort(
        (a, b) => (b.createdAtMillis || 0) - (a.createdAtMillis || 0),
      );

      return res.status(200).json({
        vagas,
        plan: auth.planSummary,
      });
    }

    const {
      titulo,
      descricao,
      requisitos = '',
      responsabilidades = '',
      localizacao,
      tipoContrato,
      nivelExperiencia = '',
      escolaridade = '',
      salarioDe = '',
      salarioAte = '',
      beneficios = '',
      dataAbertura,
      dataFecho,
      remoto = false,
      destaque = false,
      tdrUrl = '',
      tdrFileName = '',
      vagasDisponiveis = 1,
      palavrasChave = '',
      categoria = '',
      skillsAssessment = null,
      premiumOnly = false,
      earlyAccessHours = 0,
      requireCoverLetter = false,
      requiredDocuments = null,
    } = req.body || {};

    if (!titulo || !descricao || !localizacao || !tipoContrato || !dataFecho) {
      return res
        .status(400)
        .json({ error: 'Preencha os campos obrigatórios da vaga' });
    }

    const planId = auth.planSummary.planId;
    const createCheck = await canCreateJob(auth.uid, planId, admin);
    if (!createCheck.allowed) {
      return res.status(403).json(createCheck);
    }

    if (destaque) {
      const highlightCheck = await canHighlightJob(auth.uid, planId, admin);
      if (!highlightCheck.allowed) {
        return res.status(403).json(highlightCheck);
      }
    }

    const maxExpirationDate = getJobExpirationDate(planId);
    const requestedCloseDate = new Date(dataFecho);
    if (Number.isNaN(requestedCloseDate.getTime())) {
      return res.status(400).json({ error: 'Data de fecho inválida' });
    }

    const finalCloseDate =
      requestedCloseDate > maxExpirationDate
        ? maxExpirationDate
        : requestedCloseDate;
    const openDate = dataAbertura || new Date().toISOString().split('T')[0];
    const moderationEnabled = await isJobModerationEnabled(admin);
    const premiumApplicationFields = buildJobApplicationPolicy({
      premiumOnly,
      earlyAccessHours,
      requireCoverLetter,
    });

    const payload = {
      titulo: `${titulo}`.trim(),
      descricao: `${descricao}`.trim(),
      requisitos: `${requisitos}`.trim(),
      responsabilidades: `${responsabilidades}`.trim(),
      localizacao: `${localizacao}`.trim(),
      tipoContrato: `${tipoContrato}`.trim(),
      nivelExperiencia: `${nivelExperiencia}`.trim(),
      escolaridade: `${escolaridade}`.trim(),
      salarioDe: salarioDe || '',
      salarioAte: salarioAte || '',
      beneficios: `${beneficios}`.trim(),
      dataAbertura: openDate,
      dataFecho: finalCloseDate.toISOString().split('T')[0],
      remoto: Boolean(remoto),
      destaque: Boolean(destaque),
      tdrUrl: `${tdrUrl}`.trim(),
      tdrFileName: `${tdrFileName}`.trim(),
      vagasDisponiveis:
        Number.parseInt(vagasDisponiveis, 10) > 0
          ? Number.parseInt(vagasDisponiveis, 10)
          : 1,
      palavrasChave: normalizeKeywords(palavrasChave),
      categoria: `${categoria}`.trim(),
      skillsAssessment: normalizeSkillsAssessmentInput(skillsAssessment),
      requiredDocuments: normalizeRequiredDocuments(requiredDocuments || {}),
      ...premiumApplicationFields,
      companyId: auth.uid,
      companyName: auth.userData.name || auth.userData.fullName || '',
      status: moderationEnabled ? JOB_STATUS_PENDING_REVIEW : 'active',
      views: 0,
      applicationCount: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      publishedAt: moderationEnabled
        ? null
        : admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(finalCloseDate),
      planId,
    };

    const warning =
      requestedCloseDate > maxExpirationDate
        ? `A data de fecho foi ajustada para ${payload.dataFecho} com base no limite do seu plano.`
        : null;

    return createJob({
      req,
      res,
      auth,
      payload,
      moderationEnabled,
      warning,
    });
  } catch (error) {
    logServerError('jobs.api_api_jobs_failed', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
