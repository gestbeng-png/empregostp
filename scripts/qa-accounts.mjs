/**
 * Gere as contas de teste da auditoria contra o Firebase real.
 *
 *   node --env-file-if-exists=.env.local scripts/qa-accounts.mjs create
 *   node --env-file-if-exists=.env.local scripts/qa-accounts.mjs list
 *   node --env-file-if-exists=.env.local scripts/qa-accounts.mjs delete
 *
 * Regras que este script respeita, e que a fase 6 depende:
 *  - email sempre com prefixo `qa-` e domínio `.test` (RFC 2606, não
 *    encaminhável), para que nenhum email real possa ser entregue a partir
 *    destas contas — o SMTP do projeto está ligado;
 *  - `isTestAccount: true` em `users` e `profiles`, para as distinguir de
 *    dados reais em qualquer consulta;
 *  - os UIDs ficam registados em docs/audits/qa-accounts.json para a limpeza
 *    ser feita UID a UID e nunca por varrimento;
 *  - `delete` só remove contas cujo doc tenha `isTestAccount: true` e cujo
 *    email comece por `qa-`. Nunca apaga por padrão de email apenas.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import admin from 'firebase-admin';

const REGISTRY = 'docs/audits/qa-accounts.json';
const PASSWORD = 'QaAudit!2026#stp';

const ACCOUNTS = [
  {
    key: 'candidato_basico',
    email: 'qa-candidato-basico@empregostp.test',
    name: '[QA] Candidato Básico',
    userType: 'candidato',
    planId: 'basic_candidato',
    planName: 'Básico',
  },
  {
    key: 'candidato_premium',
    email: 'qa-candidato-premium@empregostp.test',
    name: '[QA] Candidato Premium',
    userType: 'candidato',
    planId: 'unlimited_candidato',
    planName: 'Premium',
    paid: true,
  },
  {
    key: 'empresa_basica',
    email: 'qa-empresa-basica@empregostp.test',
    name: '[QA] Empresa Básica',
    userType: 'empresa',
    planId: 'basic_empresa',
    planName: 'Básico',
  },
  {
    key: 'empresa_pro',
    email: 'qa-empresa-pro@empregostp.test',
    name: '[QA] Empresa PRO',
    userType: 'empresa',
    planId: 'unlimited_empresa',
    planName: 'PRO',
    paid: true,
  },
  {
    key: 'admin',
    email: 'qa-admin@empregostp.test',
    name: '[QA] Admin',
    userType: 'admin',
    planId: 'basic_candidato',
    planName: 'Admin',
  },
];

function initAdmin() {
  if (admin.apps.length) return admin;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!privateKey || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PROJECT_ID) {
    throw new Error('Credenciais Admin em falta. Corre com --env-file-if-exists=.env.local');
  }
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
  return admin;
}

function loadRegistry() {
  if (!existsSync(REGISTRY)) return { accounts: {}, createdAt: null };
  return JSON.parse(readFileSync(REGISTRY, 'utf8'));
}

function saveRegistry(data) {
  mkdirSync(dirname(REGISTRY), { recursive: true });
  writeFileSync(REGISTRY, `${JSON.stringify(data, null, 2)}\n`);
}

async function ensureUser(auth, spec) {
  try {
    const existing = await auth.getUserByEmail(spec.email);
    return { uid: existing.uid, reused: true };
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
  }
  const created = await auth.createUser({
    email: spec.email,
    password: PASSWORD,
    displayName: spec.name,
    emailVerified: true,
  });
  return { uid: created.uid, reused: false };
}

async function create() {
  const app = initAdmin();
  const auth = app.auth();
  const db = app.firestore();
  const registry = loadRegistry();
  registry.createdAt = registry.createdAt || new Date().toISOString();
  registry.password = PASSWORD;

  for (const spec of ACCOUNTS) {
    const { uid, reused } = await ensureUser(auth, spec);
    const now = admin.firestore.Timestamp.now();
    const paidUntil = spec.paid
      ? admin.firestore.Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000)
      : null;

    const userDoc = {
      email: spec.email,
      name: spec.name,
      fullName: spec.name,
      userType: spec.userType,
      uid,
      isTestAccount: true,
      currentPlan: spec.planId,
      planId: spec.planId,
      planTierId: spec.planId,
      planName: spec.planName,
      planEndDate: paidUntil,
      createdAt: now,
      updatedAt: now,
    };
    if (spec.userType === 'empresa') {
      userDoc.vagasLimit = spec.paid ? 999 : 1;
      userDoc.destaque = Boolean(spec.paid);
    }
    if (spec.userType === 'candidato') {
      userDoc.curriculoDestacado = Boolean(spec.paid);
    }

    await db.collection('users').doc(uid).set(userDoc, { merge: true });
    await db.collection('profiles').doc(uid).set(
      {
        fullName: spec.name,
        email: spec.email,
        userType: spec.userType,
        isTestAccount: true,
        settings: { privacy: { profileVisibility: 'recruiters', showContactInfo: true } },
        updatedAt: now,
      },
      { merge: true },
    );

    registry.accounts[spec.key] = {
      uid,
      email: spec.email,
      userType: spec.userType,
      planId: spec.planId,
    };
    console.log(`${reused ? 'reutilizada' : 'criada    '}  ${spec.email}  ${uid}`);
  }

  saveRegistry(registry);
  console.log(`\nRegisto em ${REGISTRY}`);
}

async function list() {
  const app = initAdmin();
  const db = app.firestore();
  const snapshot = await db.collection('users').where('isTestAccount', '==', true).get();
  console.log(`docs users com isTestAccount=true: ${snapshot.size}`);
  snapshot.forEach((doc) => {
    const d = doc.data();
    console.log(`  ${doc.id}  ${d.email}  ${d.userType}  ${d.currentPlan || ''}`);
  });
}

async function remove() {
  const app = initAdmin();
  const auth = app.auth();
  const db = app.firestore();
  const registry = loadRegistry();
  const entries = Object.entries(registry.accounts || {});
  if (!entries.length) {
    console.log('Nada registado para remover.');
    return;
  }

  for (const [key, account] of entries) {
    const userDoc = await db.collection('users').doc(account.uid).get();
    const data = userDoc.exists ? userDoc.data() : null;
    // Dupla condição deliberada: nunca apagar algo que não esteja marcado
    // como conta de teste e cujo email não tenha o prefixo acordado.
    if (data && (data.isTestAccount !== true || !String(data.email || '').startsWith('qa-'))) {
      console.log(`IGNORADO ${key} (${account.uid}): não está marcado como conta de teste`);
      continue;
    }
    await db.collection('users').doc(account.uid).delete().catch(() => {});
    await db.collection('profiles').doc(account.uid).delete().catch(() => {});
    await auth.deleteUser(account.uid).catch(() => {});
    console.log(`removido  ${key}  ${account.uid}`);
  }
  saveRegistry({ ...registry, accounts: {}, deletedAt: new Date().toISOString() });
}

const command = process.argv[2];
const run = { create, list, delete: remove }[command];
if (!run) {
  console.error('Use: create | list | delete');
  process.exit(1);
}
run().then(() => process.exit(0)).catch((error) => {
  console.error('Falhou:', error.message);
  process.exit(1);
});
