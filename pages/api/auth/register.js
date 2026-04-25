import { admin } from '../../../lib/firebaseAdmin';
import { getDefaultBasicPlanForUserType } from '../../../lib/defaultPlans';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password, userType, ...userData } = req.body;

    // Criar usuário no Authentication
    const userRecord = await admin.auth().createUser({
      email,
      password,
      emailVerified: false
    });

    const normalizedUserType = userType === 'empresa' ? 'empresa' : 'candidato';
    const basicPlanId = normalizedUserType === 'empresa' ? 'basic_empresa' : 'basic_candidato';

    // Buscar plano básico compatível com o tipo de usuário
    const basicPlanDoc = await admin.firestore().collection('plans').doc(basicPlanId).get();
    const basicPlan = basicPlanDoc.exists ? basicPlanDoc.data() : getDefaultBasicPlanForUserType(normalizedUserType);

    // Criar documento do usuário com plano básico
    const userPayload = {
      ...userData,
      email,
      userType,
      uid: userRecord.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      currentPlan: basicPlanId,
      planId: basicPlanId,
      planName: basicPlan.name || 'Básico',
      planEndDate: null,
      planFeatures: basicPlan.features
    };

    if (normalizedUserType === 'empresa') {
      userPayload.vagasLimit = basicPlan.vagasLimit ?? 1;
      userPayload.destaque = Boolean(basicPlan.destaque);
    } else {
      userPayload.curriculoDestacado = Boolean(basicPlan.curriculoDestacado);
      userPayload.destaque = Boolean(basicPlan.curriculoDestacado);
    }

    await admin.firestore().collection('users').doc(userRecord.uid).set(userPayload);

    // Criar assinatura básica
    await admin.firestore().collection('subscriptions').doc(userRecord.uid).set({
      planId: basicPlanId,
      planName: basicPlan.name || 'Básico',
      userId: userRecord.uid,
      startDate: admin.firestore.FieldValue.serverTimestamp(),
      endDate: null,
      status: 'active',
      features: basicPlan.features,
      ...(normalizedUserType === 'empresa'
        ? {
            vagasLimit: basicPlan.vagasLimit ?? 1,
            destaque: Boolean(basicPlan.destaque)
          }
        : {
            curriculoDestacado: Boolean(basicPlan.curriculoDestacado)
          })
    });

    return res.status(200).json({ 
      message: 'Usuário registrado com sucesso',
      uid: userRecord.uid 
    });
  } catch (error) {
    console.error('Erro ao registrar usuário:', error);
    return res.status(500).json({ error: 'Erro ao registrar usuário' });
  }
} 
