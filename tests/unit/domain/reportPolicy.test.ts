import {
  canAutoHideFrom,
  reportDueAt,
  reportPriority,
  REPORT_REASONS,
  shouldAutoHideJob,
} from '@/domain/reports/policy';

describe('E9 — prioridade e SLA', () => {
  test.each([
    ['ASKED_FOR_MONEY', 'P1'],
    ['PHISHING', 'P1'],
    ['FAKE_JOB', 'P1'],
    ['HARASSMENT', 'P1'],
    ['DISCRIMINATION', 'P1'],
    ['SPAM', 'P2'],
    ['DUPLICATE', 'P2'],
    ['INAPPROPRIATE', 'P2'],
    ['EXPIRED_STILL_LISTED', 'P3'],
    ['OTHER', 'P3'],
  ] as const)('%s numa vaga → %s', (reason, priority) => {
    expect(reportPriority(reason, 'JOB')).toBe(priority);
  });

  test('H9: entrevista abusiva é sempre P1; denúncia de candidatura é P2', () => {
    for (const reason of REPORT_REASONS) {
      expect(reportPriority(reason, 'INTERVIEW')).toBe('P1');
      expect(reportPriority(reason, 'APPLICATION')).not.toBe('P1');
    }
    expect(reportPriority('SPAM', 'APPLICATION')).toBe('P2');
  });

  test('P1 24 h; P2/P3 em dias úteis', () => {
    const friday = new Date('2026-10-09T10:00:00Z');
    expect(reportDueAt('P1', friday).toISOString()).toBe(
      '2026-10-10T10:00:00.000Z',
    );
    expect(reportDueAt('P2', friday).toISOString()).toBe(
      '2026-10-14T10:00:00.000Z',
    );
    expect(reportDueAt('P3', friday).toISOString()).toBe(
      '2026-10-20T10:00:00.000Z',
    );
  });
});

describe('E9 — ocultação automática', () => {
  test('2 denúncias independentes de fraude ocultam', () => {
    expect(
      shouldAutoHideJob({
        reason: 'ASKED_FOR_MONEY',
        reporterIds: ['a', 'b'],
        riskScore: null,
      }),
    ).toBe(true);
  });
  test('o mesmo denunciante repetido conta uma vez', () => {
    expect(
      shouldAutoHideJob({
        reason: 'ASKED_FOR_MONEY',
        reporterIds: ['a', 'a'],
        riskScore: 10,
      }),
    ).toBe(false);
  });
  test('1 denúncia + riskScore ≥ 40 oculta; < 40 não', () => {
    expect(
      shouldAutoHideJob({
        reason: 'PHISHING',
        reporterIds: ['a'],
        riskScore: 40,
      }),
    ).toBe(true);
    expect(
      shouldAutoHideJob({
        reason: 'FAKE_JOB',
        reporterIds: ['a'],
        riskScore: 39,
      }),
    ).toBe(false);
  });
  test('assédio e discriminação nunca têm ação automática', () => {
    for (const reason of ['HARASSMENT', 'DISCRIMINATION', 'SPAM'] as const)
      expect(
        shouldAutoHideJob({
          reason,
          reporterIds: ['a', 'b', 'c'],
          riskScore: 99,
        }),
      ).toBe(false);
  });
  test('só vagas visíveis são ocultadas', () => {
    expect(canAutoHideFrom('PUBLISHED')).toBe(true);
    expect(canAutoHideFrom('PAUSED')).toBe(true);
    for (const status of [
      'DRAFT',
      'PENDING_REVIEW',
      'CLOSED',
      'REJECTED',
      'ARCHIVED',
    ])
      expect(canAutoHideFrom(status)).toBe(false);
  });
});
