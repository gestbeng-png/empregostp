import type { OutboxEvent } from '@/domain/outbox/OutboxEvent';
import { EmailNotificationDispatcher } from '@/infrastructure/firebase/marketplace/EmailNotificationDispatcher';
import { FirestoreNotificationDispatcher } from '@/infrastructure/firebase/marketplace/FirestoreNotificationDispatcher';
import { resolveRecruitmentNotice } from '@/infrastructure/firebase/marketplace/RecruitmentNotificationResolver';
import { sendEmail } from '@/lib/email';

jest.mock('@/lib/email', () => ({ sendEmail: jest.fn() }));
const NOW = 1800000000000;
const timestamp = (millis: number) => ({ toMillis: () => millis });
function fixture(records: Record<string, Record<string, unknown>> = {}) {
  const written: Record<string, unknown>[] = [];
  const db = {
    collection: (collection: string) => ({
      doc: (id: string) => ({
        get: async () => ({ data: () => records[`${collection}/${id}`] }),
        create: async (data: Record<string, unknown>) => {
          written.push({ ...data, id });
        },
      }),
    }),
  } as never;
  return { db, written };
}
function event(type: string, payload: OutboxEvent['payload']): OutboxEvent {
  return {
    id: 'event-1',
    type,
    payload,
    schemaVersion: 1,
    status: 'PROCESSING',
    attempts: 0,
    createdAtMs: NOW,
    nextAttemptAtMs: NOW,
  };
}
const interview = {
  candidateUserId: 'candidate',
  applicationId: 'application',
  v2Status: 'CONFIRMED',
  startsAt: timestamp(NOW + 3600000),
  internalNotes: 'SECRET_NOTES',
  feedback: { comment: 'SECRET_FEEDBACK' },
};
describe('Recruitment transactional notifications', () => {
  const originalSecret = process.env.TEAM_INVITE_SECRET;
  afterEach(() => {
    if (originalSecret === undefined) delete process.env.TEAM_INVITE_SECRET;
    else process.env.TEAM_INVITE_SECRET = originalSecret;
  });
  it('delivers due interview reminders in-app without leaking internal feedback', async () => {
    const { db, written } = fixture({
      'interviews/interview': interview,
      'applications/application': {
        candidateSnapshot: { email: 'candidate@example.com' },
      },
    });
    const e = event('interview_reminder', {
      interviewId: 'interview',
      window: '2H',
    });
    await new FirestoreNotificationDispatcher(db, () => NOW).deliver(
      e,
      'event-1:dispatch_in_app_notification',
    );
    expect(written[0]).toMatchObject({
      userId: 'candidate',
      type: 'INTERVIEW_REMINDER',
      link: '/dashboard/candidato/candidaturas',
    });
    expect(JSON.stringify(written)).not.toContain('SECRET');
  });
  it.each(['CANCELLED', 'COMPLETED', 'NO_SHOW'])(
    'does not send reminders for %s interviews',
    async (v2Status) => {
      const { db } = fixture({
        'interviews/interview': { ...interview, v2Status },
      });
      expect(
        await resolveRecruitmentNotice(
          db,
          event('interview_reminder', {
            interviewId: 'interview',
            window: '2H',
          }),
          NOW,
        ),
      ).toBeNull();
    },
  );
  it('does not send late interview reminders', async () => {
    const { db } = fixture({
      'interviews/interview': { ...interview, startsAt: timestamp(NOW - 1) },
    });
    expect(
      await resolveRecruitmentNotice(
        db,
        event('interview_reminder', { interviewId: 'interview', window: '2H' }),
        NOW,
      ),
    ).toBeNull();
  });
  it('delivers interview changes by email with only a private dashboard link', async () => {
    const { db } = fixture({
      'interviews/interview': interview,
      'applications/application': {
        candidateSnapshot: { email: 'candidate@example.com' },
      },
    });
    const e = event('entity_status_changed', {
      entityId: 'interview',
      entityKind: 'Interview',
      version: 2,
    });
    await new EmailNotificationDispatcher(db).deliver(
      e,
      'event-1:dispatch_transactional_email',
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'candidate@example.com',
        text: expect.stringContaining(
          'https://empregostp.com/dashboard/candidato/candidaturas',
        ),
      }),
    );
    expect(JSON.stringify(jest.mocked(sendEmail).mock.calls)).not.toContain(
      'SECRET',
    );
  });
  it('sends hire confirmation requests only while pending and active', async () => {
    const e = event('hire_confirmation_request', {
      hireId: 'hire',
      stage: 'REQUEST',
    });
    const { db } = fixture({
      'hires/hire': {
        applicationId: 'application',
        candidateUserId: 'candidate',
        v2Status: 'ACTIVE',
        candidateConfirmation: 'PENDING',
      },
      'applications/application': {
        candidateSnapshot: { email: 'candidate@example.com' },
      },
    });
    expect(await resolveRecruitmentNotice(db, e, NOW)).toMatchObject({
      userId: 'candidate',
      email: 'candidate@example.com',
      type: 'HIRE_CONFIRMATION_REQUEST',
    });
    const confirmed = fixture({
      'hires/hire': { v2Status: 'ACTIVE', candidateConfirmation: 'CONFIRMED' },
    });
    expect(await resolveRecruitmentNotice(confirmed.db, e, NOW)).toBeNull();
    expect(
      await resolveRecruitmentNotice(
        db,
        { ...e, payload: { hireId: 'hire', stage: 'NO_RESPONSE' } },
        NOW,
      ),
    ).toBeNull();
  });
  it('sends silence reminders to the current owner, never an arbitrary or old owner', async () => {
    const { db } = fixture({
      'jobs/job': { organizationId: 'org', v2Status: 'PUBLISHED' },
      'organizations/org': { ownerUserId: 'new-owner' },
      'users/new-owner': { email: 'owner@example.com' },
    });
    const e = event('employer_silence_reminder', {
      jobId: 'job',
      stage: 'REMINDER_D5',
    });
    expect(await resolveRecruitmentNotice(db, e, NOW)).toMatchObject({
      userId: 'new-owner',
      email: 'owner@example.com',
      path: '/dashboard/recrutamento',
    });
    expect(
      await resolveRecruitmentNotice(
        db,
        { ...e, payload: { jobId: 'job', stage: 'STAFF_FLAG_D15' } },
        NOW,
      ),
    ).toBeNull();
  });
  it('recreates the team invitation token for email only, without persisting it in notifications', async () => {
    process.env.TEAM_INVITE_SECRET = 'test-only-secret';
    const { db, written } = fixture({
      'organizationInvitations/invitation': {
        email: 'invitee@example.com',
        v2Status: 'PENDING',
        expiresAt: timestamp(NOW + 86400000),
      },
    });
    const e = event('entity_status_changed', {
      entityId: 'invitation',
      entityKind: 'TeamInvitation',
      version: 1,
    });
    const notice = await resolveRecruitmentNotice(db, e, NOW);
    expect(notice).toMatchObject({
      email: 'invitee@example.com',
      userId: null,
    });
    expect(notice?.path).toMatch(/^\/equipa\/convite\?i=invitation&t=[\w-]+$/);
    await new FirestoreNotificationDispatcher(db, () => NOW).deliver(
      e,
      'event-1:dispatch_in_app_notification',
    );
    expect(written).toHaveLength(0);
  });
  it.each(['REVOKED', 'ACCEPTED'])(
    'suppresses %s invitations',
    async (v2Status) => {
      const { db } = fixture({
        'organizationInvitations/invitation': {
          v2Status,
          expiresAt: timestamp(NOW + 86400000),
        },
      });
      expect(
        await resolveRecruitmentNotice(
          db,
          event('entity_status_changed', {
            entityId: 'invitation',
            entityKind: 'TeamInvitation',
            version: 1,
          }),
          NOW,
        ),
      ).toBeNull();
    },
  );
  it('fails closed on missing invitation secret and rejects invalid event keys before reads or email', async () => {
    delete process.env.TEAM_INVITE_SECRET;
    const { db } = fixture({
      'organizationInvitations/invitation': {
        v2Status: 'PENDING',
        expiresAt: timestamp(NOW + 86400000),
      },
    });
    const e = event('entity_status_changed', {
      entityId: 'invitation',
      entityKind: 'TeamInvitation',
      version: 1,
    });
    await expect(resolveRecruitmentNotice(db, e, NOW)).rejects.toThrow(
      'TEAM_INVITE_CONFIGURATION_MISSING',
    );
    await expect(
      new EmailNotificationDispatcher(db).deliver(e, 'wrong'),
    ).rejects.toThrow('INVALID_EVENT');
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
