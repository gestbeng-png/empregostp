import { projectPublicJob } from '../../../lib/publicJob';

describe('projeção pública de vagas', () => {
  test('mantém apenas dados públicos e remove respostas da avaliação', () => {
    const result = projectPublicJob({
      id: 'job-1',
      titulo: 'Engenheiro de software',
      descricao: 'Descrição pública',
      companyId: 'company-1',
      createdBy: 'admin-secret',
      createdByRole: 'admin',
      planId: 'pro',
      internalNotes: 'não publicar',
      skillsAssessment: {
        enabled: true,
        passingScore: 70,
        questions: [
          {
            id: 'q1',
            prompt: 'Qual é a resposta?',
            options: ['A', 'B'],
            correctOptionIndex: 1,
          },
        ],
      },
    });

    expect(result).toMatchObject({
      id: 'job-1',
      titulo: 'Engenheiro de software',
      descricao: 'Descrição pública',
      companyId: 'company-1',
      skillsAssessment: {
        enabled: true,
        passingScore: 70,
        questions: [
          {
            id: 'q1',
            prompt: 'Qual é a resposta?',
            options: ['A', 'B'],
          },
        ],
      },
    });
    expect(result.skillsAssessment?.questions[0]).not.toHaveProperty(
      'correctOptionIndex',
    );
    expect(result).not.toHaveProperty('createdBy');
    expect(result).not.toHaveProperty('createdByRole');
    expect(result).not.toHaveProperty('planId');
    expect(result).not.toHaveProperty('internalNotes');
  });

  test('preserva zero vagas, modalidade desconhecida e aliases públicos de TDR', () => {
    const result = projectPublicJob({
      id: 'job-legacy',
      vagasDisponiveis: 0,
      tdrPdf: 'https://example.com/tdr.pdf',
    });

    expect(result.vagasDisponiveis).toBe(0);
    expect(result.remoto).toBeNull();
    expect(result.tdrUrl).toBe('https://example.com/tdr.pdf');
  });
});
