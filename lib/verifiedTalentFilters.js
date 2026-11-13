// Filtros sobre o resumo que já é público. Não lê currículo, contactos,
// preferências salariais nem campos reservados ao plano da empresa.
function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const EXPERIENCE_OPTIONS = [
  { value: '0-2', label: 'Até 2 anos' },
  { value: '3-5', label: '3 a 5 anos' },
  { value: '6-10', label: '6 a 10 anos' },
  { value: '10-plus', label: 'Mais de 10 anos' },
  { value: 'not-informed', label: 'Experiência não informada' },
];

export function getTalentCategory(candidate = {}) {
  const label = String(candidate.headline || '')
    .trim()
    .replace(/\s+/g, ' ');
  const value = normalize(label);
  return !value || value === 'profissional'
    ? { value: 'not-informed', label: 'Área não informada' }
    : { value, label };
}

export function getTalentExperience(candidate = {}) {
  const label = normalize(candidate.experienceLabel);
  const match = label.match(
    /(?:experiencia:\s*)?(?:mais de\s*)?(\d+(?:[.,]\d+)?)\s+anos?\b/,
  );
  if (!match) return 'not-informed';
  const years =
    Number(match[1].replace(',', '.')) + (label.includes('mais de') ? 1 : 0);
  if (years <= 2) return '0-2';
  if (years <= 5) return '3-5';
  if (years <= 10) return '6-10';
  return '10-plus';
}

export function getTalentFilterOptions(candidates = []) {
  const categories = new Map();
  const experienceCounts = new Map();
  for (const candidate of candidates) {
    const category = getTalentCategory(candidate);
    const existing = categories.get(category.value);
    categories.set(category.value, {
      ...category,
      count: (existing?.count || 0) + 1,
    });
    const experience = getTalentExperience(candidate);
    experienceCounts.set(
      experience,
      (experienceCounts.get(experience) || 0) + 1,
    );
  }
  return {
    categories: [...categories.values()].sort((a, b) =>
      a.label.localeCompare(b.label, 'pt'),
    ),
    experience: EXPERIENCE_OPTIONS.filter((option) =>
      experienceCounts.has(option.value),
    ).map((option) => ({
      ...option,
      count: experienceCounts.get(option.value),
    })),
  };
}

export function filterVerifiedTalents(
  candidates = [],
  { query = '', category = '', experience = '' } = {},
) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return candidates.filter((candidate) => {
    if (category && getTalentCategory(candidate).value !== category)
      return false;
    if (experience && getTalentExperience(candidate) !== experience)
      return false;
    const searchable = normalize(
      `${candidate.fullName || ''} ${candidate.headline || ''}`,
    );
    return terms.every((term) => searchable.includes(term));
  });
}
