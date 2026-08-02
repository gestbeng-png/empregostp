export function isAdminPublishedJob(job, adminUid = '') {
  if (!job || typeof job !== 'object') return false;

  return (
    job.createdByRole === 'admin' ||
    job.companySource === 'external' ||
    job.isExternalCompany === true ||
    Boolean(adminUid && job.createdBy === adminUid)
  );
}
