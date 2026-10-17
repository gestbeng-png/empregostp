import { admin } from '../../../lib/firebaseAdmin';
import {
  canSendDirectMessage,
  getEmpresaPlanSummary,
} from '../../../lib/empresaPlanFeatures';
import {
  canUsersContinueConversation,
  canUsersStartConversation,
} from '../../../lib/conversationPolicy';
import { logServerError, logServerWarning } from '../../../lib/serverLog';
import { requireActiveApiUser } from '../../../lib/apiUserAuth';

function isMissingIndexError(error) {
  return (
    error?.code === 9 ||
    String(error?.details || error?.message || '')
      .toLowerCase()
      .includes('requires an index')
  );
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

    logServerWarning(
      'messages.messages_query_without_composite_index_using_failed',
      uid,
    );

    const fallbackSnapshot = await firestore
      .collection('conversations')
      .where('participants', 'array-contains', uid)
      .get();

    const sortedDocs = [...fallbackSnapshot.docs]
      .sort(
        (a, b) => toMillis(b.data()?.updatedAt) - toMillis(a.data()?.updatedAt),
      )
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
  const authResult = await requireActiveApiUser(req, res, {
    invalidTokenMessage: 'Token inválido',
  });
  if (!authResult) return;
  const { uid, userData: requesterData } = authResult;

  if (req.method === 'GET') {
    try {
      // Buscar conversas onde o utilizador é participante
      const snapshot = await listUserConversations(uid);

      const conversations = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const data = doc.data();
          const otherParticipantId = data.participants.find((p) => p !== uid);

          let participant = {
            id: otherParticipantId,
            name: 'Utilizador',
            avatar: null,
          };
          if (otherParticipantId) {
            try {
              const partDoc = await admin
                .firestore()
                .collection('users')
                .doc(otherParticipantId)
                .get();
              if (partDoc.exists) {
                const pd = partDoc.data();
                participant = {
                  id: otherParticipantId,
                  name:
                    pd.fullName || pd.name || pd.companyName || 'Utilizador',
                  avatar: pd.photoUrl || pd.logo || null,
                  role: pd.userType || '',
                };
              }
            } catch (_) {}
          }

          return {
            id: doc.id,
            participant,
            lastMessage: data.lastMessage || '',
            lastMessageAt: data.updatedAt?.toDate?.()?.toISOString() || null,
            unreadCount: data.unreadCounts?.[uid] || 0,
          };
        }),
      );

      return res.status(200).json({ conversations });
    } catch (error) {
      logServerError('messages.listar_conversas_failed', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  if (req.method === 'POST') {
    const participantId =
      typeof req.body?.participantId === 'string'
        ? req.body.participantId.trim()
        : '';
    if (
      !participantId.trim() ||
      participantId.length > 128 ||
      participantId.includes('/')
    ) {
      return res.status(400).json({ error: 'participantId é obrigatório' });
    }
    if (participantId === uid) {
      return res
        .status(400)
        .json({ error: 'Não é possível iniciar conversa consigo mesmo' });
    }

    if (requesterData.userType === 'empresa') {
      const planSummary = getEmpresaPlanSummary(requesterData);
      const messageAccess = canSendDirectMessage(planSummary.planId);
      if (!messageAccess.allowed) {
        return res.status(403).json({
          error: messageAccess.reason,
          code: messageAccess.code,
          upgradeMessage: messageAccess.upgradeMessage,
          upgradeUrl: messageAccess.upgradeUrl,
        });
      }
    }

    try {
      const participantDoc = await admin
        .firestore()
        .collection('users')
        .doc(participantId)
        .get();
      if (!participantDoc.exists) {
        return res.status(404).json({ error: 'Participante não encontrado' });
      }

      const participantData = participantDoc.data() || {};

      // Uma conversa existente continua utilizável mesmo que o candidato tenha
      // entretanto tornado o perfil privado. A privacidade bloqueia apenas uma
      // nova ligação; os papéis dos participantes continuam a ser validados.
      const existingSnapshot = await admin
        .firestore()
        .collection('conversations')
        .where('participants', 'array-contains', uid)
        .get();

      const existing = existingSnapshot.docs.find((doc) => {
        const parts = doc.data().participants || [];
        return parts.includes(participantId);
      });

      if (existing) {
        const conversationPolicy = canUsersContinueConversation({
          requester: requesterData,
          participant: participantData,
        });
        if (!conversationPolicy.allowed) {
          return res.status(403).json({ error: conversationPolicy.reason });
        }

        return res.status(200).json({ conversationId: existing.id });
      }

      const requesterProfileDoc =
        requesterData.userType === 'candidato'
          ? await admin.firestore().collection('profiles').doc(uid).get()
          : null;
      const participantProfileDoc =
        participantData.userType === 'candidato'
          ? await admin
              .firestore()
              .collection('profiles')
              .doc(participantId)
              .get()
          : null;
      const conversationPolicy = canUsersStartConversation({
        requester: requesterData,
        participant: participantData,
        requesterProfile: requesterProfileDoc?.exists
          ? requesterProfileDoc.data()
          : {},
        participantProfile: participantProfileDoc?.exists
          ? participantProfileDoc.data()
          : {},
      });
      if (!conversationPolicy.allowed) {
        return res.status(403).json({ error: conversationPolicy.reason });
      }

      if (
        requesterData.userType === 'candidato' &&
        participantData.userType === 'empresa'
      ) {
        const participantPlanSummary = getEmpresaPlanSummary(participantData);
        const participantMessageAccess = canSendDirectMessage(
          participantPlanSummary.planId,
        );
        if (!participantMessageAccess.allowed) {
          return res.status(403).json({
            error:
              'Esta empresa ainda não tem as mensagens diretas ativas. Candidate-se a uma vaga para estabelecer contacto.',
            code: participantMessageAccess.code,
          });
        }
      }

      // Criar a conversa com um ID determinístico para impedir duplicados em
      // pedidos concorrentes ou iniciados pelos dois participantes.
      const now = admin.firestore.FieldValue.serverTimestamp();
      const conversationId = [uid, participantId].sort().join('__');
      const conversationRef = admin
        .firestore()
        .collection('conversations')
        .doc(conversationId);
      await admin.firestore().runTransaction(async (transaction) => {
        const conversationDoc = await transaction.get(conversationRef);
        if (!conversationDoc.exists) {
          transaction.set(conversationRef, {
            participants: [uid, participantId],
            lastMessage: '',
            unreadCounts: { [uid]: 0, [participantId]: 0 },
            createdAt: now,
            updatedAt: now,
          });
        }
      });

      return res.status(201).json({ conversationId });
    } catch (error) {
      logServerError('messages.criar_obter_conversa_failed', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: 'Método não permitido' });
}
