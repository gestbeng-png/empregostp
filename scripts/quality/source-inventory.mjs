import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const output = path.join(root, 'docs/audits');
async function walk(directory) {
  const entries = await readdir(path.join(root, directory), {
    withFileTypes: true,
  });
  const result = await Promise.all(
    entries.map(async (entry) => {
      const name = `${directory}/${entry.name}`;
      return entry.isDirectory() ? walk(name) : [name];
    }),
  );
  return result.flat().sort();
}
const cell = (value) =>
  String(value).replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
const files = (
  await Promise.all(
    [
      'pages',
      'components',
      'lib',
      'domain',
      'application',
      'infrastructure',
      'presentation',
      'styles',
      'shared',
    ].map(walk),
  )
).flat();
const sources = new Map();
for (const file of files.filter((file) => /\.(?:[jt]sx?|css)$/.test(file))) {
  sources.set(file, await readFile(path.join(root, file), 'utf8'));
}
const routes = [];
for (const [file, source] of sources) {
  if (
    !file.startsWith('pages/') ||
    !/\.[jt]sx?$/.test(file) ||
    /^pages\/_/.test(file)
  )
    continue;
  const route =
    '/' +
    file
      .replace(/^pages\//, '')
      .replace(/\.[jt]sx?$/, '')
      .replace(/(^|\/)index$/, '')
      .replace(/\/$/, '');
  const api = route.startsWith('/api/');
  const role = api
    ? 'API: autorização individual'
    : route.startsWith('/dashboard/admin')
      ? 'ADMIN'
      : route.startsWith('/dashboard/empresa')
        ? 'empresa'
        : route.startsWith('/dashboard/candidato') || route === '/profile'
          ? 'candidato'
          : route === '/dashboard'
            ? 'autenticado'
            : route === '/setup/seed'
              ? 'restrita: setup'
              : 'público/condicional';
  const rendering = api
    ? 'API'
    : /getServerSideProps/.test(source)
      ? 'SSR'
      : /getStaticProps/.test(source)
        ? 'SSG/ISR'
        : 'sem SSR de dados; confirmar CSR';
  const authSignals = [
    ...new Set(
      source.match(
        /requireAdminPageAuth|requireActiveApiUser|requireCompanyPageAuth|verifyIdToken|verifySessionCookie|requireCandidatePageAuth|requireResourcePremiumAccess/g,
      ) || [],
    ),
  ];
  const title = [...source.matchAll(/<title>([\s\S]*?)<\/title>/g)]
    .map((m) => cell(m[1]))
    .join('; ');
  const robots = /name=["']robots["']/.test(source)
    ? 'declarado/condicional'
    : 'não declarado na rota';
  routes.push({
    route,
    file,
    role,
    rendering,
    authSignals,
    title,
    robots,
    dynamic: route.includes('['),
    api,
    verified: false,
  });
}
await mkdir(output, { recursive: true });
const branch = execFileSync('git', ['branch', '--show-current'], {
  encoding: 'utf8',
}).trim();
const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
  encoding: 'utf8',
}).trim();
const inventory = {
  generatedAt: new Date().toISOString(),
  branch,
  commit,
  sourceFilesScanned: sources.size,
  routes,
  collections: [
    ...new Set(
      [...sources.values()].flatMap((source) =>
        [...source.matchAll(/\.collection\(['"]([^'"]+)['"]\)/g)].map(
          (m) => m[1],
        ),
      ),
    ),
  ].sort(),
  tokens: [...sources]
    .filter(([file]) => file.endsWith('.css'))
    .flatMap(([file, source]) =>
      [...source.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)].map((m) => ({
        file,
        name: m[1],
        value: m[2].trim(),
      })),
    ),
  componentFiles: files.filter(
    (file) => file.startsWith('components/') && /\.[jt]sx?$/.test(file),
  ),
};
await writeFile(
  path.join(output, 'source-inventory.json'),
  JSON.stringify(inventory, null, 2) + '\n',
);
await writeFile(
  path.join(output, 'ROUTE_INVENTORY.md'),
  `# Inventário de rotas\n\nGerado a partir do código em ${commit.slice(0, 7)}. Branch: ${branch}.\n\n${routes.filter((r) => !r.api).length} páginas; ${routes.filter((r) => r.api).length} APIs. Estado HTTP, tráfego e indexação efetiva ainda por medir. Sinais de autenticação são evidência textual, não prova de autorização. Rotas dinâmicas exigem IDs semeados em staging.\n\n| Rota | Fonte | Role previsto | Renderização | Auth no código | SEO / título | Estado HTTP |\n|---|---|---|---|---|---|---|\n` +
    routes
      .map(
        (r) =>
          `| ${cell(r.route)} | ${r.file} | ${r.role} | ${r.rendering} | ${r.authSignals.join(', ') || 'revisão manual necessária'} | ${cell(r.title || r.robots)} | não verificado |`,
      )
      .join('\n') +
    '\n',
);
process.stdout.write(
  JSON.stringify({
    sourceFilesScanned: sources.size,
    pages: routes.filter((r) => !r.api).length,
    apis: routes.filter((r) => r.api).length,
    collections: inventory.collections.length,
  }) + '\n',
);
