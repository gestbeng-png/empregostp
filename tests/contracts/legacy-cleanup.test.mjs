import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const root = fileURLToPath(new URL('../../', import.meta.url));
const dirs = [
  'pages',
  'components',
  'context',
  'hooks',
  'lib',
  'domain',
  'application',
  'infrastructure',
  'presentation',
  'shared',
];
function files(dir) {
  return fs
    .readdirSync(path.join(root, dir), { withFileTypes: true })
    .flatMap((entry) => {
      const file = path.posix.join(dir, entry.name);
      return entry.isDirectory() ? files(file) : [file];
    });
}
const sources = dirs
  .flatMap(files)
  .filter((file) => /\.(js|jsx|ts|tsx|mjs)$/.test(file));
const extensions = [
  '',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '/index.js',
  '/index.ts',
  '/index.tsx',
];

test('retired handlers and the paid-application module cannot be reintroduced', () => {
  for (const file of [
    'pages/api/admin/migrate-verifications.js',
    'pages/api/notify-candidates.js',
    'lib/candidateApplicationPremium.js',
  ])
    assert.equal(fs.existsSync(path.join(root, file)), false, file);
  assert.ok(fs.existsSync(path.join(root, 'lib/applicationPolicy.js')));
});

test('all current source imports resolve after cleanup, including lazy imports and require', () => {
  const unresolved = [];
  for (const file of sources) {
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(path.join(root, file), 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('x')
        ? ts.ScriptKind.TSX
        : file.endsWith('.ts')
          ? ts.ScriptKind.TS
          : ts.ScriptKind.JSX,
    );
    function check(spec) {
      if (!spec.startsWith('.') && !spec.startsWith('@/')) return;
      const base = spec.startsWith('@/')
        ? spec.slice(2)
        : path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
      if (
        !extensions.some((extension) =>
          fs.existsSync(path.join(root, base + extension)),
        )
      )
        unresolved.push({ file, spec });
    }
    function visit(node) {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      )
        check(node.moduleSpecifier.text);
      if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) &&
            node.expression.text === 'require'))
      ) {
        const spec = node.arguments[0];
        if (spec && ts.isStringLiteral(spec)) check(spec.text);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  assert.deepEqual(unresolved, []);
});

test('active callers contain no retired endpoint or module names', () => {
  const offenders = sources.filter((file) =>
    /\/api\/notify-candidates|\/api\/admin\/migrate-verifications|candidateApplicationPremium/.test(
      fs.readFileSync(path.join(root, file), 'utf8'),
    ),
  );
  assert.deepEqual(offenders, []);
});

test('obsolete paid application limits and restrictions are absent from the submission endpoint', () => {
  const source = fs.readFileSync(
    path.join(root, 'pages/api/applications/index.js'),
    'utf8',
  );
  for (const code of [
    'APPLICATION_LIMIT_REACHED',
    'PREMIUM_JOB_RESTRICTED',
    'EARLY_ACCESS_RESTRICTED',
    'FEATURED_JOB_RESTRICTED',
    'PREMIUM_APPLICATION_TOOLS_ONLY',
  ])
    assert.ok(!source.includes(code), code);
  for (const guard of [
    'requireActiveApiUser',
    'validateApplicationForm',
    'runTransaction',
    'APPLICATION_ALREADY_EXISTS',
  ])
    assert.ok(source.includes(guard), guard);
});

test('data adapters and rollback/rollout guards remain until an explicitly verified migration', () => {
  for (const file of [
    'domain/jobs/legacyView.ts',
    'domain/lifecycle/legacyStatus.ts',
    'domain/applications/legacyAts.ts',
    'domain/permissions/legacyRole.ts',
    'infrastructure/firebase/marketplace/FirestoreFeatureFlags.ts',
  ])
    assert.ok(fs.existsSync(path.join(root, file)), file);
});
