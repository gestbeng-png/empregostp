import { readRecruitmentWorkspace } from '@/infrastructure/firebase/applications/readRecruitmentWorkspace';
import { FirestoreHiringTeamService } from '@/infrastructure/firebase/hiring/FirestoreHiringTeamService';
import { membershipId } from '@/infrastructure/firebase/marketplace/identifiers';

import { createFakeFirestore } from '../../helpers/fakeFirestore';

jest.mock('firebase-admin/firestore', () => ({
  Timestamp: { fromMillis: (ms: number) => ({ ms }) },
}));

const org = 'company-1';
const context = { environment: 'production' as const };
const roles: Record<string, 'OWNER' | 'ADMIN' | 'RECRUITER' | 'REVIEWER'> = {
  [org]: 'OWNER',
  ana: 'RECRUITER',
  bruno: 'RECRUITER',
  carla: 'REVIEWER',
};
const member = (userId: string) => ({
  userId,
  organizationId: org,
  status: 'ACTIVE',
  role: roles[userId],
});

function setup(enabled = true) {
  const fake = createFakeFirestore({
    [`users/${org}`]: { userType: 'empresa', name: 'Empresa Alfa' },
    'users/ana': { userType: 'candidato', name: 'Ana Silva' },
    'users/bruno': { userType: 'candidato', name: 'Bruno Costa' },
    'users/carla': { userType: 'candidato', name: 'Carla Lima' },
    [`organizationMemberships/${membershipId('ana', org)}`]: member('ana'),
    [`organizationMemberships/${membershipId('bruno', org)}`]: member('bruno'),
    [`organizationMemberships/${membershipId('carla', org)}`]: member('carla'),
    'jobs/j1': {
      organizationId: org,
      companyId: org,
      titulo: 'Contabilista',
      v2Status: 'PUBLISHED',
    },
    'jobs/j2': {
      organizationId: org,
      companyId: org,
      titulo: 'Motorista',
      v2Status: 'PUBLISHED',
    },
    'applications/a2': {
      organizationId: org,
      jobId: 'j2',
      v2Status: 'SUBMITTED',
      version: 1,
      submittedAt: '2026-09-01T10:00:00Z',
      candidateSnapshot: { fullName: 'Dário Pires' },
    },
  });
  const service = new FirestoreHiringTeamService(
    fake.db,
    { enabled: async () => enabled },
    context,
    { roleOf: async (userId: string) => roles[userId] ?? null },
    () => Date.parse('2026-10-20T12:00:00Z'),
  );
  return { ...fake, service };
}

describe('R7/R14/R15 — equipa de um recrutamento', () => {
  test('o OWNER define responsável e Hiring Manager; versão e auditoria sem nomes', async () => {
    const { service, docs } = setup();
    const result = await service.update(org, 'j1', {
      leadRecruiterId: 'ana',
      hiringManagerId: 'carla',
      expectedVersion: 0,
    });
    expect(result).toEqual({
      ok: true,
      value: { version: 1, memberIds: ['ana', 'carla'] },
    });
    expect(docs.get('hiringProcesses/j1')).toMatchObject({
      organizationId: org,
      status: 'OPEN',
      leadRecruiterId: 'ana',
      hiringManagerId: 'carla',
      memberIds: ['ana', 'carla'],
      version: 1,
    });
    const audit = [...docs.entries()].find(([path]) =>
      path.startsWith('auditLogs/'),
    )?.[1];
    expect(audit).toMatchObject({
      action: 'hiring_team_updated',
      resourceId: 'j1',
      metadata: { added: ['ana', 'carla'], leadRecruiterChanged: true },
    });
    expect(JSON.stringify(audit)).not.toMatch(/Ana Silva|Carla Lima/);
  });

  test('versão desatualizada é recusada (R64) e ninguém de fora entra na equipa', async () => {
    const { service } = setup();
    await service.update(org, 'j1', { leadRecruiterId: 'ana' });
    expect(
      await service.update(org, 'j1', {
        leadRecruiterId: 'bruno',
        expectedVersion: 0,
      }),
    ).toMatchObject({ ok: false, error: { code: 'VERSION_CONFLICT' } });
    expect(
      await service.update(org, 'j1', { interviewerIds: ['intruso'] }),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
  });

  test('só o responsável atual (ou OWNER/ADMIN) gere a equipa; pode transferir', async () => {
    const { service } = setup();
    await service.update(org, 'j1', { leadRecruiterId: 'ana' });
    expect(
      await service.update('bruno', 'j1', { leadRecruiterId: 'bruno' }),
    ).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(
      await service.update('carla', 'j1', { leadRecruiterId: 'carla' }),
    ).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(
      await service.update('ana', 'j1', {
        leadRecruiterId: 'bruno',
        recruiterIds: ['ana'],
      }),
    ).toMatchObject({ ok: true, value: { version: 2 } });
  });

  test('flag desligada e pessoas de fora da organização não veem a vaga', async () => {
    expect(await setup(false).service.update(org, 'j1', {})).toMatchObject({
      ok: false,
      error: { code: 'FEATURE_DISABLED' },
    });
    expect(await setup().service.update('estranho', 'j1', {})).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    });
  });

  test('integrar a equipa dá ao recrutador acesso à vaga; sair tira-o logo', async () => {
    const { service, db } = setup();
    const read = () =>
      readRecruitmentWorkspace(
        db,
        { enabled: async () => true },
        context,
        'bruno',
        org,
        [{ organizationId: org, role: 'RECRUITER' }],
      );
    let result = await read();
    if (!result.ok) throw new Error('unexpected');
    expect(result.value.applications).toHaveLength(0);

    await service.update(org, 'j2', { recruiterIds: ['bruno'] });
    result = await read();
    if (!result.ok) throw new Error('unexpected');
    expect(result.value.applications).toMatchObject([
      { id: 'a2', isNew: true },
    ]);
    expect(result.value.jobs.find((job) => job.id === 'j2')).toMatchObject({
      hiringTeam: {
        members: [{ userId: 'bruno', role: 'RECRUITER', name: 'Bruno Costa' }],
        canManage: false,
      },
      closingSummary: { open: 1, inReview: 1 },
    });

    await service.update(org, 'j2', {});
    result = await read();
    if (!result.ok) throw new Error('unexpected');
    expect(result.value.applications).toHaveLength(0);
  });

  test('o bootstrap traz a visão operacional com números reais', async () => {
    const { db } = setup();
    const result = await readRecruitmentWorkspace(
      db,
      { enabled: async () => true },
      context,
      org,
      org,
      [{ organizationId: org, role: 'OWNER' }],
    );
    if (!result.ok) throw new Error('unexpected');
    expect(result.value.overview.metrics).toMatchObject({
      openJobs: 2,
      newApplications: 1,
      toReview: 1,
    });
    expect(result.value.overview.attention.map((item) => item.key)).toEqual(
      expect.arrayContaining(['NEW_APPLICATIONS', 'STALE_APPLICATIONS']),
    );
    expect(result.value.teamCandidates.map((row) => row.userId)).toEqual(
      expect.arrayContaining([org, 'ana', 'bruno', 'carla']),
    );
  });
});
