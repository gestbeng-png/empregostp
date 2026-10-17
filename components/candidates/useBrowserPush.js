import { useCallback, useEffect, useState } from 'react';

import {
  isWebPushSupported,
  registerWebPushToken,
} from '../../lib/webPushClient';

// C10 — ativar as notificações do browser a partir do separador Notificações.
// O aviso global (WebPushManager) aparece uma vez; quem o dispensou não tinha
// outra forma de as ativar. Estados: 'hidden' (sem suporte ou sem chave),
// 'available', 'active', 'blocked'.

const PUSH_ERRORS = {
  'Permissão de notificações não concedida':
    'O browser não autorizou as notificações. Pode autorizá-las nas definições do browser.',
};

export function useBrowserPush(enabled) {
  const [state, setState] = useState('hidden');
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;
    if (!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY) return undefined;
    let active = true;
    isWebPushSupported()
      .then((supported) => {
        if (!active || !supported) return;
        const permission = window.Notification?.permission;
        setState(
          permission === 'granted'
            ? 'active'
            : permission === 'denied'
              ? 'blocked'
              : 'available',
        );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [enabled]);

  const activate = useCallback(async () => {
    setActivating(true);
    setError('');
    try {
      await registerWebPushToken();
      setState('active');
    } catch (activationError) {
      const message = activationError?.message || '';
      setError(
        PUSH_ERRORS[message] ||
          'Não foi possível ativar as notificações. Tente novamente.',
      );
      if (window.Notification?.permission === 'denied') setState('blocked');
    } finally {
      setActivating(false);
    }
  }, []);

  return { state, activating, error, activate };
}
