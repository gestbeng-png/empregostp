// F9.1/F9.2 — despublicação aprovada pelo utilizador em 2026-10-10
// (docs/audits/CONTENT_AUDIT.md). Nada é apagado sem cópia: os documentos
// arquivados são copiados integralmente para `contentArchive/{coleção}__{id}`
// antes de saírem da coleção pública; as alterações de campos guardam o valor
// anterior. Cada alteração gera uma entrada em `auditLogs`.
//
//   node scripts/ops/unpublish-content.mjs            # dry-run (só lê)
//   node scripts/ops/unpublish-content.mjs --apply    # escreve
//   node scripts/ops/unpublish-content.mjs --restore  # repõe a partir do arquivo
//
// Funciona com o código já em produção (sem deploy): `/recursos` não filtra
// `resources_*` por estado, por isso arquivar é a única forma de esconder; as
// notícias já respeitam `status: draft`.
import { writeFile } from 'node:fs/promises';

import { cert, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

import { loadEnv } from '../loadEnv.mjs';

loadEnv();
const ACTOR = 'script:unpublish-content-2026-10-10';
const PLAN = [
  {
    collection: 'resources_guides',
    id: 'g8rBWnDmdu6nnjsiPNlF',
    action: 'archive',
    reason: 'PLACEHOLDER',
  },
  {
    collection: 'resources_premium',
    id: 'ol4l7Akp0rZtbuqnnWl8',
    action: 'archive',
    reason: 'PLACEHOLDER',
  },
  {
    collection: 'resources_templates',
    id: 'Tytf5c7WF79FPVFvEOz7',
    action: 'archive',
    reason: 'NO_FILE_NO_CONTENT',
  },
  {
    collection: 'news',
    id: '2hF4jGej0qoPDqctmEcS',
    action: 'set',
    fields: { status: 'draft' },
    reason: 'EMPTY_PLACEHOLDER',
  },
  {
    collection: 'news',
    id: 'trfshDvaHI1VR5G1IlZ3',
    action: 'set',
    fields: { status: 'draft' },
    reason: 'UNVERIFIED_PARTNERSHIP_NO_INFO',
  },
  ...[
    'carta-motivacao',
    'contrato-freelancer',
    'cv-classico',
    'cv-moderno',
    'job-description',
    'proposta-salarial',
  ].map((id) => ({
    collection: 'resources_templates',
    id,
    action: 'set',
    fields: { downloads: null },
    reason: 'FAKE_COUNTER_FROM_SEED',
  })),
];

const mode = process.argv.includes('--restore')
  ? 'RESTORE'
  : process.argv.includes('--apply')
    ? 'APPLY'
    : 'DRY_RUN';
const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (
  !projectId ||
  !process.env.FIREBASE_CLIENT_EMAIL ||
  !process.env.FIREBASE_PRIVATE_KEY
)
  throw new Error('FIREBASE_ADMIN_NOT_CONFIGURED');
const db = getFirestore(
  initializeApp({
    projectId,
    credential: cert({
      projectId,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  }),
);
const report = { mode, at: new Date().toISOString(), items: [] };

for (const item of PLAN) {
  const ref = db.collection(item.collection).doc(item.id);
  const archiveRef = db
    .collection('contentArchive')
    .doc(`${item.collection}__${item.id}`);
  const outcome = await db.runTransaction(async (tx) => {
    const [doc, archived] = await Promise.all([
      tx.get(ref),
      tx.get(archiveRef),
    ]);
    const data = doc.data();
    if (mode === 'RESTORE') {
      const saved = archived.data();
      if (!saved) return 'NOTHING_TO_RESTORE';
      if (saved.action === 'archive') tx.set(ref, saved.document);
      else tx.update(ref, saved.previous);
      tx.delete(archiveRef);
      tx.create(db.collection('auditLogs').doc(), {
        actorId: ACTOR,
        actorType: 'SYSTEM',
        action: 'content_restored',
        resourceType: item.collection,
        resourceId: item.id,
        metadata: { reason: item.reason },
        at: FieldValue.serverTimestamp(),
      });
      return 'RESTORED';
    }
    if (!data) return archived.exists ? 'ALREADY_ARCHIVED' : 'MISSING';
    if (
      item.action === 'set' &&
      Object.entries(item.fields).every(
        ([k, v]) => data[k] === v || (v === null && data[k] === undefined),
      )
    )
      return 'ALREADY_APPLIED';
    if (mode === 'DRY_RUN')
      return item.action === 'archive' ? 'WOULD_ARCHIVE' : 'WOULD_SET';
    const previous =
      item.action === 'set'
        ? Object.fromEntries(
            Object.keys(item.fields).map((k) => [k, data[k] ?? null]),
          )
        : null;
    tx.set(archiveRef, {
      collection: item.collection,
      id: item.id,
      action: item.action,
      reason: item.reason,
      ...(item.action === 'archive' ? { document: data } : { previous }),
      archivedAt: FieldValue.serverTimestamp(),
      archivedBy: ACTOR,
    });
    if (item.action === 'archive') tx.delete(ref);
    else
      tx.update(ref, {
        ...item.fields,
        updatedAt: FieldValue.serverTimestamp(),
      });
    tx.create(db.collection('auditLogs').doc(), {
      actorId: ACTOR,
      actorType: 'SYSTEM',
      action:
        item.action === 'archive' ? 'content_archived' : 'content_unpublished',
      resourceType: item.collection,
      resourceId: item.id,
      metadata: {
        reason: item.reason,
        fields: item.action === 'set' ? Object.keys(item.fields) : [],
      },
      at: FieldValue.serverTimestamp(),
    });
    return item.action === 'archive' ? 'ARCHIVED' : 'SET';
  });
  report.items.push({
    collection: item.collection,
    id: item.id,
    action: item.action,
    reason: item.reason,
    outcome,
  });
}
const out = `docs/audits/content-unpublish-${mode.toLowerCase()}-2026-10-10.json`;
if (mode !== 'DRY_RUN')
  await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exit(0);
