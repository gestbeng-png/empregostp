// Envia os dois emails de autenticação (confirmação de conta e recuperação de
// senha) para um endereço real.
//
// Uso: npm run test:auth-emails -- alguem@exemplo.com
//
// Ao contrário do preview:emails, este script gera códigos VERDADEIROS através
// do Firebase Admin, por isso o endereço tem de corresponder a uma conta
// existente. Os links funcionam mesmo — ignorá-los é inofensivo, expiram.
import { loadEnv } from './loadEnv.mjs';

loadEnv();

const { isEmailConfigured } = await import('../lib/email/index.js');
const { sendVerificationEmail, sendResetPasswordEmail } =
  await import('../lib/email/authEmails.js');

const destino = process.argv[2];
const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://empregostp.com';

if (!destino) {
  console.error(
    'Indica a conta: npm run test:auth-emails -- alguem@exemplo.com',
  );
  process.exit(1);
}
if (!isEmailConfigured()) {
  console.error('Email não configurado (falta BREVO_API_KEY).');
  process.exit(1);
}

console.log(`\nA enviar os emails de autenticação para ${destino}`);
console.log(`Links apontam para ${site}\n`);

const passos = [
  {
    nome: 'Confirmação de conta (registo)',
    executar: () =>
      sendVerificationEmail({
        email: destino,
        baseUrl: site,
        name: 'Utilizador de teste',
      }),
  },
  {
    nome: 'Recuperação de senha',
    executar: () => sendResetPasswordEmail({ email: destino, baseUrl: site }),
  },
];

let falhas = 0;
for (const passo of passos) {
  try {
    await passo.executar();
    console.log(`  OK      ${passo.nome}`);
  } catch (erro) {
    falhas += 1;
    const detalhe = erro?.errorInfo?.code || erro?.code || '';
    console.error(
      `  FALHOU  ${passo.nome} — ${detalhe ? detalhe + ': ' : ''}${erro.message}`,
    );
    if (String(detalhe).includes('user-not-found')) {
      console.error(
        '          (não existe conta com este email no Firebase Auth)',
      );
    }
  }
}

console.log(
  falhas
    ? `\n${falhas} de ${passos.length} falharam.\n`
    : '\nOs dois foram aceites. Verifica a caixa de entrada.\n',
);
process.exit(falhas ? 1 : 0);
