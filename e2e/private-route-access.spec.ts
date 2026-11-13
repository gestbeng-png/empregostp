import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

function pageFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory()
      ? pageFiles(file)
      : /\.[jt]sx?$/.test(file)
        ? [file]
        : [];
  });
}

const privateRoutes = pageFiles('pages/dashboard').map(
  (file) =>
    '/' +
    file
      .replace(/^pages\//, '')
      .replace(/\.[jt]sx?$/, '')
      .replace(/(^|\/)index$/, '')
      .replace(/\/$/, '')
      .replace(/\[[^\]]+\]/g, 'audit-missing-record'),
);

test.describe('proteção de todas as páginas do dashboard', () => {
  for (const route of privateRoutes) {
    test(`${route} exige sessão antes de mostrar dados`, async ({
      request,
    }) => {
      const response = await request.get(route, { maxRedirects: 0 });
      expect([307, 308]).toContain(response.status());
      const redirect = new URL(response.headers().location || '', 'http://localhost');
      if (route === '/dashboard/candidato/vaga') {
        expect(redirect.pathname).toBe('/dashboard/candidato');
      } else {
        expect(redirect.pathname).toBe('/login');
      }
    });
  }
});
