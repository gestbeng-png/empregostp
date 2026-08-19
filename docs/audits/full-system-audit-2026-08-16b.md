# Auditoria integral do sistema — reteste e estado atual

**Sistema:** EmpregoSTP
**Execução:** 16 de agosto de 2026
**Âmbito:** working tree atual (não commitado), Firebase de produção, os 3 perfis
**Auditoria anterior:** `docs/audits/full-system-user-audit-2026-08-16.md` (25 achados, veredicto "não aprovar")
**Estado recomendado:** **ainda não aprovar para produção** — mas o risco baixou muito

---

## 1. Resultado executivo

Esta auditoria reteste o sistema depois de um grande volume de trabalho corretivo que
está **no disco mas não em git**. O quadro mudou substancialmente face a 15–16 de agosto:

- **A vulnerabilidade crítica (AUD-001, password-reset poisoning) está CORRIGIDA** e bem
  corrigida: a origem do email deixou de depender do pedido.
- **7 dos 11 achados altos estão corrigidos**, 1 está parcial e **4 continuam abertos**.
- A **matriz de autorização dos 3 perfis está perfeita** — testada com tokens reais contra
  o servidor: anónimo 401, candidato 403, empresa 403, admin 200, e cada perfil negado nas
  rotas do outro.
- Em contrapartida, **o pipeline de qualidade está vermelho**: typecheck, lint e testes
  falham, todos por causa de ficheiros de teste novos ainda não commitados. Em CI isto
  bloqueia o merge.
- Apareceram achados novos, sobretudo **58 documentos em 20 coleções órfãs** em produção,
  duas delas com dados pessoais.

O que impede a aprovação são os 4 altos abertos — em especial o **AUD-005**, que permite a
qualquer empresa autenticada disparar notificações forjadas para candidatos Premium.

| Severidade | Corrigidos | Parciais | Abertos |
|---|---:|---:|---:|
| Crítico (1) | **1** | 0 | 0 |
| Alto (11) | **7** | 1 | **3** |
| Alto potencial (1) | 0 | 0 | **1** |
| Médio/baixo (12) | 5 | 3 | 4 |

---

## 2. Método e limites

Executado:

1. suite automatizada local (typecheck, lint, 97 suites Jest, build de produção);
2. verificação estática, ficheiro a ficheiro, dos 25 achados anteriores;
3. auditoria de dados de produção **estritamente read-only** (Admin SDK, sem uma única
   escrita — verificado por varrimento do script antes de correr);
4. jornadas de UI reais nos perfis candidato e empresa, com contas QA;
5. prova de autorização por perfil com tokens Firebase reais contra o servidor;
6. reprodução dirigida do AUD-005, apontada **exclusivamente** a uma conta QA.

**Não executado** (fronteiras de segurança — ver §7): emuladores Firebase (Java 1.8 na
máquina, exigem 11+), suite E2E Playwright (browsers não instalados), envio real de email,
OAuth Google, push FCM real, uploads para Storage, pagamento e qualquer operação sobre
dados de utilizadores reais.

### Contas de teste

Usado `scripts/qa-accounts.mjs`, que garante domínio `.test` não encaminhável (nenhum email
real podia sair), `isTestAccount: true` e registo de UIDs. **Limpeza confirmada no fim**:
`users` voltou a 17 documentos, `isTestAccount` restantes = 0, registo vazio.

---

## 3. Evidência objetiva

| Verificação | Resultado | Interpretação |
|---|---|---|
| `tsc --noEmit` | **FALHA — 8 erros** | Todos em 4 ficheiros de teste **novos e não commitados**. **Zero erros no código-fonte.** |
| `eslint .` | **FALHA — 301 erros** | 293 vêm de artefactos gerados em `tmp/` e `private/tmp/`; **8 são reais**, em 8 ficheiros de teste novos |
| `jest` | **FALHA — 97 suites / 476 testes; 1 suite, 2 testes falham** | Só `tests/unit/api/FormDrafts.test.ts`. É defeito **do teste**, não do produto (ver NEW-003) |
| `next build` | **PASSA** — compilado em 15,3 s | Build de produção íntegro |
| Matriz de autorização (3 perfis, 8 rotas admin) | **PASSA — 32/32** | Ver §6 |
| Logout ponta a ponta | **PASSA** | `DELETE /api/auth/session → 200`; SSR passa a negar de imediato |
| Dados de produção (read-only) | **Executado** | 54 coleções inventariadas; ver §5 |

