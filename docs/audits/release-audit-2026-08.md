# Auditoria de release — agosto de 2026

> Relatório vivo da auditoria final do EmpregoSTP.
> Início: 2026-08-01 16:46 WEST · Branch: `main` · Commit de base: `8fb3b891938b1d388bf8056c510482b46164b82c`.
> Fonte de verdade: código real do repositório. Nenhum deploy é executado durante esta missão.

## Estado executivo

| Fase                                         | Estado   | Observação                                                                                                              |
| -------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------- |
| 0 — Baseline, backup e ambiente              | PENDENTE | Baseline local e snapshot de rules concluídos; export Firestore e contas QA bloqueados até confirmação do backup cloud. |
| 1 — Segurança crítica                        | EM CURSO | Segredo removido do worktree atual e protegido por teste; rotação e histórico continuam pendentes.                      |
| 2 — Rotas de API                             | PENDENTE | Ainda não iniciada.                                                                                                     |
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
| Backup cloud do Firestore                            | BLOQUEADO     | `gcloud`/`gsutil` ausentes; bucket de backup, localização, billing e IAM não confirmados. Nenhum export foi iniciado.                                       |
| Snapshot local de rules e índices                    | OK            | Guardado em `docs/audits/rollback/2026-08-01-baseline/`, com manifesto SHA-256.                                                                             |
| Estratégia sem emulador                              | DOCUMENTADO   | Unitários com mocks; rules por revisão + smoke QA; E2E online só após adaptação segura.                                                                     |
| Contas `qa-`                                         | BLOQUEADO     | Proibido criar dados reais antes de o backup cloud estar confirmado.                                                                                        |
| `.env` e credenciais ignorados                       | PARCIAL       | `.env.local` e ficheiros conhecidos estão ignorados, mas a cobertura genérica ainda tem lacunas.                                                            |
| Segredos no histórico recente                        | FALHA CRÍTICA | Chave privada Firebase Admin real versionada em dois documentos desde o primeiro commit.                                                                    |

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

| Item                                      | Estado           | Ficheiros / evidência                                                                                                                                                                                                                                        |
| ----------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Metadados seguros de erro                 | CORRIGIDO        | `lib/serverLog.js` classifica apenas a família do erro e valida o identificador fixo do evento. Mensagem, stack, causa, headers, resposta, payload e propriedades arbitrárias nunca entram no log.                                                           |
| Erro inesperado do comprovativo           | CORRIGIDO        | `pages/api/subscription-requests/[id]/payment-proof.js` deixa de registar o `Error` bruto e devolve `Erro interno do servidor`; erros de domínio e validação são mapeados para mensagens constantes e erros Storage conhecidos mantêm respostas controladas. |
| Limpeza de upload concorrente no worktree | MELHORADO        | O `cleanupError` da alteração preexistente passa por `logServerWarning`. Como a função de cleanup pertence a trabalho não commitado do utilizador, esta linha permanece nesse diff e não é apropriada pelo commit de logging.                                |
| Entrega push / FCM                        | CORRIGIDO        | `lib/serverNotifications.js` já não persiste `result.error.message`, não regista o erro FCM bruto e não devolve `error.message`; conserva apenas a categoria segura (`messaging`, `storage`, etc.).                                                          |
| Testes com canários                       | CORRIGIDO        | `serverLog.test.ts`, `serverNotificationsLogging.test.ts` e `paymentProofLogging.test.ts` colocam email, token, Authorization e Base64 em erros aninhados e provam a ausência desses valores em logs, Firestore simulado e resposta HTTP.                    |
| Logs crus restantes                       | PENDENTE         | Inventário encontrou pelo menos 89 chamadas que passam `Error`/`err` diretamente em 64 ficheiros de `pages/api`; serão migradas em unidades atómicas, começando por push-subscriptions e upload de CV.                                                       |
| `proofUrl` fornecido pelo cliente         | PENDENTE CRÍTICO | A rota ainda aceita uma URL arbitrária quando `proofUrl` e `proofName` são enviados juntos, embora o consumidor interno use Base64. Remoção/validação exige teste de contrato próprio para evitar apropriar alterações concorrentes da rota.                 |
| Tipos de imagem do comprovativo           | PENDENTE         | O servidor ainda aceita qualquer `image/*`, incluindo SVG, sem validar assinatura binária. Será restringido a PDF/JPEG/PNG/WebP num item separado.                                                                                                           |

Validação do item: falha inicial comprovou o `Error` bruto no log e a mensagem privada no 500; testes dirigidos aprovados (14/14), `npm run quality` aprovado com 43 suites e 162 testes e `npm run build` concluído com 27 páginas estáticas. Permanecem apenas os avisos transitivos de `punycode` do baseline. Nenhuma chamada ao Firebase online foi efetuada.

### Log da rota de subscrições push

| Item                                | Estado    | Ficheiros / evidência                                                                                                                                                                    |
| ----------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Falha de autenticação/Firestore/FCM | CORRIGIDO | `pages/api/push-subscriptions/index.js` usa `logServerError` e conserva apenas a categoria do erro; token FCM, bearer, email e objetos internos não chegam ao console.                   |
| Regressão com dados-canário         | CORRIGIDO | `tests/unit/security/pushSubscriptionsLogging.test.ts` falhou primeiro ao receber o `Error` completo e passou após a migração; também confirma a resposta 500 genérica.                  |
| Autorização da remoção por `DELETE` | PENDENTE  | A rota calcula o documento apenas a partir do token recebido. A prova de propriedade e a idempotência serão tratadas num item de IDOR separado, sem misturar contrato com esta correção. |

Validação do item: `npm run quality` aprovado com 44 suites e 163 testes. Nenhuma chamada ao Firebase online foi efetuada.

## Inventário de veredictos

As tabelas exaustivas de rotas de API e páginas serão acrescentadas nas Fases 2 e 3. Nenhuma rota ou página é marcada como validada com base apenas na auditoria histórica.
