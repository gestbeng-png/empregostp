import { admin } from '../../../../lib/firebaseAdmin';

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

const STATUS_BY_ACTION = {
  approve: 'approved',
  reject: 'rejected',
  contact: 'contacted',
  reset: 'pending',
};

export default async function handler(req, res) {
  try {
    const decoded = await requireAdmin(req, res);
    if (!decoded) return;

    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ message: 'ID do afiliado em falta' });
    }

    const docRef = admin.firestore().collection('affiliateApplications').doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return res.status(404).json({ message: 'Candidatura de afiliado não encontrada' });
    }

    if (req.method === 'DELETE') {
      await docRef.delete();
      return res.status(200).json({ message: 'Candidatura eliminada' });
    }

    if (req.method === 'PATCH' || req.method === 'POST') {
      const action = req.body?.action;
      const status = STATUS_BY_ACTION[action];
      if (!status) {
        return res
          .status(400)
          .json({ message: 'Ação inválida. Use approve, reject, contact ou reset.' });
      }

      await docRef.update({
        status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        moderatedBy: decoded.uid,
      });

      return res.status(200).json({ message: 'Estado atualizado', status });
    }

    res.setHeader('Allow', 'PATCH, POST, DELETE');
    return res.status(405).json({ message: 'Método não permitido' });
  } catch (error) {
    console.error('Erro ao moderar afiliado:', error);
    return res.status(500).json({ message: 'Erro interno do servidor', error: error.message });
  }
}
