import sanitizeHtml from 'sanitize-html';

/**
 * Sanitiza HTML de conteúdo editorial antes de ser injetado no DOM.
 *
 * Artigos do blog e barras de anúncio são escritos por administradores e
 * renderizados com `dangerouslySetInnerHTML`. Não havia sanitizador nem CSP,
 * pelo que qualquer conta com acesso de edição — ou qualquer escrita indevida
 * na coleção — podia guardar `<script>` ou handlers `on*` e executá-los no
 * browser de todos os visitantes, incluindo anónimos.
 *
 * A limpeza é feita no servidor, no ponto em que o conteúdo é lido: assim o
 * HTML perigoso nunca chega sequer ao cliente, e não é preciso um sanitizador
 * no browser.
 */
const ALLOWED_TAGS = [
  'a', 'blockquote', 'br', 'code', 'div', 'em', 'figcaption', 'figure',
  'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'li', 'ol', 'p', 'pre',
  'span', 'strong', 'sub', 'sup', 'table', 'tbody', 'td', 'th', 'thead',
  'tr', 'u', 'ul', 'b',
];

const ALLOWED_ATTRIBUTES = {
  a: ['href', 'name', 'target', 'rel', 'title'],
  img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
  '*': ['class'],
};

const OPTIONS = {
  allowedAttributes: ALLOWED_ATTRIBUTES,
  // Só estes esquemas: bloqueia `javascript:` e `vbscript:`.
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  allowedTags: ALLOWED_TAGS,
  // Links externos não devem poder manipular a janela de origem.
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
  },
};

export function sanitizeRichHtml(value) {
  const raw = typeof value === 'string' ? value : '';
  if (!raw) return '';
  return sanitizeHtml(raw, OPTIONS);
}

export default sanitizeRichHtml;
