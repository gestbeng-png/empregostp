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

export default async function handler(req, res) {
  try {
    const decoded = await requireAdmin(req, res);
    if (!decoded) return;

    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ message: 'ID do testemunho em falta' });
    }

    const docRef = admin.firestore().collection('testimonials').doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return res.status(404).json({ message: 'Testemunho não encontrado' });
    }

    if (req.method === 'DELETE') {
      await docRef.delete();
      return res.status(200).json({ message: 'Testemunho eliminado' });
    }

    if (req.method === 'PATCH' || req.method === 'POST') {
      const action = req.body?.action;
      if (!['approve', 'reject'].includes(action)) {
        return res
          .status(400)
          .json({ message: 'Ação inválida. Use approve ou reject.' });
      }

      const status = action === 'approve' ? 'approved' : 'rejected';
      const update = {
        status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        moderatedBy: decoded.uid,
      };
      if (status === 'approved') {
        update.approvedAt = admin.firestore.FieldValue.serverTimestamp();
      }

      await docRef.update(update);
      return res
        .status(200)
        .json({
          message: `Testemunho ${status === 'approved' ? 'aprovado' : 'rejeitado'}`,
          status,
        });
    }

    res.setHeader('Allow', ['POST', 'PATCH', 'DELETE']);
    return res.status(405).json({ message: 'Método não permitido' });
  } catch (error) {
    logServerError('admin_testimonials_id.moderar_testemunho_failed', error);
    return res
      .status(500)
      .json({ message: 'Erro interno do servidor', error: error.message });
  }
}
