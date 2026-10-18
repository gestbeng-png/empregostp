import type {
  EntityKind,
  StateMachine,
  TransitionActor,
} from '@/domain/lifecycle/states';
import {
  actorMatches,
  assertTransition,
  assertVersion,
  LIFECYCLES,
} from '@/domain/lifecycle/states';

const KINDS = Object.keys(LIFECYCLES) as EntityKind[];
const ALL_GUARDS = new Proxy({} as Record<string, boolean>, {
  get: () => true,
});
const OPEN = { guards: ALL_GUARDS, reason: 'Motivo registado' };

function machine(kind: EntityKind): StateMachine {
  return LIFECYCLES[kind];
}

function edges() {
  return KINDS.flatMap((kind) =>
    Object.entries(machine(kind)).flatMap(([from, transitions]) =>
      transitions.map((transition) => ({ kind, from, transition })),
    ),
  );
}

function errorCode(result: ReturnType<typeof assertTransition>) {
  return result.ok ? 'OK' : result.error.code;
}

describe('estrutura das máquinas de estado', () => {
  test.each(KINDS)('%s: todos os destinos são estados conhecidos', (kind) => {
    const states = new Set(Object.keys(machine(kind)));
    const dangling = Object.values(machine(kind))
      .flat()
      .map((transition) => transition.to)
      .filter((to) => !states.has(to));

    expect(dangling).toEqual([]);
  });

  test.each(
    edges().map((edge) => [edge.kind, edge.from, edge.transition.to, edge]),
  )(
    '%s %s → %s aceita os atores previstos e recusa os outros',
    (_kind, _from, _to, { kind, from, transition }) => {
      for (const actor of transition.actors) {
        expect(
          errorCode(assertTransition(kind, from, transition.to, actor, OPEN)),
        ).toBe('OK');
      }
      expect(
        errorCode(assertTransition(kind, from, transition.to, 'NONE', OPEN)),
      ).toBe('TRANSITION_FORBIDDEN');
      if (transition.guard) {
        expect(
          errorCode(
            assertTransition(
              kind,
              from,
              transition.to,
              transition.actors[0] ?? 'NONE',
              {
                reason: 'Motivo registado',
              },
            ),
          ),
        ).toBe('TRANSITION_GUARD_FAILED');
      }
    },
  );

  test.each(KINDS)('%s: estados desconhecidos são inválidos', (kind) => {
    const first = Object.keys(machine(kind))[0] ?? '';
    expect(
      errorCode(assertTransition(kind, 'NAO_EXISTE', first, 'ADMIN', OPEN)),
    ).toBe('INVALID_TRANSITION');
    expect(
      errorCode(assertTransition(kind, first, 'NAO_EXISTE', 'ADMIN', OPEN)),
    ).toBe('INVALID_TRANSITION');
  });

  it('nomes de propriedades do protótipo não são estados', () => {
    expect(
      errorCode(assertTransition('Job', 'constructor', 'DRAFT', 'ADMIN', OPEN)),
    ).toBe('INVALID_TRANSITION');
  });
});

describe('vaga (E3)', () => {
  it('publicação direta só com as condições de auto-publicação', () => {
    expect(
      errorCode(assertTransition('Job', 'DRAFT', 'PUBLISHED', 'OWNER')),
    ).toBe('TRANSITION_GUARD_FAILED');
    expect(
      errorCode(
        assertTransition('Job', 'DRAFT', 'PUBLISHED', 'RECRUITER', {
          guards: { canAutoPublish: true },
        }),
      ),
    ).toBe('OK');
  });

  it('rejeitar exige motivo e só o moderador o pode fazer', () => {
    expect(
      errorCode(
        assertTransition('Job', 'PENDING_REVIEW', 'REJECTED', 'MODERATOR'),
      ),
    ).toBe('TRANSITION_GUARD_FAILED');
    expect(
      errorCode(
        assertTransition('Job', 'PENDING_REVIEW', 'REJECTED', 'MODERATOR', {
          reason: 'Pede dinheiro aos candidatos',
        }),
      ),
    ).toBe('OK');
    expect(
      errorCode(
        assertTransition('Job', 'PENDING_REVIEW', 'REJECTED', 'OWNER', {
          reason: 'x',
        }),
      ),
    ).toBe('TRANSITION_FORBIDDEN');
  });

  it('só o sistema expira uma vaga', () => {
    expect(
      errorCode(
        assertTransition('Job', 'PUBLISHED', 'EXPIRED', 'OWNER', {
          guards: { hasExpired: true },
        }),
      ),
    ).toBe('TRANSITION_FORBIDDEN');
  });

  it('arquivada é terminal', () => {
    expect(LIFECYCLES.Job.ARCHIVED).toEqual([]);
  });
});

