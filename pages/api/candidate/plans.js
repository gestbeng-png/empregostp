import { admin } from '../../../lib/firebaseAdmin';
import { serializeFirestoreValue } from '../../../lib/empresaPlansCatalog';
import { getCandidateMarketingPlans } from '../../../lib/candidateCatalog';

// Modelo "3 planos fixos": o candidato vê sempre exatamente os planos canónicos
// (Verificação, Profissional, Premium). O admin pode editar nome, preço, rótulo
// e recursos; essas edições são guardadas em documentos do Firestore com o id
// canónico e sobrepõem-se aos valores por omissão. Planos avulsos criados no
// passado são ignorados de propósito.
const FIXED_CANDIDATE_PLANS = getCandidateMarketingPlans({
  includeBasic: false,
  includeVerification: true,
});

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

    // Ler os documentos canónicos diretamente pelo id (onde vivem as edições do
    // admin). Evita queries/índices e é determinístico: sempre os mesmos 3 planos.
    const plansCollection = admin.firestore().collection('plans');
    const refs = FIXED_CANDIDATE_PLANS.map((plan) => plansCollection.doc(plan.id));
    const docs = await admin.firestore().getAll(...refs);

    const overrides = {};
    docs.forEach((doc) => {
      if (doc.exists) {
        overrides[doc.id] = serializeFirestoreValue(doc.data()) || {};
      }
    });

    const plans = FIXED_CANDIDATE_PLANS
      .map((base) => {
        const override = overrides[base.id] || {};
        const merged = {
          ...base,
          ...override,
          id: base.id,
          planTierId: base.id,
          type: 'candidato',
          // Mantém os recursos por omissão se o admin não tiver definido nenhum.
          features: Array.isArray(override.features) && override.features.length
            ? override.features
            : base.features,
        };
        merged.priceLabel = normalizePriceLabel(merged);
        return merged;
      })
      // O admin pode desativar um plano canónico; nesse caso não é mostrado.
      .filter((plan) => plan.isActive !== false);

    plans.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));

    return res.status(200).json({ plans });
  } catch (error) {
    console.error('Erro ao listar planos de candidato:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
