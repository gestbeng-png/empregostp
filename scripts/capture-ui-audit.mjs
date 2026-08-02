import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const route = process.env.AUDIT_ROUTE;
const slug = process.env.AUDIT_SLUG;
const phase = process.env.AUDIT_PHASE || 'before';
const baseUrl = process.env.AUDIT_BASE_URL || 'http://localhost:3000';

if (!route || !slug) {
  throw new Error('Defina AUDIT_ROUTE e AUDIT_SLUG.');
}

const defaultViewports = [
  { width: 320, height: 800 },
  { width: 768, height: 900 },
  { width: 1024, height: 900 },
  { width: 1440, height: 1000 },
];
const requestedWidths = String(process.env.AUDIT_WIDTHS || '')
  .split(',')
  .map((value) => Number.parseInt(value.trim(), 10))
  .filter(Number.isFinite);
const viewports = requestedWidths.length
  ? defaultViewports.filter((viewport) =>
      requestedWidths.includes(viewport.width),
    )
  : defaultViewports;

if (!viewports.length) {
  throw new Error(
    'AUDIT_WIDTHS deve conter uma ou mais larguras suportadas: 320, 768, 1024, 1440.',
  );
}

const screenshotDirectory = path.join(
  process.cwd(),
  'docs',
  'audits',
  'screenshots',
  phase,
);
const dataDirectory = path.join(process.cwd(), 'docs', 'audits', 'data', phase);

await mkdir(screenshotDirectory, { recursive: true });
await mkdir(dataDirectory, { recursive: true });

const browser = await chromium.launch();
const results = [];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      reducedMotion: 'reduce',
      viewport,
    });
    const page = await context.newPage();
    const errors = [];

    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    const response = await page.goto(`${baseUrl}${route}`, {
      waitUntil: 'domcontentloaded',
    });
    await page
      .waitForLoadState('networkidle', { timeout: 8_000 })
      .catch(() => {});

    const metrics = await page.evaluate(() => {
      const visible = (element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden'
        );
      };
      const ownText = (element) =>
        Array.from(element.childNodes).some(
          (node) => node.nodeType === 3 && (node.textContent || '').trim(),
        );
      const text = (element) =>
        (element.textContent || '').replace(/\s+/g, ' ').trim();
      const ids = Array.from(document.querySelectorAll('[id]'))
        .map((element) => element.id)
        .filter(Boolean);

      const smallText = Array.from(document.querySelectorAll('body *'))
        .filter(
          (element) =>
            visible(element) &&
            ownText(element) &&
            Number.parseFloat(getComputedStyle(element).fontSize) < 14,
        )
        .map((element) => ({
          size: getComputedStyle(element).fontSize,
          tag: element.tagName,
          text: text(element).slice(0, 100),
        }));

      const targetRect = (element) => {
        if (
          element instanceof HTMLInputElement &&
          (element.type === 'checkbox' || element.type === 'radio')
        ) {
          const label =
            element.closest('label') ||
            (element.id
              ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`)
              : null);
          if (label) return label.getBoundingClientRect();
        }

        return element.getBoundingClientRect();
      };

      const shortTargets = Array.from(
        document.querySelectorAll('a,button,input,select,textarea'),
      )
        .filter((element) => {
          if (!visible(element)) return false;
          const rect = targetRect(element);
          return rect.width < 44 || rect.height < 44;
        })
        .map((element) => {
          const rect = targetRect(element);
          return {
            height: Math.round(rect.height),
            tag: element.tagName,
            text: text(element).slice(0, 80),
            width: Math.round(rect.width),
          };
        });

      return {
        document: {
          clientWidth: document.documentElement.clientWidth,
          scrollHeight: document.documentElement.scrollHeight,
          scrollWidth: document.documentElement.scrollWidth,
        },
        duplicateIds: Array.from(
          new Set(ids.filter((id, index) => ids.indexOf(id) !== index)),
        ),
        headingOneCount: document.querySelectorAll('h1').length,
        horizontalOverflow:
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
        landmarks: {
          footer: document.querySelectorAll('footer').length,
          main: document.querySelectorAll('main').length,
          nav: document.querySelectorAll('nav').length,
        },
        shortTargets,
        smallText,
        unlabeledFields: Array.from(
          document.querySelectorAll('input,select,textarea'),
        ).filter(
          (element) =>
            !element.labels?.length &&
            !element.getAttribute('aria-label') &&
            !element.getAttribute('aria-labelledby'),
        ).length,
      };
    });

    const accessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    await page.screenshot({
      animations: 'disabled',
      fullPage: true,
      path: path.join(screenshotDirectory, `${slug}-${viewport.width}.png`),
      style: 'nextjs-portal { display: none !important; }',
    });

    results.push({
      accessibilityViolations: accessibility.violations.map((violation) => ({
        help: violation.help,
        id: violation.id,
        impact: violation.impact,
        targets: violation.nodes.map((node) => node.target),
      })),
      errors,
      metrics,
      status: response?.status() ?? null,
      url: page.url(),
      viewport,
    });

    await context.close();
  }
} finally {
  await browser.close();
}

await writeFile(
  path.join(dataDirectory, `${slug}.json`),
  `${JSON.stringify({ baseUrl, phase, results, route, slug }, null, 2)}\n`,
);

process.stdout.write(
  `${slug}: ${results.length} breakpoints capturados em ${phase}.\n`,
);
