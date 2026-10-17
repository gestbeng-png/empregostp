import { botao, factos, paragrafo, renderEmail } from './emailLayout.js';

// Confirmação enviada quando o candidato pede para apagar a conta. Diz a data
// exata e como voltar atrás: quem não fez o pedido tem 7 dias para reagir.

function formatDate(ms) {
  return new Intl.DateTimeFormat('pt-PT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Sao_Tome',
  }).format(new Date(ms));
}

export function accountDeletionRequestedEmail({
  executeAfterMs,
  site = 'https://empregostp.com',
}) {
  const data = formatDate(executeAfterMs);
  const definicoes = `${site}/dashboard/candidato?tab=settings`;
  const corpo =
    paragrafo(
      `Recebemos o pedido para eliminar a sua conta de candidato. A eliminação acontece a partir de <b style="color:#0f1b34;">${data}</b>.`,
    ) +
    factos([
      {
        etiqueta: 'Apagado',
        valor:
          'Perfil, CV, documentos, alertas, vagas guardadas e notificações',
      },
      {
        etiqueta: 'Anonimizado',
        valor: 'Candidaturas (as empresas veem «Candidato removido»)',
      },
      {
        etiqueta: 'Mantido',
        valor: 'Comprovativos de pagamento, pelo prazo fiscal',
      },
    ]) +
    paragrafo(
      'Mudou de ideias? Até essa data pode cancelar o pedido nas definições da conta.',
    ) +
    botao({ label: 'Cancelar o pedido', url: definicoes }) +
    paragrafo(
      'Se não foi você a pedir, entre na conta, cancele o pedido e altere a palavra-passe.',
      { suave: true },
    );

  return {
    subject: 'Pedido de eliminação da conta recebido',
    html: renderEmail({
      eyebrow: 'Conta',
      titulo: 'Pedido de eliminação recebido',
      preheader: `A conta será eliminada a partir de ${data}.`,
      corpo,
      site,
    }),
    text: `Recebemos o pedido para eliminar a sua conta de candidato. A eliminação acontece a partir de ${data}.\n\nApagado: perfil, CV, documentos, alertas, vagas guardadas e notificações.\nAnonimizado: candidaturas (as empresas veem «Candidato removido»).\nMantido: comprovativos de pagamento, pelo prazo fiscal.\n\nPara cancelar até essa data: ${definicoes}\n\nSe não foi você a pedir, entre na conta, cancele o pedido e altere a palavra-passe.`,
  };
}
