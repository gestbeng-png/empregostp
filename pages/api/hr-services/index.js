import { admin } from '../../../lib/firebaseAdmin';
import { createServerNotification } from '../../../lib/serverNotifications';
import { logServerError } from '../../../lib/serverLog';

const COLLECTION = 'hrServiceRequests';

// Limites de validação dos campos do pedido de serviço RH
const LIMITS = {
  title: { min: 4, max: 120 },
  description: { min: 15, max: 3000 },
  serviceType: { max: 80 },
  docLabel: { max: 120 },
  docUrl: { max: 500 },
  maxDocuments: 10,
};

// Estados que impedem a criação de novos pedidos em paralelo não são aplicados:
// uma empresa pode abrir vários pedidos de serviço RH.

function sanitize(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
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

// Normaliza a lista de documentos anexados (links) enviada pela empresa.
function normalizeDocuments(rawDocuments) {
  if (!Array.isArray(rawDocuments)) return { documents: [], error: null };

  const documents = [];
  for (const item of rawDocuments.slice(0, LIMITS.maxDocuments)) {
    const url = sanitize(item?.url);
    if (!url) continue; // ignora linhas vazias
    if (!isValidUrl(url) || url.length > LIMITS.docUrl.max) {
      return {
        documents: null,
        error:
          'Cada documento deve ter um link válido (começando por http:// ou https://).',
      };
    }
    const label = sanitize(item?.label).slice(0, LIMITS.docLabel.max);
    documents.push({ label: label || 'Documento', url });
  }
  return { documents, error: null };
}

function toIso(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return null;
}

function serialize(doc) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    companyId: data.companyId || '',
    companyName: data.companyName || '',
    companyEmail: data.companyEmail || '',
    serviceType: data.serviceType || '',
    title: data.title || '',
    description: data.description || '',
    documents: Array.isArray(data.documents) ? data.documents : [],
    status: data.status || 'pending',
    adminResponse: data.adminResponse || '',
    resultDocuments: Array.isArray(data.resultDocuments)
      ? data.resultDocuments
      : [],
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    processedAt: toIso(data.processedAt),
    completedAt: toIso(data.completedAt),
  };
}

async function notifyAdmins(payload) {
  try {
    const adminsSnapshot = await admin
      .firestore()
      .collection('users')
      .where('userType', '==', 'admin')
      .get();
    await Promise.all(
      adminsSnapshot.docs.map((doc) =>
        createServerNotification(admin, { ...payload, userId: doc.id }),
      ),
    );
  } catch (error) {
    logServerError(
      'hr_services.notificar_admins_sobre_pedido_de_servico_rh_failed',
      error,
    );
  }
}

export default async function handler(req, res) {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (err) {
      return res.status(401).json({ error: 'Token inválido ou expirado' });
    }

    const uid = decodedToken.uid;
    const userSnap = await admin.firestore().collection('users').doc(uid).get();
    const userType = userSnap.exists ? userSnap.data().userType : null;

    if (userType !== 'empresa') {
      return res
        .status(403)
        .json({ error: 'Apenas empresas podem solicitar serviços de RH.' });
    }

    const collectionRef = admin.firestore().collection(COLLECTION);

    if (req.method === 'GET') {
      const snapshot = await collectionRef.where('companyId', '==', uid).get();
      const requests = snapshot.docs
        .map(serialize)
        .sort((a, b) =>
          String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
        );
      return res.status(200).json({ requests });
    }

    if (req.method === 'POST') {
      const userData = userSnap.data() || {};
      const serviceType = sanitize(req.body?.serviceType);
      const title = sanitize(req.body?.title);
      const description = sanitizeMultiline(req.body?.description);
      const { documents, error: documentsError } = normalizeDocuments(
        req.body?.documents,
      );

      if (!serviceType || serviceType.length > LIMITS.serviceType.max) {
        return res
          .status(400)
          .json({ error: 'Selecione o tipo de serviço pretendido.' });
      }
      if (title.length < LIMITS.title.min || title.length > LIMITS.title.max) {
        return res.status(400).json({
          error: `O assunto deve ter entre ${LIMITS.title.min} e ${LIMITS.title.max} caracteres.`,
        });
      }
      if (
        description.length < LIMITS.description.min ||
        description.length > LIMITS.description.max
      ) {
        return res.status(400).json({
          error: `A descrição deve ter entre ${LIMITS.description.min} e ${LIMITS.description.max} caracteres.`,
        });
      }
      if (documentsError) {
        return res.status(400).json({ error: documentsError });
      }

      const now = admin.firestore.FieldValue.serverTimestamp();
      const payload = {
        companyId: uid,
        companyName:
          userData.companyName ||
          userData.name ||
          userData.fullName ||
          'Empresa',
        companyEmail: userData.email || decodedToken.email || '',
        serviceType,
        title,
        description,
        documents,
        status: 'pending',
        adminResponse: '',
        resultDocuments: [],
        createdAt: now,
        updatedAt: now,
      };

      const docRef = await collectionRef.add(payload);

      await notifyAdmins({
        type: 'HR_SERVICE_REQUEST',
        title: 'Novo pedido de serviço RH',
        message: `${payload.companyName} solicitou: ${title}`,
        icon: '🧑‍💼',
        relatedId: docRef.id,
        relatedType: 'hr_service',
        actionUrl: '/dashboard/admin/hr-services',
      });

      const saved = await docRef.get();
      return res.status(201).json({
        message:
          'Pedido de serviço RH enviado com sucesso. A nossa equipa irá analisá-lo em breve.',
        request: serialize(saved),
      });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Método não permitido' });
  } catch (error) {
    logServerError('hr_services.api_de_servicos_rh_failed', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
