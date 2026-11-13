import { expect, test } from '@playwright/test';

import { loginAs, qaApi, qaUnavailableReason, requireBaseURL } from './qa-auth';
import type { QaAccountKey } from './qa-auth';
import { monitorPageErrors } from './ui-audit';

/**
 * Fronteiras de papel com sessão real.
 *
 * A suíte só cobria visitantes, por isso nada garantia que um candidato
 * autenticado não alcançasse o painel de empresa ou de administração. Aqui o
 * que se testa é a decisão do servidor: o destino final depois de seguir os
 * redirecionamentos, e o código HTTP das APIs chamadas diretamente — não a
 * ausência de botões no ecrã.
 */

const DASHBOARD_HOME: Record<string, RegExp> = {
  candidato_basico: /\/dashboard\/candidato(?:\?|$)/,
  candidato_premium: /\/dashboard\/candidato(?:\?|$)/,
  empresa_basica: /\/dashboard\/empresa(?:\?|$)/,
  empresa_pro: /\/dashboard\/empresa(?:\?|$)/,
  admin: /\/dashboard\/admin(?:\?|$)/,
};

for (const [key, expected] of Object.entries(DASHBOARD_HOME)) {
  test(`${key} entra no painel correto a partir de /dashboard`, async ({
    context,
    page,
    baseURL,
  }) => {
    const reason = qaUnavailableReason(key as QaAccountKey);
    test.skip(Boolean(reason), reason ?? '');

    const errors = monitorPageErrors(page);
    await loginAs(context, key as QaAccountKey, requireBaseURL(baseURL));
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(expected);
    // Um painel que rebenta ao hidratar continua a "abrir": o erro de página
    // é o que distingue carregar de funcionar.
    expect(errors).toEqual([]);
  });
}

const FORBIDDEN_PAGES: Array<{
  key: QaAccountKey;
  path: string;
  label: string;
}> = [
  {
    key: 'candidato_basico',
    path: '/dashboard/empresa',
    label: 'candidato no painel de empresa',
  },
  {
    key: 'candidato_basico',
    path: '/dashboard/empresa/vagas',
    label: 'candidato na lista de vagas da empresa',
  },
  {
    key: 'candidato_basico',
    path: '/dashboard/empresa/vaga/criar-vaga',
    label: 'candidato no formulário de criar vaga',
  },
  {
    key: 'candidato_basico',
    path: '/dashboard/admin',
    label: 'candidato na administração',
  },
  {
    key: 'candidato_basico',
    path: '/dashboard/admin/users',
    label: 'candidato na gestão de utilizadores',
  },
  {
    key: 'candidato_basico',
    path: '/dashboard/admin/plans',
    label: 'candidato na gestão de planos',
  },
  {
    key: 'empresa_basica',
    path: '/dashboard/admin',
    label: 'empresa na administração',
  },
  {
    key: 'empresa_basica',
    path: '/dashboard/admin/verificacoes',
    label: 'empresa nas verificações',
  },
  {
    key: 'empresa_basica',
    path: '/dashboard/candidato',
    label: 'empresa no painel de candidato',
  },
];

for (const { key, path, label } of FORBIDDEN_PAGES) {
  test(`bloqueia ${label}`, async ({ context, page, baseURL }) => {
    const reason = qaUnavailableReason(key);
    test.skip(Boolean(reason), reason ?? '');

    await loginAs(context, key, requireBaseURL(baseURL));
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });

    // Ou o servidor recusa, ou leva para outro sítio: o que não pode é servir
    // a página pedida com estado 200.
    const landed = new URL(page.url()).pathname;
    expect(
      landed === path && (response?.status() ?? 0) === 200,
      `${label}: serviu ${path} com HTTP ${response?.status()}`,
    ).toBe(false);
  });
}

const FORBIDDEN_API: Array<{
  key: QaAccountKey;
  method: string;
  path: string;
  label: string;
  allowed: number[];
}> = [
  {
    key: 'candidato_basico',
    method: 'GET',
    path: '/api/admin/users',
    label: 'candidato a listar utilizadores',
    allowed: [401, 403],
  },
  {
    key: 'candidato_basico',
    method: 'GET',
    path: '/api/admin/verifications',
    label: 'candidato a ler verificações',
    allowed: [401, 403],
  },
  {
    key: 'candidato_basico',
    method: 'GET',
    path: '/api/admin/subscription-requests',
    label: 'candidato a ler pedidos de subscrição',
    allowed: [401, 403],
  },
  {
    key: 'candidato_basico',
    method: 'GET',
    path: '/api/talent-pool',
    label: 'candidato a abrir a base de talentos',
    allowed: [401, 403],
  },
  {
    key: 'candidato_basico',
    method: 'GET',
    path: '/api/export/applications',
    label: 'candidato a exportar candidaturas',
    allowed: [401, 403, 400],
  },
  {
    key: 'empresa_basica',
    method: 'GET',
    path: '/api/admin/users',
    label: 'empresa a listar utilizadores',
    allowed: [401, 403],
  },
  {
    key: 'empresa_basica',
    method: 'GET',
    path: '/api/admin/payment-settings',
    label: 'empresa a ler configurações de pagamento',
    // Leitura permitida a qualquer conta ativa; a escrita é que é de admin.
    allowed: [200],
  },
  {
    key: 'empresa_basica',
    method: 'POST',
    path: '/api/admin/payment-settings',
    label: 'empresa a escrever configurações de pagamento',
    allowed: [401, 403],
  },
];

for (const { key, method, path, label, allowed } of FORBIDDEN_API) {
  test(`API recusa: ${label}`, async ({ context, page, baseURL }) => {
    const reason = qaUnavailableReason(key);
    test.skip(Boolean(reason), reason ?? '');

    await loginAs(context, key, requireBaseURL(baseURL));
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const result = await qaApi(page, key, path, {
      method,
      ...(method === 'POST' ? { body: { accountNumber: '000' } } : {}),
    });
    expect(
      allowed,
      `${label}: recebeu ${result.status} — ${JSON.stringify(result.body).slice(0, 200)}`,
    ).toContain(result.status);
  });
}

test('a configuração de pagamento não é legível sem sessão', async ({
  page,
}) => {
  // Expunha NIB, titular e email do titular a qualquer visitante.
  const response = await page.request.get('/api/admin/payment-settings', {
    failOnStatusCode: false,
  });
  expect(response.status()).toBe(401);
  expect(await response.text()).not.toContain('accountNumber');
});
