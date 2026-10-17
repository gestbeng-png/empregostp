import { getEffectiveJobStatus } from './jobExpiration';
import { isEmailConfigured, sendEmail, getDefaultFrom } from './email';
import { logServerError, logServerWarning } from './serverLog';
import { resolveBaseUrl } from './authEmails';
import { buildNewJobEmail } from './newJobEmail';
import { deliverJobAlerts } from './jobAlertDelivery';

/**
 * Difusão de uma vaga recém-publicada a todos os candidatos.
 *
 * Antes, apenas candidatos Premium com plano activo e com perfil considerado
 * compatível recebiam aviso, e só dentro da aplicação. O comportamento pedido é
 * outro: quando uma vaga é publicada, todos os candidatos ficam a saber, na
 * aplicação e por email.
 *
 * Duas decisões que vale a pena registar:
 *
 *  - **O aviso na aplicação vai a todos.** É uma notificação interna, que o
 *    utilizador vê quando entra, e não tem custo de entrega.
 *
 *  - **O email respeita `notifications.jobAlerts`.** Essa preferência já existe
 *    nas definições do candidato ("Vagas compatíveis com o seu perfil") e está
 *    ligada por omissão, pelo que quem nunca lhe tocou continua a receber.
 *    Ignorá-la seria enviar email a quem o desligou explicitamente.
 *
 * A difusão é idempotente: a vaga fica marcada com `candidatesNotifiedAt` e uma
 * segunda chamada não repete. Sem isso, uma vaga criada e depois aprovada em
 * moderação notificaria duas vezes.
 */

/** O Firestore aceita no máximo 500 operações por lote. */
const TAMANHO_LOTE = 450;

/** Gmail impõe limites de destinatários por mensagem; enviamos em blocos. */
const DESTINATARIOS_POR_EMAIL = 60;

function podeReceberEmail(candidato = {}, perfil = {}) {
  const definicoes = perfil.settings || candidato.settings || {};
  const jobAlerts = definicoes?.notifications?.jobAlerts;
  // Ausente significa "nunca mexeu": o valor por omissão é activo.
  return jobAlerts !== false;
}

export async function broadcastNewJob(
  adminApp,
  { job, jobId, req = null, force = false },
) {
  if (!jobId || !job)
    return { notificados: 0, emails: 0, ignorado: 'sem vaga' };

  // Só vagas efectivamente publicadas: uma vaga por moderar ou já expirada não
  // deve ser difundida.
  if (getEffectiveJobStatus(job) !== 'active') {
    return { notificados: 0, emails: 0, ignorado: 'vaga não publicada' };
  }

  const firestore = adminApp.firestore();
  const jobRef = firestore.collection('jobs').doc(String(jobId));

  if (!force && job.candidatesNotifiedAt) {
    return { notificados: 0, emails: 0, ignorado: 'já difundida' };
  }

  let candidatos;
  try {
    candidatos = await firestore
      .collection('users')
      .where('userType', '==', 'candidato')
      .get();
  } catch (error) {
    logServerError('new_job_broadcast.listar_candidatos_failed', error);
    return { notificados: 0, emails: 0, erro: true };
  }

  const alvos = candidatos.docs.filter((doc) => {
    const dados = doc.data() || {};
    // Contas suspensas não devem ser notificadas nem contactadas.
    return String(dados.status || 'active') === 'active';
  });

  if (!alvos.length) return { notificados: 0, emails: 0 };

  // --- Aviso dentro da aplicação, a todos ---
  const titulo = job.titulo || 'Nova vaga';
  const local = job.localizacao || 'São Tomé e Príncipe';
  let notificados = 0;

  for (let i = 0; i < alvos.length; i += TAMANHO_LOTE) {
    const bloco = alvos.slice(i, i + TAMANHO_LOTE);
    const lote = firestore.batch();
    bloco.forEach((doc) => {
      const ref = firestore.collection('notifications').doc();
      lote.set(ref, {
        userId: doc.id,
        title: 'Nova vaga publicada',
        message: `${titulo} — ${local}`,
        type: 'job',
        icon: '💼',
        read: false,
        relatedId: jobId,
        actionUrl: `/vaga/${jobId}`,
        createdAt: adminApp.firestore.FieldValue.serverTimestamp(),
      });
    });
    try {
      await lote.commit();
      notificados += bloco.length;
    } catch (error) {
      logServerError('new_job_broadcast.gravar_notificacoes_failed', error);
    }
  }

  // --- Email, a quem não o desligou ---
  let emails = 0;
  // Quem recebe aqui o aviso geral não recebe também o do alerta guardado.
  const avisadosPorEmail = new Set();
  let alertas = { matched: 0, sent: 0, failed: 0 };
  if (isEmailConfigured()) {
    const perfis = new Map();
    try {
      const ids = alvos.map((d) => d.id);
      for (let i = 0; i < ids.length; i += TAMANHO_LOTE) {
        const refs = ids
          .slice(i, i + TAMANHO_LOTE)
          .map((id) => firestore.collection('profiles').doc(id));
        const docs = await firestore.getAll(...refs);
        docs.forEach((d) => {
          if (d.exists) perfis.set(d.id, d.data() || {});
        });
      }
    } catch (error) {
      logServerWarning('new_job_broadcast.ler_perfis_failed', error);
    }

    const destinatarios = alvos
      .filter((doc) =>
        podeReceberEmail(doc.data() || {}, perfis.get(doc.id) || {}),
      )
      .map((doc) => String((doc.data() || {}).email || '').trim())
      .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));

    if (destinatarios.length) {
      const site = resolveBaseUrl(req);
      const { subject, html, text } = buildNewJobEmail({ job, jobId, site });

      for (let i = 0; i < destinatarios.length; i += DESTINATARIOS_POR_EMAIL) {
        const bloco = destinatarios.slice(i, i + DESTINATARIOS_POR_EMAIL);
        try {
          // Em cópia oculta: os candidatos não veem os endereços uns dos outros.
          await sendEmail({
            to: getDefaultFrom(),
            bcc: bloco,
            subject,
            html,
            text,
          });
          emails += bloco.length;
          bloco.forEach((email) => avisadosPorEmail.add(email.toLowerCase()));
        } catch (error) {
          logServerError('new_job_broadcast.enviar_email_failed', error);
        }
      }
    }

    // --- Alertas de vagas guardados (`jobAlerts`) que correspondem à vaga ---
    alertas = await deliverJobAlerts(adminApp, {
      job,
      jobId: String(jobId),
      skipEmails: avisadosPorEmail,
    });
  }

  try {
    await jobRef.set(
      {
        candidatesNotifiedAt: adminApp.firestore.FieldValue.serverTimestamp(),
        candidatesNotifiedCount: notificados,
      },
      { merge: true },
    );
  } catch (error) {
    logServerWarning('new_job_broadcast.marcar_difusao_failed', error);
  }

  return { notificados, emails, alertas };
}

export default broadcastNewJob;
