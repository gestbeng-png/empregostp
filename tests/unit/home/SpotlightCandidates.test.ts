import {
  buildSpotlightCandidate,
  compareSpotlightCandidates,
  getInitials,
} from '../../../lib/spotlightCandidates';

describe('candidatos verificados em destaque', () => {
  test('um perfil privado nunca entra na lista pública', () => {
    expect(
      buildSpotlightCandidate(
        'candidato-1',
        { fullName: 'Ana de Sousa' },
        { settings: { privacy: { profileVisibility: 'private' } } },
      ),
    ).toBeNull();
  });

  test('monta o cartão com o que a página mostra, e só isso', () => {
    const cartao = buildSpotlightCandidate(
      'candidato-2',
      {
        fullName: 'Carlos Neto',
        headline: 'Técnico de operações',
        photoUrl: 'https://exemplo.st/foto.png',
        bio: 'texto privado do currículo',
        phone: '+239 991 0000',
      },
      { settings: { privacy: { profileVisibility: 'public' } } },
    );

    expect(cartao).toMatchObject({
      id: 'candidato-2',
      fullName: 'Carlos Neto',
      headline: 'Técnico de operações',
      initials: 'CN',
      verified: true,
      profileVisibility: 'public',
    });
    // O cartão não transporta contactos nem o currículo.
    expect(cartao).not.toHaveProperty('phone');
    expect(cartao).not.toHaveProperty('bio');
  });

  test('sem nome nem título, usa textos neutros em vez de campos vazios', () => {
    const cartao = buildSpotlightCandidate('candidato-3', {}, {});

    expect(cartao?.fullName).toBe('Candidato verificado');
    expect(cartao?.headline).toBe('Profissional');
    expect(cartao?.experienceLabel).toBe('Perfil profissional verificado');
    // Sem definições gravadas, o perfil vale como visível só para empresas: o
    // cartão aparece, mas o clique passa pelo login.
    expect(cartao?.profileVisibility).toBe('recruiters');
  });

  test('conta os anos de experiência a partir dos períodos declarados', () => {
    const cartao = buildSpotlightCandidate(
      'candidato-4',
      {},
      {
        settings: { privacy: { profileVisibility: 'public' } },
        experiences: [{ period: '2018 - 2024' }],
      },
    );

    expect(cartao?.experienceLabel).toBe('Anos de experiência: 6 anos');
  });

  test('destacados primeiro, depois os mais recentes', () => {
    const lista = [
      { destaque: false, createdAt: '2026-01-01T00:00:00.000Z' },
      { destaque: false, createdAt: '2026-06-01T00:00:00.000Z' },
      { destaque: true, createdAt: '2025-01-01T00:00:00.000Z' },
    ];

    expect([...lista].sort(compareSpotlightCandidates)).toEqual([
      lista[2],
      lista[1],
      lista[0],
    ]);
  });

  test('as iniciais aguentam nomes com uma palavra ou vazios', () => {
    expect(getInitials('Maria Graça Neves')).toBe('MG');
    expect(getInitials('Ana')).toBe('A');
    expect(getInitials('')).toBe('ES');
  });
});
