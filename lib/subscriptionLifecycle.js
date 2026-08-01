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
