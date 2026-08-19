import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { monitorPageErrors } from './ui-audit';

const footerGroups = [
  {
    name: 'Links de Candidatos',
    links: [
      ['Encontrar vagas', '/vagas'],
      ['Criar currículo', '/recursos/gerador-cv'],
      ['Dicas de carreira', '/blog'],
    ],
  },
  {
    name: 'Links de Empresas',
    links: [
      ['Publicar vagas', '/dashboard/empresa/vaga/criar-vaga'],
      ['Procurar candidatos', '/#candidatos-verificados'],
      ['Recursos', '/recursos'],
    ],
  },
  {
    name: 'Links de Plataforma',
    links: [
      ['Sobre nós', '/sobre-nos'],
      ['Blog', '/blog'],
      ['Contactos', '/contacto'],
      ['Privacidade', '/politica-privacidade'],
    ],
  },
] as const;

test.describe('footer público', () => {
  test('mantém navegação, composição premium e acessibilidade', async ({
    page,
  }, testInfo) => {
    const pageErrors = monitorPageErrors(page);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    const response = await page.goto('/termos', {
      waitUntil: 'domcontentloaded',
    });

    expect(response?.ok()).toBe(true);
    const footer = page.getByRole('contentinfo');
    await expect(footer).toHaveCount(1);
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeVisible();
    await expect(
      footer.getByText('São Tomé e Príncipe · Linha do Equador', {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      footer.getByText('Talento local. Impacto global.', { exact: true }),
    ).toBeVisible();

    expect(
      await page.evaluate(() => {
        const main = document.querySelector('main');
        const contentInfo = document.querySelector('footer');
        return Boolean(
          main &&
          contentInfo &&
          main.compareDocumentPosition(contentInfo) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        );
      }),
    ).toBe(true);

    const logo = footer.getByRole('img', { name: 'EmpregoSTP' });
    await expect(logo).toBeVisible();
    await expect
      .poll(() =>
        logo.evaluate((image: HTMLImageElement) => image.naturalWidth),
      )
      .toBeGreaterThan(0);

    for (const group of footerGroups) {
      const navigation = footer.getByRole('navigation', { name: group.name });
      await expect(navigation).toBeVisible();
      for (const [label, href] of group.links) {
        await expect(
          navigation.getByRole('link', { name: label, exact: true }),
        ).toHaveAttribute('href', href);
      }
    }

    const contacts = footer.getByRole('navigation', { name: 'Contactos' });
    await expect(
      contacts.getByRole('link', { name: '+239 986 9673', exact: true }),
    ).toHaveAttribute('href', 'tel:+2399869673');
    await expect(
      contacts.getByRole('link', {
        name: 'suporte@empregos.st',
        exact: true,
      }),
    ).toHaveAttribute('href', 'mailto:suporte@empregos.st');

    await expect(
      footer.getByRole('link', { name: 'Privacidade', exact: true }).last(),
    ).toHaveAttribute('href', '/politica-privacidade');
    await expect(
      footer.getByRole('link', { name: 'Termos', exact: true }),
    ).toHaveAttribute('href', '/termos');
    await expect(
      footer.getByRole('link', { name: 'Cookies', exact: true }),
    ).toHaveAttribute('href', '/cookies');

    const layout = await footer.evaluate((element) => {
      const footerRect = element.getBoundingClientRect();
      const targets = [
        ...element.querySelectorAll<HTMLElement>('a[href]'),
      ].filter((target) => {
        const style = window.getComputedStyle(target);
        const rect = target.getBoundingClientRect();
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          rect.width > 0 &&
          rect.height > 0
        );
      });
      const targetRects = targets.map((target) => {
        const rect = target.getBoundingClientRect();
        return {
          height: rect.height,
          label: (target.textContent || target.getAttribute('aria-label') || '')
            .trim()
            .slice(0, 80),
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
        };
      });
      const collisions: string[] = [];

      for (let index = 0; index < targetRects.length; index += 1) {
        const current = targetRects[index];
        if (!current) continue;
        for (
          let peerIndex = index + 1;
          peerIndex < targetRects.length;
          peerIndex += 1
        ) {
          const peer = targetRects[peerIndex];
          if (!peer) continue;
          const overlapX =
            Math.min(current.right, peer.right) -
            Math.max(current.left, peer.left);
          const overlapY =
            Math.min(current.bottom, peer.bottom) -
            Math.max(current.top, peer.top);
          if (overlapX > 1 && overlapY > 1) {
            collisions.push(`${current.label} / ${peer.label}`);
          }
        }
      }

      return {
        clippedTargets: targetRects
          .filter(
            (rect) =>
              rect.left < footerRect.left - 1 ||
              rect.right > footerRect.right + 1 ||
              rect.top < footerRect.top - 1 ||
              rect.bottom > footerRect.bottom + 1,
          )
          .map((rect) => rect.label),
        collisions,
        horizontalOverflow:
          document.documentElement.scrollWidth - window.innerWidth,
        invalidLinks: targets
          .filter((target) => {
            const href = target.getAttribute('href')?.trim() || '';
            return !href || href === '#' || href.startsWith('javascript:');
          })
          .map((target) => target.textContent?.trim() || ''),
        shortTargets: targetRects
          .filter((rect) => rect.width < 44 || rect.height < 44)
          .map((rect) => rect.label),
      };
    });

    expect(layout.horizontalOverflow).toBeLessThanOrEqual(0);
    expect(layout.invalidLinks).toEqual([]);
    expect(layout.shortTargets).toEqual([]);
    expect(layout.clippedTargets).toEqual([]);
    expect(layout.collisions).toEqual([]);

    const candidateNav = footer.getByRole('navigation', {
      name: 'Links de Candidatos',
    });
    const companyNav = footer.getByRole('navigation', {
      name: 'Links de Empresas',
    });
    const platformNav = footer.getByRole('navigation', {
      name: 'Links de Plataforma',
    });
    const [candidateBox, companyBox, platformBox, contactBox] =
      await Promise.all([
        candidateNav.boundingBox(),
        companyNav.boundingBox(),
        platformNav.boundingBox(),
        contacts.boundingBox(),
      ]);
    expect(candidateBox).not.toBeNull();
    expect(companyBox).not.toBeNull();
    expect(platformBox).not.toBeNull();
    expect(contactBox).not.toBeNull();
    if (!candidateBox || !companyBox || !platformBox || !contactBox) {
      throw new Error('Não foi possível medir a composição do footer.');
    }

    if (testInfo.project.name === 'mobile-chromium') {
      expect(companyBox.y).toBeGreaterThan(candidateBox.y);
      expect(platformBox.y).toBeGreaterThan(companyBox.y);
      expect(contactBox.y).toBeGreaterThan(platformBox.y);
      expect(Math.abs(candidateBox.x - companyBox.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(companyBox.x - platformBox.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(platformBox.x - contactBox.x)).toBeLessThanOrEqual(1);
    } else {
      expect(Math.abs(candidateBox.y - companyBox.y)).toBeLessThanOrEqual(3);
      expect(Math.abs(companyBox.y - platformBox.y)).toBeLessThanOrEqual(3);
      expect(Math.abs(platformBox.y - contactBox.y)).toBeLessThanOrEqual(3);
      expect(candidateBox.x).toBeLessThan(companyBox.x);
      expect(companyBox.x).toBeLessThan(platformBox.x);
      expect(platformBox.x).toBeLessThan(contactBox.x);
    }

    const firstFooterLink = footer.getByRole('link', { name: 'EmpregoSTP' });
    await firstFooterLink.focus();
    const focusStyle = await firstFooterLink.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: Number.parseFloat(style.outlineWidth),
      };
    });
    expect(focusStyle.outlineStyle).not.toBe('none');
    expect(focusStyle.outlineWidth).toBeGreaterThanOrEqual(2);

    const accessibility = await new AxeBuilder({ page })
      .include('footer')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
