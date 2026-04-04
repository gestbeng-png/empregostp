import { admin } from '../../../lib/firebaseAdmin';
import { DEFAULT_CANDIDATO_PLANS } from '../../../lib/defaultPlans';
import { serializeFirestoreValue } from '../../../lib/empresaPlansCatalog';
import { normalizeCandidatePlanId } from '../../../lib/candidatePlanFeatures';

const ALLOWED_CANDIDATE_PLANS = new Set([
  'verification_candidato',
  'professional_candidato',
  'unlimited_candidato'
]);

function normalizePriceLabel(plan) {
  const price = Number(plan?.price) || 0;
  if (plan?.priceLabel) return String(plan.priceLabel);
  if (price === 0) return 'Gratuito';
  return `${price} Dobras`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
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

    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const userData = userDoc.data() || {};
    if (userData.userType !== 'candidato') {
      return res.status(403).json({ error: 'Esta API é apenas para candidatos' });
    }

    // Avoid composite index requirements: query by a single field and filter in memory.
    const snapshot = await admin.firestore().collection('plans')
      .where('type', '==', 'candidato')
      .get();

    const firestorePlans = snapshot.docs.map((doc) => {
      const data = serializeFirestoreValue(doc.data()) || {};
      const planTierId = normalizeCandidatePlanId(doc.id, data.name, data);
      const normalized = {
        id: doc.id,
        ...data,
        planTierId,
        type: data.type || 'candidato',
        isDefault: false
      };
      normalized.priceLabel = normalizePriceLabel(normalized);
      return normalized;
    });

    const activePlans = firestorePlans
      .filter((plan) => plan.isActive !== false)
      .filter((plan) => ALLOWED_CANDIDATE_PLANS.has(String(plan.planTierId || plan.id || '')));

    const dedupedActivePlans = [];
    const seenTiers = new Set();
    [...activePlans]
      .sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0))
      .forEach((plan) => {
        if (seenTiers.has(plan.planTierId)) return;
        seenTiers.add(plan.planTierId);
        dedupedActivePlans.push(plan);
      });

    const plans = dedupedActivePlans.length
      ? dedupedActivePlans
      : DEFAULT_CANDIDATO_PLANS
          .filter((plan) => ALLOWED_CANDIDATE_PLANS.has(String(plan.id || '')))
          .map((plan) => ({
            ...plan,
            planTierId: plan.id,
            priceLabel: normalizePriceLabel(plan),
            isDefault: true
          }));

    plans.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));

    return res.status(200).json({ plans });
  } catch (error) {
    console.error('Erro ao listar planos de candidato:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
