import { readRecruitmentWorkspace } from '@/infrastructure/firebase/applications/readRecruitmentWorkspace';
import { FirestoreMemberOffboardingService } from '@/infrastructure/firebase/hiring/FirestoreMemberOffboardingService';
import { membershipId } from '@/infrastructure/firebase/marketplace/identifiers';

import { createFakeFirestore } from '../../helpers/fakeFirestore';

jest.mock('firebase-admin/firestore', () => ({
  Timestamp: { fromMillis: (ms: number) => ({ ms, toMillis: () => ms }) },
}));

const org = 'company-1';
const now = Date.parse('2026-10-20T12:00:00Z');
const roles: Record<string, 'OWNER' | 'ADMIN' | 'RECRUITER' | 'REVIEWER'> = {
  [org]: 'OWNER',
  joao: 'RECRUITER',
  ana: 'RECRUITER',
  carla: 'REVIEWER',
  admin: 'ADMIN',
};
const membership = (userId: string, extra = {}) => ({
  userId,
  organizationId: org,
  status: 'ACTIVE',
  role: roles[userId],
  ...extra,
});

function setup() {
  const fake = createFakeFirestore({
    [`users/${org}`]: { userType: 'empresa' },
    'users/joao': { userType: 'candidato', name: 'João' },
    'users/ana': { userType: 'candidato', name: 'Ana' },
    'users/carla': { userType: 'candidato', name: 'Carla' },
    'users/admin': { userType: 'candidato', name: 'Admin' },
    [`organizationMemberships/${membershipId('joao', org)}`]: membership(
      'joao',
      { assignedJobIds: ['j1', 'j2'] },
    ),
    [`organizationMemberships/${membershipId('ana', org)}`]: membership('ana', {
      assignedJobIds: [],
    }),
    [`organizationMemberships/${membershipId('carla', org)}`]:
      membership('carla'),
    [`organizationMemberships/${membershipId('admin', org)}`]:
      membership('admin'),
    'jobs/j1': {
      organizationId: org,
      titulo: 'Contabilista',
      v2Status: 'PUBLISHED',
    },
    'jobs/j2': {
      organizationId: org,
      titulo: 'Motorista',
      v2Status: 'PUBLISHED',
    },
    'hiringProcesses/j1': {
      organizationId: org,
      jobId: 'j1',
      members: [
        { userId: 'joao', role: 'LEAD_RECRUITER' },
        { userId: 'carla', role: 'HIRING_MANAGER' },
      ],
      memberIds: ['joao', 'carla'],
      leadRecruiterId: 'joao',
      hiringManagerId: 'carla',
      version: 3,
    },
    'applications/a1': {
      organizationId: org,
      jobId: 'j2',
      v2Status: 'SUBMITTED',
      version: 1,
    },
    'applicationAssignments/a1': {
      applicationId: 'a1',
      organizationId: org,
      jobId: 'j2',
      userId: 'joao',
      version: 1,
    },
    'interviews/i1': {
      organizationId: org,
      jobId: 'j2',
      applicationId: 'a1',
      v2Status: 'SCHEDULED',
      startsAt: new Date(now + 86_400_000).toISOString(),
      interviewerUserIds: ['joao'],
      version: 2,
    },
  });
  const service = new FirestoreMemberOffboardingService(
    fake.db,
    { roleOf: async (userId: string) => roles[userId] ?? null },
    () => now,
  );
  return { ...fake, service };
}

describe('R57/R58 — remover membro transferindo responsabilidades', () => {
  test('sem destino, com responsabilidades, recusa e não remove', async () => {
    const { service, docs } = setup();
    expect(await service.remove(org, org, 'joao')).toMatchObject({
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        message: expect.stringMatching(/Escolha quem fica/),
      },
    });
    expect(
      docs.get(`organizationMemberships/${membershipId('joao', org)}`),
    ).toMatchObject({ status: 'ACTIVE' });
  });

  test('transfere liderança, candidaturas e entrevistas; dá acesso; remove; audita', async () => {
    const { service, docs, db } = setup();
    expect(await service.remove(org, org, 'joao', 'ana')).toEqual({
      ok: true,
      value: {
        removed: true,
        transferredTo: 'ana',
        leadJobs: 1,
        applications: 1,
        interviews: 1,
      },
    });
    expect(docs.get('hiringProcesses/j1')).toMatchObject({
      leadRecruiterId: 'ana',
      hiringManagerId: 'carla',
      memberIds: ['ana', 'carla'],
      version: 4,
    });
    // j2 não tinha equipa: Ana entra como recrutadora para ver o que herdou.
    expect(docs.get('hiringProcesses/j2')).toMatchObject({
      members: [expect.objectContaining({ userId: 'ana', role: 'RECRUITER' })],
    });
    expect(docs.get('applicationAssignments/a1')).toMatchObject({
      userId: 'ana',
      previousUserId: 'joao',
      version: 2,
    });
    expect(docs.get('interviews/i1')).toMatchObject({
      interviewerUserIds: ['ana'],
      version: 3,
    });
    expect(
      docs.get(`organizationMemberships/${membershipId('joao', org)}`),
    ).toMatchObject({ status: 'REMOVED' });
    const audit = [...docs.entries()].find(([p]) =>
      p.startsWith('auditLogs/'),
    )?.[1];
    expect(audit).toMatchObject({
      action: 'team_member_removed',
      metadata: { transferredTo: 'ana', leadJobs: 1 },
    });

    // R105/R112: o membro removido deixa de entrar logo; Ana vê o que herdou.
    expect(
      await readRecruitmentWorkspace(db, 'joao', org, [
        { organizationId: org, role: 'RECRUITER' },
      ]),
    ).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    const ana = await readRecruitmentWorkspace(db, 'ana', org, [
      { organizationId: org, role: 'RECRUITER' },
    ]);
    if (!ana.ok) throw new Error('unexpected');
    expect(ana.value.applications.map((row) => row.id)).toEqual(['a1']);
  });

  test('destino tem de poder conduzir processos; regras de gestão de membros mantêm-se', async () => {
    const { service } = setup();
    expect(await service.remove(org, org, 'joao', 'carla')).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    });
    expect(await service.remove('ana', org, 'joao', 'admin')).toMatchObject({
      ok: false,
      error: { code: 'FORBIDDEN' },
    });
    expect(await service.remove('admin', org, org, 'ana')).toMatchObject({
      ok: false,
      error: { code: 'FORBIDDEN' },
    });
  });

  test('sem responsabilidades, remove sem destino', async () => {
    const { service, docs } = setup();
    expect(await service.remove(org, org, 'carla')).toMatchObject({
      ok: true,
      value: { transferredTo: null },
    });
    // Carla era Hiring Manager em j1: a função termina, o resto da equipa fica.
    expect(docs.get('hiringProcesses/j1')).toMatchObject({
      hiringManagerId: null,
      leadRecruiterId: 'joao',
    });
  });
});
