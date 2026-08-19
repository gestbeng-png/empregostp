import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';

import useAutoDraft from '../../../hooks/useAutoDraft';
import { writeLocalDraft } from '../../../lib/formDraft';

describe('useAutoDraft', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    window.localStorage.clear();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('não grava o estado inicial e persiste apenas a última alteração após debounce', () => {
    const { rerender } = renderHook(
      ({ value }) =>
        useAutoDraft({
          storageKey: 'profile-draft',
          scope: 'candidate-profile',
          value,
          onRestore: jest.fn(),
          remote: false,
          debounceMs: 500,
        }),
      { initialProps: { value: { bio: '' } } },
    );

    expect(window.localStorage.getItem('profile-draft')).toBeNull();

    rerender({ value: { bio: 'Primeira versão' } });
    rerender({ value: { bio: 'Versão final' } });
    act(() => jest.advanceTimersByTime(499));
    expect(window.localStorage.getItem('profile-draft')).toBeNull();

    act(() => jest.advanceTimersByTime(1));
    const saved = JSON.parse(
      String(window.localStorage.getItem('profile-draft')),
    );
    expect(saved.data).toEqual({ bio: 'Versão final' });
  });

  test('restaura o rascunho uma vez e permite limpá-lo após submissão', async () => {
    writeLocalDraft(window.localStorage, 'cv-draft', {
      currentStep: 2,
      form: { fullName: 'Ana Pinto' },
    });
    const onRestore = jest.fn();
    const { result } = renderHook(() => {
      const [value, setValue] = useState({
        currentStep: 0,
        form: { fullName: '' },
      });
      return useAutoDraft({
        storageKey: 'cv-draft',
        scope: 'cv-generator',
        value,
        onRestore: (draft: typeof value, metadata: { source: string }) => {
          onRestore(draft, metadata);
          setValue(draft);
        },
        remote: false,
      });
    });

    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(onRestore).toHaveBeenCalledWith(
      { currentStep: 2, form: { fullName: 'Ana Pinto' } },
      expect.objectContaining({ source: 'local' }),
    );
    expect(result.current.status).toBe('restored');

    await act(async () => {
      await result.current.clearDraft();
    });
    expect(window.localStorage.getItem('cv-draft')).toBeNull();
    expect(result.current.hasDraft).toBe(false);
  });

  test('faz flush local no pagehide antes de o debounce terminar', () => {
    const { rerender } = renderHook(
      ({ value }) =>
        useAutoDraft({
          storageKey: 'job-draft',
          scope: 'company-job',
          value,
          onRestore: jest.fn(),
          remote: false,
          debounceMs: 5_000,
        }),
      { initialProps: { value: { title: '' } } },
    );

    rerender({ value: { title: 'Gestor de projeto' } });
    act(() => window.dispatchEvent(new Event('pagehide')));

    const saved = JSON.parse(String(window.localStorage.getItem('job-draft')));
    expect(saved.data).toEqual({ title: 'Gestor de projeto' });
  });

  test('preserva os últimos caracteres ao trocar de recurso antes do debounce', () => {
    const { rerender } = renderHook(
      ({ storageKey, value }) =>
        useAutoDraft({
          storageKey,
          scope: 'job-application',
          value,
          onRestore: jest.fn(),
          remote: false,
          debounceMs: 5_000,
        }),
      {
        initialProps: {
          storageKey: 'application-job-a',
          value: { coverLetter: '' },
        },
      },
    );

    rerender({
      storageKey: 'application-job-a',
      value: { coverLetter: 'Última frase antes de navegar.' },
    });
    rerender({
      storageKey: 'application-job-b',
      value: { coverLetter: '' },
    });

    const saved = JSON.parse(
      String(window.localStorage.getItem('application-job-a')),
    );
    expect(saved.data).toEqual({
      coverLetter: 'Última frase antes de navegar.',
    });
  });

  test('espelha no dispositivo um rascunho online mais recente', async () => {
    const savedAt = new Date(Date.now() + 1_000).toISOString();
    const originalFetch = global.fetch;
    const fetchMock = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        draft: {
          data: { bio: 'Versão recuperada da nuvem' },
          savedAt,
        },
      }),
      ok: true,
    } as unknown as Response);
    Object.defineProperty(global, 'fetch', {
      configurable: true,
      value: fetchMock,
      writable: true,
    });
    const onRestore = jest.fn();

    renderHook(() =>
      useAutoDraft({
        storageKey: 'remote-profile-draft',
        scope: 'candidate-profile',
        value: { bio: '' },
        onRestore,
        getToken: async () => 'valid-token',
      }),
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onRestore).toHaveBeenCalledWith(
      { bio: 'Versão recuperada da nuvem' },
      expect.objectContaining({ source: 'remote' }),
    );
    const localCopy = JSON.parse(
      String(window.localStorage.getItem('remote-profile-draft')),
    );
    expect(localCopy.data).toEqual({ bio: 'Versão recuperada da nuvem' });

    if (originalFetch) {
      global.fetch = originalFetch;
    } else {
      Reflect.deleteProperty(global, 'fetch');
    }
  });

  test('executa a limpeza online depois de uma gravação que já estava em curso', async () => {
    let resolvePut: (response: Response) => void = () => undefined;
    const putResponse = new Promise<Response>((resolve) => {
      resolvePut = resolve;
    });
    const originalFetch = global.fetch;
    const fetchMock = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') return putResponse;
      if (init?.method === 'DELETE') {
        return { json: async () => ({}), ok: true } as Response;
      }
      return {
        json: async () => ({ draft: null }),
        ok: true,
      } as Response;
    });
    Object.defineProperty(global, 'fetch', {
      configurable: true,
      value: fetchMock,
      writable: true,
    });

    const { result, rerender } = renderHook(
      ({ value }) =>
        useAutoDraft({
          storageKey: 'queued-profile-draft',
          scope: 'candidate-profile',
          value,
          onRestore: jest.fn(),
          getToken: async () => 'valid-token',
          debounceMs: 50,
        }),
      { initialProps: { value: { bio: '' } } },
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    rerender({ value: { bio: 'Texto em gravação' } });
    await act(async () => {
      jest.advanceTimersByTime(50);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT'),
    ).toHaveLength(1);

    let clearPromise: Promise<boolean> | undefined;
    act(() => {
      clearPromise = result.current.clearDraft();
    });
    expect(
      fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE'),
    ).toHaveLength(0);

    resolvePut({ json: async () => ({}), ok: true } as Response);
    await act(async () => {
      await clearPromise;
    });

    const mutationMethods = fetchMock.mock.calls
      .map(([, init]) => init?.method)
      .filter(Boolean);
    expect(mutationMethods).toEqual(['PUT', 'DELETE']);

    if (originalFetch) {
      global.fetch = originalFetch;
    } else {
      Reflect.deleteProperty(global, 'fetch');
    }
  });
});
