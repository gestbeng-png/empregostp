import fs from 'node:fs';
import path from 'node:path';

import {
  EMAIL_PROVIDER_OPTIONS,
  REQUIRED_PRODUCTION_ENV,
  assertProductionEnv,
  findProductionEnvProblems,
} from '../../../lib/productionEnv.mjs';

function completeEnv(): Record<string, string> {
  return {
    ...Object.fromEntries(REQUIRED_PRODUCTION_ENV.map((name) => [name, 'x'])),
    BREVO_API_KEY: 'x',
    EMAIL_FROM_ADDRESS: 'contacto@empregostp.com',
  };
}

describe('variáveis de produção (secções 121–122)', () => {
  test('aceita uma configuração completa', () => {
    expect(findProductionEnvProblems(completeEnv())).toEqual([]);
    expect(() => assertProductionEnv(completeEnv())).not.toThrow();
  });

  test.each(REQUIRED_PRODUCTION_ENV.map((name) => [name]))(
    'falha sem %s e diz qual é',
    (name) => {
      const env = Object.fromEntries(
        Object.entries(completeEnv()).filter(([key]) => key !== name),
      );
      expect(findProductionEnvProblems(env)).toEqual([`${name} em falta`]);
    },
  );

  test('um valor só com espaços conta como em falta', () => {
    const env = { ...completeEnv(), CRON_SECRET: '   ' };
    expect(findProductionEnvProblems(env)).toEqual(['CRON_SECRET em falta']);
  });

  test.each(EMAIL_PROVIDER_OPTIONS.map((group) => [group.join('+'), group]))(
    'aceita o fornecedor de email %s',
    (_label, group) => {
      const env: Record<string, string> = completeEnv();
      delete env.BREVO_API_KEY;
      for (const name of group as string[]) env[name] = 'x';
      expect(findProductionEnvProblems(env)).toEqual([]);
    },
  );

  test('exige pelo menos um fornecedor de email completo', () => {
    const env: Record<string, string> = completeEnv();
    delete env.BREVO_API_KEY;
    env.BREVO_SMTP_LOGIN = 'só metade';
    expect(findProductionEnvProblems(env)).toEqual([
      expect.stringContaining('nenhum fornecedor de email'),
    ]);
  });

  test('exige um remetente de email', () => {
    const env: Record<string, string> = completeEnv();
    delete env.EMAIL_FROM_ADDRESS;
    expect(findProductionEnvProblems(env)).toEqual([
      'EMAIL_FROM_ADDRESS em falta (remetente dos emails)',
    ]);
  });

  test('recusa a página de seed ligada em produção', () => {
    const env = { ...completeEnv(), ENABLE_DEV_SEED_PAGE: 'true' };
    expect(() => assertProductionEnv(env)).toThrow(/ENABLE_DEV_SEED_PAGE/);
  });

  test('a mensagem lista tudo o que falta de uma vez', () => {
    expect(() => assertProductionEnv({})).toThrow(
      /FIREBASE_PRIVATE_KEY em falta[\s\S]*CRON_SECRET em falta[\s\S]*fornecedor de email/,
    );
  });

  test('.env.example documenta todas as obrigatórias, sem valores reais', () => {
    const example = fs.readFileSync(
      path.join(process.cwd(), '.env.example'),
      'utf8',
    );
    for (const name of [
      ...REQUIRED_PRODUCTION_ENV,
      ...EMAIL_PROVIDER_OPTIONS.flat(),
      'EMAIL_FROM_ADDRESS',
    ]) {
      expect(example).toMatch(new RegExp(`^#?\\s*${name}=`, 'm'));
    }
    // Nenhuma chave real: valores só vazios ou marcadores evidentes.
    expect(example).not.toMatch(
      /xkeysib-|BEGIN PRIVATE KEY|AIza[0-9A-Za-z_-]{20,}/,
    );
  });
});
