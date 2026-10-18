import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

import {
  IGNORE_SCHEDULER_COMMIT,
  publishScheduler,
  schedulerConfig,
  stagedDeploymentUrl,
} from '../../scripts/v2/configure-github-scheduler.mjs';

test('extracts only the staged project URL from noisy CLI output, never a canonical alias or foreign project', () => {
  const url = 'https://empregostp-hc6v5ylxs-edmirfoncecas-projects.vercel.app';
  assert.equal(
    stagedDeploymentUrl(
      `Deploying...\n${url}\nAliased: https://empregostp-edmirfoncecas-projects.vercel.app\n`,
    ),
    url,
  );
  assert.throws(
    () => stagedDeploymentUrl('https://other-app.vercel.app'),
    /DEPLOYMENT_URL_MISSING/,
  );
});

test('scheduler config preserves every other remote Vercel setting', () => {
  const config = {
    version: 2,
    crons: [{ path: '/api/legacy', schedule: '0 2 * * *' }],
    redirects: [],
  };
  assert.deepEqual(schedulerConfig(config), {
    ...config,
    ignoreCommand: IGNORE_SCHEDULER_COMMIT,
  });
  assert.equal(config.ignoreCommand, undefined);
});
test('workflow-only commit cannot auto-deploy the old remote app, normal CLI releases still build', () => {
  for (const [message, expected] of [
    ['Configure scheduler [skip vercel] [skip ci]', 0],
    ['Normal release', 1],
    ['', 1],
  ]) {
    const result = spawnSync(IGNORE_SCHEDULER_COMMIT, {
      shell: true,
      env: { ...process.env, VERCEL_GIT_COMMIT_MESSAGE: message },
    });
    assert.equal(result.status, expected);
  }
});
test('publishes exactly two scoped files atomically, no force and no application changes', async () => {
  const calls = [];
  const api = async (path, method, body) => {
    calls.push({ path, method, body });
    return {
      sha: method === 'POST' && path.endsWith('/git/trees') ? 'tree' : 'commit',
    };
  };
  await publishScheduler(api, {
    tree: 'old-tree',
    parent: 'old-head',
    config: { version: 2 },
    workflow: 'workflow',
  });
  assert.equal(calls.length, 3);
  assert.deepEqual(
    calls[0].body.tree.map((entry) => entry.path),
    ['.github/workflows/recruitment-cron.yml', 'vercel.json'],
  );
  assert.equal(calls[0].body.base_tree, 'old-tree');
  assert.deepEqual(calls[1].body.parents, ['old-head']);
  assert.match(calls[1].body.message, /\[skip vercel\]/);
  assert.deepEqual(calls[2].body, { sha: 'commit', force: false });
});
test('workflow uses fixed HTTPS paths, least privilege, protected secrets and status-only logs', async () => {
  const source = await readFile(
    '.github/workflows/recruitment-cron.yml',
    'utf8',
  );
  assert.match(source, /permissions: \{\}/);
  assert.match(source, /secrets\.EMPREGOSTP_CRON_SECRET/);
  assert.match(source, /redirect: 'error'/);
  assert.match(source, /data.status === 'processed'/);
  assert.doesNotMatch(
    source,
    /actions\/checkout|console\.log\(data|console\.log\(process\.env|echo.*SECRET/,
  );
  assert.match(source, /7,37 \* \* \* \*/);
  assert.equal((source.match(/runs-on:/g) || []).length, 1);
  assert.match(source, /EMAIL_NOT_READY/);
  assert.match(source, /13 9 \* \* \*/);
});

async function runWorkflow(
  env,
  result = { status: 'processed', failed: 0, leaseLost: 0 },
) {
  const source = await readFile(
    '.github/workflows/recruitment-cron.yml',
    'utf8',
  );
  const code = source.split("<<'JS'\n")[1].split('\n          JS')[0];
  const paths = [];
  const logs = [];
  const process = {
    env: { CRON_SECRET: 'test-only-secret', ...env },
    exitCode: undefined,
  };
  await runInNewContext(`(async () => { ${code} })()`, {
    process,
    AbortSignal,
    console: { log: (value) => logs.push(value) },
    fetch: async (url, options) => {
      assert.equal(options.method, 'POST');
      assert.equal(options.redirect, 'error');
      assert.equal(options.headers.Authorization, 'Bearer test-only-secret');
      paths.push(new URL(url).pathname);
      return { ok: true, status: 200, json: async () => result };
    },
  });
  assert.ok(logs.every((value) => !value.includes('test-only-secret')));
  return { paths, logs, exitCode: process.exitCode };
}
test('30-minute schedule processes reminders before the outbox in one runner', async () => {
  const result = await runWorkflow({
    EVENT_NAME: 'schedule',
    EVENT_SCHEDULE: '7,37 * * * *',
    OUTBOX_ENABLED: 'true',
  });
  assert.deepEqual(result.paths, [
    '/api/cron/interview-reminders',
    '/api/cron/expire-offers',
    '/api/cron/process-outbox',
  ]);
  assert.equal(result.exitCode, undefined);
});
test('daily run queues follow-ups before processing notifications', async () => {
  const result = await runWorkflow({
    EVENT_NAME: 'schedule',
    EVENT_SCHEDULE: '13 9 * * *',
    OUTBOX_ENABLED: 'true',
  });
  assert.deepEqual(result.paths, [
    '/api/cron/ats-daily',
    '/api/cron/process-outbox',
  ]);
});
test('manual smoke check runs all four tasks sequentially', async () => {
  const result = await runWorkflow({
    EVENT_NAME: 'workflow_dispatch',
    OUTBOX_ENABLED: 'true',
  });
  assert.deepEqual(result.paths, [
    '/api/cron/interview-reminders',
    '/api/cron/expire-offers',
    '/api/cron/ats-daily',
    '/api/cron/process-outbox',
  ]);
});
test('email not ready explicitly skips the outbox but does not block other authorized scheduled work', async () => {
  const result = await runWorkflow({
    EVENT_NAME: 'workflow_dispatch',
    OUTBOX_ENABLED: 'false',
  });
  assert.ok(!result.paths.includes('/api/cron/process-outbox'));
  assert.ok(result.logs.some((value) => value.includes('EMAIL_NOT_READY')));
});
test('processed response with failed delivery is not a falsely successful workflow', async () => {
  const result = await runWorkflow(
    { EVENT_NAME: 'workflow_dispatch', OUTBOX_ENABLED: 'true' },
    { status: 'processed', failed: 1, leaseLost: 0 },
  );
  assert.equal(result.exitCode, 1);
});
