import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PRIVATE_KEY_BLOCK =
  /-----BEGIN (?:RSA )?PRIVATE KEY-----([\s\S]*?)-----END (?:RSA )?PRIVATE KEY-----/g;

function listTrackedTextFiles(): string[] {
  return execFileSync('git', ['ls-files', '-z'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })
    .split('\0')
    .filter(Boolean);
}

function looksLikeRealPrivateKey(body: string): boolean {
  const normalized = body.replace(/\\n/g, '').replace(/\s/g, '');

  return normalized.length >= 256 && /^[A-Za-z0-9+/=]+$/.test(normalized);
}

describe('segredos nos ficheiros rastreados', () => {
  test('não contém chaves privadas PEM reais', () => {
    const exposedFiles: string[] = [];

    for (const file of listTrackedTextFiles()) {
      const contents = readFileSync(resolve(process.cwd(), file));

      if (contents.includes(0)) continue;

      const text = contents.toString('utf8');
      const matches = text.matchAll(PRIVATE_KEY_BLOCK);

      if (
        [...matches].some((match) => looksLikeRealPrivateKey(match[1] ?? ''))
      ) {
        exposedFiles.push(file);
      }
    }

    expect(exposedFiles).toEqual([]);
  });

  test('ignora formatos locais comuns de credenciais sem ocultar exemplos', () => {
    const sensitivePaths = [
      '.env.development',
      '.env.test',
      '.env.staging',
      'firebase-service-account.json',
      'firebase-adminsdk.json',
      'credentials.private.key',
      'certificate.p12',
      'certificate.pfx',
    ];
    for (const path of sensitivePaths) {
      const result = spawnSync('git', ['check-ignore', '--no-index', path], {
        cwd: process.cwd(),
        encoding: 'utf8',
      });

      expect({ path, status: result.status }).toEqual({ path, status: 0 });
    }

    const exampleResult = spawnSync(
      'git',
      ['check-ignore', '--no-index', '.env.example'],
      { cwd: process.cwd(), encoding: 'utf8' },
    );

    expect(exampleResult.status).toBe(1);
  });
});
