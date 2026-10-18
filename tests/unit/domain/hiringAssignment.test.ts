import {
  buildWorkload,
  parseAssignmentRequest,
} from '@/domain/hiring/assignment';

describe('R24/R25 — atribuição de candidaturas', () => {
  test('aceita 1 a 100 candidaturas da mesma organização; vazio devolve à fila', () => {
    expect(
      parseAssignmentRequest({
        organizationId: 'org',
        applicationIds: ['a', 'b'],
        assigneeUserId: 'ana',
      }),
    ).toEqual({
      ok: true,
      value: {
        organizationId: 'org',
        applicationIds: ['a', 'b'],
        assigneeUserId: 'ana',
      },
    });
    expect(
      parseAssignmentRequest({
        organizationId: 'org',
        applicationIds: ['a'],
        assigneeUserId: '',
      }),
    ).toMatchObject({ ok: true, value: { assigneeUserId: null } });
  });

  test.each([
    [{ applicationIds: ['a'] }],
    [{ organizationId: 'org', applicationIds: [] }],
    [{ organizationId: 'org', applicationIds: ['a', 'a'] }],
    [{ organizationId: 'org', applicationIds: ['x/y'] }],
    [{ organizationId: 'org', applicationIds: 'a' }],
    [{ organizationId: 'org', applicationIds: ['a'], assigneeUserId: 7 }],
    [
      {
        organizationId: 'org',
        applicationIds: Array.from({ length: 101 }, (_, i) => `a${i}`),
      },
    ],
  ])('recusa pedido inválido %#', (input) => {
    expect(parseAssignmentRequest(input)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    });
  });

  test('carga por pessoa: só em curso, por ordem alfabética, e fila sem responsável', () => {
    const result = buildWorkload(
      [
        { status: 'SUBMITTED', assigneeUserId: 'joao' },
        { status: 'INTERVIEW', assigneeUserId: 'joao' },
        { status: 'UNDER_REVIEW', assigneeUserId: 'maria' },
        { status: 'HIRED', assigneeUserId: 'maria' },
        { status: 'SUBMITTED', assigneeUserId: null },
        { status: 'SUBMITTED', assigneeUserId: 'saiu' },
        { status: 'REJECTED', assigneeUserId: null },
      ],
      [
        { userId: 'maria', name: 'Maria' },
        { userId: 'joao', name: 'João' },
        { userId: 'carlos', name: 'Carlos' },
      ],
    );
    expect(result).toEqual({
      rows: [
        { userId: 'joao', name: 'João', toReview: 1, open: 2 },
        { userId: 'maria', name: 'Maria', toReview: 1, open: 1 },
      ],
      unassignedToReview: 2,
    });
  });
});
