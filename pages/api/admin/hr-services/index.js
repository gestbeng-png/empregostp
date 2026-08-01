import { admin } from '../../../../lib/firebaseAdmin';
import { logServerError } from '../../../../lib/serverLog';

const COLLECTION = 'hrServiceRequests';

async function requireAdmin(req, res) {
  const authHeader = req.headers.authorization;
  let token;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split('Bearer ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    res.status(401).json({ message: 'Token de autorização ausente ou inválido' });
    return null;
  }

  const decodedToken = await admin.auth().verifyIdToken(token);
  const adminDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
  if (!adminDoc.exists || adminDoc.data().userType !== 'admin') {
    res.status(403).json({ message: 'Acesso negado. Apenas administradores.' });
    return null;
  }
  return decodedToken;
}

function toIso(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return null;
}

export default async function handler(req, res) {
  try {
    const decoded = await requireAdmin(req, res);
    if (!decoded) return;

    if (req.method !== 'GET') {
      return res.status(405).json({ message: 'Método não permitido' });
    }

    const { status } = req.query;
    const snapshot = await admin.firestore().collection(COLLECTION).limit(500).get();

    let requests = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        companyId: data.companyId || '',
        companyName: data.companyName || 'Empresa',
        companyEmail: data.companyEmail || '',
        serviceType: data.serviceType || '',
        title: data.title || '',
        description: data.description || '',
        documents: Array.isArray(data.documents) ? data.documents : [],
        status: data.status || 'pending',
        adminResponse: data.adminResponse || '',
        resultDocuments: Array.isArray(data.resultDocuments) ? data.resultDocuments : [],
        createdAt: toIso(data.createdAt),
        updatedAt: toIso(data.updatedAt),
        processedAt: toIso(data.processedAt),
        completedAt: toIso(data.completedAt),
      };
    });

    requests.sort((a, b) =>
      String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
    );

    const stats = {
      total: requests.length,
      pending: requests.filter((r) => r.status === 'pending').length,
      approved: requests.filter((r) => r.status === 'approved').length,
      completed: requests.filter((r) => r.status === 'completed').length,
      rejected: requests.filter((r) => r.status === 'rejected').length,
    };

    if (status && status !== 'all') {
      requests = requests.filter((r) => r.status === status);
    }

    return res.status(200).json({ requests, stats });
  } catch (error) {
    logServerError('admin_hr_services.api_de_servicos_rh_admin_failed', error);
    return res.status(500).json({ message: 'Erro interno do servidor', error: error.message });
  }
}
