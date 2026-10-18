/**
 * Contrato do formulário de candidatura.
 *
 * Vive num módulo partilhado pela mesma razão que `candidateProfileLimits`: as
 * regras têm de valer nos dois lados. O modal usa-as para o `maxLength`, os
 * contadores e o bloqueio do passo seguinte; `/api/applications` volta a
 * aplicá-las antes de gravar, porque nada do que vem do browser é garantia.
 *
 * As listas de opções também são partilhadas: o servidor recusa um valor que
 * não esteja na lista, em vez de gravar texto livre vindo do cliente.
 */

export const APPLICATION_FORM_LIMITS = {
  fullName: 80,
  email: 120,
  phone: 24,
  location: 80,
  nationality: 60,
  coverLetter: 2000,
  salaryExpectation: 12,
  educationDegree: 120,
  educationInstitution: 120,
  educationYear: 9,
  languageName: 40,
  referenceName: 80,
  referenceRole: 80,
  referenceCompany: 80,
  referenceContact: 120,
};

export const MAX_EDUCATION_ENTRIES = 5;
export const MAX_LANGUAGE_ENTRIES = 6;
export const MAX_REFERENCE_ENTRIES = 2;

export const WORK_AUTHORIZATION_OPTIONS = [
  { value: 'citizen', label: 'Cidadão são-tomense' },
  { value: 'resident', label: 'Residente com autorização de trabalho' },
  { value: 'permit_required', label: 'Preciso de autorização de trabalho' },
  { value: 'other', label: 'Outra situação' },
];

export const EXPERIENCE_YEARS_OPTIONS = [
  { value: 'none', label: 'Sem experiência' },
  { value: 'less_1', label: 'Menos de 1 ano' },
  { value: '1_3', label: '1 a 3 anos' },
  { value: '3_5', label: '3 a 5 anos' },
  { value: '5_10', label: '5 a 10 anos' },
  { value: '10_plus', label: 'Mais de 10 anos' },
];

export const AVAILABILITY_OPTIONS = [
  { value: 'immediate', label: 'Imediata' },
  { value: '15_days', label: 'Até 15 dias' },
  { value: '1_month', label: '1 mês' },
  { value: '2_months', label: '2 meses' },
  { value: '3_months_plus', label: '3 meses ou mais' },
];

export const LANGUAGE_LEVEL_OPTIONS = [
  { value: 'A1', label: 'A1 — Iniciante' },
  { value: 'A2', label: 'A2 — Básico' },
  { value: 'B1', label: 'B1 — Intermédio' },
  { value: 'B2', label: 'B2 — Intermédio alto' },
  { value: 'C1', label: 'C1 — Avançado' },
  { value: 'C2', label: 'C2 — Proficiente' },
  { value: 'native', label: 'Língua materna' },
];

export const REFERRAL_SOURCE_OPTIONS = [
  { value: 'empregostp', label: 'EmpregoSTP' },
  { value: 'social', label: 'Redes sociais' },
  { value: 'friend', label: 'Indicação de alguém' },
  { value: 'company_site', label: 'Site da empresa' },
  { value: 'other', label: 'Outro' },
];

const valoresDe = (opcoes) => opcoes.map((opcao) => opcao.value);

const texto = (valor, limite) => {
  const bruto = typeof valor === 'string' ? valor : String(valor ?? '');
  const limpo = bruto.trim().replace(/\s+/g, ' ');
  return limite && limpo.length > limite ? limpo.slice(0, limite) : limpo;
};

// A carta preserva os parágrafos: só o excesso de linhas em branco é colapsado.
const textoLongo = (valor, limite) => {
  const bruto = typeof valor === 'string' ? valor : String(valor ?? '');
  const limpo = bruto.trim().replace(/\n{3,}/g, '\n\n');
  return limite && limpo.length > limite ? limpo.slice(0, limite) : limpo;
};

const escolha = (valor, opcoes) =>
  valoresDe(opcoes).includes(valor) ? valor : '';

