function parseDateOnlyAsUtcEndOfDay(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, year, month, day] = match;
  return new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), 23, 59, 59, 999),
  );
}

export function parseJobCloseDate(value) {
  if (!value) return null;

  if (typeof value?.toDate === 'function') {
    const parsed = value.toDate();
    return parsed instanceof Date && !Number.isNaN(parsed.getTime())
      ? parsed
      : null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string') {
    const dateOnly = parseDateOnlyAsUtcEndOfDay(value);
    if (dateOnly) return dateOnly;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isJobExpired(job = {}, now = new Date()) {
  const closeDate = parseJobCloseDate(
    job.dataFecho || job.expiresAt || job.dataEncerramento,
  );
  if (!closeDate) return false;
  return closeDate.getTime() < now.getTime();
}

export function getEffectiveJobStatus(job = {}, now = new Date()) {
  const currentStatus = String(job.status || 'active')
    .trim()
    .toLowerCase();
  if (['closed', 'disabled', 'inactive', 'draft'].includes(currentStatus)) {
    return currentStatus;
  }

  if (isJobExpired(job, now)) {
    return 'closed';
  }

  if (
    !currentStatus ||
    currentStatus === 'open' ||
    currentStatus === 'aberta' ||
    currentStatus === 'published'
  ) {
    return 'active';
  }

  return currentStatus;
}

/**
 * Public job pages must only expose vacancies that are effectively open.
 *
 * `getEffectiveJobStatus` keeps the existing backwards compatibility for
 * legacy records without a status and for the historical open/published
 * aliases, while also taking the closing date into account.
 */
export function isJobPubliclyVisible(job = {}, now = new Date()) {
  return getEffectiveJobStatus(job, now) === 'active';
}

/**
 * Campos do fecho automático. Com `jobData`, acrescenta:
 * - D7: numa vaga com estado v2 publicada, `v2Status` EXPIRED e versão +1
 *   (sem isto o v2 continuava a ver a vaga como publicada);
 * - F2.8: o marcador de fim de vaga que o cron usa para tratar as
 *   candidaturas que ficaram abertas (expand-only, não muda o legado).
 */
/**
 * @param {any} admin
 * @param {Date} [now]
 * @param {Record<string, any> | null} [jobData]
 */
export function buildExpiredJobUpdate(admin, now = new Date(), jobData = null) {
  const update = {
    status: 'closed',
    destaque: false,
    closedAutomatically: true,
    closedReason: 'expired',
    closedAt: admin.firestore.FieldValue.serverTimestamp(),
    expiredAt: now.toISOString(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (!jobData) return update;
  update.jobEndState = 'EXPIRED';
  update.jobEndedAt = now.toISOString();
  update.jobEndPending = true;
  if (jobData.v2Status === 'PUBLISHED') {
    update.v2Status = 'EXPIRED';
    update.version =
      (Number.isSafeInteger(jobData.version) ? jobData.version : 0) + 1;
    update.updatedBy = 'system:expireJobs';
  }
  return update;
}

/** Histórico (D4) da expiração de uma vaga v2; `null` para vagas legadas. */
export function buildExpiryHistory(jobId, jobData, update, now = new Date()) {
  if (!update.v2Status) return null;
  return {
    entityId: jobId,
    from: jobData.v2Status,
    to: 'EXPIRED',
    actorId: 'system:expireJobs',
    actorType: 'SYSTEM',
    reason: 'DEADLINE_PASSED',
    at: now,
    version: update.version,
  };
}

export async function syncExpiredJobStatus(
  jobRef,
  jobData = {},
  admin,
  now = new Date(),
) {
  if (!jobRef || !jobData || getEffectiveJobStatus(jobData, now) !== 'closed') {
    return {
      updated: false,
      jobData,
    };
  }

  const currentStatus = String(jobData.status || 'active').toLowerCase();
  if (
    currentStatus === 'closed' ||
    currentStatus === 'disabled' ||
    currentStatus === 'inactive' ||
    currentStatus === 'draft'
  ) {
    return {
      updated: false,
      jobData: {
        ...jobData,
        status: currentStatus,
      },
    };
  }

  const update = buildExpiredJobUpdate(admin, now, jobData);
  const history = buildExpiryHistory(jobRef.id, jobData, update, now);
  if (history) {
    const batch = admin.firestore().batch();
    batch.update(jobRef, update);
    batch.create(
      admin.firestore().collection('jobsStatusHistory').doc(),
      history,
    );
    await batch.commit();
  } else {
    await jobRef.update(update);
  }

  return {
    updated: true,
    jobData: {
      ...jobData,
      status: 'closed',
      destaque: false,
      closedAutomatically: true,
      closedReason: 'expired',
      closedAt: now.toISOString(),
      expiredAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  };
}
