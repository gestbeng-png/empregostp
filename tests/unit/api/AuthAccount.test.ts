import { requireActiveApiUser } from '../../../lib/apiUserAuth';
import handler from '../../../pages/api/auth/account';

jest.mock('../../../lib/apiUserAuth', () => ({
  requireActiveApiUser: jest.fn(),
}));
jest.mock('../../../lib/serverLog', () => ({ logServerError: jest.fn() }));
const auth = jest.mocked(requireActiveApiUser);
function response() {
  const res = { status: jest.fn(), json: jest.fn(), setHeader: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

beforeEach(() => jest.clearAllMocks());

test.each(['admin', 'empresa', 'candidato'])(
  'devolve apenas uid e papel %s confirmados no servidor',
  async (userType) => {
    auth.mockResolvedValue({
      uid: 'current-uid',
      userData: { userType, email: 'private' },
    } as never);
    const res = response();
    await handler(
      { method: 'GET', query: { uid: 'forged-uid', userType: 'admin' } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      uid: 'current-uid',
      accountType: userType,
    });
    expect(res.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'private, no-store, max-age=0',
    );
  },
);

test('conta não autenticada ou bloqueada não recebe identidade', async () => {
  auth.mockResolvedValue(null);
  const res = response();
  await handler({ method: 'GET' }, res);
  expect(res.json).not.toHaveBeenCalled();
});

test('papel desconhecido não ganha permissões de candidato por defeito', async () => {
  auth.mockResolvedValue({ uid: 'current-uid', userData: {} } as never);
  const res = response();
  await handler({ method: 'GET' }, res);
  expect(res.status).toHaveBeenCalledWith(403);
});

test('não aceita escritas de tipo de conta', async () => {
  const res = response();
  await handler({ method: 'POST', body: { userType: 'admin' } }, res);
  expect(res.status).toHaveBeenCalledWith(405);
  expect(auth).not.toHaveBeenCalled();
});
