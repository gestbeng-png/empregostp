import { admin as adminApp } from '../../../lib/firebaseAdmin';
import { normalizeCoverLetter } from '../../../lib/applicationPolicy';
import {
  normalizeApplicationForm,
  stripExcludedApplicationFields,
  validateApplicationForm,
} from '../../../lib/applicationForm';
import {
  resolveDocumentRequirements,
  validateApplicationDocuments,
} from '../../../lib/applicationDocuments';
import { resolveOwnedStorageObjectPath } from '../../../lib/storageObjectPath';
import {
  getEffectiveJobStatus,
  syncExpiredJobStatus,
} from '../../../lib/jobExpiration';
import { analyzeCandidateJobFit } from '../../../lib/candidateOptimizationInsights';
import {
  calculateSkillsAssessmentResult,
  getPublicSkillsAssessment,
} from '../../../lib/skillsAssessment';
import { createServerNotification } from '../../../lib/serverNotifications';
import { logServerError } from '../../../lib/serverLog';
import { isEmailConfigured, sendEmail } from '../../../lib/email';
import { buildNewApplicationEmail } from '../../../lib/email/applicationEmails';
import { resolveBaseUrl } from '../../../lib/email/authEmails';
import { requireActiveApiUser } from '../../../lib/apiUserAuth';
import { recordActivity } from '../../../lib/activityLog';
import { getSubmitApplication } from '../../../infrastructure/firebase/applications/createSubmitApplication';
import { getFeatureEnvironment } from '../../../infrastructure/firebase/marketplace/environment';

const FAILURE_STATUS = {
  NOT_AUTHENTICATED: 401,
  CONTACT_NOT_VERIFIED: 403,
  ACCOUNT_SUSPENDED: 403,
  JOB_NOT_ACCEPTING: 400,
  ALREADY_APPLIED: 409,
  PROFILE_INCOMPLETE: 422,
  SCREENING_UNANSWERED: 422,
  RATE_LIMITED: 429,
  IDEMPOTENCY_KEY_MISSING: 400,
};

function readIdempotencyKey(req) {
  const header = req.headers?.['idempotency-key'];
  const value = Array.isArray(header) ? header[0] : header;
  return String(value || req.body?.idempotencyKey || '').trim() || null;
}

