import { DEFAULT_EMPRESA_PLANS } from "./defaultPlans";
import { normalizeEmpresaPlanId } from "./empresaPlanFeatures";

const MONTHLY_PRICE_LABEL_PATTERN = /(?:m[eê]s|mensal)/i;

const PLAN_PRESENTATION = {
  basic_empresa: {
    description: "Para começar sem compromisso e publicar a primeira vaga.",
    accent: "#6f84a6",
    popular: false,
  },
  essential_empresa: {
    description:
      "Para pequenas empresas que recrutam ocasionalmente e querem mais visibilidade.",
    accent: "#3f6fc4",
    popular: false,
  },
  professional_empresa: {
    description:
      "Para empresas que recrutam regularmente: mais alcance, destaque e mensagens diretas.",
    accent: "#2057d7",
    popular: true,
  },
  unlimited_empresa: {
    description:
      "Para empresas com recrutamento contínuo, com alcance máximo e apoio especializado.",
    accent: "#5fb8f5",
    popular: false,
  },
};

const CATALOG_TIERS = new Set([
  "basic_empresa",
  "essential_empresa",
  "professional_empresa",
  "unlimited_empresa",
]);

export function serializeFirestoreValue(value) {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value?.toDate === "function") {
    try {
      const date = value.toDate();
      if (date instanceof Date) return date.toISOString();
    } catch (error) {}
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeFirestoreValue(item));
  }

  if (typeof value === "object") {
    const serialized = {};
    Object.entries(value).forEach(([key, entryValue]) => {
      serialized[key] = serializeFirestoreValue(entryValue);
    });
    return serialized;
  }

  if (["string", "number", "boolean"].includes(typeof value)) {
    return value;
  }

  return null;
}

/**
 * Todos os documentos de planos de empresa, ativos e inativos. O catálogo
 * filtra os inativos e usa-os para saber que escalões o admin desligou, para
 * não os repor com os valores padrão.
 */
export async function fetchEmpresaPlans(admin) {
  const plansSnapshot = await admin
    .firestore()
    .collection("plans")
    .where("type", "==", "empresa")
    .get();

  return plansSnapshot.docs.map((doc) => {
    const data = serializeFirestoreValue(doc.data());
    return {
      id: doc.id,
      ...data,
      isDefault: false,
    };
  });
}

export function getEmpresaPlanCatalog(plans = []) {
  const defaultByTier = DEFAULT_EMPRESA_PLANS.reduce((acc, plan) => {
    acc[plan.id] = plan;
    return acc;
  }, {});

  const empresaPlans = (plans || []).filter(
    (plan) =>
      String(plan.type || "")
        .toLowerCase()
        .trim() === "empresa",
  );

  // Escalões que ainda não existem no Firestore (ex.: um escalão novo antes
  // de o admin configurar os planos) entram com os valores padrão; os que o
  // admin desativou ficam de fora.
  const configuredTiers = new Set(
    empresaPlans.map((plan) => normalizeEmpresaPlanId(plan.id, plan.name, plan)),
  );
  const sourcePlans =
    empresaPlans.length > 0
      ? [
          ...empresaPlans.filter((plan) => plan.isActive !== false),
          ...DEFAULT_EMPRESA_PLANS.filter(
            (plan) => !configuredTiers.has(plan.id),
          ),
        ]
      : DEFAULT_EMPRESA_PLANS;

  const normalizedPlans = [...sourcePlans]
    .map((plan) => {
      const normalizedId = normalizeEmpresaPlanId(plan.id, plan.name, plan);
      const presentation = PLAN_PRESENTATION[normalizedId] || {};
      const standardPlan = defaultByTier[normalizedId] || {};
      const isKnownTier = CATALOG_TIERS.has(normalizedId);

      // Os valores definidos pelo admin (Firestore) são a fonte da verdade.
      // Os planos padrão apenas preenchem campos em falta e dão o id canónico
      // usado nas regras de negócio (subscrição, plano atual, etc.).
      const mergedPlan = isKnownTier
        ? {
            ...standardPlan,
            ...plan,
            id: standardPlan.id || normalizedId,
            sourcePlanId: plan.id,
            features:
              Array.isArray(plan.features) && plan.features.length
                ? plan.features
                : standardPlan.features || [],
          }
        : { ...plan };
      const numericPrice = Number(mergedPlan.price) || 0;
      const priceLabel =
        mergedPlan.priceLabel ||
        (numericPrice === 0 ? "0 STD" : `${numericPrice} STD`);

      return {
        ...mergedPlan,
        normalizedId,
        description:
          mergedPlan.description ||
          mergedPlan.desc ||
          mergedPlan.excerpt ||
          presentation.description ||
          "Plano empresarial",
        accent: mergedPlan.accent || presentation.accent || "#38bdf8",
        popular: Boolean(mergedPlan.popular ?? presentation.popular),
        priceLabel,
        pricePeriodLabel:
          numericPrice > 0 && !MONTHLY_PRICE_LABEL_PATTERN.test(priceLabel)
            ? "por mês"
            : "",
      };
    })
    .filter((plan) => CATALOG_TIERS.has(plan.normalizedId))
    .sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));

  // Dedupe by tier in case there are legacy/duplicate documents in Firestore.
  const byTier = new Map();
  normalizedPlans.forEach((plan) => {
    if (!byTier.has(plan.normalizedId)) {
      byTier.set(plan.normalizedId, plan);
    }
  });

  return Array.from(byTier.values()).sort(
    (a, b) => (Number(a.price) || 0) - (Number(b.price) || 0),
  );
}
