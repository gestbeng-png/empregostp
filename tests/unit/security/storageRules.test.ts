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
    expect(block).toMatch(/allow\s+write:\s*if\s+isAuthenticated\(\)\s*&&\s*isOwner\(userId\)/);
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
