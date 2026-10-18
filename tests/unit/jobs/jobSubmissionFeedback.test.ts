import {
  describeJobSubmissionError,
  describeJobSubmissionSuccess,
} from '@/lib/jobSubmissionFeedback';

describe('editor de vagas — mensagens da API', () => {
  test('formato antigo continua igual', () => {
    expect(describeJobSubmissionError({ error: 'Limite do plano' }, 'x')).toBe(
      'Limite do plano',
    );
    expect(describeJobSubmissionError({ reason: 'Motivo' }, 'x')).toBe(
      'Motivo',
    );
    expect(describeJobSubmissionError(null, 'Falhou')).toBe('Falhou');
    expect(
      describeJobSubmissionSuccess(
        { warning: 'Data ajustada.' },
        'Vaga criada com sucesso!',
      ),
    ).toBe('Vaga criada com sucesso! Data ajustada.');
    // Legado com moderação: sem `suggestions`, a mensagem não muda.
    expect(
      describeJobSubmissionSuccess(
        { job: { status: 'pending_review' }, message: 'm' },
        'Vaga criada com sucesso!',
      ),
    ).toBe('Vaga criada com sucesso!');
  });

  test('F1.1: mostra os títulos para dividir', () => {
    expect(
      describeJobSubmissionError(
        {
          error: {
            code: 'JOB_MULTIPLE_ROLES',
            message: 'Cada anúncio deve corresponder a uma única função.',
          },
          splitTitles: ['Motorista', 'Cozinheiro'],
        },
        'x',
      ),
    ).toBe(
      'Cada anúncio deve corresponder a uma única função. Crie uma vaga para cada função: Motorista · Cozinheiro.',
    );
  });

  test('F1.2: mostra o que falta', () => {
    expect(
      describeJobSubmissionError(
        {
          error: {
            code: 'JOB_QUALITY_TOO_LOW',
            message: 'Complete a vaga antes de publicar. Falta:',
          },
          missing: [
            { label: 'Divulgue o salário' },
            { label: 'Indique 3 competências' },
          ],
        },
        'x',
      ),
    ).toBe(
      'Complete a vaga antes de publicar. Falta: Divulgue o salário; Indique 3 competências.',
    );
  });

  test('v2 em revisão mostra a mensagem do servidor e sugestões', () => {
    expect(
      describeJobSubmissionSuccess(
        {
          job: { status: 'pending_review' },
          message:
            'A sua vaga está em revisão. Normalmente demora até 1 dia útil.',
          suggestions: ['Divulgue o salário'],
        },
        'Vaga criada com sucesso!',
      ),
    ).toBe(
      'A sua vaga está em revisão. Normalmente demora até 1 dia útil. Para a tornar mais completa: Divulgue o salário.',
    );
  });
});
