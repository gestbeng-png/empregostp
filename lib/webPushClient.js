import { app } from './firebase';

const TOKEN_STORAGE_KEY = 'web-push-token';
const DISMISS_STORAGE_KEY = 'web-push-prompt-dismissed';

export function isWebPushPromptDismissed() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(DISMISS_STORAGE_KEY) === 'true';
}

export function dismissWebPushPrompt() {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DISMISS_STORAGE_KEY, 'true');
}

export async function isWebPushSupported() {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return false;
  const { isSupported } = await import('firebase/messaging');
  return isSupported();
}

export async function registerWebPushToken() {
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    throw new Error('NEXT_PUBLIC_FIREBASE_VAPID_KEY não configurada');
  }

  const supported = await isWebPushSupported();
  if (!supported) {
    throw new Error('Push web não suportado neste navegador');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Permissão de notificações não concedida');
  }

  const registration = await navigator.serviceWorker.ready;
  const { getMessaging, getToken } = await import('firebase/messaging');
  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration
  });

  if (!token) {
    throw new Error('Não foi possível obter o token de push');
  }

  const authModule = await import('firebase/auth');
  const auth = authModule.getAuth();
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) {
    throw new Error('Sessão expirada');
  }

  const response = await fetch('/api/push-subscriptions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`
    },
    body: JSON.stringify({
      token,
      permission,
      userAgent: navigator.userAgent
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || 'Falha ao registrar push web');
  }

  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  return token;
}

export async function unregisterCurrentPushToken() {
  if (typeof window === 'undefined') return;
  const token = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!token) return;

  // O registo local só é apagado quando o servidor deixou de ter uma
  // subscrição nossa para este token; caso contrário o token fica para uma
  // nova tentativa — apagá-lo às cegas deixava o dispositivo a receber push
  // depois do logout, sem forma de repetir a limpeza.
  let serverSideCleared = false;
  try {
    const authModule = await import('firebase/auth');
    const auth = authModule.getAuth();
    const idToken = await auth.currentUser?.getIdToken();
    if (idToken) {
      const response = await fetch('/api/push-subscriptions', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({ token })
      });
      // 2xx: removida/idempotente; 403: o token pertence a outra conta e o
      // registo local está obsoleto de qualquer forma.
      serverSideCleared = response.ok || response.status === 403;
    }
  } catch (error) {
    // Falha de rede: mantém o token para retry.
  }

  if (serverSideCleared) {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export async function attachForegroundPushListener(onForegroundMessage) {
  const supported = await isWebPushSupported();
  if (!supported) return () => {};
  const { getMessaging, onMessage } = await import('firebase/messaging');
  const messaging = getMessaging(app);
  return onMessage(messaging, (payload) => {
    onForegroundMessage?.(payload);
  });
}
