# Publicação — EmpregoSTP

A aplicação é publicada na Vercel; dados, autenticação e ficheiros usam Firebase. O projeto Firebase configurado em `.firebaserc` é `empregostp`. Os comandos abaixo publicam alterações quando executados; não fazem parte de `npm run quality`.

## Configuração

Use Node.js 22, no mínimo 22.11, e instale as dependências com `npm ci`. Configure as variáveis localmente em `.env.local` e no ambiente de destino da Vercel.

| Variáveis                                                                  | Uso                                                             |
| -------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `NEXT_PUBLIC_FIREBASE_API_KEY`                                             | Configuração pública do cliente Firebase                        |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`                                         | Domínio de autenticação                                         |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`                                          | Projeto do cliente                                              |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`                                      | Bucket do cliente                                               |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`                                 | Identificador de mensagens                                      |
| `NEXT_PUBLIC_FIREBASE_APP_ID`                                              | Aplicação web Firebase                                          |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`                                      | Analytics                                                       |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`     | Credenciais do servidor; a chave aceita `\n` literais           |
| `FIREBASE_STORAGE_BUCKET`                                                  | Bucket do servidor                                              |
| `CRON_SECRET`                                                              | Autorização das tarefas agendadas                               |
| `NEXT_PUBLIC_SITE_URL`                                                     | URL pública da aplicação                                        |
| `BREVO_API_KEY`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`, `EMAIL_REPLY_TO` | Email; ver [configuração e alternativas](email-brevo-zoho.md)   |
| `CONTACT_INBOX`                                                            | Destino do formulário de contacto                               |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY`                                           | Notificações push web                                           |
| `GEMINI_API_KEY`                                                           | API de dicas de carreira, já sem chamada automática pelo painel |

As sete variáveis públicas Firebase são validadas por `lib/firebaseClientConfig.js`, a partir de `shared/firebase-client-env.json`. Não coloque credenciais privadas em variáveis `NEXT_PUBLIC_*`.

Não ative `ENABLE_DEV_SEED_PAGE` em produção. O projeto não inclui emuladores; desenvolvimento e E2E devem usar um ambiente dedicado.

## Validar e publicar

1. Execute `npm run quality` e `npm run build`.
2. Reveja o diff e publique os índices necessários antes das consultas que dependem deles:

   ```sh
   npx firebase deploy --only firestore:indexes --project empregostp
   ```

3. Confirme no Firebase que os índices terminaram de construir.
4. Publique o código pelo fluxo Git ligado à Vercel ou pelo CLI configurado para o projeto.
5. Verifique login, pesquisa, candidatura e upload/download de CV no ambiente de destino.
6. Publique regras apenas depois de confirmar que o código suporta as novas permissões:

   ```sh
   npx firebase deploy --only firestore:rules,storage --project empregostp
   ```

O script `deploy.sh`, exposto por `npm run deploy`, adiciona todas as alterações, faz commit e envia para `main`. Reveja tudo antes de o executar; o script não substitui as verificações acima.

## Tarefas e verificações operacionais

`vercel.json` declara os agendamentos de `/api/cron/check-plan-expiration` e `/api/cron/check-job-expiration`. Confirme a configuração do `CRON_SECRET` no ambiente de destino. Chamadas autenticadas a estas rotas podem alterar dados.

Verifique que as APIs protegidas recusam pedidos sem sessão, que os painéis encaminham visitantes para o login e que `/setup/seed` permanece indisponível em produção.

A coleção `apiRateLimits` usa o campo `expiresAt`; verifique a política TTL na configuração Firestore do ambiente. Alterações nessa política são operacionais e não estão incluídas no build.

## Reversão e registo de segurança

Para reverter código, republique uma revisão conhecida e validada. Para regras e índices, use a revisão correspondente no Git e reveja a compatibilidade com o código antes de publicar. Existe uma cópia histórica em `audits/rollback/2026-08-01-baseline/`; não deve ser aplicada automaticamente como se fosse a configuração atual.

Restauração de dados exige um backup verificado e uma decisão específica; não use exports antigos como parte de um deploy normal.

A auditoria de agosto de 2026 registou exposição de uma chave Firebase Admin no histórico Git. Esta limpeza não verificou a rotação. Confirme a revogação da credencial antiga e a atualização dos ambientes antes de encerrar esse incidente. Remover um ficheiro da árvore atual não apaga o histórico.
