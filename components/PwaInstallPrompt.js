import { useEffect, useMemo, useState } from 'react';
import styles from '../styles/PwaInstallPrompt.module.css';

const STORAGE_KEY = 'pwa-install-dismissed';

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);

  const isStandalone = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (window.localStorage.getItem(STORAGE_KEY) === 'true') return undefined;
    if (isStandalone) return undefined;

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
      setVisible(true);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setVisible(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isStandalone]);

  const handleDismiss = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, 'true');
    }
    setVisible(false);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    try {
      setInstalling(true);
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      setVisible(false);
    } finally {
      setInstalling(false);
    }
  };

  if (!visible || !deferredPrompt || isStandalone) {
    return null;
  }

  return (
    <aside className={styles.banner}>
      <div className={styles.copy}>
        <span className={styles.eyebrow}>Modo App</span>
        <strong>Instale o EmpregoSTP no seu telemóvel</strong>
        <p>Aceda mais rápido às vagas, mensagens e notificações diretamente do ecrã inicial.</p>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={handleDismiss}>
          Agora não
        </button>
        <button type="button" className={styles.primary} onClick={handleInstall} disabled={installing}>
          {installing ? 'A instalar...' : 'Instalar'}
        </button>
      </div>
    </aside>
  );
}
