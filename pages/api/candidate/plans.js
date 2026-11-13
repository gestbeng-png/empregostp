import { admin } from '../../../lib/firebaseAdmin';
import { serializeFirestoreValue } from '../../../lib/empresaPlansCatalog';
import {
  getCandidateMarketingPlans,
  getCandidatePlanBenefits,
} from '../../../lib/candidateCatalog';
import { normalizePlanPriceLabel } from '../../../lib/payments/currency';
import { logServerError } from '../../../lib/serverLog';
import { requireActiveApiUser } from '../../../lib/apiUserAuth';

// Planos fixos: o candidato vê sempre exatamente os planos canónicos
// (Profissional, Premium). O plano Verificação deixou de ser vendido — a
// verificação vem incluída no Premium —, mas continua no catálogo para quem já
// o tem. O admin pode editar nome, preço, rótulo
// e recursos; essas edições são guardadas em documentos do Firestore com o id
// canónico e sobrepõem-se aos valores por omissão. Planos avulsos criados no
// passado são ignorados de propósito.
const FIXED_CANDIDATE_PLANS = getCandidateMarketingPlans({
  includeBasic: false,
  includeVerification: false,
});

function normalizePriceLabel(plan) {
  const price = Number(plan?.price) || 0;
  if (price === 0 && !plan?.priceLabel) return 'Gratuito';
  return normalizePlanPriceLabel(plan?.priceLabel, price);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const authResult = await requireActiveApiUser(req, res, {
      missingUserMessage: 'Usuário não encontrado',
    });
    if (!authResult) return;
    const { userData } = authResult;
    if (userData.userType !== 'candidato') {
      return res
        .status(403)
        .json({ error: 'Esta API é apenas para candidatos' });
    }

    // Ler os documentos canónicos diretamente pelo id (onde vivem as edições do
    // admin). Evita queries/índices e é determinístico: sempre os mesmos planos.
    const plansCollection = admin.firestore().collection('plans');
    const refs = FIXED_CANDIDATE_PLANS.map((plan) =>
      plansCollection.doc(plan.id),
    );
    const docs = await admin.firestore().getAll(...refs);

    const overrides = {};
    docs.forEach((doc) => {
      if (doc.exists) {
        overrides[doc.id] = serializeFirestoreValue(doc.data()) || {};
      }
    });

    const plans = FIXED_CANDIDATE_PLANS.map((base) => {
      const override = overrides[base.id] || {};
      const merged = {
        ...base,
        ...override,
        id: base.id,
        planTierId: base.id,
        type: 'candidato',
        // Mantém os recursos por omissão se o admin não tiver definido nenhum.
        features: getCandidatePlanBenefits(
          base.id,
          Array.isArray(override.features) && override.features.length
            ? override.features
            : base.features,
        ),
      };
      merged.priceLabel = normalizePriceLabel(merged);
      return merged;
    })
      // O admin pode desativar um plano canónico; nesse caso não é mostrado.
      .filter((plan) => plan.isActive !== false);

    plans.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));

    return res.status(200).json({ plans });
  } catch (error) {
    logServerError('candidate_plans.listar_planos_de_candidato_failed', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
