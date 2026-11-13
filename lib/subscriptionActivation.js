import { admin } from './firebaseAdmin';
import { normalizeCandidatePlanId } from './candidatePlanFeatures';
import { normalizeEmpresaPlanId } from './empresaPlanFeatures';
import { normalizeUserType } from './defaultPlans';
import { createServerNotification } from './serverNotifications';
import { logServerWarning } from './serverLog';
import {
  buildPlanActivationVersion,
  buildPlanExpirationTaskId,
} from './subscriptionLifecycle';

// Ativação de um pedido de plano pago. Partilhada pela aprovação manual do
// admin (transferência + comprovativo) e pela confirmação de um pagamento
// online (Stripe), para que os dois caminhos deixem o utilizador, a
// subscrição e a tarefa de expiração exatamente no mesmo estado.

const OPEN_REQUEST_STATUSES = new Set(['pending', 'payment_submitted']);

function lifecycleError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function isSubscriptionRequestOpen(request) {
  return OPEN_REQUEST_STATUSES.has(request?.status);
}

/**
 * @param {object} options
 * @param {string} options.requestId
 * @param {string} options.processedBy uid do admin, ou 'stripe'
 * @param {(request: object) => void} [options.assertRequest] validação extra
 *   corrida dentro da transação com os dados frescos do pedido
 * @param {object} [options.paymentUpdate] campos de pagamento a gravar no pedido
 * @returns {Promise<{ request: object, planName: string }>}
 */