**Consequência prática:** o CI (`.github/workflows/quality.yml`) corre typecheck → lint →
test → build. **Falharia nos três primeiros passos.**

Chunk `_app`: **453 620 bytes em cru, 138 288 bytes comprimido (~135 KB gzip)**. Confirma a
ordem de grandeza do AUD-025 e acrescenta a medição comprimida que faltava.

---

## 4. Estado dos 25 achados anteriores

| # | Achado | Estado | Evidência |
|---|---|---|---|
| AUD-001 | Password-reset poisoning | **CORRIGIDO** | `lib/authEmails.js:35` — `resolveBaseUrl(_req)` ignora o pedido, exige HTTPS, cai em `PRODUCTION_SITE_URL`; rate limit duplo em `pages/api/auth/send-password-reset.js:19,41` |
| AUD-002 | Open redirect no login | **CORRIGIDO** | `pages/login.js:39` passa por `sanitizeLoginRedirect`; `lib/loginRedirect.js` faz descodificação multi-passe |
| AUD-003 | Logout não encerra sessão | **CORRIGIDO** | `context/AuthContext.js:47` chama `destroyServerSession`; `pages/api/auth/session.js` revoga refresh tokens e limpa cookie em `finally`; cookie passou de 30 dias para **máx. 1 h** (`:86`). Validado ao vivo |
| AUD-004 | Contas suspensas continuam autorizadas | **PARCIAL** | Guards aplicam `isUserAccountActive` (`lib/serverSession.js:35`, `lib/adminPageGuard.js:20`, `lib/apiUserAuth.js:70`, `pages/api/auth/session.js:77`). **Falta** desativar no Firebase Auth e revogar tokens em `pages/api/admin/users/[id].js` — só escreve `status` no Firestore |
| AUD-005 | Notificações de vaga forjadas | **ABERTO** | `pages/api/notify-candidates.js:45-51` inventa `jobData` a partir do corpo quando a vaga não existe; sem check de dono nem de estado. **Reproduzido**: vaga inexistente → HTTP **200** |
| AUD-006 | Certificados por URL direta | **CORRIGIDO** | `pages/dashboard/empresa/candidato/[id].js:760` agora exige `!contactLocked`; existe `pages/api/files/candidate-certificate.js` |
| AUD-007 | Storage Emulator não ligado | **CORRIGIDO** | `lib/firebase.js:75` — `connectStorageEmulator` |
| AUD-008 | Registo cria conta órfã | **CORRIGIDO** | `pages/register.js:309-315` guarda utilizador e payload em `pendingEmailRegistration` para repetição idempotente |
| AUD-009 | Favoritos quebram aos 31 | **CORRIGIDO** | `pages/api/saved-jobs.js:6-13` — `FIRESTORE_IN_QUERY_LIMIT = 30` e `chunk()` |
| AUD-010 | Moderação contornável | **ABERTO** | Nenhum chamador de `moderate` na UI (grep sem resultados); `pages/api/admin/jobs/[id].js:73` aceita `status: 'active'` sem verificar `pending_review` |
| AUD-011 | Verificação atinge o utilizador errado | **ABERTO** | O gate de CV/pagamento usa `verificationData.uid` (`verify-action.js:108`), mas **nada exige** `uid === verificationData.uid`; `syncVerificationState(uid, …)` (`:156`) escreve no uid vindo do cliente |
| AUD-012 | HTML sem sanitização | **ABERTO** | Sem dependência de sanitizador em `package.json`; `components/AnnouncementBar.js:101` e `pages/blog/[id].js:467` |
| AUD-013 | Alertas sem cancelamento/dedup | **CORRIGIDO** | `pages/api/job-alerts/unsubscribe.js` existe; dedup em `index.js:97-113`; token de cancelamento no email |
| AUD-014 | Datas de entrevista | **CORRIGIDO** | `status.js:198` normaliza antes de serializar; `interview-ics.js:81` devolve 400 explícito; há teste dedicado |
| AUD-015 | Editor admin com esquema antigo | **ABERTO** | `pages/dashboard/admin/jobs/[id]/edit.js:19-23,40-44` usa `salario`/`location`/`prazo` |
| AUD-016 | Trilho de auditoria dividido | **ABERTO** | UI lê `activities` (`admin/activities/index.js:64`); candidaturas escrevem `admin_activities`. Em produção: 13 vs 9 documentos |
| AUD-017 | Operações admin destrutivas/estatísticas | **PARCIAL** | Não reproduzível nos dados atuais (0 vagas expiradas ainda "active") — o defeito de código pode persistir, a base é que está limpa pós-wipe |
| AUD-018 | Lacunas de competências falsas | **CORRIGIDO** | `lib/candidateOptimizationInsights.js:95-104` — `phraseLooksUseful` + `GENERIC_PHRASES` + dedup |
| AUD-019 | Texto < 14 px na barra de anúncio | **ABERTO** | `styles/AnnouncementBar.module.css:30` (12 px), `:75` (13 px), `:185`, `:203` |
| AUD-020 | Analytics escapa em modo emulador | **CORRIGIDO** | `lib/firebase.js:40-46` — import dinâmico com guarda |
| AUD-021 | Pipeline não hermético | **ABERTO** | `eslint.config.mjs:53` ignora só `.next/**`, `.next-e2e/**`, `node_modules/**`, `coverage/**`. **293 dos 301 erros** vêm de `tmp/` e `private/tmp/` |
| AUD-022 | Candidaturas órfãs ao apagar vaga | **ABERTO (código)** | `pages/api/jobs/[id].js:121` — `jobRef.delete()` sem cascade. Dados atuais: 0 órfãs |
| AUD-023 | Superfícies admin incompletas | **PARCIAL** | Não reavaliado exaustivamente na UI |
| AUD-024 | Falhas sem feedback | **PARCIAL** | `lib/shareWithFallback.js` novo com teste resolve a parte do `navigator.share` |
| AUD-025 | Bundle pesado | **MEDIDO** | `_app` = 443 KB cru / **135 KB gzip** |

