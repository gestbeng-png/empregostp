import { admin } from '../../../lib/firebaseAdmin';
import { canExportApplications, getEmpresaPlanSummary } from '../../../lib/empresaPlanFeatures';
import { logServerError, logServerWarning } from '../../../lib/serverLog';

function isMissingIndexError(error) {
  return (
    error?.code === 9
    || String(error?.details || error?.message || '')
      .toLowerCase()
      .includes('requires an index')
  );
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * GET /api/export/applications
 * Exporta as candidaturas da empresa em formato CSV
 *
 * Query params:
 *   jobId  — filtrar por vaga específica (opcional)
 *   status — filtrar por status (pending|accepted|rejected, opcional)
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido' });
  }
  const token = authHeader.split('Bearer ')[1];

  let uid;
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }

  const userDoc = await admin.firestore().collection('users').doc(uid).get();
  if (!userDoc.exists) {
    return res.status(404).json({ error: 'Utilizador não encontrado' });
  }
  const userData = userDoc.data();
  if (userData.userType !== 'empresa') {
    return res.status(403).json({ error: 'Apenas empresas podem exportar candidaturas' });
  }

  // Verificar plano
  const planSummary = getEmpresaPlanSummary(userData);
  const access = canExportApplications(planSummary.planId);
  if (!access.allowed) {
    return res.status(403).json({
      error: access.reason,
      code: access.code,
      upgradeMessage: access.upgradeMessage,
      upgradeUrl: access.upgradeUrl
    });
  }

  try {
    const { jobId, status } = req.query;

    let query = admin.firestore()
      .collection('applications')
      .where('companyId', '==', uid);

    if (jobId) {
      query = query.where('jobId', '==', jobId);
    }
    if (status) {
      query = query.where('status', '==', status);
    }

    // A ordenação no Firestore exige o índice composto (companyId, createdAt).
    // Sem ele a query rebentava e a exportação — que é uma funcionalidade paga
    // — devolvia 500. Enquanto o índice não estiver construído, ordena-se em
    // memória: o conjunto é de uma só empresa e cabe perfeitamente.
    let docs;
    try {
      docs = (await query.orderBy('createdAt', 'desc').get()).docs;
    } catch (error) {
      if (!isMissingIndexError(error)) throw error;
      logServerWarning('export_applications.missing_index_fallback', error);
      docs = (await query.get()).docs.sort(
        (a, b) => toMillis(b.data()?.createdAt) - toMillis(a.data()?.createdAt),
      );
    }

    const rows = docs.map((doc) => {
      const d = doc.data();
      const createdAt = d.createdAt?.toDate?.()?.toISOString() || '';
      return [
        escapeCsv(doc.id),
        escapeCsv(d.candidateName || ''),
        escapeCsv(d.candidateEmail || ''),
        escapeCsv(d.jobTitle || ''),
        escapeCsv(d.status || ''),
        escapeCsv(createdAt)
      ].join(',');
    });

    const header = ['ID,Nome,Email,Vaga,Estado,Data de Candidatura'];
    const csv = [...header, ...rows].join('\n');

    const filename = `candidaturas_${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send('\uFEFF' + csv); // BOM for Excel UTF-8
  } catch (error) {
    logServerError('export_applications.exportar_candidaturas_failed', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

function escapeCsv(value) {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
