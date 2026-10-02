// Geração do PDF do currículo, em duas colunas: barra lateral escura com foto,
// contactos, competências e idiomas; coluna principal clara com as secções
// narrativas (perfil, experiência, formação, referências).
//
// Vive fora da página do gerador porque o formulário e o desenho do PDF são
// responsabilidades separadas — o formulário não muda quando o desenho muda.

const PAGINA = { largura: 595.28, altura: 841.89 }; // A4 em pontos

const LATERAL = 214; // largura da coluna escura
const PAD = 26; // margem interna da coluna escura
const PRINCIPAL_X = LATERAL + 38;
const MARGEM_DIREITA = 46;
const PRINCIPAL_L = PAGINA.largura - PRINCIPAL_X - MARGEM_DIREITA;
const TOPO = 52;
const FUNDO = PAGINA.altura - 50;

const COR = {
  lateral: [58, 58, 58],
  lateralClara: [180, 180, 180],
  lateralRegua: [95, 95, 95],
  branco: [255, 255, 255],
  tinta: [44, 44, 44],
  corpo: [82, 82, 82],
  suave: [132, 132, 132],
  regua: [199, 199, 199],
};

/** Níveis do QECR e rótulos comuns convertidos em fração para a barra. */
function nivelParaFracao(nivel) {
  const texto = String(nivel || '')
    .trim()
    .toLowerCase();
  if (!texto) return 0.6;
  const quadro = { a1: 0.2, a2: 0.35, b1: 0.5, b2: 0.68, c1: 0.85, c2: 0.97 };
  for (const [codigo, valor] of Object.entries(quadro)) {
    if (texto.includes(codigo)) return valor;
  }
  if (/nativ|matern/.test(texto)) return 1;
  if (/fluent/.test(texto)) return 0.92;
  if (/avanç|avanc/.test(texto)) return 0.82;
  if (/interm/.test(texto)) return 0.58;
  if (/bás|bas|inici|element/.test(texto)) return 0.3;
  return 0.6;
}

/**
 * Recorta a foto num círculo com cantos transparentes.
 *
 * A foto guardada é um JPEG quadrado com fundo branco: colada tal e qual sobre
 * a coluna escura via-se o quadrado. O PNG com alfa resolve, e o jsPDF suporta
 * transparência em PNG.
 */
/** Formato declarado no data URL — o jsPDF rejeita a imagem se não bater certo. */
function formatoDaImagem(dataUrl) {
  const tipo = /^data:image\/([a-z+]+);/i.exec(String(dataUrl || ''))?.[1];
  if (!tipo) return '';
  if (tipo === 'jpeg' || tipo === 'jpg') return 'JPEG';
  if (tipo === 'png') return 'PNG';
  if (tipo === 'webp') return 'WEBP';
  return '';
}