---

## 5. Achados novos

### NEW-001 — MÉDIO — 58 documentos em 20 coleções órfãs em produção, com dados pessoais

Nenhum código em `pages/`, `lib/`, `components/` ou `scripts/` referencia estas 20 coleções.
Usam **snake_case** (`company_id`, `user_id`, `service_type`) enquanto o código atual usa
camelCase — são de uma geração de esquema anterior. Datas: **2025-07-10 a 2026-06-19**.

Sobreviveram ao wipe de 2026-08-02 porque o manifesto (`production-wipe-2026-08-02.json`)
listava os nomes camelCase que o código usa (`hrServiceRequests`, `affiliateApplications`),
e não estes.

Maiores: `adminNotifications` (6), `subscriptionRequests` (6), `auditLogs` (5),
`hr_service_requests` (5), `partnerAssignments` (5), `profileViews` (5),
`hr_service_assignments` (4), `userNotifications` (4).

**Com dados pessoais:** `affiliate_applications` (email, telefone, nome do responsável) e
`partners` (email, telefone, NIF, responsável).

**Impacto:** dados pessoais sem dono funcional, sem política de retenção e fora de qualquer
revisão de regras. Risco de privacidade e de confusão operacional.

**Correção mínima:** decidir por coleção — migrar, exportar e apagar, ou documentar; e
alargar o manifesto de wipe/retenção aos nomes legados.

### NEW-002 — MÉDIO/ALTO (processo) — o pipeline de qualidade está vermelho

`npm run typecheck` (8 erros), `npm run lint` (8 reais) e `npm test` (2 testes) falham —
**todos em ficheiros de teste novos e ainda não commitados**. O código-fonte está limpo.
Como o CI corre estes passos antes do build, **nenhum merge passaria**.

Ficheiros: `AuthSensitiveRoutesRateLimit.test.ts`, `CandidateApplicationWithdrawal.test.ts`,
`JobAlertSubscriptionRoutes.test.ts`, `SavedJobsBatching.test.ts`,
`CandidateApiActiveAccountGuard.test.ts`, `InterviewDateNormalization.test.ts`,
`AuthContextLogout.test.tsx`, `LoginAccountStatus.test.tsx`, `apiUserAuth.test.ts`,
`JobAlertUnsubscribePage.test.tsx`.

