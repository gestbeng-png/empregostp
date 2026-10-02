import { admin } from '../../../lib/firebaseAdmin';
import { logServerError } from '../../../lib/serverLog';
import { findExistingStorageFile } from '../../../lib/storageBucket';
import { resolveOwnedStorageObjectPath } from '../../../lib/storageObjectPath';
import { requireActiveApiUser } from '../../../lib/apiUserAuth';

/**
 * Abre um documento anexado a uma candidatura, através de um URL assinado de
 * curta duração.
 *
 * A autorização não olha ao plano nem à privacidade do perfil, ao contrário do
 * CV: estes ficheiros foram entregues por esta pessoa, a esta vaga, com
 * consentimento explícito no formulário. Quem pode abri-los é quem é dono da
 * vaga — mais ninguém, nem sequer outra empresa com plano PRO.
 */
const SIGNED_URL_TTL_MS = 5 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const authResult = await requireActiveApiUser(req, res, {
      invalidTokenMessage: 'A sessão já não é válida.',
      missingTokenMessage: 'Inicie sessão para abrir o documento.',
    });
    if (!authResult) return;
    const { uid: viewerUid, userData: viewerData } = authResult;

    const applicationId =
      typeof req.body?.applicationId === 'string'
        ? req.body.applicationId.trim()
        : '';
    const documentType =
      typeof req.body?.documentType === 'string'
        ? req.body.documentType.trim()
        : '';
    const fileIndex = Number.isInteger(req.body?.fileIndex)
      ? req.body.fileIndex
      : 0;

    if (!applicationId || !documentType) {
      return res.status(400).json({ error: 'Documento não indicado.' });
    }

    const firestore = admin.firestore();
    const applicationDoc = await firestore
      .collection('applications')
      .doc(applicationId)
      .get();

    if (!applicationDoc.exists) {
      return res.status(404).json({ error: 'Candidatura não encontrada.' });
    }

    const application = applicationDoc.data() || {};
    const isAdmin = viewerData.userType === 'admin';
    const isOwnerCompany =
      viewerData.userType === 'empresa' && application.companyId === viewerUid;
    const isCandidate = application.candidateId === viewerUid;

    if (!isAdmin && !isOwnerCompany && !isCandidate) {
      return res
        .status(403)
        .json({ error: 'Não tem permissão para abrir este documento.' });
    }

    const entrada = application.applicationForm?.documents?.[documentType];
    const ficheiros = Array.isArray(entrada) ? entrada : entrada ? [entrada] : [];
    const ficheiro = ficheiros[fileIndex];

    if (!ficheiro) {
      return res.status(404).json({ error: 'Documento não encontrado.' });
    }

    // O caminho é revalidado mesmo estando gravado: continua a ter de estar
    // dentro da pasta do candidato desta candidatura.
    const objectPath = resolveOwnedStorageObjectPath({
      ownerUid: application.candidateId,
      prefix: 'candidaturas',
      value: ficheiro.storagePath || ficheiro.url,
    });

    if (!objectPath) {
      return res.status(404).json({ error: 'Documento não encontrado.' });
    }

    const file = await findExistingStorageFile(objectPath);
    if (!file) {
      return res.status(404).json({ error: 'Documento não encontrado.' });
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
      fileName: ficheiro.name || 'documento',
    });
  } catch (error) {
    logServerError('files.application_document_signing_failed', error);
    return res
      .status(500)
      .json({ error: 'Não foi possível abrir o documento.' });
  }
}
