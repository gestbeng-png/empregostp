import { admin } from '../../lib/firebaseAdmin';
import { enforceApiRateLimit } from '../../lib/apiRateLimit';
import { createServerNotification } from '../../lib/serverNotifications';

export default async function handler(req, res) {
  // Rate limit: no máximo 30 pedidos por minuto por IP
  if (
    !(await enforceApiRateLimit(req, res, { scope: 'notifications', limit: 30 }))
  ) {
    return;
  }
  return handleNotifications(req, res);
}

async function handleNotifications(req, res) {
  try {
    const { method } = req;
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autenticação não fornecido' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const actingUid = decodedToken.uid;
    const actingUserDoc = await admin.firestore().collection('users').doc(actingUid).get();

    if (!actingUserDoc.exists) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const actingUser = actingUserDoc.data();
    const isAdmin = actingUser.userType === 'admin';

    if (method === 'GET') {
      const requestedUid = typeof req.query.uid === 'string' && req.query.uid ? req.query.uid : actingUid;
      if (!isAdmin && requestedUid !== actingUid) {
        return res.status(403).json({ error: 'Você não tem permissão para ver estas notificações' });
      }

      // NOTE: Avoid composite-index requirements in Firestore.
      // Some projects don't have the needed index for (userId == X) + orderBy(createdAt).
      // We fetch by userId and sort in memory. For typical notification volumes this is fine.
      const notificationsSnapshot = await admin
        .firestore()
        .collection('notifications')
        .where('userId', '==', requestedUid)
        .get();

      const notifications = notificationsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
      }))
        .sort((a, b) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        })
        .slice(0, 50);

      return res.status(200).json({ notifications });
    }

    if (method === 'POST') {
      // Criar notificação (geralmente usado pelo sistema interno)
      const { userId, title, message, type, icon, relatedId } = req.body;

      if (!userId || !title || !message) {
        return res.status(400).json({ error: 'Dados incompletos' });
      }

      if (!isAdmin && userId !== actingUid) {
        return res.status(403).json({ error: 'Você não tem permissão para criar notificações para outro usuário' });
      }

      const notification = await createServerNotification(admin, {
        userId,
        title,
        message,
        type: type || 'info',
        icon: icon || '🔔',
        relatedId: relatedId || null
      });

      console.log('✅ Notificação criada:', notification.id);

      return res.status(201).json({ 
        message: 'Notificação criada',
        notificationId: notification.id
      });
    }

    if (method === 'PATCH') {
      // Marcar notificação como lida
      const { notificationId, markAll } = req.body;

      if (markAll) {
        // Avoid composite index (userId + read). Fetch by userId and filter in memory.
        const userNotificationsSnapshot = await admin
          .firestore()
          .collection('notifications')
          .where('userId', '==', actingUid)
          .get();

        const batch = admin.firestore().batch();
        userNotificationsSnapshot.docs
          .filter((doc) => doc.data()?.read === false)
          .forEach((doc) => {
            batch.update(doc.ref, {
              read: true,
              readAt: admin.firestore.FieldValue.serverTimestamp()
            });
          });
        await batch.commit();

        return res.status(200).json({ message: 'Todas as notificações foram marcadas como lidas' });
      }

      if (!notificationId) {
        return res.status(400).json({ error: 'notificationId é obrigatório' });
      }

      const notificationRef = admin.firestore().collection('notifications').doc(notificationId);
      const notificationDoc = await notificationRef.get();
      if (!notificationDoc.exists) {
        return res.status(404).json({ error: 'Notificação não encontrada' });
      }

      const notificationData = notificationDoc.data();
      if (!isAdmin && notificationData.userId !== actingUid) {
        return res.status(403).json({ error: 'Você não tem permissão para alterar esta notificação' });
      }

      await notificationRef.update({
        read: true,
        readAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return res.status(200).json({ message: 'Notificação marcada como lida' });
    }

    return res.status(405).json({ error: 'Método não permitido' });

  } catch (error) {
    console.error('Erro na API de notificações:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
