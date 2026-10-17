import { admin as adminApp } from '../../../lib/firebaseAdmin';
import * as firebaseAdmin from 'firebase-admin';
import {
  getCandidatePlanFeatures,
  getPlanSummary,
} from '../../../lib/candidatePlanFeatures';
import {
  evaluateCandidateJobAccess,
  normalizeCoverLetter,
} from '../../../lib/applicationPolicy';
import {
  normalizeApplicationForm,
  stripExcludedApplicationFields,
  validateApplicationForm,
  validateApplicationFormV2,
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
import { requireActiveApiUser } from '../../../lib/apiUserAuth';
import { recordActivity } from '../../../lib/activityLog';
import { getSubmitApplication } from '../../../infrastructure/firebase/applications/createSubmitApplication';
import { FirestoreFeatureFlags } from '../../../infrastructure/firebase/marketplace/FirestoreFeatureFlags';
import { getFeatureEnvironment } from '../../../infrastructure/firebase/marketplace/environment';
import { consumeRateLimit } from '../../../infrastructure/firebase/marketplace/consumeRateLimit';

// D9: a flag é lida no servidor por pedido (cache de 60 s por instância).
let applicationFlags = null;
async function isV2SubmissionEnabled(uid) {
  try {
    applicationFlags ||= new FirestoreFeatureFlags(adminApp.firestore());
    return await applicationFlags.enabled('V2_APPLICATION_SNAPSHOT', {
      environment: getFeatureEnvironment(),
      userId: uid,
    });
  } catch (error) {
    logServerError('applications.ler_flag_v2_failed', error);
    return false;
  }
}

const V2_FAILURE_STATUS = {
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

function applicationError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
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

        // F2.1/G2.1: no caminho v2 a candidatura é gratuita — sem limite
        // mensal, sem vagas «premium», sem prioridade paga. O único limite é
        // o anti-spam (D13), aplicado no caso de uso.
        const v2Submission = await isV2SubmissionEnabled(uid);
        if (v2Submission) {
          return submitV2Application({
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

        // Verificar se já existe candidatura
        const existingApplications = await adminApp
          .firestore()
          .collection('applications')
          .where('jobId', '==', jobId)
          .where('candidateId', '==', uid)
          .get();
        if (!existingApplications.empty) {
          return res
            .status(409)
            .json({ error: 'Já se candidatou a esta vaga.' });
        }

        // Obter plano do candidato (já trata plano expirado ou inexistente)
        const planSummary = getPlanSummary(userData);
        const planId = planSummary.planId; // Pode ser básico se expirou

        // Se o plano expirou, atualizar no banco de dados para básico
        if (
          userData.currentPlan &&
          userData.currentPlan !== 'basic_candidato' &&
          !planSummary.isActive
        ) {
          try {
            await adminApp.firestore().collection('users').doc(uid).update({
              currentPlan: 'basic_candidato',
              planId: 'basic_candidato',
              planName: 'Básico',
              planEndDate: null,
              updatedAt: adminApp.firestore.FieldValue.serverTimestamp(),
            });
          } catch (updateError) {
            logServerError(
              'applications.atualizar_plano_expirado_failed',
              updateError,
            );
          }
        }

        const applicationAccess = evaluateCandidateJobAccess(
          jobData,
          planSummary,
        );

        // A candidatura é gratuita; os limites anti-spam são independentes do plano.

        // Criar candidatura
        const publicAssessment = getPublicSkillsAssessment(
          jobData.skillsAssessment,
        );
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

        const normalizedCoverLetter = normalizeCoverLetter(coverLetter);

        // O formulário é revalidado aqui de propósito. O modal valida para dar
        // resposta imediata a quem escreve, mas o pedido pode não vir do modal
        // — e a carta é a única parte que já tinha regras do lado do servidor.
        const coverLetterAllowed = true;
        const normalizedApplicationForm = applicationForm
          ? normalizeApplicationForm({
              ...applicationForm,
              coverLetter: normalizedCoverLetter,
            })
          : null;

        if (!normalizedApplicationForm) {
          return res.status(400).json({
            error: 'Preencha o formulário de candidatura para enviar.',
            code: 'APPLICATION_FORM_REQUIRED',
          });
        }

        const applicationFormErrors = validateApplicationForm(
          normalizedApplicationForm,
          { coverLetterEnabled: coverLetterAllowed },
        );
        if (Object.keys(applicationFormErrors).length > 0) {
          return res.status(400).json({
            error: 'Há campos por preencher no formulário de candidatura.',
            code: 'APPLICATION_FORM_INVALID',
            fields: applicationFormErrors,
          });
        }

        // Os requisitos são recalculados aqui a partir da vaga e do perfil. A
        // lista não vem do cliente de propósito: bastaria enviá-la vazia para
        // saltar todos os documentos exigidos.
        const documentRequirements = resolveDocumentRequirements({
          job: jobData,
          profile: {
            cvUrl: profileData.cvUrl || userData.cvUrl || '',
            cvUpdatedAt: profileData.cvUpdatedAt || userData.cvUpdatedAt || '',
            certificateFiles: profileData.certificateFiles || [],
          },
        });

        // Cada anexo tem de estar dentro da pasta do próprio candidato. Sem
        // isto, bastava colar o URL do ficheiro de outra pessoa para o anexar
        // à sua candidatura — e a rota que assina os downloads passaria a
        // servi-lo como se fosse dele.
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
            documentosVerificados[tipo] = Array.isArray(valor)
              ? validos
              : validos[0];
          }
        }
        normalizedApplicationForm.documents = documentosVerificados;

        const documentErrors = validateApplicationDocuments(
          documentRequirements,
          documentosVerificados,
        );
        if (Object.keys(documentErrors).length > 0) {
          return res.status(400).json({
            error: 'Faltam documentos exigidos por esta vaga.',
            code: 'APPLICATION_DOCUMENTS_MISSING',
            fields: documentErrors,
          });
        }

        if (jobData.requireCoverLetter && !normalizedCoverLetter) {
          return res.status(400).json({
            error: 'Esta vaga exige carta de apresentação personalizada.',
            code: 'COVER_LETTER_REQUIRED',
          });
        }

        const compatibility = analyzeCandidateJobFit(
          jobData,
          userData,
          profileData,
        );
        const applicationConfig = applicationAccess.config;
        const candidateAccess = applicationAccess.candidateAccess;

        const applicationDescriptionParts = [
          `Enviou a sua candidatura para ${jobData.titulo || jobData.title || 'a vaga'}.`,
        ];

        if (normalizedCoverLetter) {
          applicationDescriptionParts.push('Carta de apresentação incluída.');
        }

        const applicationData = {
          jobId,
          companyId: jobData.companyId || null,
          candidateId: uid,
          candidateName: userData.fullName || userData.name || userData.email,
          candidateEmail: userData.email,
          jobTitle: jobData.titulo || jobData.title || '',
          company: jobData.companyName || '',
          jobLocation: jobData.localizacao || jobData.location || '',
          jobType: jobData.tipoContrato || jobData.contractType || '',
          status: 'pending',
          skillsAssessmentResult,
          coverLetter: normalizedCoverLetter,
          applicationForm: normalizedApplicationForm,
          requiredDocuments: documentRequirements.map(
            ({ id, label, satisfiedByProfile }) => ({
              id,
              label,
              satisfiedByProfile,
            }),
          ),
          priorityApplied: Boolean(candidateAccess.priorityApplied),
          applicationHighlighted: Boolean(candidateAccess.highlighted),
          priorityLevel: Number(candidateAccess.priorityLevel) || 0,
          // F2.1/H7: o plano pago do candidato não é gravado na candidatura,
          // que a empresa pode ler — não pode influenciar a triagem.
          premiumOnlyJob: Boolean(applicationConfig.premiumOnly),
          accessedDuringEarlyWindow: Boolean(
            applicationConfig.isEarlyAccessActive,
          ),
          earlyAccessUntil: applicationConfig.earlyAccessUntil || null,
          requireCoverLetter: Boolean(applicationConfig.requireCoverLetter),
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
          compatibilityKeywords: Array.isArray(compatibility.candidateKeywords)
            ? compatibility.candidateKeywords.slice(0, 8)
            : [],
          cvOptimizationTips: Array.isArray(compatibility.cvOptimizationTips)
            ? compatibility.cvOptimizationTips.slice(0, 4)
            : [],
          applicationFeedback: compatibility.feedback || '',
          appliedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
          timeline: [
            {
              title: 'Candidatura enviada',
              description: applicationDescriptionParts.join(' '),
              icon: '📨',
              date: new Date().toISOString(),
              by: uid,
              byType: 'candidato',
            },
          ],
          createdAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
        };

        // D13: o caminho legado mantém exatamente o mesmo limite anti-spam
        // do domínio v2. Não é quota comercial e não depende do plano. Tal
        // como no v2, só é consumido depois de todas as validações: corrigir
        // o formulário não pode gastar tentativas.
        try {
          const rateLimit = await consumeRateLimit(
            adminApp.firestore(),
            'application_submit',
            { userId: uid },
            process.env.RATE_LIMIT_HASH_SECRET ||
              `empregostp:${process.env.FIREBASE_PROJECT_ID || adminApp.app().options.projectId || 'local'}`,
          );
          if (!rateLimit.allowed) {
            return res.status(429).json({
              error:
                'Fez muitas candidaturas em pouco tempo. Tente novamente dentro de alguns minutos.',
              code: 'RATE_LIMITED',
            });
          }
        } catch (error) {
          logServerError('applications.rate_limit_failed', error);
          return res.status(503).json({
            error:
              'Não foi possível validar o limite de candidaturas. Tente novamente mais tarde.',
            code: 'RATE_LIMIT_UNAVAILABLE',
          });
        }

        const applicationId = `${jobId}_${uid}`;
        const applRef = adminApp
          .firestore()
          .collection('applications')
          .doc(applicationId);
        const eventRef = adminApp.firestore().collection('outboxEvents').doc();

        try {
          await adminApp.firestore().runTransaction(async (transaction) => {
            const applicationSnapshot = await transaction.get(applRef);
            if (applicationSnapshot.exists) {
              throw applicationError(
                'APPLICATION_ALREADY_EXISTS',
                'Já se candidatou a esta vaga.',
              );
            }

            transaction.set(applRef, applicationData);
            transaction.create(eventRef, {
              type: 'entity_status_changed',
              schemaVersion: 1,
              payload: {
                entityId: applicationId,
                entityKind: 'Application',
                version: 1,
              },
              status: 'PENDING',
              attempts: 0,
              createdAtMs: Date.now(),
              nextAttemptAtMs: Date.now(),
            });
          });
        } catch (transactionError) {
          if (transactionError?.code === 'APPLICATION_ALREADY_EXISTS') {
            return res.status(409).json({ error: transactionError.message });
          }
          throw transactionError;
        }

        // Os documentos entregues ficam guardados no perfil: quem já entregou
        // um registo criminal numa vaga não devia ter de o voltar a carregar
        // na seguinte. Falhar aqui não invalida a candidatura, que já está
        // gravada — por isso o erro é registado e não propagado.
        if (Object.keys(documentosVerificados).length > 0) {
          try {
            const guardados = {};
            for (const [tipo, valor] of Object.entries(documentosVerificados)) {
              // O CV tem o seu próprio campo no perfil e a sua própria data.
              if (tipo === 'cv') continue;
              guardados[`documents.${tipo}`] = valor;
            }
            if (Object.keys(guardados).length > 0) {
              await adminApp
                .firestore()
                .collection('profiles')
                .doc(uid)
                .set({ documents: {} }, { merge: true })
                .then(() =>
                  adminApp
                    .firestore()
                    .collection('profiles')
                    .doc(uid)
                    .update(guardados),
                );
            }
          } catch (error) {
            logServerError('applications.guardar_documentos_no_perfil', error);
          }
        }

        // Registrar atividade para auditoria
        await recordActivity(adminApp, {
          type: 'application_created',
          description: `Nova candidatura à vaga "${jobData.titulo || jobId}"`,
          applicationId: applRef.id,
          candidateId: uid,
          jobId,
        });

        // Criar notificação para a empresa
        if (jobData.companyId) {
          try {
            await createServerNotification(adminApp, {
              userId: jobData.companyId,
              title: 'Nova candidatura recebida',
              message: `${userData.fullName || userData.name || 'Um candidato'} candidatou-se a ${jobData.titulo}`,
              type: 'application',
              icon: '👤',
              relatedId: applRef.id,
              relatedJobId: jobId,
              actionUrl: '/dashboard/empresa?tab=applications',
            });
          } catch (notifError) {
            logServerError('applications.criar_notificacao_failed', notifError);
          }
        }

        // Criar notificação de confirmação para o candidato (apenas se plano permite)
        const candidatePlanFeatures = getCandidatePlanFeatures(planId);
        if (candidatePlanFeatures.canReceiveNotifications) {
          try {
            await createServerNotification(adminApp, {
              userId: uid,
              title: 'Candidatura enviada com sucesso',
              message: `A sua candidatura para ${jobData.titulo} foi enviada. Pode acompanhá-la no seu painel.`,
              type: 'application',
              icon: '✅',
              relatedId: applRef.id,
              relatedJobId: jobId,
              actionUrl: '/dashboard/candidato?tab=applications',
            });
          } catch (notifError) {
            logServerError(
              'applications.criar_notificacao_de_confirmacao_failed',
              notifError,
            );
          }
        }

        return res.status(201).json({ applicationId: applRef.id });
      }
      case 'GET': {
        const { jobId: queryJobId } = req.query;
        // O cliente usa a política para o formulário (campos e obrigatórios);
        // o servidor volta a aplicá-la ao submeter.
        const submissionPolicy = (await isV2SubmissionEnabled(uid))
          ? 'v2'
          : 'legacy';
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
        return res.status(200).json({ applications, submissionPolicy });
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

async function submitV2Application({
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
  const applicationFormErrors = validateApplicationFormV2(
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
  // pago: no v2 não existem (F2.1, K1).
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
    return res.status(V2_FAILURE_STATUS[first.code] || 400).json({
      error: { code: first.code, message: first.message },
      failures: result.failures,
    });
  }

  if (result.replayed) {
    return res.status(200).json({ applicationId: result.applicationId });
  }

  // Efeitos secundários depois de gravar: nunca fazem falhar a candidatura.
  // Até ao NotificationDispatcher da Fase 3 (ADR-010), mantêm os avisos atuais.
  try {
    await recordActivity(adminApp, {
      type: 'application_created',
      description: `Nova candidatura à vaga "${jobTitle || jobId}"`,
      applicationId: result.applicationId,
      candidateId: uid,
      jobId,
    });
  } catch (error) {
    logServerError('applications.v2_registar_atividade_failed', error);
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
      logServerError('applications.v2_notificar_empresa_failed', error);
    }
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
    logServerError('applications.v2_notificar_candidato_failed', error);
  }
  return res.status(201).json({ applicationId: result.applicationId });
}
