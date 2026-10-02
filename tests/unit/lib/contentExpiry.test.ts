import {
  CONTENT_STATUS,
  isContentExpired,
  isContentVisible,
  parseContentExpiry,
} from '../../../lib/contentPublication';

const AGORA = new Date('2026-02-03T12:00:00.000Z');

describe('prazo de exibição do conteúdo', () => {
  test('sem prazo, o conteúdo nunca expira', () => {
    expect(parseContentExpiry('')).toBeNull();
    expect(isContentExpired('', AGORA)).toBe(false);
    expect(isContentExpired(undefined, AGORA)).toBe(false);
  });

  test('uma data sem hora vale até ao fim desse dia', () => {
    expect(isContentExpired('2026-02-03', AGORA)).toBe(false);
    expect(isContentExpired('2026-02-02', AGORA)).toBe(true);
  });

  test('compara o instante exacto quando há hora', () => {
    expect(isContentExpired('2026-02-03T11:59:00.000Z', AGORA)).toBe(true);
    expect(isContentExpired('2026-02-03T12:01:00.000Z', AGORA)).toBe(false);
  });

  test('só é visível o que está publicado e dentro do prazo', () => {
    expect(
      isContentVisible(
        { status: CONTENT_STATUS.PUBLISHED, expiresAt: '' },
        AGORA,
      ),
    ).toBe(true);
    expect(
      isContentVisible(
        { status: CONTENT_STATUS.PUBLISHED, expiresAt: '2026-02-01' },
        AGORA,
      ),
    ).toBe(false);
    expect(
      isContentVisible({ status: CONTENT_STATUS.DRAFT, expiresAt: '' }, AGORA),
    ).toBe(false);
  });
});
