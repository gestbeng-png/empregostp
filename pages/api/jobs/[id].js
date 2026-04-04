import { admin } from '../../../lib/firebaseAdmin';
import { canCreateJob, getEmpresaPlanSummary } from '../../../lib/empresaPlanFeatures';

function toIsoDateString(value) {
  if (!value) return null;
  try {
    const date = value.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch (error) {
    return null;
  }
}

async function getAuthenticatedCompany(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token de autenticação não fornecido' });
    return null;
  }

  const token = authHeader.split('Bearer ')[1];
  const decodedToken = await admin.auth().verifyIdToken(token);
  const userDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();

  if (!userDoc.exists) {
    res.status(404).json({ error: 'Usuário não encontrado' });
    return null;
  }

  if (userDoc.data().userType !== 'empresa') {
    res.status(403).json({ error: 'Somente empresas podem gerir vagas' });
    return null;
  }

  return {
    uid: decodedToken.uid,
    userData: userDoc.data()
  };
}

export default async function handler(req, res) {
  if (!['GET', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
    return res.status(405).setHeader('Allow', ['GET', 'PATCH', 'PUT', 'DELETE']).json({ error: 'Método não permitido' });
  }

  try {
    const auth = await getAuthenticatedCompany(req, res);
    if (!auth) return;

    const { id } = req.query;
    const jobRef = admin.firestore().collection('jobs').doc(id);
    const jobDoc = await jobRef.get();

    if (!jobDoc.exists) {
      return res.status(404).json({ error: 'Vaga não encontrada' });
    }

    const jobData = jobDoc.data();
    if (jobData.companyId !== auth.uid) {
      return res.status(403).json({ error: 'Você não tem permissão para gerir esta vaga' });
    }

    if (req.method === 'GET') {
      return res.status(200).json({
        job: {
          id: jobDoc.id,
          ...jobData,
          createdAt: toIsoDateString(jobData.createdAt),
          updatedAt: toIsoDateString(jobData.updatedAt),
          publishedAt: toIsoDateString(jobData.publishedAt),
          expiresAt: toIsoDateString(jobData.expiresAt)
        }
      });
    }

    if (req.method === 'DELETE') {
      await jobRef.delete();
      return res.status(200).json({ message: 'Vaga eliminada com sucesso' });
    }

    const { status } = req.body || {};
    const validStatuses = ['active', 'closed', 'draft'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }

    if (status === 'active' && jobData.status !== 'active') {
      const planSummary = getEmpresaPlanSummary(auth.userData);
      const createCheck = await canCreateJob(auth.uid, planSummary.planId, admin);
      if (!createCheck.allowed) {
        return res.status(403).json(createCheck);
      }
    }

    await jobRef.update({
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.status(200).json({
      message: 'Vaga atualizada com sucesso',
      job: {
        id: jobDoc.id,
        ...jobData,
        status
      }
    });
  } catch (error) {
    console.error('Erro na API /api/jobs/[id]:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
