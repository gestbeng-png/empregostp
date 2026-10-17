/**
 * B9/B10 — taxonomias da vaga e correspondência com os valores do formulário
 * atual (`pages/dashboard/empresa/vaga/criar-vaga.js`). Slugs estáveis (SEO):
 * mudar um rótulo nunca muda o slug. O que não tem correspondência segura
 * fica `null` e vai para a fila de revisão — nunca se adivinha.
 */
import { normalizePlace } from '../geo/districts';

export const JOB_CATEGORIES = Object.freeze([
  { slug: 'administracao-secretariado', label: 'Administração e Secretariado' },
  { slug: 'contabilidade-financas', label: 'Contabilidade e Finanças' },
  { slug: 'banca-seguros', label: 'Banca e Seguros' },
  { slug: 'comercial-vendas', label: 'Comercial e Vendas' },
  { slug: 'atendimento-cliente', label: 'Atendimento ao Cliente' },
  { slug: 'hotelaria-restauracao', label: 'Hotelaria e Restauração' },
  { slug: 'turismo', label: 'Turismo' },
  { slug: 'agricultura', label: 'Agricultura (cacau, café, pimenta)' },
  { slug: 'pescas-mar', label: 'Pescas e Mar' },
  { slug: 'construcao-obras-publicas', label: 'Construção e Obras Públicas' },
  { slug: 'eletricidade-manutencao', label: 'Eletricidade e Manutenção' },
  {
    slug: 'transportes-logistica',
    label: 'Transportes e Logística (motoristas)',
  },
  { slug: 'saude', label: 'Saúde' },
  { slug: 'educacao-formacao', label: 'Educação e Formação' },
  { slug: 'tecnologias-informacao', label: 'Tecnologias de Informação' },
  { slug: 'telecomunicacoes', label: 'Telecomunicações' },
  { slug: 'energia-agua', label: 'Energia e Água' },
  { slug: 'comunicacao-marketing', label: 'Comunicação e Marketing' },
  { slug: 'direito', label: 'Direito' },
  { slug: 'recursos-humanos', label: 'Recursos Humanos' },
  {
    slug: 'cooperacao-desenvolvimento',
    label: 'Cooperação e Desenvolvimento (ONG/Internacional)',
  },
  { slug: 'investigacao', label: 'Investigação' },
  { slug: 'seguranca', label: 'Segurança' },
  { slug: 'limpeza-servicos-gerais', label: 'Limpeza e Serviços Gerais' },
  { slug: 'artes-cultura', label: 'Artes e Cultura' },
  { slug: 'outras', label: 'Outras' },
] as const);
export type JobCategorySlug = (typeof JOB_CATEGORIES)[number]['slug'];

/** Categorias do formulário atual → B10 (tabela em MIGRATIONS.md).
 * «Engenharia» é ampla demais (construção, eletricidade, TI…): revisão. */
const LEGACY_CATEGORY: Readonly<Record<string, JobCategorySlug | null>> = {
  'marketing digital': 'comunicacao-marketing',
  programacao: 'tecnologias-informacao',
  design: 'comunicacao-marketing',
  'gestao e administracao': 'administracao-secretariado',
  vendas: 'comercial-vendas',
  educacao: 'educacao-formacao',
  saude: 'saude',
  engenharia: null,
  financas: 'contabilidade-financas',
  'recursos humanos': 'recursos-humanos',
  juridico: 'direito',
  atendimento: 'atendimento-cliente',
  outros: 'outras',
};

export function mapLegacyCategory(value: unknown): JobCategorySlug | null {
  const key = normalizePlace(value);
  if (!key) return null;
  const direct = JOB_CATEGORIES.find(
    (category) =>
      category.slug === key.replace(/ /g, '-') ||
      normalizePlace(category.label) === key,
  );
  if (direct) return direct.slug;
  return Object.hasOwn(LEGACY_CATEGORY, key)
    ? (LEGACY_CATEGORY[key] ?? null)
    : null;
}

export const EMPLOYMENT_TYPES = [
  'TEMPO_INTEIRO',
  'TEMPO_PARCIAL',
  'CONTRATO_TERMO',
  'CONSULTORIA',
  'ESTAGIO',
  'PRIMEIRO_EMPREGO',
  'SAZONAL',
  'VOLUNTARIADO',
  'FREELANCE',
] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

const LEGACY_EMPLOYMENT: Readonly<Record<string, EmploymentType>> = {
  'tempo integral': 'TEMPO_INTEIRO',
  'tempo inteiro': 'TEMPO_INTEIRO',
  'meio periodo': 'TEMPO_PARCIAL',
  'tempo parcial': 'TEMPO_PARCIAL',
  contrato: 'CONTRATO_TERMO',
  'contrato a termo': 'CONTRATO_TERMO',
  estagio: 'ESTAGIO',
  freelance: 'FREELANCE',
  voluntariado: 'VOLUNTARIADO',
  consultoria: 'CONSULTORIA',
  'primeiro emprego': 'PRIMEIRO_EMPREGO',
  sazonal: 'SAZONAL',
};

export function mapLegacyEmploymentType(value: unknown): EmploymentType | null {
  const key = normalizePlace(value);
  if ((EMPLOYMENT_TYPES as readonly string[]).includes(String(value)))
    return value as EmploymentType;
  return LEGACY_EMPLOYMENT[key] ?? null;
}

export const SENIORITY = [
  'SEM_EXPERIENCIA',
  'JUNIOR',
  'INTERMEDIO',
  'SENIOR',
  'DIRECAO',
] as const;
export type Seniority = (typeof SENIORITY)[number];

/** «Especialista» não indica senioridade inequívoca: revisão. */
const LEGACY_SENIORITY: Readonly<Record<string, Seniority>> = {
  'junior 0 2 anos': 'JUNIOR',
  junior: 'JUNIOR',
  'pleno 2 5 anos': 'INTERMEDIO',
  pleno: 'INTERMEDIO',
  'senior 5 anos': 'SENIOR',
  senior: 'SENIOR',
  gestao: 'DIRECAO',
  'sem experiencia': 'SEM_EXPERIENCIA',
};

export function mapLegacySeniority(value: unknown): Seniority | null {
  return LEGACY_SENIORITY[normalizePlace(value)] ?? null;
}

export const EDUCATION_LEVELS = [
  'NENHUM',
  'ENSINO_BASICO',
  'ENSINO_SECUNDARIO',
  'TECNICO_PROFISSIONAL',
  'BACHARELATO',
  'LICENCIATURA',
  'POS_GRADUACAO',
  'MESTRADO',
  'DOUTORAMENTO',
] as const;
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

const LEGACY_EDUCATION: Readonly<Record<string, EducationLevel>> = {
  'ensino basico': 'ENSINO_BASICO',
  'ensino secundario': 'ENSINO_SECUNDARIO',
  licenciatura: 'LICENCIATURA',
  mestrado: 'MESTRADO',
  doutoramento: 'DOUTORAMENTO',
  'nao exigido': 'NENHUM',
};

export function mapLegacyEducation(value: unknown): EducationLevel | null {
  return LEGACY_EDUCATION[normalizePlace(value)] ?? null;
}
