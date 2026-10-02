import { escapeHtml } from './escapeHtml.js';

// Sistema de layout partilhado por todos os emails transacionais.
//
// Regras de email que este módulo já trata:
//   - Tabelas em vez de flex/grid: o Outlook não suporta layout moderno.
//   - CSS em linha nos elementos que têm de funcionar em todo o lado; o bloco
//     <style> só acrescenta melhorias (modo escuro, telemóvel).
//   - Sem imagens externas: o Gmail bloqueia-as por omissão e o logótipo é SVG,
//     formato que a maioria dos clientes de email não rende. Usamos texto.
//   - Preheader: o texto que o Gmail mostra ao lado do assunto na lista. Sem
//     ele, o Gmail vai buscar as primeiras palavras do corpo, o que costuma
//     dar resultados feios.

const TIPO =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

export const CORES = {
  fundo: '#eef2f9',
  superficie: '#ffffff',
  marcaEscura: '#14264f',
  marcaMaisEscura: '#0c1834',
  acento: '#d9ff3f',
  primaria: '#2f6edb',
  tinta: '#0f1b34',
  texto: '#48566f',
  suave: '#7a869c',
  borda: '#e5ebf5',
  painel: '#f5f8fd',
};

/**
 * Botão que funciona no Outlook (padding na âncora, não no elemento pai).
 *
 * A variante secundária serve para acções de apoio a seguir ao botão
 * principal (ex.: abrir o site quando o formulário já é o botão azul).
 */
export function botao({ label, url, variante = 'primaria' }) {
  const secundario = variante === 'secundaria';
  const fundo = secundario ? CORES.superficie : CORES.primaria;
  const cor = secundario ? CORES.tinta : '#ffffff';
  const contorno = secundario ? `border:1px solid ${CORES.borda};` : '';

  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:${secundario ? '10px' : '26px'} 0 4px;">
    <tr><td style="border-radius:10px;background:${fundo};${contorno}">
      <a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 26px;color:${cor};font-family:${TIPO};font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;">${escapeHtml(label)}</a>
    </td></tr>
  </table>`;
}

/** Lista de pares etiqueta/valor, alinhada — para dados de uma candidatura ou vaga. */
export function factos(itens = []) {
  const linhas = itens
    .filter((item) => item && item.valor)
    .map(
      ({ etiqueta, valor }) => `<tr>
        <td style="padding:9px 0;border-bottom:1px solid ${CORES.borda};color:${CORES.suave};font-family:${TIPO};font-size:13px;white-space:nowrap;vertical-align:top;">${escapeHtml(etiqueta)}</td>
        <td style="padding:9px 0 9px 18px;border-bottom:1px solid ${CORES.borda};color:${CORES.tinta};font-family:${TIPO};font-size:14px;font-weight:600;vertical-align:top;">${valor}</td>
      </tr>`,
    )
    .join('');

  return linhas
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 4px;border-collapse:collapse;">${linhas}</table>`
    : '';
}

/** Painel destacado com barra lateral — para citar a mensagem de alguém. */
export function painel(htmlInterno, { titulo = '' } = {}) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
    <tr>
      <td style="padding:18px 20px;background:${CORES.painel};border-left:3px solid ${CORES.primaria};border-radius:0 10px 10px 0;">
        ${titulo ? `<div style="margin-bottom:8px;color:${CORES.suave};font-family:${TIPO};font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;">${escapeHtml(titulo)}</div>` : ''}
        <div style="color:${CORES.tinta};font-family:${TIPO};font-size:15px;line-height:1.65;">${htmlInterno}</div>
      </td>
    </tr>
  </table>`;
}

/** Etiquetas curtas em linha (compatibilidade, prioridade, tempo de leitura). */
export function etiquetas(lista = []) {
  const itens = lista.filter(Boolean);
  if (!itens.length) return '';
  return `<div style="margin:4px 0 2px;">${itens
    .map(
      (texto) =>
        `<span style="display:inline-block;margin:0 6px 6px 0;padding:5px 11px;background:${CORES.painel};border:1px solid ${CORES.borda};border-radius:20px;color:${CORES.texto};font-family:${TIPO};font-size:12px;font-weight:600;">${escapeHtml(texto)}</span>`,
    )
    .join('')}</div>`;
}

export function paragrafo(texto, { suave = false } = {}) {
  const cor = suave ? CORES.suave : CORES.texto;
  const tamanho = suave ? 14 : 15;
  return `<p style="margin:0 0 14px;color:${cor};font-family:${TIPO};font-size:${tamanho}px;line-height:1.65;">${texto}</p>`;
}

/**
 * Compõe o email completo.
 *
 * @param {object} opcoes
 * @param {string} opcoes.eyebrow  Etiqueta pequena no topo (ex.: "Candidaturas").
 * @param {string} opcoes.titulo   Título grande no cabeçalho.
 * @param {string} [opcoes.preheader] Texto do resumo na lista do Gmail.
 * @param {string} opcoes.corpo    HTML do conteúdo (usar os helpers acima).
 * @param {string} [opcoes.rodape] Nota final em HTML (porquê recebeu, como sair).
 * @param {string} [opcoes.site]   URL do site, para a assinatura.
 */
export function renderEmail({
  eyebrow,
  titulo,
  preheader = '',
  corpo,
  rodape = '',
  site = 'https://empregostp.com',
}) {
  return `<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>${escapeHtml(titulo)}</title>
<style>
  @media (max-width:620px) {
    .envelope { padding:16px 10px !important; }
    .cabecalho { padding:26px 22px !important; }
    .conteudo { padding:26px 22px !important; }
    .titulo { font-size:22px !important; }
  }
  @media (prefers-color-scheme:dark) {
    .fundo { background:#0b1220 !important; }
    .cartao { background:#141d2e !important; }
    .titulo-conteudo, .valor { color:#eef2f9 !important; }
    .texto { color:#b9c4d6 !important; }
    .painel-escuro { background:#1b2537 !important; }
    .assinatura { color:#8794a8 !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${CORES.fundo};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" class="fundo" width="100%" cellpadding="0" cellspacing="0" style="background:${CORES.fundo};">
    <tr>
      <td class="envelope" align="center" style="padding:32px 14px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
          <tr>
            <td class="cabecalho" style="padding:30px 32px;background:${CORES.marcaEscura};background-image:linear-gradient(135deg,${CORES.marcaEscura},${CORES.marcaMaisEscura});border-radius:16px 16px 0 0;">
              <div style="color:${CORES.acento};font-family:${TIPO};font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;">EmpregoSTP${eyebrow ? ` &middot; ${escapeHtml(eyebrow)}` : ''}</div>
              <div class="titulo" style="margin-top:10px;color:#ffffff;font-family:${TIPO};font-size:25px;font-weight:800;line-height:1.25;">${escapeHtml(titulo)}</div>
            </td>
          </tr>
          <tr>
            <td class="conteudo cartao" style="padding:30px 32px;background:${CORES.superficie};border-radius:0 0 16px 16px;">
              ${corpo}
              ${
                rodape
                  ? `<div class="assinatura" style="margin-top:28px;padding-top:18px;border-top:1px solid ${CORES.borda};color:${CORES.suave};font-family:${TIPO};font-size:12px;line-height:1.7;">${rodape}</div>`
                  : ''
              }
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 12px 8px;">
              <a href="${escapeHtml(site)}" style="color:${CORES.suave};font-family:${TIPO};font-size:12px;text-decoration:none;">EmpregoSTP &middot; empregos em São Tomé e Príncipe</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export default renderEmail;
