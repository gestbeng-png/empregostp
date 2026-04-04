import { admin as adminApp } from '../../../lib/firebaseAdmin';
import * as firebaseAdmin from 'firebase-admin';
import { canApplyToJob, canApplyToFeaturedJob, isPlanActive, getPlanSummary, getCandidatePlanFeatures } from '../../../lib/candidatePlanFeatures';
import { calculateSkillsAssessmentResult, getPublicSkillsAssessment } from '../../../lib/skillsAssessment';
import { createServerNotification } from '../../../lib/serverNotifications';

export default async function handler(req, res) {
  const { method } = req;

  // Verificar cabeçalho de autorização
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    // Verificar token e obter UID
    const decodedToken = await adminApp.auth().verifyIdToken(token);
    const uid = decodedToken.uid;

    // Buscar dados do usuário
    const userDocRef = adminApp.firestore().collection('users').doc(uid);
    const userDoc = await userDocRef.get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    const userData = userDoc.data();

    if (userData.userType !== 'candidato') {
      return res.status(403).json({ error: 'Somente candidatos podem se candidatar a vagas' });
    }

    switch (method) {
      case 'POST': {
        const { jobId, assessmentAnswers = [] } = req.body;
        if (!jobId) return res.status(400).json({ error: 'jobId é obrigatório' });

        // Buscar vaga
        const jobDocRef = adminApp.firestore().collection('jobs').doc(jobId);
        const jobDoc = await jobDocRef.get();
        if (!jobDoc.exists) {
          return res.status(404).json({ error: 'Vaga não encontrada' });
        }
        const jobData = jobDoc.data();

        if (jobData.status !== 'active') {
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
            console.log(`Plano expirado atualizado para básico para usuário ${uid}`);
          } catch (updateError) {
            console.error('Erro ao atualizar plano expirado:', updateError);
          }
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

        const applicationData = {
          jobId,
          companyId: jobData.companyId || null,
          candidateId: uid,
          candidateName: userData.fullName || userData.name || userData.email,
          candidateEmail: userData.email,
          jobTitle: jobData.titulo || jobData.title || '',
          company: jobData.companyName || '',
          status: 'pending',
          skillsAssessmentResult,
          appliedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
          timeline: [
            {
              title: 'Candidatura enviada',
              description: `Você enviou sua candidatura para ${jobData.titulo || jobData.title || 'a vaga'}.`,
              icon: '📨',
              date: new Date().toISOString(),
              by: uid,
              byType: 'candidato'
            }
          ],
          createdAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
        };

        const applRef = await adminApp.firestore().collection('applications').add(applicationData);

        // Registrar atividade para auditoria
        await adminApp.firestore().collection('admin_activities').add({
          action: 'create_application',
          candidateId: uid,
          jobId,
          applicationId: applRef.id,
          timestamp: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
        });

        // Criar notificação para a empresa
        if (jobData.companyId) {
          try {
            await createServerNotification(adminApp, {
              userId: jobData.companyId,
              title: 'Nova candidatura recebida',
              message: `${userData.fullName || userData.name || 'Um candidato'} se candidatou para ${jobData.titulo}`,
              type: 'application',
              icon: '👤',
              relatedId: applRef.id,
              relatedJobId: jobId,
              actionUrl: '/dashboard/empresa?tab=applications'
            });
            console.log('✅ Notificação criada para empresa');
          } catch (notifError) {
            console.error('Erro ao criar notificação:', notifError);
          }
        }

        // Criar notificação de confirmação para o candidato (apenas se plano permite)
        const candidatePlanFeatures = getCandidatePlanFeatures(planId);
        if (candidatePlanFeatures.canReceiveNotifications) {
          try {
            await createServerNotification(adminApp, {
              userId: uid,
              title: 'Candidatura enviada com sucesso',
              message: `Sua candidatura para ${jobData.titulo} foi enviada. Aguarde o retorno da empresa.`,
              type: 'application',
              icon: '✅',
              relatedId: applRef.id,
              relatedJobId: jobId,
              actionUrl: '/dashboard/candidato?tab=applications'
            });
            console.log('✅ Notificação de confirmação criada para candidato');
          } catch (notifError) {
            console.error('Erro ao criar notificação de confirmação:', notifError);
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
    console.error('Erro na rota /api/applications:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
} 
