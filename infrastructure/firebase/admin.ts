import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';

import { admin } from '@/lib/firebaseAdmin';

function assertAdminReady(): void {
  if (!admin.apps.length) {
    throw new Error('O serviço Firebase Admin não está configurado.');
  }
}

export function getAdminAuth(): Auth {
  assertAdminReady();
  return admin.auth();
}

export function getAdminFirestore(): Firestore {
  assertAdminReady();
  return admin.firestore();
}
