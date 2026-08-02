import { expect, test } from '@playwright/test';

test.describe('rotas de planos premium', () => {
  test('/premium encaminha uma sessão anónima para autenticação', async ({
    page,
  }) => {
    await page.goto('/premium', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
  });

  test('/premium/candidatos aponta para os planos do candidato', async ({
    request,
  }) => {
    const response = await request.get('/premium/candidatos', {
      maxRedirects: 0,
    });

    expect([307, 308]).toContain(response.status());
    expect(response.headers().location).toBe('/dashboard/candidato?tab=plans');
  });

  test('/premium/empresa aponta para os planos da empresa', async ({
    request,
  }) => {
    const response = await request.get('/premium/empresa', {
      maxRedirects: 0,
    });

    expect([307, 308]).toContain(response.status());
    expect(response.headers().location).toBe('/dashboard/empresa?tab=plans');
  });
});
