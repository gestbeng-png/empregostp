import * as path from 'path';
import fs from 'fs';
import {
  applicationDefault,
  cert,
  getApp,
  getApps,
  initializeApp
} from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import {
  FieldPath,
  FieldValue,
  getFirestore,
  Timestamp as FirestoreTimestamp
} from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const firestore = Object.assign((app) => getFirestore(app), {
  FieldPath,
  FieldValue,
  Timestamp: FirestoreTimestamp
});

const admin = {
  get apps() {
    return getApps();
  },
  app(name) {
    return getApp(name);
  },
  auth(app) {
    return getAuth(app);
  },
  credential: {
    applicationDefault,
    cert
  },
  firestore,
  initializeApp(options, name) {
    return initializeApp(options, name);
  },
  storage(app) {
    return getStorage(app);
  }
};

function getEnvValue(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value !== undefined && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
}

function setProjectEnvAliases(projectId) {
  if (!projectId) return;
  process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || projectId;
  process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || projectId;
  process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || projectId;
}

function loadEnvFromFiles() {
  const envPaths = [
    path.join(process.cwd(), '.env.local'),
    path.join(process.cwd(), '.env')
  ];

  envPaths.forEach((envPath) => {
    if (!fs.existsSync(envPath)) return;
    try {
      const contents = fs.readFileSync(envPath, 'utf8');
      contents.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) return;
        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (key && (process.env[key] === undefined || process.env[key] === '')) {
          process.env[key] = value;
        }
      });
    } catch (err) {
      console.warn('Falha ao carregar variáveis de ambiente locais:', envPath);
    }
  });
}

function resolveStorageBucket(projectId, serviceAccount = null) {
  const envBucket =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    '';

  const serviceAccountBucket =
    serviceAccount?.storage_bucket ||
    serviceAccount?.storageBucket ||
    '';

  const normalizedEnvBucket = String(envBucket || '').trim();
  if (normalizedEnvBucket) return normalizedEnvBucket;

  const normalizedServiceBucket = String(serviceAccountBucket || '').trim();
  if (normalizedServiceBucket) return normalizedServiceBucket;

  const normalizedProjectId = String(projectId || '').trim();
  if (!normalizedProjectId) return '';

  return `${normalizedProjectId}.firebasestorage.app`;
}

function initializeFromEnv() {
  const projectId = getEnvValue('FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID');
  const clientEmail = getEnvValue('FIREBASE_CLIENT_EMAIL');
  let privateKey = getEnvValue('FIREBASE_PRIVATE_KEY');

  if (!projectId || !clientEmail || !privateKey) return false;

  privateKey = privateKey.replace(/\\n/g, '\n');
  setProjectEnvAliases(projectId);

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    projectId,
    databaseURL: `https://${projectId}.firebaseio.com`,
    storageBucket: resolveStorageBucket(projectId)
  });
  return true;
}

function initializeFromEmulator() {
  const emulatorHost = getEnvValue(
    'FIRESTORE_EMULATOR_HOST',
    'FIREBASE_AUTH_EMULATOR_HOST'
  );
  if (!emulatorHost) return false;

  const projectId =
    getEnvValue(
      'FIREBASE_PROJECT_ID',
      'GOOGLE_CLOUD_PROJECT',
      'GCLOUD_PROJECT',
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID'
    ) || 'empregostp';

  setProjectEnvAliases(projectId);
  admin.initializeApp({
    projectId,
    databaseURL: `https://${projectId}.firebaseio.com`,
    storageBucket: resolveStorageBucket(projectId)
  });
  return true;
}

function initializeFromFile() {
  const serviceAccountPath = path.join(process.cwd(), 'lib', 'firebase-admin-credentials.json');
  if (!fs.existsSync(serviceAccountPath)) return false;
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  const projectId = serviceAccount.project_id || serviceAccount.projectId;
  if (!projectId) return false;
  setProjectEnvAliases(projectId);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId,
    databaseURL: `https://${projectId}.firebaseio.com`,
    storageBucket: resolveStorageBucket(projectId, serviceAccount)
  });
  return true;
}

function initializeFromApplicationDefault() {
  const hasApplicationDefaultHint =
    getEnvValue('GOOGLE_APPLICATION_CREDENTIALS') ||
    getEnvValue('GOOGLE_CLOUD_PROJECT', 'GCLOUD_PROJECT') ||
    getEnvValue('FIREBASE_CONFIG');

  if (!hasApplicationDefaultHint) return false;

  const projectId = getEnvValue(
    'FIREBASE_PROJECT_ID',
    'GOOGLE_CLOUD_PROJECT',
    'GCLOUD_PROJECT',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID'
  );
  if (!projectId) return false;

  setProjectEnvAliases(projectId);
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId,
    databaseURL: `https://${projectId}.firebaseio.com`,
    storageBucket: resolveStorageBucket(projectId)
  });
  return true;
}

if (!admin.apps.length) {
  try {
    loadEnvFromFiles();
    const ok =
      initializeFromEmulator() ||
      initializeFromEnv() ||
      initializeFromFile() ||
      initializeFromApplicationDefault();
    if (!ok) {
      console.warn(
        'Firebase Admin não inicializado: defina FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY.'
      );
    }
  } catch (err) {
    console.error('Erro ao inicializar Firebase Admin:', err?.message || err);
    // Evita quebrar import
  }
} else if (!admin.apps[0]?.options?.projectId) {
  console.warn('Firebase Admin já estava inicializado sem projectId. Reinicie o servidor Next.js.');
}

export { admin };
export const Timestamp = admin.firestore.Timestamp;
export default admin;
