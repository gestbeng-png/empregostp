import { expect, test } from '@playwright/test';

import { e2ePublicJob } from './fixtures';

const jobId = process.env.E2E_PUBLIC_JOB_ID ?? e2ePublicJob.id;
const footerWidths = [
  320, 360, 390, 430, 640, 641, 767, 768, 1023, 1024, 1040, 1041, 1280,
] as const;
const jobDetailWidths = [320, 390, 767, 768, 1023, 1024, 1280] as const;

test.describe('layout responsivo crítico', () => {
  test('footer preserva os dois blocos mobile e a ordem desktop', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'A matriz responsiva é executada uma única vez no Chromium.',
    );

    await page.setViewportSize({ height: 844, width: footerWidths[0] });
    const response = await page.goto('/termos', {
      waitUntil: 'domcontentloaded',
    });
    expect(response?.ok()).toBe(true);

    for (const width of footerWidths) {
      await page.setViewportSize({ height: 844, width });

      const layout = await page.getByRole('contentinfo').evaluate((element) => {
        const blocks = Array.from(
          element.querySelectorAll<HTMLElement>('[data-footer-block]'),
        ).map((block) => {
          const rect = block.getBoundingClientRect();
          return {
            bottom: rect.bottom,
            display: window.getComputedStyle(block).display,
            height: rect.height,
            left: rect.left,
            top: rect.top,
            width: rect.width,
          };
        });
        const groupRect = (label: string) => {
          const group = element.querySelector<HTMLElement>(
            `nav[aria-label="${label}"]`,
          );
          if (!group) return null;
          const rect = group.getBoundingClientRect();
          return { left: rect.left, top: rect.top };
        };

        return {
          blocks,
          candidate: groupRect('Links de Candidatos'),
          company: groupRect('Links de Empresas'),
          contact: groupRect('Contactos'),
          horizontalOverflow:
            document.documentElement.scrollWidth - window.innerWidth,
          platform: groupRect('Links de Plataforma'),
        };
      });

      expect(layout.horizontalOverflow, `${width}px`).toBeLessThanOrEqual(0);
      expect(layout.blocks, `${width}px`).toHaveLength(2);

      if (width <= 640) {
        const [primary, secondary] = layout.blocks;
        expect(primary?.display, `${width}px`).toBe('grid');
        expect(secondary?.display, `${width}px`).toBe('grid');
        expect(primary?.height, `${width}px`).toBeGreaterThan(0);
        expect(secondary?.height, `${width}px`).toBeGreaterThan(0);
        expect(secondary?.top, `${width}px`).toBeGreaterThan(
          primary?.bottom ?? 0,
        );
        expect(
          Math.abs((primary?.left ?? 0) - (secondary?.left ?? 0)),
          `${width}px`,
        ).toBeLessThanOrEqual(1);
        expect(
          Math.abs((primary?.width ?? 0) - (secondary?.width ?? 0)),
          `${width}px`,
        ).toBeLessThanOrEqual(1);
        continue;
      }

      expect(
        layout.blocks.every((block) => block.display === 'contents'),
        `${width}px`,
      ).toBe(true);
      expect(layout.candidate, `${width}px`).not.toBeNull();
      expect(layout.company, `${width}px`).not.toBeNull();
      expect(layout.platform, `${width}px`).not.toBeNull();
      expect(layout.contact, `${width}px`).not.toBeNull();

      if (width <= 1040) {
        expect(
          Math.abs((layout.candidate?.top ?? 0) - (layout.company?.top ?? 0)),
          `${width}px`,
        ).toBeLessThanOrEqual(3);
        expect(
          Math.abs((layout.platform?.top ?? 0) - (layout.contact?.top ?? 0)),
          `${width}px`,
        ).toBeLessThanOrEqual(3);
        expect(layout.platform?.top ?? 0, `${width}px`).toBeGreaterThan(
          layout.candidate?.top ?? 0,
        );
      } else {
        const groups = [
          layout.candidate,
          layout.company,
          layout.platform,
          layout.contact,
        ];
        const tops = groups.map((group) => group?.top ?? 0);
        const lefts = groups.map((group) => group?.left ?? 0);
        expect(
          Math.max(...tops) - Math.min(...tops),
          `${width}px`,
        ).toBeLessThanOrEqual(3);
        expect(lefts, `${width}px`).toEqual([...lefts].sort((a, b) => a - b));
      }
    }
  });

  test('vagas semelhantes são únicas e sucedem todos os detalhes', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'A matriz responsiva é executada uma única vez no Chromium.',
    );

    await page.setViewportSize({ height: 844, width: jobDetailWidths[0] });
    const response = await page.goto(`/vaga/${jobId}`, {
      waitUntil: 'domcontentloaded',
    });
    expect(response?.ok()).toBe(true);

    for (const width of jobDetailWidths) {
      await page.setViewportSize({ height: 844, width });

      const layout = await page.evaluate(() => {
        const relatedHeading = Array.from(
          document.querySelectorAll<HTMLHeadingElement>('main h2'),
        ).find(
          (heading) => heading.textContent?.trim() === 'Vagas semelhantes',
        );
        const relatedSection = relatedHeading?.closest('section');
        const detailsGrid = relatedSection?.previousElementSibling;

        if (!relatedSection || !detailsGrid) {
          return {
            detailsBottom: 0,
            followsDetailsGrid: false,
            horizontalOverflow: 0,
            relatedTop: 0,
            smallText: ['secção ausente'],
            visibleRelatedCount: 0,
          };
        }

        const detailsRect = detailsGrid.getBoundingClientRect();
        const relatedRect = relatedSection.getBoundingClientRect();
        const smallText = Array.from(
          relatedSection.querySelectorAll<HTMLElement>(
            'a, strong, span, small',
          ),
        )
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            return (
              (element.textContent || '').trim() &&
              style.display !== 'none' &&
              rect.height > 0
            );
          })
          .filter(
            (element) =>
              Number.parseFloat(window.getComputedStyle(element).fontSize) < 14,
          )
          .map((element) => (element.textContent || '').trim().slice(0, 60));
        const visibleRelatedCount = Array.from(
          document.querySelectorAll<HTMLElement>('main section'),
        ).filter((section) => {
          const heading = section.querySelector('h2, h3');
          const rect = section.getBoundingClientRect();
          const style = window.getComputedStyle(section);
          return (
            heading?.textContent?.trim() === 'Vagas semelhantes' &&
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            rect.height > 0
          );
        }).length;

        return {
          detailsBottom: detailsRect.bottom + window.scrollY,
          followsDetailsGrid: Boolean(
            detailsGrid.compareDocumentPosition(relatedSection) &
            Node.DOCUMENT_POSITION_FOLLOWING,
          ),
          horizontalOverflow:
            document.documentElement.scrollWidth - window.innerWidth,
          relatedTop: relatedRect.top + window.scrollY,
          smallText,
          visibleRelatedCount,
        };
      });

      expect(layout.visibleRelatedCount, `${width}px`).toBe(1);
      expect(layout.followsDetailsGrid, `${width}px`).toBe(true);
      expect(layout.relatedTop, `${width}px`).toBeGreaterThanOrEqual(
        layout.detailsBottom,
      );
      expect(layout.horizontalOverflow, `${width}px`).toBeLessThanOrEqual(0);
      expect(layout.smallText, `${width}px`).toEqual([]);
    }
  });
});
