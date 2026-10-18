import fs from 'node:fs';
import path from 'node:path';

const API_DIR = path.join(process.cwd(), 'pages', 'api');

/**
 * Rotas autorizadas a escrever diretamente no console.
 *
 * Só os crons: a sua saída é o registo operacional da execução agendada
 * (contagens e ids internos), lida nos logs da Vercel. Nenhuma outra rota
 * pode usar console.* — um `Error` bruto passado ao console arrasta mensagem,
 * stack e propriedades que podem conter email, token ou conteúdo de CV.
 */
const CONSOLE_ALLOWLIST = new Set([
  'cron/check-plan-expiration.js',
  'cron/check-job-expiration.js',
]);

/** Termos que nunca podem aparecer interpolados num log de cron. */
const PERSONAL_DATA_TERMS = [
  'cv',
  'curriculo',
  'currículo',
  'email',
  'password',
  'phone',
  'proof',
  'senha',
  'telefone',
  'token',
];

function listApiFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listApiFiles(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

const apiFiles = listApiFiles(API_DIR).map((file) => ({
  absolutePath: file,
  relativePath: path.relative(API_DIR, file).split(path.sep).join('/'),
}));

describe('uso de console nas rotas de API', () => {
  test('o inventário de rotas foi encontrado', () => {
    expect(apiFiles.length).toBeGreaterThan(50);
  });

  test('nenhuma rota fora da allowlist escreve no console', () => {
    const offenders = apiFiles
      .filter(({ relativePath }) => !CONSOLE_ALLOWLIST.has(relativePath))
      .filter(({ absolutePath }) =>
        /\bconsole\.(log|info|warn|error|debug|trace)\s*\(/.test(
          fs.readFileSync(absolutePath, 'utf8'),
        ),
      )
      .map(({ relativePath }) => relativePath);

    expect(offenders).toEqual([]);
  });

  test('as rotas com erros tratados usam o logger classificado', () => {
    const offenders = apiFiles
      .filter(({ relativePath }) => !CONSOLE_ALLOWLIST.has(relativePath))
      .filter(({ absolutePath }) => {
        const source = fs.readFileSync(absolutePath, 'utf8');
        const catchesErrors = /catch\s*\(\s*[A-Za-z_$][\w$]*\s*\)/.test(source);
        // `logEvent` (infrastructure/observability/logger.ts) também conta: só
        // aceita campos de uma allowlist e põe o utilizador em hash.
        const usesLogger = /logServer(Error|Warning)\s*\(|\blogEvent\s*\(/.test(
          source,
        );
        const rethrowsOnly = /catch\s*\([^)]*\)\s*\{\s*throw\b/.test(source);
        return catchesErrors && !usesLogger && !rethrowsOnly;
      })
      .map(({ relativePath }) => relativePath);

    // Rotas que apanham erros e os tratam silenciosamente (degradação
    // graciosa deliberada) não precisam de logger; esta lista fixa quais são,
    // para que uma rota nova não passe a engolir erros sem registo.
    const SILENT_DEGRADATION = new Set([
      'admin/moderation-settings.js',
      'auth/send-password-reset.js',
      'auth/send-verification.js',
    ]);

    expect(offenders.filter((file) => !SILENT_DEGRADATION.has(file))).toEqual(
      [],
    );
  });

  test('os logs de cron não interpolam dados pessoais', () => {
    const offenders: string[] = [];

    CONSOLE_ALLOWLIST.forEach((relativePath) => {
      const absolutePath = path.join(API_DIR, relativePath);
      if (!fs.existsSync(absolutePath)) return;
      const source = fs.readFileSync(absolutePath, 'utf8');
      const consoleCalls = source.match(/console\.\w+\([^\n]*/g) || [];
      consoleCalls.forEach((call) => {
        const lowered = call.toLowerCase();
        PERSONAL_DATA_TERMS.forEach((term) => {
          if (lowered.includes(term)) {
            offenders.push(`${relativePath}: ${call.trim().slice(0, 80)}`);
          }
        });
      });
    });

    expect(offenders).toEqual([]);
  });
});
