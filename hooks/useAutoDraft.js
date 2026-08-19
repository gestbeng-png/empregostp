import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_DRAFT_TTL_MS,
  FORM_DRAFT_VERSION,
  readLocalDraft,
  readLocalDraftClearedAt,
  removeLocalDraft,
  removeLocalDraftClearMarker,
  sanitizeDraftValue,
  writeLocalDraft,
  writeLocalDraftClearMarker,
} from '../lib/formDraft';

const identityDraftValue = (currentValue) => currentValue;

/**
 * @typedef {object} AutoDraftOptions
 * @property {string} storageKey
 * @property {string} scope
 * @property {string} [resourceId]
 * @property {*} value
 * @property {(draft: *, metadata: { source: string, savedAt: string }) => void} [onRestore]
 * @property {() => (Promise<string | undefined> | string | undefined)} [getToken]
 * @property {boolean} [enabled]
 * @property {boolean} [ready]
 * @property {boolean} [remote]
 * @property {number} [debounceMs]
 * @property {number} [ttlMs]
 * @property {number} [version]
 * @property {boolean} [allowLocalDataUrls]
 * @property {number} [maxLocalDataUrlLength]
 * @property {*} [baseUpdatedAt]
 * @property {(draft: *) => *} [migrate]
 * @property {(value: *) => *} [prepareLocal]
 * @property {(value: *) => *} [prepareRemote]
 */

function getLocalSanitizeOptions(config) {
  return {
    allowDataUrls: Boolean(config?.allowLocalDataUrls),
    maxDataUrlLength: config?.maxLocalDataUrlLength || 750_000,
  };
}

function serializeDraftValue(value, options) {
  try {
    return JSON.stringify(sanitizeDraftValue(value, options));
  } catch {
    return '';
  }
}

function toTimestamp(value) {
  if (!value) return 0;
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value === 'object') {
    const seconds = Number(value.seconds ?? value._seconds);
    const nanoseconds = Number(value.nanoseconds ?? value._nanoseconds ?? 0);
    if (Number.isFinite(seconds)) {
      return seconds * 1_000 + Math.floor(nanoseconds / 1_000_000);
    }
  }
  const timestamp = Date.parse(String(value));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getBrowserStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** @param {AutoDraftOptions} options */
