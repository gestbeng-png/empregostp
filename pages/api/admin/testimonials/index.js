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
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({ message: 'Método não permitido' });
    }

    const { status } = req.query;
    const snapshot = await admin
      .firestore()
      .collection('testimonials')
      .limit(500)
      .get();

    let testimonials = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || '',
        role: data.role || '',
        message: data.message || '',
        rating: data.rating || null,
        status: data.status || 'pending',
        createdAt: toIso(data.createdAt),
        approvedAt: toIso(data.approvedAt),
      };
    });

    // Ordena por data de criação (mais recentes primeiro)
    testimonials.sort((a, b) =>
      String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
    );

    const stats = {
      total: testimonials.length,
      pending: testimonials.filter((t) => t.status === 'pending').length,
      approved: testimonials.filter((t) => t.status === 'approved').length,
      rejected: testimonials.filter((t) => t.status === 'rejected').length,
    };

    if (status && status !== 'all') {
      testimonials = testimonials.filter((t) => t.status === status);
    }

    return res.status(200).json({ testimonials, stats });
  } catch (error) {
    logServerError('admin_testimonials.api_de_testemunhos_admin_failed', error);
    return res.status(500).json({ message: 'Erro interno do servidor', error: error.message });
  }
}
