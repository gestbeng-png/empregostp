import fs from 'node:fs';
import path from 'node:path';

describe('feedback de falhas no percurso do candidato', () => {
  test('envio de mensagem preserva o texto e anuncia o erro a tecnologias assistivas', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'pages', 'dashboard', 'candidato', 'index.js'),
      'utf8',
    );

    expect(source).toContain('setMessageInput(text)');
    expect(source).toContain('id="candidate-message-send-error"');
    expect(source).toContain('role="alert"');
    expect(source).toContain("'candidate-message-send-error'");
  });

  test('a página da vaga apresenta o resultado da partilha numa live region', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'pages', 'vaga', '[id].js'),
      'utf8',
    );

    expect(source).toContain('shareWithClipboardFallback');
    expect(source).toContain(
      "role={shareFeedback.type === 'error' ? 'alert' : 'status'}",
    );
  });
});