const lista = (valor, maximo) =>
  (Array.isArray(valor) ? valor : []).slice(0, maximo);

export function createEmptyApplicationForm() {
  return {
    fullName: '',
    email: '',
    phone: '',
    location: '',
    nationality: '',
    birthDate: '',
    workAuthorization: '',
    education: [{ degree: '', institution: '', year: '' }],
    languages: [{ language: '', level: '' }],
    coverLetter: '',
    experienceYears: '',
    availability: '',
    salaryExpectation: '',
    referralSource: '',
    references: [
      { name: '', role: '', company: '', contact: '' },
      { name: '', role: '', company: '', contact: '' },
    ],
    consentTruthful: false,
    consentDataProcessing: false,
    consentSimilarJobs: false,
    // { [tipoDeDocumento]: { url, name } | [{ url, name }] }
    documents: {},
  };
}

/** Deixa o formulário na forma exata que é gravada — usado nos dois lados. */
export function normalizeApplicationForm(bruto = {}) {
  const L = APPLICATION_FORM_LIMITS;

  return {
    fullName: texto(bruto.fullName, L.fullName),
    email: texto(bruto.email, L.email).toLowerCase(),
    phone: texto(bruto.phone, L.phone),
    location: texto(bruto.location, L.location),
    nationality: texto(bruto.nationality, L.nationality),
    birthDate: /^\d{4}-\d{2}-\d{2}$/.test(String(bruto.birthDate || ''))
      ? bruto.birthDate
      : '',
    workAuthorization: escolha(
      bruto.workAuthorization,
      WORK_AUTHORIZATION_OPTIONS,
    ),
    education: lista(bruto.education, MAX_EDUCATION_ENTRIES)
      .map((item) => ({
        degree: texto(item?.degree, L.educationDegree),
        institution: texto(item?.institution, L.educationInstitution),
        year: texto(item?.year, L.educationYear),
      }))
      .filter((item) => item.degree || item.institution || item.year),
    languages: lista(bruto.languages, MAX_LANGUAGE_ENTRIES)
      .map((item) => ({
        language: texto(item?.language, L.languageName),
        level: escolha(item?.level, LANGUAGE_LEVEL_OPTIONS),
      }))
      .filter((item) => item.language),
    coverLetter: textoLongo(bruto.coverLetter, L.coverLetter),
    experienceYears: escolha(bruto.experienceYears, EXPERIENCE_YEARS_OPTIONS),
    availability: escolha(bruto.availability, AVAILABILITY_OPTIONS),
    // Só dígitos: o valor é mostrado à empresa, não usado em contas.
    salaryExpectation: texto(bruto.salaryExpectation, L.salaryExpectation)
      .replace(/[^\d]/g, '')
      .slice(0, L.salaryExpectation),
    referralSource: escolha(bruto.referralSource, REFERRAL_SOURCE_OPTIONS),
    references: lista(bruto.references, MAX_REFERENCE_ENTRIES)
      .map((item) => ({
        name: texto(item?.name, L.referenceName),
        role: texto(item?.role, L.referenceRole),
        company: texto(item?.company, L.referenceCompany),
        contact: texto(item?.contact, L.referenceContact),
      }))
      .filter((item) => item.name || item.role || item.company || item.contact),
    consentTruthful: bruto.consentTruthful === true,
    consentDataProcessing: bruto.consentDataProcessing === true,
    consentSimilarJobs: bruto.consentSimilarJobs === true,
    documents: normalizeDocuments(bruto.documents),
  };
}

const DOCUMENT_NAME_LIMIT = 160;
const MAX_FILES_POR_DOCUMENTO = 8;

/** Fica só com `{ url, name }`: o resto do que o cliente mande é descartado. */
function normalizeFicheiro(valor) {
  const url = texto(valor?.url, 500);
  if (!url) return null;
  return { url, name: texto(valor?.name, DOCUMENT_NAME_LIMIT) || 'documento' };
}

