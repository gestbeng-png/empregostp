# Plano de correção consolidado

**Sistema:** EmpregoSTP
**Data:** 16 de agosto de 2026
**Consolida:** `full-system-user-audit-2026-08-16.md` (25 achados),
`full-system-audit-2026-08-16b.md` (reteste + 7 achados novos),
`ux-and-coverage-audit-2026-08-16.md` (9 achados de UX)

---

## Ponto de partida

Dos 25 achados originais, **11 já estão corrigidos** no working tree (incluindo a única
vulnerabilidade crítica). Restam **31 itens acionáveis**:

| Origem | Abertos | Parciais |
|---|---:|---:|
| Achados originais (AUD) | 8 | 4 |
| Achados novos (NEW) | 7 | 0 |
| Achados de UX (UX) | 9 | 0 |
| Processo (working tree, CI) | 3 | 0 |

**Ordem obrigatória:** a Fase 0 vem primeiro porque, sem ela, nada do resto pode ser
commitado nem validado em CI — e o trabalho já feito continua a existir apenas no disco.

---

## Fase 0 — Salvar o trabalho e destrancar o CI

**Porquê primeiro:** 109 ficheiros modificados e 54 novos existem só no disco. Os deploys
foram feitos com `vercel --prod`, que envia o disco e não o `HEAD` — produção corre código
que não está em git. Um `git checkout` perde as correções de 11 achados, incluindo a
crítica. E o CI falha nos três primeiros passos, por isso nem seria possível fazer merge.

### 0.1 — Corrigir os 8 erros de typecheck (NEW-002)

Todos em ficheiros de teste novos; zero no código-fonte.

| Ficheiro | Erro |
|---|---|
| `tests/unit/api/AuthSensitiveRoutesRateLimit.test.ts:123,128` | `Object is possibly 'undefined'` / `number \| undefined` |
| `tests/unit/api/CandidateApplicationWithdrawal.test.ts:107` | `Mock<string>` não atribuível a `() => FieldValue` |
| `tests/unit/api/JobAlertSubscriptionRoutes.test.ts:54` | idem |
| `tests/unit/api/SavedJobsBatching.test.ts:69` | `_field`/`_operator` com `any` implícito |

Padrão de correção: nos mocks de `serverTimestamp`, tipar como
`jest.fn(() => 'server-timestamp') as unknown as typeof FieldValue.serverTimestamp`;
nos parâmetros, anotar explicitamente.

### 0.2 — Corrigir os 8 erros de lint (NEW-002)

Em 8 ficheiros de teste novos: `no-explicit-any`, `no-unused-vars`,
`consistent-type-imports`, `ban-ts-comment` (usar `@ts-expect-error`).

### 0.3 — Ignorar artefactos gerados (UX-005 + AUD-021)

`eslint.config.mjs:53` ignora só `.next/**`, `.next-e2e/**`, `node_modules/**`,
`coverage/**`. Acrescentar `tmp/**`, `private/**`, `.next-mobile-build-final/**`.

Acrescentar os mesmos três ao `.gitignore`.

**Efeito:** elimina **293 dos 301** erros de ESLint de uma vez.

### 0.4 — Corrigir o mock dos rascunhos (NEW-003)

`tests/unit/api/FormDrafts.test.ts` — o mock do documento de utilizador não tem `get()`,
e `requireActiveApiUser` (`lib/apiUserAuth.js:63`) chama-o, pelo que a rota devolve 500 e
**nunca chega a ser exercitada**. Acrescentar ao mock:

```js
get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ userType: 'candidato', status: 'active' }) })
```

### 0.5 — Commitar

Com o pipeline verde, commitar em blocos temáticos (segurança, funcionalidade, UI, testes)
em vez de um commit único de 160 ficheiros.

**Critério de aceitação da Fase 0:**
`npm run quality` verde (typecheck + lint + 97 suites) e `npm run build` a passar;
`git status` limpo.

---

## Fase 1 — Bloqueadores de segurança

Os quatro altos que impedem a aprovação, mais a metade que falta do AUD-004.

### 1.1 — AUD-005 — Notificações de vaga forjadas `[ALTO]`

