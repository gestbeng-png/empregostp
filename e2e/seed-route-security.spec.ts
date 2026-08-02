import { expect, test } from '@playwright/test';

test('a ferramenta de seed permanece indisponível sem ativação explícita', async ({
  request,
}) => {
  test.skip(
    process.env.ENABLE_DEV_SEED_PAGE === 'true',
    'O ambiente ativou explicitamente a ferramenta interna.',
  );

  const response = await request.get('/setup/seed');
  expect(response.status()).toBe(404);
});
