import {
  CANDIDATE_PROFILE_LIMITS,
  excedenteDe,
  limitarTexto,
} from '../../../lib/candidateProfileLimits';

describe('limites de caracteres do perfil do candidato', () => {
  test('corta o texto que passa do limite e deixa o resto intacto', () => {
    expect(limitarTexto('a'.repeat(1500), 1200)).toHaveLength(1200);
    expect(limitarTexto('resumo curto', 1200)).toBe('resumo curto');
    expect(limitarTexto('exatamente10', 12)).toBe('exatamente10');
  });

  test('aguenta valores em falta sem rebentar', () => {
    expect(limitarTexto(undefined, 100)).toBe('');
    expect(limitarTexto(null, 100)).toBe('');
    expect(limitarTexto(42, 100)).toBe('42');
  });

  test('sem limite definido, o texto passa como está', () => {
    expect(limitarTexto('texto', undefined as unknown as number)).toBe('texto');
    expect(limitarTexto('texto', 0)).toBe('texto');
  });

  test('o excedente diz quantos caracteres sobram', () => {
    expect(excedenteDe('a'.repeat(1300), 1200)).toBe(100);
    expect(excedenteDe('curto', 1200)).toBe(0);
    expect(excedenteDe('', 1200)).toBe(0);
  });

  test('o resumo profissional segue o limite do gerador de CV', () => {
    expect(CANDIDATE_PROFILE_LIMITS.bio).toBe(1200);
    expect(CANDIDATE_PROFILE_LIMITS.objectiveAspiration).toBe(600);
    expect(CANDIDATE_PROFILE_LIMITS.experienceDescription).toBe(800);
  });

  test('todos os limites são positivos', () => {
    Object.entries(CANDIDATE_PROFILE_LIMITS).forEach(([campo, limite]) => {
      expect(typeof limite === 'number' && limite > 0).toBe(true);
      expect(campo).toEqual(expect.any(String));
    });
  });
});
