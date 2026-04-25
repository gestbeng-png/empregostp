import { admin } from '../../lib/firebaseAdmin';
import { getPlanSummary } from '../../lib/candidatePlanFeatures';
import { shouldNotifyCandidateForJob } from '../../lib/candidateProfileInsights';
import { sendPushToUser } from '../../lib/serverNotifications';

function canReceiveNewJobNotification(candidateData = {}) {
  const planSummary = getPlanSummary(candidateData);
  return planSummary.planId === 'unlimited_candidato' && planSummary.isActive;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split('Bearer ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    // Verificar token
    const decodedToken = await admin.auth().verifyIdToken(token);
    const companyUid = decodedToken.uid;

    const { jobId, jobTitle, jobLocation } = req.body;

    if (!jobId || !jobTitle) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }

    const [companyDoc, jobDoc] = await Promise.all([
      admin.firestore().collection('users').doc(companyUid).get(),
      admin.firestore().collection('jobs').doc(jobId).get()
    ]);

    if (!companyDoc.exists || companyDoc.data()?.userType !== 'empresa') {
      return res.status(403).json({ error: 'Apenas empresas podem notificar candidatos' });
    }

    const jobData = jobDoc.exists
      ? { id: jobDoc.id, ...jobDoc.data() }
      : {
          id: jobId,
          titulo: jobTitle,
          localizacao: jobLocation || '',
        };

    // Buscar candidatos (limitado para performance)
    const candidatesSnapshot = await admin.firestore()
      .collection('users')
      .where('userType', '==', 'candidato')
      .limit(100)
      .get();

    console.log(`📬 Criando notificações para ${candidatesSnapshot.size} candidatos...`);

    const candidateIds = candidatesSnapshot.docs.map((doc) => doc.id);
    const profileDocs = candidateIds.length
      ? await admin.firestore().getAll(...candidateIds.map((candidateId) => admin.firestore().collection('profiles').doc(candidateId)))
      : [];
    const profilesById = new Map();
    profileDocs.forEach((doc) => {
      if (doc.exists) {
        profilesById.set(doc.id, doc.data() || {});
      }
    });

    // Criar notificações em batch
    const batch = admin.firestore().batch();
    let notificationCount = 0;
    const notifiedCandidates = [];

    candidatesSnapshot.docs.forEach(doc => {
      const candidateId = doc.id;
      const candidateData = doc.data();
      const candidateProfile = profilesById.get(candidateId) || {};

      // Apenas candidatos Premium com plano ativo recebem notificações de novas vagas.
      const shouldNotify = canReceiveNewJobNotification(candidateData);
      if (!shouldNotify) {
        return;
      }

      const match = shouldNotifyCandidateForJob(jobData, candidateData, candidateProfile, {
        minScore: 28
      });
      
      if (!match.shouldNotify) {
        return;
      }

      const notificationRef = admin.firestore().collection('notifications').doc();
      const primaryReason = match.reasons?.[0] || 'Compatível com o seu perfil';
      batch.set(notificationRef, {
        userId: candidateId,
        title: 'Nova vaga compatível com o seu perfil',
        message: `${jobTitle} em ${jobLocation || 'São Tomé e Príncipe'} • ${primaryReason}`,
        type: 'job',
        icon: '💼',
        read: false,
        relatedId: jobId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      notificationCount++;
      notifiedCandidates.push({
        candidateId,
        reason: primaryReason
      });
    });

    // Executar batch
    if (notificationCount > 0) {
      await batch.commit();
      await Promise.all(
        notifiedCandidates.map(({ candidateId, reason }) =>
          sendPushToUser(admin, candidateId, {
            title: 'Nova vaga compatível com o seu perfil',
            message: `${jobTitle} em ${jobLocation || 'São Tomé e Príncipe'} • ${reason}`,
            type: 'job',
            relatedId: jobId,
            actionUrl: `/vaga/${jobId}`
          })
        )
      );
      console.log(`✅ ${notificationCount} notificações criadas`);
    }

    return res.status(200).json({ 
      message: `Notificações enviadas para ${notificationCount} candidatos`,
      count: notificationCount
    });

  } catch (error) {
    console.error('Erro ao notificar candidatos:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
