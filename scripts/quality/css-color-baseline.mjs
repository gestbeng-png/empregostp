// Gera a baseline de cores literais por ficheiro CSS (C4).
// Uso: node scripts/quality/css-color-baseline.mjs --write
// Só correr depois de uma alteração visual intencional e justificada no PR.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const BASELINE_PATH = 'tests/unit/design/css-color-baseline.json';

// Ficheiros onde os tokens são definidos: podem conter cores literais.
export const TOKEN_FILES = new Set([
  'styles/globals.css',
  'styles/workbridge-theme.css',
  'styles/dashboard-shell.css',
]);

export const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/g;

export async function listCssFiles(directory = 'styles') {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const full = path.posix.join(directory, entry.name);
      if (entry.isDirectory()) return listCssFiles(full);
      return entry.name.endsWith('.css') ? [full] : [];
    }),
  );
  return nested.flat().sort();
}

export async function countColorLiterals() {
  const counts = {};
  for (const file of await listCssFiles()) {
    if (TOKEN_FILES.has(file)) continue;
    const source = await readFile(file, 'utf8');
    counts[file] = (source.match(COLOR_LITERAL) || []).length;
  }
  return counts;
}

if (process.argv.includes('--write')) {
  const counts = await countColorLiterals();
  await writeFile(BASELINE_PATH, `${JSON.stringify(counts, null, 2)}\n`);
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  process.stdout.write(
    `${Object.keys(counts).length} ficheiros, ${total} cores literais.\n`,
  );
}
