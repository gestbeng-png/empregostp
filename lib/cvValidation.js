// Validação do formulário do gerador de CV.
//
// Funções puras, sem React: o formulário decide *quando* validar, este módulo
// decide *o que* é válido. Todas devolvem uma mensagem de erro em português ou
// string vazia quando o valor serve.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATA_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// Só valida os caracteres permitidos; o comprimento é verificado pela contagem
// de dígitos, para a mensagem poder distinguir "curto" de "com letras".
const TELEFONE_RE = /^\+?[\d\s().-]+$/;

export const IDADE_MINIMA = 14;
export const IDADE_MAXIMA = 100;
export const ANO_MINIMO = 1950;
const texto = (valor) => String(valor ?? '').trim();

/** Mês corrente em formato YYYY-MM, para comparações sem depender de fusos. */
export function mesAtual(hoje = new Date()) {
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
}

export function validarNome(valor) {
  const nome = texto(valor);
  if (!nome) return 'Indique o seu nome completo.';
  if (nome.length < 3) return 'O nome tem de ter pelo menos 3 caracteres.';
  if (nome.length > 80) return 'O nome não pode exceder 80 caracteres.';
  // Dígitos num nome são quase sempre erro de digitação.
  if (/\d/.test(nome)) return 'O nome não deve conter números.';
  if (!/\s/.test(nome)) return 'Escreva o nome completo (nome e apelido).';
  return '';
}

export function validarEmail(valor, { obrigatorio = false } = {}) {
  const email = texto(valor);
  if (!email) return obrigatorio ? 'Indique o seu email.' : '';
  if (!EMAIL_RE.test(email)) return 'Email inválido. Exemplo: nome@dominio.com';
  if (email.length > 160) return 'Email demasiado longo.';
  return '';
}

export function validarTelefone(valor) {
  const telefone = texto(valor);
  if (!telefone) return '';
  if (!TELEFONE_RE.test(telefone)) {
    return 'Telefone inválido. Use apenas números, espaços e +. Exemplo: +239 991 2345';
  }
  const digitos = telefone.replace(/\D/g, '');
  if (digitos.length < 7) return 'Telefone demasiado curto.';
  if (digitos.length > 15) return 'Telefone demasiado longo.';
  return '';
}

export function validarUrl(valor, { rotulo = 'endereço' } = {}) {
  const bruto = texto(valor);
  if (!bruto) return '';
  const comEsquema = /^https?:\/\//i.test(bruto) ? bruto : `https://${bruto}`;
  try {
    const url = new URL(comEsquema);
    if (!url.hostname.includes('.')) return `Indique um ${rotulo} válido.`;
    return '';
  } catch {
    return `Indique um ${rotulo} válido. Exemplo: https://exemplo.com`;
  }
}

export function validarLinkedin(valor) {
  const erro = validarUrl(valor, { rotulo: 'endereço do LinkedIn' });
  if (erro) return erro;
  const bruto = texto(valor);
  if (bruto && !/linkedin\./i.test(bruto)) {
    return 'O endereço não parece ser do LinkedIn.';
  }
  return '';
}

/**
 * Data completa (YYYY-MM-DD) usada na data de nascimento.
 *
 * O input type="date" já restringe o formato nos browsers modernos, mas o valor
 * chega na mesma como string e pode vir de um rascunho antigo ou de um browser
 * que mostre um campo de texto.
 */
