import { isHiddenTool } from '../../../lib/resourcesCatalog';

describe('ferramentas escondidas na página de recursos', () => {
  test('esconde os duplicados antigos do Criador de CV', () => {
    expect(isHiddenTool({ id: 'tool-cv', title: 'Gerador de CV' })).toBe(true);
    expect(isHiddenTool({ id: 'tool-cv-profissional', title: 'CV' })).toBe(
      true,
    );
    expect(isHiddenTool({ id: 'tool2' })).toBe(true);
    expect(isHiddenTool({ id: 'TOOL-CV' })).toBe(true);
  });

  test('esconde cartões que apontam para o ambiente local', () => {
    expect(isHiddenTool({ title: 'CV', link: 'http://localhost:3000' })).toBe(
      true,
    );
    expect(isHiddenTool({ url: 'http://127.0.0.1:3000/recursos' })).toBe(true);
    expect(isHiddenTool({ actionUrl: 'https://localhost/teste' })).toBe(true);
  });

  test('mantém o Criador de CV e as calculadoras', () => {
    expect(
      isHiddenTool({
        id: 'tool-cv-builder-europass',
        title: 'Criador de CV (estilo Europass)',
        link: '/recursos/gerador-cv',
      }),
    ).toBe(false);
    expect(
      isHiddenTool({
        id: 'tool-salary',
        link: '/recursos/calculadora-salarial',
      }),
    ).toBe(false);
    expect(isHiddenTool({ id: 'tool-tax' })).toBe(false);
  });

  test('não confunde domínios que só contêm "localhost" no caminho', () => {
    expect(isHiddenTool({ link: 'https://empregostp.com/localhost' })).toBe(
      false,
    );
    expect(isHiddenTool({})).toBe(false);
  });
});
