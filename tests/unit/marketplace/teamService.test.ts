import {
  canAssignRole,
  canManageMember,
  readOnlyMembers,
} from '@/domain/memberships/teamRules';
import { membershipId } from '@/infrastructure/firebase/marketplace/identifiers';
import { FirestoreTeamService } from '@/infrastructure/firebase/team/FirestoreTeamService';

import { createFakeFirestore } from '../../helpers/fakeFirestore';

jest.mock('firebase-admin/firestore', () => ({
  Timestamp: {
    fromMillis: (ms: number) => ({
      ms,
      toMillis: () => ms,
      toDate: () => new Date(ms),
    }),
  },
}));

let NOW = 1_960_000_000_000;
const org = 'company-1';
const member = (userId: string, role: string) => ({
  [`organizationMemberships/${membershipId(userId, org)}`]: {
    userId,
    organizationId: org,
    role,
    status: 'ACTIVE',
    joinedAtMs: 1,
  },
});

function setup(
  extra: Record<string, Record<string, unknown>> = {},
  secret: string | undefined = 'segredo-de-teste',
) {
  const fake = createFakeFirestore({
    [`users/${org}`]: { userType: 'empresa' },
    'users/u-admin': { userType: 'empresa' },
    ...extra,
  });
  return {
    ...fake,
    service: new FirestoreTeamService(fake.db, secret, () => NOW),
  };
}
const tokenOf = (path: string) =>
  new URLSearchParams(path.split('?')[1]).get('t') ?? '';

