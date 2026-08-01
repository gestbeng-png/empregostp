# Auditoria de release — agosto de 2026

> Relatório vivo da auditoria final do EmpregoSTP.
> Início: 2026-08-01 16:46 WEST · Branch: `main` · Commit de base: `8fb3b891938b1d388bf8056c510482b46164b82c`.
> Fonte de verdade: código real do repositório. Nenhum deploy é executado durante esta missão.

## Estado executivo

| Fase                                         | Estado   | Observação                                                                                                              |
| -------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------- |
| 0 — Baseline, backup e ambiente              | QUASE    | Backup cloud verificado e desbloqueado. Contas QA continuam retidas: a chave Admin exposta é a que está ativa e ainda não foi rodada. |
| 1 — Segurança crítica                        | EM CURSO | Itens 1.3, 1.4, 1.5, 1.6 e 1.7 concluídos. Falta 1.2 (`/setup/seed`) e a rotação da chave Admin, que depende do proprietário. |
| 2 — Rotas de API                             | EM CURSO | Veredicto de auth das 71 rotas concluído em 1.7; falta a passagem funcional grupo a grupo.                              |
| 3 — Páginas e dashboards                     | PENDENTE | Ainda não iniciada.                                                                                                     |
| 4 — Purga de legado                          | PENDENTE | Ainda não iniciada.                                                                                                     |
| 5 — UX, visual, performance e acessibilidade | PENDENTE | Ainda não iniciada.                                                                                                     |
| 6 — Validação e pacote de deploy             | PENDENTE | Ainda não iniciada.                                                                                                     |

Nenhuma conta, documento, ficheiro, email, push, broadcast, configuração cloud, rule, índice ou deploy remoto foi criado, alterado ou eliminado nesta fase.

## Fase 0 — Baseline, backup e ambiente

### Checklist

| Item                                                 | Estado        | Evidência / decisão                                                                                                                                         |
| ---------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ler `docs/audits/` e auditoria técnica de 2026-08-01 | OK            | `frontend-audit.md`, `final-validation-checklist.md` e `AUDITORIA-PROJETO.md` lidos integralmente. Achados históricos serão sempre reconfirmados no código. |
| Preservar worktree existente                         | OK            | O branch já tinha 150 ficheiros tracked modificados e muitos caminhos untracked; nenhuma alteração preexistente foi revertida.                              |
| `npm ci`                                             | OK com avisos | Instalação literal concluída com 1.441 packages. Cinco avisos de pacotes transitivos obsoletos registados abaixo.                                           |
| `npm run typecheck`                                  | OK            | `tsc --noEmit`, exit code 0.                                                                                                                                |
| `npm run lint`                                       | OK            | `eslint .`, exit code 0 e sem warnings.                                                                                                                     |
| `npm run test`                                       | OK            | 35 suites, 136 testes, 0 falhas, 0 snapshots.                                                                                                               |
| `npm run quality` após instalação limpa              | OK            | Typecheck + lint + 35/35 suites e 136/136 testes, exit code 0.                                                                                              |
| Inventário Playwright sem executar E2E               | OK            | `npx playwright test --list`: 100 casos em 26 ficheiros, dois projetos (desktop e mobile).                                                                  |
| Backup cloud do Firestore                            | **CONCLUÍDO** | Export do proprietário verificado por mim: operação `SUCCESSFUL`, destino `gs://empregostp.firebasestorage.app/firestore-exports/full-20260801T161648Z`, 15 objetos / 2,24 MiB, terminado 2026-08-01T16:17:10Z. |
| Snapshot local de rules e índices                    | OK            | Guardado em `docs/audits/rollback/2026-08-01-baseline/`, com manifesto SHA-256.                                                                             |
| Estratégia sem emulador                              | DOCUMENTADO   | Unitários com mocks; rules por revisão + smoke QA; E2E online só após adaptação segura.                                                                     |
| Contas `qa-`                                         | BLOQUEADO     | O backup já não bloqueia, mas a chave Admin exposta continua ativa (ver abaixo). Não crio dados reais enquanto uma credencial de acesso total estiver comprometida. |
| `.env` e credenciais ignorados                       | PARCIAL       | `.env.local` e ficheiros conhecidos estão ignorados, mas a cobertura genérica ainda tem lacunas.                                                            |
| Segredos no histórico recente                        | **FALHA CRÍTICA CONFIRMADA** | A chave exposta **é a chave atualmente ativa** — provado por comparação de impressão digital da chave pública. Ver secção dedicada abaixo. |

### Baseline Git

- Branch `main`, sincronizado com `origin/main` no início (`0` ahead / `0` behind).
- Commit inicial: `8fb3b89` (`Fix admin CSS build issue and production Firebase job loading`).
- Antes desta auditoria já existiam 150 ficheiros tracked modificados, com aproximadamente 64.127 inserções e 28.587 remoções, além de muitos caminhos untracked.
- Essas mudanças são tratadas como baseline do utilizador. Commits só serão criados com staging explícito de ficheiros comprovadamente pertencentes a um item da auditoria.
- Não se executam `deploy.sh`, `npm run deploy`, `npm run deploy:msg` nem qualquer script que faça `git add .`, push ou deploy implícito.

### Ambiente e dependências

| Componente                   | Valor observado |
| ---------------------------- | --------------- |
| Node                         | `v22.11.0`      |
| npm                          | `10.9.0`        |
| Next.js                      | `16.2.10`       |
| Firebase Tools após `npm ci` | `15.23.0`       |
| Projeto Firebase configurado | `empregostp`    |

Inconsistência a resolver: `package.json` declara Node `>=22.11.0`, o root de `package-lock.json` declara `>=22.12.0` e `.nvmrc` declara apenas `22`. O ambiente atual cumpre `package.json`, mas não o lock. Alinhar para uma versão exata antes da validação final.

Avisos do `npm ci`, todos transitivos:

| Pacote                          | Cadeia observada                            |
| ------------------------------- | ------------------------------------------- |
| `inflight@1.0.6` / `glob@7.2.3` | Jest → Istanbul → `test-exclude`            |
| `whatwg-encoding@3.1.1`         | Jest jsdom                                  |
| `node-domexception@1.0.0`       | Firebase Admin → Google Auth → `node-fetch` |
| `uuid@9.0.1`                    | Firebase Admin / Google Cloud clients       |

`npm ls --depth=0` também reporta cinco módulos WASM opcionais como `extraneous` (`@emnapi/*`, `@napi-rs/wasm-runtime`, `@tybys/wasm-util`). Não bloquearam a suite, mas entram na revisão de dependências da Fase 4.

### Estratégia de testes sem emulador

#### Unitários

- `npm test` executa apenas `tests/unit/**/*.test.{ts,tsx}`.
- Firebase Admin, Auth, Firestore, Storage e chamadas HTTP relevantes estão mockados/falsificados.
- É a suite segura e autoritativa para correções de backend sem tocar no projeto real.
- A configuração de cobertura atual mede essencialmente as pastas TypeScript de Clean Architecture; não representa a cobertura global de `pages/`, `lib/` e `components/` JavaScript.

#### Integração e rules

- `npm run test:integration` chama `firebase emulators:exec --only firestore` e limpa integralmente o Firestore do emulador antes de cada teste.
- `npm run test:rules` depende de `@firebase/rules-unit-testing` e do Firestore Emulator.
- Não foram executados, conforme a proibição de forçar emuladores.
- A cobertura de rules existente é insuficiente: apenas três casos sobre `profiles`; não cobre as outras coleções nem `storage.rules`.
- Até autorização expressa para emulador, a validação será: revisão linha a linha documentada + smoke tests autenticados contra o projeto online, exclusivamente com entidades `qa-` e operações negativas controladas.

