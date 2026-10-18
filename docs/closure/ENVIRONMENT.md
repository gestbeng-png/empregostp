# Environment de encerramento

## Local

- Next.js 16.2.10 com Pages Router/Webpack.
- Node/npm conforme `package.json` e `package-lock.json`.
- Firebase Auth, Firestore, Storage e Admin SDK.
- Ligação online confirmada em 2026-10-11 contra o projeto Firebase `empregostp`, através de auditoria agregada somente-leitura; nenhuma escrita foi executada.
- Repetir a confirmação com `npm run verify:firebase-online`.
- Playwright configurado, mas os E2E críticos ainda não foram aprovados.

## Variáveis e serviços que precisam de confirmação

Antes da validação remota, confirmar no ambiente alvo as variáveis Firebase client/admin, Brevo, pagamentos, storage, cron/job secret, URLs públicas e flags v2. Segredos não devem ser colocados neste documento nem no repositório.

## Lista completa e validação no build (secções 121–122)

- **`.env.example`** (raiz) lista todas as variáveis que o código lê, marcadas
  `[OBRIGATÓRIA]`, `[UMA DE]` ou `[OPCIONAL]`, sem valores.
- **`lib/productionEnv.mjs`** é chamado por `next.config.mjs` quando
  `VERCEL_ENV=production`. Se faltar alguma variável obrigatória, se não houver
  nenhum fornecedor de email completo, se não houver remetente
  (`EMAIL_FROM_ADDRESS`) ou se `ENABLE_DEV_SEED_PAGE=true`, o **build falha**
  com a lista do que falta e a versão anterior continua no ar. Previews e
  desenvolvimento não são bloqueados.
- Obrigatórias: as 6 `NEXT_PUBLIC_FIREBASE_*` do cliente (sem
  `MEASUREMENT_ID`), `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`,
  `FIREBASE_PRIVATE_KEY`, `CRON_SECRET`, `EMAIL_FROM_ADDRESS` e um fornecedor
  de email.
- **Antes do primeiro deploy de produção com esta alteração**, confirmar no
  painel da Vercel que estas variáveis existem em *Production*; se faltar
  alguma, o deploy falha por desenho.
- As flags `V2_*` do produto não são variáveis de ambiente: vivem na coleção
  Firestore `featureFlags`.

## Regra de segurança

Não usar credenciais de produção em testes locais. Não considerar `NEXT_PUBLIC_*` secreto. Confirmar permissões, origem, cookies, CORS e URLs de callback no ambiente alvo.
