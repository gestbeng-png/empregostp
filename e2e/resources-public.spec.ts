import { expect, test } from '@playwright/test';

import {
  collectVisibleUiMetrics,
  collectWcagViolations,
  monitorPageErrors,
} from './ui-audit';

test.describe('centro público de recursos', () => {
  test('/recursos reproduz a biblioteca compacta com FAQ acessível', async ({
    page,
  }, testInfo) => {
    const pageErrors = monitorPageErrors(page);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    const response = await page.goto('/recursos', {
      waitUntil: 'networkidle',
    });

    expect(response?.ok()).toBe(true);
    const main = page.getByRole('main');
    await expect(main).toHaveCount(1);
    await expect(
      main.getByRole('heading', {
        level: 1,
        name: 'Recursos gratuitos para a sua carreira',
      }),
    ).toHaveCount(1);
    await expect(
      main.getByRole('group', { name: 'Filtrar recursos por público' }),
    ).toBeVisible();
    await expect(
      main.getByRole('heading', { level: 2, name: 'Modelos e documentos' }),
    ).toBeVisible();
    await expect(
      main.getByRole('button', { name: 'Modelos anteriores' }),
    ).toBeVisible();
    await expect(
      main.getByRole('button', { name: 'Modelos seguintes' }),
    ).toBeVisible();

    for (const sectionId of ['#modelos', '#guias', '#servicos', '#faq']) {
      await expect(page.locator(sectionId)).toBeVisible();
    }

    const layout = await page.evaluate(() => {
      const rects = (selector: string, limit: number) =>
        [...document.querySelectorAll<HTMLElement>(selector)]
          .slice(0, limit)
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              height: Math.round(rect.height),
              top: Math.round(rect.top + window.scrollY),
              width: Math.round(rect.width),
            };
          });

      return {
        faqHeadings: [...document.querySelectorAll<HTMLElement>('#faq h2')].map(
          (heading) =>
            Math.round(heading.getBoundingClientRect().top + window.scrollY),
        ),
        guides: rects('#guias article', 2),
        models: rects('#modelos article', 3),
        tools: rects('#servicos article', 3),
      };
    });

    if (testInfo.project.name === 'chromium') {
      expect(new Set(layout.models.map((rect) => rect.top)).size).toBe(1);
      expect(new Set(layout.guides.map((rect) => rect.top)).size).toBe(1);
      expect(new Set(layout.tools.map((rect) => rect.top)).size).toBe(1);
      expect(new Set(layout.faqHeadings).size).toBe(1);
    } else {
      expect(layout.models[0]?.width).toBeGreaterThan(280);
      expect(new Set(layout.guides.map((rect) => rect.top)).size).toBe(2);
      expect(new Set(layout.tools.map((rect) => rect.top)).size).toBe(3);
      expect(new Set(layout.faqHeadings).size).toBe(2);
    }

    const faqSection = page.locator('#faq');
    const faqButton = faqSection.getByRole('button').first();
    const faqName = (await faqButton.innerText()).trim();
    await expect(faqButton).toHaveAttribute('aria-expanded', 'false');
    await faqButton.click();
    await expect(faqButton).toHaveAttribute('aria-expanded', 'true');
    const faqRegion = faqSection.getByRole('region', { name: faqName });
    await expect(faqRegion).toBeVisible();

    await expect(
      page.getByRole('link', { name: 'suporte@empregos.st', exact: true }),
    ).toHaveAttribute('href', 'mailto:suporte@empregos.st');
    await expect(
      page.getByRole('link', { name: '+239 986 9673', exact: true }),
    ).toHaveAttribute('href', 'tel:+2399869673');

    const metrics = await collectVisibleUiMetrics(page);
    expect(metrics.horizontalOverflow).toBeLessThanOrEqual(0);
    expect(metrics.smallText).toEqual([]);
    expect(metrics.shortTargets).toEqual([]);
    expect(await collectWcagViolations(page)).toEqual([]);

    await faqButton.click();
    await expect(faqButton).toHaveAttribute('aria-expanded', 'false');
    await expect(faqRegion).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test('trocar de público repõe a categoria Todos e atualiza os modelos', async ({
    page,
  }) => {
    await page.goto('/recursos', { waitUntil: 'networkidle' });

    const candidates = page.getByRole('button', {
      name: 'Candidatos',
      exact: true,
    });
    const companies = page.getByRole('button', {
      name: 'Empresas',
      exact: true,
    });

    await candidates.click();
    await page
      .getByRole('button', { name: 'Pesquisar recursos', exact: true })
      .click();

    const category = page.getByLabel('Filtrar modelos por categoria');
    await category.selectOption('CV');

    await expect(candidates).toHaveAttribute('aria-pressed', 'true');
    await expect(category).toHaveValue('CV');
    await expect(
      page.getByRole('heading', {
        level: 3,
        name: 'Curriculo Classico',
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', {
        level: 3,
        name: 'Modelo de Descricao de Vaga',
      }),
    ).toHaveCount(0);

    await companies.click();

    await expect(companies).toHaveAttribute('aria-pressed', 'true');
    await expect(candidates).toHaveAttribute('aria-pressed', 'false');
    await expect(category).toHaveValue('todos');
    await expect(
      page.getByRole('heading', {
        level: 3,
        name: 'Modelo de Descricao de Vaga',
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', {
        level: 3,
        name: 'Curriculo Classico',
      }),
    ).toHaveCount(0);
  });

  test('a pesquisa ignora acentos e apresenta estados vazios claros', async ({
    page,
  }) => {
    await page.goto('/recursos', { waitUntil: 'networkidle' });

    await page
      .getByRole('button', { name: 'Pesquisar recursos', exact: true })
      .click();
    const search = page.getByLabel('Pesquisar recursos');
    const guides = page.locator('#guias');

    await search.fill('negociacao');

    await expect(guides.getByRole('heading', { level: 3 })).toHaveCount(1);
    await expect(
      guides.getByRole('heading', {
        level: 3,
        name: /Guia de Negocia.* Salarial/i,
      }),
    ).toBeVisible();

    await search.fill('recurso que não existe');
    await expect(
      page.getByText('Nenhum modelo corresponde a “recurso que não existe”.'),
    ).toBeVisible();

    await search.fill('');
    await expect(
      guides.getByRole('heading', {
        level: 3,
        name: /Guia de Entrevista para Candidatos/i,
      }),
    ).toBeVisible();
  });
});