`pages/api/notify-candidates.js:45-51` inventa `jobData` a partir do corpo do pedido quando
a vaga não existe, sem verificar dono nem estado. **Reproduzido nesta auditoria: vaga
inexistente devolveu HTTP 200.**

Qualquer empresa autenticada pode enviar conteúdo à sua escolha (título e localização
controlados pelo atacante) a candidatos **Premium** cujo perfil dê match.

**Correção:**
```js
if (!jobDoc.exists) return res.status(404).json({ error: 'Vaga não encontrada' });
const jobData = { id: jobDoc.id, ...jobDoc.data() };
if (jobData.companyId !== companyUid) return res.status(403).json({ error: 'Vaga de outra empresa' });
if (getEffectiveJobStatus(jobData) !== 'active') return res.status(409).json({ error: 'Vaga não está ativa' });
```
Remover o fallback a `jobTitle`/`jobLocation` do corpo. Corrigir também
`pages/dashboard/empresa/vaga/criar-vaga.js:526-539`, que notifica logo após criar a vaga,
mesmo quando ela fica em `pending_review`.

### 1.2 — AUD-011 — Verificação atinge o utilizador errado `[ALTO]`

`pages/api/admin/verify-action.js` — o gate de CV/pagamento usa `verificationData.uid`
(`:108`), mas `syncVerificationState(uid, …)` (`:156`), o log (`:168-170`) e a notificação
(`:180`) usam o `uid` **vindo do cliente** (`:65`), sem exigir igualdade.

Um admin pode aprovar a verificação do utilizador A e marcar `verified: true` no utilizador
B, que nunca submeteu nem pagou.

**Correção** — logo após carregar `verificationData`:
```js
if (uid !== verificationData.uid) {
  return res.status(400).json({ error: 'UID divergente do pedido de verificação.' });
}
```

### 1.3 — AUD-010 — Moderação de vagas contornável `[ALTO]`

O endpoint `/api/admin/jobs/[id]/moderate` **não tem chamador na UI** (grep sem resultados),
e `pages/api/admin/jobs/[id].js:73` aceita `status: 'active'` sem verificar se a vaga está
em `pending_review` — ativando-a sem metadados de moderação, sem log e sem notificação.

**Correção:** (a) no PUT genérico, recusar transições a partir de `pending_review`,
remetendo para o endpoint de moderação; (b) ligar `pages/dashboard/admin/jobs.js` ao
endpoint dedicado, com botões de aprovar/rejeitar e campo de motivo.

### 1.4 — AUD-012 — HTML publicado sem sanitização `[ALTO potencial]`

`components/AnnouncementBar.js:101` e `pages/blog/[id].js:467` usam
`dangerouslySetInnerHTML`; não há sanitizador em `package.json` nem CSP.

**Correção:** adicionar `isomorphic-dompurify`, sanitizar no servidor antes de persistir
**e** na renderização; definir CSP em `next.config.mjs` (headers) sem `unsafe-inline` para
scripts. Atenção: `pages/_document.js:34` tem um script de bootstrap de tema inline — usar
nonce ou hash.

### 1.5 — AUD-004 — Completar a suspensão de contas `[PARCIAL]`

Os guards já aplicam `isUserAccountActive` (`lib/serverSession.js:35`,
`lib/adminPageGuard.js:20`, `lib/apiUserAuth.js:70`, `pages/api/auth/session.js:77`) — a
parte difícil está feita. Falta `pages/api/admin/users/[id].js`, que só escreve `status` no
Firestore.

**Correção:** ao suspender/desativar, chamar também
`admin.auth().updateUser(uid, { disabled: true })` e
`admin.auth().revokeRefreshTokens(uid)`; reverter ao reativar. Acrescentar ainda a proteção
em falta contra despromover/desativar o **último admin** ou a própria conta.

**Critério de aceitação da Fase 1** (retirado de §11 da auditoria original):
empresa não consegue notificar vaga inexistente, alheia, fechada nem pendente; ação admin
rejeita UIDs divergentes; vaga em `pending_review` não pode ser ativada pelo PUT genérico;
HTML malicioso é neutralizado; conta suspensa falha em login, SSR e API.

