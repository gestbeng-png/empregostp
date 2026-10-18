import type {
  EntitlementGrant,
  Subject,
} from '@/domain/entitlements/canUseFeature';
import {
  canUseFeature,
  ENTITLEMENT_KEYS,
} from '@/domain/entitlements/canUseFeature';
import { CONSENT_KINDS, LEGAL_DOCUMENTS } from '@/domain/privacy/Consent';
import { RATE_LIMIT_POLICIES } from '@/domain/rate-limits/policies';

const now = 1_000_000;
const options = { now, v2Enabled: true };
const organization: Subject = {
  type: 'ORGANIZATION',
  id: 'org-a',
  organizationType: 'EMPRESA_PRIVADA',
};

function grant(overrides: Partial<EntitlementGrant> = {}): EntitlementGrant {
  return {
    subjectType: 'ORGANIZATION',
    subjectId: 'org-a',
    feature: 'JOB_POST_SLOTS',
    quantity: 5,
    validFrom: 0,
    source: 'PLAN',
    ...overrides,
  };
}

describe('G3 — plano Gratuito de empregadores', () => {
  // null = sem acesso (—). Os números são os limites da coluna «Gratuito».
  const GRATUITO: Partial<
    Record<(typeof ENTITLEMENT_KEYS)[number], number | null>
  > = {
    JOB_POST_SLOTS: 1,
    ATS_BULK_ACTIONS: 20,
    SCREENING_QUESTIONS: 3,
    SEATS: 2,
    TALENT_SEARCH: null,
    INVITES_MONTHLY: null,
    EXPORT: null,
    REPORTS: null,
  };

  test.each(Object.entries(GRATUITO))('%s = %p', (feature, expected) => {
    const decision = canUseFeature(
      organization,
      feature as (typeof ENTITLEMENT_KEYS)[number],
      [],
      options,
    );
    if (expected === null) {
      expect(decision).toEqual({
        allowed: false,
        limit: 0,
        code: 'ENTITLEMENT_REQUIRED',
      });
    } else {
      expect(decision).toEqual({ allowed: true, limit: expected });
    }
  });

  it('o ATS básico e os scores de matching são gratuitos (G2.3)', () => {
    expect(
      canUseFeature(organization, 'ATS_PIPELINE', [], options).allowed,
    ).toBe(true);
    expect(
      canUseFeature(organization, 'MATCH_SCORES', [], options).allowed,
    ).toBe(true);
  });

  it('respeita o limite: a segunda vaga ativa gratuita é recusada', () => {
    expect(
      canUseFeature(organization, 'JOB_POST_SLOTS', [], {
        ...options,
        used: 1,
      }),
    ).toEqual({
      allowed: false,
      limit: 1,
      code: 'LIMIT_REACHED',
    });
  });

  it('Programa Fundador (PROMO = Recruit Pro) substitui a base, não soma', () => {
    const fundador = [
      grant({ source: 'PROMO', quantity: 5 }),
      grant({ source: 'PROMO', feature: 'SEATS', quantity: 5 }),
    ];
    expect(
      canUseFeature(organization, 'JOB_POST_SLOTS', fundador, options).limit,
    ).toBe(5);
    expect(canUseFeature(organization, 'SEATS', fundador, options).limit).toBe(
      5,
    );
  });

  it('o PROMO acaba na data prevista e volta o Gratuito', () => {
    const fundador = [grant({ source: 'PROMO', quantity: 5, validUntil: now })];
    expect(
      canUseFeature(organization, 'JOB_POST_SLOTS', fundador, options).limit,
    ).toBe(1);
  });

  it('Job Post avulso pago soma uma vaga ao plano; por pagar não conta', () => {
    const avulso = grant({
      source: 'PURCHASE',
      quantity: 1,
      paymentStatus: 'PAID',
    });
    expect(
      canUseFeature(organization, 'JOB_POST_SLOTS', [avulso], options).limit,
    ).toBe(2);
    expect(
      canUseFeature(
        organization,
        'JOB_POST_SLOTS',
        [grant({ quantity: 5 }), avulso],
        options,
      ).limit,
    ).toBe(6);
    expect(
      canUseFeature(
        organization,
        'JOB_POST_SLOTS',
        [grant({ source: 'PURCHASE', quantity: 1, paymentStatus: undefined })],
        options,
      ).limit,
    ).toBe(1);
  });

  it('universidades e centros de formação: estágios ilimitados, só estágios', () => {
    for (const organizationType of ['UNIVERSIDADE', 'CENTRO_FORMACAO']) {
      const school: Subject = { ...organization, organizationType };
      expect(
        canUseFeature(school, 'JOB_POST_SLOTS', [], {
          ...options,
          used: 50,
          employmentType: 'ESTAGIO',
        }),
      ).toEqual({ allowed: true, limit: null });
      expect(
        canUseFeature(school, 'JOB_POST_SLOTS', [], {
          ...options,
          used: 1,
          employmentType: 'TEMPO_INTEIRO',
        }).allowed,
      ).toBe(false);
    }
    expect(
      canUseFeature(organization, 'JOB_POST_SLOTS', [], {
        ...options,
        used: 1,
        employmentType: 'ESTAGIO',
      }).allowed,
    ).toBe(false);
  });
});

