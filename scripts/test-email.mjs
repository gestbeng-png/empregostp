// Envia um email de teste com a configuração atual (Brevo ou fallback Gmail).
// Uso: npm run test:email -- destinatario@exemplo.com
import { loadEnv } from './loadEnv.mjs';
import {
  isEmailConfigured,
  sendEmail,
  getDefaultFrom,
} from '../lib/email/index.js';

const API_BREVO = 'https://api.brevo.com/v3';

// A API do Brevo devolve 201 e um messageId mesmo quando vai recusar o envio
// por o remetente não estar validado. O 'Enviado' sozinho não prova nada:
// confirma-se antes que o remetente serve, e depois no registo de eventos.
async function remetenteValidado(chave, endereco) {
  const cabecalhos = { 'api-key': chave, accept: 'application/json' };

  // Um domínio autenticado valida qualquer endereço dele, mesmo que esse
  // endereço não conste da lista de remetentes individuais.
  const dominio = endereco.split('@')[1] || '';
  if (dominio) {
    const respostaDominio = await fetch(
      `${API_BREVO}/senders/domains/${dominio}`,
      { headers: cabecalhos },
    );
    if (respostaDominio.ok) {
      const { authenticated } = await respostaDominio.json();
      if (authenticated)
        return {
          validado: true,
          validos: [`*@${dominio} (domínio autenticado)`],
        };
    }
  }

  const resposta = await fetch(`${API_BREVO}/senders`, { headers: cabecalhos });
  if (!resposta.ok) return null;
  const { senders = [] } = await resposta.json();
  const encontrado = senders.find(
    (s) => s.email?.toLowerCase() === endereco.toLowerCase(),
  );
  return {
    validado: Boolean(encontrado?.active),
    validos: senders.filter((s) => s.active).map((s) => s.email),
  };
}

const EVENTOS_TERMINAIS = [
  'delivered',
  'error',
  'hardBounce',
  'softBounce',
  'blocked',
];

// Filtra pelo messageId deste envio: o destinatário tem eventos de testes
// anteriores, e apanhar o primeiro da lista dava por entregue um email antigo.
async function estadoDoEnvio(chave, destinatario, messageId) {
  for (let tentativa = 0; tentativa < 6; tentativa += 1) {
    await new Promise((resolver) => setTimeout(resolver, 5000));
    const resposta = await fetch(
      `${API_BREVO}/smtp/statistics/events?email=${encodeURIComponent(destinatario)}&limit=50`,
      { headers: { 'api-key': chave, accept: 'application/json' } },
    );
    if (!resposta.ok) return null;
    const { events = [] } = await resposta.json();
    const desteEnvio = events.filter(
      (e) => !messageId || e.messageId === messageId,
    );
    const terminal = desteEnvio.find((e) =>
      EVENTOS_TERMINAIS.includes(String(e.event)),
    );
    if (terminal) return terminal;
  }
  return null;
}

loadEnv();

const to =
  process.argv[2] || process.env.EMAIL_FROM_ADDRESS || process.env.GMAIL_USER;

if (!to) {
  console.error(
    'Indica o destinatário: npm run test:email -- alguem@exemplo.com',
  );
  process.exit(1);
}

if (!isEmailConfigured()) {
  console.error(
    'Email não configurado. Define BREVO_API_KEY (ou BREVO_SMTP_LOGIN/BREVO_SMTP_KEY) no .env.local.',
  );
  process.exit(1);
}

const via = process.env.BREVO_API_KEY
  ? 'Brevo (API HTTP)'
  : process.env.BREVO_SMTP_LOGIN
    ? 'Brevo (SMTP relay)'
    : 'Gmail SMTP (fallback)';
console.log(`A enviar via ${via}`);
console.log(`De:   ${getDefaultFrom()}`);
console.log(`Para: ${to}`);

const chaveBrevo = (process.env.BREVO_API_KEY || '').trim();
const remetente = getDefaultFrom().match(/<([^>]+)>/)?.[1] || '';

if (chaveBrevo) {
  const estado = await remetenteValidado(chaveBrevo, remetente);
  if (estado && !estado.validado) {
    console.error(
      `\nO Brevo não aceita ${remetente} como remetente: não está validado nem o domínio está autenticado.`,
    );
    console.error(
      estado.validos.length
        ? `Remetentes validados nesta conta: ${estado.validos.join(', ')}`
        : 'Não há nenhum remetente validado nesta conta.',
    );
    console.error(
      'Resolve em Brevo > Senders, Domains & Dedicated IPs (autenticar o domínio é o caminho definitivo).',
    );
    process.exit(1);
  }
}

try {
  const info = await sendEmail({
    to,
    subject: 'Teste de envio — EmpregoSTP',
    html: '<p>Se estás a ler isto, o envio de emails está a funcionar. 🎉</p>',
    text: 'Se estás a ler isto, o envio de emails está a funcionar.',
  });
  console.log(
    'Aceite pela API.',
    info?.messageId ? `messageId: ${info.messageId}` : '',
  );

  if (chaveBrevo) {
    console.log('A confirmar a entrega no registo do Brevo...');
    const evento = await estadoDoEnvio(chaveBrevo, to, info?.messageId);
    if (!evento) {
      console.log(
        'Sem evento terminal ainda. Confirma em https://app.brevo.com/statistics/email',
      );
    } else if (evento.event === 'delivered') {
      console.log(`ENTREGUE às ${evento.date}`);
    } else {
      console.error(
        `FALHOU (${evento.event})${evento.reason ? `: ${evento.reason}` : ''}`,
      );
      process.exit(1);
    }
  }
} catch (error) {
  console.error(`Falhou (${error.code || 'ERRO'}): ${error.message}`);
  process.exit(1);
}
