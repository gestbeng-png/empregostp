import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const root = process.cwd();
const checks = [];

function run(label, command, args, env = {}) {
  process.stdout.write(`\n[closure] ${label}\n`);
  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });
  const passed = result.status === 0;
  checks.push({ label, passed });
  if (!passed) process.exitCode = 1;
  return passed;
}

run('lint', 'npm', ['run', 'lint']);
run('typecheck', 'npm', ['run', 'typecheck', '--', '--incremental', 'false']);
run('unit tests', 'npm', ['test', '--', '--runInBand']);
const contractFiles = readdirSync('tests/contracts')
  .filter((file) => file.endsWith('.test.mjs'))
  .sort()
  .map((file) => `tests/contracts/${file}`);
run('contract tests', 'node', ['--test', ...contractFiles]);
run('production build', 'npm', ['run', 'build']);

if (!process.env.CLOSURE_BASE_URL) {
  checks.push({
    label: 'route checker',
    passed: false,
    reason: 'CLOSURE_BASE_URL_REQUIRED',
  });
  process.stderr.write(
    '\n[closure] CLOSURE_BASE_URL is required for route verification.\n',
  );
  process.exitCode = 1;
} else {
  run('route checker', 'node', ['scripts/quality/check-urls.mjs'], {
    AUDIT_BASE_URL: process.env.CLOSURE_BASE_URL,
    AUDIT_ENVIRONMENT: process.env.CLOSURE_ENVIRONMENT || 'staging',
  });
}

if (process.env.CLOSURE_E2E !== '1') {
  checks.push({
    label: 'critical E2E',
    passed: false,
    reason: 'CLOSURE_E2E_REQUIRED',
  });
  process.stderr.write(
    '\n[closure] CLOSURE_E2E=1 is required for critical browser flows.\n',
  );
} else {
  run('critical E2E', 'npm', ['run', 'test:e2e', '--', '--reporter=line']);
}

process.stdout.write(`\n[closure] ${JSON.stringify(checks)}\n`);
if (checks.some((check) => !check.passed)) process.exitCode = 1;
