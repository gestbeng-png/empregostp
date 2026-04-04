import { admin } from '../../../lib/firebaseAdmin';
import { canSendDirectMessage, getEmpresaPlanSummary } from '../../../lib/empresaPlanFeatures';

function isMissingIndexError(error) {
  return error?.code === 9 || String(error?.details || error?.message || '').toLowerCase().includes('requires an index');
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

async function listUserConversations(uid) {
  const firestore = admin.firestore();

  try {
    return await firestore
      .collection('conversations')
      .where('participants', 'array-contains', uid)
      .orderBy('updatedAt', 'desc')
      .limit(50)
      .get();
  } catch (error) {
    if (!isMissingIndexError(error)) {
      throw error;
    }

    console.warn('Messages query without composite index, using in-memory sort for user:', uid);

    const fallbackSnapshot = await firestore
      .collection('conversations')
      .where('participants', 'array-contains', uid)
      .get();

    const sortedDocs = [...fallbackSnapshot.docs]
      .sort((a, b) => toMillis(b.data()?.updatedAt) - toMillis(a.data()?.updatedAt))
      .slice(0, 50);

    return { docs: sortedDocs };
  }
}

/**
 * GET  /api/messages  — lista conversas do utilizador autenticado
 * POST /api/messages  — cria ou obtém conversa com outro utilizador
 *   body: { participantId: string }
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

  if (req.method === 'GET') {
    try {
      // Buscar conversas onde o utilizador é participante
      const snapshot = await listUserConversations(uid);

      const conversations = await Promise.all(snapshot.docs.map(async (doc) => {
        const data = doc.data();
        const otherParticipantId = data.participants.find((p) => p !== uid);

        let participant = { id: otherParticipantId, name: 'Utilizador', avatar: null };
        if (otherParticipantId) {
          try {
            const partDoc = await admin.firestore().collection('users').doc(otherParticipantId).get();
            if (partDoc.exists) {
              const pd = partDoc.data();
              participant = {
                id: otherParticipantId,
                name: pd.fullName || pd.name || pd.companyName || 'Utilizador',
                avatar: pd.photoUrl || pd.logo || null,
                role: pd.userType || ''
              };
            }
          } catch (_) {}
        }

        return {
          id: doc.id,
          participant,
          lastMessage: data.lastMessage || '',
          lastMessageAt: data.updatedAt?.toDate?.()?.toISOString() || null,
          unreadCount: data.unreadCounts?.[uid] || 0
        };
      }));

      return res.status(200).json({ conversations });
    } catch (error) {
      console.error('Erro ao listar conversas:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  if (req.method === 'POST') {
    const { participantId } = req.body;
    if (!participantId) {
      return res.status(400).json({ error: 'participantId é obrigatório' });
    }
    if (participantId === uid) {
      return res.status(400).json({ error: 'Não é possível iniciar conversa consigo mesmo' });
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
      // Verificar se a conversa já existe
      const existingSnapshot = await admin.firestore()
        .collection('conversations')
        .where('participants', 'array-contains', uid)
        .get();

      const existing = existingSnapshot.docs.find((doc) => {
        const parts = doc.data().participants || [];
        return parts.includes(participantId);
      });

      if (existing) {
        return res.status(200).json({ conversationId: existing.id });
      }

      // Criar nova conversa
      const now = admin.firestore.FieldValue.serverTimestamp();
      const newConversation = await admin.firestore().collection('conversations').add({
        participants: [uid, participantId],
        lastMessage: '',
        unreadCounts: { [uid]: 0, [participantId]: 0 },
        createdAt: now,
        updatedAt: now
      });

      return res.status(201).json({ conversationId: newConversation.id });
    } catch (error) {
      console.error('Erro ao criar/obter conversa:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  return res.status(405).json({ error: 'Método não permitido' });
}
