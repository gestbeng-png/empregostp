import { admin } from './firebaseAdmin';

/**
 * Nomes de bucket a tentar, por ordem de confiança.
 *
 * O projeto atravessou a mudança de `appspot.com` para `firebasestorage.app`,
 * por isso a configuração explícita tem prioridade e os nomes derivados do
 * projeto ficam como recurso.
 */
export function resolveBucketCandidates() {
  const appOptionsBucket = admin.app()?.options?.storageBucket || '';
  const envBucket =
    process.env.FIREBASE_STORAGE_BUCKET
    || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    || '';
  const projectId =
    process.env.FIREBASE_PROJECT_ID || admin.app()?.options?.projectId || '';

  const candidates = [
    String(appOptionsBucket || '').trim(),
    String(envBucket || '').trim(),
    projectId ? `${projectId}.firebasestorage.app` : '',
    projectId ? `${projectId}.appspot.com` : '',
  ].filter(Boolean);

  return [...new Set(candidates)];
}

/**
 * Devolve o primeiro ficheiro que existe no bucket, percorrendo os candidatos.
 * Devolve `null` quando o objeto não existe em nenhum deles.
 */
export async function findExistingStorageFile(objectPath) {
  for (const bucketName of resolveBucketCandidates()) {
    try {
      const file = admin.storage().bucket(bucketName).file(objectPath);
      const [exists] = await file.exists();
      if (exists) return file;
    } catch (error) {
      // Bucket inválido para este projeto — tenta o candidato seguinte.
    }
  }
  return null;
}