describe('G2.1 — candidatos nunca pagam para se candidatar ou subir no ranking', () => {
  it('não existe nenhum entitlement de candidaturas, prioridade ou destaque de candidato', () => {
    expect(
      ENTITLEMENT_KEYS.filter((key) =>
        /APPLICATION|APPLY|PRIORITY|RANK|BOOST/.test(key),
      ),
    ).toEqual([]);
  });

  it('uma organização não consegue usar features de candidato, nem o contrário', () => {
    const candidate: Subject = { type: 'CANDIDATE', id: 'cand-a' };
    expect(
      canUseFeature(organization, 'CV_ADVANCED', [], options).allowed,
    ).toBe(false);
    expect(canUseFeature(candidate, 'TALENT_SEARCH', [], options).allowed).toBe(
      false,
    );
  });
});

describe('D13 — rate limits', () => {
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  test.each([
    ['login', [{ subject: 'ACCOUNT_IP', limit: 5, windowMs: 15 * minute }]],
    ['register', [{ subject: 'IP', limit: 5, windowMs: hour }]],
    [
      'otp',
      [
        { subject: 'PHONE', limit: 3, windowMs: 10 * minute },
        { subject: 'PHONE', limit: 10, windowMs: day },
      ],
    ],
    ['password_reset', [{ subject: 'ACCOUNT', limit: 3, windowMs: hour }]],
    [
      'application_submit',
      [
        { subject: 'USER', limit: 5, windowMs: 10 * minute },
        { subject: 'USER', limit: 25, windowMs: day },
      ],
    ],
    ['upload', [{ subject: 'USER', limit: 20, windowMs: hour }]],
    ['message', [{ subject: 'USER', limit: 30, windowMs: day }]],
    ['report_submit', [{ subject: 'USER', limit: 10, windowMs: day }]],
    ['search', [{ subject: 'IP', limit: 60, windowMs: minute }]],
    [
      'talent_search',
      [{ subject: 'ORGANIZATION', limit: 120, windowMs: hour }],
    ],
    ['export', [{ subject: 'ORGANIZATION', limit: 10, windowMs: day }]],
    // H5 — acréscimos do fecho (exportação pessoal imediata e eliminação).
    [
      'personal_data_export',
      [{ subject: 'USER', limit: 3, windowMs: 7 * day }],
    ],
    ['account_deletion', [{ subject: 'USER', limit: 5, windowMs: day }]],
    // F5.4: máximo diário de convites por plano.
    [
      'talent_invite_pro',
      [{ subject: 'ORGANIZATION', limit: 15, windowMs: day }],
    ],
    [
      'talent_invite_business',
      [{ subject: 'ORGANIZATION', limit: 40, windowMs: day }],
    ],
  ])('%s', (action, expected) => {
    expect(
      RATE_LIMIT_POLICIES[action as keyof typeof RATE_LIMIT_POLICIES],
    ).toEqual(expected);
  });

  it('nenhuma ação fica sem limite definido', () => {
    expect(Object.keys(RATE_LIMIT_POLICIES).sort()).toEqual(
      [
        'account_deletion',
        'application_submit',
        'export',
        'login',
        'message',
        'otp',
        'password_reset',
        'personal_data_export',
        'register',
        'report_submit',
        'search',
        'talent_invite_business',
        'talent_invite_pro',
        'talent_search',
        'upload',
      ].sort(),
    );
  });
});

describe('E2/H5 — consentimentos e documentos legais', () => {
  it('cobre as cinco finalidades da página de consentimentos', () => {
    expect(CONSENT_KINDS).toEqual(
      expect.arrayContaining([
        'TALENT_POOL',
        'MARKETING_EMAIL',
        'MARKETING_WHATSAPP',
        'AI_PROCESSING',
        'JOB_ALERTS',
      ]),
    );
  });

  it('aceitação de termos inclui os termos de empregador', () => {
    expect([...LEGAL_DOCUMENTS].sort()).toEqual([
      'EMPLOYER_TERMS',
      'PRIVACY',
      'TERMS',
    ]);
  });
});
