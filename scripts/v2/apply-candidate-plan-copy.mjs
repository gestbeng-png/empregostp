// ADR-016 — textos dos planos de candidato no Firestore (`plans/{id}`), que
// sobrepõem os do código e ainda prometem «3 candidaturas/mês», «prioridade»,
// «currículo em destaque». CORRER SÓ NO DIA DO DEPLOY do código com a regra
// nova: antes disso o texto seria falso (o código em produção ainda limita).
//
//   node scripts/v2/apply-candidate-plan-copy.mjs            # dry-run
//   node scripts/v2/apply-candidate-plan-copy.mjs --apply    # backup + escreve
//   node scripts/v2/apply-candidate-plan-copy.mjs --restore  # repõe o anterior
//
// Preços, nomes e `isActive` não são tocados (decisão humana, A4).
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { cert, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { createJiti } from 'jiti';

import { loadEnv } from '../loadEnv.mjs';

loadEnv();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { CANDIDATE_PLAN_CATALOG } = await createJiti(import.meta.url).import(path.join(root, 'lib/candidateCatalog.js'));
const FIELDS = ['features', 'upgradeHighlights', 'summary', 'curriculoDestacado'];
const ACTOR = 'script:apply-candidate-plan-copy';
const mode = process.argv.includes('--restore') ? 'RESTORE' : process.argv.includes('--apply') ? 'APPLY' : 'DRY_RUN';
const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const db = getFirestore(initializeApp({ projectId, credential: cert({ projectId, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') }) }));
const report = { mode, items: [] };
for (const plan of CANDIDATE_PLAN_CATALOG) {
  const ref = db.collection('plans').doc(plan.id);
  const backupRef = db.collection('planCopyArchive').doc(plan.id);
  const outcome = await db.runTransaction(async (tx) => {
    const [doc, backup] = await Promise.all([tx.get(ref), tx.get(backupRef)]);
    if (mode === 'RESTORE') {
      if (!backup.exists) return 'NOTHING_TO_RESTORE';
      tx.set(ref, backup.data().previous, { merge: true });
      tx.delete(backupRef);
      return 'RESTORED';
    }
    const current = doc.data() || {};
    const next = Object.fromEntries(FIELDS.map((field) => [field, plan[field]]));
    if (FIELDS.every((field) => JSON.stringify(current[field]) === JSON.stringify(next[field]))) return 'ALREADY_APPLIED';
    if (mode === 'DRY_RUN') return 'WOULD_UPDATE';
    if (!backup.exists)
      tx.set(backupRef, { previous: Object.fromEntries(FIELDS.map((field) => [field, current[field] ?? null])), at: FieldValue.serverTimestamp(), by: ACTOR });
    tx.set(ref, { ...next, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.create(db.collection('auditLogs').doc(), { actorId: ACTOR, actorType: 'SYSTEM', action: 'plan_copy_updated', resourceType: 'Plan', resourceId: plan.id, metadata: { fields: FIELDS }, at: FieldValue.serverTimestamp() });
    return 'UPDATED';
  });
  report.items.push({ plan: plan.id, outcome });
}
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exit(0);
