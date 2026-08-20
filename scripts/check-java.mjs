/**
 * Verifica que existe um JDK utilizável antes de arrancar os emuladores.
 *
 * Sem isto, correr `npm run test:integration` com um Java antigo falha com uma
 * mensagem do Firebase difícil de ligar à causa. Nesta máquina o Java do
 * sistema era o 1.8 e as suites de integração e de regras estiveram meses sem
 * correr sem que fosse óbvio porquê.
 *
 * O `openjdk@21` do Homebrew é keg-only: não entra no PATH sozinho. Se o
 * encontrarmos instalado, usamo-lo automaticamente em vez de exigir
 * configuração manual.
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const CAMINHOS_CONHECIDOS = [
  '/usr/local/opt/openjdk@21/bin',
  '/opt/homebrew/opt/openjdk@21/bin',
  '/usr/local/opt/openjdk@17/bin',
  '/opt/homebrew/opt/openjdk@17/bin',
];

const VERSAO_MINIMA = 11;

function versaoDe(bin) {
  try {
    // `java -version` escreve em stderr, por isso é preciso redirecionar.
    const texto = execSync(`"${bin}" -version 2>&1`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const m = texto.match(/version "(\d+)(?:\.(\d+))?/);
    if (!m) return null;
    const maior = Number(m[1]);
    // O Java 8 reporta-se como 1.8; a versão real está no segundo número.
    return maior === 1 ? Number(m[2] || 0) : maior;
  } catch {
    return null;
  }
}

function tentar(bin) {
  const v = versaoDe(bin);
  return v !== null && v >= VERSAO_MINIMA ? v : null;
}

// 1) O que já está no PATH serve?
const noPath = tentar('java');
if (noPath) {
  process.exit(0);
}

// 2) Algum JDK conhecido do Homebrew?
for (const dir of CAMINHOS_CONHECIDOS) {
  const bin = `${dir}/java`;
  if (existsSync(bin) && tentar(bin)) {
    // Exportar aqui não afeta o processo pai; imprimimos a instrução exacta.
    process.stdout.write(`${dir}\n`);
    process.exit(0);
  }
}

const atual = versaoDe('java');
console.error(
  [
    '',
    'Os emuladores do Firebase precisam de Java 11 ou superior.',
    atual === null
      ? '  Java não encontrado no PATH.'
      : `  Versão encontrada: ${atual}.`,
    '',
    'Para resolver:',
    '  brew install openjdk@21',
    '  echo \'export PATH="/usr/local/opt/openjdk@21/bin:$PATH"\' >> ~/.zshrc',
    '',
    'O openjdk do Homebrew é keg-only, por isso não entra no PATH sozinho.',
    '',
  ].join('\n'),
);
process.exit(1);
