// Variáveis sem as quais a produção não funciona (secções 121–122 do fecho).
//
// Corre no build de produção (`next.config.mjs` com VERCEL_ENV=production):
// falhar o build deixa a versão anterior no ar, em vez de publicar uma que
// arranca a meio e só rebenta no primeiro pedido. A lista completa, com as
// opcionais, está em `.env.example`.

export const REQUIRED_PRODUCTION_ENV = Object.freeze([
  // Firebase no browser (vão para o bundle no build).
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
  // Admin SDK: todas as APIs.
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  // Sem isto as tarefas agendadas respondem 500 e as vagas não expiram.
  'CRON_SECRET',
]);

// Basta um dos fornecedores de email (ver lib/email.js).
export const EMAIL_PROVIDER_OPTIONS = Object.freeze([
  ['BREVO_API_KEY'],
  ['BREVO_SMTP_LOGIN', 'BREVO_SMTP_KEY'],
  ['ZOHO_SMTP_USER', 'ZOHO_SMTP_PASSWORD'],
  ['GMAIL_USER', 'GMAIL_APP_PASSWORD'],
]);

const present = (env, name) =>
  typeof env[name] === 'string' && env[name].trim() !== '';

export function findProductionEnvProblems(env) {
  const problems = REQUIRED_PRODUCTION_ENV.filter(
    (name) => !present(env, name),
  ).map((name) => `${name} em falta`);

  const hasEmailProvider = EMAIL_PROVIDER_OPTIONS.some((group) =>
    group.every((name) => present(env, name)),
  );
  if (!hasEmailProvider) {
    problems.push(
      'nenhum fornecedor de email configurado (BREVO_API_KEY, ou BREVO_SMTP_LOGIN+BREVO_SMTP_KEY, ou ZOHO_SMTP_USER+ZOHO_SMTP_PASSWORD, ou GMAIL_USER+GMAIL_APP_PASSWORD)',
    );
  }

  // Sem remetente nenhum email sai (lib/email.js só recorre a GMAIL_USER).
  if (!present(env, 'EMAIL_FROM_ADDRESS') && !present(env, 'GMAIL_USER')) {
    problems.push('EMAIL_FROM_ADDRESS em falta (remetente dos emails)');
  }

  // A página de seed escreve conteúdo de demonstração na base de dados real.
  if (env.ENABLE_DEV_SEED_PAGE === 'true') {
    problems.push('ENABLE_DEV_SEED_PAGE=true não é permitido em produção');
  }

  return problems;
}

export function assertProductionEnv(env) {
  const problems = findProductionEnvProblems(env);
  if (problems.length === 0) return;
  throw new Error(
    `Configuração de produção incompleta — o build foi interrompido:\n- ${problems.join('\n- ')}\nVer .env.example e docs/closure/ENVIRONMENT.md.`,
  );
}