export function normalizeDocuments(bruto) {
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return {};

  const resultado = {};
  for (const [id, valor] of Object.entries(bruto)) {
    if (Array.isArray(valor)) {
      const ficheiros = valor
        .slice(0, MAX_FILES_POR_DOCUMENTO)
        .map(normalizeFicheiro)
        .filter(Boolean);
      if (ficheiros.length) resultado[id] = ficheiros;
    } else {
      const ficheiro = normalizeFicheiro(valor);
      if (ficheiro) resultado[id] = ficheiro;
    }
  }
  return resultado;
}

/**
 * Os campos de cada passo, para o modal saber onde pousar o foco quando a
 * validação falha e para não deixar avançar com o passo por preencher.
 */
export const APPLICATION_FORM_STEPS = [
  {
    id: 'pessoais',
    title: 'Dados pessoais',
    fields: [
      'fullName',
      'email',
      'phone',
      'location',
      'nationality',
      'birthDate',
      'workAuthorization',
    ],
  },
  {
    id: 'formacao',
    title: 'Formação e idiomas',
    fields: ['education', 'languages'],
  },
  {
    id: 'experiencia',
    title: 'Experiência e motivação',
    fields: [
      'coverLetter',
      'experienceYears',
      'availability',
      'salaryExpectation',
      'referralSource',
    ],
  },
  { id: 'referencias', title: 'Referências', fields: ['references'] },
  {
    id: 'declaracao',
    title: 'Documentos e declaração',
    fields: ['documents', 'consentTruthful', 'consentDataProcessing'],
  },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Política do formulário de candidatura (F2.1/F2.3/F2.5/H7).
 *
 * Só nome, email, telefone e as duas declarações são obrigatórios. A carta é
 * opcional salvo se a vaga a exigir; as referências são opcionais (F6.1:
 * «disponíveis mediante pedido»). Data de nascimento e nacionalidade nunca
 * são pedidas nem guardadas (dado sensível; a autorização de trabalho já
 * cobre o que a empresa precisa) — ver `stripExcludedApplicationFields`.
 *
 * @param {object} formulario
 * @param {{ requireCoverLetter?: boolean }} [opcoes]
 * @returns {Record<string, string>} erros por campo; vazio quando está tudo bem.
 */
export function validateApplicationForm(
  formulario,
  { requireCoverLetter = false } = {},
) {
  const dados = normalizeApplicationForm(formulario);
  const erros = {};

  if (!dados.fullName) erros.fullName = 'Indique o seu nome completo.';
  if (!EMAIL_RE.test(dados.email)) erros.email = 'Indique um email válido.';
  if (dados.phone.replace(/\D/g, '').length < 6)
    erros.phone = 'Indique um telefone de contacto válido.';
  if (!dados.consentTruthful)
    erros.consentTruthful = 'Tem de confirmar que a informação é verdadeira.';
  if (!dados.consentDataProcessing)
    erros.consentDataProcessing =
      'Tem de autorizar o tratamento dos seus dados.';
  if (requireCoverLetter && !dados.coverLetter)
    erros.coverLetter = 'Esta vaga pede uma carta de motivação.';

  return erros;
}

/** O índice do primeiro passo com erro, para o modal saltar até lá. */
export function firstStepWithErrors(erros) {
  const indice = APPLICATION_FORM_STEPS.findIndex((passo) =>
    passo.fields.some((campo) => erros[campo]),
  );
  return indice === -1 ? null : indice;
}

/** Etiqueta legível de um valor de lista, para mostrar à empresa. */
export function labelDe(valor, opcoes) {
  return opcoes.find((opcao) => opcao.value === valor)?.label || '';
}

/** Campos que nunca são guardados numa candidatura (H7/F4.5). */
export const EXCLUDED_APPLICATION_FIELDS = Object.freeze([
  'birthDate',
  'nationality',
]);

export function stripExcludedApplicationFields(formulario) {
  const copia = { ...formulario };
  for (const campo of EXCLUDED_APPLICATION_FIELDS) delete copia[campo];
  return copia;
}
