# Guia de deploy — EmpregoSTP

> Escrito para ser seguido do princípio ao fim, sem conhecimento prévio do que
> foi feito na auditoria. Todos os comandos são copiáveis tal como estão.
> **Segue a ordem dos passos.** O passo 6 (regras de Storage) tem de vir depois
> do passo 4 (código em produção) — a ordem inversa quebra o acesso aos CV dos
> utilizadores reais. A razão está explicada no próprio passo.

Projeto Firebase: `empregostp` · Repositório: `Edmirsantos/EmpregoSTP-white`

---

## Passo 0 — Bloqueio de segurança por resolver

**A chave privada do Firebase Admin que está em uso é a mesma que está exposta
no histórico do Git.** Foi verificado por comparação de impressão digital da
chave pública. O repositório é privado, o que limita o alcance, mas qualquer
pessoa com acesso ao repositório — colaborador, clone antigo, integração de CI —
tem uma credencial que ignora todas as regras de Firestore e Storage.

Resolve isto antes ou logo depois do deploy, mas não o deixes indefinidamente.

```bash
# 1. Criar a nova chave. A antiga continua a funcionar, não há corte de serviço.
gcloud iam service-accounts keys create ~/nova-chave-admin.json \
  --iam-account=firebase-adminsdk-fbsvc@empregostp.iam.gserviceaccount.com \
  --project=empregostp
```

Abre o ficheiro, copia `private_key` e `client_email`, e atualiza na Vercel as
variáveis `FIREBASE_PRIVATE_KEY` e `FIREBASE_CLIENT_EMAIL`. Faz redeploy e
confirma que o login e uma escrita qualquer funcionam em produção. Atualiza
também o teu `.env.local`. **Só depois disso:**

```bash
# 2. Revogar a chave antiga (só depois de produção confirmada com a nova)
gcloud iam service-accounts keys delete 4e1b5e73f2c296b690ca8fb46cffdf33621127bf \
  --iam-account=firebase-adminsdk-fbsvc@empregostp.iam.gserviceaccount.com \
  --project=empregostp
```

```bash
# 3. Verificar se houve uso anómalo desta identidade
gcloud logging read \
  'protoPayload.authenticationInfo.principalEmail="firebase-adminsdk-fbsvc@empregostp.iam.gserviceaccount.com"' \
  --project=empregostp --freshness=90d --limit=50 \
  --format='table(timestamp,protoPayload.methodName,protoPayload.requestMetadata.callerIp)'
```

Apaga `~/nova-chave-admin.json` depois de o valor estar na Vercel e no `.env.local`.

---

## Passo 1 — Pré-requisitos

```bash
node --version    # tem de ser >= 22.11
npm --version
firebase --version
gcloud --version
```

```bash
# Autenticação nas duas ferramentas
firebase login
gcloud auth login
gcloud config set project empregostp
```

---

## Passo 2 — Variáveis de ambiente na Vercel

Confirma que **todas** as obrigatórias existem em Production. Sem uma das sete
`NEXT_PUBLIC_FIREBASE_*`, a aplicação falha no arranque com uma mensagem a dizer
quais faltam — é deliberado, para não arrancar meio configurada.

### Obrigatórias

| Variável | Onde obter |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Console → Definições do projeto → As tuas apps → Web |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | idem |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | idem (`empregostp`) |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | idem (`empregostp.firebasestorage.app`) |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | idem |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | idem |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | idem |
| `FIREBASE_PROJECT_ID` | `empregostp` |
| `FIREBASE_CLIENT_EMAIL` | do JSON da service account |
| `FIREBASE_PRIVATE_KEY` | do JSON da service account, **com os `\n` literais** |
| `FIREBASE_STORAGE_BUCKET` | `empregostp.firebasestorage.app` |
| `CRON_SECRET` | inventa um valor longo e aleatório; ver passo 5 |
| `NEXT_PUBLIC_SITE_URL` | `https://` + o teu domínio, sem barra final |

### Opcionais — a funcionalidade degrada com elegância se faltarem

| Variável | O que deixa de funcionar |
| --- | --- |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Emails transacionais. A app continua a funcionar e responde `202` em vez de `201` nos fluxos que enviariam email. |
| `EMAIL_FROM_NAME`, `CONTACT_INBOX` | Nome do remetente e caixa de destino do formulário de contacto. |
| `GEMINI_API_KEY` | Dicas de carreira por IA. A rota devolve dicas por omissão. |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Notificações push web. |

