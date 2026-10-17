/**
 * F2.4/F2.5 — snapshot imutável da candidatura.
 *
 * Tudo passa por allowlists: um campo novo no perfil ou na vaga nunca entra
 * no snapshot sem ser acrescentado aqui. Ficam sempre de fora os campos
 * SENSITIVE (H7): data de nascimento, género, foto, expectativa salarial,
 * morada, documentos de identidade, nacionalidade — e, na vaga, os campos
 * internos (`JOB_INTERNAL_FIELDS`).
 */
import { JOB_INTERNAL_FIELDS } from '../jobs/internalFields';

export const SNAPSHOT_SCHEMA_VERSION = 1;
const MAX_TEXT = 4000;
const MAX_SHORT = 200;
const MAX_ITEMS = 30;

type Plain = Readonly<Record<string, unknown>>;

function text(value: unknown, max = MAX_SHORT): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function firstText(source: Plain, keys: readonly string[], max = MAX_SHORT) {
  for (const key of keys) {
    const value = text(source[key], max);
    if (value) return value;
  }
  return '';
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value.slice(0, MAX_ITEMS) : [];
}

function textList(value: unknown, max = MAX_SHORT): string[] {
  const items = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[\n,;]+/)
      : [];
  return [
    ...new Set(items.map((item) => text(item, max)).filter(Boolean)),
  ].slice(0, MAX_ITEMS);
}

function isRecord(value: unknown): value is Plain {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Datas legadas chegam como Timestamp, Date, ISO ou «2024-03». */
function dateText(value: unknown): string {
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  if (isRecord(value) && typeof value.toDate === 'function') {
    const date = (value.toDate as () => unknown)();
    return date instanceof Date && !Number.isNaN(date.getTime())
      ? date.toISOString()
      : '';
  }
  return text(value, 40);
}

export interface SnapshotExperience {
  title: string;
  organizationName: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
}
export interface SnapshotEducation {
  level: string;
  institution: string;
  field: string;
  startYear: string;
  endYear: string;
  completed: boolean | null;
}
export interface SharedContacts {
  email?: string;
  phone?: string;
  whatsapp?: string;
}
export interface CandidateSnapshot {
  schemaVersion: number;
  fullName: string;
  headline: string;
  summary: string;
  district: string | null;
  locality: string;
  availability: string;
  experiences: SnapshotExperience[];
  education: SnapshotEducation[];
  educationText: string;
  skills: string[];
  languages: { language: string; level: string }[];
  certifications: { name: string; issuer: string }[];
  contacts: SharedContacts;
}

function experienceOf(entry: Plain): SnapshotExperience {
  return {
    title: firstText(entry, ['title', 'cargo', 'position', 'role', 'funcao']),
    organizationName: firstText(entry, [
      'organizationName',
      'company',
      'empresa',
      'organization',
      'organizacao',
    ]),
    location: firstText(entry, ['location', 'localizacao', 'local', 'city']),
    startDate: dateText(
      entry.startDate ?? entry.inicio ?? entry.dataInicio ?? entry.from,
    ),
    endDate: dateText(entry.endDate ?? entry.fim ?? entry.dataFim ?? entry.to),
    current: entry.current === true || entry.atual === true,
    description: firstText(
      entry,
      ['description', 'descricao', 'responsibilities'],
      MAX_TEXT,
    ),
  };
}

function educationOf(entry: Plain): SnapshotEducation {
  return {
    level: firstText(entry, ['level', 'nivel', 'degree', 'grau']),
    institution: firstText(entry, [
      'institution',
      'instituicao',
      'school',
      'escola',
    ]),
    field: firstText(entry, ['field', 'area', 'curso', 'course']),
    startYear: text(entry.startYear ?? entry.anoInicio ?? entry.inicio, 10),
    endYear: text(entry.endYear ?? entry.anoFim ?? entry.fim, 10),
    completed:
      typeof entry.completed === 'boolean'
        ? entry.completed
        : typeof entry.concluido === 'boolean'
          ? entry.concluido
          : null,
  };
}

function hasContent(entry: Readonly<Record<string, unknown>>): boolean {
  return Object.values(entry).some(
    (value) => typeof value === 'string' && value.length > 0,
  );
}

/**
 * F2.5 — o candidato escolhe os contactos a partilhar; por defeito, os
 * verificados. Só se partilha o que existe na conta: um contacto inventado no
 * pedido nunca chega à empresa.
 */
export function selectSharedContacts(
  available: {
    email?: string;
    emailVerified: boolean;
    phone?: string;
    phoneVerified: boolean;
  },
  requested: readonly string[] | null | undefined,
): SharedContacts {
  const email = text(available.email, 320);
  const phone = text(available.phone, 32);
  const wanted = Array.isArray(requested)
    ? new Set(requested.filter((item) => typeof item === 'string'))
    : null;
  const choose = (channel: string, verified: boolean) =>
    wanted ? wanted.has(channel) : verified;
  const contacts: SharedContacts = {};
  if (email && choose('email', available.emailVerified)) contacts.email = email;
  if (phone && choose('phone', available.phoneVerified)) contacts.phone = phone;
  if (phone && wanted?.has('whatsapp')) contacts.whatsapp = phone;
  // Nunca enviar uma candidatura sem forma de contacto: recai no verificado.
  if (!contacts.email && !contacts.phone && !contacts.whatsapp) {
    if (email && available.emailVerified) contacts.email = email;
    else if (phone && available.phoneVerified) contacts.phone = phone;
  }
  return contacts;
}

export function buildCandidateSnapshot(input: {
  user: Plain;
  profile: Plain;
  district: string | null;
  contacts: SharedContacts;
}): CandidateSnapshot {
  const { user, profile } = input;
  const experiences = [...list(profile.experience), ...list(user.experience)]
    .filter(isRecord)
    .map(experienceOf)
    .filter((entry) => hasContent(entry as unknown as Plain))
    .slice(0, MAX_ITEMS);
  const educationEntries = list(profile.education)
    .filter(isRecord)
    .map(educationOf)
    .filter((entry) => hasContent(entry as unknown as Plain));
  const languages = list(profile.languages ?? user.languages)
    .map((entry) =>
      isRecord(entry)
        ? {
            language: firstText(entry, ['language', 'idioma', 'name']),
            level: firstText(entry, ['level', 'nivel']),
          }
        : { language: text(entry), level: '' },
    )
    .filter((entry) => entry.language);
  const certifications = list(profile.certifications)
    .map((entry) =>
      isRecord(entry)
        ? {
            name: firstText(entry, ['name', 'title', 'nome']),
            issuer: firstText(entry, ['issuer', 'entidade', 'institution']),
          }
        : { name: text(entry), issuer: '' },
    )
    .filter((entry) => entry.name);
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    fullName:
      firstText(user, ['fullName', 'name']) ||
      firstText(profile, ['fullName', 'name']),
    headline:
      firstText(profile, ['headline', 'profession']) ||
      firstText(user, ['headline', 'profession']),
    summary: firstText(
      profile,
      ['summary', 'bio', 'about', 'objectiveAspiration'],
      MAX_TEXT,
    ),
    district: input.district,
    locality:
      firstText(profile, ['locality', 'city', 'location']) ||
      firstText(user, ['location', 'localizacao', 'cidade']),
    availability: firstText(profile, ['availability', 'disponibilidade']),
    experiences,
    education: educationEntries,
    educationText:
      typeof profile.education === 'string'
        ? text(profile.education, MAX_TEXT)
        : '',
    skills: textList([
      ...textList(profile.skills),
      ...textList(profile.skillsHard),
      ...textList(profile.skillsSoft),
      ...textList(profile.digitalSkills),
      ...textList(user.skills),
    ]),
    languages,
    certifications,
    contacts: { ...input.contacts },
  };
}

