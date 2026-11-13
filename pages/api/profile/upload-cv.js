import { admin } from '../../../lib/firebaseAdmin';
import { requireActiveApiUser } from '../../../lib/apiUserAuth';
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
  vagasLimit: userData.vagasLimit,
});

const serializeValue = (value) => {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((item) => serializeValue(item));
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, currentValue]) => [
        key,
        serializeValue(currentValue),
      ]),
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
    const authResult = await requireActiveApiUser(req, res);
    if (!authResult) return;
    const { uid, userRef, userData: currentUserData } = authResult;
    if (currentUserData.userType !== 'candidato') {
      return res.status(403).json({ error: 'Apenas candidatos podem atualizar o CV.' });
    }

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

    const profileRef = admin.firestore().collection('profiles').doc(uid);

    // `updatedAt` muda a cada edição do perfil e não serve para saber a idade
    // do CV. Sem uma data própria, não há como distinguir um CV de ontem de um
    // de há três anos — que é o que decide se voltamos a pedi-lo.
    const cvUpdatedAt = new Date().toISOString();

    await userRef.update({
      cvUrl,
      cvName,
      cvStoragePath,
      cvUpdatedAt,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await profileRef.set(
      {
        cvUrl,
        cvName,
        cvStoragePath,
        cvUpdatedAt,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    const [userSnap, profileSnap] = await Promise.all([
      userRef.get(),
      profileRef.get(),
    ]);
    const userData = userSnap.data() || {};
    const profileData = profileSnap.data() || {};

    const mergedProfile = {
      ...profileData,
      fullName: userData.name,
      email: userData.email,
      userType: userData.userType,
      cvUrl: userData.cvUrl || profileData.cvUrl || '',
      cvName: userData.cvName || profileData.cvName || '',
      cvUpdatedAt: userData.cvUpdatedAt || profileData.cvUpdatedAt || '',
      verificationStatus:
        userData.verificationStatus ||
        profileData.verificationStatus ||
        'unverified',
      verificationSummary: serializeValue(
        userData.verificationSummary || profileData.verificationSummary || null,
      ),
      verificationItems: serializeValue(
        userData.verificationItems || profileData.verificationItems || null,
      ),
      verificationId:
        userData.verificationId || profileData.verificationId || null,
      ...mapPlanInfo(userData),
    };

    return res.status(200).json({
      profile: mergedProfile,
      message: 'CV atualizado com sucesso.',
    });
  } catch (error) {
    logServerError('profile.cv_upload_failed', error);
    return res.status(500).json({ error: 'Erro interno ao atualizar o CV.' });
  }
}
