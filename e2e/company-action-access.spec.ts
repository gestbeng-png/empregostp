import { expect, test } from '@playwright/test';

test('publicar uma vaga sem sessão leva ao login com o destino preservado', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/empresas', { waitUntil: 'domcontentloaded' });
  const publish = page.getByRole('link', {
    name: 'Publicar uma vaga',
    exact: true,
  });
  await expect(publish).toHaveAttribute(
    'href',
    '/login?redirect=%2Fdashboard%2Fempresa%2Fvaga%2Fcriar-vaga',
    { timeout: 15_000 },
  );
  await expect(
    page
      .getByRole('main')
      .getByRole('link', { name: 'Procurar candidatos', exact: true }),
  ).toHaveAttribute('href', '/verificados');
  await publish.click();
  await expect(page).toHaveURL(
    /\/login\?redirect=%2Fdashboard%2Fempresa%2Fvaga%2Fcriar-vaga/,
  );
});

test('abrir diretamente o formulário empresarial sem sessão não mostra campos nem edição', async ({
  request,
}) => {
  for (const path of [
    '/dashboard/empresa/vaga/criar-vaga',
    '/dashboard/empresa/vaga/criar-vaga?edit=synthetic-job',
  ]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect([307, 308]).toContain(response.status());
    const location = new URL(
      response.headers().location || '',
      'http://localhost',
    );
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('redirect')).toBe(path);
  }
});
