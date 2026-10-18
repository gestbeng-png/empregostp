import { readFile } from 'node:fs/promises';

const base = new URL(process.env.V2_AUDIT_BASE_URL || 'http://127.0.0.1:3000');
if (['empregostp.com', 'www.empregostp.com'].includes(base.hostname)) {
  throw new Error(
    'Use staging ou localhost; detalhe de vaga pode alterar dados em produção.',
  );
}
if (
  !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname) &&
  process.env.V2_AUDIT_ENVIRONMENT !== 'staging'
) {
  throw new Error(
    'Para um host remoto, confirme V2_AUDIT_ENVIRONMENT=staging.',
  );
}
const inventory = JSON.parse(
  await readFile('docs/v2/source-inventory.json', 'utf8'),
);
const supplied = process.env.V2_AUDIT_URLS_FILE
  ? JSON.parse(await readFile(process.env.V2_AUDIT_URLS_FILE, 'utf8'))
  : [];
const defaults = inventory.routes
  .filter((r) => !r.api && !r.dynamic && r.role === 'público/condicional')
  .map((r) => r.route);
const routes = [...new Set([...defaults, ...supplied])];
let failures = 0;
for (const route of routes) {
  if (
    typeof route !== 'string' ||
    !route.startsWith('/') ||
    route.startsWith('//') ||
    route.includes('?') ||
    route.startsWith('/api/') ||
    route.startsWith('/setup/')
  )
    throw new Error('Use apenas caminhos de páginas sem query string.');
  let current = new URL(route, base);
  let result;
  try {
    const redirectStatuses = [];
    for (let hop = 0; hop <= 5; hop++) {
      if (current.origin !== base.origin)
        throw new Error('Redirect externo não permitido.');
      const response = await fetch(current, {
        redirect: 'manual',
        signal: AbortSignal.timeout(10000),
      });
      await response.body?.cancel();
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        redirectStatuses.push(response.status);
        const location = response.headers.get('location');
        if (!location) throw new Error('Redirect sem destino.');
        current = new URL(location, current);
        continue;
      }
      const ok =
        response.status === 200 &&
        redirectStatuses.every((status) => status === 301);
      result = {
        route,
        status: response.status,
        redirects: redirectStatuses,
        ok,
      };
      break;
    }
    if (!result) throw new Error('Demasiados redirects.');
  } catch {
    result = { route, ok: false, error: 'ligação falhou ou redirect inválido' };
  }
  if (!result.ok) failures++;
  process.stdout.write(JSON.stringify(result) + '\n');
}
process.stdout.write(
  JSON.stringify({
    checked: routes.length,
    failures,
    dynamicRoutesPending: inventory.routes.filter((r) => r.dynamic && !r.api)
      .length,
  }) + '\n',
);
process.exitCode = failures ? 1 : 0;
