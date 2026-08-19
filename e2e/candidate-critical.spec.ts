import { expect, test } from '@playwright/test';

import { e2eCandidate, e2ePublicJob } from './fixtures';

test.describe('jornada crítica isolada do candidato', () => {
  test('login, candidatura única, retirada, planos e logout protegido', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'A jornada muta uma fixture única e é executada apenas num projeto.',
    );
    test.skip(
      !process.env.FIREBASE_AUTH_EMULATOR_HOST ||
        !process.env.FIRESTORE_EMULATOR_HOST,
      'Esta jornada requer Auth e Firestore Emulators.',
    );

    const blockedExternalRequests: string[] = [];
    await page.route('**/*', async (route) => {
      const requestUrl = new URL(route.request().url());
      const isNetworkRequest = ['http:', 'https:'].includes(
        requestUrl.protocol,
      );
      const isLocal = ['localhost', '127.0.0.1', '::1'].includes(
        requestUrl.hostname,
      );

      if (isNetworkRequest && !isLocal) {
        blockedExternalRequests.push(requestUrl.origin);
        await route.abort('blockedbyclient');
        return;
      }
      await route.continue();
    });

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Email').fill(e2eCandidate.email);
    await page.getByLabel('Senha').fill(e2eCandidate.password);
    await page
      .getByRole('button', { name: 'Iniciar sessão', exact: true })
      .click();
    await expect(page).toHaveURL(/\/dashboard\/candidato(?:\?|$)/, {
      timeout: 20_000,
    });

    await page.goto(`/vaga/${e2ePublicJob.id}`, {
      waitUntil: 'domcontentloaded',
    });
    const applyButton = page
      .getByRole('button', { name: 'Candidatar agora', exact: true })
      .filter({ visible: true })
      .first();
    await expect(applyButton).toBeEnabled({ timeout: 20_000 });

    const applicationResponsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/applications') &&
        response.request().method() === 'POST',
    );
    await applyButton.click();
    const applicationResponse = await applicationResponsePromise;
    expect(applicationResponse.status()).toBe(201);
    await expect(
      page
        .getByRole('button', { name: 'Candidatura enviada', exact: true })
        .filter({ visible: true })
        .first(),
    ).toBeDisabled();

    // O segundo acesso não oferece nova submissão e o contrato GET confirma
    // que existe exatamente um registo para esta vaga/candidato.
    const duplicateCheckPromise = page.waitForResponse(
      (response) =>
        response.url().includes(
          `/api/applications?jobId=${e2ePublicJob.id}`,
        ) && response.request().method() === 'GET',
    );
    await page.reload({ waitUntil: 'domcontentloaded' });
    const duplicateCheck = await duplicateCheckPromise;
    expect(duplicateCheck.status()).toBe(200);
    const duplicatePayload = await duplicateCheck.json();
    expect(duplicatePayload.applications).toHaveLength(1);
    await expect(
      page
        .getByRole('button', { name: 'Candidatura enviada', exact: true })
        .filter({ visible: true })
        .first(),
    ).toBeDisabled();

    await page.goto('/dashboard/candidato/candidaturas', {
      waitUntil: 'domcontentloaded',
    });
    const applicationCard = page
      .locator('article')
      .filter({ hasText: e2ePublicJob.title });
    await expect(applicationCard).toBeVisible({ timeout: 20_000 });
    await applicationCard
      .getByRole('button', { name: 'Retirar candidatura', exact: true })
      .click();
    await expect(
      applicationCard.getByRole('heading', {
        name: 'Retirar esta candidatura?',
      }),
    ).toBeVisible();

    const withdrawalResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/applications/') &&
        response.url().endsWith('/withdraw') &&
        response.request().method() === 'POST',
    );
    await applicationCard
      .getByRole('button', { name: 'Confirmar retirada', exact: true })
      .click();
    const withdrawalResponse = await withdrawalResponsePromise;
    expect(withdrawalResponse.status()).toBe(200);
    await expect(
      applicationCard.getByText('Retirada', { exact: true }),
    ).toBeVisible();
    await expect(
      applicationCard.getByRole('button', { name: 'Retirar candidatura' }),
    ).toHaveCount(0);

    await page.goto('/dashboard/candidato', {
      waitUntil: 'domcontentloaded',
    });
    const activeApplicationsMetric = page.locator(
      '[data-metric="applications"]',
    );
    await expect(activeApplicationsMetric).toBeVisible({ timeout: 20_000 });
    await expect(activeApplicationsMetric.locator('.stat-value')).toHaveText(
      '2',
    );
    await expect(activeApplicationsMetric).toContainText('3 no total');

    await page
      .getByRole('button', { name: 'Planos premium', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Escolha o seu plano' }),
    ).toBeVisible({ timeout: 20_000 });
    const premiumCard = page
      .getByRole('heading', { name: 'Premium', exact: true })
      .locator('..');
    await premiumCard
      .getByRole('button', { name: 'Assinar plano', exact: true })
      .click();
    const paymentDialog = page.getByRole('dialog');
    await expect(
      paymentDialog.getByRole('heading', { name: 'Confirmar assinatura' }),
    ).toBeVisible();
    await expect(
      paymentDialog.getByRole('button', { name: 'Confirmar', exact: true }),
    ).toBeVisible();
    // Não confirma pagamento nem cria pedido: fecha na etapa de revisão.
    await paymentDialog
      .getByRole('button', { name: 'Cancelar', exact: true })
      .click();
    await expect(paymentDialog).toHaveCount(0);

    const logoutResponsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/auth/session') &&
        response.request().method() === 'DELETE',
    );
    await page.getByRole('button', { name: 'Sair', exact: true }).click();
    const logoutResponse = await logoutResponsePromise;
    expect(logoutResponse.status()).toBe(200);
    await expect(page).toHaveURL(/\/login(?:\?|$)/, { timeout: 20_000 });

    await page.goto('/dashboard/candidato', {
      waitUntil: 'domcontentloaded',
    });
    await expect(page).toHaveURL(/\/login(?:\?|$)/, { timeout: 20_000 });

    await testInfo.attach('rede-externa-bloqueada', {
      body: Buffer.from(
        JSON.stringify([...new Set(blockedExternalRequests)], null, 2),
      ),
      contentType: 'application/json',
    });
  });
});
