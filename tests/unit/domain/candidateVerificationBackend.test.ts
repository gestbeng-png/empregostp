import {
  getCandidateVerification,
  isCandidateVerified,
} from '../../../lib/candidateProfileInsights';
import {
  buildVerificationRecord,
  buildVerificationStateUpdate,
  getVerificationApprovalEligibility,
  getVerificationRecordTime,
  reviewVerificationRecord,
  serializeVerificationTimestamps,
  validateVerificationRecord,
} from '../../../lib/candidateVerification';

const submittedAt = '2026-01-01T10:00:00.000Z';
const now = '2026-02-01T10:00:00.000Z';

function identityRecord() {
  return buildVerificationRecord({
    uid: 'candidate-1',
    now: submittedAt,
    documents: {
      requestedTypes: ['identity'],
      contact: { email: 'old@example.com', phone: '+239 9999999' },
      idDocument: { url: 'https://example.com/id.pdf' },
      selfieDocument: { url: 'https://example.com/selfie.jpg' },
    },
  });
}

describe('verification evidence and administrative transitions', () => {
  test.each(['approved', 'pending', 'rejected'])(
    'preserves an omitted %s item in full',
    (status) => {
      const previousRecord = identityRecord();
      const previous = previousRecord.verificationItems.identity;
      Object.assign(previous, {
        status,
        reviewedAt: submittedAt,
        reviewedBy: 'admin-1',
        reviewReason: 'Original review',
        revokedAt: submittedAt,
        revokedBy: 'admin-1',
      });

      const next = buildVerificationRecord({
        previousRecord,
        now,
        userData: { email: 'changed@example.com', phone: 'changed' },
        documents: {
          requestedTypes: ['academic'],
          educationSummary: 'Licenciatura em Gestão',
        },
      });

      expect(next.verificationItems.identity).toEqual(previous);
      expect(next.verificationItems.academic.status).toBe('pending');
      expect(validateVerificationRecord(next).valid).toBe(true);
    },
  );

  test('cannot replace approved evidence by selecting the approved type again', () => {
    const previousRecord = reviewVerificationRecord(identityRecord(), {
      action: 'approve',
      now,
    });
    const next = buildVerificationRecord({
      previousRecord,
      documents: {
        requestedTypes: ['identity'],
        idDocument: { url: 'https://example.com/unreviewed.pdf' },
      },
    });
    expect(next.verificationItems.identity).toEqual(
      previousRecord.verificationItems.identity,
    );
  });

  test.each([{ requestedTypes: [] }, { requestedTypes: ['unknown'] }])(
    'honors an explicit selection %j without inferring from evidence or the profile',
    ({ requestedTypes }) => {
      const next = buildVerificationRecord({
        documents: {
          requestedTypes,
          academicDocument: 'https://example.com/diploma.pdf',
        },
        userData: {
          email: 'user@example.com',
          phone: '123',
          cvUrl: 'https://example.com/cv.pdf',
        },
      });
      expect(next.submittedTypes).toEqual([]);
      expect(next.summary.requestedCount).toBe(0);
    },
  );

  test('retains inference for legacy clients without requestedTypes', () => {
    expect(
      buildVerificationRecord({
        documents: { educationSummary: 'Licenciatura' },
      }).submittedTypes,
    ).toEqual(['academic']);
  });

  test('preserves revoked state through an unrelated submission and permits reactivation', () => {
    const approved = reviewVerificationRecord(identityRecord(), {
      action: 'approve',
      now: submittedAt,
    });
    const revoked = reviewVerificationRecord(approved, {
      action: 'revoke',
      reviewerId: 'admin-1',
      now: submittedAt,
    });
    const next = buildVerificationRecord({
      previousRecord: revoked,
      now,
      documents: {
        requestedTypes: ['academic'],
        educationSummary: 'Licenciatura',
      },
    });
    expect(next.verificationItems.identity.revokedAt).toBe(submittedAt);
    const active = reviewVerificationRecord(next, {
      action: 'reactivate',
      verificationType: 'identity',
      now,
    });
    expect(active.verificationItems.identity.status).toBe('approved');
    expect(active.verificationItems.academic.status).toBe('pending');
  });

  test.each([null, 'identity'])(
    'reactivate %s cannot approve an ordinary rejection',
    (verificationType) => {
      const rejected = reviewVerificationRecord(identityRecord(), {
        action: 'reject',
        reason: 'Illegible',
        now: submittedAt,
      });
      const next = reviewVerificationRecord(rejected, {
        action: 'reactivate',
        verificationType,
        now,
      });
      expect(next.verificationItems.identity).toEqual(
        rejected.verificationItems.identity,
      );
    },
  );

  test('a new review rejection after resubmitting revoked evidence is not reactivatable', () => {
    const approved = reviewVerificationRecord(identityRecord(), {
      action: 'approve',
    });
    const revoked = reviewVerificationRecord(approved, {
      action: 'revoke',
      now: submittedAt,
    });
    const resubmitted = buildVerificationRecord({
      previousRecord: revoked,
      documents: identityRecord().documents,
    });
    const rejected = reviewVerificationRecord(resubmitted, {
      action: 'reject',
      now,
    });
    const reactivated = reviewVerificationRecord(rejected, {
      action: 'reactivate',
      verificationType: 'identity',
    });
    expect(reactivated.verificationItems.identity.status).toBe('rejected');
    expect(reactivated.verificationItems.identity.revokedAt).toBeNull();
  });

  test.each(['approve', 'reject', 'revoke'])(
    '%s honors the required source state even with an explicit type',
    (action) => {
      const record = identityRecord();
      record.verificationItems.identity.status = 'rejected';
      expect(
        reviewVerificationRecord(record, {
          action,
          verificationType: 'identity',
        }).verificationItems.identity,
      ).toEqual(record.verificationItems.identity);
    },
  );

  test('serializes Date and Firestore timestamps without dropping administrative times', () => {
    const timestamp = { toDate: () => new Date(submittedAt) };
    expect(
      serializeVerificationTimestamps({
        createdAt: new Date(submittedAt),
        revokedAt: timestamp,
      }),
    ).toEqual({ createdAt: submittedAt, revokedAt: submittedAt });
    const previousRecord = identityRecord();
    Object.assign(previousRecord.verificationItems.identity, {
      revokedAt: timestamp,
    });
    const next = buildVerificationRecord({
      previousRecord,
      documents: { requestedTypes: [] },
    });
    expect(next.verificationItems.identity.revokedAt).toBe(submittedAt);
  });
});

