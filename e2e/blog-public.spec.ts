import { expect, test } from '@playwright/test';

import {
  collectVisibleUiMetrics,
  collectWcagViolations,
  monitorPageErrors,
} from './ui-audit';

test.describe('blog público', () => {
  test('/blog reproduz a composição editorial em desktop e mobile', async ({
    page,
  }, testInfo) => {
    const pageErrors = monitorPageErrors(page);
    const isMobile = testInfo.project.name.includes('mobile');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    const response = await page.goto('/blog', {
      waitUntil: 'domcontentloaded',
    });

    expect(response?.ok()).toBe(true);
    const main = page.getByRole('main');
    await expect(main).toHaveCount(1);
    await expect(
      main.getByRole('heading', {
        level: 1,
        name: isMobile ? 'Centro de Imprensa' : 'Blog e novidades.',
      }),
    ).toBeVisible();

    const featuredArticle = main.getByRole('article').first();
    const featuredImage = featuredArticle.getByRole('img');
    const featuredTitle = featuredArticle.getByRole('heading', { level: 2 });
    await expect(featuredImage).toBeVisible();
    await expect(featuredTitle).toBeVisible();
    await expect(
      featuredArticle.getByRole('link', { name: 'Ler artigo' }),
    ).toHaveAttribute('href', /^\/blog\/.+/);

    const recentSection = main.getByRole('region', {
      name: 'Publicações recentes',
    });
    const recentArticles = recentSection.getByRole('article');
    // A quantidade depende das publicações reais disponíveis, não de um
    // conjunto fixo de dados de demonstração.
    expect(await recentArticles.count()).toBeGreaterThanOrEqual(2);
    await expect(recentArticles.nth(0).getByRole('img')).toBeVisible();
    await expect(recentArticles.nth(1).getByRole('img')).toBeVisible();

    const featuredImageBox = await featuredImage.boundingBox();
    const featuredTitleBox = await featuredTitle.boundingBox();
    const firstRecentBox = await recentArticles.nth(0).boundingBox();
    const secondRecentBox = await recentArticles.nth(1).boundingBox();

    expect(featuredImageBox).not.toBeNull();
    expect(featuredTitleBox).not.toBeNull();
    expect(firstRecentBox).not.toBeNull();
    expect(secondRecentBox).not.toBeNull();
    if (
      !featuredImageBox ||
      !featuredTitleBox ||
      !firstRecentBox ||
      !secondRecentBox
    ) {
      throw new Error('Não foi possível medir a composição editorial do blog.');
    }

    if (isMobile) {
      expect(featuredImageBox.y + featuredImageBox.height).toBeLessThanOrEqual(
        featuredTitleBox.y + 4,
      );
      expect(secondRecentBox.y).toBeGreaterThan(
        firstRecentBox.y + firstRecentBox.height - 2,
      );

      const firstRecentImageBox = await recentArticles
        .nth(0)
        .getByRole('img')
        .boundingBox();
      const firstRecentTitleBox = await recentArticles
        .nth(0)
        .getByRole('heading', { level: 3 })
        .boundingBox();
      expect(firstRecentImageBox).not.toBeNull();
      expect(firstRecentTitleBox).not.toBeNull();
      if (!firstRecentImageBox || !firstRecentTitleBox) {
        throw new Error('Não foi possível medir o cartão mobile do blog.');
      }
      expect(firstRecentImageBox.x).toBeGreaterThan(firstRecentTitleBox.x);

      // O painel "Atualizações rápidas" deixou de existir; em telemóvel a
      // coluna lateral desaparece e a newsletter empilha a seguir à lista de
      // publicações. É essa ordem que continua a interessar.
      const recentBox = await recentSection.boundingBox();
      const newsletterBox = await main
        .getByRole('region', {
          name: 'Receba novidades do mercado de trabalho',
        })
        .boundingBox();
      expect(recentBox).not.toBeNull();
      expect(newsletterBox).not.toBeNull();
      if (!recentBox || !newsletterBox) {
        throw new Error('Não foi possível medir os painéis mobile do blog.');
      }
      expect(newsletterBox.y).toBeGreaterThan(
        recentBox.y + recentBox.height - 2,
      );
    } else {
      expect(featuredTitleBox.x).toBeGreaterThan(
        featuredImageBox.x + featuredImageBox.width - 4,
      );
      expect(
        Math.abs(firstRecentBox.y - secondRecentBox.y),
      ).toBeLessThanOrEqual(2);
    }

    const metrics = await collectVisibleUiMetrics(page);
    expect(metrics.horizontalOverflow).toBeLessThanOrEqual(0);
    expect(metrics.smallText).toEqual([]);
    expect(metrics.shortTargets).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(await collectWcagViolations(page)).toEqual([]);
  });

  test('/blog mantém pesquisa e categorias funcionais', async ({ page }) => {
    await page.goto('/blog', { waitUntil: 'domcontentloaded' });
    const main = page.getByRole('main');
    const articleTitles = await main
      .locator('article h2, article h3')
      .allTextContents();
    const targetTitle =
      articleTitles.find((title) => /[^\u0000-\u007f]/.test(title)) ??
      articleTitles[0];
    if (!targetTitle) {
      throw new Error('O blog não contém um título para testar a pesquisa.');
    }
    const accentedWord =
      targetTitle.split(/\s+/).find((word) => /[^\u0000-\u007f]/.test(word)) ??
      targetTitle;
    const accentlessQuery = accentedWord
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    const marketCategory = main
      .getByRole('button', { name: 'Mercado' })
      .first();
    await marketCategory.click();
    await expect(marketCategory).toHaveAttribute('aria-pressed', 'true');
    await main.getByRole('button', { name: 'Todos' }).first().click();

    await main.getByRole('button', { name: 'Pesquisar artigos' }).click();
    const search = main.getByLabel('Pesquisar artigos do blog');
    await expect(search).toBeFocused();
    await search.fill(accentlessQuery);
    await expect(
      main.getByRole('heading', { name: targetTitle }),
    ).toBeVisible();

    await search.fill('conteúdo que não existe');
    await expect(
      main.getByRole('heading', { name: 'Nenhum artigo encontrado' }),
    ).toBeVisible();

    await search.fill('');
    await expect(
      main.getByRole('heading', { name: targetTitle }),
    ).toBeVisible();
  });

  test('/blog mantém a subscrição real com feedback acessível', async ({
    page,
  }) => {
    let submittedPayload: unknown = null;
    await page.route('**/api/newsletter/subscribe', async (route) => {
      submittedPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Subscrição confirmada. Obrigado.' }),
      });
    });

    await page.goto('/blog', { waitUntil: 'domcontentloaded' });
    const email = page.getByLabel('Email para subscrever a newsletter');
    const submit = page.getByRole('button', { name: 'Subscrever' });

    await email.fill('email@invalido');
    await submit.click();
    await expect(
      page.getByRole('status').filter({
        hasText: 'Introduza um email válido.',
      }),
    ).toBeVisible();

    await email.fill('profissional@exemplo.st');
    await submit.click();
    await expect(
      page.getByRole('status').filter({
        hasText: 'Subscrição confirmada. Obrigado.',
      }),
    ).toBeVisible();
    await expect(email).toHaveValue('');
    expect(submittedPayload).toEqual({
      email: 'profissional@exemplo.st',
      source: 'blog',
    });
  });
});
