import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  attachForegroundPushListener,
  dismissWebPushPrompt,
  isWebPushPromptDismissed,
  isWebPushSupported,
  registerWebPushToken
} from '../lib/webPushClient';
import styles from '../styles/WebPushManager.module.css';

export default function WebPushManager() {
  const { user } = useAuth();
  const [supported, setSupported] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let unsubscribe = () => {};

    async function setup() {
      if (!user || typeof window === 'undefined') {
        setShowPrompt(false);
        return;
      }

      if (!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY) {
        return;
      }

      const pushSupported = await isWebPushSupported();
      if (!pushSupported) return;
      setSupported(true);

      if (Notification.permission === 'granted') {
        try {
          await registerWebPushToken();
        } catch (registrationError) {
          // best effort
        }
      } else if (Notification.permission === 'default' && !isWebPushPromptDismissed()) {
        setShowPrompt(true);
      }

      unsubscribe = await attachForegroundPushListener((payload) => {
        const title = payload?.notification?.title || payload?.data?.title || 'EmpregoSTP';
        const message = payload?.notification?.body || payload?.data?.message || 'Nova notificação recebida.';
        const detail = { title, message, payload };
        setToast(detail);
        window.dispatchEvent(new CustomEvent('app-notification-received', { detail }));
      });
    }

    setup();

    return () => {
      unsubscribe?.();
    };
  }, [user]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleActivate = async () => {
    try {
      setActivating(true);
      setError('');
      await registerWebPushToken();
      setShowPrompt(false);
    } catch (activationError) {
      setError(activationError.message || 'Não foi possível ativar os alertas.');
    } finally {
      setActivating(false);
    }
  };

  const handleDismiss = () => {
    dismissWebPushPrompt();
    setShowPrompt(false);
  };

  if (!user || !supported) {
    return toast ? (
      <div className={styles.toast}>
        <strong>{toast.title}</strong>
        <p>{toast.message}</p>
      </div>
    ) : null;
  }

  return (
    <>
      {showPrompt && (
        <aside className={styles.prompt}>
          <div className={styles.promptCopy}>
            <span className={styles.eyebrow}>Alertas Web</span>
            <strong>Ative notificações push</strong>
            <p>Receba novas mensagens, entrevistas e atualizações sem depender de refresh.</p>
            {error && <p className={styles.error}>{error}</p>}
          </div>
          <div className={styles.promptActions}>
            <button type="button" className={styles.secondary} onClick={handleDismiss}>
              Agora não
            </button>
            <button type="button" className={styles.primary} onClick={handleActivate} disabled={activating}>
              {activating ? 'A ativar...' : 'Ativar alertas'}
            </button>
          </div>
        </aside>
      )}

      {toast && (
        <div className={styles.toast}>
          <strong>{toast.title}</strong>
          <p>{toast.message}</p>
        </div>
      )}
    </>
  );
}
