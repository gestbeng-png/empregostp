// Verifica se o DNS de empregostp.com está pronto para receber (Zoho) e
// enviar (Brevo) email. Uso: npm run check:email-dns [dominio]
//
// Com BREVO_API_KEY definida, confirma também o estado de autenticação
// directamente na conta Brevo.
import { loadEnv } from './loadEnv.mjs';

loadEnv();

// As consultas vão por DNS-over-HTTPS em vez do resolvedor do sistema: este
// guarda em cache as respostas negativas, e logo a seguir a criar um registo
// continuava a dizer que não existia.
async function consultar(nome, tipo) {
  try {
    const resposta = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(nome)}&type=${tipo}`,
      { headers: { accept: 'application/dns-json' } },
    );
    if (!resposta.ok) return [];
    const { Answer = [] } = await resposta.json();
    return Answer.filter((r) => r.data).map((r) => r.data);
  } catch {
    return [];
  }
}

const dominio = process.argv[2] || process.env.EMAIL_DOMAIN || 'empregostp.com';
const OK = '\x1b[32m✔\x1b[0m';
const FALTA = '\x1b[31m✘\x1b[0m';
const AVISO = '\x1b[33m!\x1b[0m';

// Valores obtidos da API do Brevo para este domínio.
const DKIM_BREVO = [
  ['brevo1._domainkey', `b1.${dominio.replace(/\./g, '-')}.dkim.brevo.com`],
  ['brevo2._domainkey', `b2.${dominio.replace(/\./g, '-')}.dkim.brevo.com`],
];

let problemas = 0;

async function txt(nome) {
  // O DoH devolve os TXT com aspas à volta.
  return (await consultar(nome, 'TXT')).map((valor) =>
    valor.replace(/^"|"$/g, '').replace(/" "/g, ''),
  );
}

async function cname(nome) {
  return (await consultar(nome, 'CNAME')).map((valor) =>
    valor.replace(/\.$/, ''),
  );
}

async function mx(nome) {
  return (await consultar(nome, 'MX')).map((valor) => {
    const [prioridade, ...resto] = valor.split(' ');
    return {
      priority: Number(prioridade),
      exchange: resto.join(' ').replace(/\.$/, ''),
    };
  });
}

console.log(`\nDNS de ${dominio}\n${'─'.repeat(46)}`);

// --- Receção: MX do Zoho ---
const registosMx = await mx(dominio);
if (!registosMx.length) {
  problemas += 1;
  console.log(`${FALTA} MX: nenhum. O domínio não recebe email.`);
  console.log(
    '   Cloudflare: mx.zoho.eu (10), mx2.zoho.eu (20), mx3.zoho.eu (50)',
  );
} else {
  const zoho = registosMx.some((r) => /zoho/i.test(r.exchange));
  console.log(
    `${zoho ? OK : AVISO} MX: ${registosMx.map((r) => `${r.exchange} (${r.priority})`).join(', ')}`,
  );
  const prioridades = new Set(registosMx.map((r) => r.priority));
  if (registosMx.length > 1 && prioridades.size === 1) {
    console.log(
      `   ${AVISO} todas com a mesma prioridade (${[...prioridades][0]}): o correio vai para qualquer uma.`,
    );
    console.log(
      '      Recomendado: mx.zoho.eu=10, mx2.zoho.eu=20, mx3.zoho.eu=50',
    );
  }
}

// --- Envio: SPF ---
const registosTxt = await txt(dominio);
const spf = registosTxt.filter((valor) =>
  valor.toLowerCase().startsWith('v=spf1'),
);
if (spf.length === 0) {
  problemas += 1;
  console.log(`${FALTA} SPF: nenhum registo.`);
  console.log(
    '   Cloudflare TXT @: v=spf1 include:zoho.eu include:spf.brevo.com ~all',
  );
} else if (spf.length > 1) {
  problemas += 1;
  console.log(
    `${FALTA} SPF: ${spf.length} registos — anulam-se mutuamente. Junta tudo num só.`,
  );
} else {
  const temZoho = /include:zoho\.(eu|com)/i.test(spf[0]);
  const temBrevo = /include:spf\.(brevo|sendinblue)\.com/i.test(spf[0]);
  if (!temZoho || !temBrevo) problemas += 1;
  console.log(`${temZoho && temBrevo ? OK : FALTA} SPF: ${spf[0]}`);
  if (!temZoho) console.log('   Falta include:zoho.eu');
  if (!temBrevo) console.log('   Falta include:spf.brevo.com');
}

// --- Envio: DKIM do Brevo (CNAME, não TXT) ---
for (const [nome, esperado] of DKIM_BREVO) {
  const alvos = await cname(`${nome}.${dominio}`);
  const certo = alvos.some((alvo) => alvo.replace(/\.$/, '') === esperado);
  if (!certo) problemas += 1;
  console.log(
    `${certo ? OK : FALTA} DKIM Brevo ${nome}${certo ? '' : `: em falta (CNAME → ${esperado})`}`,
  );
}

// --- Posse do domínio no Brevo ---
const brevoCode = registosTxt.some((valor) => /^brevo-code:/i.test(valor));
if (!brevoCode) problemas += 1;
console.log(
  `${brevoCode ? OK : FALTA} TXT brevo-code${brevoCode ? '' : ': em falta'}`,
);

// --- Zoho ---
const zohoCode = registosTxt.some((valor) =>
  /^zoho-verification=/i.test(valor),
);
console.log(
  `${zohoCode ? OK : AVISO} TXT zoho-verification${zohoCode ? '' : ': não encontrado'}`,
);

const dkimZoho = await txt(`zoho._domainkey.${dominio}`);
console.log(
  dkimZoho.length
    ? `${OK} DKIM Zoho`
    : `${AVISO} DKIM Zoho: em falta (só afecta o que enviares do webmail Zoho, não o site)`,
);

// --- DMARC: o Brevo exige-o para autenticar o domínio ---
const dmarc = await txt(`_dmarc.${dominio}`);
if (!dmarc.length) problemas += 1;
console.log(
  dmarc.length
    ? `${OK} DMARC: ${dmarc[0]}`
    : `${FALTA} DMARC: em falta (o Brevo recusa autenticar sem ele)\n   Cloudflare TXT _dmarc: v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com`,
);

// --- Estado na conta Brevo ---
const chave = (process.env.BREVO_API_KEY || '').trim();
if (chave) {
  try {
    const resposta = await fetch(
      `https://api.brevo.com/v3/senders/domains/${dominio}`,
      {
        headers: { 'api-key': chave, accept: 'application/json' },
      },
    );
    if (resposta.ok) {
      const { authenticated, verified } = await resposta.json();
      const pronto = authenticated && verified;
      if (!pronto) problemas += 1;
      console.log(
        `${pronto ? OK : FALTA} Brevo: autenticado=${authenticated} verificado=${verified}` +
          (pronto
            ? ''
            : '  → carrega em "Verify" no painel depois de criares os registos'),
      );
    }
  } catch {
    console.log(`${AVISO} Não foi possível consultar a conta Brevo.`);
  }
}

console.log('─'.repeat(46));
if (problemas) {
  console.log(
    `${problemas} ponto(s) por resolver antes de o envio ser fiável.\n`,
  );
  process.exit(1);
}
console.log('DNS pronto para enviar e receber.\n');
