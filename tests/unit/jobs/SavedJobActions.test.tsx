import { act, renderHook } from '@testing-library/react';

import useSavedJobActions from '../../../components/candidates/useSavedJobActions';

jest.mock('../../../lib/firebaseAuth', () => ({
  auth: { currentUser: { uid: 'owner', getIdToken: async () => 'test-token' } },
}));
const job = { id: 'job', titulo: 'Vaga de teste' };
const originalFetch = global.fetch;
afterAll(() => { global.fetch = originalFetch; });

test('remove só após resposta confirmada e desfazer envia POST real', async () => {
  let jobs = [job];
  const setJobs = (update: (items: typeof jobs) => typeof jobs) => { jobs = update(jobs); };
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
  const { result } = renderHook(() => useSavedJobActions(setJobs, 'owner'));
  await act(async () => { await result.current.remove(job); });
  expect(jobs).toEqual([]);
  expect(result.current.removed).toEqual(job);
  await act(async () => { await result.current.undo(); });
  expect(jobs).toEqual([job]);
  expect(result.current.removed).toBeNull();
  expect((global.fetch as jest.Mock).mock.calls.map(([, opts]) => opts.method)).toEqual(['DELETE', 'POST']);
});

test('falha preserva a lista e permite repetir; duplo clique não duplica pedidos', async () => {
  const setJobs = jest.fn();
  global.fetch = jest.fn().mockResolvedValue({ ok: false });
  const { result } = renderHook(() => useSavedJobActions(setJobs, 'owner'));
  await act(async () => { await Promise.all([result.current.remove(job), result.current.remove(job)]); });
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(setJobs).not.toHaveBeenCalled();
  expect(result.current.removed).toBeNull();
  expect(result.current.error).toContain('Tente novamente');
});

test('não escreve em nome de uma sessão diferente', async () => {
  global.fetch = jest.fn();
  const { result } = renderHook(() => useSavedJobActions(jest.fn(), 'other-user'));
  await act(async () => { await result.current.remove(job); });
  expect(global.fetch).not.toHaveBeenCalled();
  expect(result.current.error).toBe('Inicie sessão para continuar.');
});