/** Campos da vaga que o candidato viu. Tudo o resto (contadores, moderação,
 * campos internos, dados do dono) fica de fora. */
const JOB_SNAPSHOT_FIELDS = [
  'titulo',
  'title',
  'descricao',
  'description',
  'requisitos',
  'responsabilidades',
  'beneficios',
  'localizacao',
  'location',
  'district',
  'locality',
  'tipoContrato',
  'employmentType',
  'workMode',
  'remoto',
  'nivelExperiencia',
  'seniority',
  'escolaridade',
  'salarioDe',
  'salarioAte',
  'salaryType',
  'salaryMinMinor',
  'salaryMaxMinor',
  'salaryCurrency',
  'salaryPeriod',
  'categoria',
  'categoryId',
  'vagasDisponiveis',
  'vacanciesCount',
  'dataFecho',
  'applicationDeadline',
  'companyName',
  'empresaNome',
  'requiredDocuments',
  'requireCoverLetter',
] as const;

export function buildJobSnapshot(
  jobId: string,
  job: Plain,
  jobVersionId: string | null,
): Readonly<Record<string, unknown>> {
  const internal = new Set<string>(JOB_INTERNAL_FIELDS);
  const snapshot: Record<string, unknown> = {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    jobId,
    jobVersionId,
  };
  for (const field of JOB_SNAPSHOT_FIELDS) {
    if (internal.has(field) || !Object.hasOwn(job, field)) continue;
    const value = job[field];
    if (value === undefined || value === null || typeof value === 'function')
      continue;
    if (typeof value === 'string') snapshot[field] = value.slice(0, 20000);
    else if (typeof value === 'number' || typeof value === 'boolean')
      snapshot[field] = value;
    else if (isRecord(value) && typeof value.toDate === 'function')
      snapshot[field] = dateText(value);
    else snapshot[field] = JSON.parse(JSON.stringify(value));
  }
  return snapshot;
}

/** Respostas: só ids e valores simples, nunca objetos arbitrários do cliente. */
export function buildAnswersSnapshot(
  answers: unknown,
): { questionId: string; value: string | number | boolean | string[] }[] {
  return list(answers)
    .filter(isRecord)
    .map((entry) => {
      const questionId = text(entry.questionId ?? entry.id, 64);
      const raw = entry.value ?? entry.answer;
      const value =
        typeof raw === 'boolean' ||
        (typeof raw === 'number' && Number.isFinite(raw))
          ? raw
          : Array.isArray(raw)
            ? textList(raw)
            : text(raw, 2000);
      return { questionId, value };
    })
    .filter((entry) => entry.questionId);
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) deepFreeze(item);
    Object.freeze(value);
  }
  return value;
}
