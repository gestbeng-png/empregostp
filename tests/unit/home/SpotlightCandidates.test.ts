import {
  buildSpotlightCandidate,
  compareSpotlightCandidates,
  fetchSpotlightCandidates,
  getInitials,
} from '../../../lib/spotlightCandidates';

type Docs = Record<string, Record<string, unknown>>;

// Firestore em memória: só o que `fetchSpotlightCandidates` usa (`where` com
// `==`, `get`, `doc` e `getAll`).
function fakeAdmin(collections: Record<string, Docs>) {
  const snapshot = (id: string, data?: Record<string, unknown>) => ({
    id,
    exists: Boolean(data),
    data: () => data,
  });
  const query = (name: string, filters: Array<[string, string, unknown]>) => ({
    where: (field: string, op: string, value: unknown) =>
      query(name, [...filters, [field, op, value]]),
    get: async () => ({
      docs: Object.entries(collections[name] || {})
        .filter(([, data]) =>
          filters.every(
            ([field, op, value]) => op === '==' && data[field] === value,
          ),
        )
        .map(([id, data]) => snapshot(id, data)),
    }),
    doc: (id: string) => ({ name, id }),
  });
  const db = {
    collection: (name: string) => query(name, []),
    getAll: async (...refs: Array<{ name: string; id: string }>) =>
      refs.map((ref) => snapshot(ref.id, collections[ref.name]?.[ref.id])),
  };
  return { firestore: () => db };
}

const PUBLICO = { settings: { privacy: { profileVisibility: 'public' } } };

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

  describe('leitura do Firestore', () => {
    test('inclui Premium sem flags e exclui planos expirados, perfis privados e suspensões', async () => {
      const premium = {
        userType: 'candidato',
        currentPlan: 'unlimited_candidato',
      };
      const admin = fakeAdmin({
        users: {
          premium: {
            ...premium,
            verified: false,
            verificationStatus: 'pending',
          },
          legado: { userType: 'candidato', planTierId: 'unlimited_candidato' },
          expirado: { ...premium, planEndDate: '2020-01-01' },
          privado: premium,
          suspenso: { ...premium, verificationDisabled: true },
          bloqueado: { ...premium, status: 'suspended' },
          empresa: { userType: 'empresa', currentPlan: 'unlimited_candidato' },
        },
        profiles: {
          premium: PUBLICO,
          legado: PUBLICO,
          privado: { settings: { privacy: { profileVisibility: 'private' } } },
        },
      });
      expect(
        (await fetchSpotlightCandidates(admin))
          .map((candidate) => candidate?.id)
          .sort(),
      ).toEqual(['legado', 'premium']);
    });

    test('usa a mesma regra de verificado que a página do candidato', async () => {
      const admin = fakeAdmin({
        users: {
          marcadoNoUser: {
            userType: 'candidato',
            fullName: 'Ana',
            verified: true,
          },
          soNoPerfil: { userType: 'candidato', fullName: 'Bruno' },
          rejeitado: {
            userType: 'candidato',
            fullName: 'Carla',
            verified: true,
          },
          privado: { userType: 'candidato', fullName: 'Dino', verified: true },
          empresa: { userType: 'empresa', fullName: 'Empresa X' },
        },
        profiles: {
          marcadoNoUser: PUBLICO,
          // Verificado só no perfil: antes ficava fora da home.
          soNoPerfil: { ...PUBLICO, verificationStatus: 'approved' },
          // A revisão rejeitou: a página do candidato dá 404, a home também
          // não o pode mostrar.
          rejeitado: { ...PUBLICO, verificationStatus: 'rejected' },
          privado: { settings: { privacy: { profileVisibility: 'private' } } },
          // Um perfil verificado de uma conta que não é candidato.
          empresa: { verified: true },
        },
      });

      const lista = await fetchSpotlightCandidates(admin);

      expect(lista.map((c) => c?.id).sort()).toEqual([
        'marcadoNoUser',
        'soNoPerfil',
      ]);
    });

    test('respeita o limite pedido', async () => {
      const admin = fakeAdmin({
        users: {
          a: { userType: 'candidato', verified: true },
          b: { userType: 'candidato', verified: true },
          c: { userType: 'candidato', verified: true },
        },
        profiles: { a: PUBLICO, b: PUBLICO, c: PUBLICO },
      });

      expect(await fetchSpotlightCandidates(admin, { limite: 2 })).toHaveLength(
        2,
      );
    });
  });
});
