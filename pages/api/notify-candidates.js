import { admin } from '../../lib/firebaseAdmin';
import { getCandidatePlanFeatures } from '../../lib/candidatePlanFeatures';
import { sendPushToUser } from '../../lib/serverNotifications';

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

    // Buscar candidatos (limitado para performance)
    const candidatesSnapshot = await admin.firestore()
      .collection('users')
      .where('userType', '==', 'candidato')
      .limit(100)
      .get();

    console.log(`📬 Criando notificações para ${candidatesSnapshot.size} candidatos...`);

    // Criar notificações em batch
    const batch = admin.firestore().batch();
    let notificationCount = 0;

    candidatesSnapshot.docs.forEach(doc => {
      const candidateId = doc.id;
      const candidateData = doc.data();
      
      // Verificar plano do candidato
      const planId = candidateData.currentPlan || 'basic_candidato';
      const planFeatures = getCandidatePlanFeatures(planId);
      
      // Apenas candidatos com planos PRO recebem notificações personalizadas
      const shouldNotify = planFeatures.canReceivePersonalizedJobs || planFeatures.canReceiveNotifications;
      
      if (shouldNotify) {
        const notificationRef = admin.firestore().collection('notifications').doc();
        batch.set(notificationRef, {
          userId: candidateId,
          title: 'Nova vaga disponível',
          message: `${jobTitle} em ${jobLocation || 'São Tomé e Príncipe'}`,
          type: 'job',
          icon: '💼',
          read: false,
          relatedId: jobId,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        notificationCount++;
      }
    });

    // Executar batch
    if (notificationCount > 0) {
      await batch.commit();
      await Promise.all(
        candidatesSnapshot.docs.map((doc) => {
          const candidateId = doc.id;
          const candidateData = doc.data();
          const planId = candidateData.currentPlan || 'basic_candidato';
          const planFeatures = getCandidatePlanFeatures(planId);
          const shouldNotify = planFeatures.canReceivePersonalizedJobs || planFeatures.canReceiveNotifications;
          if (!shouldNotify) return Promise.resolve();
          return sendPushToUser(admin, candidateId, {
            title: 'Nova vaga disponível',
            message: `${jobTitle} em ${jobLocation || 'São Tomé e Príncipe'}`,
            type: 'job',
            relatedId: jobId,
            actionUrl: `/vaga/${jobId}`
          });
        })
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