export default async function handler(req, res) {
  const { method } = req;

  try {
    const authResult = await requireActiveApiUser(req, res, {
      adminApp,
      missingUserMessage: 'Utilizador não encontrado',
    });
    if (!authResult) return;
    const { uid, userData, decodedToken } = authResult;

    if (userData.userType !== 'candidato') {
      return res
        .status(403)
        .json({ error: 'Só candidatos se podem candidatar a vagas.' });
    }

    switch (method) {
      case 'POST': {
        const {
          jobId,
          assessmentAnswers = [],
          coverLetter = '',
          applicationForm = null,
        } = req.body;
        if (!jobId)
          return res.status(400).json({ error: 'jobId é obrigatório' });

        // Buscar vaga e perfil do candidato
        const jobDocRef = adminApp.firestore().collection('jobs').doc(jobId);
        const profileDocRef = adminApp
          .firestore()
          .collection('profiles')
          .doc(uid);
        const [jobDoc, profileDoc] = await Promise.all([
          jobDocRef.get(),
          profileDocRef.get(),
        ]);
        if (!jobDoc.exists) {
          return res.status(404).json({ error: 'Vaga não encontrada' });
        }
        const syncedJob = await syncExpiredJobStatus(
          jobDocRef,
          jobDoc.data(),
          adminApp,
        );
        const jobData = syncedJob.jobData;
        const profileData = profileDoc.exists ? profileDoc.data() : {};

        if (getEffectiveJobStatus(jobData) !== 'active') {
          return res
            .status(400)
            .json({ error: 'Esta vaga não está aberta para candidaturas' });
        }

        // A candidatura é gratuita — sem limite mensal, vagas «premium» nem
        // prioridade paga. O único limite é o anti-spam, aplicado no caso de
        // uso.
        return submitApplication({
          req,
          res,
          uid,
          userData,
          decodedToken,
          jobId,
          jobData,
          profileData,
          coverLetter,
          applicationForm,
          assessmentAnswers,
        });
      }
      case 'GET': {
        const { jobId: queryJobId } = req.query;
        let ref = adminApp
          .firestore()
          .collection('applications')
          .where('candidateId', '==', uid);
        if (queryJobId) {
          ref = ref.where('jobId', '==', queryJobId);
        }
        const appsSnap = await ref.get();
        const applications = appsSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        return res.status(200).json({ applications });
      }
      default:
        return res
          .status(405)
          .setHeader('Allow', ['GET', 'POST'])
          .json({ error: 'Método não permitido' });
    }
  } catch (error) {
    logServerError('applications.rota_api_applications_failed', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function submitApplication({
  req,
  res,
  uid,
  userData,
  decodedToken,
  jobId,
  jobData,
  profileData,
  coverLetter,
  applicationForm,
  assessmentAnswers,
}) {
  const publicAssessment = getPublicSkillsAssessment(jobData.skillsAssessment);
  let skillsAssessmentResult = null;
  if (publicAssessment?.enabled) {
    if (
      !Array.isArray(assessmentAnswers) ||
      assessmentAnswers.length !== publicAssessment.questions.length
    ) {
      return res.status(400).json({
        error:
          'Responda ao teste de competências antes de enviar a candidatura.',
      });
    }
    skillsAssessmentResult = calculateSkillsAssessmentResult(
      jobData.skillsAssessment,
      assessmentAnswers,
    );
  }

  // A carta manual é gratuita para todos e opcional (F2.1/F2.3). Data de
  // nascimento e nacionalidade nunca são guardadas (H7/F4.5).
  const normalizedCoverLetter = normalizeCoverLetter(coverLetter);
  const normalizedApplicationForm = applicationForm
    ? stripExcludedApplicationFields(
        normalizeApplicationForm({
          ...applicationForm,
          coverLetter: normalizedCoverLetter,
        }),
      )
    : null;
  if (!normalizedApplicationForm) {
    return res.status(400).json({
      error: 'Preencha o formulário de candidatura para enviar.',
      code: 'APPLICATION_FORM_REQUIRED',
    });
  }
  const applicationFormErrors = validateApplicationForm(
    normalizedApplicationForm,
    { requireCoverLetter: Boolean(jobData.requireCoverLetter) },
  );
  if (Object.keys(applicationFormErrors).length > 0) {
    return res.status(400).json({
      error: 'Há campos por preencher no formulário de candidatura.',
      code: 'APPLICATION_FORM_INVALID',
      fields: applicationFormErrors,
    });
  }

  const documentRequirements = resolveDocumentRequirements({
    job: jobData,
    profile: {
      cvUrl: profileData.cvUrl || userData.cvUrl || '',
      cvUpdatedAt: profileData.cvUpdatedAt || userData.cvUpdatedAt || '',
      certificateFiles: profileData.certificateFiles || [],
    },
  });
  const documentosVerificados = {};
  for (const [tipo, valor] of Object.entries(
    normalizedApplicationForm.documents || {},
  )) {
    const ficheiros = Array.isArray(valor) ? valor : [valor];
    const validos = [];
    for (const ficheiro of ficheiros) {
      const storagePath = resolveOwnedStorageObjectPath({
        ownerUid: uid,
        prefix: 'candidaturas',
        value: ficheiro.url,
      });
      if (!storagePath) {
        return res.status(400).json({
          error: 'Um dos documentos enviados não é válido.',
          code: 'APPLICATION_DOCUMENT_INVALID',
        });
      }
      validos.push({ ...ficheiro, storagePath });
    }
    if (validos.length) {
      documentosVerificados[tipo] = Array.isArray(valor) ? validos : validos[0];
    }
  }
  normalizedApplicationForm.documents = documentosVerificados;
  // F2.3/F3.4: documentos pedidos em falta nunca bloqueiam — a candidatura
  // segue e a empresa vê o que falta (sem rejeição automática).
  const documentErrors = validateApplicationDocuments(
    documentRequirements,
    documentosVerificados,
  );
  const missingDocuments = Object.keys(documentErrors).map(
    (id) => `DOCUMENT:${id}`,
  );

  const compatibility = analyzeCandidateJobFit(jobData, userData, profileData);
  const candidateName = userData.fullName || userData.name || userData.email;
  const jobTitle = jobData.titulo || jobData.title || '';
  // Campos que os painéis atuais leem (D7). Sem plano, prioridade nem destaque
  // pago: não existem (F2.1, K1).
  const legacyFields = {
    companyId: jobData.companyId || null,
    candidateName,
    candidateEmail: userData.email,
    jobTitle,
    company: jobData.companyName || '',
    jobLocation: jobData.localizacao || jobData.location || '',
    jobType: jobData.tipoContrato || jobData.contractType || '',
    skillsAssessmentResult,
    applicationForm: normalizedApplicationForm,
    requiredDocuments: documentRequirements.map(
      ({ id, label, satisfiedByProfile }) => ({
        id,
        label,
        satisfiedByProfile,
      }),
    ),
    priorityApplied: false,
    applicationHighlighted: false,
    priorityLevel: 0,
    requireCoverLetter: Boolean(jobData.requireCoverLetter),
    compatibilityScore: Number(compatibility.matchPercent) || 0,
    compatibilityLabel: compatibility.matchLabel || '',
    compatibilityReasons: Array.isArray(compatibility.reasons)
      ? compatibility.reasons.slice(0, 4)
      : [],
    compatibilityMatchedSkills: Array.isArray(compatibility.matchedSkills)
      ? compatibility.matchedSkills.slice(0, 6)
      : [],
    compatibilityMissingSkills: Array.isArray(compatibility.missingSkills)
      ? compatibility.missingSkills.slice(0, 6)
      : [],
    timeline: [
      {
        title: 'Candidatura enviada',
        description: `Enviou a sua candidatura para ${jobTitle || 'a vaga'}.`,
        icon: '📨',
        date: new Date().toISOString(),
        by: uid,
        byType: 'candidato',
      },
    ],
  };

  const result = await getSubmitApplication().execute(
    {
      candidateUserId: uid,
      jobId,
      idempotencyKey: readIdempotencyKey(req),
      emailVerified: decodedToken?.email_verified === true,
      phoneVerified: Boolean(userData.phoneVerifiedAt),
      answers: req.body?.screeningAnswers,
      coverLetter: normalizedCoverLetter,
      sharedContacts: Array.isArray(req.body?.sharedContacts)
        ? req.body.sharedContacts
        : null,
      hardRequirementsNotMet: missingDocuments,
      source: typeof req.body?.source === 'string' ? req.body.source : null,
      utm: req.body?.utm,
      legacyFields,
    },
    { environment: getFeatureEnvironment() },
  );

  if (!result.ok) {
    if (result.code === 'NOT_FOUND') {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Vaga não encontrada.' },
      });
    }
    if (result.code === 'CV_SNAPSHOT_FAILED') {
      return res.status(503).json({
        error: {
          code: 'CV_SNAPSHOT_FAILED',
          message:
            'Não foi possível guardar uma cópia do seu CV. Tente novamente dentro de instantes.',
        },
      });
    }
    // 422 e não 409: o cliente atual trata 409 como «já se candidatou».
    if (result.code === 'IDEMPOTENCY_CONFLICT') {
      return res.status(422).json({
        error: {
          code: 'IDEMPOTENCY_CONFLICT',
          message:
            'Este pedido já foi usado. Atualize a página e tente novamente.',
        },
      });
    }
    if (result.code !== 'ELIGIBILITY') {
      return res.status(403).json({
        error: {
          code: result.code,
          message: 'Não é possível enviar esta candidatura.',
        },
      });
    }
    const [first] = result.failures;
    return res.status(FAILURE_STATUS[first.code] || 400).json({
      error: { code: first.code, message: first.message },
      failures: result.failures,
    });
  }

  if (result.replayed) {
    return res.status(200).json({ applicationId: result.applicationId });
  }

  // Efeitos secundários depois de gravar: nunca fazem falhar a candidatura.
  try {
    await recordActivity(adminApp, {
      type: 'application_created',
      description: `Nova candidatura à vaga "${jobTitle || jobId}"`,
      applicationId: result.applicationId,
      candidateId: uid,
      jobId,
    });
  } catch (error) {
    logServerError('applications.registar_atividade_failed', error);
  }
  if (jobData.companyId) {
    try {
      await createServerNotification(adminApp, {
        userId: jobData.companyId,
        title: 'Nova candidatura recebida',
        message: `${candidateName || 'Um candidato'} candidatou-se a ${jobTitle}`,
        type: 'application',
        icon: '👤',
        relatedId: result.applicationId,
        relatedJobId: jobId,
        actionUrl: '/dashboard/empresa?tab=applications',
      });
    } catch (error) {
      logServerError('applications.notificar_empresa_failed', error);
    }
    // Aviso por email à empresa: a notificação no painel só é vista por quem
    // entra nele.
    await sendNewApplicationEmail({
      req,
      companyId: jobData.companyId,
      candidateName,
      jobTitle,
      compatibility,
      hasCoverLetter: Boolean(normalizedCoverLetter),
    });
  }
  // F7.2: a confirmação ao candidato é transacional — nunca depende de plano.
  try {
    await createServerNotification(adminApp, {
      userId: uid,
      title: 'Candidatura recebida',
      message: `A sua candidatura para ${jobTitle} foi recebida. Pode acompanhá-la no seu painel.`,
      type: 'application',
      icon: '✅',
      relatedId: result.applicationId,
      relatedJobId: jobId,
      actionUrl: '/dashboard/candidato?tab=applications',
    });
  } catch (error) {
    logServerError('applications.notificar_candidato_failed', error);
  }
  return res.status(201).json({ applicationId: result.applicationId });
}

async function sendNewApplicationEmail({
  req,
  companyId,
  candidateName,
  jobTitle,
  compatibility,
  hasCoverLetter,
}) {
  if (!isEmailConfigured()) return;
  try {
    const companyDoc = await adminApp
      .firestore()
      .collection('users')
      .doc(companyId)
      .get();
    const companyEmail = companyDoc.exists ? companyDoc.data()?.email : null;
    if (!companyEmail) return;
    await sendEmail({
      to: companyEmail,
      ...buildNewApplicationEmail({
        candidateName,
        jobTitle,
        compatibilityLabel: compatibility.matchLabel || '',
        compatibilityScore: Number(compatibility.matchPercent) || 0,
        hasCoverLetter,
        priorityApplied: false,
        site: resolveBaseUrl(req),
      }),
    });
  } catch (error) {
    logServerError('applications.enviar_email_empresa_failed', error);
  }
}