---

## Fase 2 — Acessibilidade

### 2.1 — UX-002 / AUD-019 — Texto abaixo de 14 px nas páginas públicas `[MÉDIO]`

**Começar por aqui: é uma linha de CSS que deve resolver 19 das 48 falhas do E2E (39%).**

`styles/AnnouncementBar.module.css:30` (12 px) e `:75` (13 px). Como o `AnnouncementBar`
é renderizado pelo `PublicPageShell`, aparece em **todas** as páginas públicas, e vários
specs asseveram `expect(metrics.smallText).toEqual([])`.

Corrigir também `/vagas` desktop: 12 contadores de filtro a 12 px e 1 a 11 px.

### 2.2 — UX-007 — Painel do candidato sem `<h1>` `[SÉRIO]`

**8 rotas** sem qualquer `<h1>`: `/dashboard/candidato` e os separadores `applications`,
`saved`, `interviews`, `verification`, `plans`, `messages`, `notifications`.

Empresa e admin têm; só o candidato é que não. Quem usa leitor de ecrã fica sem o mecanismo
primário de orientação.

**Correção:** em `pages/dashboard/candidato/index.js`, promover o título de cada separador
(o componente `CandidateSectionHeader`, que hoje usa `<h2>`) a `<h1>`, ou acrescentar um
`<h1>` visualmente escondido por separador.

### 2.3 — UX-006 — Contraste insuficiente em 10 rotas de painel `[SÉRIO]`

Confirmado **em duplicado**: pelo axe (`color-contrast`) e por medição independente com
composição de transparências.

| Rota | Rácio | Elemento |
|---|---:|---|
| `/dashboard/admin/auditoria` | **1,08** | Botão "Atualizar" — branco sobre branco, **invisível** |
| `/dashboard/admin/subscription-requests` | 1,49 | Estado "Aguardando comprovativo" |
| `/dashboard/admin/plans` | 1,62 | Estado "Ativo" |
| `/dashboard/admin/subscription-requests` | 1,65 | Etiqueta "Profissional" |
| `/dashboard/admin/auditoria` | 2,29 | "Voltar ao Dashboard" |

Contagem: auditoria 41, subscription-requests 18, reports 10, plans 6, admin 5.

**Padrão comum:** etiquetas de estado coloridas sobre fundos da mesma família cromática.
A correção estrutural é definir, em `styles/AdminPanel.module.css` e `dashboard-shell.css`,
pares fundo/texto com rácio ≥ 4,5 para cada estado (ativo, pendente, rejeitado, aguardando)
em vez de os declarar caso a caso.

### 2.4 — UX-001 — Selo "Empresa verificada" invisível a leitores de ecrã `[SÉRIO]`

Única violação axe nas páginas públicas, presente em `/vagas` nos três viewports:
`<span title="Empresa verificada" aria-label="Empresa verificada">`. Um `<span>` sem `role`
não pode ter `aria-label` — a norma proíbe-o e os leitores de ecrã ignoram-no.

**Correção:** `role="img"` com `aria-label`, ou substituir por texto visualmente escondido.

### 2.5 — UX-009 — Alvos de toque pequenos em ações importantes `[MÉDIO]`

`/dashboard/admin/auditoria` 24 alvos < 44 px; `/dashboard/empresa/profile` 18.

**Prioritário pelo impacto funcional:** em `/dashboard/admin/subscription-requests`, os
links **"Abrir comprovativo" medem 128×20 px** — é a ação que sustenta o gate de aprovação
de pagamentos acrescentado nesta sessão.

### 2.6 — UX-003 — Caixas de seleção estreitas `[MÉDIO]`

`INPUT 20×48 px`: a altura cumpre, a largura não. `/vagas` (12 filtros em desktop) e
`/register` (2). São dois pontos críticos do funil.

**Correção:** `min-width: 44px` no controlo, ou padding no rótulo associado.

### 2.7 — UX-004 — Imagens sem `alt` `[MÉDIO]`

Home 2 de 8, blog 1 de 5. Consistente nos três viewports.

