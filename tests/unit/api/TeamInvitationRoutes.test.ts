import { authenticateApiUser } from '@/infrastructure/firebase/applications/createApplicationWorkspace';
import {
  authenticateWithEmail,
  getTeamService,
} from '@/infrastructure/firebase/team/createTeamService';
import linkHandler from '@/pages/api/invitations/[id]';
import previewHandler from '@/pages/api/invitations/[id]/preview';
jest.mock(
  '@/infrastructure/firebase/applications/createApplicationWorkspace',
  () => ({ authenticateApiUser: jest.fn() }),
);
jest.mock('@/infrastructure/firebase/team/createTeamService', () => ({
  authenticateWithEmail: jest.fn(),
  getTeamService: jest.fn(),
}));
const link = jest.fn();
const preview = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(authenticateApiUser)
    .mockResolvedValue({ uid: 'manager' } as never);
  jest.mocked(authenticateWithEmail).mockResolvedValue({
    uid: 'invited',
    email: 'ana@example.test',
    emailVerified: true,
  });
  jest.mocked(getTeamService).mockReturnValue({
    invitationLink: link,
    previewInvitation: preview,
  } as never);
  link.mockResolvedValue({
    ok: true,
    value: { acceptPath: '/equipa/convite?i=inv&t=synthetic-token' },
  });
  preview.mockResolvedValue({ ok: true, value: { status: 'PENDING' } });
});
const response = () => {
  const res = { setHeader: jest.fn(), status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
};
test('recovering an invitation is an authenticated GET and marks the response private', async () => {
  const res = response();
  await linkHandler(
    { method: 'GET', query: { id: 'inv' } } as never,
    res as never,
  );
  expect(link).toHaveBeenCalledWith('manager', 'inv');
  expect(res.setHeader).toHaveBeenCalledWith(
    'Cache-Control',
    'private, no-store',
  );
  expect(res.status).toHaveBeenCalledWith(200);
});
test('preview uses the authenticated verified-email identity and token from the body, never accepts a membership', async () => {
  const res = response();
  await previewHandler(
    {
      method: 'POST',
      query: { id: 'inv' },
      body: { token: 'synthetic-token' },
    } as never,
    res as never,
  );
  expect(preview).toHaveBeenCalledWith(
    { uid: 'invited', email: 'ana@example.test', emailVerified: true },
    'inv',
    'synthetic-token',
  );
  expect(link).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(200);
});
test('missing authentication cannot invoke either invitation service', async () => {
  jest.mocked(authenticateApiUser).mockResolvedValue(null);
  jest.mocked(authenticateWithEmail).mockResolvedValue(null);
  await linkHandler(
    { method: 'GET', query: { id: 'inv' } } as never,
    response() as never,
  );
  await previewHandler(
    {
      method: 'POST',
      query: { id: 'inv' },
      body: { token: 'synthetic-token' },
    } as never,
    response() as never,
  );
  expect(link).not.toHaveBeenCalled();
  expect(preview).not.toHaveBeenCalled();
});
test('incorrect method is rejected before authentication', async () => {
  const res = response();
  await previewHandler(
    { method: 'GET', query: { id: 'inv', token: 'synthetic-token' } } as never,
    res as never,
  );
  expect(res.status).toHaveBeenCalledWith(405);
  expect(authenticateWithEmail).not.toHaveBeenCalled();
});
