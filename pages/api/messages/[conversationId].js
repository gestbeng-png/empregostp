import { admin } from '../../../lib/firebaseAdmin';
import { canSendDirectMessage, getEmpresaPlanSummary } from '../../../lib/empresaPlanFeatures';

/**
 * GET  /api/messages/[conversationId]  — lista mensagens de uma conversa
 * POST /api/messages/[conversationId]  — envia mensagem na conversa
 *   body: { text: string }
 */
export default async function handler(req, res) {
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

  const requesterDoc = await admin.firestore().collection('users').doc(uid).get();
  if (!requesterDoc.exists) {
    return res.status(404).json({ error: 'Utilizador não encontrado' });
  }
  const requesterData = requesterDoc.data() || {};

  const { conversationId } = req.query;

  // Verificar que o utilizador é participante desta conversa
  const convRef = admin.firestore().collection('conversations').doc(conversationId);
  const convDoc = await convRef.get();
  if (!convDoc.exists) {
    return res.status(404).json({ error: 'Conversa não encontrada' });
  }
  const convData = convDoc.data();
  if (!convData.participants?.includes(uid)) {
    return res.status(403).json({ error: 'Acesso não autorizado' });
  }

  if (req.method === 'GET') {
    try {
      const messagesSnapshot = await admin.firestore()
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .orderBy('createdAt', 'asc')
        .limit(100)
        .get();

      const messages = messagesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null
      }));

      // Marcar mensagens do outro participante como lidas
      await convRef.update({
        [`unreadCounts.${uid}`]: 0
      });

      return res.status(200).json({ messages });
    } catch (error) {
      logServerError('messages_conversationid.listar_mensagens_failed', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  if (req.method === 'POST') {
    const { text } = req.body;
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Mensagem vazia' });
    }
    if (text.length > 2000) {
      return res.status(400).json({ error: 'Mensagem demasiado longa (máx. 2000 caracteres)' });
    }

    if (requesterData.userType === 'empresa') {
      const planSummary = getEmpresaPlanSummary(requesterData);
      const messageAccess = canSendDirectMessage(planSummary.planId);
      if (!messageAccess.allowed) {
        return res.status(403).json({
          error: messageAccess.reason,
          code: messageAccess.code,
          upgradeMessage: messageAccess.upgradeMessage,
          upgradeUrl: messageAccess.upgradeUrl
        });
      }
    }

    try {
      const now = admin.firestore.FieldValue.serverTimestamp();
      const otherParticipantId = convData.participants.find((p) => p !== uid);

      // Adicionar mensagem à subcollection
      const msgRef = await admin.firestore()
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .add({
          senderId: uid,
          text: text.trim(),
          createdAt: now
        });

      // Atualizar última mensagem e unread count do destinatário
      const updateData = {
        lastMessage: text.trim().substring(0, 100),
        updatedAt: now
      };
      if (otherParticipantId) {
        updateData[`unreadCounts.${otherParticipantId}`] = admin.firestore.FieldValue.increment(1);
      }
      await convRef.update(updateData);

      return res.status(201).json({ messageId: msgRef.id });
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  return res.status(405).json({ error: 'Método não permitido' });
}
