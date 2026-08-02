const COMPANY_ID_FIELDS = [
  'companyId',
  'empresaId',
  'companyUid',
  'employerId',
  'createdBy',
];

export function getCompanyIdFromRecord(record = {}) {
  for (const field of COMPANY_ID_FIELDS) {
    const value = record?.[field];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

export function resolveApplicationCompanyId(application = {}, job = {}) {
  return getCompanyIdFromRecord(application) || getCompanyIdFromRecord(job);
}

function getApplicationJobId(application = {}) {
  const value = application?.jobId;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Reads candidate applications page-by-page until the company has enough
 * records for its history (or there are no records left).
 *
 * Ownership stored directly on the application always wins. Legacy
 * applications without an owner are resolved through their related job.
 * Keeping pagination here prevents newer applications from other companies
 * from hiding the current company's older records.
 */
export async function collectCompanyApplicationHistory({
  companyId,
  fetchPage,
  fetchJob,
  limit = 20,
}) {
  if (
    typeof companyId !== 'string' ||
    !companyId.trim() ||
    typeof fetchPage !== 'function' ||
    typeof fetchJob !== 'function' ||
    !Number.isInteger(limit) ||
    limit <= 0
  ) {
    return [];
  }

  const normalizedCompanyId = companyId.trim();
  const selected = [];
  const jobCache = new Map();
  let cursor = null;

  while (selected.length < limit) {
    const page = await fetchPage(cursor);
    const applications = Array.isArray(page?.applications)
      ? page.applications
      : [];

    if (applications.length === 0) {
      break;
    }

    const unresolvedJobIds = [
      ...new Set(
        applications
          .filter((application) => !getCompanyIdFromRecord(application))
          .map((application) => getApplicationJobId(application))
          .filter((jobId) => jobId && !jobCache.has(jobId)),
      ),
    ];

    await Promise.all(
      unresolvedJobIds.map(async (jobId) => {
        const job = await fetchJob(jobId);
        jobCache.set(jobId, job || {});
      }),
    );

    for (const application of applications) {
      const jobId = getApplicationJobId(application);
      const relatedJob = jobId ? jobCache.get(jobId) || {} : {};

      if (
        resolveApplicationCompanyId(application, relatedJob) ===
        normalizedCompanyId
      ) {
        selected.push(application);
        if (selected.length === limit) {
          break;
        }
      }
    }

    if (!page?.hasMore || !page?.cursor) {
      break;
    }

    cursor = page.cursor;
  }

  return selected;
}
