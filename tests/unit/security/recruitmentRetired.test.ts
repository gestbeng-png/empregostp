/**
 * ADR-019 — com o interruptor desligado (o estado do site), «Recrutamento e
 * equipa» não aparece, as páginas redirecionam e as APIs de empresa/equipa
 * respondem 404 sem executar nada. O lado do candidato não é afetado.
 */
const ORIGINAL = process.env.NEXT_PUBLIC_RECRUITMENT_WORKSPACE_ENABLED;

jest.mock('@/lib/serverSession', () => ({
  requireSession: jest.fn(async () => null),
  requireSessionAccount: jest.fn(async () => ({ accountType: 'empresa' })),
}));
jest.mock('@/lib/adminPageGuard', () => ({
  requireAdminPageAuth: jest.fn(async () => ({ ok: true })),
}));

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_RECRUITMENT_WORKSPACE_ENABLED;
  jest.resetModules();
});
afterAll(() => {
  process.env.NEXT_PUBLIC_RECRUITMENT_WORKSPACE_ENABLED = ORIGINAL;
});

const response = () => {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    setHeader: jest.fn(),
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
      return res;
    },
  };
  return res;
};

test('APIs de empresa/equipa respondem 404 sem chegar ao handler', async () => {
  const { recruitmentApi } =
    await import('@/presentation/applications/recruitmentApi');
  const handler = jest.fn();
  const res = response();
  await recruitmentApi(handler)({} as never, res as never);
  expect(handler).not.toHaveBeenCalled();
  expect(res.statusCode).toBe(404);
  expect(res.body).toEqual({
    error: {
      code: 'NOT_FOUND',
      message: 'Esta funcionalidade não está disponível.',
    },
  });
});

test('páginas redirecionam, e o convite não passa o token adiante', async () => {
  const context = {
    res: { setHeader: jest.fn() },
    query: { i: 'invite', t: 'SECRET' },
    resolvedUrl: '/equipa/convite?i=invite&t=SECRET',
  };
  const pages = [
    ['@/pages/dashboard/recrutamento', '/dashboard'],
    ['@/pages/equipa/convite', '/dashboard'],
    ['@/pages/dashboard/admin/operations', '/dashboard/admin'],
  ] as const;
  for (const [path, destination] of pages) {
    const { getServerSideProps } = await import(path);
    expect(await getServerSideProps(context)).toEqual({
      redirect: { destination, permanent: false },
    });
  }
});

test('navegação sem «Recrutamento e equipa»; avisos antigos não navegam para lá', async () => {
  const { DASHBOARD_NAV } = await import('@/components/dashboard/dashboardNav');
  const keys = Object.values(DASHBOARD_NAV)
    .flat()
    .flatMap((group: { items: { key: string }[] }) => group.items)
    .map((item) => item.key);
  expect(keys).not.toContain('recruitment');
  expect(keys).not.toContain('operations');
  const { recruitmentNotificationPath } =
    await import('@/lib/recruitmentNotificationNavigation');
  expect(
    recruitmentNotificationPath({ actionUrl: '/dashboard/recrutamento' }),
  ).toBeNull();
  expect(
    recruitmentNotificationPath({
      actionUrl: '/dashboard/candidato/candidaturas',
    }),
  ).toBe('/dashboard/candidato/candidaturas');
});