### Têm de estar DESLIGADAS ou ausentes

| Variável | Porquê |
| --- | --- |
| `ENABLE_DEV_SEED_PAGE` | Expõe a página de seed. Confirma que **não existe** em Production. |
| `NEXT_PUBLIC_USE_FIREBASE_EMULATORS` | Ligaria a app a emuladores inexistentes. |
| `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST` | idem |
| `NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST` | idem |

Para gerar o `CRON_SECRET`:

```bash
openssl rand -base64 48
```

---

## Passo 3 — Índices do Firestore (antes do código)

O repositório declara 10 índices compostos. Um deles corrige um caso em que a
exportação de candidaturas devolvia erro 500 a qualquer empresa. **Faz este
passo primeiro**: os índices demoram a construir, e o código tem recurso a
memória enquanto não estiverem prontos, mas é melhor tê-los a construir já.

```bash
cd "/caminho/para/EmpregoSTP beta"
firebase deploy --only firestore:indexes --project empregostp
```

Confirma na consola que terminaram:
<https://console.firebase.google.com/project/empregostp/firestore/indexes>

Todos têm de estar em **Ativado** (`Enabled`). Enquanto estiverem em
`Building`, não avances para o passo 6 — o resto pode avançar.

Alternativa por linha de comandos:

```bash
gcloud firestore indexes composite list --project=empregostp \
  --format='table(name.basename(),state)'
```

---

## Passo 4 — Deploy do código na Vercel

```bash
cd "/caminho/para/EmpregoSTP beta"
npm ci
npm run quality      # typecheck + lint + 336 testes; tem de passar
npm run build        # tem de compilar sem erros
```

Só com os dois verdes:

```bash
git push origin main    # se a Vercel está ligada ao repositório
# ou, com o CLI da Vercel:
vercel --prod
```

### Confirmar os crons

Depois do deploy, na Vercel → Projeto → Settings → Cron Jobs, confirma que
existem dois, tal como declarados em `vercel.json`:

| Caminho | Horário |
| --- | --- |
| `/api/cron/check-plan-expiration` | `0 2 * * *` |
| `/api/cron/check-job-expiration` | `15 2 * * *` |

Testa um deles à mão (substitui o domínio e o segredo):

```bash
curl -i https://SEU-DOMINIO/api/cron/check-plan-expiration \
  -H "Authorization: Bearer SEU_CRON_SECRET"
```

Deve responder `200`. Sem o cabeçalho, tem de responder `401` — confirma isso
também:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://SEU-DOMINIO/api/cron/check-plan-expiration
```

---

## Passo 5 — Validação intermédia

Antes de apertar as regras de Storage, confirma que o código novo está a
funcionar em produção. Cria uma conta temporária pela interface e faz este
percurso:

- [ ] Abrir a página inicial e ver vagas listadas
- [ ] Registar uma conta de candidato com um email teu
- [ ] Iniciar sessão e chegar ao painel
- [ ] Abrir uma vaga e candidatar-se
- [ ] Carregar um CV no perfil
- [ ] **Descarregar esse CV** — é o fluxo que o passo 6 pode partir se for feito fora de ordem
- [ ] Terminar sessão e confirmar que `/dashboard/candidato` redireciona para `/login?redirect=...`

Apaga a conta temporária no fim, pela consola do Firebase (Authentication → o
utilizador → Eliminar) e em Firestore (`users/{uid}` e `profiles/{uid}`).

---

## Passo 6 — Regras de Storage e Firestore (só agora)

> **Porque é que a ordem importa.** As novas regras deixam de permitir leitura
> pública de `cvUrl/` e `certificados/`. O código que já está em produção
> entrega esses ficheiros por URLs assinados gerados no servidor, que ignoram as
> regras por usarem o Admin SDK. Se aplicares as regras **antes** de o código
> estar em produção, os CV dos utilizadores reais deixam de abrir até o deploy
> do código terminar.

```bash
firebase deploy --only storage,firestore:rules --project empregostp
```

Confirma logo a seguir, com sessão iniciada em produção:

- [ ] Um candidato consegue abrir o próprio CV
- [ ] Uma empresa com plano PRO consegue abrir o CV de um candidato que partilhe contacto
- [ ] Uma empresa no plano Básico recebe a mensagem de upgrade em vez do ficheiro

---

## Passo 7 — Política de TTL da coleção `apiRateLimits`

Os limites de pedidos são guardados em Firestore. Sem uma política de TTL, a
coleção cresce indefinidamente. Não afeta o funcionamento, só o custo de
armazenamento.

```bash
gcloud firestore fields ttls update expiresAt \
  --collection-group=apiRateLimits \
  --enable-ttl \
  --project=empregostp