describe('public paid verification projection', () => {
  test.each(['rejected', 'pending', 'unverified', 'revoked'])(
    '%s in the user overrides every stale profile paid marker',
    (verificationStatus) => {
      const user = {
        verificationStatus,
        verified: false,
        verificationType: null,
        verificationTypes: [],
      };
      const profile = {
        verificationType: 'paid',
        verificationTypes: ['paid'],
        verified: true,
        verificado: true,
        isVerified: true,
        verificationStatus: 'verified',
      };
      expect(getCandidateVerification(user, profile).paid).toBe(false);
      expect(isCandidateVerified(user, profile)).toBe(false);
    },
  );

  test('structured identity state overrides stale legacy flags and allows a later approval', () => {
    const revoked = {
      verificationItems: { identity: { status: 'rejected' } },
      verified: true,
      verificationType: 'paid',
    };
    expect(getCandidateVerification(revoked).paid).toBe(false);
    expect(
      getCandidateVerification({
        ...revoked,
        verificationItems: { identity: { status: 'approved' } },
      }).paid,
    ).toBe(true);
  });

  test.each([
    { verified: true },
    { verificado: true },
    { isVerified: true },
    { verificationType: 'paid' },
    { verificationTypes: ['paid'] },
  ])(
    'preserves legacy paid verification %j without a newer decision',
    (user) => {
      expect(getCandidateVerification(user).paid).toBe(true);
    },
  );

  test('a revoke projection clears every legacy field and a reactivation restores the same public shape', () => {
    const approved = reviewVerificationRecord(identityRecord(), {
      action: 'approve',
    });
    const revoked = reviewVerificationRecord(approved, { action: 'revoke' });
    expect(
      buildVerificationStateUpdate('v1', revoked, 'timestamp', now),
    ).toMatchObject({
      verificationId: 'v1',
      verificationType: null,
      verificationTypes: [],
      verified: false,
      verificado: false,
      isVerified: false,
      verifiedAt: null,
      verificationStatus: 'rejected',
    });
    const restored = reviewVerificationRecord(revoked, {
      action: 'reactivate',
    });
    expect(
      buildVerificationStateUpdate('v1', restored, 'timestamp', now),
    ).toMatchObject({
      verificationType: 'paid',
      verificationTypes: ['paid'],
      verified: true,
      verificado: true,
      isVerified: true,
      verifiedAt: 'timestamp',
    });
  });
});

describe('verification dates and approval eligibility', () => {
  test.each([
    new Date(now),
    now,
    Date.parse(now),
    { toDate: () => new Date(now) },
    { toMillis: () => Date.parse(now) },
  ])('supports date representation %j for ordering', (updatedAt) => {
    expect(getVerificationRecordTime({ updatedAt, submittedAt })).toBe(
      Date.parse(now),
    );
  });

  test('falls back past an invalid date to createdAt', () => {
    expect(
      getVerificationRecordTime({ updatedAt: 'invalid', createdAt: now }),
    ).toBe(Date.parse(now));
  });

  test('uses a CV stored only in profiles', () => {
    expect(
      getVerificationApprovalEligibility(
        { currentPlan: 'verification_candidato' },
        { cvUrl: 'https://example.com/cv.pdf' },
      ),
    ).toEqual({ allowed: true });
  });

  test('rejects an expired verification plan even while currentPlan still names it', () => {
    expect(
      getVerificationApprovalEligibility({
        currentPlan: 'verification_candidato',
        planEndDate: '2000-01-01',
        cvUrl: 'https://example.com/cv.pdf',
      }),
    ).toMatchObject({ allowed: false, code: 'VERIFICATION_PLAN_NOT_ELIGIBLE' });
  });
});
