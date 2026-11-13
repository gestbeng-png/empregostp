import { useEffect, useState } from 'react';

// Partilhado pela escolha inicial e pelo pagamento: um pedido por página.
let configPromise = null;
function loadConfig() {
  if (!configPromise) {
    configPromise = Promise.resolve()
      .then(() => fetch('/api/payments/stripe/config'))
      .then((response) => (response.ok ? response.json() : { enabled: false }))
      .catch(() => ({ enabled: false }));
  }
  return configPromise;
}

export default function useOnlinePaymentConfig(enabled = true) {
  const [config, setConfig] = useState(null);
  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    loadConfig().then((value) => {
      if (active) setConfig(value);
    });
    return () => {
      active = false;
    };
  }, [enabled]);
  return { loading: config === null, onlineEnabled: config?.enabled === true };
}
