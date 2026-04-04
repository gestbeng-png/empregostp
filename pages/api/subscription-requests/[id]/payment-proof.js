import { admin } from '../../../../lib/firebaseAdmin';
import { randomUUID } from 'crypto';
import { serializeFirestoreValue } from '../../../../lib/empresaPlansCatalog';
import { sendPushToUser } from '../../../../lib/serverNotifications';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const sanitizeFileName = (value = '') => String(value).replace(/[^a-zA-Z0-9._-]/g, '-');

const normalizeContentType = (value = '') => String(value || '').trim().toLowerCase();

const isAllowedContentType = (value = '') => {
  const contentType = normalizeContentType(value);
  return contentType === 'application/pdf' || contentType.startsWith('image/');
};

const detectExtension = (contentType = '', fileName = '') => {
  const normalizedContentType = normalizeContentType(contentType);
  const byType = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
  };

  if (byType[normalizedContentType]) return byType[normalizedContentType];

  const name = String(fileName || '');
  const nameParts = name.split('.');
  if (nameParts.length > 1) {
    const ext = sanitizeFileName(nameParts[nameParts.length - 1]).toLowerCase();
    if (ext) return ext;
  }

  return 'bin';
};

const resolveBucketCandidates = () => {
  const appOptionsBucket = admin.app()?.options?.storageBucket || '';
  const envBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '';
  const projectId = process.env.FIREBASE_PROJECT_ID || admin.app()?.options?.projectId || '';

  const candidates = [
    String(appOptionsBucket || '').trim(),
    String(envBucket || '').trim(),
    projectId ? `${projectId}.firebasestorage.app` : '',
    projectId ? `${projectId}.appspot.com` : ''
  ].filter(Boolean);

  return [...new Set(candidates)];
};

