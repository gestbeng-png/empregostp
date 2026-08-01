import { admin } from '../../../../lib/firebaseAdmin';
import { randomUUID } from 'crypto';
import { serializeFirestoreValue } from '../../../../lib/empresaPlansCatalog';
import {
  getFirebaseStorageErrorMessage,
  isFirebaseStorageBillingDisabledError
} from '../../../../lib/firebaseStorageError';
import {
  createPaymentProofFileName,
  parsePaymentProofDataUrl
} from '../../../../lib/paymentProofFile';
import { logServerError, logServerWarning } from '../../../../lib/serverLog';
import { sendPushToUser } from '../../../../lib/serverNotifications';

const PAYMENT_PROOF_VALIDATION_MESSAGES = new Set([
  'Formato do comprovativo inválido',
  'Formato não suportado. Envie PDF, JPG ou PNG.',
  'Ficheiro inválido',
  'O tipo do comprovativo não corresponde ao ficheiro.',
  'O comprovativo deve ter no máximo 10MB.'
]);
const PAYMENT_PROOF_DOMAIN_ERRORS = Object.freeze({
  PAYMENT_PROOF_NOT_REQUIRED: {
    error: 'Este pedido não requer comprovativo',
    status: 400
  },
  REQUEST_FORBIDDEN: { error: 'Acesso não autorizado', status: 403 },
  REQUEST_NOT_FOUND: { error: 'Pedido não encontrado', status: 404 },
  REQUEST_NOT_UPLOAD_ELIGIBLE: {
    error: 'Este pedido já foi processado',
    status: 409
  }
});
const PUBLIC_STORAGE_ERROR_CODES = new Set([
  'storage/canceled',
  'storage/quota-exceeded',
  'storage/unauthenticated',
  'storage/unauthorized'
]);

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
  const {
    buffer,
    contentType: finalContentType,
    extension
  } = parsePaymentProofDataUrl({ fileBase64, contentType });
  const fileName = createPaymentProofFileName(proofName, extension);
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
        contentDisposition: `attachment; filename="${fileName}"`,
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
              contentDisposition: `attachment; filename="${fileName}"`,
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
    const body = req.body || {};
    const { proofName, fileBase64, note = '', contentType = '' } = body;
    if (Object.prototype.hasOwnProperty.call(body, 'proofUrl')) {
      return res.status(400).json({
        error: 'Envie o comprovativo como ficheiro'
      });
    }

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

    if (!fileBase64) {
      return res.status(400).json({ error: 'Comprovativo inválido' });
    }
    const uploaded = await uploadProofServerSide({
      uid: decodedToken.uid,
      requestId: id,
      proofName,
      fileBase64,
      contentType
    });

    const now = admin.firestore.Timestamp.now();
    const paymentProof = {
      url: uploaded.proofUrl,
      name: uploaded.proofName,
      note,
      contentType: uploaded.contentType,
      size: uploaded.size,
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
    const domainError = PAYMENT_PROOF_DOMAIN_ERRORS[error?.code];
    if (domainError) {
      return res.status(domainError.status).json({ error: domainError.error });
    }
    if (PAYMENT_PROOF_VALIDATION_MESSAGES.has(error?.message)) {
      return res.status(400).json({ error: error.message });
    }
    if (isFirebaseStorageBillingDisabledError(error)) {
      logServerWarning('payment_proof.storage_unavailable', error);
      return res.status(503).json({
        error: getFirebaseStorageErrorMessage(error)
      });
    }
    if (PUBLIC_STORAGE_ERROR_CODES.has(error?.code)) {
      logServerWarning('payment_proof.storage_failed', error);
      return res.status(500).json({
        error: getFirebaseStorageErrorMessage(error)
      });
    }
    logServerError('payment_proof.request_failed', error);
    return res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb'
    }
  }
};
