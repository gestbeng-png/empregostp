import { inspect } from 'node:util';

import {
  getSafeErrorMetadata,
  logServerError,
  logServerWarning,
} from '../../../lib/serverLog';

describe('logging seguro no servidor', () => {
  test.each([
    ['auth/internal-error', 'authentication'],
    ['storage/unknown', 'storage'],
    ['firestore/unavailable', 'firestore'],
    ['messaging/internal-error', 'messaging'],
    ['REQUEST_FORBIDDEN', 'business_rule'],
    ['ERR_NETWORK', 'runtime'],
    [13, 'service'],
    ['codigo-nao-classificado', 'unexpected'],
  ])('classifica %p sem conservar o código bruto', (code, category) => {
    expect(getSafeErrorMetadata({ code })).toEqual({ category });
  });

  test('descarta mensagem, stack, causa e propriedades arbitrárias', () => {
    const canary = 'email@example.test|token-secreto|JVBERi0x';
    const error = Object.assign(new Error(canary), {
      cause: new Error(canary),
      code: `unsafe/${canary}`,
      config: { headers: { authorization: canary } },
      customData: { serverResponse: canary },
    });

    const metadata = getSafeErrorMetadata(error);

    expect(metadata).toEqual({ category: 'unexpected' });
    expect(inspect(metadata, { depth: null })).not.toContain(canary);
  });

  test('regista apenas evento validado e metadados classificados', () => {
    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const warningSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    logServerError('payment_proof.request_failed', {
      code: 'auth/internal-error',
      message: 'não deve aparecer',
    });
    logServerWarning('evento inválido com espaços', {
      code: 'storage/unknown',
      message: 'não deve aparecer',
    });

    expect(errorSpy).toHaveBeenCalledWith('payment_proof.request_failed', {
      category: 'authentication',
    });
    expect(warningSpy).toHaveBeenCalledWith('server.unclassified_error', {
      category: 'storage',
    });

    errorSpy.mockRestore();
    warningSpy.mockRestore();
  });
});
