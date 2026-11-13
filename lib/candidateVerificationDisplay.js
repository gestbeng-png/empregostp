/**
 * O benefício Premium não pode ser ocultado por uma revisão antiga pendente.
 * @param {object} [options]
 * @param {object} [options.visibility]
 * @param {object|null} [options.record]
 * @param {object} [options.summary]
 * @param {string} [options.fallbackStatus]
 */
export function getCandidateVerificationDisplayState({
  visibility = {},
  record = null,
  summary = {},
  fallbackStatus = 'unverified',
} = {}) {
  const premiumActive = Boolean(visibility.premiumVerified);
  const reviewedActive = record
    ? Boolean(
        record.summary?.publicVerified ??
        record.verificationItems?.[
          record.verificationMethod === 'competencies'
            ? 'competencies'
            : 'identity'
        ]?.status === 'approved',
      )
    : Boolean(
        visibility.verified ||
        visibility.paidVerified ||
        visibility.qualifiedVerified ||
        fallbackStatus === 'verified',
      );
  const active = premiumActive || reviewedActive;
  const pending =
    !active &&
    ((record?.status || summary.status || fallbackStatus) === 'pending' ||
      summary.pendingCount > 0);
  return { active, pending, premiumActive };
}