export async function approveSubscriptionRequest({
  requestId,
  processedBy,
  assertRequest,
  paymentUpdate = {},
}) {
  const db = admin.firestore();
  const requestRef = db.collection('subscription-requests').doc(requestId);
  const now = admin.firestore.Timestamp.now();
  const activationVersion = buildPlanActivationVersion(requestId);
  let request = null;
  let finalPlanName = '';

  await db.runTransaction(async (transaction) => {
    const freshRequestDoc = await transaction.get(requestRef);
    if (!freshRequestDoc.exists) {
      throw lifecycleError('REQUEST_NOT_FOUND', 'Pedido não encontrado');
    }
    request = freshRequestDoc.data();
    if (!isSubscriptionRequestOpen(request)) {
      throw lifecycleError(
        'REQUEST_ALREADY_PROCESSED',
        'Pedido já foi processado',
      );
    }
    assertRequest?.(request);

    // Buscar dados do usuário para verificar o tipo
    const userRef = db.collection('users').doc(request.userId);
    const userDoc = await transaction.get(userRef);

    if (!userDoc.exists) {
      throw new Error('Usuário não encontrado');
    }

    const userData = userDoc.data();
    const normalizedUserType =
      normalizeUserType(userData.userType) || userData.userType;

    // Buscar nome do plano - sempre buscar da coleção plans
    let planName = request.planName || request.planId;
    let planFeatures = request.features || [];
    let planCurriculoDestacado = request.curriculoDestacado;
    let planDuration = Number(request.duration);
    let planVagasLimit = request.vagasLimit;
    let planDestaque = request.destaque;

    // Tentar buscar plano da coleção plans (se existir)
    if (request.planId) {
      try {
        const planRef = db.collection('plans').doc(request.planId);
        const planDoc = await transaction.get(planRef);
        if (planDoc.exists) {
          const planData = planDoc.data();
          planName = planData.name || planName;
          planFeatures = planData.features || planFeatures || [];
          planCurriculoDestacado =
            planData.curriculoDestacado !== undefined
              ? planData.curriculoDestacado
              : planCurriculoDestacado;
          // Usar duração do plano se disponível
          if (planData.duration !== undefined && planData.duration !== null) {
            planDuration = Number(planData.duration);
          }
          if (
            planVagasLimit === undefined &&
            planData.vagasLimit !== undefined
          ) {
            planVagasLimit = planData.vagasLimit;
          }
          if (planDestaque === undefined && planData.destaque !== undefined) {
            planDestaque = planData.destaque;
          }
        }
      } catch (planError) {
        logServerWarning(
          'admin_subscription_requests_id.buscar_plano_da_colecao_plans_usando_dados_d_failed',
          planError,
        );
      }
    }

    // Se ainda não tem duração, usar padrão baseado no tipo de plano
    if (
      isNaN(planDuration) ||
      planDuration === null ||
      planDuration === undefined
    ) {
      // Planos pagos geralmente têm 30 dias, mas vamos usar o que vem da solicitação ou 30 como padrão
      planDuration = 30; // Default 30 dias para planos pagos
    }

    // Atualizar variável final para uso fora da transação
    finalPlanName = planName;
    const resolvedCompanyPlanTier =
      normalizedUserType === 'empresa'
        ? normalizeEmpresaPlanId(request.planId, planName, {
            vagasLimit: planVagasLimit,
            destaque: planDestaque,
            ...request,
          })
        : null;
    const resolvedCandidatePlanTier =
      normalizedUserType === 'candidato'
        ? normalizeCandidatePlanId(
            request.planTierId || request.planId,
            planName,
            {
              ...request,
              curriculoDestacado: planCurriculoDestacado,
            },
          )
        : null;

    // Calcular data de término usando duração resolvida
    // durationDays === 0 significa plano ilimitado (sem expiração)
    const durationDays = Number(planDuration);
    const endDate =
      durationDays === 0 || durationDays === null
        ? null // Plano ilimitado (sem expiração)
        : admin.firestore.Timestamp.fromMillis(
            now.toMillis() + durationDays * 24 * 60 * 60 * 1000,
          );

    // Atualizar assinatura do usuário com dados consolidados
    const subscriptionRef = db.collection('subscriptions').doc(request.userId);
    const subscriptionData = {
      planId: request.planId,
      planTierId:
        normalizedUserType === 'empresa'
          ? resolvedCompanyPlanTier
          : resolvedCandidatePlanTier,
      userId: request.userId,
      startDate: now,
      endDate: endDate,
      status: 'active',
      planName: planName,
      activationVersion,
    };

    // Adicionar apenas campos que existem e não são undefined
    if (
      planFeatures &&
      Array.isArray(planFeatures) &&
      planFeatures.length > 0
    ) {
      subscriptionData.features = planFeatures;
    }
    if (planVagasLimit !== undefined && planVagasLimit !== null) {
      subscriptionData.vagasLimit = planVagasLimit;
    }
    if (planDestaque !== undefined) {
      subscriptionData.destaque = Boolean(planDestaque);
    }
    if (planCurriculoDestacado !== undefined) {
      subscriptionData.curriculoDestacado = Boolean(planCurriculoDestacado);
    }
    if (!isNaN(durationDays) && durationDays > 0) {
      subscriptionData.duration = durationDays;
    }

    transaction.set(subscriptionRef, subscriptionData, { merge: true });

    const userUpdate = {
      currentPlan:
        normalizedUserType === 'empresa'
          ? resolvedCompanyPlanTier
          : resolvedCandidatePlanTier,
      planTierId:
        normalizedUserType === 'empresa'
          ? resolvedCompanyPlanTier
          : resolvedCandidatePlanTier,
      planId: request.planId,
      planEndDate: endDate, // null para planos ilimitados, Timestamp para planos com prazo
      planName: planName || request.planId,
      planStartDate: now, // Adicionar data de início
      planActivationVersion: activationVersion,
      updatedAt: now,
    };

    // Adicionar features do plano
    if (
      planFeatures &&
      Array.isArray(planFeatures) &&
      planFeatures.length > 0
    ) {
      userUpdate.planFeatures = planFeatures;
    }

    // Adicionar limite de vagas se existir (apenas para empresas)
    if (
      normalizedUserType === 'empresa' &&
      planVagasLimit !== undefined &&
      planVagasLimit !== null
    ) {
      userUpdate.vagasLimit = planVagasLimit;
    }

    // Adicionar destaque se existir (apenas para empresas)
    if (normalizedUserType === 'empresa' && planDestaque !== undefined) {
      userUpdate.destaque = Boolean(planDestaque);
    }

    // Para candidatos, adicionar curriculoDestacado se o plano incluir
    if (normalizedUserType === 'candidato') {
      if (planCurriculoDestacado !== undefined) {
        userUpdate.curriculoDestacado = Boolean(planCurriculoDestacado);
      } else if (
        resolvedCandidatePlanTier &&
        resolvedCandidatePlanTier !== 'basic_candidato'
      ) {
        // Se não foi especificado e não é plano básico, definir como true
        userUpdate.curriculoDestacado = true;
      } else {
        // Se não foi especificado e é plano básico, definir como false
        userUpdate.curriculoDestacado = false;
      }
    }

    // Remover campos undefined antes de atualizar
    Object.keys(userUpdate).forEach((key) => {
      if (userUpdate[key] === undefined) {
        delete userUpdate[key];
      }
    });

    transaction.update(userRef, userUpdate);

    // Atualizar status do pedido
    transaction.update(requestRef, {
      status: 'approved',
      paymentStatus:
        Number(request.price || 0) > 0
          ? 'approved'
          : request.paymentStatus || 'not_required',
      processedAt: now,
      processedBy,
      approvedDate: now,
      updatedAt: now,
      planName: planName || request.planId,
      ...paymentUpdate,
    });

    // Se tem data de término, agendar reversão
    if (endDate) {
      const scheduledTaskRef = db
        .collection('scheduledTasks')
        .doc(buildPlanExpirationTaskId(request.userId, requestId));
      transaction.set(scheduledTaskRef, {
        type: 'REVERT_TO_BASIC_PLAN',
        userId: request.userId,
        requestId,
        planId: request.planId,
        planTierId:
          normalizedUserType === 'empresa'
            ? resolvedCompanyPlanTier
            : resolvedCandidatePlanTier,
        activationVersion,
        planEndDate: endDate,
        executeAt: endDate,
        created: now,
      });
    }
  });

  const planLabel = finalPlanName || request.planName || request.planId;

  await db.collection('activities').add({
    type: 'subscription_approved',
    description: `Assinatura "${planLabel}" foi aprovada para o utilizador ${request.userId}`,
    userId: request.userId,
    requestId,
    planId: request.planId || null,
    adminId: processedBy,
    createdAt: new Date().toISOString(),
  });

  // Notificação ao titular: o plano está ativo.
  await createServerNotification(admin, {
    userId: request.userId,
    type: 'SUBSCRIPTION_APPROVED',
    title: 'Plano Ativado com Sucesso! 🎉',
    message: `Seu plano ${planLabel} foi aprovado e está ativo! Agora você tem acesso a todos os recursos premium.`,
    icon: '✅',
    relatedId: requestId,
    relatedType: 'subscription',
    actionUrl:
      request.planType === 'empresa'
        ? '/dashboard/empresa?tab=plans'
        : '/dashboard/candidato?tab=plans',
  });

  return { request, planName: planLabel };
}
