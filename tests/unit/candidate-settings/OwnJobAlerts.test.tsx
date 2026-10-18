import { act, renderHook, waitFor } from '@testing-library/react';

import {
  summarizeJobAlertFilters,
  useOwnJobAlerts,
} from '@/components/candidates/useOwnJobAlerts';

jest.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: { getIdToken: async () => 'token' } }),
}));

const reply = (status: number, body: unknown) =>
  ({ ok: status < 300, status, json: async () => body }) as Response;

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

test('resume os filtros de um alerta em português', () => {
  expect(
    summarizeJobAlertFilters({
      search: 'contabilista',
      categoria: 'Finanças',
      minSalary: 5000,
    }),
  ).toBe(
    '“contabilista” · Finanças · a partir de 5000 STD'.replace(
      '5000',
      (5000).toLocaleString('pt-PT'),
    ),
  );
  expect(summarizeJobAlertFilters({})).toBe('Todas as vagas');
});

test('só retira o alerta da lista depois de o servidor confirmar', async () => {
  let resolveDelete: (value: Response) => void = () => {};
  global.fetch = jest.fn((_url: RequestInfo | URL, init?: RequestInit) =>
    init?.method === 'DELETE'
      ? new Promise<Response>((resolve) => {
          resolveDelete = resolve;
        })
      : Promise.resolve(reply(200, { alerts: [{ id: 'a1', filters: {} }] })),
  ) as typeof fetch;

  const { result } = renderHook(() => useOwnJobAlerts(true));
  await waitFor(() => expect(result.current.alerts).toHaveLength(1));

  let pending: Promise<void> = Promise.resolve();
  act(() => {
    pending = result.current.cancelAlert('a1');
  });
  expect(result.current.cancellingId).toBe('a1');
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  expect(result.current.alerts).toHaveLength(1);

  await act(async () => {
    resolveDelete(reply(200, { cancelled: true }));
    await pending;
  });
  expect(result.current.alerts).toHaveLength(0);
});

test('um erro mantém o alerta e mostra a mensagem do servidor', async () => {
  global.fetch = jest.fn((_url: RequestInfo | URL, init?: RequestInit) =>
    Promise.resolve(
      init?.method === 'DELETE'
        ? reply(404, { error: 'Alerta não encontrado.' })
        : reply(200, { alerts: [{ id: 'a1', filters: {} }] }),
    ),
  ) as typeof fetch;

  const { result } = renderHook(() => useOwnJobAlerts(true));
  await waitFor(() => expect(result.current.alerts).toHaveLength(1));
  await act(async () => {
    await result.current.cancelAlert('a1');
  });
  expect(result.current.alerts).toHaveLength(1);
  expect(result.current.error).toBe('Alerta não encontrado.');
});

test('não carrega nada enquanto o separador não está aberto', () => {
  global.fetch = jest.fn() as typeof fetch;
  renderHook(() => useOwnJobAlerts(false));
  expect(global.fetch).not.toHaveBeenCalled();
});
