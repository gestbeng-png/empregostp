import { admin } from '../../../lib/firebaseAdmin';
import { getDefaultBasicPlanForUserType } from '../../../lib/defaultPlans';
import { enforceApiRateLimit } from '../../../lib/apiRateLimit';
import { isValidEmail, isStrongPassword, normalizeEmail } from '../../../lib/validation';

const ALLOWED_USER_TYPES = new Set(['candidato', 'empresa']);

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function buildRegistrationProfile(body = {}, userType) {
  const profile = {};
  const name = cleanString(body.name || body.fullName);
  const fullName = cleanString(body.fullName || body.name);
  const provider = cleanString(body.provider);
  const photoUrl = cleanString(body.photoUrl);
  const phone = cleanString(body.phone);
  const location = cleanString(body.location);

  if (name) profile.name = name;
  if (fullName) profile.fullName = fullName;
  if (provider) profile.provider = provider;
  if (photoUrl) profile.photoUrl = photoUrl;
  if (phone) profile.phone = phone;
  if (location) profile.location = location;

  if (userType === 'empresa') {
    const nif = cleanString(body.nif);
    if (nif) profile.nif = nif;

    if (Array.isArray(body.industrySectors)) {
      const sectors = [
        ...new Set(
          body.industrySectors
            .filter((sector) => typeof sector === 'string')
            .map((sector) => sector.trim())
            .filter(Boolean),
        ),
      ];
      if (sectors.length) profile.industrySectors = sectors;
    }
  }

  return profile;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await enforceApiRateLimit(req, res, { scope: 'register', limit: 5 }))) {
    return;
  }

  try {
    const { email: rawEmail, password, userType, ...userData } = req.body;

    const email = normalizeEmail(rawEmail);
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Email inválido.' });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({
        error: 'A senha deve ter no mínimo 8 caracteres, com maiúscula, minúscula, número e caractere especial.',
      });
    }
    if (!ALLOWED_USER_TYPES.has(userType)) {
      return res.status(400).json({
        error: 'Tipo de utilizador inválido. Escolha candidato ou empresa.',
      });
    }

    // Criar usuário no Authentication
    const userRecord = await admin.auth().createUser({
      email,
      password,
      emailVerified: false
    });

    const normalizedUserType = userType;
    const basicPlanId = normalizedUserType === 'empresa' ? 'basic_empresa' : 'basic_candidato';

    // Buscar plano básico compatível com o tipo de usuário
    const basicPlanDoc = await admin.firestore().collection('plans').doc(basicPlanId).get();
    const basicPlan = basicPlanDoc.exists ? basicPlanDoc.data() : getDefaultBasicPlanForUserType(normalizedUserType);

    // Criar documento do usuário com plano básico
    const userPayload = {
      ...buildRegistrationProfile(userData, normalizedUserType),
      email,
      userType: normalizedUserType,
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
