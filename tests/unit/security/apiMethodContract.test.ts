import fs from 'node:fs';
import path from 'node:path';

const API_DIR = path.join(process.cwd(), 'pages', 'api');

function listApiFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listApiFiles(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

const routes = listApiFiles(API_DIR).map((absolutePath) => ({
  absolutePath,
  relativePath: path.relative(API_DIR, absolutePath).split(path.sep).join('/'),
  source: fs.readFileSync(absolutePath, 'utf8'),
}));

const routesWith405 = routes.filter(({ source }) => source.includes('status(405)'));

describe('contrato de métodos das rotas de API', () => {
  test('o inventário de rotas foi encontrado', () => {
    expect(routesWith405.length).toBeGreaterThan(50);
  });

  test('toda a rota que responde 405 anuncia os métodos em Allow', () => {
    // A RFC 9110 exige o cabeçalho Allow num 405; sem ele o cliente não
    // consegue descobrir o método correto.
    const offenders = routesWith405
      .filter(({ source }) => !/setHeader\(\s*["']Allow["']/.test(source))
      .map(({ relativePath }) => relativePath);

    expect(offenders).toEqual([]);
  });

  test('as mensagens de 405 estão em português', () => {
    const offenders: string[] = [];

    routesWith405.forEach(({ relativePath, source }) => {
      const responses = source.match(/status\(405\)[\s\S]{0,160}?;/g) || [];
      responses.forEach((response) => {
        if (/not allowed/i.test(response)) {
          offenders.push(`${relativePath}: ${response.replace(/\s+/g, ' ').slice(0, 70)}`);
        }
      });
    });

    expect(offenders).toEqual([]);
  });

  test('nenhuma rota declara o cabeçalho Allow duas vezes seguidas', () => {
    const offenders = routes
      .filter(({ source }) => {
        const lines = source.split('\n');
        return lines.some(
          (line, index) =>
            /^\s*res\.setHeader\(\s*["']Allow["']/.test(line)
            && /^\s*res\.setHeader\(\s*["']Allow["']/.test(lines[index + 1] || ''),
        );
      })
      .map(({ relativePath }) => relativePath);

    expect(offenders).toEqual([]);
  });
});