export function validarDataNascimento(valor, { hoje = new Date() } = {}) {
  const bruto = texto(valor);
  if (!bruto) return '';
  if (!DATA_RE.test(bruto)) return 'Data inválida. Use o formato AAAA-MM-DD.';

  const [ano, mes, dia] = bruto.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  // Apanha datas como 2025-02-30, que passam na expressão regular.
  if (
    data.getUTCFullYear() !== ano ||
    data.getUTCMonth() !== mes - 1 ||
    data.getUTCDate() !== dia
  ) {
    return 'Essa data não existe no calendário.';
  }
  if (data.getTime() > hoje.getTime())
    return 'A data de nascimento não pode ser futura.';

  const idade = (hoje.getTime() - data.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (idade < IDADE_MINIMA)
    return `Tem de ter pelo menos ${IDADE_MINIMA} anos.`;
  if (idade > IDADE_MAXIMA) return 'Verifique o ano de nascimento.';
  return '';
}

/** Mês/ano (YYYY-MM) usado em experiência e formação. */
export function validarMes(
  valor,
  { permitirFuturo = false, hoje = new Date() } = {},
) {
  const bruto = texto(valor);
  if (!bruto) return '';
  if (!MES_RE.test(bruto)) return 'Data inválida. Use o formato AAAA-MM.';
  const ano = Number(bruto.slice(0, 4));
  if (ano < ANO_MINIMO) return `O ano deve ser posterior a ${ANO_MINIMO}.`;
  if (!permitirFuturo && bruto > mesAtual(hoje))
    return 'A data não pode ser futura.';
  return '';
}

/** O fim não pode anteceder o início. */
export function validarIntervalo(inicio, fim, { atual = false } = {}) {
  if (atual) return '';
  const de = texto(inicio);
  const ate = texto(fim);
  if (!de || !ate) return '';
  if (!MES_RE.test(de) || !MES_RE.test(ate)) return '';
  if (ate < de) return 'A data de fim é anterior à de início.';
  return '';
}

export function validarAno(valor, { hoje = new Date() } = {}) {
  const bruto = texto(valor);
  if (!bruto) return '';
  if (!/^\d{4}$/.test(bruto))
    return 'Indique o ano com 4 dígitos. Exemplo: 2019.';
  const ano = Number(bruto);
  if (ano < ANO_MINIMO) return `O ano deve ser posterior a ${ANO_MINIMO}.`;
  // Certificações podem estar agendadas para o ano seguinte.
  if (ano > hoje.getFullYear() + 1)
    return 'O ano não pode ser tão distante no futuro.';
  return '';
}

export function validarTextoLongo(
  valor,
  { minimo = 0, maximo = 2000, rotulo = 'texto' } = {},
) {
  const conteudo = texto(valor);
  if (!conteudo) return minimo > 0 ? `Preencha o ${rotulo}.` : '';
  if (conteudo.length < minimo)
    return `O ${rotulo} deve ter pelo menos ${minimo} caracteres.`;
  if (conteudo.length > maximo)
    return `O ${rotulo} não pode exceder ${maximo} caracteres.`;
  return '';
}

/**
 * Valida o formulário inteiro.
 *
 * @returns {{
 *   valido: boolean,
 *   erros: Record<string, string | Record<number, Record<string, string>>>,
 *   total: number
 * }}
 *   `erros` tem as chaves simples no topo e, para as listas, um objecto por
 *   índice: `{ experiences: { 0: { startDate: '...' } } }`.
 */
export function validarFormularioCv(form = {}, { hoje = new Date() } = {}) {
  const erros = {};
  const definir = (campo, mensagem) => {
    if (mensagem) erros[campo] = mensagem;
  };

  definir('fullName', validarNome(form.fullName));
  definir('email', validarEmail(form.email, { obrigatorio: true }));
  definir('phone', validarTelefone(form.phone));
  definir('birthDate', validarDataNascimento(form.birthDate, { hoje }));
  definir('linkedin', validarLinkedin(form.linkedin));
  definir('website', validarUrl(form.website, { rotulo: 'endereço do site' }));
  definir(
    'portfolio',
    validarUrl(form.portfolio, { rotulo: 'endereço do portefólio' }),
  );
  definir(
    'summary',
    validarTextoLongo(form.summary, { maximo: 1200, rotulo: 'resumo' }),
  );
  definir(
    'objective',
    validarTextoLongo(form.objective, { maximo: 600, rotulo: 'objetivo' }),
  );

  const lista = (chave, itens, validarItem) => {
    const porIndice = {};
    (Array.isArray(itens) ? itens : []).forEach((item, indice) => {
      const errosItem = validarItem(item);
      const limpos = Object.fromEntries(
        Object.entries(errosItem).filter(([, mensagem]) => mensagem),
      );
      if (Object.keys(limpos).length) porIndice[indice] = limpos;
    });
    if (Object.keys(porIndice).length) erros[chave] = porIndice;
  };

  lista('experiences', form.experiences, (item) => ({
    startDate: validarMes(item.startDate, { hoje }),
    endDate:
      validarMes(item.endDate, { hoje }) ||
      validarIntervalo(item.startDate, item.endDate, { atual: item.current }),
    description: validarTextoLongo(item.description, {
      maximo: 1500,
      rotulo: 'descrição',
    }),
  }));

  lista('educationEntries', form.educationEntries, (item) => ({
    // A formação pode ter uma conclusão prevista.
    startDate: validarMes(item.startDate, { hoje }),
    endDate:
      validarMes(item.endDate, { permitirFuturo: true, hoje }) ||
      validarIntervalo(item.startDate, item.endDate),
    details: validarTextoLongo(item.details, {
      maximo: 1000,
      rotulo: 'detalhe',
    }),
  }));

  lista('certifications', form.certifications, (item) => ({
    year: validarAno(item.year, { hoje }),
  }));

  lista('projects', form.projects, (item) => ({
    link: validarUrl(item.link, { rotulo: 'endereço do projeto' }),
    summary: validarTextoLongo(item.summary, { maximo: 800, rotulo: 'resumo' }),
  }));

  const total = Object.values(erros).reduce(
    (soma, valor) =>
      soma +
      (typeof valor === 'string'
        ? 1
        : Object.values(valor).reduce((s, o) => s + Object.keys(o).length, 0)),
    0,
  );

  return { valido: total === 0, erros, total };
}

export default validarFormularioCv;
