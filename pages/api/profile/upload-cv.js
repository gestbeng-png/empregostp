import { admin } from '../../../lib/firebaseAdmin';

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
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

    const userRef = admin.firestore().collection('users').doc(uid);
    const profileRef = admin.firestore().collection('profiles').doc(uid);

    await userRef.update({ cvUrl, cvName, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    await profileRef.set({ cvUrl, cvName }, { merge: true });

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
      ...mapPlanInfo(userData)
    };

    return res.status(200).json({
      profile: mergedProfile,
      message: 'CV atualizado com sucesso.'
    });
  } catch (error) {
    console.error('Erro ao atualizar CV:', error);
    return res.status(500).json({ error: 'Erro interno ao atualizar o CV.' });
  }
}