describe('E12 — equipa', () => {
  beforeEach(() => {
    NOW = 1_960_000_000_000;
  });

  test('regras puras de papéis', () => {
    expect(canAssignRole('ADMIN', 'OWNER')).toBe(false);
    expect(canAssignRole('ADMIN', 'ADMIN')).toBe(true);
    expect(canAssignRole('RECRUITER', 'REVIEWER')).toBe(false);
    expect(
      canManageMember(
        { userId: 'a', role: 'ADMIN' },
        { userId: 'o', role: 'OWNER' },
      ),
    ).toBe(false);
    expect(
      canManageMember(
        { userId: 'a', role: 'ADMIN' },
        { userId: 'a', role: 'ADMIN' },
      ),
    ).toBe(false);
    expect(
      readOnlyMembers(
        [
          { userId: 'o', role: 'OWNER', joinedAtMs: 9 },
          { userId: 'r1', role: 'RECRUITER', joinedAtMs: 1 },
          { userId: 'r2', role: 'RECRUITER', joinedAtMs: 2 },
        ],
        2,
      ),
    ).toEqual(['r2']);
  });

  test('a conta legada é OWNER e convida; só aceita o email verificado convidado', async () => {
    const { service, docs } = setup({ 'users/ana': { userType: 'empresa' } });
    const invited = await service.invite(org, org, {
      email: ' Ana@Empresa.st ',
      role: 'RECRUITER',
    });
    expect(invited).toMatchObject({
      ok: true,
      value: { acceptPath: expect.stringMatching(/^\/equipa\/convite\?i=/) },
    });
    const { invitationId, acceptPath } = invited.ok
      ? invited.value
      : { invitationId: '', acceptPath: '' };
    expect(
      JSON.stringify(docs.get(`organizationInvitations/${invitationId}`)),
    ).not.toContain(tokenOf(acceptPath));
    expect(
      await service.accept(
        { uid: 'ana', email: 'ana@empresa.st', emailVerified: true },
        invitationId,
        'errado',
      ),
    ).toMatchObject({ ok: false });
    expect(
      await service.accept(
        { uid: 'ana', email: 'ana@empresa.st', emailVerified: false },
        invitationId,
        tokenOf(acceptPath),
      ),
    ).toMatchObject({
      ok: false,
      error: { code: 'FORBIDDEN' },
    });
    expect(
      await service.accept(
        { uid: 'ana', email: 'outra@empresa.st', emailVerified: true },
        invitationId,
        tokenOf(acceptPath),
      ),
    ).toMatchObject({ ok: false });
    expect(
      await service.accept(
        { uid: 'ana', email: 'ANA@empresa.st', emailVerified: true },
        invitationId,
        tokenOf(acceptPath),
      ),
    ).toEqual({
      ok: true,
      value: { organizationId: org, role: 'RECRUITER' },
    });
    expect(await service.roleOf('ana', org)).toBe('RECRUITER');
    // D6: o seletor mostra a sua própria organização legada e a nova.
    expect(await service.myOrganizations('ana')).toEqual([
      { organizationId: 'ana', role: 'OWNER' },
      { organizationId: org, role: 'RECRUITER' },
    ]);
    expect(
      [...docs.values()]
        .filter((d) => String(d.action).startsWith('team_'))
        .map((d) => d.action),
    ).toEqual(['team_invitation_sent', 'team_invitation_accepted']);
  });

  test('convite expira em 7 dias', async () => {
    const { service } = setup();
    const invited = await service.invite(org, org, {
      email: 'x@y.st',
      role: 'REVIEWER',
    });
    NOW += 7 * 86_400_000;
    const { invitationId, acceptPath } = invited.ok
      ? invited.value
      : { invitationId: '', acceptPath: '' };
    expect(
      await service.accept(
        { uid: 'x', email: 'x@y.st', emailVerified: true },
        invitationId,
        tokenOf(acceptPath),
      ),
    ).toMatchObject({
      ok: false,
      error: { message: 'Este convite expirou.' },
    });
  });

  test('lugares do plano gratuito (2) contam o OWNER e convites pendentes', async () => {
    const { service } = setup();
    expect(
      await service.invite(org, org, { email: 'a@y.st', role: 'RECRUITER' }),
    ).toMatchObject({ ok: true });
    expect(
      await service.invite(org, org, { email: 'b@y.st', role: 'RECRUITER' }),
    ).toMatchObject({
      ok: false,
      error: { message: 'O seu plano permite 2 membros na equipa.' },
    });
    expect(
      await service.invite(org, org, { email: 'a@y.st', role: 'RECRUITER' }),
    ).toMatchObject({ ok: false });
  });

  test('recrutador não convida; ADMIN não cria OWNER nem mexe no OWNER', async () => {
    const { service } = setup({
      ...member('rec', 'RECRUITER'),
      ...member('u-admin', 'ADMIN'),
      'users/rec': { userType: 'empresa' },
    });
    expect(
      await service.invite('rec', org, { email: 'z@y.st', role: 'REVIEWER' }),
    ).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(
      await service.invite('u-admin', org, { email: 'z@y.st', role: 'OWNER' }),
    ).toMatchObject({ ok: false });
    expect(
      await service.changeMember('u-admin', org, org, { remove: true }),
    ).toMatchObject({ ok: false });
    expect(
      await service.changeMember('u-admin', org, 'rec', { role: 'REVIEWER' }),
    ).toMatchObject({ ok: true });
    expect(
      await service.changeMember(org, org, 'rec', { remove: true }),
    ).toMatchObject({ ok: true });
    expect(await service.roleOf('rec', org)).toBeNull();
  });

  test('transferência de propriedade só para ADMIN ativo e só quando aceita', async () => {
    const { service } = setup({
      ...member('u-admin', 'ADMIN'),
      ...member('rec', 'RECRUITER'),
    });
    expect(
      await service.requestOwnershipTransfer(org, org, 'rec'),
    ).toMatchObject({ ok: false });
    expect(
      await service.requestOwnershipTransfer('u-admin', org, org),
    ).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(
      await service.requestOwnershipTransfer(org, org, 'u-admin'),
    ).toMatchObject({ ok: true });
    expect(await service.roleOf(org, org)).toBe('OWNER');
    expect(await service.acceptOwnershipTransfer('rec', org)).toMatchObject({
      ok: false,
    });
    expect(await service.acceptOwnershipTransfer('u-admin', org)).toEqual({
      ok: true,
      value: { role: 'OWNER' },
    });
    expect(await service.roleOf('u-admin', org)).toBe('OWNER');
    expect(await service.roleOf(org, org)).toBe('ADMIN');
  });

  test('sem segredo configurado, convites ficam desligados (fail closed)', async () => {
    expect(
      await setup({}, '').service.invite(org, org, {
        email: 'a@y.st',
        role: 'RECRUITER',
      }),
    ).toMatchObject({
      ok: false,
      error: { code: 'FEATURE_DISABLED' },
    });
  });

  test('convite de recrutador atribui apenas vagas da organização e conserva o acesso no aceite', async () => {
    const { service, docs } = setup({
      'jobs/job-1': { organizationId: org },
      'jobs/foreign': { organizationId: 'other' },
      'users/ana': { userType: 'candidato' },
    });
    expect(
      await service.invite(org, org, {
        email: 'ana@y.st',
        role: 'RECRUITER',
        assignedJobIds: ['foreign'],
      }),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
    const invited = await service.invite(org, org, {
      email: 'ana@y.st',
      role: 'RECRUITER',
      assignedJobIds: ['job-1'],
    });
    if (!invited.ok) throw Error('invite failed');
    expect(
      await service.accept(
        { uid: 'ana', email: 'ana@y.st', emailVerified: true },
        invited.value.invitationId,
        tokenOf(invited.value.acceptPath),
      ),
    ).toMatchObject({ ok: true });
    expect(
      docs.get(`organizationMemberships/${membershipId('ana', org)}`),
    ).toMatchObject({ assignedJobIds: ['job-1'], role: 'RECRUITER' });
  });

  test('recuperar uma ligação é uma leitura restrita ao gestor da organização', async () => {
    const { service, docs } = setup();
    const invited = await service.invite(org, org, {
      email: 'a@y.st',
      role: 'ADMIN',
    });
    if (!invited.ok) throw Error('invite failed');
    const before = JSON.stringify([...docs]);
    expect(
      await service.invitationLink('outsider', invited.value.invitationId),
    ).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(
      await service.invitationLink(org, invited.value.invitationId),
    ).toMatchObject({
      ok: true,
      value: { acceptPath: invited.value.acceptPath },
    });
    expect(JSON.stringify([...docs])).toBe(before);
  });

  test('pré-visualização orienta conta errada, não revela email e não aceita automaticamente', async () => {
    const { service, docs } = setup({
      [`users/${org}`]: {
        userType: 'empresa',
        companyName: 'Empresa de teste',
      },
    });
    const invited = await service.invite(org, org, {
      email: 'private@y.st',
      role: 'ADMIN',
    });
    if (!invited.ok) throw Error('invite failed');
    const before = JSON.stringify([...docs]);
    const result = await service.previewInvitation(
      { uid: 'other', email: 'other@y.st', emailVerified: true },
      invited.value.invitationId,
      tokenOf(invited.value.acceptPath),
    );
    expect(result).toMatchObject({
      ok: true,
      value: {
        organizationName: 'Empresa de teste',
        status: 'PENDING',
        emailMatches: false,
      },
    });
    expect(JSON.stringify(result)).not.toContain('private@y.st');
    expect(JSON.stringify([...docs])).toBe(before);
    expect(
      await service.previewInvitation(
        { uid: 'other', email: null, emailVerified: false },
        invited.value.invitationId,
        'bad-token',
      ),
    ).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });

  test('convites expirados não bloqueiam lugares nem um novo convite para o mesmo email', async () => {
    const { service } = setup({
      'organizationInvitations/old': {
        organizationId: org,
        v2Status: 'PENDING',
        email: 'a@y.st',
        expiresAt: { toMillis: () => NOW - 1 },
      },
    });
    expect(
      await service.invite(org, org, { email: 'a@y.st', role: 'ADMIN' }),
    ).toMatchObject({ ok: true });
  });

  test('repetir o mesmo pedido devolve a mesma ligação, sem duplicar convite, auditoria ou email', async () => {
    const { service, docs } = setup();
    const body = {
      email: 'a@y.st',
      role: 'ADMIN',
      idempotencyKey: 'test-request-key-1234',
    };
    const first = await service.invite(org, org, body);
    const before = JSON.stringify([...docs]);
    expect(await service.invite(org, org, body)).toEqual(first);
    expect(JSON.stringify([...docs])).toBe(before);
    expect(
      await service.invite(org, org, { ...body, email: 'b@y.st' }),
    ).toMatchObject({ ok: false, error: { code: 'IDEMPOTENCY_CONFLICT' } });
  });

  test('ligação recuperável termina quando um convite expira ou é revogado', async () => {
    const { service } = setup();
    const invited = await service.invite(org, org, {
      email: 'a@y.st',
      role: 'ADMIN',
    });
    if (!invited.ok) throw Error('invite failed');
    await service.revoke(org, invited.value.invitationId);
    expect(
      await service.invitationLink(org, invited.value.invitationId),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_TRANSITION' } });
  });

  test('gestão do membro não permite atribuir vagas de outra organização', async () => {
    const { service, docs } = setup({
      ...member('admin', 'ADMIN'),
      'jobs/j': { organizationId: org },
      'jobs/foreign': { organizationId: 'other' },
    });
    expect(
      await service.changeMember(org, org, 'admin', {
        role: 'RECRUITER',
        assignedJobIds: ['foreign'],
      }),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
    expect(
      await service.changeMember(org, org, 'admin', {
        role: 'RECRUITER',
        assignedJobIds: ['j'],
      }),
    ).toMatchObject({ ok: true });
    expect(
      docs.get(`organizationMemberships/${membershipId('admin', org)}`),
    ).toMatchObject({ role: 'RECRUITER', assignedJobIds: ['j'] });
  });
});
