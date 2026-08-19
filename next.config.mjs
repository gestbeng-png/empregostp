/**
 * Cabeçalhos de segurança.
 *
 * A defesa principal contra HTML malicioso guardado é a sanitização no
 * servidor (`lib/sanitizeRichHtml.js`). A CSP é a segunda linha.
 *
 * Está dividida de propósito em duas políticas:
 *
 *  - a **aplicada** contém apenas directivas sem risco de partir a aplicação:
 *    bloqueiam plugins, injecção de `<base>`, enquadramento em sites terceiros
 *    e desvio de formulários. Nenhuma delas depende de saber todas as origens
 *    de scripts e estilos.
 *
 *  - a **Report-Only** contém a política completa, incluindo `script-src`.
 *    Fica a reportar sem bloquear para as origens em falta aparecerem antes de
 *    serem aplicadas. Não é possível endurecer já o `script-src`: o Next
 *    injecta scripts inline e `pages/_document.js` tem o bootstrap de tema,
 *    pelo que uma política sem `unsafe-inline` exigiria nonces por pedido —
 *    infraestrutura que este projeto (Pages Router, sem middleware) não tem.
 *
 * Depois de validar os relatórios, passar a política completa para
 * `Content-Security-Policy` e remover a variante Report-Only.
 */
const CSP_APLICADA = [
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join('; ');

const CSP_EM_OBSERVACAO = [
  "default-src 'self'",
  // 'unsafe-inline' e 'unsafe-eval' são exigidos pelo runtime do Next e pelo
  // SDK do Firebase; retirá-los exige a migração para nonces.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com https://apis.google.com https://accounts.google.com https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com",
  "font-src 'self' data: https://cdnjs.cloudflare.com https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.google.com https://firebasestorage.googleapis.com wss://*.firebaseio.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com",
  "frame-src 'self' https://accounts.google.com https://*.firebaseapp.com",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join('; ');

const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: CSP_APLICADA },
          {
            key: 'Content-Security-Policy-Report-Only',
            value: CSP_EM_OBSERVACAO,
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
