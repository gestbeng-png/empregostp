import { admin } from '../../../../lib/firebaseAdmin';
import { logServerError } from '../../../../lib/serverLog';

async function requireAdmin(req, res) {
  const authHeader = req.headers.authorization;
  let token;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split('Bearer ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    res
      .status(401)
      .json({ message: 'Token de autorização ausente ou inválido' });
    return null;
  }

  const decodedToken = await admin.auth().verifyIdToken(token);
  const adminDoc = await admin
    .firestore()
    .collection('users')
    .doc(decodedToken.uid)
    .get();
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
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({ message: 'Método não permitido' });
    }

    const { status } = req.query;
    const snapshot = await admin
      .firestore()
      .collection('affiliateApplications')
      .limit(500)
      .get();

    let affiliates = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        uid: data.uid || doc.id,
        fullName: data.fullName || '',
        email: data.email || '',
        accountEmail: data.accountEmail || '',
        phone: data.phone || '',
        location: data.location || '',
        occupation: data.occupation || '',
        channels: data.channels || '',
        motivation: data.motivation || '',
        role: data.role || 'candidato',
        status: data.status || 'pending',
        createdAt: toIso(data.createdAt),
        updatedAt: toIso(data.updatedAt),
      };
    });

    // Ordena por data de criação (mais recentes primeiro)
    affiliates.sort((a, b) =>
      String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
    );

    const stats = {
      total: affiliates.length,
      pending: affiliates.filter((a) => a.status === 'pending').length,
      approved: affiliates.filter((a) => a.status === 'approved').length,
      contacted: affiliates.filter((a) => a.status === 'contacted').length,
      rejected: affiliates.filter((a) => a.status === 'rejected').length,
    };

    if (status && status !== 'all') {
      affiliates = affiliates.filter((a) => a.status === status);
    }

    return res.status(200).json({ affiliates, stats });
  } catch (error) {
    logServerError('admin_affiliates.api_de_afiliados_admin_failed', error);
    return res
      .status(500)
      .json({ message: 'Erro interno do servidor', error: error.message });
  }
}
