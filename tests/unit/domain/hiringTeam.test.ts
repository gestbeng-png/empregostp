import {
  buildHiringTeam,
  canManageHiringTeam,
  readHiringTeam,
} from '@/domain/hiring/team';

const members = new Set(['ana', 'bruno', 'carla', 'dario']);

describe('R7/R14/R15 — equipa de um recrutamento', () => {
  test('monta responsável, Hiring Manager e participantes com uma função cada', () => {
    const result = buildHiringTeam(
      {
        leadRecruiterId: 'ana',
        hiringManagerId: 'bruno',
        interviewerIds: ['carla'],
        observerIds: ['dario'],
      },
      members,
    );
    expect(result).toEqual({
      ok: true,
      value: {
        leadRecruiterId: 'ana',
        hiringManagerId: 'bruno',
        members: [
          { userId: 'ana', role: 'LEAD_RECRUITER' },
          { userId: 'bruno', role: 'HIRING_MANAGER' },
          { userId: 'carla', role: 'INTERVIEWER' },
          { userId: 'dario', role: 'OBSERVER' },
        ],
        memberIds: ['ana', 'bruno', 'carla', 'dario'],
      },
    });
  });

  test('sem responsável é válido (empresa pequena) e vazio limpa a equipa', () => {
    const result = buildHiringTeam({ leadRecruiterId: '' }, members);
    expect(result.ok && result.value).toMatchObject({
      leadRecruiterId: null,
      hiringManagerId: null,
      memberIds: [],
    });
  });

  test('recusa a mesma pessoa em duas funções, não-membros e formatos inválidos', () => {
    expect(
      buildHiringTeam(
        { leadRecruiterId: 'ana', interviewerIds: ['ana'] },
        members,
      ),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
    expect(
      buildHiringTeam({ hiringManagerId: 'estranho' }, members),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
    expect(buildHiringTeam({ recruiterIds: 'ana' }, members)).toMatchObject({
      ok: false,
    });
    expect(buildHiringTeam({ leadRecruiterId: 42 }, members)).toMatchObject({
      ok: false,
    });
  });

  test('limita o tamanho da equipa', () => {
    const many = Array.from({ length: 21 }, (_, i) => `m${i}`);
    expect(buildHiringTeam({ observerIds: many }, new Set(many))).toMatchObject(
      { ok: false, error: { code: 'INVALID_INPUT' } },
    );
  });

  test('OWNER/ADMIN gerem qualquer equipa; o responsável gere só a sua', () => {
    expect(canManageHiringTeam({ userId: 'x', role: 'OWNER' }, null)).toBe(
      true,
    );
    expect(canManageHiringTeam({ userId: 'x', role: 'ADMIN' }, 'ana')).toBe(
      true,
    );
    expect(
      canManageHiringTeam({ userId: 'ana', role: 'RECRUITER' }, 'ana'),
    ).toBe(true);
    expect(
      canManageHiringTeam({ userId: 'bruno', role: 'RECRUITER' }, 'ana'),
    ).toBe(false);
    expect(
      canManageHiringTeam({ userId: 'ana', role: 'RECRUITER' }, null),
    ).toBe(false);
    expect(
      canManageHiringTeam({ userId: 'ana', role: 'REVIEWER' }, 'ana'),
    ).toBe(false);
  });

  test('ao ler, quem saiu da organização deixa de contar (R58)', () => {
    const team = readHiringTeam(
      {
        members: [
          { userId: 'ana', role: 'LEAD_RECRUITER' },
          { userId: 'saiu', role: 'HIRING_MANAGER' },
          { userId: 'carla', role: 'INVENTADO' },
        ],
      },
      members,
    );
    expect(team).toEqual({
      leadRecruiterId: 'ana',
      hiringManagerId: null,
      members: [{ userId: 'ana', role: 'LEAD_RECRUITER' }],
      memberIds: ['ana'],
    });
    expect(readHiringTeam(undefined).memberIds).toEqual([]);
  });
});
