import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

export const BUNDLE_METHOD = 'build-manifest-modern-initial-v1';
export const PUBLIC_BUNDLE_ROUTES = ['/', '/vagas', '/vaga/[id]'];
export const PUBLIC_BUNDLE_LIMIT_BYTES = 170_000;

export function initialJavascriptFiles(manifest, route) {
  if (
    !Array.isArray(manifest.pages?.[route]) ||
    !Array.isArray(manifest.pages?.['/_app'])
  )
    throw new Error(`MISSING_ROUTE:${route}`);
  // Modern browsers do not download nomodule polyfills. Report only the
  // eagerly referenced route/shared chunks plus Next's small manifests.
  return [
    ...new Set([
      ...manifest.pages['/_app'],
      ...manifest.pages[route],
      ...(manifest.lowPriorityFiles || []),
    ]),
  ].filter((file) => file.endsWith('.js'));
}

export function bundleRegressions(report, baseline) {
  if (baseline && baseline.method !== BUNDLE_METHOD)
    throw new Error('INCOMPATIBLE_BUNDLE_BASELINE');
  return Object.entries(report.routes).flatMap(([route, data]) => {
    const errors = [];
    if (data.gzipBytes > PUBLIC_BUNDLE_LIMIT_BYTES)
      errors.push({
        route,
        code: 'ABSOLUTE_BUDGET_EXCEEDED',
        gzipBytes: data.gzipBytes,
        limitBytes: PUBLIC_BUNDLE_LIMIT_BYTES,
      });
    if (baseline) {
      const old = baseline.routes?.[route]?.gzipBytes;
      if (!Number.isSafeInteger(old) || old <= 0)
        throw new Error(`MISSING_BASELINE_ROUTE:${route}`);
      if (data.gzipBytes > Math.floor(old * 1.1))
        errors.push({
          route,
          code: 'BASELINE_GROWTH_EXCEEDED',
          gzipBytes: data.gzipBytes,
          limitBytes: Math.floor(old * 1.1),
        });
    }
    return errors;
  });
}

export async function measureBundle(directory, routes = PUBLIC_BUNDLE_ROUTES) {
  const manifest = JSON.parse(
    await readFile(path.join(directory, 'build-manifest.json'), 'utf8'),
  );
  const entries = await Promise.all(
    routes.map(async (route) => {
      const files = initialJavascriptFiles(manifest, route);
      const sizes = await Promise.all(
        files.map(async (file) => {
          const resolved = path.resolve(directory, file);
          if (!resolved.startsWith(`${path.resolve(directory)}${path.sep}`))
            throw new Error('INVALID_CHUNK_PATH');
          return gzipSync(await readFile(resolved)).length;
        }),
      );
      return [
        route,
        { gzipBytes: sizes.reduce((sum, size) => sum + size, 0), files },
      ];
    }),
  );
  return {
    method: BUNDLE_METHOD,
    budgetBytes: PUBLIC_BUNDLE_LIMIT_BYTES,
    routes: Object.fromEntries(entries),
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const args = process.argv.slice(2);
  const directory = args[args.indexOf('--dist-dir') + 1];
  if (!args.includes('--dist-dir') || !directory)
    throw new Error('DIST_DIR_REQUIRED');
  const baselinePath = args.includes('--baseline')
    ? args[args.indexOf('--baseline') + 1]
    : null;
  if (args.includes('--baseline') && !baselinePath)
    throw new Error('BASELINE_PATH_REQUIRED');
  const report = await measureBundle(directory);
  const baseline = baselinePath
    ? JSON.parse(await readFile(baselinePath, 'utf8'))
    : undefined;
  const regressions = bundleRegressions(report, baseline);
  process.stdout.write(
    `${JSON.stringify({ ...report, regressions }, null, 2)}\n`,
  );
  if (regressions.length && !args.includes('--report-only'))
    process.exitCode = 1;
}
