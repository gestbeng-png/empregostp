import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import config from '../../next.config.mjs';
import { PRODUCTION_PROBES } from '../../scripts/ops/published-api-probes.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const apiRoot = path.join(root, 'pages/api');
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? files(full) : [full];
  });
}
const apiFiles = files(apiRoot).filter((file) => /\.(js|ts)$/.test(file));
const routes = apiFiles.map(
  (file) =>
    '/api/' +
    path
      .relative(apiRoot, file)
      .replace(/\.(js|ts)$/, '')
      .replace(/\/index$/, ''),
);

const recruitmentRoutes = [
  'workspace',
  'me/organizations',
  'applications/[id]',
  'applications/[id]/cv',
  'applications/[id]/hire',
  'applications/[id]/interviews',
  'applications/[id]/notes',
  'applications/[id]/review',
  'applications/[id]/transition',
  'bulk-actions',
  'bulk-actions/[id]/cancel',
  'bulk-actions/[id]/execute',
  'hires/[id]/annul',
  'hires/[id]/confirm',
  'interviews/[id]/[action]',
  'interviews/[id]/ics',
  'invitations/[id]',
  'invitations/[id]/accept',
  'invitations/[id]/preview',
  'invitations/[id]/revoke',
  'jobs/[id]/close',
  'jobs/[id]/closing-message',
  'jobs/[id]/fill',
  'organizations/[id]/invitations',
  'organizations/[id]/members/[userId]',
  'organizations/[id]/message-templates',
  'organizations/[id]/ownership-transfer',
  'organizations/[id]/ownership-transfer/accept',
];

test('all 28 recruitment handlers live in the single API tree; no version folder remains', () => {
  assert.equal(fs.existsSync(path.join(apiRoot, 'v2')), false);
  assert.equal(recruitmentRoutes.length, 28);
  for (const route of recruitmentRoutes)
    assert.ok(routes.includes('/api/' + route), route);
});

test('routes do not collide, including index files and renamed dynamic parameters', () => {
  const signatures = routes.map((route) =>
    route.replace(/\[[^\]]+\]/g, '[param]'),
  );
  assert.equal(new Set(signatures).size, signatures.length);
});

test('existing public, authentication and candidate routes remain available', () => {
  for (const route of [
    'auth/session',
    'auth/register',
    'profile',
    'jobs',
    'jobs/[id]',
    'applications',
    'applications/[id]/status',
    'applications/[id]/withdraw',
    'applications/[id]/timeline',
    'messages',
    'notifications',
  ])
    assert.ok(routes.includes('/api/' + route), route);
});

test('current consumers and rollout probes use only canonical API paths', () => {
  const sources = ['components', 'pages', 'lib', 'presentation', 'scripts']
    .flatMap((dir) => files(path.join(root, dir)))
    .filter((file) => /\.(js|jsx|ts|tsx|mjs)$/.test(file));
  const offenders = sources
    .filter((file) =>
      /\/api\/v2\/|v2ApiClient|v2Request/.test(fs.readFileSync(file, 'utf8')),
    )
    .map((file) => path.relative(root, file));
  assert.deepEqual(offenders, []);
  for (const [route] of PRODUCTION_PROBES) {
    assert.ok(route.startsWith('/api/'));
    assert.ok(!route.includes('/v2/'));
    const matched = routes.some((candidate) =>
      new RegExp('^' + candidate.replace(/\[[^\]]+\]/g, '[^/]+') + '$').test(
        route,
      ),
    );
    assert.ok(matched, route);
  }
});

test('retired version URLs have neither duplicate handlers nor compatibility rewrites', () => {
  assert.equal(typeof config.rewrites, 'undefined');
  assert.equal(typeof config.redirects, 'undefined');
});
