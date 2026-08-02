import { admin } from '../../../lib/firebaseAdmin';
import { getDefaultBasicPlanForUserType } from '../../../lib/defaultPlans';
import { isValidEmail } from '../../../lib/validation';
import { logServerError } from '../../../lib/serverLog';

/**
 * Inicializa o documento Firestore do utilizador com o plano básico.
 * Chamado após qualquer método de registo (email/password ou OAuth).
 * É idempotente: se o utilizador já tem planId definido, não sobrescreve.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;

    // Validação de email no servidor (defesa em profundidade — o front-end já
    // valida, mas nunca confiamos apenas no cliente).
    if (!isValidEmail(decodedToken.email)) {
      return res.status(400).json({ error: 'Email inválido.' });
    }

    const {
      userType,
      fullName,
      name,
      photoUrl,
      provider,
      phone,
      nif,
      location,
      industrySectors,
    } = req.body;

    const normalizedUserType = userType === 'empresa' ? 'empresa' : 'candidato';
    const basicPlanId = normalizedUserType === 'empresa' ? 'basic_empresa' : 'basic_candidato';

    // Verificar se documento já existe com plano configurado
    const userRef = admin.firestore().collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (userDoc.exists && userDoc.data().planId) {
      // Documento já existe e tem plano — nada a fazer
      return res.status(200).json({ message: 'Utilizador já configurado', user: userDoc.data() });
    }

    // Buscar plano básico do Firestore (fallback para constante se não existir)
    const basicPlanDoc = await admin.firestore().collection('plans').doc(basicPlanId).get();
    const basicPlan = basicPlanDoc.exists ? basicPlanDoc.data() : getDefaultBasicPlanForUserType(normalizedUserType);

    const now = admin.firestore.FieldValue.serverTimestamp();

    const userData = {
      email: decodedToken.email || '',
      userType: normalizedUserType,
      provider: provider || 'google',
      needsTypeSelection: false,
      currentPlan: basicPlanId,
      planId: basicPlanId,
      planName: basicPlan.name || 'Básico',
      planEndDate: null,
      planFeatures: basicPlan.features || [],
      createdAt: now,
      updatedAt: now
    };

    if (fullName) userData.fullName = fullName;
    if (name) userData.name = name;
    if (photoUrl) userData.photoUrl = photoUrl;

    if (normalizedUserType === 'empresa') {
      userData.vagasLimit = basicPlan.vagasLimit ?? 1;
      userData.destaque = Boolean(basicPlan.destaque);

      // Informações adicionais recolhidas no registo da empresa.
      if (typeof phone === 'string' && phone.trim()) userData.phone = phone.trim();
      if (typeof nif === 'string' && nif.trim()) userData.nif = nif.trim();
      if (typeof location === 'string' && location.trim()) userData.location = location.trim();
      if (Array.isArray(industrySectors)) {
        const sectors = industrySectors
          .filter((s) => typeof s === 'string' && s.trim())
          .map((s) => s.trim());
        if (sectors.length) userData.industrySectors = sectors;
      }
    } else {
      userData.curriculoDestacado = Boolean(basicPlan.curriculoDestacado);
      userData.destaque = Boolean(basicPlan.curriculoDestacado);
    }

    // Usar merge: true para não sobrescrever campos existentes
    await userRef.set(userData, { merge: true });

    return res.status(200).json({ message: 'Utilizador configurado com sucesso', planId: basicPlanId });
  } catch (error) {
    logServerError('auth_setup_user.em_setup_user_failed', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
