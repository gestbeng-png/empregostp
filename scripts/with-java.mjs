/**
 * Corre um comando garantindo que existe um JDK compatível no PATH.
 *
 * `check-java.mjs` devolve o diretório a acrescentar quando encontra um JDK
 * keg-only do Homebrew. Assim `npm run test:integration` funciona sem exigir
 * que cada pessoa configure o PATH à mão, e falha com uma mensagem clara em
 * vez de um erro opaco do Firebase quando não há Java sequer.
 */
import { execFileSync, spawnSync } from 'node:child_process';

let extraPath = '';
try {
  extraPath = String(
    execFileSync(process.execPath, ['scripts/check-java.mjs'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    }),
  ).trim();
} catch {
  process.exit(1);
}

const env = { ...process.env };
if (extraPath) env.PATH = `${extraPath}:${env.PATH}`;

const [, , ...comando] = process.argv;
const resultado = spawnSync(comando[0], comando.slice(1), {
  env,
  shell: true,
  stdio: 'inherit',
});
process.exit(resultado.status ?? 1);