#### E2E

O comando E2E atual não é seguro nem coerente com a nova estratégia:

- `npm run test:e2e` injeta hosts locais `9099`/`8080`, mas não inicia emuladores.
- `reuseExistingServer: true` pode reutilizar por engano um servidor na porta 3100 ligado ao Firebase real.
- `E2E_BASE_URL` desliga o servidor gerido e pode permitir jornadas autenticadas contra um destino remoto.
- Os fixtures usam emails `*.e2e@empregostp.test`, não `qa-*`, e não definem `isTestAccount: true`.
- Não existe `globalTeardown` online UID-a-UID.
- O script de emuladores inicia Auth e Firestore, mas não Storage; uploads poderiam alcançar o bucket real.

Antes de executar E2E online, separar explicitamente os modos online/emulador, desativar reutilização de servidor, exigir contas `qa-`, seed estritamente identificado, proteção de Storage e teardown garantido por spec. Até lá, a única operação Playwright autorizada foi `--list`.

### Backup e rollback

#### Snapshot local concluído

As versões do worktree no início da auditoria foram guardadas em:

- `docs/audits/rollback/2026-08-01-baseline/firestore.rules`
- `docs/audits/rollback/2026-08-01-baseline/storage.rules`
- `docs/audits/rollback/2026-08-01-baseline/firestore.indexes.json`
- `docs/audits/rollback/2026-08-01-baseline/SHA256SUMS`

Hashes dos ficheiros de origem auditados:

```text
338bd6609c269b9bb7ac36a8485eadfa3af0cc1ef2c8cbd550882fb0dc736b18  firestore.rules
91582bf7fc258bc427e07c62d5f1c43251cb138a3619b4fb626c73cd198295e3  storage.rules
d0804df723fb5acc1cec98d0bdb43ddc5f0d1ce5c1c1e793764425ca4e4a4950  firestore.indexes.json
```

As rules/índices do repositório estavam tracked e sem diff no início. Isso não prova que sejam byte a byte iguais às versões atualmente publicadas; a consola Firebase deve ser usada para guardar também as versões efetivamente ativas.

#### Export cloud pendente

O projeto local não tem `gcloud`, `gsutil`, configuração gcloud, ADC nem bucket dedicado de backup confirmado. O bucket de aplicação conhecido (`empregostp.firebasestorage.app`) não será assumido como destino sem confirmar localização, tipo, IAM e política de acesso.

Preflight recomendado no Cloud Shell do projeto:

```bash
PROJECT_ID='empregostp'
DATABASE_ID='(default)'
BACKUP_BUCKET='gs://NOME_DO_BUCKET_CONFIRMADO'

gcloud auth list --filter='status:ACTIVE'
gcloud projects describe "$PROJECT_ID"
gcloud firestore databases describe \
  --project="$PROJECT_ID" \
  --database="$DATABASE_ID"
gcloud storage buckets describe "$BACKUP_BUCKET" \
  --project="$PROJECT_ID"
```

Confirmar billing/Blaze, bucket privado não-Requester-Pays e não-Rapid próximo da localização do Firestore, permissões de Import/Export e acesso do Firestore service agent ao bucket. A referência oficial é: <https://docs.cloud.google.com/firestore/native/docs/manage-data/export-import>.

Export completo recomendado, sem `--async`:

```bash
PROJECT_ID='empregostp'
DATABASE_ID='(default)'
BACKUP_BUCKET='gs://NOME_DO_BUCKET_CONFIRMADO'
BACKUP_PREFIX="pre-release/$(date -u +%Y%m%dT%H%M%SZ)"

gcloud firestore export "${BACKUP_BUCKET}/${BACKUP_PREFIX}" \
  --project="$PROJECT_ID" \
  --database="$DATABASE_ID"
```

Alternativa pela consola: Google Cloud → Firestore → Databases → selecionar `(default)` → Import/Export → Export → `Export entire database` → escolher o bucket confirmado → Export. Só marcar este item como concluído quando o job apresentar sucesso e o destino contiver o respetivo ficheiro de metadata.

Até essa confirmação, não criar contas QA nem alterar quaisquer dados reais.

### Segurança de credenciais

#### Achado crítico: chave Admin versionada

Foi encontrada uma chave privada Firebase Admin completa, real e não-placeholder em:

- `VERCEL-DEPLOY-GUIDE.md` (por volta da linha 236);
- `VERCEL-ENV-SETUP.txt` (por volta da linha 47).

As duas ocorrências contêm o mesmo segredo e existem em todos os quatro commits, desde `dc9b8ea` até ao `HEAD` inicial `8fb3b89`. O valor nunca é reproduzido neste relatório. A chave local atual é diferente, mas isso não comprova revogação da chave exposta.

Ações obrigatórias:

1. Revogar/eliminar imediatamente a chave exposta na service account; se não for possível identificá-la inequivocamente, rodar todas as chaves dessa identidade.
2. Confirmar que Vercel e `.env.local` usam exclusivamente a nova chave.
3. Auditar Cloud Audit Logs desde 2026-04-25 para atividade anómala da identidade.
4. Substituir os valores reais nos dois documentos por placeholders. **Concluído no worktree atual.**
5. Só com aprovação explícita, sanear todo o histórico com `git filter-repo` e force-push coordenado de branches/tags. Rotação continua obrigatória porque clones, forks e caches podem preservar o valor.
6. Repetir a varredura de segredos no histórico completo.

Estado do restante ambiente:

- `.env.local` existe, tem permissões restritas, está ignorado e não está tracked.
- Credenciais Admin e Gmail atuais encontradas em `.env.local` não foram observadas no histórico desta varredura.
- `vercel-env-vars.env`, `ADMIN-CREDENTIALS.txt`, `*.env`, `.env`, `.env*.local`, `.env.production` e o caminho específico das credenciais Admin estão ignorados.
- A cobertura ainda deve incluir `.env.development`, `.env.test`, `.env.staging`, nomes genéricos de service account e extensões `*.key`, `*.p12`, `*.pfx`, mantendo exceções para exemplos seguros.
- A Firebase Web API key repetida no cliente e documentação é configuração pública, mas os fallbacks versionados serão removidos na Fase 1.
- `test-verifications.js` é um script manual fora do Jest que chama API administrativa real e imprime PII; está proibido no baseline e entra na triagem de segurança/purga.

### Verificação da Fase 0 (2026-08-01, sessão 2)

#### Backup — desbloqueado

O proprietário executou o export. Verifiquei-o diretamente com `gcloud`, sem alterar nada:

| Verificação | Resultado |
| --- | --- |
| Operação Firestore | `SUCCESSFUL` |
| Destino | `gs://empregostp.firebasestorage.app/firestore-exports/full-20260801T161648Z` |
| Conteúdo | 15 objetos, 2,24 MiB, mais `overall_export_metadata` |
| Fim | 2026-08-01T16:17:10Z |

Ressalva sem gravidade: o export ficou no mesmo bucket que a aplicação usa para uploads de utilizadores. Não está exposto aos utilizadores — a regra final de `storage.rules` é `allow read, write: if false` e o acesso ao export faz-se por IAM, não pelo SDK cliente. Ainda assim, um bucket dedicado reduziria o raio de impacto de uma má configuração futura. Fica como sugestão, não como bloqueio.

#### Chave Admin — a exposta é a que está ativa