**Critério de aceitação da Fase 2:** axe a zero em todas as rotas públicas e de painel;
nenhum texto < 14 px; nenhum alvo interativo < 44 px; `<h1>` único em todas as rotas.

---

## Fase 3 — Integridade funcional e dados

### 3.1 — NEW-005 — CV guardado como URL permanente com token `[MÉDIO]`

Em produção, **1 de 1** perfil com CV guarda-o como
`firebasestorage.googleapis.com…token=`. Quem obtiver o URL mantém acesso indefinido,
independentemente das Storage Rules. Já estava registado como pendente no
`release-audit-2026-08.md`.

**Correção:** persistir `cvStoragePath` (já existe em `pages/api/profile/upload-cv.js`) e
servir sempre por URL assinado curto, como já faz
`pages/api/files/candidate-cv.js`. Migrar os registos existentes.

### 3.2 — NEW-001 — 20 coleções órfãs em produção, 2 com dados pessoais `[MÉDIO]`

58 documentos que nenhum código referencia, em **snake_case** (esquema anterior; o código
atual usa camelCase). Datas de 2025-07-10 a 2026-06-19. Sobreviveram ao wipe de 2026-08-02
porque o manifesto listava só os nomes camelCase.

**Com dados pessoais:** `affiliate_applications` (email, telefone, responsável) e
`partners` (email, telefone, NIF).

**Correção:** decidir por coleção — migrar, exportar e apagar, ou documentar como histórico;
alargar o manifesto de wipe/retenção aos nomes legados. Prioridade às duas com dados
pessoais, por retenção sem base.

### 3.3 — AUD-015 — Editor admin com esquema antigo `[MÉDIO/ALTO funcional]`

`pages/dashboard/admin/jobs/[id]/edit.js:19-23,40-44` usa `salario`, `location`, `prazo`;
a criação e a página pública usam `salarioDe`, `salarioAte`, `localizacao`, `dataFecho`.
Uma edição pode parecer guardada sem alterar os valores publicados.

Nota: os dados atuais estão **limpos** (4 vagas, todas canónicas), por isso é corrigir antes
de alguém editar e corromper.

### 3.4 — AUD-016 — Trilho de auditoria dividido `[MÉDIO]`

A UI lê `activities` (`pages/api/admin/activities/index.js:64`), mas as candidaturas
escrevem `admin_activities` (`applications/index.js`, `[id]/status.js`, `[id]/withdraw.js`).
Em produção: 13 documentos numa, 9 na outra. O administrador não vê metade das ações.

**Correção:** unificar numa coleção e migrar a outra.

### 3.5 — AUD-022 — Candidaturas órfãs ao apagar vaga `[MÉDIO]`

`pages/api/jobs/[id].js:121` — `jobRef.delete()` sem cascade nem transação.
Dados atuais: 0 órfãs, mas o defeito persiste.

### 3.6 — AUD-017 — Estatísticas e operações destrutivas `[PARCIAL]`

- estatísticas admin contam vagas "ativas" já expiradas — usar `getEffectiveJobStatus`;
- reset de planos sobrescreve edições sem confirmação;
- recurso predefinido eliminado é recriado por `syncCollectionDefaults` no SSR.

### 3.7 — NEW-004 — Painel afirma "BÁSICO" antes de saber o plano `[BAIXO]`

`pages/dashboard/candidato/index.js:1602-1609`: enquanto `planStatus` é `null`, o fallback
declara `planName: 'Básico'`. Um cliente Premium vê "BÁSICO" até a API responder. Deve ser
um estado de carregamento neutro, não um plano concreto errado.

### 3.8 — NEW-006 / NEW-007 — Dados legados `[BAIXO]`

- os 2 `jobAlerts` existentes não têm `unsubscribeTokenHash`, logo **não podem ser
  cancelados**; migrar ou expirar;
- a coleção `plans` tem `ouro_empresa` (5000 Dobras) e `prata_empresa`, que não
  correspondem aos escalões canónicos do código.

---

## Fase 4 — Qualidade, cobertura e ambiente

### 4.1 — Triar as 29 falhas E2E restantes

Depois da Fase 2.1, voltar a correr e triar o que restar. Sabe-se já que incluem:

