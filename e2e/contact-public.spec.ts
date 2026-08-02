import { expect, test } from '@playwright/test';

import {
  collectVisibleUiMetrics,
  collectWcagViolations,
  monitorPageErrors,
} from './ui-audit';

test.describe('página pública de contacto', () => {
  test('/contacto mantém informação e envio acessíveis', async ({ page }) => {
    const pageErrors = monitorPageErrors(page);
    let submittedContact: Record<string, string> | null = null;

    await page.route('**/api/contact', async (route) => {
      submittedContact = route.request().postDataJSON();
      await route.fulfill({
        contentType: 'application/json',
        status: 200,
        body: JSON.stringify({
          message: 'Mensagem recebida. Responderemos em breve.',
        }),
      });
    });

    await page.emulateMedia({ reducedMotion: 'reduce' });
    const response = await page.goto('/contacto', {
      waitUntil: 'domcontentloaded',
    });

    expect(response?.ok()).toBe(true);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Vamos falar sobre o seu próximo passo',
      }),
    ).toBeVisible();

    const formRegion = page.getByRole('region', {
      name: 'Envie-nos uma mensagem',
    });
    await expect(formRegion).toBeVisible();
    await expect(
      page.getByRole('complementary', { name: 'Informações de contacto' }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /suporte@empregos\.st/i }),
    ).toHaveAttribute('href', 'mailto:suporte@empregos.st');
    await expect(
      page.getByRole('link', { name: /\+239 986 9673/i }).first(),
    ).toHaveAttribute('href', 'https://wa.me/2399869673');

    await formRegion.getByRole('button', { name: 'Enviar mensagem' }).click();
    await expect(page.getByRole('alert')).toContainText(
      'Indique o seu nome com pelo menos 2 caracteres.',
    );

    await formRegion.getByLabel('Nome').fill('Maria da Costa');
    await formRegion.getByLabel('Email').fill('maria@example.com');
    await formRegion.getByLabel('Telefone (opcional)').fill('+239 999 0000');
    await formRegion.getByLabel('Assunto').selectOption('candidato');
    await formRegion
      .getByLabel('Mensagem')
      .fill('Gostaria de esclarecer uma dúvida sobre o meu perfil.');
    await formRegion.getByRole('button', { name: 'Enviar mensagem' }).click();

    await expect(page.getByRole('status')).toContainText(
      'Mensagem recebida. Responderemos em breve.',
    );
    expect(submittedContact).toMatchObject({
      email: 'maria@example.com',
      name: 'Maria da Costa',
      source: 'contacto',
      subject: 'candidato',
    });

    const metrics = await collectVisibleUiMetrics(page);
    expect(metrics.horizontalOverflow).toBeLessThanOrEqual(0);
    expect(metrics.smallText).toEqual([]);
    expect(metrics.shortTargets).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(await collectWcagViolations(page)).toEqual([]);
  });
});