Comparei a impressão digital SHA-256 da **chave pública** derivada do PEM em `.env.local` com a dos PEM presentes no histórico Git. Nenhum material privado foi impresso, gravado ou transmitido.

| Origem | Impressão digital (SHA-256 da chave pública, 128 bits) |
| --- | --- |
| `.env.local` (chave em uso) | `940e5887f58b7cc59e653b65faf96b3d` |
| `dc9b8ea:VERCEL-DEPLOY-GUIDE.md` e mais 7 ocorrências | `940e5887f58b7cc59e653b65faf96b3d` |

**São a mesma chave.** A rotação não foi feita.

Confirmações adicionais:

- A service account `firebase-adminsdk-fbsvc@empregostp.iam.gserviceaccount.com` tem **uma única** chave gerida pelo utilizador, criada a 2025-07-03T21:35:10Z — anterior ao primeiro commit do repositório.
- Os commits que a contêm (`dc9b8ea` a `8fb3b89`) estão publicados em `origin/main`.
- O repositório `Edmirsantos/EmpregoSTP-white` responde 404 à API anónima do GitHub, ou seja, **é privado**. Isto reduz muito o alcance, mas não elimina o risco: qualquer colaborador, clone anterior, fork interno ou integração de CI com acesso ao repositório tem uma credencial que ignora todas as `firestore.rules` e `storage.rules` e dá leitura e escrita totais sobre Firestore, Auth e Storage.
- No `HEAD` atual os dois ficheiros já só têm placeholders; o problema é exclusivamente o histórico.

Não rodei a chave. Criar a nova e apagar a antiga derruba a aplicação em produção no instante em que a antiga for revogada, até as variáveis na Vercel serem atualizadas — é uma operação coordenada que tem de ser do proprietário. Sequência recomendada, sem tempo de indisponibilidade:

```bash
# 1. Criar a nova chave (a antiga continua válida)
gcloud iam service-accounts keys create ~/nova-chave-admin.json \
  --iam-account=firebase-adminsdk-fbsvc@empregostp.iam.gserviceaccount.com \
  --project=empregostp
```

Depois, na Vercel, atualizar `FIREBASE_PRIVATE_KEY` e `FIREBASE_CLIENT_EMAIL` com os valores da nova chave e fazer redeploy. Confirmar que a aplicação em produção funciona (login e uma escrita qualquer). Atualizar também o `.env.local` local. **Só então** revogar a antiga:

```bash
# 2. Só depois de produção confirmada com a nova chave
gcloud iam service-accounts keys delete 4e1b5e73f2c296b690ca8fb46cffdf33621127bf \
  --iam-account=firebase-adminsdk-fbsvc@empregostp.iam.gserviceaccount.com \
  --project=empregostp
```

```bash
# 3. Auditar uso anómalo da identidade desde a data do primeiro commit
gcloud logging read \
  'protoPayload.authenticationInfo.principalEmail="firebase-adminsdk-fbsvc@empregostp.iam.gserviceaccount.com"' \
  --project=empregostp --freshness=90d --limit=50 \
  --format='table(timestamp,protoPayload.methodName,protoPayload.requestMetadata.callerIp)'
```

Apagar o ficheiro `~/nova-chave-admin.json` depois de o valor estar na Vercel e no `.env.local`.

O saneamento do histórico com `git filter-repo` continua a precisar de autorização explícita e de force-push coordenado. **A rotação é obrigatória independentemente disso**, porque clones e caches anteriores preservam o valor.

Enquanto a chave ativa for a chave exposta, não crio contas `qa-` nem qualquer dado no Firebase real: não faz sentido introduzir dados de teste num projeto cuja credencial de administração está comprometida.

### Riscos adicionais transportados para fases seguintes

- `storage.rules` permite leitura pública de CVs, fotografias e certificados.
- `firestore.rules` permite ler qualquer documento de `jobs`, o que exporia também estados não publicados quando a moderação for ativada.
- `resources_premium` tem leitura pública direta.
- Algumas coleções permitem escrita direta pelo cliente admin, em tensão com a política servidor-autoritativo.
- `firestore.indexes.json` contém apenas um índice composto e é insuficiente para as queries reais.
- `scripts/create-firestore-index.js` faz deploy; não é uma ferramenta local de análise.
- `scripts/generate-env.mjs` sobrescreve `.env.local` e materializa a private key noutro ficheiro plaintext.
- `deploy.sh` faz staging, commit e push para `main`, com potencial de disparar deploy automático.

### Gate para concluir a Fase 0

São necessárias duas confirmações externas antes de avançar para operações com o Firebase real:

1. localização/prefixo do export Firestore concluído com sucesso;
2. rotação/revogação da chave Admin exposta.

Depois dessas confirmações, criar as contas `qa-` uma a uma, registar os UIDs e preparar a limpeza UID-a-UID. Nenhum broadcast, `notify-candidates` real ou operação em massa será executado.

## Fase 1 — Segurança crítica

### Contenção de chave Firebase Admin no `HEAD`

| Item                             | Estado           | Ficheiros / evidência                                                                                                                            |
| -------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Teste de regressão para PEM real | CORRIGIDO        | `tests/unit/security/trackedSecrets.test.ts`; falhou primeiro apontando exclusivamente os dois documentos comprometidos e passou após a redação. |
| Segredo nos documentos atuais    | CORRIGIDO        | `VERCEL-DEPLOY-GUIDE.md` e `VERCEL-ENV-SETUP.txt` usam apenas placeholders e instruções para configurar diretamente na Vercel.                   |
| Cobertura de `.gitignore`        | MELHORADO        | `.env.*`, formatos de service account e extensões `*.key`, `*.p12`, `*.pfx`, preservando `.env.example` e variantes de exemplo.                  |
| Chave no histórico Git           | PENDENTE CRÍTICO | Mantida no histórico anterior por decisão explícita de não fazer `filter-repo`/force-push sem autorização.                                       |
| Rotação/revogação cloud          | PENDENTE CRÍTICO | Depende de confirmação do proprietário na consola Google Cloud.                                                                                  |

Validação do item: `npm run quality` aprovado com 36 suites e 138 testes. Nenhum valor de segredo foi reproduzido em testes, relatório ou logs da auditoria.

### Remoção de endpoints internos do artefacto de produção