describe('candidatura (E4/E5)', () => {
  it('o candidato retira a candidatura em qualquer estado não terminal', () => {
    for (const from of [
      'SUBMITTED',
      'UNDER_REVIEW',
      'SHORTLISTED',
      'INTERVIEW',
      'OFFER',
    ]) {
      expect(
        errorCode(
          assertTransition('Application', from, 'WITHDRAWN', 'CANDIDATE'),
        ),
      ).toBe('OK');
    }
  });

  it('a empresa não pode retirar a candidatura em nome do candidato', () => {
    expect(
      errorCode(
        assertTransition('Application', 'SUBMITTED', 'WITHDRAWN', 'RECRUITER'),
      ),
    ).toBe('TRANSITION_FORBIDDEN');
  });

  it('rejeitar exige o motivo de fecho', () => {
    expect(
      errorCode(
        assertTransition(
          'Application',
          'UNDER_REVIEW',
          'REJECTED',
          'RECRUITER',
        ),
      ),
    ).toBe('TRANSITION_GUARD_FAILED');
    expect(
      errorCode(
        assertTransition(
          'Application',
          'UNDER_REVIEW',
          'REJECTED',
          'RECRUITER',
          {
            guards: { hasClosedReason: true },
          },
        ),
      ),
    ).toBe('OK');
  });

  it('a oferta aceite só passa a contratada pelo sistema', () => {
    expect(
      errorCode(
        assertTransition('Application', 'OFFER', 'HIRED', 'OWNER', {
          guards: { acceptedOfferAndHireConfirmed: true },
        }),
      ),
    ).toBe('TRANSITION_FORBIDDEN');
  });

  it('contratação marcada diretamente a partir de entrevista é permitida (E5.5)', () => {
    expect(
      errorCode(
        assertTransition('Application', 'INTERVIEW', 'HIRED', 'RECRUITER', {
          guards: { hireConfirmed: true },
        }),
      ),
    ).toBe('OK');
  });

  it('só OWNER/ADMIN da organização revertem uma rejeição, com motivo', () => {
    const context = {
      guards: { withinRejectionCorrectionWindow: true },
      reason: 'Lote rejeitado por engano',
    };
    expect(
      errorCode(
        assertTransition(
          'Application',
          'REJECTED',
          'UNDER_REVIEW',
          'RECRUITER',
          context,
        ),
      ),
    ).toBe('TRANSITION_FORBIDDEN');
    expect(
      errorCode(
        assertTransition(
          'Application',
          'REJECTED',
          'UNDER_REVIEW',
          'OWNER',
          context,
        ),
      ),
    ).toBe('OK');
  });

  it('retirada é terminal', () => {
    expect(LIFECYCLES.Application.WITHDRAWN).toEqual([]);
  });
});

describe('papéis e versões', () => {
  test.each<[TransitionActor, TransitionActor, boolean]>([
    ['OWNER', 'EMPLOYER', true],
    ['ORG_ADMIN', 'EMPLOYER', true],
    ['RECRUITER', 'EMPLOYER', true],
    ['RECRUITER', 'EMPLOYER_ADMIN', false],
    ['OWNER', 'EMPLOYER_ADMIN', true],
    ['CANDIDATE', 'EMPLOYER', false],
    ['ADMIN', 'ADMIN', true],
  ])('%s satisfaz %s: %s', (actual, allowed, expected) => {
    expect(actorMatches(actual, allowed)).toBe(expected);
  });

  it('bloqueio otimista recusa versões diferentes ou inválidas', () => {
    expect(assertVersion(3, 3).ok).toBe(true);
    expect(errorCode(assertVersion(2, 3))).toBe('VERSION_CONFLICT');
    expect(errorCode(assertVersion(-1, -1))).toBe('VERSION_CONFLICT');
    expect(errorCode(assertVersion(1.5, 1.5))).toBe('VERSION_CONFLICT');
  });
});
