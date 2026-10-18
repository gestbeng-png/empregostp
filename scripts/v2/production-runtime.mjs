// Operational helpers: credentials remain in memory and are sent only to their own services.
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const projectId = 'prj_5PNmcLPeNZvdHoARF9VAQDH3t1jO';
const teamId = 'team_OvqJiAu9sNvKeRRPao75ajKM';
export const repository = 'Edmirsantos/EmpregoSTP-white';
export async function githubClient() {
  const raw = await new Promise((resolve, reject) => {
    let output = '';
    const child = spawn('git', ['credential', 'fill'], {
      stdio: ['pipe', 'pipe', 'ignore'],
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
    child.stdout.on('data', (data) => {
      output += data;
    });
    child.stdin.end(
      `protocol=https\nhost=github.com\npath=${repository}.git\n\n`,
    );
    child.on('error', () => reject(new Error('GITHUB_CREDENTIAL_UNAVAILABLE')));
    child.on('close', (code) =>
      code === 0
        ? resolve(output)
        : reject(new Error('GITHUB_CREDENTIAL_UNAVAILABLE')),
    );
  });
  const token = raw
    .split('\n')
    .find((line) => line.startsWith('password='))
    ?.slice(9);
  if (!token) throw new Error('GITHUB_CREDENTIAL_UNAVAILABLE');
  return async (path, method = 'GET', body) => {
    if (
      path !== `/repos/${repository}` &&
      !path.startsWith(`/repos/${repository}/`)
    )
      throw new Error('GITHUB_TARGET_MISMATCH');
    const response = await fetch(`https://api.github.com${path}`, {
      method,
      redirect: 'error',
      signal: AbortSignal.timeout(30000),
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error(`GITHUB_${response.status}`);
    return response.status === 204 ? null : response.json();
  };
}
export async function vercelClient() {
  const project = JSON.parse(await readFile('.vercel/project.json', 'utf8'));
  if (project.projectId !== projectId || project.orgId !== teamId)
    throw new Error('VERCEL_TARGET_MISMATCH');
  const auth = JSON.parse(
    await readFile(
      join(homedir(), 'Library/Application Support/com.vercel.cli/auth.json'),
      'utf8',
    ),
  );
  if (!auth.token) throw new Error('VERCEL_CREDENTIAL_UNAVAILABLE');
  return async (path) => {
    if (!path.startsWith(`/v6/deployments?projectId=${projectId}&`))
      throw new Error('VERCEL_TARGET_MISMATCH');
    const response = await fetch(`https://api.vercel.com${path}`, {
      redirect: 'error',
      signal: AbortSignal.timeout(30000),
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    if (!response.ok) throw new Error(`VERCEL_${response.status}`);
    return response.json();
  };
}

export const deploymentListPath = `/v6/deployments?projectId=${projectId}&teamId=${teamId}&limit=10`;

export async function deploymentReadOnlyJson(url, path, secret) {
  if (!/^https:\/\/empregostp-[a-z0-9-]+\.vercel\.app$/.test(url))
    throw new Error('DEPLOYMENT_TARGET_MISMATCH');
  if (!['/api/cron/readiness', '/api/health'].includes(path))
    throw new Error('READ_ONLY_PATH_REQUIRED');
  const raw = await new Promise((resolve, reject) => {
    let output = '';
    const child = spawn(
      'vercel',
      [
        'curl',
        path,
        '--deployment',
        url,
        '--scope',
        'edmirfoncecas-projects',
        '--',
        '--silent',
        '--show-error',
        '--max-time',
        '30',
        '--config',
        '-',
      ],
      {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, DEBUG: '' },
      },
    );
    child.stdout.on('data', (data) => {
      output += data;
    });
    child.stderr.resume();
    // Keep the bearer out of command arguments and logs.
    child.stdin.end(
      secret ? `header = "Authorization: Bearer ${secret}"\n` : '',
    );
    child.on('error', () => reject(new Error('READINESS_REQUEST_FAILED')));
    child.on('close', (code) =>
      code === 0
        ? resolve(output)
        : reject(new Error('READINESS_REQUEST_FAILED')),
    );
  });
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('READINESS_RESPONSE_INVALID');
  }
}
export async function setProductionVariable(name, value) {
  if (
    ![
      'CRON_SECRET',
      'V2_ATS_CRON_ENABLED',
      'V2_OFFER_EXPIRY_ENABLED',
      'V2_OUTBOX_PROCESSOR_ENABLED',
    ].includes(name)
  )
    throw new Error('VARIABLE_NOT_ALLOWED');
  const project = JSON.parse(await readFile('.vercel/project.json', 'utf8'));
  if (project.projectId !== projectId || project.orgId !== teamId)
    throw new Error('VERCEL_TARGET_MISMATCH');
  await new Promise((resolve, reject) => {
    const child = spawn(
      'vercel',
      [
        'env',
        'add',
        name,
        'production',
        '--sensitive',
        '--yes',
        '--force',
        '--scope',
        'edmirfoncecas-projects',
      ],
      { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, DEBUG: '' } },
    );
    child.stdout.resume();
    child.stderr.resume();
    child.stdin.end(value);
    child.on('error', () => reject(new Error('VERCEL_ENV_FAILED')));
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error('VERCEL_ENV_FAILED')),
    );
  });
}
