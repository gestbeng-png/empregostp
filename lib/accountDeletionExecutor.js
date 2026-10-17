// Execução dos pedidos de eliminação de conta já vencidos (H5).
//
// Cada passo é idempotente: se algo falhar a meio, o pedido continua PENDING
// com `lastError` e a execução seguinte do cron recomeça sem duplicar efeitos.
// A conta só passa a DONE (e o login é apagado) depois de todos os passos.
import {
  buildDeletedUserTombstone,
  candidateStoragePrefixes,
  getPendingDeletion,
  isDeletionDue,
  planApplicationAnonymization,
} from './accountDeletion';
import { logServerError } from './serverLog';

const BATCH_LIMIT = 400;

async function deleteQueryInBatches(db, query) {
  let deleted = 0;
  // Sem cursor: cada volta apaga o que leu, por isso a consulta seguinte
  // devolve os próximos documentos.
  for (;;) {
    const snapshot = await query.limit(BATCH_LIMIT).get();
    if (snapshot.empty) return deleted;
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += snapshot.size;
    if (snapshot.size < BATCH_LIMIT) return deleted;
  }
}

async function deleteStoragePrefix(bucket, prefix) {
  const [files] = await bucket.getFiles({ prefix });
  await Promise.all(files.map((file) => file.delete({ ignoreNotFound: true })));
  return files.length;
}

async function anonymizeApplications(adminApp, db, uid, nowMs) {
  const snapshot = await db
    .collection('applications')
    .where('candidateId', '==', uid)
    .get();
  const nowIso = new Date(nowMs).toISOString();
  const serverTimestamp = adminApp.firestore.FieldValue.serverTimestamp();
  let withdrawn = 0;

  for (const doc of snapshot.docs) {
    await db.runTransaction(async (transaction) => {
      const fresh = await transaction.get(doc.ref);
      if (!fresh.exists) return;
      const data = fresh.data() || {};
      if (data.candidateRemoved === true) return;

      const plan = planApplicationAnonymization(data, nowIso);
      transaction.update(doc.ref, {
        ...plan.update,
        updatedAt: serverTimestamp,
        ...(plan.withdraw
          ? {
              withdrawnAt: serverTimestamp,
              lastStatusChangeAt: serverTimestamp,
            }
          : {}),
      });
      if (plan.withdraw && plan.from) {
        // Candidaturas v2: histórico e evento como em qualquer transição.
        transaction.create(db.collection('applicationsStatusHistory').doc(), {
          entityId: doc.id,
          from: plan.from,
          to: 'WITHDRAWN',
          actorId: `system:account-deletion`,
          actorType: 'SYSTEM',
          reason: 'ACCOUNT_DELETED',
          at: serverTimestamp,
          version: plan.update.version,
        });
        transaction.create(db.collection('outboxEvents').doc(), {
          type: 'entity_status_changed',
          schemaVersion: 1,
          payload: {
            entityId: doc.id,
            entityKind: 'Application',
            version: plan.update.version,
          },
          status: 'PENDING',
          attempts: 0,
          createdAtMs: nowMs,
          nextAttemptAtMs: nowMs,
        });
      }
      if (plan.withdraw) withdrawn += 1;
    });
  }
  return {
    total: snapshot.size,
    withdrawn,
    ids: snapshot.docs.map((d) => d.id),
  };
}

export async function executeAccountDeletion(
  adminApp,
  uid,
  nowMs = Date.now(),
) {
  const db = adminApp.firestore();
  const userRef = db.collection('users').doc(uid);
  const userDoc = await userRef.get();
  const userData = userDoc.exists ? userDoc.data() : null;
  const deletion = getPendingDeletion(userData);
  if (!deletion) return { skipped: true };

  const email = String(userData.email || '')
    .trim()
    .toLowerCase();

  // 1. Candidaturas: retirar as que estão em curso e anonimizar todas.
  const applications = await anonymizeApplications(adminApp, db, uid, nowMs);

  // 2. Ficheiros: pastas do candidato e cópias imutáveis das candidaturas.
  const bucket = adminApp.storage().bucket();
  let files = 0;
  for (const prefix of candidateStoragePrefixes(uid)) {
    files += await deleteStoragePrefix(bucket, prefix);
  }
  for (const applicationId of applications.ids) {
    files += await deleteStoragePrefix(
      bucket,
      `applicationSnapshots/${applicationId}/`,
    );
  }

  // 3. Dados pessoais noutras coleções.
  const collections = [
    db.collection('savedJobs').where('candidateId', '==', uid),
    db.collection('notifications').where('userId', '==', uid),
    db.collection('push-subscriptions').where('userId', '==', uid),
    db.collection('verifications').where('uid', '==', uid),
    db.collection('candidateProfileViews').where('candidateId', '==', uid),
    db.collection('consents').where('userId', '==', uid),
    userRef.collection('formDrafts'),
  ];
  if (email) {
    collections.push(db.collection('jobAlerts').where('email', '==', email));
  }
  let documents = 0;
  for (const query of collections) {
    documents += await deleteQueryInBatches(db, query);
  }
  if (email) {
    await db
      .collection('newsletterSubscribers')
      .doc(email.replace(/[^a-z0-9]/g, '_'))
      .delete();
  }
  await db.collection('profiles').doc(uid).delete();

  // 4. Login: sem conta no Auth não há sessão possível.
  try {
    await adminApp.auth().deleteUser(uid);
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') throw error;
  }

  // 5. Registo mínimo (nome «Candidato removido» nas vistas antigas) e
  //    auditoria só com ids e contagens.
  await userRef.set(buildDeletedUserTombstone(nowMs, deletion));
  await db.collection('auditLogs').add({
    actorId: 'system:account-deletion',
    actorType: 'SYSTEM',
    action: 'account_deleted',
    resourceType: 'users',
    resourceId: uid,
    metadata: {
      applications: applications.total,
      applicationsWithdrawn: applications.withdrawn,
      files,
      documents,
    },
    at: adminApp.firestore.Timestamp.fromMillis(nowMs),
  });

  return {
    skipped: false,
    applications: applications.total,
    applicationsWithdrawn: applications.withdrawn,
    files,
    documents,
  };
}

export async function executeDueAccountDeletions(
  adminApp,
  { nowMs = Date.now(), limit = 25 } = {},
) {
  const db = adminApp.firestore();
  // Só uma condição de igualdade: dispensa índice composto. O volume de
  // pedidos pendentes é pequeno; o prazo filtra-se aqui.
  const snapshot = await db
    .collection('users')
    .where('deletion.status', '==', 'PENDING')
    .get();
  const due = snapshot.docs
    .filter((doc) => isDeletionDue(doc.data(), nowMs))
    .slice(0, limit);

  let executed = 0;
  let failed = 0;
  for (const doc of due) {
    try {
      const result = await executeAccountDeletion(adminApp, doc.id, nowMs);
      if (!result.skipped) executed += 1;
    } catch (error) {
      failed += 1;
      logServerError('account_deletion.execute_failed', error);
      await doc.ref
        .update({
          'deletion.lastError': String(error?.code || 'UNKNOWN').slice(0, 80),
          'deletion.lastAttemptAtMs': nowMs,
        })
        .catch(() => {});
    }
  }
  return { pending: snapshot.size, due: due.length, executed, failed };
}
