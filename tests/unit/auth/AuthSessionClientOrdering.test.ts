import {
  createServerSession,
  destroyServerSession,
} from '../../../lib/authSessionClient';

const fetchMock = jest.fn();
const ok = { ok: true };
function deferred() {
  let resolve!: (value: typeof ok) => void;
  const promise = new Promise<typeof ok>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = fetchMock;
});

test('um POST atrasado nunca ultrapassa o DELETE de logout ou a sessão seguinte', async () => {
  const previous = deferred();
  const logout = deferred();
  fetchMock
    .mockReturnValueOnce(previous.promise)
    .mockReturnValueOnce(logout.promise)
    .mockResolvedValueOnce(ok);
  const first = createServerSession('candidate-token');
  const second = destroyServerSession('candidate-token');
  const third = createServerSession('admin-token');
  await Promise.resolve();
  await Promise.resolve();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  previous.resolve(ok);
  await first;
  await Promise.resolve();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[1][1].method).toBe('DELETE');
  logout.resolve(ok);
  await Promise.all([second, third]);
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe(
    'Bearer admin-token',
  );
});

test('uma falha não bloqueia a limpeza posterior do cookie', async () => {
  fetchMock
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(ok);
  const first = createServerSession('old-token');
  const clear = destroyServerSession();
  await expect(first).rejects.toThrow('offline');
  await clear;
  expect(fetchMock.mock.calls[1][1]).toEqual(
    expect.objectContaining({ method: 'DELETE', headers: {} }),
  );
});
