import { admin as adminApp } from '../../../lib/firebaseAdmin';
import * as firebaseAdmin from 'firebase-admin';
import {
  canApplyToFeaturedJob,
  canApplyToJob,
  canUseCoverLetter,
  getCandidatePlanFeatures,
  getPlanSummary,
} from '../../../lib/candidatePlanFeatures';
import {
  evaluateCandidateJobAccess,
  normalizeCoverLetter,
} from '../../../lib/candidateApplicationPremium';
import {
  normalizeApplicationForm,
  validateApplicationForm,
} from '../../../lib/applicationForm';
import {
  resolveDocumentRequirements,
  validateApplicationDocuments,
} from '../../../lib/applicationDocuments';
import { resolveOwnedStorageObjectPath } from '../../../lib/storageObjectPath';
import { getEffectiveJobStatus, syncExpiredJobStatus } from '../../../lib/jobExpiration';
import { analyzeCandidateJobFit } from '../../../lib/candidateOptimizationInsights';
import { calculateSkillsAssessmentResult, getPublicSkillsAssessment } from '../../../lib/skillsAssessment';
import { createServerNotification } from '../../../lib/serverNotifications';
import { isEmailConfigured, sendEmail } from '../../../lib/email';
import { buildNewApplicationEmail } from '../../../lib/applicationEmails';
import { resolveBaseUrl } from '../../../lib/authEmails';
import { logServerError } from '../../../lib/serverLog';
import { requireActiveApiUser } from '../../../lib/apiUserAuth';
import { recordActivity } from '../../../lib/activityLog';

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
      missingUserMessage: 'Usuário não encontrado',
    });
    if (!authResult) return;
    const { uid, userData } = authResult;

    if (userData.userType !== 'candidato') {
      return res.status(403).json({ error: 'Somente candidatos podem se candidatar a vagas' });
    }

    switch (method) {
      case 'POST': {
        const {
          jobId,
          assessmentAnswers = [],
          coverLetter = '',
          applicationForm = null,
        } = req.body;
        if (!jobId) return res.status(400).json({ error: 'jobId é obrigatório' });

        // Buscar vaga e perfil do candidato
        const jobDocRef = adminApp.firestore().collection('jobs').doc(jobId);
        const profileDocRef = adminApp.firestore().collection('profiles').doc(uid);
        const [jobDoc, profileDoc] = await Promise.all([jobDocRef.get(), profileDocRef.get()]);
        if (!jobDoc.exists) {
          return res.status(404).json({ error: 'Vaga não encontrada' });
        }
        const syncedJob = await syncExpiredJobStatus(jobDocRef, jobDoc.data(), adminApp);
        const jobData = syncedJob.jobData;
        const profileData = profileDoc.exists ? profileDoc.data() : {};

        if (getEffectiveJobStatus(jobData) !== 'active') {
          return res.status(400).json({ error: 'Esta vaga não está aberta para candidaturas' });
        }

        // Verificar se já existe candidatura
        const existingApplications = await adminApp
          .firestore()
          .collection('applications')
          .where('jobId', '==', jobId)
          .where('candidateId', '==', uid)
          .get();
        if (!existingApplications.empty) {
          return res.status(409).json({ error: 'Você já se candidatou a esta vaga' });
        }

        // Obter plano do candidato (já trata plano expirado ou inexistente)
        const planSummary = getPlanSummary(userData);
        const planId = planSummary.planId; // Pode ser básico se expirou
        
        // Se o plano expirou, atualizar no banco de dados para básico
        if (userData.currentPlan && userData.currentPlan !== 'basic_candidato' && !planSummary.isActive) {
          try {
            await adminApp.firestore().collection('users').doc(uid).update({
              currentPlan: 'basic_candidato',
              planId: 'basic_candidato',
              planName: 'Básico',
              planEndDate: null,
              updatedAt: adminApp.firestore.FieldValue.serverTimestamp()
            });
          } catch (updateError) {
            logServerError('applications.atualizar_plano_expirado_failed', updateError);
          }
        }

        const premiumAccessCheck = evaluateCandidateJobAccess(jobData, planSummary);
        if (!premiumAccessCheck.allowed) {
          return res.status(403).json({
            error: premiumAccessCheck.reason,
            code: premiumAccessCheck.code,
            upgradeMessage: premiumAccessCheck.upgradeMessage,
            upgradeUrl: premiumAccessCheck.upgradeUrl,
          });
        }

        // Verificar se pode se candidatar a vaga em destaque
        if (jobData.destaque === true) {
          const featuredCheck = canApplyToFeaturedJob(planId);
          if (!featuredCheck.allowed) {
            return res.status(403).json({ 
              error: featuredCheck.reason,
              code: 'FEATURED_JOB_RESTRICTED',
              upgradeMessage: featuredCheck.upgradeMessage,
              upgradeUrl: '/premium/candidatos'
            });
          }
        }

        // Verificar limite de candidaturas do mês
        const applyCheck = await canApplyToJob(uid, planId, adminApp);
        if (!applyCheck.allowed) {
          return res.status(403).json({ 
            error: applyCheck.reason,
            code: 'APPLICATION_LIMIT_REACHED',
            current: applyCheck.current,
            limit: applyCheck.limit,
            upgradeMessage: applyCheck.upgradeMessage,
            upgradeUrl: '/premium/candidatos'
          });
        }

        // Criar candidatura
        const publicAssessment = getPublicSkillsAssessment(jobData.skillsAssessment);
        let skillsAssessmentResult = null;

        if (publicAssessment?.enabled) {
          if (!Array.isArray(assessmentAnswers) || assessmentAnswers.length !== publicAssessment.questions.length) {
            return res.status(400).json({ error: 'Responda o teste de habilidades antes de enviar a candidatura.' });
          }

          skillsAssessmentResult = calculateSkillsAssessmentResult(jobData.skillsAssessment, assessmentAnswers);
        }

        const normalizedCoverLetter = normalizeCoverLetter(coverLetter);
        if (jobData.requireCoverLetter || normalizedCoverLetter) {
          const coverLetterCheck = canUseCoverLetter(planId);
          if (!coverLetterCheck.allowed) {
            return res.status(403).json({
              error: coverLetterCheck.reason,
              code: 'PREMIUM_APPLICATION_TOOLS_ONLY',
              upgradeMessage: coverLetterCheck.upgradeMessage,
              upgradeUrl: coverLetterCheck.upgradeUrl,
            });
          }
        }

        // O formulário é revalidado aqui de propósito. O modal valida para dar
        // resposta imediata a quem escreve, mas o pedido pode não vir do modal
        // — e a carta é a única parte que já tinha regras do lado do servidor.
        const coverLetterAllowed = canUseCoverLetter(planId).allowed;
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

        const compatibility = analyzeCandidateJobFit(jobData, userData, profileData);
        const premiumConfig = premiumAccessCheck.config;
        const candidatePremiumAccess = premiumAccessCheck.candidateAccess;

        const applicationDescriptionParts = [
          `Você enviou sua candidatura para ${jobData.titulo || jobData.title || 'a vaga'}.`,
        ];

        if (candidatePremiumAccess.priorityApplied) {
          applicationDescriptionParts.push('A candidatura entrou com prioridade do seu plano.');
        }
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
          priorityApplied: Boolean(candidatePremiumAccess.priorityApplied),
          applicationHighlighted: Boolean(candidatePremiumAccess.highlighted),
          priorityLevel: Number(candidatePremiumAccess.priorityLevel) || 0,
          candidatePlanId: planId,
          candidatePlanName: planSummary.planName || null,
          premiumOnlyJob: Boolean(premiumConfig.premiumOnly),
          accessedDuringEarlyWindow: Boolean(premiumConfig.isEarlyAccessActive),
          earlyAccessUntil: premiumConfig.earlyAccessUntil || null,
          requireCoverLetter: Boolean(premiumConfig.requireCoverLetter),
          compatibilityScore: Number(compatibility.matchPercent) || 0,
          compatibilityLabel: compatibility.matchLabel || '',
          compatibilityReasons: Array.isArray(compatibility.reasons) ? compatibility.reasons.slice(0, 4) : [],
          compatibilityMatchedSkills: Array.isArray(compatibility.matchedSkills) ? compatibility.matchedSkills.slice(0, 6) : [],
          compatibilityMissingSkills: Array.isArray(compatibility.missingSkills) ? compatibility.missingSkills.slice(0, 6) : [],
          compatibilityKeywords: Array.isArray(compatibility.candidateKeywords) ? compatibility.candidateKeywords.slice(0, 8) : [],
          cvOptimizationTips: Array.isArray(compatibility.cvOptimizationTips) ? compatibility.cvOptimizationTips.slice(0, 4) : [],
          applicationFeedback: compatibility.feedback || '',
          appliedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
          timeline: [
            {
              title: 'Candidatura enviada',
              description: applicationDescriptionParts.join(' '),
              icon: '📨',
              date: new Date().toISOString(),
              by: uid,
              byType: 'candidato'
            }
          ],
          createdAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
        };

        const monthKey = new Date().toISOString().slice(0, 7);
        const applicationId = `${jobId}_${uid}`;
        const applRef = adminApp
          .firestore()
          .collection('applications')
          .doc(applicationId);
        const monthlyLimit =
          getCandidatePlanFeatures(planId).maxApplicationsPerMonth;
        const usageRef = adminApp
          .firestore()
          .collection('candidate_usage')
          .doc(`${uid}_${monthKey}`);

        try {
          await adminApp.firestore().runTransaction(async (transaction) => {
            const applicationSnapshot = await transaction.get(applRef);
            if (applicationSnapshot.exists) {
              throw applicationError(
                'APPLICATION_ALREADY_EXISTS',
                'Você já se candidatou a esta vaga',
              );
            }

            const usageSnapshot = await transaction.get(usageRef);
            const storedApplications = usageSnapshot.exists
              ? Number(usageSnapshot.data()?.applicationsCount) || 0
              : 0;
            const currentApplications = Math.max(
              Number(applyCheck.current) || 0,
              storedApplications,
            );

            if (
              monthlyLimit !== null &&
              currentApplications >= monthlyLimit
            ) {
              throw applicationError(
                'APPLICATION_LIMIT_REACHED',
                `Você atingiu o limite de ${monthlyLimit} candidaturas por mês.`,
                { current: currentApplications, limit: monthlyLimit },
              );
            }

            transaction.set(applRef, applicationData);
            transaction.set(
              usageRef,
              {
                candidateId: uid,
                month: monthKey,
                applicationsCount: currentApplications + 1,
                updatedAt:
                  firebaseAdmin.firestore.FieldValue.serverTimestamp(),
              },
              { merge: true },
            );
          });
        } catch (transactionError) {
          if (transactionError?.code === 'APPLICATION_ALREADY_EXISTS') {
            return res.status(409).json({ error: transactionError.message });
          }
          if (transactionError?.code === 'APPLICATION_LIMIT_REACHED') {
            return res.status(403).json({
              error: transactionError.message,
              code: transactionError.code,
              current: transactionError.current,
              limit: transactionError.limit,
              upgradeMessage:
                'Escolha um plano superior para continuar a candidatar-se.',
              upgradeUrl: '/premium/candidatos',
            });
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
                .set(
                  { documents: {} },
                  { merge: true },
                )
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
            const notificationPrefix = candidatePremiumAccess.priorityApplied ? 'Nova candidatura prioritária recebida' : 'Nova candidatura recebida';
            await createServerNotification(adminApp, {
              userId: jobData.companyId,
              title: notificationPrefix,
              message: `${userData.fullName || userData.name || 'Um candidato'} se candidatou para ${jobData.titulo}${candidatePremiumAccess.priorityApplied ? ' com prioridade do plano' : ''}`,
              type: 'application',
              icon: '👤',
              relatedId: applRef.id,
              relatedJobId: jobId,
              actionUrl: '/dashboard/empresa?tab=applications'
            });
          } catch (notifError) {
            logServerError('applications.criar_notificacao_failed', notifError);
          }

          // Aviso por email à empresa: a notificação in-app só é vista quem entra no painel.
          if (isEmailConfigured()) {
            try {
              const companyDoc = await adminApp
                .firestore()
                .collection('users')
                .doc(jobData.companyId)
                .get();
              const companyEmail = companyDoc.exists ? companyDoc.data()?.email : null;
              if (companyEmail) {
                await sendEmail({
                  to: companyEmail,
                  ...buildNewApplicationEmail({
                    candidateName: applicationData.candidateName,
                    jobTitle: jobData.titulo || jobData.title || '',
                    compatibilityLabel: applicationData.compatibilityLabel,
                    compatibilityScore: applicationData.compatibilityScore,
                    hasCoverLetter: Boolean(normalizedCoverLetter),
                    priorityApplied: Boolean(candidatePremiumAccess.priorityApplied),
                    site: resolveBaseUrl(req),
                  }),
                });
              }
            } catch (emailError) {
              logServerError('applications.enviar_email_empresa_failed', emailError);
            }
          }
        }

        // Criar notificação de confirmação para o candidato (apenas se plano permite)
        const candidatePlanFeatures = getCandidatePlanFeatures(planId);
        if (candidatePlanFeatures.canReceiveNotifications) {
          try {
            await createServerNotification(adminApp, {
              userId: uid,
              title: 'Candidatura enviada com sucesso',
              message: `Sua candidatura${candidatePremiumAccess.priorityApplied ? ' prioritária' : ''} para ${jobData.titulo} foi enviada. Aguarde o retorno da empresa.`,
              type: 'application',
              icon: '✅',
              relatedId: applRef.id,
              relatedJobId: jobId,
              actionUrl: '/dashboard/candidato?tab=applications'
            });
          } catch (notifError) {
            logServerError('applications.criar_notificacao_de_confirmacao_failed', notifError);
          }
        }

        return res.status(201).json({ applicationId: applRef.id });
      }
      case 'GET': {
        const { jobId: queryJobId } = req.query;
        let ref = adminApp.firestore().collection('applications').where('candidateId', '==', uid);
        if (queryJobId) {
          ref = ref.where('jobId', '==', queryJobId);
        }
        const appsSnap = await ref.get();
        const applications = appsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        return res.status(200).json({ applications });
      }
      default:
        return res.status(405).setHeader('Allow', ['GET', 'POST']).json({ error: 'Método não permitido' });
    }
  } catch (error) {
    logServerError('applications.rota_api_applications_failed', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
} 
