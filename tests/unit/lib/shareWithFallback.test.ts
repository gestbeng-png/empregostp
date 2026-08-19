import { shareWithClipboardFallback } from '../../../lib/shareWithFallback';

const payload = {
  title: 'Programador',
  text: 'Conheça esta vaga: Programador',
  url: 'https://empregos.st/vaga/job-1',
};

function navigatorStub(value: Record<string, unknown>): Navigator {
  return value as unknown as Navigator;
}

describe('partilha de vaga com fallback', () => {
  test('usa a partilha nativa quando funciona', async () => {
    const share = jest.fn().mockResolvedValue(undefined);
    const writeText = jest.fn();

    const result = await shareWithClipboardFallback({
      ...payload,
      navigatorApi: navigatorStub({ share, clipboard: { writeText } }),
    });

    expect(result).toEqual({ status: 'shared', nativeFailed: false });
    expect(share).toHaveBeenCalledWith(payload);
    expect(writeText).not.toHaveBeenCalled();
  });

  test('quando a partilha nativa falha copia para o clipboard', async () => {
    const share = jest.fn().mockRejectedValue(new Error('indisponível'));
    const writeText = jest.fn().mockResolvedValue(undefined);

    const result = await shareWithClipboardFallback({
      ...payload,
      navigatorApi: navigatorStub({ share, clipboard: { writeText } }),
    });

    expect(result).toEqual({ status: 'copied', nativeFailed: true });
    expect(writeText).toHaveBeenCalledWith(`${payload.text} ${payload.url}`);
  });

  test('sem Web Share também copia para o clipboard', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);

    const result = await shareWithClipboardFallback({
      ...payload,
      navigatorApi: navigatorStub({ clipboard: { writeText } }),
    });

    expect(result).toEqual({ status: 'copied', nativeFailed: false });
  });

  test('cancelamento explícito não copia sem autorização do utilizador', async () => {
    const cancelled = new Error('cancelado');
    cancelled.name = 'AbortError';
    const share = jest.fn().mockRejectedValue(cancelled);
    const writeText = jest.fn();

    const result = await shareWithClipboardFallback({
      ...payload,
      navigatorApi: navigatorStub({ share, clipboard: { writeText } }),
    });

    expect(result).toEqual({ status: 'cancelled', nativeFailed: false });
    expect(writeText).not.toHaveBeenCalled();
  });

  test('informa falha quando nem partilha nem clipboard estão disponíveis', async () => {
    await expect(
      shareWithClipboardFallback({
        ...payload,
        navigatorApi: navigatorStub({}),
      }),
    ).resolves.toEqual({ status: 'failed', nativeFailed: false });
  });
});