async function uploadProofServerSide({ uid, requestId, proofName, fileBase64, contentType }) {
  const dataUrl = String(fileBase64 || '').trim();
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Formato do comprovativo inválido');
  }

  const dataUrlContentType = normalizeContentType(matches[1]);
  const finalContentType = normalizeContentType(contentType) || dataUrlContentType;

  if (!isAllowedContentType(finalContentType)) {
    throw new Error('Formato não suportado. Envie PDF, JPG ou PNG.');
  }

  const buffer = Buffer.from(matches[2], 'base64');
  if (!buffer || buffer.length === 0) {
    throw new Error('Ficheiro inválido');
  }
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error('O comprovativo deve ter no máximo 10MB.');
  }

  const extension = detectExtension(finalContentType, proofName);
  const normalizedName = sanitizeFileName(proofName || `comprovativo-${Date.now()}.${extension}`);
  const hasExtension = normalizedName.includes('.');
  const fileName = hasExtension ? normalizedName : `${normalizedName}.${extension}`;
  const storagePath = `payment-proofs/${uid}/${requestId}-${Date.now()}-${fileName}`;

  const bucketCandidates = resolveBucketCandidates();
  if (!bucketCandidates.length) {
    throw new Error('Bucket de storage não configurado no servidor');
  }

  let lastBucketError = null;
  let bucket = null;
  let file = null;
  for (const bucketName of bucketCandidates) {
    try {
      bucket = admin.storage().bucket(bucketName);
      file = bucket.file(storagePath);
      break;
    } catch (error) {
      lastBucketError = error;
    }
  }

  if (!bucket || !file) {
    throw lastBucketError || new Error('Não foi possível inicializar o bucket de storage');
  }

  const downloadToken = randomUUID();

  try {
    await file.save(buffer, {
      resumable: false,
      metadata: {
        contentType: finalContentType,
        cacheControl: 'private, max-age=0, no-transform',
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
          ownerUid: uid,
          requestId
        }
      }
    });
  } catch (error) {
    // Retry once with alternate bucket naming when the primary candidate is invalid.
    if (bucketCandidates.length > 1 && String(error?.message || '').toLowerCase().includes('bucket')) {
      let retried = false;
      for (const bucketName of bucketCandidates.slice(1)) {
        try {
          const fallbackBucket = admin.storage().bucket(bucketName);
          const fallbackFile = fallbackBucket.file(storagePath);
          await fallbackFile.save(buffer, {
            resumable: false,
            metadata: {
              contentType: finalContentType,
              cacheControl: 'private, max-age=0, no-transform',
              metadata: {
                firebaseStorageDownloadTokens: downloadToken,
                ownerUid: uid,
                requestId
              }
            }
          });
          bucket = fallbackBucket;
          file = fallbackFile;
          retried = true;
          break;
        } catch (fallbackError) {
          lastBucketError = fallbackError;
        }
      }
      if (!retried) {
        throw lastBucketError || error;
      }
    } else {
      throw error;
    }
  }

  const proofUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`;

  return {
    proofUrl,
    proofName: fileName,
    contentType: finalContentType,
    size: buffer.length
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const { id } = req.query;
    const { proofUrl, proofName, fileBase64, note = '', contentType = '', size = 0 } = req.body || {};

    const requestRef = admin.firestore().collection('subscription-requests').doc(id);
    const requestDoc = await requestRef.get();
    if (!requestDoc.exists) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    const requestData = requestDoc.data() || {};
    if (requestData.userId !== decodedToken.uid) {
      return res.status(403).json({ error: 'Acesso não autorizado' });
    }

    if (requestData.status === 'approved' || requestData.status === 'rejected') {
      return res.status(400).json({ error: 'Este pedido já foi processado' });
    }

    if (Number(requestData.price || 0) <= 0) {
      return res.status(400).json({ error: 'Este pedido não requer comprovativo' });
    }

    let finalProofUrl = proofUrl;
    let finalProofName = proofName;
    let finalContentType = contentType;
    let finalSize = Number(size) || 0;

    if ((!finalProofUrl || !finalProofName) && fileBase64) {
      const uploaded = await uploadProofServerSide({
        uid: decodedToken.uid,
        requestId: id,
        proofName: proofName || `comprovativo-${Date.now()}`,
        fileBase64,
        contentType
      });

      finalProofUrl = uploaded.proofUrl;
      finalProofName = uploaded.proofName;
      finalContentType = uploaded.contentType;
      finalSize = uploaded.size;
    }

    if (!finalProofUrl || !finalProofName) {
      return res.status(400).json({ error: 'Comprovativo inválido' });
    }

    const now = admin.firestore.Timestamp.now();
    const paymentProof = {
      url: finalProofUrl,
      name: finalProofName,
      note,
      contentType: finalContentType,
      size: Number(finalSize) || 0,
      submittedAt: now,
      submittedBy: decodedToken.uid
    };

    await requestRef.set({
      paymentProof,
      paymentStatus: 'proof_submitted',
      status: 'payment_submitted',
      updatedAt: now
    }, { merge: true });

    const adminSnapshot = await admin.firestore().collection('users').where('userType', '==', 'admin').get();
    const batch = admin.firestore().batch();

    adminSnapshot.docs.forEach((doc) => {
      const notificationRef = admin.firestore().collection('notifications').doc();
      batch.set(notificationRef, {
        userId: doc.id,
        type: 'SUBSCRIPTION_PAYMENT_PROOF',
        title: 'Comprovativo recebido',
        message: `${requestData.userName || requestData.userEmail || 'Um utilizador'} enviou o comprovativo do plano ${requestData.planName || requestData.planId}.`,
        read: false,
        relatedId: id,
        relatedType: 'subscription_request',
        createdAt: now,
        actionUrl: '/dashboard/admin/subscription-requests'
      });
    });

    const userNotificationRef = admin.firestore().collection('notifications').doc();
    batch.set(userNotificationRef, {
      userId: decodedToken.uid,
      type: 'SUBSCRIPTION_PAYMENT_PROOF_RECEIVED',
      title: 'Comprovativo enviado',
      message: 'Recebemos o seu comprovativo de pagamento. O administrador fará a validação em breve.',
      read: false,
      relatedId: id,
      relatedType: 'subscription_request',
      createdAt: now
    });

    await batch.commit();

    await Promise.all([
      ...adminSnapshot.docs.map((doc) => sendPushToUser(admin, doc.id, {
        title: 'Comprovativo recebido',
        message: `${requestData.userName || requestData.userEmail || 'Um utilizador'} enviou o comprovativo do plano ${requestData.planName || requestData.planId}.`,
        type: 'SUBSCRIPTION_PAYMENT_PROOF',
        relatedId: id,
        relatedType: 'subscription_request',
        actionUrl: '/dashboard/admin/subscription-requests'
      })),
      sendPushToUser(admin, decodedToken.uid, {
        title: 'Comprovativo enviado',
        message: 'Recebemos o seu comprovativo de pagamento. O administrador fará a validação em breve.',
        type: 'SUBSCRIPTION_PAYMENT_PROOF_RECEIVED',
        relatedId: id,
        relatedType: 'subscription_request',
        actionUrl: requestData.planType === 'empresa' ? '/dashboard/empresa?tab=plans' : '/dashboard/candidato?tab=plans'
      })
    ]);

    const updatedDoc = await requestRef.get();
    return res.status(200).json({
      message: 'Comprovativo enviado com sucesso',
      request: {
        id: updatedDoc.id,
        ...serializeFirestoreValue(updatedDoc.data())
      }
    });
  } catch (error) {
    console.error('Erro ao enviar comprovativo:', error);
    if (error?.message?.includes('Formato') || error?.message?.includes('10MB')) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb'
    }
  }
};
