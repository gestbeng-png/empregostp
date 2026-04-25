import { DEFAULT_EMPRESA_PLANS } from "./defaultPlans";
import { normalizeEmpresaPlanId } from "./empresaPlanFeatures";

const PLAN_PRESENTATION = {
  basic_empresa: {
    description: "Plano inicial para publicar e gerir a primeira vaga",
    accent: "#6f84a6",
    popular: false,
  },
  professional_empresa: {
    description:
      "Mais vagas, destaque e ferramentas de gestão para recrutamento recorrente",
    accent: "#2057d7",
    popular: true,
  },
  unlimited_empresa: {
    description:
      "Plano PRO com mensagens diretas, analytics completos e outros serviços avançados",
    accent: "#5fb8f5",
    popular: false,
  },
};

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

export async function fetchActiveEmpresaPlans(admin) {
  let plansSnapshot;
  try {
    plansSnapshot = await admin
      .firestore()
      .collection("plans")
      .where("isActive", "==", true)
      .where("type", "==", "empresa")
      .get();
  } catch (error) {
    // Fallback for projects without the composite index on (isActive, type).
    if (error?.code !== 9) throw error;
    const fallback = await admin
      .firestore()
      .collection("plans")
      .where("type", "==", "empresa")
      .get();
    plansSnapshot = {
      docs: fallback.docs.filter((doc) => doc.data()?.isActive === true),
    };
  }

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

  const activeEmpresaPlans = (plans || []).filter(
    (plan) =>
      String(plan.type || "")
        .toLowerCase()
        .trim() === "empresa",
  );

  const sourcePlans =
    activeEmpresaPlans.length > 0
      ? activeEmpresaPlans.filter((plan) => plan.isActive !== false)
      : DEFAULT_EMPRESA_PLANS;

  const allowed = new Set([
    "basic_empresa",
    "professional_empresa",
    "unlimited_empresa",
  ]);

  const normalizedPlans = [...sourcePlans]
    .map((plan) => {
      const normalizedId = normalizeEmpresaPlanId(plan.id, plan.name, plan);
      const presentation = PLAN_PRESENTATION[normalizedId] || {};
      const standardPlan = defaultByTier[normalizedId] || {};
      const mergedPlan = {
        ...plan,
        ...(normalizedId === "basic_empresa" ||
        normalizedId === "professional_empresa" ||
        normalizedId === "unlimited_empresa"
          ? {
              id: standardPlan.id || normalizedId,
              sourcePlanId: plan.id,
              name: standardPlan.name || plan.name,
              price: standardPlan.price ?? plan.price,
              priceLabel: standardPlan.priceLabel || plan.priceLabel,
              features: standardPlan.features || plan.features,
              vagasLimit: standardPlan.vagasLimit ?? plan.vagasLimit,
              destaque: standardPlan.destaque ?? plan.destaque,
            }
          : {}),
      };
      const numericPrice = Number(mergedPlan.price) || 0;

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
        priceLabel:
          mergedPlan.priceLabel ||
          (numericPrice === 0 ? "0 Db" : `${numericPrice} Db/mês`),
      };
    })
    .filter((plan) => allowed.has(plan.normalizedId))
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
