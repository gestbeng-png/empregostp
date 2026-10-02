/**
 * Documentos exigidos numa candidatura.
 *
 * Metade da decisão é da empresa (escolhe ao criar a vaga) e metade é fixa: o
 * CV e os certificados são sempre pedidos. O candidato só entrega o que ainda
 * não tem no perfil — repetir uploads que já lá estão é a forma mais rápida de
 * fazer alguém desistir a meio.
 *
 * Partilhado entre o formulário da vaga, o modal de candidatura e a API, pela
 * mesma razão dos outros contratos: as regras têm de valer nos três sítios.
 */

/** Um CV com mais do que isto deixa de contar como atualizado. */
export const CV_FRESHNESS_MONTHS = 6;

export const OTHER_DOCUMENTS_LABEL_LIMIT = 120;

export const APPLICATION_DOCUMENT_TYPES = [
  {
    id: 'cv',
    label: 'Curriculum Vitae',
    hint: 'Atualizado nos últimos meses.',
    sempre: true,
  },
  {
    id: 'certificates',
    label: 'Certificados',
    hint: 'Certificados de formação ou habilitações.',
    sempre: true,
  },
  {
    id: 'criminal_record',
    label: 'Registo criminal',
    hint: 'Certificado de registo criminal.',
    sempre: false,
  },
  {
    id: 'medical_certificate',
    label: 'Atestado médico',
    hint: 'Atestado médico de aptidão.',
    sempre: false,
  },
  {
    id: 'id_document',
    label: 'BI ou passaporte',
    hint: 'Documento de identificação válido.',
    sempre: false,
  },
  {
    id: 'other',
    label: 'Outros documentos',
    hint: 'Descreva o que a vaga exige.',
    sempre: false,
    aceitaDescricao: true,
  },
];

/** Os que a empresa pode ligar e desligar ao criar a vaga. */
export const OPTIONAL_DOCUMENT_TYPES = APPLICATION_DOCUMENT_TYPES.filter(
  (tipo) => !tipo.sempre,
);

const IDS_VALIDOS = new Set(APPLICATION_DOCUMENT_TYPES.map((tipo) => tipo.id));
const SEMPRE = APPLICATION_DOCUMENT_TYPES.filter((tipo) => tipo.sempre).map(
  (tipo) => tipo.id,
);

/** Ficheiros que o candidato já tem guardados no perfil para este tipo. */
function ficheirosGuardados(profile, id) {
  const valor = profile?.documents?.[id];
  const lista = Array.isArray(valor) ? valor : valor ? [valor] : [];
  return lista.filter((item) => item?.url);
}

/**
 * O que segue com a candidatura para um tipo de documento: o que a pessoa
 * acabou de enviar, ou o que já estava no perfil.
 */
export function resolveDocumentPayload({ id, profile = {}, uploaded = {} }) {
  const agora = uploaded?.[id];
  const enviados = Array.isArray(agora) ? agora : agora ? [agora] : [];
  if (enviados.length) return enviados;

  if (id === 'certificates') {
    const doPerfil = Array.isArray(profile?.certificateFiles)
      ? profile.certificateFiles
          .filter((url) => typeof url === 'string' && url.trim())
          .map((url) => ({ url, name: 'Certificado do perfil' }))
      : [];
    return [...doPerfil, ...ficheirosGuardados(profile, id)];
  }

  if (id === 'cv') {
    return profile?.cvUrl
      ? [{ url: profile.cvUrl, name: profile.cvName || 'CV do perfil' }]
      : [];
  }

  return ficheirosGuardados(profile, id);
}

export function documentTypeById(id) {
  return APPLICATION_DOCUMENT_TYPES.find((tipo) => tipo.id === id) || null;
}

/**
 * Deixa a escolha da empresa na forma gravada na vaga. O CV e os certificados
 * entram sempre, mesmo que o pedido não os traga.
 */
