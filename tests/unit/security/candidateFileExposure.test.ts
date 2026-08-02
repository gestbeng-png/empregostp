import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

/**
 * Superfícies que devolvem dados de candidatos a terceiros. Nenhuma pode
 * emitir o download URL permanente do Firebase Storage: no perfil público
 * (SSR) o valor ficaria embebido no __NEXT_DATA__ do HTML, e na resposta do
 * talent pool ficaria em cache do lado do cliente — em ambos os casos como
 * credencial de leitura sem expiração.
 */
const CANDIDATE_FACING_SOURCES = [
  'pages/candidatos/[id].js',
  'pages/api/talent-pool.js',
  'pages/dashboard/empresa/candidato/[id].js',
];

function read(relativePath: string) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('exposição de ficheiros de candidatos', () => {
  test.each(CANDIDATE_FACING_SOURCES)(
    '%s não devolve o cvUrl bruto no payload',
    (relativePath) => {
      const source = read(relativePath);
      // Procura a atribuição da propriedade cvUrl num objeto de resposta.
      const assignsRawCv = /^\s*cvUrl:\s*(?!null\b)/m.test(source);
      expect(assignsRawCv).toBe(false);
    },
  );

  test.each(CANDIDATE_FACING_SOURCES)(
    '%s não constrói URLs de firebasestorage',
    (relativePath) => {
      expect(read(relativePath)).not.toContain('firebasestorage.googleapis.com');
    },
  );

  test('a rota assinada continua a ser a única a chamar getSignedUrl para CVs', () => {
    const signingRoute = read('pages/api/files/candidate-cv.js');
    expect(signingRoute).toContain('getSignedUrl');

    const otherCvSources = CANDIDATE_FACING_SOURCES.map(read).join('\n');
    expect(otherCvSources).not.toContain('getSignedUrl');
  });
});