- **defeito de teste** — `contact-public.spec.ts` falha por *strict mode*: o seletor
  `getByRole('link', { name: /suporte@empregos\.st/i })` apanha o link da página **e** o do
  rodapé. Corrigir com `.first()` ou scoping a `main`.
- **instrumentação** — `login.spec.ts` acusou 43 violações incluindo `document-title`: é a
  assinatura de uma página de erro do Next, não do produto.

### 4.2 — Tornar o pipeline E2E hermético

- correr contra **build de produção**, não o dev server (que satura e devolve 500);
- `playwright.config.ts`: `trace: 'retain-on-first-failure'` e vídeo desligado — a retenção
  atual gerou 131 MB e contribuiu para esgotar o disco;
- seeds isolados por worker.

### 4.3 — Higiene do ambiente (UX-005)

O disco chegou a **99%** durante a auditoria, corrompeu o cache do Next e produziu HTTP 500
em 13 de 15 rotas — contaminando uma passagem inteira de medições.

Ficam por decidir (não são artefactos meus, não os apaguei): `private/` 226 MB,
`.next-mobile-build-final/` 222 MB, `tmp/` 99 MB.

Fixar ainda o PATH do JDK 21, ou `npm run test:integration` volta a falhar:
```bash
echo 'export PATH="/usr/local/opt/openjdk@21/bin:$PATH"' >> ~/.zshrc
```

### 4.4 — UX-008 — Escala tipográfica dos painéis `[MÉDIO]`

`/dashboard/admin/users` **71** elementos < 14 px, `auditoria` 50, `empresa/profile` 41,
`subscription-requests` 23 — predominam 12 px e 13,6 px em rótulos de tabela e estados,
precisamente a informação mais densa. É trabalho de sistema de design, não pontual.

### 4.5 — AUD-023 / AUD-024 — Superfícies e feedback `[MÉDIO/BAIXO]`

"Novo utilizador" não cria utilizador; falta gestão especializada de empresas/candidatos;
envio de mensagem falha sem erro visível.

### 4.6 — AUD-025 — Bundle `[MÉDIO]`

`_app` = 443 KB cru / **135 KB gzip**, pago por todas as visitas anónimas porque o
`AuthProvider` envolve também as rotas públicas. Separar providers autenticados e carregar
os SDKs Firebase só quando a rota os exigir.

---

## Fora deste plano — decisão do dono

**Rotação da chave Firebase Admin.** Registada em `docs/DEPLOY-GUIDE.md` passo 0. A chave em
uso é comprovadamente a mesma exposta no histórico de git, e contorna **todas** as regras de
Firestore e Storage. Envolve rotação, sanitização de histórico (`git filter-repo` +
force-push coordenado) e auditoria de anomalias na consola Google Cloud.

Continua também por executar, por produzirem efeitos externos: envio real de email, OAuth
Google, push FCM real, uploads para Storage e pagamento.

---

## Resumo de sequenciamento

| Fase | Conteúdo | Bloqueia o quê |
|---|---|---|
| **0** | CI verde + commit | Tudo — sem isto nada é validável nem preservado |
| **1** | 4 altos de segurança + AUD-004 | A aprovação para produção |
| **2** | Acessibilidade (7 itens) | 19 das 48 falhas E2E; conformidade WCAG AA |
| **3** | Integridade funcional e dados (8 itens) | Correção a médio prazo |
| **4** | Qualidade, cobertura, ambiente (6 itens) | Fiabilidade do processo |

**Aprovação para produção** exige Fase 0 + Fase 1 completas e os critérios de aceitação de
§11 da auditoria original verificados por reteste.

**Ganho isolado mais rentável:** a Fase 2.1 — uma linha de CSS que deve resolver 39% das
falhas do E2E.

---

# Estado de execução (20 de agosto de 2026)

As fases 0 a 4 foram executadas. Resumo do que ficou feito, do que foi
descartado por não se confirmar, e do que continua em aberto.

## Fechado

