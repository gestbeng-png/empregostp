import { admin } from '../../lib/firebaseAdmin';
import { canSaveJob, isPlanActive, getPlanSummary } from '../../lib/candidatePlanFeatures';
import { logServerError } from '../../lib/serverLog';

export default async function handler(req, res) {
  try {
    const { method } = req;
    const authHeader = req.headers.authorization;
    const token = authHeader?.split('Bearer ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    // Verificar token
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;

    // Buscar dados do usuário para verificar plano
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    const userData = userDoc.data();

    if (userData.userType !== 'candidato') {
      return res.status(403).json({ error: 'Apenas candidatos podem gerenciar vagas salvas' });
    }

    if (method === 'GET') {
      // Buscar vagas salvas do usuário
      const savedJobsSnapshot = await admin.firestore()
        .collection('savedJobs')
        .where('candidateId', '==', uid)
        .get();

      const savedJobIds = savedJobsSnapshot.docs.map(doc => doc.data().jobId);

      if (savedJobIds.length === 0) {
        return res.status(200).json({ savedJobs: [] });
      }

      // Buscar detalhes das vagas salvas
      const jobsSnapshot = await admin.firestore()
        .collection('jobs')
        .where(admin.firestore.FieldPath.documentId(), 'in', savedJobIds)
        .get();

      const savedJobs = jobsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        savedAt: savedJobsSnapshot.docs.find(d => d.data().jobId === doc.id)?.data().savedAt
      }));

      return res.status(200).json({ savedJobs });
    }

    if (method === 'POST') {
      // Salvar uma vaga
      const { jobId } = req.body;

      if (!jobId) {
        return res.status(400).json({ error: 'jobId é obrigatório' });
      }

      // Verificar se já existe
      const existingSnapshot = await admin.firestore()
        .collection('savedJobs')
        .where('candidateId', '==', uid)
        .where('jobId', '==', jobId)
        .get();

      if (!existingSnapshot.empty) {
        return res.status(200).json({ message: 'Vaga já salva' });
      }

      // Obter plano do candidato (já trata plano expirado ou inexistente)
      const planSummary = getPlanSummary(userData);
      const planId = planSummary.planId; // Pode ser básico se expirou
      
      // Se o plano expirou, atualizar no banco de dados para básico
      if (userData.currentPlan && userData.currentPlan !== 'basic_candidato' && !planSummary.isActive) {
        try {
          await admin.firestore().collection('users').doc(uid).update({
            currentPlan: 'basic_candidato',
            planId: 'basic_candidato',
            planName: 'Básico',
            planEndDate: null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        } catch (updateError) {
          logServerError('saved_jobs.atualizar_plano_expirado_failed', updateError);
        }
      }

      // Verificar limite de vagas salvas
      const saveCheck = await canSaveJob(uid, planId, admin);
      if (!saveCheck.allowed) {
        return res.status(403).json({ 
          error: saveCheck.reason,
          code: saveCheck.code || 'SAVED_JOBS_LIMIT_REACHED',
          current: saveCheck.current,
          limit: saveCheck.limit,
          upgradeMessage: saveCheck.upgradeMessage,
          upgradeUrl: saveCheck.upgradeUrl || '/premium/candidatos'
        });
      }

      // Criar registro
      await admin.firestore().collection('savedJobs').add({
        candidateId: uid,
        jobId,
        savedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return res.status(201).json({ 
        message: 'Vaga salva com sucesso',
        remaining: saveCheck.remaining,
        limit: saveCheck.limit
      });
    }

    if (method === 'DELETE') {
      // Remover vaga salva
      const { jobId } = req.body;

      if (!jobId) {
        return res.status(400).json({ error: 'jobId é obrigatório' });
      }

      const snapshot = await admin.firestore()
        .collection('savedJobs')
        .where('candidateId', '==', uid)
        .where('jobId', '==', jobId)
        .get();

      const batch = admin.firestore().batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      return res.status(200).json({ message: 'Vaga removida das salvas' });
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ error: 'Método não permitido' });

  } catch (error) {
    logServerError('saved_jobs.api_de_vagas_salvas_failed', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}


