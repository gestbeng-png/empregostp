import crypto from 'crypto';
import { getSafeErrorMetadata, logServerError } from './serverLog';

const INVALID_TOKEN_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
  'messaging/invalid-argument'
]);

export function buildPushSubscriptionId(token = '') {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function toStringMap(data = {}) {
  const entries = Object.entries(data || {}).filter(([, value]) => value !== undefined && value !== null);
  return Object.fromEntries(entries.map(([key, value]) => [key, String(value)]));
}

export async function sendPushToUser(adminInstance, userId, payload = {}) {
  if (!adminInstance?.apps?.length || !userId) return { sent: 0, failed: 0 };

  try {
    const snapshot = await adminInstance.firestore()
      .collection('push-subscriptions')
      .where('userId', '==', userId)
      .where('enabled', '==', true)
      .get();

    const tokens = [...new Set(snapshot.docs.map((doc) => doc.data()?.token).filter(Boolean))];
    if (!tokens.length) return { sent: 0, failed: 0 };

    const response = await adminInstance.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title: payload.title || 'EmpregoSTP',
        body: payload.message || payload.body || ''
      },
      data: toStringMap({
        type: payload.type || 'info',
        relatedId: payload.relatedId || '',
        relatedType: payload.relatedType || '',
        actionUrl: payload.actionUrl || '',
        title: payload.title || 'EmpregoSTP',
        message: payload.message || payload.body || ''
      }),
      webpush: {
        notification: {
          title: payload.title || 'EmpregoSTP',
          body: payload.message || payload.body || '',
          icon: '/assets/Emprego STP Logo.png',
          badge: '/assets/Emprego STP Logo.png',
          data: {
            actionUrl: payload.actionUrl || '/',
            relatedId: payload.relatedId || null,
            relatedType: payload.relatedType || null
          }
        },
        fcmOptions: {
          link: payload.actionUrl || '/'
        }
      }
    });

    const batch = adminInstance.firestore().batch();
    response.responses.forEach((result, index) => {
      const token = tokens[index];
      const docId = buildPushSubscriptionId(token);
      const ref = adminInstance.firestore().collection('push-subscriptions').doc(docId);
      if (result.success) {
        batch.set(ref, {
          lastSuccessfulPushAt: adminInstance.firestore.FieldValue.serverTimestamp(),
          updatedAt: adminInstance.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        return;
      }

      const code = result.error?.code || '';
      if (INVALID_TOKEN_CODES.has(code)) {
        batch.delete(ref);
      } else {
        batch.set(ref, {
          lastError: getSafeErrorMetadata(result.error).category,
          updatedAt: adminInstance.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }
    });
    await batch.commit();

    return {
      sent: response.successCount,
      failed: response.failureCount
    };
  } catch (error) {
    logServerError('push_delivery.request_failed', error);
    return { sent: 0, failed: 0 };
  }
}

export async function createServerNotification(adminInstance, payload = {}) {
  const notificationData = {
    userId: payload.userId,
    title: payload.title,
    message: payload.message,
    type: payload.type || 'info',
    icon: payload.icon || '🔔',
    read: false,
    relatedId: payload.relatedId || null,
    relatedType: payload.relatedType || null,
    actionUrl: payload.actionUrl || null,
    createdAt: adminInstance.firestore.FieldValue.serverTimestamp()
  };

  const notificationRef = await adminInstance.firestore().collection('notifications').add(notificationData);
  await sendPushToUser(adminInstance, payload.userId, payload);
  return notificationRef;
}
