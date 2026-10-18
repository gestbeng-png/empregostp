import type { FeatureFlag } from '@/domain/feature-flags/flags';
import {
  DEFAULT_FLAGS,
  FEATURE_KEYS,
  isEnabled,
} from '@/domain/feature-flags/flags';
import { validEventPayload } from '@/domain/outbox/events';
import type { OutboxEvent } from '@/domain/outbox/OutboxEvent';
import {
  afterFailure,
  canClaim,
  RETRY_DELAYS_MS,
} from '@/domain/outbox/OutboxEvent';

const prod = { environment: 'production' as const };

describe('feature flags (D9)', () => {
  it('todas as flags começam desligadas', () => {
    for (const key of FEATURE_KEYS) {
      expect(
        isEnabled(key, DEFAULT_FLAGS[key], { ...prod, userId: 'u1' }),
      ).toBe(false);
    }
  });

  it('as kill switches de emergência existem desde a Fase 1', () => {
    expect(FEATURE_KEYS).toEqual(
      expect.arrayContaining([
        'KILL_AI',
        'KILL_WHATSAPP',
        'KILL_OUTBOUND_EMAIL_MARKETING',
      ]),
    );
  });

  it('uma kill switch ligada vale sempre, sem rollout nem ambiente', () => {
    const flag: FeatureFlag = {
      enabled: true,
      rolloutPercent: 0,
      environments: ['staging'],
    };
    expect(isEnabled('KILL_AI', flag, prod)).toBe(true);
  });

  it('respeita o ambiente', () => {
    const flag: FeatureFlag = { enabled: true, environments: ['staging'] };
    expect(isEnabled('V2_SEARCH', flag, prod)).toBe(false);
    expect(isEnabled('V2_SEARCH', flag, { environment: 'staging' })).toBe(true);
  });

  it('allowlists ativam beta sem rollout', () => {
    const flag: FeatureFlag = {
      enabled: true,
      rolloutPercent: 0,
      allowOrgIds: ['org-beta'],
      allowUserIds: ['u-equipa'],
    };
    expect(
      isEnabled('V2_EMPLOYER_ATS', flag, {
        ...prod,
        organizationId: 'org-beta',
      }),
    ).toBe(true);
    expect(
      isEnabled('V2_EMPLOYER_ATS', flag, { ...prod, userId: 'u-equipa' }),
    ).toBe(true);
    expect(
      isEnabled('V2_EMPLOYER_ATS', flag, { ...prod, userId: 'u-outro' }),
    ).toBe(false);
  });

  it('rollout parcial é determinístico e aproxima a percentagem', () => {
    const flag: FeatureFlag = { enabled: true, rolloutPercent: 25 };
    const ids = Array.from({ length: 4000 }, (_, index) => `org-${index}`);
    const first = ids.map((id) =>
      isEnabled('V2_MATCHING', flag, { ...prod, organizationId: id }),
    );
    const second = ids.map((id) =>
      isEnabled('V2_MATCHING', flag, { ...prod, organizationId: id }),
    );
    const share = first.filter(Boolean).length / ids.length;

    expect(second).toEqual(first);
    expect(share).toBeGreaterThan(0.2);
    expect(share).toBeLessThan(0.3);
  });

  it('rollout parcial sem identidade fica desligado; percentagens inválidas também', () => {
    expect(
      isEnabled('V2_MATCHING', { enabled: true, rolloutPercent: 50 }, prod),
    ).toBe(false);
    for (const rolloutPercent of [0, -5, 101, Number.NaN]) {
      expect(
        isEnabled(
          'V2_MATCHING',
          { enabled: true, rolloutPercent },
          { ...prod, userId: 'u1' },
        ),
      ).toBe(false);
    }
    expect(isEnabled('V2_MATCHING', { enabled: true }, prod)).toBe(true);
  });
});

function event(overrides: Partial<OutboxEvent> = {}): OutboxEvent {
  return {
    id: 'evt-1',
    type: 'entity_status_changed',
    schemaVersion: 1,
    payload: { entityId: 'app-1', entityKind: 'Application', version: 2 },
    status: 'PENDING',
    attempts: 0,
    createdAtMs: 0,
    nextAttemptAtMs: 1_000,
    ...overrides,
  };
}

describe('outbox (D5)', () => {
  it('só reclama eventos devidos', () => {
    expect(canClaim(event(), 999)).toBe(false);
    expect(canClaim(event(), 1_000)).toBe(true);
    expect(canClaim(event({ status: 'FAILED' }), 1_000)).toBe(true);
    expect(canClaim(event({ status: 'DONE' }), 5_000)).toBe(false);
    expect(canClaim(event({ status: 'DEAD' }), 5_000)).toBe(false);
  });

  it('um evento em processamento só volta a ser reclamado quando o lease expira', () => {
    const processing = event({ status: 'PROCESSING', leaseUntilMs: 2_000 });
    expect(canClaim(processing, 1_999)).toBe(false);
    expect(canClaim(processing, 2_000)).toBe(true);
    expect(canClaim(event({ status: 'PROCESSING' }), 9_999)).toBe(false);
  });

  it('recusa contadores e relógios inválidos', () => {
    expect(canClaim(event({ attempts: -1 }), 5_000)).toBe(false);
    expect(canClaim(event({ attempts: 1.5 }), 5_000)).toBe(false);
    expect(canClaim(event(), Number.NaN)).toBe(false);
  });

  it('backoff 1 m, 5 m, 30 m, 2 h, 12 h e depois dead letter', () => {
    expect([...RETRY_DELAYS_MS]).toEqual([
      60_000, 300_000, 1_800_000, 7_200_000, 43_200_000,
    ]);

    let current = event();
    const now = 10_000;
    for (const delay of RETRY_DELAYS_MS) {
      const next = afterFailure(current, now);
      expect(next).toEqual({
        status: 'FAILED',
        attempts: current.attempts + 1,
        nextAttemptAtMs: now + delay,
      });
      current = { ...current, ...next };
    }
    expect(afterFailure(current, now).status).toBe('DEAD');
  });

  it('o payload só leva ids, nunca dados pessoais ou caminhos', () => {
    expect(
      validEventPayload('entity_status_changed', {
        entityId: 'app-1',
        entityKind: 'Application',
        version: 3,
      }),
    ).toBe(true);
    expect(
      validEventPayload('consent_recorded', { consentId: 'c1', userId: 'u1' }),
    ).toBe(true);
    expect(
      validEventPayload('consent_recorded', {
        consentId: 'c1',
        userId: 'u1',
        email: 'maria@example.test',
      }),
    ).toBe(false);
    expect(
      validEventPayload('entity_status_changed', {
        entityId: 'cvUrl/u1/cv.pdf',
        entityKind: 'Application',
        version: 3,
      }),
    ).toBe(false);
    expect(
      validEventPayload('entity_status_changed', {
        entityId: 'app-1',
        entityKind: 'Application',
        version: 0,
      }),
    ).toBe(false);
    expect(validEventPayload('evento_desconhecido', {})).toBe(false);
    expect(
      validEventPayload('terms_accepted', ['acceptanceId', 'userId']),
    ).toBe(false);
    expect(validEventPayload('terms_accepted', null)).toBe(false);
  });
});
