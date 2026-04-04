import { admin } from '../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (process.env.ENABLE_INTERNAL_TOOLS !== 'true') {
    return res.status(404).json({ error: 'Rota não disponível' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verificar autenticação e permissão de admin
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido' });
  }
  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const callerDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
    if (!callerDoc.exists || callerDoc.data().userType !== 'admin') {
      return res.status(403).json({ error: 'Acesso não autorizado' });
    }
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }

  try {
    const { uid } = req.body;
    if (!uid) {
      return res.status(400).json({ error: 'UID não fornecido' });
    }

    // Buscar dados do usuário
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const userData = userDoc.data();

    // Buscar dados do perfil
    const profileDoc = await admin.firestore().collection('profiles').doc(uid).get();
    const profileData = profileDoc.exists ? profileDoc.data() : {};

    // Buscar assinatura
    const subscriptionDoc = await admin.firestore().collection('subscriptions').doc(uid).get();
    const subscriptionData = subscriptionDoc.exists ? subscriptionDoc.data() : {};

    return res.status(200).json({
      user: userData,
      profile: profileData,
      subscription: subscriptionData,
      debug: {
        hasPlanEndDate: !!userData.planEndDate,
        planEndDateType: userData.planEndDate ? typeof userData.planEndDate : 'null',
        hasPlanName: !!userData.planName,
        hasCurrentPlan: !!userData.currentPlan,
        hasCurriculoDestacado: !!userData.curriculoDestacado,
        userType: userData.userType
      }
    });

  } catch (error) {
    console.error('Erro ao buscar dados do usuário:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
} 