### NEW-003 — MÉDIO — teste de rascunhos passa por engano no sítio errado

`tests/unit/api/FormDrafts.test.ts` falha com 500 porque o mock do documento de utilizador
não tem `get()`, e `requireActiveApiUser` (`lib/apiUserAuth.js:63`) chama-o. **A rota
`pages/api/drafts/[scope].js` não chega a ser exercitada** — a funcionalidade de rascunhos
está efetivamente sem cobertura, apesar de ter um ficheiro de teste.

### NEW-004 — BAIXO — o painel do candidato afirma "BÁSICO" antes de saber o plano

`pages/dashboard/candidato/index.js:1602-1609`: enquanto `planStatus` é `null`, o fallback
declara `planName: 'Básico'`. Um cliente Premium vê **"BÁSICO"** no topo até a API responder
(confirmado ao vivo; depois muda para "PREMIUM"). Se a API falhar ou for lenta, fica lá.
Devia ser um estado neutro/carregamento, não um plano concreto errado.

### NEW-005 — MÉDIO — CV guardado como URL permanente com token

Dos perfis com CV em produção, **1 em 1** guarda o CV como URL
`firebasestorage.googleapis.com…token=`. Confirma a pendência já registada no
`release-audit-2026-08.md` (migrar para `storagePath` + URL assinado curto). Quem obtiver o
URL uma vez mantém acesso indefinido, independentemente das Storage Rules.

### NEW-006 — BAIXO — alertas legados não são canceláveis

Os 2 `jobAlerts` existentes têm `unsubscribeTokenHash` ausente (0 de 2). A correção do
AUD-013 só cobre alertas novos; os antigos não têm como ser cancelados pelo utilizador.

### NEW-007 — BAIXO/MÉDIO — catálogo de planos de empresa com entradas legadas

O SSR do painel da empresa devolve planos `ouro_empresa` (5000 Dobras) e `prata_empresa`,
que não correspondem aos escalões canónicos do código (`basic_empresa`,
`professional_empresa`, `unlimited_empresa`). A coleção `plans` tem 14 documentos.

---

## 6. Matriz por perfil

### Autorização (testada com tokens reais contra o servidor) — **32/32 PASS**

| Origem | 8 rotas `/api/admin/*` | Rotas de candidato | Rotas de empresa |
|---|---|---|---|
| Anónimo | **401** (todas) | — | — |
| Candidato Premium | **403** (todas) | **200** | **403** |
| Empresa PRO | **403** (todas) | **403** | **200** |
| Admin | **200** (todas) | — | — |

### Candidato

| Operação | Estado | Evidência |
|---|---|---|
| Login email/senha | PASS | Redirecionou para `/dashboard/candidato` |
| Dashboard renderiza | PASS | Métricas, candidaturas, perfil (10%), recomendações; `main` 1114×1047 px, opacity 1 |
| APIs do painel | PASS | `profile`, `notifications`, `plan-status`, `verifications`, `saved-jobs`, `recommendations`, `drafts` → **todas 200** |
| Badge do plano | FAIL menor | Mostra "BÁSICO" antes de carregar (NEW-004); depois corrige para PREMIUM |
| Logout | PASS | `DELETE /api/auth/session → 200`; `/dashboard/candidato` passa a redirecionar para login |

### Empresa

| Operação | Estado | Evidência |
|---|---|---|
| Login | PASS | Chegou a `/dashboard/empresa` |
| Dados SSR | PASS | `unlimited_empresa`, `planName: PRO`, `vagasLimit: 999`, `destaque: true` |
| Dashboard renderiza | PASS | Sidebar completa (vagas, candidaturas, talentos, entrevistas, analytics, planos, mensagens, Serviço RH) |
| Badge do plano | PASS | "PRO" correto de imediato |
| Notificar candidatos | **FAIL (AUD-005)** | Vaga inexistente aceite com **200** |
| Logout | PASS (com ressalva) | Sessão destruída e SSR nega; numa tentativa a UI não navegou — **inconclusivo**, ver §7 |

### Administrador

