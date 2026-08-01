import { admin } from '../../../lib/firebaseAdmin';
import { logServerError } from '../../../lib/serverLog';
import { resolveOwnedStorageObjectPath } from '../../../lib/storageObjectPath';

const mapPlanInfo = (userData) => ({
  currentPlan: userData.currentPlan,
  planId: userData.planId,
  planName: userData.planName,
  planEndDate: userData.planEndDate
    ? userData.planEndDate.toDate
      ? userData.planEndDate.toDate().toISOString()
      : userData.planEndDate
    : null,
  planFeatures: userData.planFeatures,
  destaque: userData.destaque,
  curriculoDestacado: userData.curriculoDestacado,
  vagasLimit: userData.vagasLimit
});

const serializeValue = (value) => {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((item) => serializeValue(item));
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, currentValue]) => [key, serializeValue(currentValue)])
    );
  }
  return value;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autenticação não fornecido' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;

    const { cvUrl, cvName } = req.body;
    if (!cvUrl || !cvName) {
      return res.status(400).json({ error: 'Dados do CV inválidos' });
    }

    // O cliente faz o upload diretamente para o Storage e envia-nos o URL
    // resultante. Sem esta verificação, bastava forjar o URL para apontar o
    // próprio perfil ao ficheiro de outra pessoa — e passar depois pela rota
    // de assinatura como se fosse dono dele.
    const cvStoragePath = resolveOwnedStorageObjectPath({
      ownerUid: uid,
      prefix: 'cvUrl',
      value: cvUrl,
    });
    if (!cvStoragePath) {
      return res.status(400).json({ error: 'Dados do CV inválidos' });
    }

    const userRef = admin.firestore().collection('users').doc(uid);
    const profileRef = admin.firestore().collection('profiles').doc(uid);

    await userRef.update({
      cvUrl,
      cvName,
      cvStoragePath,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    await profileRef.set(
      {
        cvUrl,
        cvName,
        cvStoragePath,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    const [userSnap, profileSnap] = await Promise.all([userRef.get(), profileRef.get()]);
    const userData = userSnap.data() || {};
    const profileData = profileSnap.data() || {};

    const mergedProfile = {
      ...profileData,
      fullName: userData.name,
      email: userData.email,
      userType: userData.userType,
      cvUrl: userData.cvUrl || profileData.cvUrl || '',
      cvName: userData.cvName || profileData.cvName || '',
      verificationStatus: userData.verificationStatus || profileData.verificationStatus || 'unverified',
      verificationSummary: serializeValue(userData.verificationSummary || profileData.verificationSummary || null),
      verificationItems: serializeValue(userData.verificationItems || profileData.verificationItems || null),
      verificationId: userData.verificationId || profileData.verificationId || null,
      ...mapPlanInfo(userData)
    };

    return res.status(200).json({
      profile: mergedProfile,
      message: 'CV atualizado com sucesso.'
    });
  } catch (error) {
    logServerError('profile.cv_upload_failed', error);
    return res.status(500).json({ error: 'Erro interno ao atualizar o CV.' });
  }
}
