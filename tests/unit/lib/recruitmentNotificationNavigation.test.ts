import { recruitmentNotificationPath } from '@/lib/recruitmentNotificationNavigation';

describe('Recruitment notification navigation', () => {
  it.each(['/dashboard/candidato/candidaturas', '/dashboard/recrutamento'])(
    'links to %s',
    (actionUrl) => {
      expect(recruitmentNotificationPath({ actionUrl })).toBe(actionUrl);
    },
  );
  it.each([
    'https://attacker.example',
    '//attacker.example',
    '/equipa/convite?t=secret',
    '/dashboard/recrutamento?returnUrl=https://attacker.example',
    '',
    null,
  ])('rejects unapproved target %s', (actionUrl) => {
    expect(recruitmentNotificationPath({ actionUrl })).toBeNull();
  });
});
