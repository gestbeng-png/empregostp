import { admin } from '../../../lib/firebaseAdmin';
import { getPlanSummary, canApplyToJob, canSaveJob, canUploadCertificate, canUseCvGenerator } from '../../../lib/candidatePlanFeatures';
import { buildCandidateVisibility, calculateCandidateProfileCompletion } from '../../../lib/candidateProfileInsights';
import { buildCandidateOptimizationInsights } from '../../../lib/candidateOptimizationInsights';
import { logServerError } from '../../../lib/serverLog';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autenticação não fornecido' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;

    // Buscar dados do usuário
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const userData = userDoc.data();
    if (userData.userType !== 'candidato') {
      return res.status(403).json({ error: 'Esta API é apenas para candidatos' });
    }

    // Obter resumo do plano (já trata plano expirado ou inexistente)
    const planSummary = getPlanSummary(userData);
    const planId = planSummary.planId; // Usar o planId do resumo (pode ser básico se expirou)
    
    // Se o plano expirou, atualizar no banco de dados para básico
    if (userData.currentPlan && userData.currentPlan !== 'basic_candidato' && !planSummary.isActive) {
      try {
        await admin.firestore().collection('users').doc(uid).update({
          currentPlan: 'basic_candidato',
          planId: 'basic_candidato',
          planName: 'Básico',
          planEndDate: null, // Plano básico não tem prazo
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (updateError) {
        logServerError('candidate_plan_status.atualizar_plano_expirado_failed', updateError);
        // Continuar mesmo se falhar a atualização
      }
    }

    const [profileDoc, applicationsSnap, jobsSnap] = await Promise.all([
      admin.firestore().collection('profiles').doc(uid).get(),
      admin.firestore().collection('applications').where('candidateId', '==', uid).get(),
      admin.firestore().collection('jobs').where('status', '==', 'active').limit(80).get(),
    ]);
    const profileData = profileDoc.exists ? profileDoc.data() || {} : {};
    const profileCompletion = calculateCandidateProfileCompletion(userData, profileData);
    const visibility = buildCandidateVisibility(userData, profileData);
    const optimizationInsights = buildCandidateOptimizationInsights({
      userData,
      profileData,
      applications: applicationsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      jobs: jobsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    });

    // Verificar status de recursos
    const applyStatus = await canApplyToJob(uid, planId, admin);
    const saveStatus = await canSaveJob(uid, planId, admin);

    const profileViewsSnapshot = await admin.firestore()
      .collection('candidateProfileViews')
      .where('candidateId', '==', uid)
      .get();

    const profileViews = profileViewsSnapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          companyId: data.companyId || '',
          companyName: data.companyName || 'Empresa',
          viewedAt: data.viewedAt?.toDate ? data.viewedAt.toDate().toISOString() : null
        };
      })
      .sort((a, b) => new Date(b.viewedAt || 0) - new Date(a.viewedAt || 0));

    const uniqueProfileViewers = [];
    const seenCompanies = new Set();
    profileViews.forEach((view) => {
      if (!view.companyId || seenCompanies.has(view.companyId)) return;
      seenCompanies.add(view.companyId);
      uniqueProfileViewers.push(view);
    });

    const profileViewsCount = profileViews.length;

    // Contar certificados e validar acesso por plano
    let certificateStatus;
    const cvGeneratorStatus = canUseCvGenerator(planId);
    if (planSummary.features.canUploadCertificates) {
      const certificates = profileData.certificateFiles || [];
      const certificateAccess = canUploadCertificate(planId, certificates.length);
      certificateStatus = {
        ...certificateAccess,
        current: certificates.length,
        limit: certificateAccess.limit ?? null
      };
    } else {
      const certificateAccess = canUploadCertificate(planId, 0);
      certificateStatus = {
        ...certificateAccess,
        current: 0,
        limit: 0
      };
    }

    return res.status(200).json({
      plan: {
        ...planSummary,
        views: planSummary.features.canViewStats ? profileViewsCount : 0
      },
      profileCompletion,
      visibility,
      optimizationInsights,
      resources: {
        applications: {
          ...applyStatus,
          label: 'Candidaturas este mês'
        },
        savedJobs: {
          ...saveStatus,
          label: 'Vagas salvas'
        },
        certificates: {
          ...certificateStatus,
          label: 'Certificados'
        },
        cvGenerator: {
          ...cvGeneratorStatus,
          label: 'Gerador de CV'
        },
        profileViews: {
          allowed: planSummary.features.canViewStats,
          current: planSummary.features.canViewStats ? profileViewsCount : 0,
          limit: null,
          label: 'Visualizações do perfil'
        },
        profileCompletion: {
          allowed: true,
          current: profileCompletion.score,
          limit: 100,
          label: 'Completude do perfil'
        }
      },
      profileViewsSummary: {
        total: profileViewsCount,
        uniqueCompanies: uniqueProfileViewers.length,
        canSeeDetailedViewers: planSummary.features.canSeeWhoViewedProfile
      },
      profileViewers: planSummary.features.canSeeWhoViewedProfile ? uniqueProfileViewers.slice(0, 10) : [],
      isPlanActive: planSummary.isActive // Usar o isActive do planSummary que já trata plano básico
    });
  } catch (error) {
    logServerError('candidate_plan_status.verificar_status_do_plano_failed', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
