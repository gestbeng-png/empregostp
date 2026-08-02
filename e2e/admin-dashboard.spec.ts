import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { e2eAdmin } from './fixtures';
import { collectVisibleUiMetrics, monitorPageErrors } from './ui-audit';

const ADMIN_SMOKE_ROUTES = [
  '/dashboard/admin/users',
  '/dashboard/admin/jobs',
  '/dashboard/admin/jobs/e2e-admin-job',
  '/dashboard/admin/jobs/e2e-admin-job/edit',
  '/dashboard/admin/services',
  '/dashboard/admin/verificacoes',
  '/dashboard/admin/plans',
  '/dashboard/admin/reports',
  '/dashboard/admin/blog',
  '/dashboard/admin/news',
  '/dashboard/admin/resources',
  '/dashboard/admin/testimonials',
  '/dashboard/admin/subscription-requests',
  '/dashboard/admin/affiliates',
  '/dashboard/admin/hr-services',
  '/dashboard/admin/auditoria',
  '/dashboard/admin/payment-settings',
] as const;

function getAdminAuditRoutes(): readonly string[] {
  const configuredRoutes = process.env.ADMIN_AUDIT_ROUTES;
  return configuredRoutes
    ? configuredRoutes
        .split(',')
        .map((route) => route.trim())
        .filter(Boolean)
    : ADMIN_SMOKE_ROUTES;
}

async function loginAdmin(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(e2eAdmin.email);
  await page.getByLabel('Senha').fill(e2eAdmin.password);
  await page
    .getByRole('button', { name: 'Iniciar sessão', exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard\/admin$/, { timeout: 60_000 });
}

async function openNavigationIfCollapsed(page: Page) {
  const menuButton = page.getByRole('button', { name: 'Abrir menu' });

  if (await menuButton.isVisible()) {
    await menuButton.click();
  }
}

test.describe('painel Admin', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 });

  test.beforeEach(async ({ page }) => {
    test.skip(
      !process.env.FIREBASE_AUTH_EMULATOR_HOST,
      'Esta jornada requer os emuladores Firebase.',
    );
    await loginAdmin(page);
  });

  test('mantém navegação e tema coerentes entre rotas', async ({ page }) => {
    const errors = monitorPageErrors(page);

    await expect(
      page.getByRole('heading', { name: 'Painel de Controlo' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Usar tema escuro' }).click();
    await expect(page.locator('.dashShell')).toHaveAttribute(
      'data-theme',
      'dark',
    );
    await expect(page.locator('html')).toHaveAttribute(
      'data-dashboard-theme',
      'dark',
    );

    await openNavigationIfCollapsed(page);
    const navigation = page.getByRole('navigation');

    await expect(
      navigation.getByRole('link', { name: 'Notícias' }),
    ).toBeVisible();
    await expect(
      navigation.getByRole('link', { name: 'Recursos' }),
    ).toBeVisible();
    await expect(
      navigation.getByRole('link', { name: 'Afiliados' }),
    ).toBeVisible();

    await navigation.getByRole('link', { name: 'Gerir vagas' }).click();
    await expect(page).toHaveURL(/\/dashboard\/admin\/jobs/, {
      timeout: 60_000,
    });
    await expect(
      page.getByRole('heading', { name: 'Gerir vagas' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Usar tema claro' }),
    ).toBeVisible();
    await expect(page.getByText('Coordenador administrativo')).toBeVisible();

    const metrics = await collectVisibleUiMetrics(page);
    expect(metrics.horizontalOverflow).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });

  test('publicação de vaga é acessível e responsiva nos dois temas', async ({
    page,
  }) => {
    await page.goto('/dashboard/admin/jobs/create');
    await expect(
      page.getByRole('heading', { name: 'Nova vaga' }),
    ).toBeVisible();
    await expect(page.getByLabel('Selecionar empresa')).toBeVisible();
    await expect(page.getByLabel('Título / nome da vaga *')).toBeVisible();

    const lightAccessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(lightAccessibility.violations).toEqual([]);

    await page.getByRole('button', { name: 'Usar tema escuro' }).click();
    const darkAccessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(darkAccessibility.violations).toEqual([]);

    const metrics = await collectVisibleUiMetrics(page);
    expect(metrics.horizontalOverflow).toBeLessThanOrEqual(0);
  });

  test('rotas administrativas mantêm o contrato visual e semântico', async ({
    page,
  }) => {
    test.setTimeout(600_000);
    test.skip(
      test.info().project.name !== 'chromium',
      'A matriz completa é validada uma vez em desktop; o fluxo móvel crítico tem cobertura dedicada.',
    );

    await page.getByRole('button', { name: 'Usar tema escuro' }).click();
    const failures: string[] = [];

    for (const route of getAdminAuditRoutes()) {
      const pageErrors: string[] = [];
      const handlePageError = (error: Error) => pageErrors.push(error.message);
      page.on('pageerror', handlePageError);

      await page.goto(route, { waitUntil: 'domcontentloaded' });

      try {
        await expect(page).toHaveURL(
          new RegExp(`${route.replaceAll('/', '\\/')}(?:[?#]|$)`),
          {
            timeout: 60_000,
          },
        );
        await expect(page.locator('.dashShell')).toHaveAttribute(
          'data-theme',
          'dark',
        );
        await expect(page.locator('main h1').first()).toBeVisible({
          timeout: 60_000,
        });

        const metrics = await collectVisibleUiMetrics(page);
        if (metrics.horizontalOverflow > 0) {
          failures.push(
            `${route}: overflow horizontal de ${metrics.horizontalOverflow}px`,
          );
        }

        const accessibility = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        if (accessibility.violations.length > 0) {
          failures.push(
            `${route}: ${accessibility.violations
              .map(
                (violation) =>
                  `${violation.id} [${violation.nodes
                    .slice(0, 4)
                    .map(
                      (node) =>
                        `${node.target.join(' ')}: ${node.failureSummary || 'sem detalhe'}`,
                    )
                    .join(' | ')}]`,
              )
              .join('; ')}`,
          );
        }

        if (pageErrors.length > 0) {
          failures.push(`${route}: ${pageErrors.join(' | ')}`);
        }
      } finally {
        page.off('pageerror', handlePageError);
      }
    }

    expect(failures).toEqual([]);
  });
});
