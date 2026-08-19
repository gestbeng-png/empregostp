import { sanitizeRichHtml } from '../../../lib/sanitizeRichHtml';

describe('sanitização de HTML editorial', () => {
  test('remove scripts', () => {
    const saida = sanitizeRichHtml(
      '<p>Legítimo</p><script>fetch("/api/roubar")</script>',
    );
    expect(saida).toContain('<p>Legítimo</p>');
    expect(saida).not.toContain('script');
    expect(saida).not.toContain('roubar');
  });

  test('remove handlers de eventos inline', () => {
    const saida = sanitizeRichHtml('<img src="x" onerror="alert(1)">');
    expect(saida).not.toContain('onerror');
    expect(saida).not.toContain('alert');
  });

  test('neutraliza esquemas perigosos em links', () => {
    expect(sanitizeRichHtml('<a href="javascript:alert(1)">x</a>')).not.toContain(
      'javascript:',
    );
    expect(sanitizeRichHtml('<a href="vbscript:msgbox">x</a>')).not.toContain(
      'vbscript:',
    );
  });

  test('remove iframes e objectos incorporados', () => {
    const saida = sanitizeRichHtml(
      '<iframe src="https://mau.example"></iframe><object data="x"></object>',
    );
    expect(saida).not.toContain('iframe');
    expect(saida).not.toContain('object');
  });

  test('preserva a formatação legítima de um artigo', () => {
    const original =
      '<h2>Título</h2><p>Um <strong>parágrafo</strong> com <em>ênfase</em>.</p>' +
      '<ul><li>Item</li></ul><a href="https://empregostp.vercel.app">ligação</a>';
    const saida = sanitizeRichHtml(original);

    expect(saida).toContain('<h2>Título</h2>');
    expect(saida).toContain('<strong>parágrafo</strong>');
    expect(saida).toContain('<li>Item</li>');
    expect(saida).toContain('https://empregostp.vercel.app');
  });

  test('acrescenta rel de segurança aos links', () => {
    const saida = sanitizeRichHtml('<a href="https://exemplo.test">x</a>');
    expect(saida).toContain('rel="noopener noreferrer"');
  });

  test('entradas vazias ou não-string devolvem string vazia', () => {
    expect(sanitizeRichHtml('')).toBe('');
    expect(sanitizeRichHtml(null as never)).toBe('');
    expect(sanitizeRichHtml(undefined as never)).toBe('');
    expect(sanitizeRichHtml(42 as never)).toBe('');
  });
});
