import fs from 'node:fs';
import path from 'node:path';

/**
 * Todas as páginas sob /dashboard são áreas privadas.
 *
 * Três delas — criar-vaga, vagas e profile da empresa — chegaram a produção sem
 * `getServerSideProps`, e respondiam 200 a quem não tinha sessão: o visitante
 * preenchia o formulário de publicar vaga todo e só ao submeter é que a API o
 * travava. O guard tem de existir no servidor, não só no cliente, e este teste
 * impede que a próxima página nasça outra vez sem ele.
 */
const DASHBOARD_DIR = path.join(process.cwd(), 'pages', 'dashboard');

// Duas formas legítimas de fechar a porta no servidor: um dos helpers
// partilhados, ou a verificação do token feita à mão no getServerSideProps.
const GUARDS = [
  'requireSession',
  'requireCandidateSession',
  'requireCompanySession',
  'requireAdminSession',
  'requireAdminPageAuth',
  'verifyIdToken',
];

// Stubs cujo getServerSideProps não faz mais nada senão reencaminhar para uma
// rota já protegida: não têm nada para proteger.
const REDIRECTS_PUROS = new Set([
  path.join('pages', 'dashboard', 'candidato', 'vaga', 'index.js'),
]);

function listarPaginas(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) return listarPaginas(completo);
    return /\.(js|jsx|ts|tsx)$/.test(entrada.name) ? [completo] : [];
  });
}

const paginas = listarPaginas(DASHBOARD_DIR).map((ficheiro) =>
  path.relative(process.cwd(), ficheiro),
);

describe('guards de servidor nas rotas do dashboard', () => {
  test('a auditoria encontra páginas para verificar', () => {
    expect(paginas.length).toBeGreaterThan(5);
  });

  test.each(paginas)('%s bloqueia no servidor', (ficheiro) => {
    const codigo = fs.readFileSync(path.join(process.cwd(), ficheiro), 'utf8');

    expect(codigo).toMatch(
      /export async function getServerSideProps|export function getServerSideProps|export \{[^}]*getServerSideProps/,
    );

    if (REDIRECTS_PUROS.has(ficheiro)) {
      expect(codigo).toContain('redirect');
      return;
    }

    expect(GUARDS.some((guard) => codigo.includes(guard))).toBe(true);
  });
});
