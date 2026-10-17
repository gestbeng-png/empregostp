const PAYMENT_PROOF_UPLOADABLE_STATUSES = new Set([
  'pending',
  'payment_submitted'
]);

const BASIC_PLAN_IDS = new Set([
  'basic_candidato',
  'basic_empresa'
]);

function createLifecycleError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function assertPaymentProofUploadEligible(request, userId) {
  if (!request) {
    throw createLifecycleError('REQUEST_NOT_FOUND', 'Pedido não encontrado');
  }

  if (request.userId !== userId) {
    throw createLifecycleError('REQUEST_FORBIDDEN', 'Acesso não autorizado');
  }

  if (!PAYMENT_PROOF_UPLOADABLE_STATUSES.has(request.status)) {
    throw createLifecycleError(
      'REQUEST_NOT_UPLOAD_ELIGIBLE',
      'Este pedido já foi processado'
    );
  }

  if (Number(request.price || 0) <= 0) {
    throw createLifecycleError(
      'PAYMENT_PROOF_NOT_REQUIRED',
      'Este pedido não requer comprovativo'
    );
  }
}

// O utilizador pode desistir de um pedido enquanto não enviou comprovativo.
// Depois disso já houve (ou diz que houve) uma transferência: a decisão é do
// administrador, que pode aprovar ou rejeitar.
export function assertRequestCancellable(request, userId) {
  if (!request) {
    throw createLifecycleError('REQUEST_NOT_FOUND', 'Pedido não encontrado');
  }
  if (request.userId !== userId) {
    throw createLifecycleError('REQUEST_FORBIDDEN', 'Acesso não autorizado');
  }
  if (request.status === 'cancelled') return;
  if (request.status !== 'pending' || request.paymentProof?.url) {
    throw createLifecycleError(
      'REQUEST_NOT_CANCELLABLE',
      'Já enviou o comprovativo: o pedido está em análise e não pode ser cancelado aqui. Contacte o suporte se precisar.'
    );
  }
}

// Um comprovativo prova uma transferência. O mesmo ficheiro não pode ativar
// dois pedidos — senão um único pagamento comprava vários planos. Só fica livre
// quando o pedido a que pertencia foi rejeitado (ou já não existe): aí é o
// mesmo pagamento a ser reapresentado, não um segundo.
const PAYMENT_PROOF_HASH_RELEASING_STATUSES = new Set(['rejected']);

export function assertPaymentProofHashAvailable(
  hashRecord,
  linkedRequest,
  requestId
) {
  if (!hashRecord || hashRecord.requestId === requestId) return;
  if (!linkedRequest) return;
  if (PAYMENT_PROOF_HASH_RELEASING_STATUSES.has(linkedRequest.status)) return;

  throw createLifecycleError(
    'PAYMENT_PROOF_DUPLICATE',
    'Este comprovativo já foi enviado noutro pedido.'
  );
}

export function timestampToMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value.seconds === 'number') {
    return (value.seconds * 1000) + Math.floor((value.nanoseconds || 0) / 1e6);
  }

  const millis = value instanceof Date
    ? value.getTime()
    : new Date(value).getTime();

  return Number.isFinite(millis) ? millis : null;
}

/**
 * Normaliza o preço configurado de um plano (número ou string numérica).
 * Devolve o valor em Dobras (>= 0) ou `null` para configuração inválida —
 * o chamador decide entre caminho gratuito (0) e pago (> 0) a partir de um
 * único valor, nunca do campo bruto do Firestore.
 */
export function normalizePlanPrice(value) {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * Normaliza a duração configurada de um plano em dias inteiros positivos.
 * Campo ausente/vazio recebe o fallback (30 dias, o default histórico);
 * um valor presente mas não interpretável devolve `null` (configuração
 * inválida), para nunca gerar datas de expiração corrompidas.
 */
export function normalizePlanDurationDays(value, fallbackDays = 30) {
  if (value === undefined || value === null || value === '') {
    return fallbackDays;
  }
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

export function buildPlanActivationVersion(requestId) {
  return `subscription-request:${String(requestId)}`;
}

export function buildPlanExpirationTaskId(userId, requestId) {
  return `plan-expiration_${String(userId)}_${String(requestId)}`;
}

export function evaluatePlanExpirationTask({
  task,
  user,
  subscription,
  now
}) {
  if (!task || !user) {
    return { eligible: false, reason: 'missing_record' };
  }

  const nowMillis = timestampToMillis(now);
  const taskEndMillis = timestampToMillis(task.planEndDate || task.executeAt);
  const userEndMillis = timestampToMillis(user.planEndDate);
  const subscriptionEndMillis = timestampToMillis(subscription?.endDate);
  const userPlanId = user.planId || user.currentPlan;
  const subscriptionPlanId = subscription?.planId;

  if (!Number.isFinite(nowMillis) || !Number.isFinite(taskEndMillis)) {
    return { eligible: false, reason: 'invalid_expiration' };
  }

  if (taskEndMillis > nowMillis) {
    return { eligible: false, reason: 'not_due' };
  }

  if (BASIC_PLAN_IDS.has(userPlanId) || userEndMillis === null) {
    return { eligible: false, reason: 'user_already_basic_or_unlimited' };
  }

  if (userEndMillis !== taskEndMillis) {
    return { eligible: false, reason: 'user_expiration_changed' };
  }

  const activationVersion = task.activationVersion || null;
  if (activationVersion) {
    if (
      user.planActivationVersion !== activationVersion
      || !subscription
      || subscription.activationVersion !== activationVersion
    ) {
      return { eligible: false, reason: 'activation_version_changed' };
    }
  } else if (user.planActivationVersion || subscription?.activationVersion) {
    // A legacy, unversioned task can never expire a plan activated by the
    // versioned flow.
    return { eligible: false, reason: 'legacy_task_for_versioned_plan' };
  }

  if (task.planId && user.planId !== task.planId) {
    return { eligible: false, reason: 'user_plan_changed' };
  }

  if (subscription) {
    if (subscription.status && subscription.status !== 'active') {
      return { eligible: false, reason: 'subscription_inactive' };
    }
    if (task.planId && subscriptionPlanId !== task.planId) {
      return { eligible: false, reason: 'subscription_plan_changed' };
    }
    if (subscriptionEndMillis !== taskEndMillis) {
      return { eligible: false, reason: 'subscription_expiration_changed' };
    }
  }

  return { eligible: true, reason: 'current_expired_activation' };
}
