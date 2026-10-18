import fs from 'node:fs';
import path from 'node:path';

const rules = fs.readFileSync(
  path.join(process.cwd(), 'storage.rules'),
  'utf8',
);

/**
 * `@firebase/rules-unit-testing` exige o emulador, que este projeto não usa.
 * Enquanto isso, estes casos fixam estaticamente as decisões de segurança do
 * ficheiro para que uma edição futura não reabra a leitura pública sem que
 * alguém tenha de o justificar aqui.
 */
function ruleBlock(matchPath: string) {
  const escaped = matchPath.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const pattern = new RegExp(
    `match\\s+${escaped}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`,
    'm',
  );
  const found = pattern.exec(rules);
  return found ? found[1] : null;
}

describe('storage.rules', () => {
  test.each([
    '/cvUrl/{userId}/{fileName}',
    '/certificados/{userId}/{fileName}',
  ])('%s não permite leitura pública', (matchPath) => {
    const block = ruleBlock(matchPath);
    expect(block).not.toBeNull();
    expect(block).not.toMatch(/allow\s+read:\s*if\s+true/);
    expect(block).toMatch(/isOwner\(userId\)/);
    expect(block).toMatch(/isAdmin\(\)/);
  });

  test.each([
    '/cvUrl/{userId}/{fileName}',
    '/certificados/{userId}/{fileName}',
    '/photoUrl/{userId}/{fileName}',
  ])('%s só permite escrita ao dono autenticado', (matchPath) => {
    const block = ruleBlock(matchPath);
    expect(block).toMatch(
      /allow\s+create,\s*update:\s*if\s+isAuthenticated\(\)\s*&&\s*isOwner\(userId\)/,
    );
    expect(block).toMatch(
      /allow\s+delete:\s*if\s+isAuthenticated\(\)\s*&&\s*isOwner\(userId\);/,
    );
  });

  // Secção 69 do fecho: nenhum caminho gravável pelo cliente fica sem limite
  // de tamanho e de tipo — sem isto, uma conta qualquer guardava ficheiros de
  // vários GB, ou HTML/SVG servidos a partir do bucket.
  test.each([
    ['/company-covers/{userId}/{allPaths=**}', 'underMb(10)', ['isImage()']],
    ['/company-logos/{userId}/{allPaths=**}', 'underMb(10)', ['isImage()']],
    ['/job-tdr/{userId}/{allPaths=**}', 'underMb(10)', ['isPdf()', 'isWord()']],
    ['/users/{userId}/{allPaths=**}', 'underMb(15)', ['isPdf()', 'isWord()']],
    ['/cvUrl/{userId}/{fileName}', 'underMb(10)', ['isPdf()', 'isWord()']],
    ['/certificados/{userId}/{fileName}', 'underMb(10)', ['isPdf()', 'isImage()']],
    [
      '/candidaturas/{userId}/{jobId}/{fileName}',
      'underMb(10)',
      ['isPdf()', 'isWord()', 'isImage()'],
    ],
    ['/photoUrl/{userId}/{fileName}', 'underMb(10)', ['isImage()']],
    [
      '/verification/{docType}/{userId}/{fileName}',
      'underMb(10)',
      ['isPdf()', 'isImage()'],
    ],
  ])('%s limita tamanho e tipo nas escritas', (matchPath, size, types) => {
    const block = ruleBlock(matchPath);
    expect(block).not.toBeNull();
    expect(block).not.toMatch(/allow\s+write:/);
    const createRule = /allow\s+create,\s*update:([\s\S]*?);/.exec(block || '');
    expect(createRule?.[1]).toContain(size);
    for (const type of types) expect(createRule?.[1]).toContain(type);
  });

  test('as imagens aceites não incluem SVG', () => {
    const isImage = /function isImage\(\)\s*\{([\s\S]*?)\}/.exec(rules);
    expect(isImage?.[1]).toBeDefined();
    expect(isImage?.[1]).not.toMatch(/svg|image\/\.\*/);
  });

  test('os comprovativos de pagamento continuam restritos ao dono e a admins', () => {
    const block = ruleBlock('/payment-proofs/{userId}/{allPaths=**}');
    expect(block).not.toMatch(/allow\s+read:\s*if\s+true/);
    expect(block).toMatch(/isOwner\(userId\)\s*\|\|\s*isAdmin\(\)/);
  });

  test('os documentos de verificação continuam privados ao dono', () => {
    const block = ruleBlock('/verification/{docType}/{userId}/{fileName}');
    expect(block).not.toMatch(/allow\s+read:\s*if\s+true/);
  });

  test('a regra final continua a bloquear tudo o que não foi declarado', () => {
    expect(rules).toMatch(
      /match\s+\/\{allPaths=\*\*\}\s*\{\s*allow read, write:\s*if\s+false;\s*\}/,
    );
  });

  test('a fotografia pública é a única exceção de leitura e está justificada', () => {
    const publicReads = [...rules.matchAll(/match\s+(\S+)\s*\{[^}]*allow\s+read:\s*if\s+true/g)]
      .map((match) => match[1]);

    expect(publicReads.sort()).toEqual(
      [
        '/company-covers/{userId}/{allPaths=**}',
        '/company-logos/{userId}/{allPaths=**}',
        '/photoUrl/{userId}/{fileName}',
      ].sort(),
    );
  });
});