| Operação | Estado | Evidência |
|---|---|---|
| Todas as APIs admin | PASS | 8/8 devolvem 200 só ao admin |
| Isolamento de perfis | PASS | Candidato e empresa recebem 403 em 8/8 |
| Moderação de vagas | **FAIL (AUD-010)** | Sem chamador na UI; PUT genérico contorna |
| Verificações | **FAIL (AUD-011)** | Sem exigência de igualdade de UID |

---

## 7. Fronteiras não executadas

Estas áreas **não foram testadas** e não devem ser lidas como aprovadas:

- **Emuladores Firebase** — a máquina só tem **Java 1.8**; `test:integration` e `test:rules`
  exigem 11+. As regras Firestore/Storage continuam sem verificação automatizada.
- **Suite E2E (28 specs)** — browsers Playwright não instalados.
- Envio real de email, OAuth Google, push FCM real, upload para Storage, pagamento e
  confirmação final de plano.
- Qualquer operação sobre dados de utilizadores reais.
- **Logout da empresa**: numa tentativa o `DELETE` devolveu 200 e a sessão morreu, mas a UI
  ficou no painel. O mesmo separador exibiu depois `viewport 0x0` e páginas por hidratar,
  padrão de instabilidade do laboratório. **Classificado como inconclusivo**, não como
  defeito — merece reteste dedicado.

---

## 8. Risco do working tree

Todo o trabalho corretivo verificado aqui — incluindo a correção da **única vulnerabilidade
crítica** — está **apenas no disco**: 107 ficheiros modificados, 51 novos, 2 apagados, sobre
o commit `27b72d7`. Como os deploys foram feitos com `vercel --prod` (que envia o disco e não
o `HEAD`), produção corre código que **não existe em git**.

Consequências: sem histórico, sem revisão, sem rollback fiável e sem CI. Uma reinstalação ou
um `git checkout` perde as correções de AUD-001, 002, 003, 006, 007, 008, 009, 013, 014, 018
e 020.

**Recomendação:** commitar isto com prioridade máxima — corrigindo antes os 8 erros de
typecheck e os 8 de lint (NEW-002), que são o que impede o CI de passar.

---

## 9. Prioridade de correção

**Antes de qualquer release**

1. AUD-005 — exigir que a vaga exista, pertença à empresa e esteja ativa em `notify-candidates`;
2. AUD-011 — exigir `uid === verificationData.uid`;
3. AUD-010 — ligar a UI ao endpoint de moderação e impedir o PUT genérico de ativar `pending_review`;
4. AUD-012 — sanitizar HTML e aplicar CSP;
5. AUD-004 — desativar no Firebase Auth e revogar tokens ao suspender;
6. NEW-002 — pôr o pipeline verde e **commitar tudo**.

**Iteração seguinte**

7. NEW-001 — decidir o destino das 20 coleções órfãs (2 com dados pessoais);
8. NEW-005 — migrar CVs para `storagePath` + URL assinado;
9. AUD-015 esquema do editor admin; AUD-016 trilho unificado; AUD-022 cascade;
10. AUD-021 excluir `tmp/` e `private/` do ESLint; NEW-003 corrigir o mock dos rascunhos;
11. AUD-019 texto ≥ 14 px; NEW-004 estado de carregamento; NEW-006/007 dados legados.

**Endurecimento**

12. Instalar JDK 21 e browsers Playwright para reativar integração, regras e E2E — hoje a
    maior lacuna de cobertura;
13. E2E autenticado por perfil para candidatura, favoritos, mensagens, entrevistas e logout.

---

## 10. Conclusão

O sistema está claramente melhor do que em 15–16 de agosto: a vulnerabilidade crítica
desapareceu, 7 dos 11 altos foram fechados, o logout e a suspensão de contas passaram a ser
aplicados do lado do servidor, e a separação de permissões entre candidato, empresa e admin
é sólida — 32 de 32 verificações passaram.

Não recomendo aprovação ainda, por três razões concretas: **quatro achados altos continuam
abertos** (com destaque para o AUD-005, explorável por qualquer empresa autenticada); **o
pipeline de qualidade está vermelho**, logo nada disto passaria em CI; e **as correções não
estão em git**, o que torna o estado atual de produção irreproduzível e frágil.

Resolvidos esses pontos — e com emuladores e E2E reativados para cobrir o que aqui ficou por
testar — o produto fica em condições de ser promovido.