export default function useAutoDraft({
  storageKey,
  scope,
  resourceId = 'default',
  value,
  onRestore,
  getToken,
  enabled = true,
  ready = true,
  remote = true,
  debounceMs = 700,
  ttlMs = DEFAULT_DRAFT_TTL_MS,
  version = FORM_DRAFT_VERSION,
  allowLocalDataUrls = false,
  maxLocalDataUrlLength = 750_000,
  baseUpdatedAt = '',
  migrate,
  prepareLocal = identityDraftValue,
  prepareRemote = identityDraftValue,
}) {
  const [status, setStatus] = useState('idle');
  const [lastSavedAt, setLastSavedAt] = useState('');
  const [hasDraft, setHasDraft] = useState(false);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  const mountedRef = useRef(false);
  const hasDraftRef = useRef(hasDraft);
  const valueRef = useRef(value);
  const configRef = useRef(null);
  const timerRef = useRef(null);
  const hydratedKeyRef = useRef('');
  const baselineRef = useRef('');
  const lastSavedAtMsRef = useRef(0);
  const changedSinceRestoreRef = useRef(false);
  const requestSequenceRef = useRef(0);
  const skipAutosaveOnceRef = useRef(false);
  const draftGenerationRef = useRef(0);
  const remoteQueueRef = useRef(Promise.resolve(true));
  const previousKeySnapshotRef = useRef(null);

  hasDraftRef.current = hasDraft;

  if (
    configRef.current?.storageKey &&
    configRef.current.storageKey !== storageKey &&
    hydratedKeyRef.current === configRef.current.storageKey
  ) {
    previousKeySnapshotRef.current = {
      baseline: baselineRef.current,
      config: configRef.current,
      value: valueRef.current,
    };
  }

  valueRef.current = value;
  configRef.current = {
    storageKey,
    scope,
    resourceId,
    onRestore,
    getToken,
    enabled,
    ready,
    remote,
    ttlMs,
    version,
    allowLocalDataUrls,
    maxLocalDataUrlLength,
    baseUpdatedAt,
    migrate,
    prepareLocal,
    prepareRemote,
  };

  const persistLatest = useCallback(async ({ force = false } = {}) => {
    const config = { ...configRef.current };
    if (
      !config?.enabled ||
      !config.ready ||
      !config.storageKey ||
      hydratedKeyRef.current !== config.storageKey
    ) {
      return false;
    }

    const generation = draftGenerationRef.current;
    const valueSnapshot = valueRef.current;
    const localSanitizeOptions = getLocalSanitizeOptions(config);
    const localData = sanitizeDraftValue(
      config.prepareLocal(valueSnapshot),
      localSanitizeOptions,
    );
    const serialized = serializeDraftValue(localData, localSanitizeOptions);
    if (!serialized || (!force && serialized === baselineRef.current)) {
      return true;
    }

    let localEnvelope = null;
    let localSaved = false;
    const storage = getBrowserStorage();

    try {
      localEnvelope = writeLocalDraft(storage, config.storageKey, localData, {
        version: config.version,
        ttlMs: config.ttlMs,
        ...localSanitizeOptions,
      });
      localSaved = Boolean(localEnvelope);
      baselineRef.current = serialized;
      lastSavedAtMsRef.current = Date.parse(localEnvelope?.savedAt || '') || 0;
      if (mountedRef.current) {
        setHasDraft(true);
        setLastSavedAt(localEnvelope?.savedAt || '');
      }
    } catch {
      localSaved = false;
    }

    const browserOnline =
      typeof navigator === 'undefined' ? true : navigator.onLine;
    if (
      !config.remote ||
      typeof config.getToken !== 'function' ||
      !config.scope ||
      !browserOnline
    ) {
      if (mountedRef.current) {
        setStatus(localSaved ? (browserOnline ? 'local' : 'offline') : 'error');
      }
      return localSaved;
    }

    const requestSequence = ++requestSequenceRef.current;
    const remoteData = sanitizeDraftValue(
      config.prepareRemote(valueSnapshot),
    );
    const endpoint = `/api/drafts/${encodeURIComponent(
      config.scope,
    )}?resourceId=${encodeURIComponent(config.resourceId || 'default')}`;
    if (mountedRef.current) setStatus('saving');

    const runRemoteSave = async () => {
      const isCurrentRequest = () => {
        if (
          generation !== draftGenerationRef.current ||
          config.storageKey !== configRef.current?.storageKey ||
          hydratedKeyRef.current !== config.storageKey
        ) {
          return false;
        }

        const latestSerialized = serializeDraftValue(
          configRef.current.prepareLocal(valueRef.current),
          getLocalSanitizeOptions(configRef.current),
        );
        return latestSerialized === serialized;
      };

      if (
        generation !== draftGenerationRef.current ||
        hydratedKeyRef.current !== config.storageKey
      ) {
        return localSaved;
      }

      try {
        const online =
          typeof navigator === 'undefined' ? true : navigator.onLine;
        if (!online) throw new Error('offline');

        const token = await config.getToken();
        if (!token) throw new Error('missing-token');
        if (
          generation !== draftGenerationRef.current ||
          hydratedKeyRef.current !== config.storageKey
        ) {
          return localSaved;
        }

        const response = await fetch(endpoint, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            version: config.version,
            data: remoteData,
          }),
        });

        if (!response.ok) throw new Error(`draft-save-${response.status}`);
        const result = await response.json().catch(() => ({}));

        if (
          mountedRef.current &&
          requestSequence === requestSequenceRef.current &&
          isCurrentRequest()
        ) {
          setStatus('saved');
          setHasDraft(true);
          setLastSavedAt(result.savedAt || localEnvelope?.savedAt || '');
        }
        return true;
      } catch {
        if (
          mountedRef.current &&
          requestSequence === requestSequenceRef.current &&
          isCurrentRequest()
        ) {
          const online =
            typeof navigator === 'undefined' ? true : navigator.onLine;
          setStatus(localSaved ? (online ? 'local' : 'offline') : 'error');
        }
        return localSaved;
      }
    };

    const queuedSave = remoteQueueRef.current
      .catch(() => false)
      .then(runRemoteSave);
    remoteQueueRef.current = queuedSave.catch(() => false);
    return queuedSave;
  }, []);

  const saveNow = useCallback(
    () => persistLatest({ force: true }),
    [persistLatest],
  );

  const clearDraft = useCallback(async () => {
    const config = { ...configRef.current };
    if (!config?.storageKey) return true;

    if (timerRef.current) clearTimeout(timerRef.current);
    draftGenerationRef.current += 1;
    const storage = getBrowserStorage();
    writeLocalDraftClearMarker(storage, config.storageKey);
    removeLocalDraft(storage, config.storageKey);
    baselineRef.current = serializeDraftValue(
      config.prepareLocal(valueRef.current),
      getLocalSanitizeOptions(config),
    );
    changedSinceRestoreRef.current = false;
    lastSavedAtMsRef.current = 0;
    requestSequenceRef.current += 1;

    if (mountedRef.current) {
      setStatus('idle');
      setHasDraft(false);
      setLastSavedAt('');
    }

    if (
      !config.remote ||
      typeof config.getToken !== 'function' ||
      !config.scope
    ) {
      return true;
    }

    const deleteRemoteDraft = async () => {
      try {
        const token = await config.getToken();
        if (!token) return false;
        const endpoint = `/api/drafts/${encodeURIComponent(
          config.scope,
        )}?resourceId=${encodeURIComponent(config.resourceId || 'default')}`;
        const response = await fetch(endpoint, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
          keepalive: true,
        });
        if (response.ok) {
          removeLocalDraftClearMarker(storage, config.storageKey);
        }
        return response.ok;
      } catch {
        return false;
      }
    };

    // The delete is queued after every older PUT. New edits are queued after
    // this delete, so an in-flight save cannot recreate a submitted draft.
    const queuedDelete = remoteQueueRef.current
      .catch(() => false)
      .then(deleteRemoteDraft);
    remoteQueueRef.current = queuedDelete.catch(() => false);
    return queuedDelete;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const snapshot = previousKeySnapshotRef.current;
    if (!snapshot) return;
    previousKeySnapshotRef.current = null;

    const previousConfig = snapshot.config;
    if (!previousConfig?.enabled || !previousConfig.ready) return;

    const localSanitizeOptions = getLocalSanitizeOptions(previousConfig);
    const localData = sanitizeDraftValue(
      previousConfig.prepareLocal(snapshot.value),
      localSanitizeOptions,
    );
    const serialized = serializeDraftValue(localData, localSanitizeOptions);
    if (!serialized || serialized === snapshot.baseline) return;

    try {
      writeLocalDraft(
        getBrowserStorage(),
        previousConfig.storageKey,
        localData,
        {
          version: previousConfig.version,
          ttlMs: previousConfig.ttlMs,
          ...localSanitizeOptions,
        },
      );
    } catch {
      // A troca de rota continua mesmo sem armazenamento disponível.
    }
  }, [storageKey]);

  useEffect(() => {
    if (!enabled || !ready || !storageKey || typeof window === 'undefined') {
      draftGenerationRef.current += 1;
      hydratedKeyRef.current = '';
      return undefined;
    }

    let active = true;
    const generation = ++draftGenerationRef.current;
    const config = configRef.current;
    const storage = getBrowserStorage();
    const baseUpdatedAtMs = toTimestamp(config.baseUpdatedAt);
    const clearedAtMs = readLocalDraftClearedAt(storage, config.storageKey);
    const localDraft = readLocalDraft(storage, config.storageKey, {
      version: config.version,
      migrate: config.migrate,
    });

    setStatus('restoring');
    changedSinceRestoreRef.current = false;
    lastSavedAtMsRef.current = 0;
    hydratedKeyRef.current = storageKey;

    const applyDraft = (draft, source) => {
      if (
        !draft?.data ||
        !active ||
        generation !== draftGenerationRef.current
      ) {
        return false;
      }
      const savedAtMs = toTimestamp(draft.savedAt);
      if (baseUpdatedAtMs && savedAtMs && savedAtMs <= baseUpdatedAtMs) {
        return false;
      }

      baselineRef.current = serializeDraftValue(
        config.prepareLocal(draft.data),
        getLocalSanitizeOptions(config),
      );
      lastSavedAtMsRef.current = savedAtMs;
      skipAutosaveOnceRef.current = true;

      if (source === 'remote') {
        try {
          // Keep the device copy aligned with the newest cloud draft so the
          // same state is available on the next offline reload.
          writeLocalDraft(storage, config.storageKey, draft.data, {
            version: config.version,
            ttlMs: config.ttlMs,
            now: savedAtMs || Date.now(),
            ...getLocalSanitizeOptions(config),
          });
        } catch {
          // Remote recovery still succeeds when browser storage is unavailable.
        }
      }

      config.onRestore?.(draft.data, {
        source,
        savedAt: draft.savedAt || '',
      });
      setHasDraft(true);
      setLastSavedAt(draft.savedAt || '');
      setStatus('restored');
      return true;
    };

    const localApplied = applyDraft(localDraft, 'local');
    if (!localApplied) {
      baselineRef.current = serializeDraftValue(
        config.prepareLocal(valueRef.current),
        getLocalSanitizeOptions(config),
      );
      setStatus('idle');
      setHasDraft(false);
      setLastSavedAt('');
    }

    if (
      config.remote &&
      typeof config.getToken === 'function' &&
      config.scope
    ) {
      void (async () => {
        try {
          const token = await config.getToken();
          if (
            !token ||
            !active ||
            generation !== draftGenerationRef.current
          ) {
            return;
          }
          const endpoint = `/api/drafts/${encodeURIComponent(
            config.scope,
          )}?resourceId=${encodeURIComponent(
            config.resourceId || 'default',
          )}`;
          const response = await fetch(endpoint, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (
            !response.ok ||
            !active ||
            generation !== draftGenerationRef.current
          ) {
            return;
          }
          const result = await response.json().catch(() => ({}));
          const remoteDraft = result.draft;
          const remoteSavedAtMs = toTimestamp(remoteDraft?.savedAt);

          if (
            remoteDraft?.data &&
            remoteSavedAtMs > lastSavedAtMsRef.current &&
            remoteSavedAtMs > clearedAtMs &&
            !changedSinceRestoreRef.current
          ) {
            applyDraft(remoteDraft, 'remote');
          }
        } catch {
          // A cópia local continua disponível quando a rede falha.
        }
      })();
    }

    return () => {
      active = false;
    };
  }, [
    baseUpdatedAt,
    enabled,
    ready,
    remote,
    resourceId,
    scope,
    storageKey,
    version,
  ]);

  useEffect(() => {
    if (
      !enabled ||
      !ready ||
      !storageKey ||
      hydratedKeyRef.current !== storageKey
    ) {
      return undefined;
    }

    if (skipAutosaveOnceRef.current) {
      skipAutosaveOnceRef.current = false;
      return undefined;
    }

    const prepared = configRef.current.prepareLocal(value);
    const serialized = serializeDraftValue(
      prepared,
      getLocalSanitizeOptions(configRef.current),
    );
    if (!serialized || serialized === baselineRef.current) return undefined;

    changedSinceRestoreRef.current = true;
    setStatus('saving');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void persistLatest();
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [
    debounceMs,
    enabled,
    persistLatest,
    ready,
    storageKey,
    value,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const flushLocal = () => {
      const config = configRef.current;
      if (
        !config?.enabled ||
        !config.ready ||
        !config.storageKey ||
        hydratedKeyRef.current !== config.storageKey
      ) {
        return;
      }

      const localSanitizeOptions = getLocalSanitizeOptions(config);
      const localData = sanitizeDraftValue(
        config.prepareLocal(valueRef.current),
        localSanitizeOptions,
      );
      const serialized = serializeDraftValue(localData, localSanitizeOptions);
      if (!serialized || serialized === baselineRef.current) return;

      try {
        writeLocalDraft(getBrowserStorage(), config.storageKey, localData, {
          version: config.version,
          ttlMs: config.ttlMs,
          ...localSanitizeOptions,
        });
        baselineRef.current = serialized;
      } catch {
        // O unload não pode ser bloqueado por uma falha de armazenamento.
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushLocal();
    };
    const handleOffline = () => {
      flushLocal();
      setIsOnline(false);
      if (hasDraftRef.current) setStatus('offline');
    };
    const handleOnline = () => {
      setIsOnline(true);
      if (hasDraftRef.current || changedSinceRestoreRef.current) {
        void persistLatest({ force: true });
      }
    };

    window.addEventListener('pagehide', flushLocal);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      // Client-side navigation does not always emit pagehide. Persist the last
      // keystrokes locally before removing the listeners as an extra safeguard.
      flushLocal();
      window.removeEventListener('pagehide', flushLocal);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [persistLatest]);

  return {
    status,
    lastSavedAt,
    hasDraft,
    isOnline,
    saveNow,
    clearDraft,
  };
}
