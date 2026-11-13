import { expect, test } from '@playwright/test';

import { loginAs, qaUnavailableReason, requireBaseURL } from './qa-auth';
import type { QaAccountKey } from './qa-auth';
import { monitorPageErrors } from './ui-audit';

/**
 * Cada separador de cada painel, com sessão real (secção 6).
 *
 * Um separador "abre" mesmo quando o conteúdo rebentou ao hidratar, por isso
 * o que se verifica aqui é o conjunto: erro de página, pedidos de API falhados
 * (5xx), e a presença de conteúdo visível. Os 4xx de autorização não contam —
 * há separadores que dependem do plano e recusar é a resposta certa.
 */

interface TabCase {
  key: QaAccountKey;
  base: string;
  tabs: string[];
}

const CASES: TabCase[] = [
  {
    key: 'candidato_premium',
    base: '/dashboard/candidato',
    tabs: [
      'dashboard',
      'profile',
      'applications',
      'saved',
      'interviews',
      'messages',
      'notifications',
      'settings',
      'verification',
      'plans',
    ],
  },
  {
    key: 'empresa_pro',
    base: '/dashboard/empresa',
    tabs: [
      'dashboard',
      'jobs',
      'applications',
      'candidates',
      'interviews',
      'messages',
      'analytics',
      'hr-services',
      'company-profile',
      'plans',
    ],
  },
];

for (const { key, base, tabs } of CASES) {
  for (const tab of tabs) {
    test(`${key}: separador "${tab}" carrega sem erro`, async ({
      context,
      page,
      baseURL,
    }) => {
      const reason = qaUnavailableReason(key);
      test.skip(Boolean(reason), reason ?? '');

      const pageErrors = monitorPageErrors(page);
      const serverErrors: string[] = [];
      page.on('response', (response) => {
        if (response.status() >= 500) {
          serverErrors.push(`${response.status()} ${response.url()}`);
        }
      });

      await loginAs(context, key, requireBaseURL(baseURL));
      await page.goto(`${base}?tab=${tab}`, { waitUntil: 'domcontentloaded' });

      // Sem `networkidle`: o service worker revalida em segundo plano e a rede
      // nunca fica parada numa build de produção. Esperamos pelo conteúdo.
      await expect(page).toHaveURL(new RegExp(base.replace(/\//g, '\\/')));
      await expect
        .poll(
          () => page.evaluate(() => document.body.innerText.trim().length),
          {
            timeout: 30_000,
            message: `separador "${tab}" ficou sem conteúdo`,
          },
        )
        .toBeGreaterThan(40);
      expect(pageErrors, `erros de página em "${tab}"`).toEqual([]);
      expect(serverErrors, `respostas 5xx em "${tab}"`).toEqual([]);
    });
  }
}

const ADMIN_PAGES = [
  '/dashboard/admin',
  '/dashboard/admin/users',
  '/dashboard/admin/jobs',
  '/dashboard/admin/plans',
  '/dashboard/admin/verificacoes',
  '/dashboard/admin/subscription-requests',
  '/dashboard/admin/reports',
  '/dashboard/admin/operations',
  '/dashboard/admin/auditoria',
  '/dashboard/admin/payment-settings',
  '/dashboard/admin/testimonials',
  '/dashboard/admin/blog',
  '/dashboard/admin/news',
  '/dashboard/admin/resources',
  '/dashboard/admin/services',
  '/dashboard/admin/hr-services',
  '/dashboard/admin/affiliates',
  '/dashboard/admin/product-ads',
];

for (const path of ADMIN_PAGES) {
  test(`admin: ${path} carrega sem erro`, async ({
    context,
    page,
    baseURL,
  }) => {
    const reason = qaUnavailableReason('admin');
    test.skip(Boolean(reason), reason ?? '');

    const pageErrors = monitorPageErrors(page);
    const serverErrors: string[] = [];
    page.on('response', (response) => {
      if (response.status() >= 500) {
        serverErrors.push(`${response.status()} ${response.url()}`);
      }
    });

    await loginAs(context, 'admin', requireBaseURL(baseURL));
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), `${path} respondeu ${response?.status()}`).toBe(
      200,
    );
    expect(new URL(page.url()).pathname, `${path} redirecionou`).toBe(path);
    await expect
      .poll(
        () => page.evaluate(() => document.body.innerText.trim().length),
        { timeout: 30_000, message: `${path} ficou sem conteúdo` },
      )
      .toBeGreaterThan(40);
    expect(pageErrors, `erros de página em ${path}`).toEqual([]);
    expect(serverErrors, `respostas 5xx em ${path}`).toEqual([]);
  });
}
