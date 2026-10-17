import { admin } from '../../../lib/firebaseAdmin';
import { logServerError } from '../../../lib/serverLog';

// Toggle da moderação de vagas (settings/moderation.jobApprovalRequired).
// Default desligado: as vagas continuam a ser publicadas diretamente até o
// administrador decidir ativar a fila de revisão.

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'PUT') {
    res.setHeader('Allow', ['GET', 'PUT']);
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res
        .status(401)
        .json({ message: 'Token de autorização ausente ou inválido' });
    }

    const decodedToken = await admin
      .auth()
      .verifyIdToken(authHeader.split('Bearer ')[1]);
    const adminDoc = await admin
      .firestore()
      .collection('users')
      .doc(decodedToken.uid)
      .get();
    if (!adminDoc.exists || adminDoc.data().userType !== 'admin') {
      return res
        .status(403)
        .json({ message: 'Acesso negado. Apenas administradores.' });
    }

    const settingsRef = admin
      .firestore()
      .collection('settings')
      .doc('moderation');

    if (req.method === 'GET') {
      const settingsDoc = await settingsRef.get();
      return res.status(200).json({
        jobApprovalRequired:
          settingsDoc.exists &&
          settingsDoc.data()?.jobApprovalRequired === true,
      });
    }

    const { jobApprovalRequired } = req.body || {};
    if (typeof jobApprovalRequired !== 'boolean') {
      return res.status(400).json({
        message: 'jobApprovalRequired deve ser um booleano.',
      });
    }

    await settingsRef.set(
      {
        jobApprovalRequired,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: decodedToken.uid,
      },
      { merge: true },
    );

    await admin
      .firestore()
      .collection('activities')
      .add({
        type: 'moderation_settings_updated',
        description: `Moderação de vagas ${jobApprovalRequired ? 'ativada' : 'desativada'} por administrador`,
        adminId: decodedToken.uid,
        jobApprovalRequired,
        createdAt: new Date().toISOString(),
      });

    return res.status(200).json({ jobApprovalRequired });
  } catch (error) {
    logServerError('jobs.moderation_settings_update_failed', error);
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
}
