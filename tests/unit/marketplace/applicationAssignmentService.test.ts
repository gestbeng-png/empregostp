import { readRecruitmentWorkspace } from '@/infrastructure/firebase/applications/readRecruitmentWorkspace';
import { FirestoreApplicationAssignmentService } from '@/infrastructure/firebase/hiring/FirestoreApplicationAssignmentService';
import { FirestoreHiringTeamService } from '@/infrastructure/firebase/hiring/FirestoreHiringTeamService';
import { membershipId } from '@/infrastructure/firebase/marketplace/identifiers';

import { createFakeFirestore } from '../../helpers/fakeFirestore';

jest.mock('firebase-admin/firestore', () => ({
  Timestamp: { fromMillis: (ms: number) => ({ ms }) },
}));

const org = 'company-1';
const context = { environment: 'production' as const };
const member = (userId: string, role: string, extra = {}) => ({
  userId,
  organizationId: org,
  status: 'ACTIVE',
  role,
  ...extra,
});
const app = (jobId: string, v2Status = 'SUBMITTED', organizationId = org) => ({
  organizationId,
  jobId,
  v2Status,
  version: 1,
  jobTitle: 'Contabilista',
  candidateSnapshot: { fullName: 'Candidata' },
});

function setup(enabled = true) {
  const fake = createFakeFirestore({
    [`users/${org}`]: { userType: 'empresa', name: 'Empresa Alfa' },
    'users/ana': { userType: 'candidato', name: 'Ana Silva' },
    'users/bruno': { userType: 'candidato', name: 'Bruno Costa' },
    'users/carla': { userType: 'candidato', name: 'Carla Lima' },
    [`organizationMemberships/${membershipId('ana', org)}`]: member(
      'ana',
      'RECRUITER',
      { assignedJobIds: ['j1'] },
    ),
    [`organizationMemberships/${membershipId('bruno', org)}`]: member(
      'bruno',
      'RECRUITER',
      { assignedJobIds: ['j2'] },
    ),
    [`organizationMemberships/${membershipId('carla', org)}`]: member(
      'carla',
      'REVIEWER',
    ),
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
    'applications/a1': app('j1'),
    'applications/a2': app('j1', 'UNDER_REVIEW'),
    'applications/a3': app('j2'),
    'applications/done': app('j1', 'HIRED'),
    'applications/foreign': app('jx', 'SUBMITTED', 'other-org'),
  });
  const flags = { enabled: async () => enabled };
  const now = () => Date.parse('2026-10-20T12:00:00Z');
  return {
    ...fake,
    service: new FirestoreApplicationAssignmentService(
      fake.db,
      flags,
      context,
      now,
    ),
    teams: new FirestoreHiringTeamService(
      fake.db,
      flags,
      context,
      {
        roleOf: async (userId: string) =>
          ({
            [org]: 'OWNER',
            ana: 'RECRUITER',
            bruno: 'RECRUITER',
            carla: 'REVIEWER',
          })[userId] as never,
      },
      now,
    ),
  };
}
const outbox = (docs: Map<string, Record<string, unknown>>) =>
  [...docs.entries()]
    .filter(([path]) => path.startsWith('outboxEvents/'))
    .map(([, v]) => v);

