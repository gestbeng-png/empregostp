import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import {
  deploymentReadOnlyJson,
  githubClient,
  repository,
  setProductionVariable,
} from './production-runtime.mjs';

export const IGNORE_SCHEDULER_COMMIT =
  "node -e \"process.exit((process.env.VERCEL_GIT_COMMIT_MESSAGE || '').includes('[skip vercel]') ? 0 : 1)\"";
export function schedulerConfig(existing) {
  return { ...existing, ignoreCommand: IGNORE_SCHEDULER_COMMIT };
}
export function stagedDeploymentUrl(output) {
  const urls = output.match(
    /https:\/\/empregostp-[a-z0-9]+-edmirfoncecas-projects\.vercel\.app\b/g,
  );
  if (!urls?.length) throw new Error('DEPLOYMENT_URL_MISSING');
  return urls[urls.length - 1];
}
const base = `/repos/${repository}`;
export async function readSchedulerPlan(api) {
  const repo = await api(base);
  if (repo.default_branch !== 'main' || !repo.permissions?.admin)
    throw new Error('REPOSITORY_PERMISSION_MISMATCH');
  const head = await api(`${base}/git/ref/heads/main`);
  const commit = await api(`${base}/git/commits/${head.object.sha}`);
  const remote = await api(
    `${base}/contents/vercel.json?ref=${head.object.sha}`,
  );
  const config = JSON.parse(
    Buffer.from(remote.content, 'base64').toString('utf8'),
  );
  const publicKey = await api(`${base}/actions/secrets/public-key`);
  const workflow = await readFile(
    '.github/workflows/recruitment-cron.yml',
    'utf8',
  );
  try {
    const prior = await api(
      `${base}/contents/.github/workflows/recruitment-cron.yml?ref=${head.object.sha}`,
    );
    if (Buffer.from(prior.content, 'base64').toString('utf8') !== workflow)
      throw new Error('REMOTE_WORKFLOW_CONFLICT');
  } catch (error) {
    if (error.message !== 'GITHUB_404') throw error;
  }
  return {
    parent: head.object.sha,
    tree: commit.tree.sha,
    config,
    publicKey,
    workflow,
  };
}
export async function publishScheduler(api, plan) {
  // One non-forced, atomic commit, preserving all remote application files.
  // The skip command is in this same tree so old GitHub application code cannot replace the CLI release.
  const files = [
    ['.github/workflows/recruitment-cron.yml', plan.workflow],
    [
      'vercel.json',
      `${JSON.stringify(schedulerConfig(plan.config), null, 2)}\n`,
    ],
  ];
  const tree = await api(`${base}/git/trees`, 'POST', {
    base_tree: plan.tree,
    tree: files.map(([path, content]) => ({
      path,
      content,
      mode: '100644',
      type: 'blob',
    })),
  });
  const commit = await api(`${base}/git/commits`, 'POST', {
    message: 'Configure recruitment scheduler [skip vercel] [skip ci]',
    tree: tree.sha,
    parents: [plan.parent],
  });
  await api(`${base}/git/refs/heads/main`, 'PATCH', {
    sha: commit.sha,
    force: false,
  });
  return commit.sha;
}
async function vercelCommand(args) {
  return new Promise((resolve, reject) => {
    let output = '';
    let deploymentMetadata = '';
    const child = spawn(
      'vercel',
      [...args, '--scope', 'edmirfoncecas-projects'],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, DEBUG: '' },
      },
    );
    child.stdout.on('data', (data) => {
      output += data;
    });
    child.stderr.on('data', (data) => {
      process.stderr.write(data);
      const urls = String(data).match(
        /https:\/\/empregostp-[a-z0-9]+-edmirfoncecas-projects\.vercel\.app\b/g,
      );
      if (urls) deploymentMetadata += `${urls.join('\n')}\n`;
    });
    child.on('error', () => reject(new Error('VERCEL_COMMAND_FAILED')));
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error('VERCEL_COMMAND_FAILED'));
        return;
      }
      try {
        resolve(
          args[0] === 'deploy'
            ? stagedDeploymentUrl(`${output}\n${deploymentMetadata}`)
            : output.trim(),
        );
      } catch (error) {
        reject(error);
      }
    });
  });
}
export async function configureScheduler({ apply = false } = {}) {
  const api = await githubClient();
  const plan = await readSchedulerPlan(api);
  if (!apply)
    return {
      mode: 'DRY_RUN',
      repository,
      parent: plan.parent,
      files: ['.github/workflows/recruitment-cron.yml', 'vercel.json'],
    };
  const imported = await import('libsodium-wrappers');
  const sodium = imported.default;
  await sodium.ready;
  const secret = randomBytes(48).toString('base64url');
  const encrypted = sodium.crypto_box_seal(
    sodium.from_string(secret),
    sodium.from_base64(plan.publicKey.key, sodium.base64_variants.ORIGINAL),
  );
  await api(`${base}/actions/secrets/EMPREGOSTP_CRON_SECRET`, 'PUT', {
    encrypted_value: sodium.to_base64(
      encrypted,
      sodium.base64_variants.ORIGINAL,
    ),
    key_id: plan.publicKey.key_id,
  });
  await setProductionVariable('CRON_SECRET', secret);
  console.log(
    JSON.stringify({ stage: 'SECRETS_CONFIGURED', next: 'STAGED_BUILD' }),
  );
  const url = await vercelCommand([
    'deploy',
    '--prod',
    '--skip-domain',
    '--yes',
  ]);
  const readiness = await deploymentReadOnlyJson(
    url,
    '/api/cron/readiness',
    secret,
  );
  console.log(JSON.stringify({ stage: 'EMAIL_READINESS', ...readiness }));
  const health = await deploymentReadOnlyJson(url, '/api/health');
  if (health.status !== 'ok') throw new Error('STAGED_HEALTH_FAILED');
  await vercelCommand(['promote', url, '--yes']);
  const productionHealth = await fetch('https://empregostp.com/api/health', {
    redirect: 'error',
    signal: AbortSignal.timeout(30000),
  });
  if (!productionHealth.ok || (await productionHealth.json()).status !== 'ok')
    throw new Error('PRODUCTION_HEALTH_FAILED');
  const sha = await publishScheduler(api, await readSchedulerPlan(api));
  console.log(
    JSON.stringify({ stage: 'WORKFLOW_PUBLISHED', commit: sha, url }),
  );
  await api(
    `${base}/actions/workflows/recruitment-cron.yml/dispatches`,
    'POST',
    { ref: 'main' },
  );
  return {
    mode: readiness.status === 'ready' ? 'APPLIED' : 'PARTIAL',
    repository,
    commit: sha,
    url,
    email: readiness,
    firstRunDispatched: true,
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  configureScheduler({ apply: process.argv.includes('--apply') })
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => {
      console.error(JSON.stringify({ code: error.message }));
      process.exitCode = 1;
    });
}
