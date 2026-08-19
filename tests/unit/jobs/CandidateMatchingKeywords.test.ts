import {
  analyzeCandidateJobFit,
  extractJobKeywords,
} from '../../../lib/candidateOptimizationInsights';

function normalized(values: string[]) {
  return values.map((value) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase(),
  );
}

describe('competências usadas no matching de candidato', () => {
  const job = {
    titulo: 'Gestor de Projetos Júnior',
    title: 'Gestor de Projetos Júnior',
    tipoContrato: 'Full-time',
    contractType: 'full-time',
    categoria: 'Tecnologia',
    palavrasChave: ['Scrum', 'scrum'],
    skills: ['React', 'REACT'],
    requisitos: 'Node.js, node.js; Liderança',
  };

  test('não trata o título nem o tipo de contrato como competências', () => {
    const keywords = extractJobKeywords(job);
    const values = normalized(keywords);

    expect(values).not.toContain('gestor de projetos junior');
    expect(values).not.toContain('full-time');
    expect(values).not.toContain('full time');
    expect(values).toEqual(expect.arrayContaining([
      'scrum',
      'react',
      'node.js',
      'lideranca',
    ]));
  });

  test('deduplica lacunas equivalentes, preservando a primeira grafia', () => {
    const keywords = extractJobKeywords(job);
    const values = normalized(keywords);
    expect(new Set(values).size).toBe(values.length);

    const fit = analyzeCandidateJobFit(
      job,
      {
        email: 'candidate@example.com',
        fullName: 'Pessoa Candidata',
        currentPlan: 'basic_candidato',
      },
      {
        objectiveArea: 'Tecnologia',
        skillsHard: ['React'],
      },
    );
    const gaps = normalized(fit.missingSkills);

    expect(new Set(gaps).size).toBe(gaps.length);
    expect(gaps).not.toContain('gestor de projetos junior');
    expect(gaps).not.toContain('full-time');
    expect(gaps.filter((item) => item === 'node.js')).toHaveLength(1);
  });
});