describe('R24/R25/R88 — responsável pela análise', () => {
  test('o OWNER atribui em lote; notifica só quem recebe; audita ids', async () => {
    const { service, docs } = setup();
    expect(
      await service.assign(org, {
        organizationId: org,
        applicationIds: ['a1', 'a2'],
        assigneeUserId: 'ana',
      }),
    ).toEqual({ ok: true, value: { updated: 2, assigneeUserId: 'ana' } });
    expect(docs.get('applicationAssignments/a1')).toMatchObject({
      userId: 'ana',
      previousUserId: null,
      assignedBy: org,
      version: 1,
    });
    expect(outbox(docs)).toEqual([
      expect.objectContaining({
        type: 'application_assigned',
        payload: { applicationId: 'a1', assigneeUserId: 'ana' },
      }),
      expect.objectContaining({
        type: 'application_assigned',
        payload: { applicationId: 'a2', assigneeUserId: 'ana' },
      }),
    ]);
    const audit = [...docs.entries()].find(([p]) =>
      p.startsWith('auditLogs/'),
    )?.[1];
    expect(audit).toMatchObject({
      action: 'applications_bulk_assigned',
      metadata: { count: 2 },
    });
    expect(JSON.stringify(audit)).not.toMatch(/Ana Silva|Candidata/);
  });

  test('não atribui a quem não tem acesso à vaga; juntar à equipa resolve', async () => {
    const { service, teams } = setup();
    expect(
      await service.assign(org, {
        organizationId: org,
        applicationIds: ['a1'],
        assigneeUserId: 'bruno',
      }),
    ).toMatchObject({
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        message: expect.stringMatching(/equipa da vaga/),
      },
    });
    await teams.update(org, 'j1', { recruiterIds: ['bruno'] });
    expect(
      await service.assign(org, {
        organizationId: org,
        applicationIds: ['a1'],
        assigneeUserId: 'bruno',
      }),
    ).toMatchObject({ ok: true, value: { updated: 1 } });
  });

  test('tudo ou nada: uma candidatura terminada, de outra organização ou fora do alcance anula o lote', async () => {
    const { service, docs } = setup();
    expect(
      await service.assign(org, {
        organizationId: org,
        applicationIds: ['a1', 'done'],
        assigneeUserId: 'ana',
      }),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
    expect(
      await service.assign(org, {
        organizationId: org,
        applicationIds: ['a1', 'foreign'],
        assigneeUserId: 'ana',
      }),
    ).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(
      await service.assign('ana', {
        organizationId: org,
        applicationIds: ['a1', 'a3'],
        assigneeUserId: 'ana',
      }),
    ).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(docs.has('applicationAssignments/a1')).toBe(false);
  });

  test('avaliador não atribui; recrutador fica com uma candidatura da sua vaga sem se notificar', async () => {
    const { service, docs } = setup();
    expect(
      await service.assign('carla', {
        organizationId: org,
        applicationIds: ['a1'],
        assigneeUserId: 'carla',
      }),
    ).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(
      await service.assign('ana', {
        organizationId: org,
        applicationIds: ['a1'],
        assigneeUserId: 'ana',
      }),
    ).toMatchObject({ ok: true, value: { updated: 1 } });
    expect(outbox(docs)).toEqual([]);
    expect(
      await service.assign('ana', {
        organizationId: org,
        applicationIds: ['a1'],
        assigneeUserId: 'ana',
      }),
    ).toMatchObject({ ok: true, value: { updated: 0 } });
  });

  test('flag desligada e pessoas de fora são recusadas', async () => {
    expect(
      await setup(false).service.assign(org, {
        organizationId: org,
        applicationIds: ['a1'],
      }),
    ).toMatchObject({ ok: false, error: { code: 'FEATURE_DISABLED' } });
    expect(
      await setup().service.assign('estranho', {
        organizationId: org,
        applicationIds: ['a1'],
      }),
    ).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
  });

  test('o bootstrap mostra o responsável e a carga da equipa ao OWNER', async () => {
    const { service, db } = setup();
    await service.assign(org, {
      organizationId: org,
      applicationIds: ['a1'],
      assigneeUserId: 'ana',
    });
    const result = await readRecruitmentWorkspace(
      db,
      { enabled: async () => true },
      context,
      org,
      org,
      [{ organizationId: org, role: 'OWNER' }],
    );
    if (!result.ok) throw new Error('unexpected');
    expect(
      result.value.applications.find((row) => row.id === 'a1'),
    ).toMatchObject({
      assigneeUserId: 'ana',
      assigneeName: 'Ana Silva',
    });
    expect(result.value.workload).toEqual({
      rows: [{ userId: 'ana', name: 'Ana Silva', toReview: 1, open: 1 }],
      unassignedToReview: 2,
    });
  });
});
