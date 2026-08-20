import {
  OFFLINE_MESSAGE,
  getNetworkErrorMessage,
  isNetworkError,
} from '../../../lib/networkError';

function setOnline(value: boolean): void {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value,
  });
}

describe('isNetworkError', () => {
  afterEach(() => {
    setOnline(true);
  });

  test('reconhece os códigos de rede do Firebase mesmo com o browser online', () => {
    expect(isNetworkError({ code: 'auth/network-request-failed' })).toBe(true);
    expect(isNetworkError({ code: 'auth/timeout' })).toBe(true);
    expect(isNetworkError({ code: 'unavailable' })).toBe(true);
  });

  test('trata auth/internal-error como falta de rede quando o browser está offline', () => {
    setOnline(false);
    expect(
      isNetworkError({
        code: 'auth/internal-error',
        message: 'Firebase: Error (auth/internal-error).',
      }),
    ).toBe(true);
  });

  test('mantém auth/internal-error como erro real quando há rede', () => {
    expect(
      isNetworkError({
        code: 'auth/internal-error',
        message: 'Firebase: Error (auth/internal-error).',
      }),
    ).toBe(false);
  });

  test('reconhece a mensagem de rede mesmo sem código', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isNetworkError(new TypeError('Load failed'))).toBe(true);
  });

  test('não confunde erros de credenciais com falta de rede', () => {
    expect(isNetworkError({ code: 'auth/invalid-credential' })).toBe(false);
    expect(isNetworkError({ code: 'auth/too-many-requests' })).toBe(false);
  });

  test('erros com código conhecido continuam a ser eles próprios offline', () => {
    setOnline(false);
    expect(isNetworkError({ code: 'auth/invalid-credential' })).toBe(false);
  });
});

describe('getNetworkErrorMessage', () => {
  test('substitui a mensagem genérica quando a causa é a rede', () => {
    expect(
      getNetworkErrorMessage(
        { code: 'auth/network-request-failed' },
        'Email ou senha incorretos.',
      ),
    ).toBe(OFFLINE_MESSAGE);
  });

  test('preserva a mensagem original nos restantes casos', () => {
    expect(
      getNetworkErrorMessage(
        { code: 'auth/wrong-password' },
        'Email ou senha incorretos.',
      ),
    ).toBe('Email ou senha incorretos.');
  });
});
