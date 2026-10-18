import fs from 'node:fs';
import path from 'node:path';

import baseline from './css-color-baseline.json';

/**
 * C4 — catraca de cores literais.
 *
 * O CSS existente tem milhares de cores literais (DESIGN_INVENTORY.md) e não
 * é reescrito em massa. Esta guarda impede que o número cresça: um ficheiro
 * não pode ganhar cores literais e um ficheiro CSS novo não pode ter nenhuma —
 * cores novas vêm dos tokens (`var(--...)`) de styles/globals.css.
 *
 * Alteração visual intencional: justificar no PR e regenerar a baseline com
 * `node scripts/quality/css-color-baseline.mjs --write`.
 */

const TOKEN_FILES = new Set([
  'styles/globals.css',
  'styles/workbridge-theme.css',
  'styles/dashboard-shell.css',
]);
const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/g;
const allowed = baseline as Record<string, number>;

function listCssFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) return listCssFiles(full);
    return entry.name.endsWith('.css') ? [full] : [];
  });
}

const cssFiles = listCssFiles('styles').filter(
  (file) => !TOKEN_FILES.has(file),
);

describe('cores literais no CSS (C4)', () => {
  it('encontra os ficheiros CSS', () => {
    expect(cssFiles.length).toBeGreaterThan(20);
  });

  it('nenhum ficheiro ganha cores literais além da baseline', () => {
    const regressions = cssFiles
      .map((file) => {
        const count = (fs.readFileSync(file, 'utf8').match(COLOR_LITERAL) || [])
          .length;
        const limit = allowed[file] ?? 0;
        return count > limit ? `${file}: ${count} (máximo ${limit})` : null;
      })
      .filter(Boolean);

    expect(regressions).toEqual([]);
  });
});
