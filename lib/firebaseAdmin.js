import admin from 'firebase-admin';
import * as path from 'path';
import fs from 'fs';

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
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) return false;

  privateKey = privateKey.replace(/\\n/g, '\n');

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
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
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${projectId}.firebaseio.com`,
    storageBucket: resolveStorageBucket(projectId, serviceAccount)
  });
  return true;
}

if (!admin.apps.length) {
  try {
    loadEnvFromFiles();
    const ok = initializeFromEnv() || initializeFromFile();
    if (!ok) {
      try {
        // Tenta usar credenciais padrão (ADC) quando disponíveis
        admin.initializeApp();
      } catch (adcError) {
        // Não lançar erro para evitar quebrar import em build/runtime sem envs
        console.warn('Firebase Admin não inicializado: credenciais ausentes. Recursos admin desativados.');
      }
    }
  } catch (err) {
    console.error('Erro ao inicializar Firebase Admin');
    // Evita quebrar import
  }
}

export { admin };
export const Timestamp = admin.firestore.Timestamp;
export default admin;