| Fase | Conteúdo | Prova |
|---|---|---|
| **0** | CI verde e todo o trabalho commitado | typecheck 8→0, lint 301→0, testes 2 falhas→0 |
| **1** | AUD-004, 005, 010, 011, 012 | 22 testes, todos vermelhos antes |
| **2** | UX-001, 002, 006, 007, 009 | axe 0 em 30 medições públicas + 8 rotas admin |
| **3** | AUD-015, 016, 017, 022, NEW-004, NEW-005 | 8 testes novos; 105 suites / 506 testes |
| **4** | UX-005, UX-008 (parcial), pipeline E2E, JDK | ver abaixo |

## Descartado após verificação — eram falsos positivos da auditoria

Quatro achados meus não sobreviveram à medição instrumentada:

- **UX-003** (caixas de seleção a 20 px): media o `<input>`, mas o alvo real de
  ativação é o `<label>` que o envolve, já com `min-height: 44px`.
- **UX-004** (imagens sem `alt`): tinham `alt=""` explícito, que é a forma
  correta de marcar imagens decorativas — e o axe nunca as sinalizou.
- **Modo escuro do painel**: medido na aplicação real, o fundo alterna
  corretamente. O diagnóstico anterior vinha de um harness com ordem de CSS
  artificial. As duas correções revertidas não eram necessárias.
- **UX-007** estava sobredimensionado: eram 6 rotas sem `<h1>`, não 8.

## Em aberto — decisões de dados (Fase 3)

Não executadas por serem irreversíveis e dependerem de critérios de negócio.

1. **NEW-001 — 20 coleções órfãs, 58 documentos.** Confirmadas **4 com dados
   pessoais** (não 2): `affiliate_applications`, `partnerApplications`,
   `partners`, `externalHrRequests` — emails, telefones e NIF. Nenhum código as
   referencia. Migrar, exportar-e-apagar ou documentar são todas defensáveis; a
   escolha depende de obrigações de retenção.
2. **NEW-007 — catálogo de planos.** Pior do que reportado: **9 de 14** planos
   estão fora dos escalões canónicos (`basic`, `bronze_candidato`,
   `ouro_candidato`, `ouro_empresa`, `prata_candidato`, `prata_empresa`,
   `professional`, `unlimited` e um com ID gerado). Limpar mexe em preços
   visíveis a clientes.
3. **NEW-006 — 2 alertas sem `unsubscribeTokenHash`**, logo não canceláveis.
   Gerar token retroativamente ou expirá-los.

## Em aberto — trabalho com âmbito próprio

4. **UX-008 — escala tipográfica dos painéis.** Corrigido o que os testes
   acusavam e o que era inequivocamente pequeno: o bloco de perfil da topbar e
   a etiqueta de plano. Fica por decidir a escala geral: `/dashboard/admin/users`
   ainda tem 71 elementos entre 12,8 px e 13,12 px, e `/dashboard/empresa/vagas`
   14. São **414 declarações** em 10 folhas, quase todas em `rem`. Subi-las
   todas muda a densidade de informação de cada tabela — é uma decisão de
   sistema de design, não uma correção pontual, e não pode ser feita sem
   validar o resultado ecrã a ecrã.

5. **AUD-025 — bundle.** `_app` mantém-se em **443 KB cru / 135 KB gzip**, pago
   por todas as visitas anónimas porque `AuthProvider` é importado
   estaticamente em `pages/_app.js` e arrasta o SDK do Firebase (auth,
   firestore, app, storage).
   **Não foi alterado de propósito.** `useAuth()` é consumido também por
   componentes públicos (o cabeçalho decide entre "Iniciar sessão" e o perfil),
   pelo que retirar o provider das rotas públicas parte essas leituras; e tornar
   o Firebase preguiçoso dentro do provider mexe no caminho de autenticação,
   onde um erro subtil é caro. Merece uma tarefa própria, com as jornadas
   autenticadas de `e2e/authenticated-flows.spec.ts` como rede de segurança.

6. **AUD-023 / AUD-024 — superfícies e feedback.** "Novo utilizador" continua a
   não criar utilizador; falta gestão especializada de empresas e candidatos.
   Não abordado nesta passagem.

7. **Rotação da chave Firebase Admin** — continua a ser o único bloqueador de
   segurança fora do código. Ver `docs/DEPLOY-GUIDE.md`, passo 0.
