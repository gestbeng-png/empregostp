import { admin } from '../../../../lib/firebaseAdmin';
import { createServerNotification } from '../../../../lib/serverNotifications';

const COLLECTION = 'hrServiceRequests';

const LIMITS = {
  adminResponse: { min: 5, max: 3000 },
  docLabel: { max: 120 },
  docUrl: { max: 500 },
  maxDocuments: 10,
};

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

function sanitize(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function sanitizeMultiline(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function isValidUrl(value) {
  return /^https?:\/\/[^\s]+$/i.test(value);
}

function normalizeDocuments(rawDocuments) {
  if (!Array.isArray(rawDocuments)) return { documents: [], error: null };
  const documents = [];
  for (const item of rawDocuments.slice(0, LIMITS.maxDocuments)) {
    const url = sanitize(item?.url);
    if (!url) continue;
    if (!isValidUrl(url) || url.length > LIMITS.docUrl.max) {
      return { documents: null, error: 'Cada documento de resultado deve ter um link válido (http:// ou https://).' };
    }
    const label = sanitize(item?.label).slice(0, LIMITS.docLabel.max);
    documents.push({ label: label || 'Documento', url });
  }
  return { documents, error: null };
}

const STATUS_BY_ACTION = {
  approve: 'approved',
  reject: 'rejected',
  complete: 'completed',
  reset: 'pending',
};

const NOTIFICATION_BY_STATUS = {
  approved: {
    type: 'HR_SERVICE_APPROVED',
    title: 'Pedido de serviço RH aprovado ✅',
    icon: '✅',
    message: (r) => `O seu pedido "${r.title}" foi aprovado e está a ser tratado pela nossa equipa.`,
  },
  rejected: {
    type: 'HR_SERVICE_REJECTED',
    title: 'Pedido de serviço RH não aprovado',
    icon: '❌',
    message: (r) => `O seu pedido "${r.title}" não foi aprovado. Consulte a resposta da equipa no seu painel.`,
  },
  completed: {
    type: 'HR_SERVICE_COMPLETED',
    title: 'Serviço RH concluído 🎉',
    icon: '📎',
    message: (r) => `O seu pedido "${r.title}" foi concluído. Consulte a resposta e os documentos no seu painel.`,
  },
  pending: {
    type: 'HR_SERVICE_REOPENED',
    title: 'Pedido de serviço RH reaberto',
    icon: '🔄',
    message: (r) => `O seu pedido "${r.title}" voltou a análise.`,
  },
};

export default async function handler(req, res) {
  try {
    const decoded = await requireAdmin(req, res);
    if (!decoded) return;

    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ message: 'ID do pedido em falta' });
    }

    const docRef = admin.firestore().collection(COLLECTION).doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return res.status(404).json({ message: 'Pedido de serviço RH não encontrado' });
    }

    if (req.method === 'DELETE') {
      await docRef.delete();
      return res.status(200).json({ message: 'Pedido eliminado' });
    }

    if (req.method === 'PATCH' || req.method === 'POST') {
      const action = req.body?.action;
      const status = STATUS_BY_ACTION[action];
      if (!status) {
        return res
          .status(400)
          .json({ message: 'Ação inválida. Use approve, reject, complete ou reset.' });
      }

      const now = admin.firestore.FieldValue.serverTimestamp();
      const update = {
        status,
        updatedAt: now,
        processedAt: now,
        processedBy: decoded.uid,
      };

      // Concluir (finalizar) exige resposta e pode anexar documentos de resultado.
      // Rejeitar aceita uma resposta opcional a explicar o motivo.
      if (action === 'complete' || action === 'reject') {
        const adminResponse = sanitizeMultiline(req.body?.adminResponse);
        if (action === 'complete') {
          if (adminResponse.length < LIMITS.adminResponse.min || adminResponse.length > LIMITS.adminResponse.max) {
            return res.status(400).json({
              message: `A resposta deve ter entre ${LIMITS.adminResponse.min} e ${LIMITS.adminResponse.max} caracteres.`,
            });
          }
          const { documents, error } = normalizeDocuments(req.body?.resultDocuments);
          if (error) {
            return res.status(400).json({ message: error });
          }
          update.adminResponse = adminResponse;
          update.resultDocuments = documents;
          update.completedAt = now;
        } else if (adminResponse) {
          if (adminResponse.length > LIMITS.adminResponse.max) {
            return res.status(400).json({
              message: `A resposta é demasiado longa (máx. ${LIMITS.adminResponse.max} caracteres).`,
            });
          }
          update.adminResponse = adminResponse;
        }
      }

      await docRef.update(update);

      // Notificar a empresa sobre a mudança de estado
      const data = docSnap.data() || {};
      const notif = NOTIFICATION_BY_STATUS[status];
      if (notif && data.companyId) {
        await createServerNotification(admin, {
          userId: data.companyId,
          type: notif.type,
          title: notif.title,
          icon: notif.icon,
          message: notif.message({ title: data.title || 'serviço RH' }),
          relatedId: id,
          relatedType: 'hr_service',
          actionUrl: '/dashboard/empresa?tab=hr-services',
        });
      }

      return res.status(200).json({ message: 'Estado atualizado', status });
    }

    res.setHeader('Allow', 'PATCH, POST, DELETE');
    return res.status(405).json({ message: 'Método não permitido' });
  } catch (error) {
    console.error('Erro ao moderar pedido de serviço RH:', error);
    return res.status(500).json({ message: 'Erro interno do servidor', error: error.message });
  }
}
