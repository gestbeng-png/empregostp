/**
 * Limites de caracteres dos campos do perfil do candidato.
 *
 * Vivem num módulo partilhado porque têm de valer nos dois lados: o formulário
 * usa-os no `maxLength` e no contador, e `/api/profile/update` volta a
 * aplicá-los antes de gravar — o `maxLength` do browser é só uma sugestão para
 * quem escreve, não uma garantia para quem recebe o pedido.
 *
 * Os textos longos seguem os valores já usados no gerador de CV
 * (lib/cvValidation.js), para o mesmo conteúdo caber nos dois sítios.
 */
export const CANDIDATE_PROFILE_LIMITS = {
  name: 80,
  headline: 120,
  phone: 24,
  location: 80,
  nationality: 60,
  maritalStatus: 40,
  linkedin: 200,
  website: 200,
  objectiveArea: 80,
  objectiveType: 60,
  objectiveAspiration: 600,
  bio: 1200,
  skills: 400,
  skillsSoft: 400,
  // Etiqueta individual: uma competência da lista ou uma ferramenta digital.
  skillTag: 40,
  education: 1500,
  languages: 400,
  certifications: 1000,
  experienceRole: 100,
  experienceCompany: 100,
  experiencePeriod: 60,
  experienceDescription: 800,
};

/**
 * Corta o texto no limite. Corta em vez de recusar de propósito: há perfis
 * antigos gravados antes destes limites, e recusar o pedido deixaria essas
 * pessoas sem conseguir guardar seja o que for até reescreverem o campo.
 */
export function limitarTexto(valor, maximo) {
  const texto = typeof valor === 'string' ? valor : String(valor ?? '');
  if (!Number.isFinite(maximo) || maximo <= 0) return texto;
  return texto.length > maximo ? texto.slice(0, maximo) : texto;
}

/** Quantos caracteres passam do limite (0 quando está dentro). */
export function excedenteDe(valor, maximo) {
  const usados = String(valor ?? '').length;
  return Math.max(0, usados - (Number(maximo) || 0));
}
