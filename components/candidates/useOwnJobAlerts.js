import { getAuth } from 'firebase/auth';
import { useCallback, useEffect, useState } from 'react';

// C08 — alertas de vagas do próprio candidato (pelo email da conta).
// O cancelamento só desaparece da lista depois de o servidor confirmar.

async function authorizedFetch(input, init = {}) {
  const token = await getAuth().currentUser?.getIdToken();
  if (!token) throw new Error('A sessão terminou. Inicie sessão novamente.');
  return fetch(input, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` },
  });
}

async function readError(response, fallback) {
  const data = await response.json().catch(() => ({}));
  return typeof data?.error === 'string' ? data.error : fallback;
}

export function summarizeJobAlertFilters(filters = {}) {
  const parts = [];
  if (filters.search) parts.push(`“${filters.search}”`);
  if (filters.categoria) parts.push(filters.categoria);
  if (filters.localizacao) parts.push(filters.localizacao);
  if (filters.tipoContrato) parts.push(filters.tipoContrato);
  if (filters.modalidade) parts.push(filters.modalidade);
  if (filters.experiencia) parts.push(filters.experiencia);
  if (Number(filters.minSalary) > 0) {
    parts.push(
      `a partir de ${Number(filters.minSalary).toLocaleString('pt-PT')} STD`,
    );
  }
  return parts.length ? parts.join(' · ') : 'Todas as vagas';
}

export function useOwnJobAlerts(enabled) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    setLoading(true);
    setError('');
    authorizedFetch('/api/job-alerts')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            await readError(response, 'Não foi possível carregar os alertas.'),
          );
        }
        const data = await response.json();
        if (active) setAlerts(Array.isArray(data?.alerts) ? data.alerts : []);
      })
      .catch((loadError) => {
        if (active)
          setError(
            loadError?.message || 'Não foi possível carregar os alertas.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [enabled, revision]);

  const cancelAlert = useCallback(async (id) => {
    setCancellingId(id);
    setError('');
    try {
      const response = await authorizedFetch(
        `/api/job-alerts?id=${encodeURIComponent(id)}`,
        { method: 'DELETE' },
      );
      if (!response.ok) {
        throw new Error(
          await readError(response, 'Não foi possível cancelar o alerta.'),
        );
      }
      setAlerts((current) => current.filter((alert) => alert.id !== id));
    } catch (cancelError) {
      setError(cancelError?.message || 'Não foi possível cancelar o alerta.');
    } finally {
      setCancellingId('');
    }
  }, []);

  const retry = useCallback(() => setRevision((value) => value + 1), []);

  return { alerts, loading, error, cancellingId, cancelAlert, retry };
}
