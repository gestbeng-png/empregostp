// Entrega dos alertas de vagas guardados (`jobAlerts`) quando uma vaga é
// publicada.
//
// Até aqui, ativar um alerta enviava só um email imediato com as vagas já
// publicadas — e esse email prometia «avisamos assim que surgir uma vaga», o
// que nunca acontecia. Esta entrega corre dentro de `broadcastNewJob`, que já
// é chamado em todos os caminhos que publicam uma vaga.
//
// Regras:
//  - um email por alerta cujos filtros correspondem à vaga (mesma função de
//    filtro do email imediato: `filterPublishedJobs`);
//  - nunca duas vezes a mesma vaga ao mesmo alerta (`notifiedJobIds`, marcado
//    antes do envio: preferimos perder um aviso a duplicá-lo);
//  - quem já recebe o aviso geral de nova vaga (candidato registado) não recebe
//    também o do alerta;
//  - cada envio tem um link de cancelamento próprio. Só se guarda o hash do
//    token, por isso cada envio gera um token novo e o cancelamento aceita os
//    últimos `MAX_REMEMBERED_TOKEN_HASHES`.
import { buildJobAlertEmail, filterPublishedJobs } from './jobAlertEmail';
import {
  buildJobAlertUnsubscribeUrl,
  createJobAlertUnsubscribeToken,
  getCanonicalJobAlertSiteUrl,
  hashJobAlertUnsubscribeToken,
} from './jobAlertSubscription';
import { sendEmail } from './email';
import { logServerError } from './serverLog';

export const MAX_REMEMBERED_TOKEN_HASHES = 10;
export const MAX_NOTIFIED_JOB_IDS = 100;

export function isJobAlertActive(alert = {}) {
  return alert.active !== false && alert.status !== 'unsubscribed';
}

export function shouldNotifyJobAlert(
  alert,
  job,
  jobId,
  skipEmails = new Set(),
) {
  if (!alert || !isJobAlertActive(alert)) return false;
  const email = String(alert.email || '')
    .trim()
    .toLowerCase();
  if (!email || skipEmails.has(email)) return false;
  if (
    Array.isArray(alert.notifiedJobIds) &&
    alert.notifiedJobIds.includes(jobId)
  ) {
    return false;
  }
  return (
    filterPublishedJobs([{ ...job, id: jobId }], alert.filters || {}).length ===
    1
  );
}

/** Hashes de cancelamento a guardar depois de um novo envio. */
export function nextUnsubscribeHashes(alert = {}, newHash) {
  const previous = Array.isArray(alert.unsubscribeTokenHashes)
    ? alert.unsubscribeTokenHashes
    : alert.unsubscribeTokenHash
      ? [alert.unsubscribeTokenHash]
      : [];
  return [...previous.filter((hash) => hash !== newHash), newHash].slice(
    -MAX_REMEMBERED_TOKEN_HASHES,
  );
}

export function nextNotifiedJobIds(alert = {}, jobId) {
  const previous = Array.isArray(alert.notifiedJobIds)
    ? alert.notifiedJobIds
    : [];
  return [...previous.filter((id) => id !== jobId), jobId].slice(
    -MAX_NOTIFIED_JOB_IDS,
  );
}

export async function deliverJobAlerts(
  adminApp,
  {
    job,
    jobId,
    skipEmails = new Set(),
    siteUrl = getCanonicalJobAlertSiteUrl(),
  },
) {
  const firestore = adminApp.firestore();
  let snapshot;
  try {
    // Só uma condição de igualdade: dispensa índice composto.
    snapshot = await firestore
      .collection('jobAlerts')
      .where('active', '==', true)
      .get();
  } catch (error) {
    logServerError('job_alert_delivery.listar_alertas_failed', error);
    return { matched: 0, sent: 0, failed: 0, erro: true };
  }

  const matching = snapshot.docs.filter((doc) =>
    shouldNotifyJobAlert(doc.data() || {}, job, jobId, skipEmails),
  );

  let sent = 0;
  let failed = 0;
  for (const doc of matching) {
    const alert = doc.data() || {};
    const token = createJobAlertUnsubscribeToken();
    const tokenHash = hashJobAlertUnsubscribeToken(token);
    const now = adminApp.firestore.FieldValue.serverTimestamp();

    try {
      await doc.ref.set(
        {
          unsubscribeTokenHashes: nextUnsubscribeHashes(alert, tokenHash),
          notifiedJobIds: nextNotifiedJobIds(alert, jobId),
          lastNotifiedAt: now,
          updatedAt: now,
        },
        { merge: true },
      );
    } catch (error) {
      failed += 1;
      logServerError('job_alert_delivery.marcar_alerta_failed', error);
      continue;
    }

    const { subject, html, text } = buildJobAlertEmail({
      jobs: [{ ...job, id: jobId }],
      filters: alert.filters || {},
      baseUrl: siteUrl,
      unsubscribeUrl: buildJobAlertUnsubscribeUrl(doc.id, token, siteUrl),
    });
    try {
      await sendEmail({ to: alert.email, subject, html, text });
      sent += 1;
    } catch (error) {
      failed += 1;
      logServerError('job_alert_delivery.enviar_email_failed', error);
      await doc.ref
        .set({ lastDeliveryErrorAt: now }, { merge: true })
        .catch(() => {});
    }
  }

  return { matched: matching.length, sent, failed };
}