async function recortarEmCirculo(dataUrl) {
  if (!dataUrl) return '';
  // Fora do browser (testes, SSR) não há canvas: devolve a original.
  if (typeof document === 'undefined') return dataUrl;
  try {
    const imagem = await new Promise((resolver, rejeitar) => {
      const elemento = new Image();
      elemento.onload = () => resolver(elemento);
      elemento.onerror = rejeitar;
      elemento.src = dataUrl;
    });

    const lado = Math.min(imagem.width, imagem.height) || 512;
    const tela = document.createElement('canvas');
    tela.width = lado;
    tela.height = lado;
    const ctx = tela.getContext('2d');
    if (!ctx) return '';

    ctx.beginPath();
    ctx.arc(lado / 2, lado / 2, lado / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    const escala = Math.max(lado / imagem.width, lado / imagem.height);
    const largura = imagem.width * escala;
    const altura = imagem.height * escala;
    ctx.drawImage(
      imagem,
      (lado - largura) / 2,
      (lado - altura) / 2,
      largura,
      altura,
    );

    return tela.toDataURL('image/png');
  } catch {
    return dataUrl;
  }
}

/**
 * Gera e devolve o documento jsPDF pronto a gravar.
 *
 * @param {object} cv Documento normalizado pelo gerador (cvDocument).
 * @param {object} [opcoes]
 * @param {(url: string) => string} [opcoes.normalizarUrl] Para tornar os links clicáveis.
 */
export async function gerarCvPdf(
  cv,
  {
    normalizarUrl = (valor) => valor,
    prepararFoto = async (valor) => valor,
  } = {},
) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  // A foto do perfil pode ser um URL remoto: tem de ser convertida em data URL
  // antes de tocar no canvas, senão este fica "sujo" e o recorte falha.
  let foto = '';
  if (cv.photo) {
    try {
      foto = await recortarEmCirculo(await prepararFoto(cv.photo));
    } catch {
      foto = '';
    }
  }
  const formatoFoto = formatoDaImagem(foto);

  // --- infraestrutura de páginas -------------------------------------------
  function pintarLateral() {
    doc.setFillColor(...COR.lateral);
    doc.rect(0, 0, LATERAL, PAGINA.altura, 'F');
  }

  function garantirPagina(numero) {
    while (doc.getNumberOfPages() < numero) {
      doc.addPage();
      doc.setPage(doc.getNumberOfPages());
      pintarLateral();
    }
  }

  pintarLateral();

  // Duas colunas fluem de forma independente: cada uma tem o seu cursor e a
  // sua página corrente, e ambas podem transbordar sem afectar a outra.
  const lateral = { pagina: 1, y: TOPO };
  const principal = { pagina: 1, y: TOPO };

  function espaco(coluna, altura) {
    if (coluna.y + altura <= FUNDO) return;
    coluna.pagina += 1;
    coluna.y = TOPO;
    garantirPagina(coluna.pagina);
  }

  function selecionar(coluna) {
    garantirPagina(coluna.pagina);
    doc.setPage(coluna.pagina);
  }

  /**
   * Parte o texto em linhas para uma dada largura.
   *
   * O tamanho tem de ser passado: o jsPDF mede com a fonte activa no momento,
   * portanto partir antes de a definir produz quebras calculadas com o tamanho
   * da chamada anterior (tipicamente o do título, muito maior).
   */
  const partir = (texto, largura, { tamanho, peso = 'normal' } = {}) => {
    if (tamanho) {
      doc.setFont('helvetica', peso);
      doc.setFontSize(tamanho);
    }
    return doc.splitTextToSize(String(texto || ''), largura);
  };

  // --- ícones vectoriais ----------------------------------------------------
  // Desenhados à mão: incorporar uma fonte de ícones acrescentaria centenas de
  // KB ao pacote para meia dúzia de glifos.
  function icone(tipo, x, y, tamanho = 8) {
    doc.setDrawColor(...COR.lateralClara);
    doc.setFillColor(...COR.lateralClara);
    doc.setLineWidth(0.9);
    const m = tamanho / 2;

    if (tipo === 'telefone') {
      doc.roundedRect(x + 1.5, y - m, tamanho - 3, tamanho, 1.4, 1.4, 'S');
      doc.line(x + 2.6, y - m + 2, x + tamanho - 2.6, y - m + 2);
    } else if (tipo === 'email') {
      doc.rect(x, y - m + 0.6, tamanho, tamanho - 1.6, 'S');
      doc.line(x, y - m + 0.6, x + m, y + 0.8);
      doc.line(x + tamanho, y - m + 0.6, x + m, y + 0.8);
    } else if (tipo === 'local') {
      doc.circle(x + m, y - 1.4, m - 1.4, 'S');
      doc.circle(x + m, y - 1.4, 0.9, 'F');
      doc.line(x + m - 1.8, y + 0.6, x + m, y + m - 0.4);
      doc.line(x + m + 1.8, y + 0.6, x + m, y + m - 0.4);
    } else if (tipo === 'ligacao') {
      doc.circle(x + m, y - 0.6, m - 0.6, 'S');
      doc.line(x, y - 0.6, x + tamanho, y - 0.6);
      doc.ellipse(x + m, y - 0.6, m / 2.3, m - 0.6, 'S');
    }
  }

  // --- primitivas da coluna escura -----------------------------------------
  function tituloLateral(texto) {
    espaco(lateral, 78);
    selecionar(lateral);
    lateral.y += 12;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    doc.setTextColor(...COR.branco);
    doc.text(String(texto), PAD, lateral.y);
    doc.setDrawColor(...COR.lateralRegua);
    doc.setLineWidth(0.8);
    doc.line(PAD, lateral.y + 6, LATERAL - PAD, lateral.y + 6);
    lateral.y += 20;
  }

  function contactoLateral(tipo, texto, url) {
    const valor = String(texto || '').trim();
    if (!valor) return;
    const larguraTexto = LATERAL - PAD * 2 - 14;
    const linhas = partir(valor, larguraTexto, { tamanho: 8.6 });
    espaco(lateral, linhas.length * 11 + 6);
    selecionar(lateral);

    icone(tipo, PAD, lateral.y - 2.6, 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.6);
    doc.setTextColor(...COR.lateralClara);
    linhas.forEach((linha, indice) => {
      doc.text(linha, PAD + 14, lateral.y + indice * 10.6);
    });

    const destino = normalizarUrl(url || '');
    if (destino && /^https?:\/\//.test(destino)) {
      doc.link(PAD + 14, lateral.y - 8, larguraTexto, linhas.length * 10.6, {
        url: destino,
      });
    }
    lateral.y += linhas.length * 10.6 + 6;
  }

  function listaLateral(itens) {
    itens.forEach((item) => {
      const linhas = partir(item, LATERAL - PAD * 2 - 10, { tamanho: 9.2 });
      espaco(lateral, linhas.length * 11 + 4);
      selecionar(lateral);
      doc.setFillColor(...COR.lateralClara);
      doc.circle(PAD + 2, lateral.y - 2.6, 1.5, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.2);
      doc.setTextColor(...COR.lateralClara);
      linhas.forEach((linha, indice) => {
        doc.text(linha, PAD + 10, lateral.y + indice * 11);
      });
      lateral.y += linhas.length * 11 + 4;
    });
  }

  function idiomasLateral(idiomas) {
    idiomas.forEach((idioma) => {
      espaco(lateral, 24);
      selecionar(lateral);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.4);
      doc.setTextColor(...COR.lateralClara);
      doc.text(String(idioma.title || ''), PAD, lateral.y);

      const larguraBarra = 76;
      const x = LATERAL - PAD - larguraBarra;
      doc.setFillColor(...COR.lateralRegua);
      doc.rect(x, lateral.y - 5.4, larguraBarra, 4.2, 'F');
      doc.setFillColor(...COR.branco);
      doc.rect(
        x,
        lateral.y - 5.4,
        larguraBarra * nivelParaFracao(idioma.meta),
        4.2,
        'F',
      );
      lateral.y += 17;
    });
  }

  // --- primitivas da coluna principal ---------------------------------------
  function tituloPrincipal(texto) {
    espaco(principal, 104);
    selecionar(principal);
    principal.y += 14;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...COR.tinta);
    doc.text(String(texto), PRINCIPAL_X, principal.y);
    const larguraTitulo = doc.getTextWidth(String(texto));
    doc.setDrawColor(...COR.regua);
    doc.setLineWidth(1);
    doc.line(
      PRINCIPAL_X + larguraTitulo + 14,
      principal.y - 4.5,
      PAGINA.largura - MARGEM_DIREITA,
      principal.y - 4.5,
    );
    principal.y += 21;
  }

  function paragrafoPrincipal(
    texto,
    { tamanho = 9.6, cor = COR.corpo, altura = 13.2 } = {},
  ) {
    const linhas = partir(texto, PRINCIPAL_L, { tamanho });
    if (!linhas.length) return;
    linhas.forEach((linha) => {
      espaco(principal, altura);
      selecionar(principal);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(tamanho);
      doc.setTextColor(...cor);
      doc.text(linha, PRINCIPAL_X, principal.y);
      principal.y += altura;
    });
  }

  /** Entrada com título à esquerda, período à direita e descrição por baixo. */
  function entradaPrincipal({
    titulo,
    subtitulo,
    periodo,
    descricao,
    marcas = [],
  }) {
    espaco(principal, 34);
    selecionar(principal);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.4);
    const larguraPeriodo = periodo ? doc.getTextWidth(periodo) + 12 : 0;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.4);
    doc.setTextColor(...COR.tinta);
    const linhasTitulo = partir(titulo, PRINCIPAL_L - larguraPeriodo, {
      tamanho: 11.4,
      peso: 'bold',
    });
    linhasTitulo.forEach((linha, indice) => {
      doc.text(linha, PRINCIPAL_X, principal.y + indice * 13.4);
    });

    if (periodo) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.4);
      doc.setTextColor(...COR.suave);
      doc.text(periodo, PAGINA.largura - MARGEM_DIREITA, principal.y, {
        align: 'right',
      });
    }
    principal.y += linhasTitulo.length * 13.4;

    if (subtitulo) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.4);
      doc.setTextColor(...COR.suave);
      partir(subtitulo, PRINCIPAL_L, { tamanho: 9.4 }).forEach((linha) => {
        doc.text(linha, PRINCIPAL_X, principal.y);
        principal.y += 12;
      });
    }

    principal.y += 4;
    if (descricao) paragrafoPrincipal(descricao);

    marcas.forEach((marca) => {
      const linhas = partir(marca, PRINCIPAL_L - 12, { tamanho: 9.4 });
      espaco(principal, linhas.length * 12.6 + 2);
      selecionar(principal);
      doc.setFillColor(...COR.suave);
      doc.circle(PRINCIPAL_X + 2.4, principal.y - 2.8, 1.5, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.4);
      doc.setTextColor(...COR.corpo);
      linhas.forEach((linha, indice) => {
        doc.text(linha, PRINCIPAL_X + 11, principal.y + indice * 12.6);
      });
      principal.y += linhas.length * 12.6 + 2;
    });

    principal.y += 13;
  }

  /** Referências em duas colunas, como no modelo. */
  function referenciasPrincipal(itens) {
    const larguraColuna = (PRINCIPAL_L - 22) / 2;
    for (let i = 0; i < itens.length; i += 2) {
      const par = itens.slice(i, i + 2);
      const blocos = par.map((item) =>
        partir(item, larguraColuna, { tamanho: 9.5 }),
      );
      const alturaBloco =
        Math.max(...blocos.map((linhas) => linhas.length)) * 12.6 + 12;

      espaco(principal, alturaBloco);
      selecionar(principal);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(...COR.corpo);
      blocos.forEach((linhas, indice) => {
        const x = PRINCIPAL_X + indice * (larguraColuna + 22);
        linhas.forEach((linha, n) => {
          doc.text(linha, x, principal.y + n * 12.6);
        });
      });
      principal.y += alturaBloco;
    }
  }

  // --- COLUNA ESCURA --------------------------------------------------------
  // Sem formato reconhecido não se arrisca o addImage: preferimos um CV sem
  // foto a um erro que impede a exportação inteira.
  if (foto && formatoFoto) {
    const diametro = 118;
    const x = (LATERAL - diametro) / 2;
    // O anel só faz sentido por trás de uma foto já recortada (PNG com alfa).
    // Sem recorte a foto é quadrada e o anel apareceria a espreitar nos cantos.
    if (formatoFoto === 'PNG') {
      doc.setFillColor(...COR.lateralClara);
      doc.circle(
        LATERAL / 2,
        lateral.y + diametro / 2,
        diametro / 2 + 2.5,
        'F',
      );
    }
    try {
      doc.addImage(foto, formatoFoto, x, lateral.y, diametro, diametro);
      lateral.y += diametro + 26;
    } catch {
      lateral.y += 12;
    }
  } else {
    lateral.y += 12;
  }

  // Nome: primeiro em fino, apelidos a negrito, como no modelo.
  const partesNome = String(cv.fullName || '')
    .trim()
    .split(/\s+/);
  const primeiro = partesNome.shift() || '';
  const restante = partesNome.join(' ');
  const larguraNome = LATERAL - PAD * 2;

  const escreverNome = (texto, peso) => {
    if (!texto) return;
    const maiusculas = texto.toUpperCase();
    let tamanho = 23;
    doc.setFont('helvetica', peso);
    doc.setFontSize(tamanho);

    // Primeiro encolhe; a partir dos 15pt deixa de encolher e parte em linhas,
    // senão nomes longos ficavam ilegíveis ou transbordavam para fora da coluna.
    while (doc.getTextWidth(maiusculas) > larguraNome && tamanho > 15) {
      tamanho -= 0.5;
      doc.setFontSize(tamanho);
    }

    doc.setTextColor(...COR.branco);
    doc.splitTextToSize(maiusculas, larguraNome).forEach((linha) => {
      doc.text(linha, LATERAL / 2, lateral.y, { align: 'center' });
      lateral.y += tamanho + 3;
    });
    lateral.y += 2;
  };

  escreverNome(primeiro, 'normal');
  escreverNome(restante, 'bold');

  if (cv.headline) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...COR.lateralClara);
    partir(cv.headline, larguraNome, { tamanho: 11 }).forEach((linha) => {
      doc.text(linha, LATERAL / 2, lateral.y, { align: 'center' });
      lateral.y += 13;
    });
  }

  lateral.y += 14;

  contactoLateral('telefone', cv.personal.phone);
  contactoLateral('email', cv.personal.email, `mailto:${cv.personal.email}`);
  contactoLateral('local', cv.personal.location);
  [cv.personal.linkedin, cv.personal.website, cv.personal.portfolio]
    .filter(Boolean)
    .forEach((ligacao) => contactoLateral('ligacao', ligacao, ligacao));

  if (cv.profileItems?.length) {
    tituloLateral('Dados pessoais');
    listaLateral(cv.profileItems);
  }

  const competencias = [
    ...(cv.technicalSkills || []),
    ...(cv.digitalSkills || []),
    ...(cv.softSkills || []),
  ];
  if (competencias.length) {
    tituloLateral('Competências');
    listaLateral(competencias);
  }

  if (cv.languages?.length) {
    tituloLateral('Idiomas');
    idiomasLateral(cv.languages);
  }

  if (cv.interests?.length) {
    tituloLateral('Interesses');
    listaLateral(cv.interests);
  }

  // --- COLUNA PRINCIPAL -----------------------------------------------------
  if (cv.summary || cv.objective) {
    tituloPrincipal('Perfil');
    if (cv.summary) paragrafoPrincipal(cv.summary);
    if (cv.objective) {
      principal.y += 2;
      paragrafoPrincipal(cv.objective);
    }
  }

  if (cv.experiences?.length) {
    tituloPrincipal('Experiência');
    cv.experiences.forEach((item) => {
      const [periodo, ...local] = String(item.meta || '').split(' • ');
      entradaPrincipal({
        titulo: item.title,
        subtitulo: local.join(' • '),
        periodo,
        descricao: item.description,
        marcas: item.achievements || [],
      });
    });
  }

  if (cv.educationEntries?.length) {
    tituloPrincipal('Formação');
    cv.educationEntries.forEach((item) => {
      const [periodo, ...local] = String(item.meta || '').split(' • ');
      entradaPrincipal({
        titulo: item.title,
        subtitulo: local.join(' • '),
        periodo,
        descricao: item.description,
      });
    });
  }

  if (cv.projects?.length) {
    tituloPrincipal('Projetos');
    cv.projects.forEach((item) =>
      entradaPrincipal({
        titulo: item.title,
        subtitulo: item.meta,
        descricao: item.description,
      }),
    );
  }

  if (cv.certifications?.length) {
    tituloPrincipal('Certificações');
    cv.certifications.forEach((item) =>
      entradaPrincipal({ titulo: item.title, subtitulo: item.meta }),
    );
  }

  if (cv.references?.length) {
    tituloPrincipal('Referências');
    referenciasPrincipal(cv.references);
  }

  if (cv.additionalInfo?.length) {
    tituloPrincipal('Informações adicionais');
    cv.additionalInfo.forEach((item) => paragrafoPrincipal(`• ${item}`));
  }

  doc.setPage(1);
  doc.setProperties({
    title: `CV - ${cv.fullName}`,
    subject: 'Currículo gerado no EmpregoSTP',
    author: cv.fullName,
    creator: 'EmpregoSTP',
  });

  return doc;
}

export { nivelParaFracao };
export default gerarCvPdf;
