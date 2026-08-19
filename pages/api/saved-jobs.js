import { admin } from '../../lib/firebaseAdmin';
import { canSaveJob, isPlanActive, getPlanSummary } from '../../lib/candidatePlanFeatures';
import { logServerError } from '../../lib/serverLog';
import { requireActiveApiUser } from '../../lib/apiUserAuth';

export const FIRESTORE_IN_QUERY_LIMIT = 30;

function chunk(values, size = FIRESTORE_IN_QUERY_LIMIT) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

/**
 * Resolve os detalhes das vagas sem ultrapassar o limite de 30 valores do
 * operador `in` do Firestore. A resposta conserva a ordem dos registos em
 * savedJobs e ignora referências para vagas entretanto eliminadas.
 */
export async function fetchSavedJobDetails(adminInstance, savedJobDocs = []) {
  const savedEntries = savedJobDocs
    .map((doc) => ({
      jobId: doc.data()?.jobId,
      savedAt: doc.data()?.savedAt,
    }))
    .filter((entry) => Boolean(entry.jobId));

  const uniqueJobIds = [...new Set(savedEntries.map((entry) => entry.jobId))];
  if (uniqueJobIds.length === 0) return [];

  const snapshots = await Promise.all(
    chunk(uniqueJobIds).map((jobIds) =>
      adminInstance
        .firestore()
        .collection('jobs')
        .where(adminInstance.firestore.FieldPath.documentId(), 'in', jobIds)
        .get(),
    ),
  );

  const jobsById = new Map();
  snapshots.forEach((snapshot) => {
    snapshot.docs.forEach((doc) => {
      jobsById.set(doc.id, { id: doc.id, ...doc.data() });
    });
  });

  const emittedJobIds = new Set();
  return savedEntries.flatMap(({ jobId, savedAt }) => {
    if (emittedJobIds.has(jobId)) return [];
    const job = jobsById.get(jobId);
    if (!job) return [];
    emittedJobIds.add(jobId);
    return [{ ...job, savedAt }];
  });
}

export default async function handler(req, res) {
  try {
    const { method } = req;
    const authResult = await requireActiveApiUser(req, res, {
      missingTokenMessage: 'Não autorizado',
      missingUserMessage: 'Usuário não encontrado',
    });
    if (!authResult) return;
    const { uid, userData } = authResult;

    if (userData.userType !== 'candidato') {
      return res.status(403).json({ error: 'Apenas candidatos podem gerenciar vagas salvas' });
    }

    if (method === 'GET') {
      // Buscar vagas salvas do usuário
      const savedJobsSnapshot = await admin.firestore()
        .collection('savedJobs')
        .where('candidateId', '==', uid)
        .get();

      if (savedJobsSnapshot.empty) {
        return res.status(200).json({ savedJobs: [] });
      }

      const savedJobs = await fetchSavedJobDetails(admin, savedJobsSnapshot.docs);

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
