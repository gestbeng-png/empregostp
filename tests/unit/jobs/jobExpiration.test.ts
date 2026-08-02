import {
  getEffectiveJobStatus,
  isJobPubliclyVisible,
} from '../../../lib/jobExpiration';

describe('visibilidade pública de vagas', () => {
  const now = new Date('2026-07-28T12:00:00.000Z');

  test.each([
    undefined,
    'active',
    ' ACTIVE ',
    'open',
    'aberta',
    'published',
  ])('publica o estado compatível %s', (status) => {
    expect(
      isJobPubliclyVisible(
        {
          status,
          dataFecho: '2026-07-29',
        },
        now,
      ),
    ).toBe(true);
  });

  test.each([
    'draft',
    'disabled',
    'inactive',
    'inativa',
    'closed',
    'fechada',
    'expired',
    'expirada',
    'pending_review',
    'paused',
    'filled',
  ])('não publica o estado %s', (status) => {
    expect(
      isJobPubliclyVisible(
        {
          status,
          dataFecho: '2026-07-29',
        },
        now,
      ),
    ).toBe(false);
  });

  test('não publica uma vaga ativa cujo prazo já terminou', () => {
    const job = {
      status: 'active',
      dataFecho: '2026-07-27',
    };

    expect(getEffectiveJobStatus(job, now)).toBe('closed');
    expect(isJobPubliclyVisible(job, now)).toBe(false);
  });

  test('mantém a vaga pública durante todo o último dia indicado', () => {
    expect(
      isJobPubliclyVisible(
        {
          status: 'active',
          dataFecho: '2026-07-28',
        },
        now,
      ),
    ).toBe(true);
  });
});
