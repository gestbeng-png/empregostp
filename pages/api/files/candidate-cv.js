import { admin } from '../../../lib/firebaseAdmin';
import { canViewerAccessCandidateFiles } from '../../../lib/candidateFileAccess';
import { getEmpresaPlanSummary } from '../../../lib/empresaPlanFeatures';
import { logServerError } from '../../../lib/serverLog';
import { findExistingStorageFile } from '../../../lib/storageBucket';
import { resolveOwnedStorageObjectPath } from '../../../lib/storageObjectPath';

// Entrega o CV de um candidato através de um URL assinado de curta duração,
// gerado no servidor depois de reavaliar a permissão.
//
// É POST — e não GET — porque o pedido cunha uma credencial temporária e
// porque assim o uid do candidato não fica em URLs, logs de acesso nem
// cabeçalhos Referer.

const SIGNED_URL_TTL_MS = 5 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Inicie sessão para abrir o CV.' });
    }

    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(
        authHeader.split('Bearer ')[1],
      );
    } catch (error) {
      return res.status(401).json({ error: 'A sessão já não é válida.' });
    }

    const candidateId = typeof req.body?.candidateId === 'string'
      ? req.body.candidateId.trim()
      : '';
    if (!candidateId) {
      return res.status(400).json({ error: 'Candidato não indicado.' });
    }

    const firestore = admin.firestore();
    const [viewerDoc, candidateDoc, candidateProfileDoc] = await Promise.all([
      firestore.collection('users').doc(decodedToken.uid).get(),
      firestore.collection('users').doc(candidateId).get(),
      firestore.collection('profiles').doc(candidateId).get(),
    ]);

    if (!candidateDoc.exists) {
      return res.status(404).json({ error: 'Candidato não encontrado.' });
    }

    const viewerData = viewerDoc.exists ? viewerDoc.data() || {} : {};
    const candidateData = candidateDoc.data() || {};
    const candidateProfile = candidateProfileDoc.exists
      ? candidateProfileDoc.data() || {}
      : {};

    const decision = canViewerAccessCandidateFiles({
      candidateId,
      candidateProfile,
      viewer: {
        uid: decodedToken.uid,
        userType: viewerData.userType,
        planFeatures:
          viewerData.userType === 'empresa'
            ? getEmpresaPlanSummary(viewerData).features
            : null,
      },
    });

    if (!decision.allowed) {
      return res.status(403).json({
        error: decision.reason === 'plan_required'
          ? 'O seu plano atual não permite abrir o CV dos candidatos.'
          : 'Não tem permissão para aceder a este CV.',
        code: decision.reason,
      });
    }

    // O caminho tem de estar dentro de cvUrl/{candidateId}/: o valor foi
    // gravado a partir de input do cliente e não é confiável por si só.
    const objectPath = resolveOwnedStorageObjectPath({
      ownerUid: candidateId,
      prefix: 'cvUrl',
      value: candidateProfile.cvUrl || candidateData.cvUrl,
    });

    if (!objectPath) {
      return res.status(404).json({ error: 'Este candidato não tem CV disponível.' });
    }

    const file = await findExistingStorageFile(objectPath);
    if (!file) {
      return res.status(404).json({ error: 'Este candidato não tem CV disponível.' });
    }

    const expiresAt = Date.now() + SIGNED_URL_TTL_MS;
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: expiresAt,
      version: 'v4',
    });

    return res.status(200).json({
      url,
      expiresAt: new Date(expiresAt).toISOString(),
      fileName:
        candidateProfile.cvName || candidateData.cvName || 'curriculo.pdf',
    });
  } catch (error) {
    logServerError('files.candidate_cv_signing_failed', error);
    return res.status(500).json({ error: 'Não foi possível abrir o CV.' });
  }
}
