import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import type { Result } from 'axe-core';

export function monitorPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

export async function collectVisibleUiMetrics(page: Page): Promise<{
  horizontalOverflow: number;
  shortTargets: string[];
  smallText: string[];
}> {
  return page.evaluate(() => {
    const getText = (element: HTMLElement) =>
      (element.innerText ?? element.textContent ?? '').trim();
    const visibleElements = [
      ...document.querySelectorAll<HTMLElement>('*'),
    ].filter((element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        rect.width > 0 &&
        rect.height > 0
      );
    });

    const smallText = visibleElements
      .filter((element) => getText(element))
      .filter(
        (element) =>
          Number.parseFloat(window.getComputedStyle(element).fontSize) < 14,
      )
      .map((element) => getText(element).slice(0, 80));

    const getTargetRect = (element: HTMLElement): DOMRect => {
      if (
        element instanceof HTMLInputElement &&
        (element.type === 'checkbox' || element.type === 'radio')
      ) {
        const label =
          element.closest('label') ??
          (element.id
            ? document.querySelector<HTMLLabelElement>(
                `label[for="${CSS.escape(element.id)}"]`,
              )
            : null);
        if (label) return label.getBoundingClientRect();
      }

      return element.getBoundingClientRect();
    };

    const shortTargets = visibleElements
      .filter((element) =>
        element.matches('a[href], button, input, select, textarea'),
      )
      .filter((element) => {
        const rect = getTargetRect(element);
        return rect.width < 44 || rect.height < 44;
      })
      .map((element) => getText(element).slice(0, 80));

    return {
      horizontalOverflow:
        document.documentElement.scrollWidth - window.innerWidth,
      shortTargets,
      smallText,
    };
  });
}

export async function collectWcagViolations(page: Page): Promise<Result[]> {
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  return accessibility.violations;
}
