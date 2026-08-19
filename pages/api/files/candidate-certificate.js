import { admin } from '../../../lib/firebaseAdmin';
import { canViewerAccessCandidateFiles } from '../../../lib/candidateFileAccess';
import { getEmpresaPlanSummary } from '../../../lib/empresaPlanFeatures';
import { logServerError } from '../../../lib/serverLog';
import { findExistingStorageFile } from '../../../lib/storageBucket';
import { resolveOwnedStorageObjectPath } from '../../../lib/storageObjectPath';
import { requireActiveApiUser } from '../../../lib/apiUserAuth';

// O browser recebe apenas o índice do certificado. O URL permanente guardado
// no perfil nunca entra no HTML e só é resolvido no servidor após nova
// verificação da sessão, privacidade e plano da empresa.
const SIGNED_URL_TTL_MS = 5 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const authResult = await requireActiveApiUser(req, res, {
      invalidTokenMessage: 'A sessão já não é válida.',
      missingTokenMessage: 'Inicie sessão para abrir o certificado.',
    });
    if (!authResult) return;
    const { uid: viewerUid, userData: viewerData } = authResult;

    const candidateId =
      typeof req.body?.candidateId === 'string'
        ? req.body.candidateId.trim()
        : '';
    const certificateIndex = req.body?.certificateIndex;

    if (!candidateId) {
      return res.status(400).json({ error: 'Candidato não indicado.' });
    }
    if (!Number.isInteger(certificateIndex) || certificateIndex < 0) {
      return res.status(400).json({ error: 'Certificado não indicado.' });
    }

    const firestore = admin.firestore();
    const [candidateDoc, candidateProfileDoc] = await Promise.all([
      firestore.collection('users').doc(candidateId).get(),
      firestore.collection('profiles').doc(candidateId).get(),
    ]);

    if (!candidateDoc.exists || candidateDoc.data()?.userType !== 'candidato') {
      return res.status(404).json({ error: 'Candidato não encontrado.' });
    }

    const candidateProfile = candidateProfileDoc.exists
      ? candidateProfileDoc.data() || {}
      : {};

    const decision = canViewerAccessCandidateFiles({
      candidateId,
      candidateProfile,
      viewer: {
        uid: viewerUid,
        userType: viewerData.userType,
        planFeatures:
          viewerData.userType === 'empresa'
            ? getEmpresaPlanSummary(viewerData).features
            : null,
      },
    });

    if (!decision.allowed) {
      return res.status(403).json({
        error:
          decision.reason === 'plan_required'
            ? 'O seu plano atual não permite abrir certificados de candidatos.'
            : 'Não tem permissão para aceder a este certificado.',
        code: decision.reason,
      });
    }

    const certificateFiles = Array.isArray(candidateProfile.certificateFiles)
      ? candidateProfile.certificateFiles.filter(
          (value) => typeof value === 'string' && value.trim(),
        )
      : [];
    const storedValue = certificateFiles[certificateIndex];
    if (typeof storedValue !== 'string' || !storedValue.trim()) {
      return res.status(404).json({ error: 'Certificado não encontrado.' });
    }

    const objectPath = resolveOwnedStorageObjectPath({
      ownerUid: candidateId,
      prefix: 'certificados',
      value: storedValue,
    });
    if (!objectPath) {
      return res.status(404).json({ error: 'Certificado não encontrado.' });
    }

    const file = await findExistingStorageFile(objectPath);
    if (!file) {
      return res.status(404).json({ error: 'Certificado não encontrado.' });
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
        objectPath.split('/').pop() ||
        `certificado-${certificateIndex + 1}.pdf`,
    });
  } catch (error) {
    logServerError('files.candidate_certificate_signing_failed', error);
    return res
      .status(500)
      .json({ error: 'Não foi possível abrir o certificado.' });
  }
}