```

---

## Passo 8 — Smoke test final

Substitui `SEU-DOMINIO` e corre:

```bash
for p in / /vagas /empresas /candidatos /recursos /contacto /sobre-nos /login /register /termos; do
  printf "%-16s " "$p"
  curl -s -o /dev/null -w "%{http_code}\n" "https://SEU-DOMINIO$p"
done
```

Todas têm de devolver `200`.

```bash
# Rotas protegidas: têm de devolver 401 sem sessão
for p in /api/admin/users /api/notifications /api/talent-pool /api/files/candidate-cv; do
  printf "%-32s " "$p"
  curl -s -o /dev/null -w "%{http_code}\n" "https://SEU-DOMINIO$p"
done
```

```bash
# Guards de dashboard: têm de redirecionar para o login preservando o destino
curl -s -o /dev/null -w "%{redirect_url}\n" https://SEU-DOMINIO/dashboard/empresa
# esperado: .../login?redirect=%2Fdashboard%2Fempresa
```

```bash
# A página de seed tem de estar fechada
curl -s -o /dev/null -w "%{http_code}\n" https://SEU-DOMINIO/setup/seed
# esperado: 404
```

Na interface, confirma ainda:

- [ ] O rodapé e os links legais abrem
- [ ] A pesquisa de vagas devolve resultados
- [ ] O detalhe de uma vaga abre e mostra o botão de candidatura
- [ ] Em telemóvel (375px) não há barra de deslocação horizontal em nenhuma página

---

## Plano de reversão

### Reverter o deploy do código

Na Vercel → Deployments, encontra o deployment anterior e usa **Promote to
Production**. É instantâneo e não depende do Git.

### Repor as regras antigas

As versões que estavam ativas antes desta auditoria estão guardadas em
`docs/audits/rollback/2026-08-01-baseline/`:

```bash
cp docs/audits/rollback/2026-08-01-baseline/storage.rules storage.rules
cp docs/audits/rollback/2026-08-01-baseline/firestore.rules firestore.rules
firebase deploy --only storage,firestore:rules --project empregostp
```

Confere a integridade antes, se quiseres:

```bash
cd docs/audits/rollback/2026-08-01-baseline && shasum -a 256 -c SHA256SUMS && cd -
```

### Se os índices falharem

Um índice que falhe a construir não parte a aplicação: as rotas afetadas têm
recurso a ordenação em memória e continuam a responder, apenas mais devagar em
volumes grandes. Apaga o índice problemático na consola e volta a submetê-lo:

```bash
firebase deploy --only firestore:indexes --project empregostp
```

### Se precisares de restaurar dados

Existe um export completo do Firestore, feito a 2026-08-01T16:17Z:

```
gs://empregostp.firebasestorage.app/firestore-exports/full-20260801T161648Z
```

```bash
# ATENÇÃO: substitui os dados atuais. Só em caso de perda confirmada.
gcloud firestore import \
  gs://empregostp.firebasestorage.app/firestore-exports/full-20260801T161648Z \
  --project=empregostp
```

---

## Decisões de negócio que ficaram por tomar

Nenhuma bloqueia o deploy, mas todas são visíveis para os utilizadores.

| Assunto | Estado |
| --- | --- |
| **Moderação de vagas** | Implementada e desligada por omissão. Para ligar: `PUT /api/admin/moderation-settings` com `{"jobApprovalRequired": true}`, autenticado como administrador. Com ela ligada, as vagas novas ficam em revisão até aprovação. |
| **Preço do plano empresarial** | A auditoria assinalou uma diferença entre 100 e 2000 Dobras. Não foi alterado — é decisão tua. |
| **Fotografias de perfil** | Continuam com leitura pública, ao contrário dos CV. É necessário para o perfil público de candidatos funcionar sem sessão. Se preferires fechá-las, essa página tem de passar a servir as imagens por URL assinado. |
| **Nove ficheiros órfãos** | Estão sem uso no código mas têm alterações tuas por commitar, ou não estão no Git. Estão listados no relatório da auditoria, secção 4.2. |