export function normalizeRequiredDocuments(bruto = {}) {
  const pedidos = Array.isArray(bruto?.types) ? bruto.types : [];
  const tipos = [
    ...SEMPRE,
    ...pedidos.filter((id) => IDS_VALIDOS.has(id) && !SEMPRE.includes(id)),
  ];

  const semDuplicados = [...new Set(tipos)];
  const descricao = String(bruto?.otherLabel || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, OTHER_DOCUMENTS_LABEL_LIMIT);

  return {
    types: semDuplicados,
    // A descrição só faz sentido com "outros documentos" ligado.
    otherLabel: semDuplicados.includes('other') ? descricao : '',
  };
}

/** Um CV sem data é tratado como desatualizado: não dá para afirmar o contrário. */
export function isCvFresh(cvUpdatedAt, agora = new Date()) {
  if (!cvUpdatedAt) return false;
  const data = cvUpdatedAt instanceof Date ? cvUpdatedAt : new Date(cvUpdatedAt);
  if (Number.isNaN(data.getTime())) return false;
  if (data > agora) return false;

  const limite = new Date(agora);
  limite.setMonth(limite.getMonth() - CV_FRESHNESS_MONTHS);
  return data >= limite;
}

/**
 * O que esta candidatura precisa, já cruzado com o que o perfil tem.
 *
 * @returns {Array<{id, label, hint, satisfiedByProfile, needsUpload, reason}>}
 */
export function resolveDocumentRequirements({
  job = {},
  profile = {},
  agora = new Date(),
} = {}) {
  const { types, otherLabel } = normalizeRequiredDocuments(
    job?.requiredDocuments || {},
  );

  return types.map((id) => {
    const tipo = documentTypeById(id);
    const base = {
      id,
      label: id === 'other' && otherLabel ? otherLabel : tipo.label,
      hint: tipo.hint,
      satisfiedByProfile: false,
      reason: '',
    };

    if (id === 'cv') {
      const temCv = Boolean(profile?.cvUrl);
      const atual = isCvFresh(profile?.cvUpdatedAt, agora);
      if (temCv && atual) {
        return {
          ...base,
          satisfiedByProfile: true,
          needsUpload: false,
          reason: 'O CV do seu perfil está atualizado e segue com a candidatura.',
        };
      }
      return {
        ...base,
        needsUpload: true,
        reason: temCv
          ? `O CV do seu perfil tem mais de ${CV_FRESHNESS_MONTHS} meses. Envie uma versão atualizada.`
          : 'Ainda não tem CV no perfil.',
      };
    }

    if (id === 'certificates') {
      const doPerfil = [
        ...(Array.isArray(profile?.certificateFiles)
          ? profile.certificateFiles.filter(
              (url) => typeof url === 'string' && url.trim(),
            )
          : []),
        ...ficheirosGuardados(profile, 'certificates'),
      ];
      if (doPerfil.length > 0) {
        return {
          ...base,
          satisfiedByProfile: true,
          needsUpload: false,
          reason: `${doPerfil.length} certificado${doPerfil.length === 1 ? '' : 's'} do seu perfil seguem com a candidatura.`,
        };
      }
      return {
        ...base,
        needsUpload: true,
        reason: 'Ainda não tem certificados no perfil.',
      };
    }

    // Os restantes vêm do arquivo pessoal: documentos que a pessoa já entregou
    // numa candidatura anterior ficam guardados e não voltam a ser pedidos.
    const guardados = ficheirosGuardados(profile, id);
    if (guardados.length > 0) {
      return {
        ...base,
        satisfiedByProfile: true,
        needsUpload: false,
        reason: 'Já entregue numa candidatura anterior. Segue com esta.',
      };
    }

    return { ...base, needsUpload: true, reason: '' };
  });
}

/**
 * @returns {Record<string, string>} erros por documento em falta.
 */
export function validateApplicationDocuments(requisitos, entregues = {}) {
  const erros = {};

  for (const requisito of requisitos) {
    if (!requisito.needsUpload) continue;
    const valor = entregues?.[requisito.id];
    const temFicheiro = Array.isArray(valor)
      ? valor.some((item) => item?.url)
      : Boolean(valor?.url);
    if (!temFicheiro) {
      erros[requisito.id] = `Envie o documento: ${requisito.label}.`;
    }
  }

  return erros;
}
