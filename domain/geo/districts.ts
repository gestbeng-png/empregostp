/**
 * B2 — taxonomia geográfica oficial.
 *
 * `district` é um enum com slug estável (SEO); a ilha deriva do distrito e é
 * a unidade do matching (deslocação entre ilhas é cara e rara). Texto livre
 * antigo é mapeado por tabela; o que não se mapeia com segurança fica
 * `district = null` + `legacyLocation` para revisão no admin — nunca se
 * adivinha.
 */
export const ISLANDS = ['SAO_TOME', 'PRINCIPE'] as const;
export type Island = (typeof ISLANDS)[number];

export interface District {
  slug: string;
  name: string;
  island: Island | null;
  /** Sede e localidades inequívocas usadas para mapear texto livre. */
  places: readonly string[];
}

export const DISTRICTS: readonly District[] = Object.freeze([
  {
    slug: 'agua-grande',
    name: 'Água Grande',
    island: 'SAO_TOME',
    places: ['São Tomé', 'Cidade de São Tomé', 'Pantufo', 'Riboque'],
  },
  {
    slug: 'me-zochi',
    name: 'Mé-Zóchi',
    island: 'SAO_TOME',
    places: ['Trindade', 'Bombom', 'Batepá', 'Monte Café'],
  },
  {
    slug: 'cantagalo',
    name: 'Cantagalo',
    island: 'SAO_TOME',
    places: ['Santana', 'Água Izé', 'Ribeira Afonso'],
  },
  {
    slug: 'caue',
    name: 'Caué',
    island: 'SAO_TOME',
    places: ['São João dos Angolares', 'Angolares', 'Porto Alegre'],
  },
  {
    slug: 'lemba',
    name: 'Lembá',
    island: 'SAO_TOME',
    places: ['Neves', 'Santa Catarina'],
  },
  {
    slug: 'lobata',
    name: 'Lobata',
    island: 'SAO_TOME',
    places: ['Guadalupe', 'Santo Amaro', 'Micoló'],
  },
  {
    slug: 'principe',
    name: 'Região Autónoma do Príncipe',
    island: 'PRINCIPE',
    places: ['Príncipe', 'Ilha do Príncipe', 'Pagué', 'Santo António', 'Sundy'],
  },
  {
    slug: 'remoto',
    name: 'Remoto',
    island: null,
    places: ['Remoto', 'Remote', 'Teletrabalho', 'Trabalho remoto'],
  },
]);

export type DistrictSlug =
  | 'agua-grande'
  | 'me-zochi'
  | 'cantagalo'
  | 'caue'
  | 'lemba'
  | 'lobata'
  | 'principe'
  | 'remoto';

const BY_SLUG = new Map(DISTRICTS.map((district) => [district.slug, district]));

export function getDistrict(slug: string): District | undefined {
  return BY_SLUG.get(slug);
}

export function islandOf(slug: string): Island | null {
  return BY_SLUG.get(slug)?.island ?? null;
}

/** Minúsculas, sem acentos, hífens e pontuação como espaço. */
export function normalizePlace(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Referências ao país ou à ilha inteira não indicam um distrito.
const TOO_BROAD = new Set(
  [
    'São Tomé e Príncipe',
    'S. Tomé e Príncipe',
    'STP',
    'Ilha de São Tomé',
    'Todo o país',
    'Nacional',
  ].map(normalizePlace),
);

const PHRASES: readonly { phrase: string; slug: string }[] = DISTRICTS.flatMap(
  (district) =>
    [district.name, district.slug.replace(/-/g, ' '), ...district.places].map(
      (place) => ({ phrase: normalizePlace(place), slug: district.slug }),
    ),
)
  // Frases mais longas primeiro: "sao joao dos angolares" antes de "sao".
  .sort((a, b) => b.phrase.length - a.phrase.length);

export interface LocationMapping {
  district: DistrictSlug | null;
  legacyLocation: string | null;
  needsReview: boolean;
}

/** Mapeia localização antiga em texto livre (B2). */
export function mapLegacyLocation(value: unknown): LocationMapping {
  const original = String(value ?? '').trim();
  const text = normalizePlace(original);
  if (!text)
    return { district: null, legacyLocation: null, needsReview: false };
  if (TOO_BROAD.has(text))
    return { district: null, legacyLocation: original, needsReview: true };

  let remaining = ` ${text} `;
  const found = new Set<string>();
  for (const { phrase, slug } of PHRASES) {
    const needle = ` ${phrase} `;
    if (remaining.includes(needle)) {
      found.add(slug);
      remaining = remaining.split(needle).join(' ');
    }
  }
  // "São Tomé e Príncipe" já foi tratado; aqui "São Tomé, Água Grande" dá um
  // único distrito, mas "Trindade / Neves" dá dois → revisão.
  if (found.size !== 1)
    return { district: null, legacyLocation: original, needsReview: true };
  const [district] = [...found] as DistrictSlug[];
  return {
    district: district ?? null,
    legacyLocation: null,
    needsReview: false,
  };
}
