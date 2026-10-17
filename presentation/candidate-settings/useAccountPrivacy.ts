import { getAuth } from 'firebase/auth';
import { useCallback, useEffect, useState } from 'react';

import { pt } from '@/shared/i18n/pt';

export interface PendingDeletion {
  executeAfter: string;
  requestedAt: string;
  status: 'PENDING';
}

type Busy = 'cancel' | 'export' | 'load' | 'request' | null;

interface Feedback {
  message: string;
  type: 'error' | 'success';
}

const copy = pt.candidateSettings;

async function authorizedFetch(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getAuth().currentUser?.getIdToken();
  if (!token) throw new Error(copy.api.sessionExpired);
  return fetch(input, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

async function readError(response: Response): Promise<string> {
  const payload: unknown = await response.json().catch(() => null);
  const error =
    typeof payload === 'object' && payload !== null
      ? (payload as { error?: unknown }).error
      : null;
  return typeof error === 'string' ? error : copy.api.unexpected;
}

function readDeletion(payload: unknown): PendingDeletion | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const deletion = (payload as { deletion?: unknown }).deletion;
  if (typeof deletion !== 'object' || deletion === null) return null;
  const value = deletion as Partial<PendingDeletion>;
  return value.status === 'PENDING' &&
    typeof value.executeAfter === 'string' &&
    typeof value.requestedAt === 'string'
    ? (value as PendingDeletion)
    : null;
}

/**
 * H5 no painel do candidato: exportar dados e pedir/cancelar a eliminação.
 * Nada é mostrado como concluído antes de o servidor confirmar.
 */
export interface AccountPrivacyState {
  busy: Busy;
  cancelDeletion: () => Promise<void>;
  deletion: PendingDeletion | null;
  exportData: () => Promise<void>;
  feedback: Feedback | null;
  requestDeletion: (confirmation: string) => Promise<void>;
}

export function useAccountPrivacy(enabled: boolean): AccountPrivacyState {
  const [deletion, setDeletion] = useState<PendingDeletion | null>(null);
  const [busy, setBusy] = useState<Busy>(enabled ? 'load' : null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    setBusy('load');
    authorizedFetch('/api/me/privacy')
      .then(async (response) => {
        if (!response.ok) throw new Error(await readError(response));
        const payload: unknown = await response.json();
        if (active) setDeletion(readDeletion(payload));
      })
      .catch((error: unknown) => {
        if (active)
          setFeedback({
            type: 'error',
            message:
              error instanceof Error ? error.message : copy.api.unexpected,
          });
      })
      .finally(() => {
        if (active) setBusy(null);
      });
    return () => {
      active = false;
    };
  }, [enabled]);

  const run = useCallback(
    async (kind: Exclude<Busy, 'load' | null>, task: () => Promise<string>) => {
      setBusy(kind);
      setFeedback(null);
      try {
        const message = await task();
        setFeedback({ type: 'success', message });
      } catch (error) {
        setFeedback({
          type: 'error',
          message: error instanceof Error ? error.message : copy.api.unexpected,
        });
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const exportData = useCallback(
    () =>
      run('export', async () => {
        const response = await authorizedFetch('/api/me/privacy?export=1');
        if (!response.ok) throw new Error(await readError(response));
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `empregostp-dados-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        return copy.exportData.done;
      }),
    [run],
  );

  const requestDeletion = useCallback(
    (confirmation: string) =>
      run('request', async () => {
        const response = await authorizedFetch('/api/me/privacy', {
          method: 'POST',
          body: JSON.stringify({ action: 'request_deletion', confirmation }),
        });
        if (!response.ok) throw new Error(await readError(response));
        setDeletion(readDeletion(await response.json()));
        return copy.deleteAccount.requested;
      }),
    [run],
  );

  const cancelDeletion = useCallback(
    () =>
      run('cancel', async () => {
        const response = await authorizedFetch('/api/me/privacy', {
          method: 'POST',
          body: JSON.stringify({ action: 'cancel_deletion' }),
        });
        if (!response.ok) throw new Error(await readError(response));
        setDeletion(null);
        return copy.deleteAccount.cancelled;
      }),
    [run],
  );

  return {
    busy,
    cancelDeletion,
    deletion,
    exportData,
    feedback,
    requestDeletion,
  };
}