| Item                        | Estado    | Prova / decisão                                                                                                                                                                                                                                  |
| --------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pages/api/create-admin.js` | REMOVIDO  | Zero consumidores após pesquisa por imports e strings de rota. A flag era a única autorização: se ativada, qualquer cliente anónimo podia criar um administrador. A operação local `scripts/createAdmin.mjs` permanece como alternativa a rever. |
| `pages/api/debug-user.js`   | REMOVIDO  | Zero consumidores. Apesar de validar admin, devolvia documentos completos de utilizador, perfil e subscrição, criando exposição desnecessária de PII.                                                                                            |
| Regressão estática          | CORRIGIDO | `tests/unit/security/internalToolsRemoval.test.ts` falhou com as duas rotas presentes e passou após a remoção.                                                                                                                                   |
| `/setup/seed`               | PENDENTE  | Não removido: a página, CSS e testes contêm alterações preexistentes não commitadas do utilizador. O estado atual mantém flag e guard admin; a decisão de purga será isolada sem descartar esse trabalho.                                        |

Não foi feita qualquer chamada às rotas nem ao Firebase. A documentação técnica histórica continua a mencioná-las como fotografia do estado anterior; será marcada/arquivada na fase de documentação legada.

Validação do item: `npm run quality` aprovado com 37 suites e 139 testes.

### Configuração Firebase sem fallbacks versionados

| Item                                           | Estado            | Ficheiros / evidência                                                                                                                                                                                                                                          |
| ---------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Configuração do cliente                        | CORRIGIDO         | `lib/firebase.js` usa referências diretas às sete `NEXT_PUBLIC_FIREBASE_*` e `lib/firebaseClientConfig.js` falha com a lista ordenada de variáveis ausentes, sem expor valores. O suporte a emuladores já existente no worktree foi preservado fora do commit. |
| Configuração de FCM no service worker          | CORRIGIDO         | `public/sw.js` importa `/firebase-sw-config.js`; `scripts/generate-firebase-sw-config.mjs` gera o ficheiro de forma atómica a partir das env em `predev`/`prebuild`. O artefacto é ignorado pelo Git.                                                          |
| Fonte única do contrato                        | MELHORADO         | `shared/firebase-client-env.json` define a ordem e o mapeamento das sete variáveis para cliente e gerador.                                                                                                                                                     |
| Testes                                         | CORRIGIDO         | Cobrem valores válidos, ausentes/whitespace, mensagens sem valores, bootstrap antes do SDK, reutilização da app, JavaScript gerado válido e ausência de ficheiro parcial.                                                                                      |
| Código inline remanescente em `lib/`/`public/` | OK                | Varredura por chaves Firebase Web e `firebase.initializeApp({` não encontrou ocorrências, excluindo apenas o artefacto gerado e ignorado.                                                                                                                      |
| `scripts/generate-env.mjs`                     | PENDENTE DE PURGA | Continua a materializar credenciais em plaintext e depende dos antigos fallbacks; não foi executado. Será removido com `gen:env` após prova documental completa.                                                                                               |

Validação do item: `npm run quality` aprovado com 40 suites e 148 testes; `npm run build` concluído com sucesso e geração de 27 páginas estáticas. O build mantém avisos transitivos de `punycode` já registados no baseline.

### Redação de erros no fluxo de comprovativos e push

| Item                                      | Estado    | Ficheiros / evidência                                                                                                                                                                                                                                        |
| ----------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Metadados seguros de erro                 | CORRIGIDO | `lib/serverLog.js` classifica apenas a família do erro e valida o identificador fixo do evento. Mensagem, stack, causa, headers, resposta, payload e propriedades arbitrárias nunca entram no log.                                                           |
| Erro inesperado do comprovativo           | CORRIGIDO | `pages/api/subscription-requests/[id]/payment-proof.js` deixa de registar o `Error` bruto e devolve `Erro interno do servidor`; erros de domínio e validação são mapeados para mensagens constantes e erros Storage conhecidos mantêm respostas controladas. |
| Limpeza de upload concorrente no worktree | MELHORADO | O `cleanupError` da alteração preexistente passa por `logServerWarning`. Como a função de cleanup pertence a trabalho não commitado do utilizador, esta linha permanece nesse diff e não é apropriada pelo commit de logging.                                |
| Entrega push / FCM                        | CORRIGIDO | `lib/serverNotifications.js` já não persiste `result.error.message`, não regista o erro FCM bruto e não devolve `error.message`; conserva apenas a categoria segura (`messaging`, `storage`, etc.).                                                          |
| Testes com canários                       | CORRIGIDO | `serverLog.test.ts`, `serverNotificationsLogging.test.ts` e `paymentProofLogging.test.ts` colocam email, token, Authorization e Base64 em erros aninhados e provam a ausência desses valores em logs, Firestore simulado e resposta HTTP.                    |
| Logs crus restantes                       | CORRIGIDO | Todas migradas — ver item 1.3 concluído abaixo. Zero `console.*` em `pages/api` fora da allowlist dos crons, fixado por teste estático.                                                                                                                     |
| `proofUrl` fornecido pelo cliente         | CORRIGIDO | A rota rejeita a presença de `proofUrl` e exige upload Base64 processado pelo servidor. O único consumidor interno já usava esse contrato; URLs HTTPS, `data:` e Firebase falsas são cobertas por regressão.                                                 |
| Tipos e bytes do comprovativo             | CORRIGIDO | `lib/paymentProofFile.js` aceita apenas PDF/JPEG/PNG, valida Base64 estrito, MIME declarado/Data URL, assinatura binária e tamanho descodificado; extensão, MIME e tamanho persistidos são derivados no servidor.                                            |

Validação do item: falha inicial comprovou o `Error` bruto no log e a mensagem privada no 500; testes dirigidos aprovados (14/14), `npm run quality` aprovado com 43 suites e 162 testes e `npm run build` concluído com 27 páginas estáticas. Permanecem apenas os avisos transitivos de `punycode` do baseline. Nenhuma chamada ao Firebase online foi efetuada.

### Contrato seguro do comprovativo de pagamento

| Item                                  | Estado           | Ficheiros / evidência                                                                                                                                                                                                                      |
| ------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Bypass por URL fornecida pelo cliente | CORRIGIDO        | `payment-proof.js` rejeita qualquer propriedade `proofUrl` antes de consultar o Firestore. O servidor aceita apenas `fileBase64`; não há compatibilidade insegura para links externos ou Firebase forjados.                                |
| Validação do ficheiro                 | CORRIGIDO        | `paymentProofFile.js` prova tipo por assinatura (`%PDF-`, JPEG `FF D8 FF`, PNG), exige MIME coerente, Base64 canónico e máximo real de 10 MiB. SVG, GIF, WebP, HTML disfarçado e divergências MIME são rejeitados.                         |
| Metadados e nome                      | CORRIGIDO        | Extensão, MIME e tamanho vêm dos bytes; o nome é sanitizado e limitado. Upload primário e fallback usam `Content-Disposition: attachment`, cache privado e token de download gerado no servidor.                                           |
| Testes                                | CORRIGIDO        | `paymentProofFile.test.ts` cobre tipos válidos e inválidos, bytes, MIME, Base64, tamanho e nome; `paymentProofContract.test.ts` reproduz o bypass e verifica o payload Firestore/Storage derivado, ignorando `size` e extensão do cliente. |
| URL Firebase persistida com token     | PENDENTE CRÍTICO | O fluxo ainda guarda um bearer link de longa duração. A migração para `storagePath` + rota autorizada/URL assinada curta integra a restrição de Storage da Fase 1.4 e exige atualização coordenada dos leitores.                           |

Validação do item: testes vermelhos provaram o bypass por três classes de URL e a ausência de `Content-Disposition`; testes dirigidos aprovados (20/20), `npm run quality` aprovado com 48 suites e 196 testes e `npm run build` concluído com 27 páginas estáticas. Nenhuma chamada ao Firebase online foi efetuada.

### Rota de subscrições push

| Item                                | Estado    | Ficheiros / evidência                                                                                                                                                                                                       |
| ----------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Falha de autenticação/Firestore/FCM | CORRIGIDO | `pages/api/push-subscriptions/index.js` usa `logServerError` e conserva apenas a categoria do erro; token FCM, bearer, email e objetos internos não chegam ao console.                                                      |
| Autorização do `DELETE`             | CORRIGIDO | A remoção lê e apaga o documento na mesma transação, devolve 403 para outro proprietário e é idempotente quando o documento não existe.                                                                                     |
| Reatribuição no `POST`              | CORRIGIDO | A escrita transacional só cria ou renova o token do mesmo UID; um token já associado a outra conta devolve 409 sem escrita. `createdAt` deixa de ser sobrescrito nas renovações.                                            |
| Validação e métodos                 | CORRIGIDO | Token é string não vazia, sem whitespace e com máximo de 4096 caracteres; permissão tem allowlist; user agent tem máximo de 512. Métodos fora de POST/DELETE recebem 405 e `Allow`; bearer inválido/expirado recebe 401.    |
| Regressões de segurança             | CORRIGIDO | `pushSubscriptionsAuthorization.test.ts` cobre IDOR, proprietário, idempotência, conflito, datas, corpos inválidos, autenticação e método; `pushSubscriptionsLogging.test.ts` usa falha Firestore com token/email canários. |
| Logout perante falha do `DELETE`    | CORRIGIDO | `lib/webPushClient.js` só remove o token local com confirmação do servidor (2xx ou 403); falha de rede/servidor ou sessão expirada mantêm o token para retry. 5 casos em `webPushClientUnregister.test.ts` (3 vermelhos antes do fix). Commit `9119790`. |

Validação do item: os testes falharam primeiro com 12 violações reproduzidas; testes dirigidos aprovados (15/15), `npm run quality` aprovado com 46 suites e 178 testes e `npm run build` concluído com 27 páginas estáticas. Nenhuma chamada ao Firebase online foi efetuada.

### Log da rota de upload de CV

| Item                          | Estado    | Ficheiros / evidência                                                                                                                                                                                                                    |
| ----------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Erro bruto com dados pessoais | CORRIGIDO | `pages/api/profile/upload-cv.js` usa `logServerError('profile.cv_upload_failed', error)`; mensagens, email, URL/token de download, nome e conteúdo Base64 do CV não entram no console.                                                   |
| Regressão com dados-canário   | CORRIGIDO | `tests/unit/security/profileCvLogging.test.ts` falhou primeiro ao receber o `Error` completo e passa exigindo apenas `{ category: 'authentication' }`, além da resposta 500 genérica já existente.                                       |
| Minimização da resposta 200   | PENDENTE  | A rota ainda espalha todo o documento de perfil na resposta. O único consumidor substitui o perfil local inteiro e contém alterações preexistentes; reduzir para `cvUrl`/`cvName` requer contrato e merge do estado num commit separado. |

Validação do item: `npm run quality` aprovado com 45 suites e 164 testes. Nenhuma chamada ao Firebase online foi efetuada.

### Logs da rota de subscrição de planos

| Item                                 | Estado        | Ficheiros / evidência                                                                                                                                                                                                                                                   |
| ------------------------------------ | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Erro e stack na resposta/log         | CORRIGIDO     | `pages/api/subscribe-plan.js` usa `logServerError('subscription.request_failed', error)` e devolve apenas mensagem 500 constante; stack, bearer, email, conta bancária, payload e mensagem interna deixam de sair.                                                      |
| Falha ao ler definições de pagamento | CORRIGIDO     | A degradação graciosa permanece, mas o erro bruto foi substituído por `logServerWarning('subscription.payment_settings_lookup_failed', err)`.                                                                                                                           |
| Log de sucesso                       | REMOVIDO      | O `console.log` de debug não acrescentava observabilidade acionável e foi eliminado. A rota não contém chamadas diretas a `console.*`.                                                                                                                                  |
| Regressão com dados-canário          | CORRIGIDO     | `tests/unit/security/subscribePlanLogging.test.ts` falhou primeiro com erro e stack crus e passa verificando metadados classificados, resposta genérica e ausência estática de console direto.                                                                          |
| Ativação gratuita Básica             | CORRIGIDO     | O helper empresarial passou a ser importado e o contrato cobre `basic_empresa`, o alias `company` e `basic_candidato`. Um plano pago expirado transita para Básico com os IDs e direitos coerentes, sem tocar no Firebase real.                                         |
| Alias de tipo de utilizador          | CORRIGIDO     | A atualização transacional usa `normalizedUserType`, em vez do valor bruto. O alias suportado `company` deixa de gravar `currentPlan`/`planTierId` nulos e passa a receber os mesmos direitos de `empresa`; ambos os contratos são cobertos pelo teste parametrizado.   |
| Estado do pedido Básico              | CORRIGIDO     | A autoaprovação grava `status: approved`, `paymentStatus: not_required`, `autoApproved`, `processedAt` e `approvedDate` no mesmo timestamp de criação. O pedido deixa de reaparecer como aberto e não aceita comprovativo.                                              |
| Expiração e espelho do plano Básico  | CORRIGIDO     | `users/{uid}` limpa `planEndDate`/`planActivationVersion` e `subscriptions/{uid}` é sincronizado na mesma transação com `endDate`/`activationVersion` nulos, estado ativo e direitos do tipo. Não é criada tarefa de expiração.                                         |
| Repetição do plano Básico            | CORRIGIDO     | Se o tier Básico pedido já é o tier atual normalizado, a rota devolve 200/`approved` sem transação, novo pedido, notificação ou alteração de timestamps.                                                                                                                |
| Tier não Básico a preço zero         | CORRIGIDO     | Ativação gratuita de tier com prazo recebe `activationVersion` (utilizador + espelho `subscriptions`) e tarefa `REVERT_TO_BASIC_PLAN` com id determinístico na mesma transação — o cron consegue revertê-la como qualquer ativação paga. Commit `1a655a9`.            |
| Normalização de preço e duração      | CORRIGIDO     | `normalizePlanPrice`/`normalizePlanDurationDays` em `lib/subscriptionLifecycle.js` são a única fonte: strings numéricas aceites, duração ausente = 30 dias em todos os campos, valores inválidos devolvem 400 + `subscription.plan_config_invalid` sem qualquer escrita. Todas as decisões derivam de um único `isFreePlan`. 9 casos vermelho→verde em `SubscribePlanPricingNormalization.test.ts`. Commit `1a655a9`. |
| Rate limiter em memória              | CORRIGIDO     | Migrada para o guard Firestore com scope `subscribe_plan` e 10 pedidos/minuto preservados (ver item 1.6 concluído abaixo). |

Validação do item: testes dirigidos aprovados (2/2) e `npm run quality` aprovado com 49 suites e 198 testes. Nenhuma chamada ao Firebase online foi efetuada.

Validação da ativação gratuita: os dois cenários funcionais falharam primeiro — `empresa` com 500 e `company` com direitos nulos — e passaram após a correção (2/2). O conjunto combinado da rota passou (4/4) e `npm run quality` foi aprovado com 50 suites e 200 testes. Nenhuma chamada ao Firebase online foi efetuada.

Validação do lifecycle Básico: os testes falharam primeiro por validade indevida, pedido repetido mutante, estado não terminal e espelho ausente; passam para empresa, alias, candidato e retry idempotente (4/4). O conjunto dirigido da rota passou (6/6) e `npm run quality` foi aprovado com 50 suites e 202 testes. Nenhuma chamada ao Firebase online foi efetuada.

### Item 1.6 (preparação) — correção do limitador Firestore persistente

| Item                              | Estado    | Ficheiros / evidência                                                                                                                                                                                                                                    |
| ---------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Colisão de ids de documento        | CORRIGIDO | `lib/firestoreRateLimit.js` deixou de derivar o id do documento colapsando todo carácter fora de `[a-zA-Z0-9_-]` para `_` (não injetivo — `newsletter:1.2.3.4` e `newsletter_1_2_3_4` resolviam ao mesmo documento, partilhando orçamento entre clientes distintos). O id passa a incluir um sufixo SHA-256 da chave completa, garantindo unicidade prática; o prefixo legível é mantido só para inspeção manual na consola. |
| TTL inoperante                     | CORRIGIDO | O campo de expiração era gravado como número (`expiresAtMs`); uma política de TTL do Firestore só apaga documentos cujo campo alvo é do tipo `Timestamp`, pelo que a coleção `apiRateLimits` cresceria indefinidamente mesmo com a política configurada na consola. Passou a `expiresAt`, um `Timestamp` real (`firebase-admin/firestore`). |
| Regressão com canário de colisão   | CORRIGIDO | `tests/unit/api/firestoreRateLimit.test.ts` ganhou dois casos: um que falhava antes da correção provando a colisão entre chaves distintas, e outro que falhava provando que o campo persistido não tinha `.toMillis()`. Ambos passam agora; o caso pré-existente de janela/limite continua verde. |
| Migração das 7 rotas consumidoras  | CORRIGIDO | Todas as 7 rotas migradas para o guard Firestore (ver item 1.6 concluído abaixo). |
| Política de TTL no Firestore       | PENDENTE (requer deploy) | Configurar a política de TTL no campo `apiRateLimits.expiresAt` é uma ação na consola/`gcloud`, fora do alcance desta preparação de código; entra no `DEPLOY-GUIDE.md` da Fase 6. Até lá, a coleção não é limpa automaticamente — sem impacto funcional, só custo de armazenamento a médio prazo. |

Validação do item: teste dirigido vermelho→verde (2 casos novos falharam antes da correção e passaram depois; caso pré-existente manteve-se verde), `npm run quality` aprovado com 50 suites e 204 testes, `npm run build` concluído com sucesso. Nenhuma chamada ao Firebase online foi efetuada.

### Item 1.6 (concluído) — migração das rotas para o limitador Firestore e purga do limitador em memória

| Item                                   | Estado    | Ficheiros / evidência                                                                                                                                                                                                                                                            |
| -------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guard partilhado de rate limit         | CRIADO    | `lib/apiRateLimit.js`: `enforceApiRateLimit` compõe a chave `scope_ip`, delega no limitador transacional, expõe `X-RateLimit-Remaining`/`Retry-After` e responde 429 em português. Falha aberto com `logServerWarning('rate_limit.check_failed')` — o limitador é proteção, não autorização; uma indisponibilidade do Firestore não bloqueia registo/contacto. `getClientIp` passa a fonte única (remove 4 cópias duplicadas da função). Commit `d2bd28d`. |
| Migração das 7 rotas                   | CORRIGIDO | `auth/register` (5/min), `contact` (5/min), `newsletter/subscribe` (5/min), `testimonials` (3/min, mensagem própria preservada), `job-alerts` (3/min), `notifications` (30/min) e `subscribe-plan` (10/min). Limites e ordem das verificações preservados; as duas rotas que usavam `rateLimitMiddleware` deixam de responder 429 em inglês. Commit `520ad74`. |
| Regressão de scopes e limites          | CORRIGIDO | `tests/unit/api/rateLimitedRoutesMigration.test.ts` fixa o scope e o limite de cada rota e prova que o 429 pára o handler antes de tocar em auth/Firestore. `apiRateLimitGuard.test.ts` cobre chave, cabeçalhos, mensagem por rota, janela custom e fail-open com erro-canário (vermelho→verde). |
| Purga de `lib/rateLimit.js`            | REMOVIDO  | Grep exaustivo por imports, requires e nomes exportados: zero consumidores. `npm run quality` (52 suites / 220 testes) e build de produção verdes após a remoção. Commit `07d26a4`.                                                                                              |
| Trabalho baseline destrancado no processo | COMMITADO | Para manter commits atómicos, o trabalho validado de sessões anteriores que estava misturado no worktree foi isolado e commitado por item: lifecycle terminal do Básico + espelho `subscriptions` (`7112beb`), allowlists de registo e perfil empresarial contra mass assignment (`1c3189b`), e as rotas novas `contact` (`c300f47`) e `newsletter/subscribe` (`2bd7b26`). Nenhum destes commits mistura alterações de itens diferentes. |
| Política de TTL no Firestore           | PENDENTE (requer deploy) | Sem alteração: configurar TTL em `apiRateLimits.expiresAt` continua a entrar no `DEPLOY-GUIDE.md` da Fase 6.                                                                                                                                                     |

Validação do item: testes dirigidos vermelho→verde (guard 8/8 antes da implementação falhou por módulo ausente; migração 8/8 falhou com as rotas ainda no limitador antigo), `npm run quality` aprovado com 52 suites e 220 testes, `npm run build` concluído com sucesso. Nenhuma chamada ao Firebase online foi efetuada.

### Lifecycle versionado aterrado e normalização de preço/duração (fecho dos PENDENTE ALTO)

| Item                                        | Estado    | Ficheiros / evidência                                                                                                                                                                                                       |
| ------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pacote de lifecycle versionado (worktree)   | COMMITADO | O trabalho validado que estava não commitado — `lib/subscriptionLifecycle.js`, aprovação admin com revalidação transacional (409), cron transacional com elegibilidade por versão e limpeza de Storage no upload de comprovativo — foi aterrado como commit próprio `2b439bb`, com `SubscriptionLifecycle.test.ts` (8/8). |
| Normalização de preço e duração             | CORRIGIDO | Ver tabela acima; commit `1a655a9`.                                                                                                                                                                                         |
| Tier não Básico a preço zero                | CORRIGIDO | Ver tabela acima; commit `1a655a9`.                                                                                                                                                                                         |

Validação: testes dirigidos vermelho→verde (8/9 falharam antes da correção), `npm run quality` aprovado com 53 suites e 229 testes, `npm run build` concluído com sucesso. Nenhuma chamada ao Firebase online foi efetuada.

### Item 1.5 (concluído) — moderação de vagas com toggle admin

| Item                          | Estado    | Ficheiros / evidência                                                                                                                                                                                                                          |
| ----------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Toggle nas settings           | CRIADO    | `settings/moderation.jobApprovalRequired` gerido por GET/PUT `/api/admin/moderation-settings` (admin-only, valida booleano, auditoria em `activities`). Default desligado = publicação direta, comportamento atual preservado até decisão do dono. |
| Criação com moderação         | CORRIGIDO | `POST /api/jobs` cria `pending_review` sem `publishedAt` quando o toggle está ligado; `isJobPubliclyVisible` já só aceita `active`, pelo que a vaga fica invisível ao público. Admins recebem notificação in-app da fila. Leitura das settings falha aberto com `jobs.moderation_settings_lookup_failed`. |
| Decisão admin                 | CRIADO    | `POST /api/admin/jobs/[id]/moderate` (`approve`/`reject` + motivo sanitizado): transacional, 409 para vagas já processadas ou expiradas antes da aprovação, notificação in-app + push + email branded PT à empresa (falha de entrega não reverte a decisão). |
| Fila no GET admin             | MELHORADO | `GET /api/admin/jobs?status=pending_review` funciona com o filtro existente; stats ganham `pendingReview`.                                                                                                                                     |
| Criação manual admin          | COMMITADO | Trabalho baseline coerente aterrado como commit próprio `d2756c8`: empresas externas por nome, validação salarial, `currency`. Coberto por `AdminJobCreation.test.ts` (3/3).                                                                    |
| UI dos dashboards             | PENDENTE (Fase 3) | Badges/ações de moderação nos dashboards admin e empresa entram na passagem página a página da Fase 3.                                                                                                                                  |

Validação do item: `JobModeration.test.ts` com 13 casos (criação ON/OFF/falha de settings, aprovação, rejeição com motivo, 409 repetido, 409 expirado, 403 não-admin, 400 ação inválida, email falhado não reverte, 405, toggle GET/PUT/403), `npm run quality` aprovado com 54 suites e 242 testes, `npm run build` concluído. Commits `c5f477d` e `d2756c8`. Nenhuma chamada ao Firebase online foi efetuada.

### Item 1.3 (concluído) — logs e dados pessoais nas rotas de API

| Item                              | Estado    | Ficheiros / evidência                                                                                                                                                                                                                     |
| --------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Erros crus no console             | CORRIGIDO | 110 chamadas em 61 rotas migradas de `console.error/warn(msg, error)` para `logServerError`/`logServerWarning` com evento classificado derivado da rota e da mensagem original. O `Error` bruto arrastava mensagem, stack, causa e propriedades que nestas rotas podiam conter email, token FCM, URL de CV ou dados de comprovativo. |
| `console.log` de debug            | REMOVIDO  | Todos eliminados fora dos crons, incluindo blocos multi-linha em `analytics.js` e na aprovação de subscrições (que imprimia planId + userId + datas).                                                                                     |
| Stack e mensagem interna na resposta | CORRIGIDO | `admin/subscription-requests/[id].js` devolvia `error.message` sempre e `error.stack` em desenvolvimento; passa a devolver mensagem constante.                                                                                        |
| Erros engolidos em silêncio       | CORRIGIDO | `pages/api/empresa.js` respondia 500 sem qualquer registo nas duas rotas de perfil; passa a usar o logger classificado.                                                                                                                   |
| Allowlist dos crons               | DECIDIDO  | `cron/check-plan-expiration.js` e `cron/check-job-expiration.js` mantêm `console.log`: é o registo operacional da execução agendada (contagens, ids de tarefa e UIDs), lido nos logs da Vercel. Nenhum contém email, token, CV ou comprovativo. |
| Regressão estática                | CORRIGIDO | `tests/unit/security/apiConsoleUsage.test.ts` (4 casos): proíbe `console.*` fora da allowlist, exige logger nas rotas que apanham erros (com lista explícita das que degradam em silêncio por design) e proíbe termos de dados pessoais nos logs de cron. |
| Separação do trabalho baseline    | OK        | Dois commits: `d7954c6` com os 48 ficheiros cujo diff é exclusivamente de logging e `f31dcae` com apenas os hunks de logging extraídos dos 11 ficheiros que têm também trabalho em curso do utilizador. Nenhuma linha de baseline foi apropriada. |

Validação do item: `npm run quality` aprovado com 56 suites e 251 testes, `npm run build` concluído com sucesso. Nenhuma chamada ao Firebase online foi efetuada.

### Item 1.4 (concluído no código) — ficheiros pessoais no Storage

| Item                                  | Estado    | Ficheiros / evidência                                                                                                                                                                                                                                     |
| ------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entrega por URL assinado              | CRIADO    | `POST /api/files/candidate-cv` reavalia a permissão a cada pedido e devolve um URL assinado válido 5 minutos. É POST para que o uid do candidato não fique em URLs, logs de acesso nem `Referer`. Commit `ecf5bcf`.                                        |
| Política única de acesso              | CRIADO    | `lib/candidateFileAccess.js`: dono e admin sempre; empresa só com perfil visível a recrutadores, `showContactInfo` do candidato e `canViewCandidateContact` no plano. Substitui três implementações divergentes da mesma regra. Commit `f03e114`.          |
| Escalada de privilégio no upload      | CORRIGIDO | **Achado novo.** `/api/profile/upload-cv` aceitava `cvUrl` como string arbitrária do cliente e persistia-a: apontá-la ao ficheiro de outra pessoa (ou a `payment-proofs/`) faria o servidor assiná-lo como se fosse do candidato. Passa a exigir que o caminho esteja em `cvUrl/{uid}/` do próprio e grava `cvStoragePath`. Commits `8821237`, `ecf5bcf`. |
| URL permanente no payload SSR         | CORRIGIDO | **Achado novo.** `pages/candidatos/[id].js` (público) embebia o download URL permanente no `__NEXT_DATA__` do HTML, e `talent-pool` devolvia-o na resposta — em ambos os casos sem que a UI sequer o usasse. Passam a expor apenas `hasCv`. Verificado contra a app real: `curl /candidatos` devolve zero ocorrências de `firebasestorage.googleapis.com`. |
| UI da ficha do candidato              | MELHORADO | O botão «Baixar CV» passa por `lib/candidateCvClient.js`, com estado de loading, erro em PT e «Tentar novamente». A janela abre no gesto do utilizador e só depois recebe o endereço, para o bloqueador de popups não a travar.                            |
| `storage.rules` restritivas           | PREPARADO (não deployado) | `cvUrl/` e `certificados/` exigem dono ou admin. As empresas acedem só pela rota assinada, que usa o Admin SDK e ignora as regras. Commit `e0a94e6`.                                                                                            |
| `photoUrl` mantida pública            | DECISÃO A CONFIRMAR | A auditoria pedia para restringir os três caminhos, mas o perfil público de candidatos renderiza a fotografia sem sessão: restringi-la partiria essa página. Mantida legível, com a privacidade aplicada a montante (a página só é servida se a visibilidade o permitir). **Confirma se aceitas esta exceção.**                                    |
| Cobertura das rules sem emulador      | CORRIGIDO | `storageRules.test.ts` fixa estaticamente as decisões, incluindo a lista fechada de caminhos com leitura pública, para que uma edição futura não reabra o acesso sem justificação.                                                                        |
| Certificados na UI                    | PENDENTE  | `certificateFiles` continua a ser exposto como lista de URLs diretos na ficha do candidato. A rota assinada cobre o CV; estender aos certificados fica como item seguinte da mesma família.                                                                |

Validação do item: 25 casos novos vermelho→verde (`storageObjectPath` 12, `candidateFileAccess` 10 — ambos já verdes à primeira por serem lógica nova —, rota assinada 10, posse no upload 6 com 4 vermelhos iniciais, exposição 7 com 3 vermelhos iniciais, rules 9). `npm run quality` aprovado com 62 suites e 305 testes, `npm run build` concluído. Smoke contra a app local: `401` sem token, `405` em GET, zero URLs permanentes no HTML público.

**Trabalho por commitar (decisão do proprietário):** as alterações a `pages/candidatos/[id].js`, `pages/dashboard/empresa/candidato/[id].js` e `styles/EmpresaCandidateProfilePage.module.css` contêm as minhas (remoção do `cvUrl` do payload e novo botão) intercaladas, nas mesmas linhas, com trabalho baseline não commitado de retrabalho visual e de gating de privacidade. Não foram commitadas para não apropriar esse trabalho; `tests/unit/security/candidateFileExposure.test.ts` fica retido com elas, por depender do seu estado corrigido. Estão aplicadas no worktree e verdes.

### Item 1.7 (concluído) — revisão transversal de auth

Varredura estática das 71 rotas de `pages/api`, seguida de leitura dirigida a tudo o que a varredura sinalizou.

| Item | Estado | Evidência / decisão |
| --- | --- | --- |
| Verificação de admin | OK | Zero rotas sob `/api/admin` sem `userType === 'admin'` a seguir ao `verifyIdToken`. |
| IDOR nas rotas sensíveis | OK | Todas as rotas endereçadas por id verificam posse antes de agir: `applications/[id]/*` compara `candidateId`/`companyId`, `messages/[conversationId]` exige o uid em `participants`, `jobs/[id]` e `jobs/[id]/destaque` comparam `companyId`, `subscription-requests/[id]/payment-proof` usa `assertPaymentProofUploadEligible`, e `export/applications`, `saved-jobs` e `subscription-requests/current` filtram a query pelo uid do chamador. |
| Rotas sem `verifyIdToken` | OK | As 11 são públicas por desenho (registo, contacto, testemunhos, newsletter, alertas de vaga, vagas ativas, categorias, download de recursos, recuperação de password, verificação de email, contagem de visualizações). As que escrevem estão todas atrás do limitador Firestore. |
| Guard de método | CORRIGIDO | `/api/profile` não tinha nenhum: um `DELETE` ou `PUT` era servido como um `GET`. As outras cinco sinalizadas eram falsos positivos do regex (despacham por `const { method } = req` e têm fallthrough 405 correto). Commit `7c9cd7d`. |
| Cabeçalho `Allow` no 405 | CORRIGIDO | Faltava em 42 rotas, contra a RFC 9110. Métodos inferidos do próprio despacho, revistos um a um antes de aplicar. Commit `643ddb4`. |
| Microcopy dos 405 | CORRIGIDO | Três variantes conviviam (`Method not allowed`, `Metodo nao permitido`, e a forma correta), duas delas em texto simples inglês. Uniformizadas em português, preservando a chave `error`/`message` de cada rota para não quebrar consumidores. |
| Regressão | CORRIGIDO | `apiMethodContract.test.ts` fixa: `Allow` presente em toda a rota com 405, microcopy em PT, sem cabeçalho duplicado, inventário não vazio. |

#### Achado por decidir — gating do gerador de CV

`pages/recursos/gerador-cv.js` não tem `getServerSideProps` e portanto nenhum gating de plano, ao contrário das outras duas ferramentas premium (`calculadora-salarial` e `calculadora-impostos`), que redirecionam para `/login` ou para o upgrade. Ao mesmo tempo, `lib/resourcesCatalog.js` tem **duas entradas para a mesma página**: `tool-cv-builder-europass` com `requiresProfessional: true` e `tool-cv-profissional` com `requiresProfessional: false`.

Não alterei nada: fechar o acesso partiria os utilizadores que hoje chegam pela entrada gratuita, e é uma decisão de negócio. **Precisa da tua decisão: o gerador de CV é premium ou gratuito?** Se for premium, removo a entrada gratuita do catálogo e acrescento o `getServerSideProps` igual ao das calculadoras; se for gratuito, removo a flag `requiresProfessional` da entrada duplicada.

#### Veredicto por rota

| Rota | Autenticação | `Allow` | Controlos |
| --- | --- | --- | --- |
| `/api/admin` | token + admin | sim | — |
| `/api/admin/activities` | token + admin | sim | — |
| `/api/admin/affiliates` | token + admin | sim | — |
| `/api/admin/affiliates/[id]` | token + admin | sim | — |
| `/api/admin/hr-services` | token + admin | sim | — |
| `/api/admin/hr-services/[id]` | token + admin | sim | — |
| `/api/admin/jobs` | token + admin | sim | posse |
| `/api/admin/jobs/[id]` | token + admin | sim | — |
| `/api/admin/jobs/[id]/moderate` | token + admin | sim | transação |
| `/api/admin/migrate-verifications` | token + admin | sim | — |
| `/api/admin/moderation-settings` | token + admin | sim | — |
| `/api/admin/payment-settings` | token + admin | sim | — |
| `/api/admin/plans` | token + admin | sim | — |
| `/api/admin/plans/[id]` | token + admin | sim | — |
| `/api/admin/plans/setup` | token + admin | sim | — |
| `/api/admin/services` | token + admin | sim | — |
| `/api/admin/services/[id]` | token + admin | sim | — |
| `/api/admin/subscription-requests` | token + admin | sim | — |
| `/api/admin/subscription-requests/[id]` | token + admin | sim | transação |
| `/api/admin/testimonials` | token + admin | sim | — |
| `/api/admin/testimonials/[id]` | token + admin | sim | — |
| `/api/admin/users` | token + admin | sim | — |
| `/api/admin/users/[id]` | token + admin | sim | — |
| `/api/admin/verifications` | token + admin | sim | — |
| `/api/admin/verify-action` | token + admin | sim | — |
| `/api/affiliate/apply` | token + tipo | sim | — |
| `/api/analytics` | token + tipo | sim | posse |
| `/api/applications` | token + tipo | sim | posse, transação |
| `/api/applications/[id]/interview-ics` | token + tipo | sim | posse |
| `/api/applications/[id]/interview-response` | token + tipo | sim | posse, transação |
| `/api/applications/[id]/status` | token + admin | sim | transação |
| `/api/auth/register` | pública (desenho) | sim | rate-limit |
| `/api/auth/send-password-reset` | pública (desenho) | sim | — |
| `/api/auth/send-verification` | token | sim | — |
| `/api/auth/setup-user` | token + tipo | sim | — |
| `/api/candidate/plan-status` | token + tipo | sim | posse |
| `/api/candidate/plans` | token + tipo | sim | — |
| `/api/career-advice` | token + tipo | sim | — |
| `/api/contact` | pública (desenho) | sim | rate-limit |
| `/api/cron/check-job-expiration` | `CRON_SECRET` | sim | — |
| `/api/cron/check-plan-expiration` | `CRON_SECRET` | sim | transação |
| `/api/empresa` | token + tipo | sim | — |
| `/api/export/applications` | token + tipo | sim | posse |
| `/api/files/candidate-cv` | token + tipo | sim | — |
| `/api/hr-services` | token + tipo | sim | posse |
| `/api/job-alerts` | pública (desenho) | sim | rate-limit |
| `/api/jobs` | token + tipo | sim | posse |
| `/api/jobs/[id]` | token + tipo | sim | posse |
| `/api/jobs/[id]/destaque` | token + tipo | sim | posse |
| `/api/jobs/active` | pública (desenho) | sim | — |
| `/api/jobs/categories` | pública (desenho) | sim | — |
| `/api/messages` | token + tipo | sim | transação |
| `/api/messages/[conversationId]` | token + tipo | sim | posse |
| `/api/newsletter/broadcast` | token + admin | sim | — |
| `/api/newsletter/subscribe` | pública (desenho) | sim | rate-limit |
| `/api/notifications` | token + admin | sim | posse, rate-limit |
| `/api/notify-candidates` | token + tipo | sim | — |
| `/api/profile` | token + admin | sim | posse |
| `/api/profile/update` | token + tipo | sim | — |
| `/api/profile/upload-cv` | token + tipo | sim | — |
| `/api/push-subscriptions` | token | sim | posse, transação |
| `/api/recommendations` | token + tipo | sim | posse |
| `/api/resources/download` | pública (desenho) | sim | — |
| `/api/saved-jobs` | token + tipo | sim | posse |
| `/api/subscribe-plan` | token + tipo | sim | posse, rate-limit, transação |
| `/api/subscription-requests/[id]/payment-proof` | token + tipo | sim | transação |
| `/api/subscription-requests/current` | token | sim | posse |
| `/api/talent-pool` | token + tipo | sim | — |
| `/api/testimonials` | pública (desenho) | sim | rate-limit |
| `/api/track-view` | pública (desenho) | sim | — |
| `/api/verifications` | token + admin | sim | — |

## Inventário de veredictos

A tabela de rotas de API está acima, na Fase 1.7. A tabela de páginas é acrescentada na Fase 3. Nenhuma rota ou página é marcada como validada com base apenas na auditoria histórica.
