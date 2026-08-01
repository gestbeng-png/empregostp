import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

const scriptPath = join(
  process.cwd(),
  'scripts/generate-firebase-sw-config.mjs',
);
const fakeEnvironment = {
  NEXT_PUBLIC_FIREBASE_API_KEY: 'fake-api-key',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'fake-project.firebaseapp.test',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'fake-project',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'fake-project.firebasestorage.test',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '123456789',
  NEXT_PUBLIC_FIREBASE_APP_ID: '1:123456789:web:fake',
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: 'G-FAKE123',
};

describe('configuração Firebase gerada para o service worker', () => {
  let temporaryDirectory: string;
  let outputPath: string;

  beforeEach(() => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), 'empregostp-sw-config-'));
    outputPath = join(temporaryDirectory, 'firebase-sw-config.js');
  });

  afterEach(() => {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  test('gera JavaScript válido apenas com os valores fornecidos', () => {
    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        ...fakeEnvironment,
        FIREBASE_SW_CONFIG_OUTPUT: outputPath,
      },
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');

    const source = readFileSync(outputPath, 'utf8');
    const context = { self: {} as Record<string, unknown> };
    runInNewContext(source, context);

    expect(context.self.__EMPREGOSTP_FIREBASE_CONFIG__).toEqual({
      apiKey: 'fake-api-key',
      authDomain: 'fake-project.firebaseapp.test',
      projectId: 'fake-project',
      storageBucket: 'fake-project.firebasestorage.test',
      messagingSenderId: '123456789',
      appId: '1:123456789:web:fake',
      measurementId: 'G-FAKE123',
    });
  });

  test('falha sem deixar ficheiro parcial quando falta uma variável', () => {
    const environment: Record<string, string | undefined> = {
      ...fakeEnvironment,
    };
    delete environment.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const canary = 'valor-secreto-canario';

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        ...environment,
        NEXT_PUBLIC_FIREBASE_API_KEY: canary,
        FIREBASE_SW_CONFIG_OUTPUT: outputPath,
      },
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('NEXT_PUBLIC_FIREBASE_PROJECT_ID');
    expect(result.stderr).not.toContain(canary);
    expect(existsSync(outputPath)).toBe(false);
  });
});
