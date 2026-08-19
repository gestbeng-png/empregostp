# Auditoria de UX e reativação da cobertura de testes

**Sistema:** EmpregoSTP
**Execução:** 16 de agosto de 2026
**Continuação de:** `docs/audits/full-system-audit-2026-08-16b.md`
**Âmbito:** itens 12 e 13 do plano de correção (ferramentas + E2E autenticado) e auditoria de UX em profundidade

---

## 1. Resultado executivo

Os dois maiores buracos de cobertura foram fechados: **JDK 21 e os browsers Playwright
estão instalados**, e com eles voltaram a correr as suites de **regras Firestore** e de
**integração** — ambas **verdes**. Foi acrescentada uma suite de **jornadas autenticadas**
para favoritos, mensagens, entrevistas e gating de plano, que não existia.

Na auditoria de UX, o produto sai **bem** nos fundamentos e **mal** num ponto concreto e
repetido:

- **Zero overflow horizontal em 45 de 45 medições** (15 rotas × 3 viewports). A
  responsividade está sólida.
- **Zero violações axe em 42 de 45 medições.** Existe **uma** violação real, séria, em
  `/vagas`, presente nos três viewports.
- `lang="pt-PT"` correto e exatamente um `<h1>` em todas as páginas.
- O ponto fraco é **texto abaixo de 14 px e alvos de toque abaixo de 44 px**, concentrados
  na barra de anúncio (todas as páginas) e sobretudo em `/vagas`.

Descoberta operacional relevante: a suite E2E completa **esgotou o disco da máquina**
(ENOSPC, 99% de ocupação), o que corrompeu o cache do Next e produziu uma série de HTTP 500.
A primeira passagem da auditoria de UX foi contaminada por isso e **foi descartada e
repetida** em ambiente limpo — os números deste relatório são os da segunda passagem.

---

## 2. Ferramentas reativadas (item 12)

| Ferramenta | Antes | Agora |
|---|---|---|
| Java | 1.8 (emuladores exigem 11+) | **OpenJDK 21.0.12** via `brew install openjdk@21` (keg-only, em `/usr/local/opt/openjdk@21/bin`) |
| Browsers Playwright | ausentes | **Chromium 149.0.7827.55** |

O `openjdk@21` é *keg-only*: não entra no PATH automaticamente. Para correr as suites:

```bash
export PATH="/usr/local/opt/openjdk@21/bin:$PATH"
```

Convém acrescentar essa linha ao `~/.zshrc`, ou o `npm run test:integration` volta a falhar.

### Suites destrancadas

| Suite | Comando | Resultado |
|---|---|---|
| Regras Firestore | `npm run test:rules` | **PASS — 1 suite, 3 testes** |
| Integração | `npm run test:integration` | **PASS — 1 suite, 2 testes** |
| E2E | `npm run test:e2e:emulators` | Executa (ver §4) |

Ambas estavam **sem correr desde sempre** nesta máquina. As regras Firestore, em especial,
protegem CVs e certificados — passarem a ser verificadas é um ganho real de segurança.

---

## 3. Jornadas autenticadas novas (item 13)

Criado `e2e/authenticated-flows.spec.ts` com quatro jornadas que não existiam:

**Resultado: 4 de 4 passam** (`npx playwright test e2e/authenticated-flows.spec.ts`, 31,4 s).

| Jornada | O que cobre | Estado |
|---|---|---|
| **Favoritos** | Guardar vaga → confirmar na API → **confirmar na UI** do painel do candidato → remover → confirmar remoção | **PASS** (13,9 s) |
| **Mensagens** | Empresa paga cria conversa → envia mensagem → candidato lista a conversa e lê a mensagem | **PASS** (0,5 s) |
| **Entrevistas** | Empresa agenda entrevista → data inválida devolve 4xx e **nunca 500** (regressão AUD-014) → candidato confirma → exporta ICS válido (`BEGIN:VCALENDAR`) | **PASS** (0,6 s) |
| **Gating de plano** | Empresa no plano **básico** é recusada ao tentar mensagens e entrevistas (4xx, nunca 5xx) | **PASS** (0,1 s) |

Estas jornadas confirmam, com sessões reais, que o AUD-014 está mesmo corrigido: data
inválida devolve 400 com mensagem clara em vez de 500, e o ICS exporta um calendário válido.

### Contratos de API documentados pelo caminho

As primeiras execuções falharam por eu ter assumido contratos que não são os reais. Fica
registado, porque não está documentado em lado nenhum e é uma armadilha para quem escrever
testes ou clientes novos:

| Rota | Contrato real |
|---|---|
| `PUT /api/applications/[id]/status` | Campos **planos** `interviewDate`, `interviewMode`, `interviewLink`, `interviewNotes` — **não** um objeto `interviewDetails` (`status.js:108`) |
| `POST /api/messages/[id]` | Campo **`text`**, não `content` (`[conversationId].js:61`) |
| `DELETE /api/saved-jobs` | `jobId` no **corpo**, não na query string (`saved-jobs.js:156`) |

Para isto foi preciso uma fixture nova. A `e2eCompany` está em `basic_empresa`, que **por
desenho** não pode enviar mensagens nem agendar entrevistas
(`lib/empresaPlanFeatures.js`: `canSendDirectMessages` e `canScheduleInterviews` a `false`).
Alterar essa fixture destruiria o gating que outras suites verificam, por isso foi
acrescentada uma **segunda empresa** com plano pago:

- `e2e/fixtures.ts` — `e2eCompanyPro`, `e2eProJob`, `e2eProApplication`;
- `e2e/global-setup.ts` — utilizador `unlimited_empresa`, vaga e candidatura associadas.

As jornadas usam sessões Firebase reais obtidas no Auth Emulator e enviadas contra o
servidor da aplicação: percorrem verificação de token, carregamento de `users/{uid}`,
gating de plano e escrita no Firestore. Os favoritos incluem também validação visual no
painel. Estas alterações **não acrescentam erros de tipos** — `tsc --noEmit` mantém-se nos
8 erros pré-existentes.

---

## 4. Suite E2E completa — execução e diagnóstico

A suite correu **até ao fim**, com traces desligados para não repetir o esgotamento de disco:

| | |
|---|---:|
| Passaram | **59** |
| Falharam | **48** |
| Saltados | 9 |
| Não executados | 2 |
| Duração | 8,1 min |

**As 48 falhas não são 48 defeitos.** Triagem por causa raiz:

| Causa | Falhas | Natureza |
|---|---:|---|
| `metrics.smallText` — texto < 14 px | **19 (39%)** | **Defeito real, único**: a barra de anúncio (§5.3) |
| Diversas (ver abaixo) | 14 (29%) | Mistura de defeitos de teste e instabilidade |
| Elemento ausente/invisível | 9 (18%) | A investigar caso a caso |
| Overflow horizontal | 3 (6%) | Painel admin — a confirmar |
| Violações axe | 2 (4%) | **Instrumentação**: mediu página de erro (ver abaixo) |
| Navegação/URL | 1 (2%) | A investigar |

Dois exemplos que mostram porque o número bruto engana:

- **`login.spec.ts` "não apresenta violações de acessibilidade"** acusa **43** violações,
  a começar por `document-title` ("Documents must have `<title>`"). Uma página de login não
  tem 43 problemas de acessibilidade — isto é a assinatura de uma **página de erro do Next**.
  O teste mediu um 500 provocado pela saturação do dev server, não o produto.
- **`contact-public.spec.ts`** falha por *strict mode*: o seletor
  `getByRole('link', { name: /suporte@empregos\.st/i })` apanha **dois** elementos — o link
  da página **e** o do rodapé. É um defeito do teste, não da aplicação.

**A causa dominante é uma só, e é verificável:**

Vários specs asseveram tolerância zero em métricas visuais:

```ts
expect(metrics.smallText).toEqual([]);      // nenhum texto < 14 px
expect(metrics.shortTargets).toEqual([]);   // nenhum alvo < 44 px
```

Como `components/AnnouncementBar.js` é renderizado pelo `components/PublicPageShell.js`, que
envolve **todas as páginas públicas**, e o seu badge tem `font-size: 12px`
(`styles/AnnouncementBar.module.css:30`), **qualquer página pública falha imediatamente**.
É um defeito real de acessibilidade, amplificado por ~15 specs.

**Recomendação:** corrigir a barra de anúncio primeiro e voltar a correr. O número de falhas
deverá cair drasticamente e só então vale a pena triar o que restar.

---

## 5. Auditoria de UX em profundidade

Metodologia: Chromium real, 15 rotas públicas × 3 viewports (390×844, 768×1024, 1440×900),
com axe-core (WCAG 2.0/2.1 A e AA) e medição de overflow, tamanhos de letra, alvos de toque,
semântica e tempos. **45 medições, todas HTTP 200.**

### 5.1 O que está bem

| Métrica | Resultado |
|---|---|
| Overflow horizontal | **0 px em 45/45** — nenhuma página quebra lateralmente em nenhum viewport |
| Violações axe | **0 em 42/45** |
| `lang` do documento | `pt-PT` em todas |
| Estrutura de títulos | exatamente **um `<h1>`** em todas |
| Tempo até interativo (dev) | mediana **2,4 s** (mobile), **1,9 s** (tablet), **2,0 s** (desktop) |

Vale sublinhar: zero overflow em todas as combinações é um resultado forte e confirma que o
trabalho de responsividade feito anteriormente pegou.

### 5.2 UX-001 — SÉRIO — Selo "Empresa verificada" é invisível para leitores de ecrã

Única violação axe encontrada, presente em `/vagas` nos **três** viewports:

```
[serious] aria-prohibited-attr
<span title="Empresa verificada" aria-label="Empresa verificada">
```

Um `<span>` sem `role` não pode ter `aria-label` — a norma proíbe-o e os leitores de ecrã
**ignoram-no**. Ou seja, o selo de confiança que distingue empresas verificadas
simplesmente não existe para quem usa tecnologia de apoio.

**Correção mínima:** dar semântica ao elemento — `role="img"` com `aria-label`, ou substituir
o `aria-label` por texto visualmente escondido.

### 5.3 UX-002 — MÉDIO — Texto abaixo de 14 px, com `/vagas` como pior caso

O badge **"PARCERIA"** da barra de anúncio, a **12 px**, aparece em praticamente todas as
páginas — é o "1 texto pequeno" recorrente nas medições de tablet e desktop.

`/vagas` em desktop é o pior caso isolado: **13 elementos** abaixo de 14 px — 12 a 12 px
(os contadores dos filtros: "1", "0", …) e 1 a 11 px.

Nota: o achado AUD-019 anterior descrevia "NOVIDADE" e "Saiba mais". O texto mudou para
"PARCERIA", **o problema de tamanho não**.

### 5.4 UX-003 — MÉDIO — Caixas de seleção com área de toque estreita

Medidos como `INPUT 20×48 px`: a altura cumpre, mas a **largura de 20 px** fica muito
abaixo dos 44 px recomendados.

- `/vagas`: **12 caixas** (filtros) em desktop, 2 em mobile e tablet;
- `/register`: **2 caixas** em todos os viewports.

Em ecrã tátil isto traduz-se em toques falhados no registo e na filtragem de vagas — dois
dos pontos mais críticos do funil.

**Correção mínima:** aumentar a área clicável (padding no rótulo associado, ou
`min-width/min-height: 44px` no controlo).

### 5.5 UX-004 — MÉDIO — Imagens sem texto alternativo

| Rota | Imagens sem `alt` |
|---|---|
| `/` (home) | **2 de 8** |
| `/blog` | **1 de 5** |

Consistente nos três viewports. Impede a compreensão do conteúdo por leitores de ecrã e
penaliza SEO.

### 5.6 Modo escuro — SEM DEFEITO. Correção de um diagnóstico meu anterior

Medido na **aplicação real**, com sessão autenticada, no painel do candidato, alternando o
tema pela mesma chave que a interface usa (`estp-theme`), com 65 elementos de texto por tema:

| Tema | Fundo do conteúdo (`.dash-content`) |
|---|---|
| Claro | `rgb(238, 244, 248)` |
| Escuro | `rgb(13, 21, 38)` |

**O fundo alterna corretamente.** Não existe o cenário de texto claro sobre fundo claro que
eu tinha diagnosticado antes nesta sessão.

Esse diagnóstico anterior estava **errado**: assentava num harness que carregava as folhas
de estilo por uma ordem que o Next não usa, produzindo uma cascata artificial. As duas
correções que propus e que foram revertidas a pedido **não eram necessárias** — a reversão
foi a decisão certa.

Uma primeira passagem desta medição acusou 7 falhas de contraste no tema claro e 8 no
escuro. **Também eram artefactos, meus:** o medidor tratava qualquer fundo com alfa > 0,05
como opaco e usava o RGB cru. Os elementos acusados são precisamente os que usam fundos
translúcidos — `.stat-delta.up` é `rgba(61, 187, 122, 0.12)`, o chip "PREMIUM" é
`rgba(217, 255, 47, 0.18)` — cujo fundo **efetivo** é quase o do cartão. Compostos
corretamente, não falham.

**Conclusão: não há defeito de contraste demonstrado em nenhum dos temas.** Se algo ainda
parecer ilegível em uso real, convém reportar a rota e o elemento concretos, porque a
medição instrumentada não o reproduz.

---

## 5-B. Rotas autenticadas — onde o problema realmente está

As 15 rotas públicas saem bem (§5.1). Os **painéis** são outra história. Medidas 22 rotas
autenticadas (candidato, empresa, admin) a 1440×900, com axe e com o medidor de contraste
**corrigido** para compor transparências.

| | Público (15 rotas) | Autenticado (22 rotas) |
|---|---|---|
| Overflow horizontal | 0 | **0** |
| Rotas com violações axe | 1 | **10** |
| Texto < 14 px (pior rota) | 13 | **71** |
| Alvos < 44 px (pior rota) | 12 | **24** |

O overflow continua impecável. Tudo o resto degrada-se muito.

### UX-006 — SÉRIO — Contraste insuficiente em 10 rotas de painel

O axe assinala `color-contrast` [serious] em **10 das 22 rotas**, e desta vez as minhas
medições independentes **coincidem** com ele — ao contrário dos falsos positivos que
descartei em §5.6. Piores casos, todos no painel de **administração**, que é onde o operador
trabalha diariamente:

| Rota | Rácio | Exigido | Elemento |
|---|---:|---:|---|
| `/dashboard/admin/auditoria` | **1,08** | 4,5 | Botão "Atualizar" — `rgb(252,253,254)` sobre `rgb(239,245,249)`: branco sobre branco |
| `/dashboard/admin/subscription-requests` | **1,49** | 4,5 | Estado "Aguardando comprovativo" |
| `/dashboard/admin/plans` | **1,62** | 4,5 | Estado "Ativo" |
| `/dashboard/admin/subscription-requests` | **1,65** | 4,5 | Etiqueta de plano "Profissional" |
| `/dashboard/admin/auditoria` | **2,29** | 4,5 | "Voltar ao Dashboard" |

Contagem por rota: auditoria **41**, subscription-requests **18**, reports **10**,
plans **6**, admin **5**.

O botão "Atualizar" a 1,08 é, na prática, **invisível**. O padrão é sempre o mesmo: etiquetas
de estado coloridas sobre fundos da mesma família cromática.

### UX-007 — SÉRIO — O painel do candidato não tem `<h1>`

**8 rotas** sem qualquer `<h1>`: `/dashboard/candidato` e os separadores `applications`,
`saved`, `interviews`, `verification`, `plans`, `messages`, `notifications`.

Quem usa leitor de ecrã não tem como saber em que página está nem navegar por cabeçalhos —
o mecanismo primário de orientação. As rotas de empresa e admin têm `h1`; só o painel do
candidato é que não.

### UX-008 — MÉDIO — Texto pequeno generalizado nos painéis

Muito pior do que nas páginas públicas: `/dashboard/admin/users` **71** elementos < 14 px,
`/dashboard/admin/auditoria` **50**, `/dashboard/empresa/profile` **41**,
`/dashboard/admin/subscription-requests` **23**.

Predominam 12 px e 13,6 px em rótulos de tabela, etiquetas de estado e metadados — ou seja,
precisamente a informação densa que mais custa a ler.

### UX-009 — MÉDIO — Alvos de toque pequenos em ações importantes

`/dashboard/admin/auditoria` **24** alvos < 44 px, `/dashboard/empresa/profile` **18**.

Preocupa sobretudo o caso funcional: em `/dashboard/admin/subscription-requests`, os links
**"Abrir comprovativo"** medem **128×20 px**. É a ação que o administrador tem de usar para
ver o comprovativo antes de aprovar um pagamento — o gate que foi acrescentado nesta mesma
sessão.

---

## 6. UX-005 — ALTO (operacional) — A suite E2E esgota o disco

Durante a execução, o disco passou de operacional a **99% (190 MiB livres)** e o Node
começou a devolver `ENOSPC`. Consequências observadas:

- o cache do Next corrompeu-se e o servidor passou a devolver **HTTP 500** em 13 de 15 rotas;
- a primeira passagem da auditoria de UX mediu páginas de erro — **dados descartados**.

Ocupação encontrada no projeto: `.next` 722 MB, `.next-e2e` 303 MB, `test-results` 131 MB
(traces e vídeos de ~20 falhas), `private` 226 MB, `.next-mobile-build-final` 222 MB,
`tmp` 99 MB.

Foram removidos apenas artefactos **regeneráveis e já em `.gitignore`** — `.next`,
`.next-e2e`, `test-results`, `playwright-report` — o que devolveu o disco a 79%.

**Não foram tocados** `private/`, `tmp/` e `.next-mobile-build-final/` (547 MB no total):
não estão em `.gitignore`, não são deste trabalho e a sua remoção é decisão do dono do
projeto.

**Recomendações:**

1. acrescentar `tmp/`, `private/` e `.next-mobile-build-final/` ao `.gitignore` — resolve
   também o AUD-021, já que são estes diretórios que produzem 293 dos 301 erros de ESLint;
2. em `playwright.config.ts`, reduzir a retenção de artefactos (`trace: 'off'` ou
   `'retain-on-first-failure'`, vídeo desligado) enquanto a suite tiver falhas em massa;
3. correr o E2E contra um **build de produção**, não contra o dev server — como a auditoria
   anterior já recomendava.

---

## 7. Prioridade

**Ganho rápido, impacto grande**

1. **UX-002** — subir o badge da barra de anúncio para ≥ 14 px. Uma linha de CSS que
   deverá resolver **19 das 48 falhas** do E2E (39%).
2. **UX-006** — corrigir o contraste das etiquetas de estado no painel admin, a começar
   pelo botão "Atualizar" em `/dashboard/admin/auditoria` (rácio 1,08 — invisível).
3. **UX-007** — dar um `<h1>` a cada separador do painel do candidato (8 rotas).
4. **UX-001** — dar semântica ao selo "Empresa verificada" (`role="img"`).
5. **UX-009** — aumentar "Abrir comprovativo" (128×20 px) em
   `/dashboard/admin/subscription-requests`: é a ação que sustenta o gate de aprovação de
   pagamentos.
6. **UX-003** — alargar a área de toque das caixas de seleção em `/vagas` e `/register`.
7. **UX-004** — `alt` nas 3 imagens em falta.
8. **UX-008** — rever a escala tipográfica dos painéis (12–13,6 px em tabelas e estados).

**Higiene do ambiente**

5. **UX-005** — `.gitignore` para `tmp/`, `private/`, `.next-mobile-build-final/`, e reduzir
   a retenção de artefactos do Playwright.
6. Fixar o PATH do JDK 21 no `~/.zshrc`.

**Verificação pendente**

7. Voltar a correr os 110 testes E2E depois do ponto 1 e triar o que restar.
8. Estender a auditoria axe às rotas autenticadas (painéis de candidato, empresa e admin),
   que não foram medidas nesta passagem.

---

## 8. Fronteiras

- A suite E2E correu por inteiro (59/48/9/2). Das 48 falhas, **19 têm causa identificada**;
  as restantes 29 ficam **por triar caso a caso** — sabe-se que incluem pelo menos um defeito
  de teste (*strict mode* em `/contacto`) e pelo menos duas medições de páginas de erro.
- A auditoria de UX cobriu **15 rotas públicas + 22 autenticadas** a 1440×900. As rotas
  autenticadas **não** foram medidas em mobile nem tablet.
- Não foi feita medição de Core Web Vitals nem Lighthouse formal; os tempos indicados são de
  **modo de desenvolvimento** e não representam produção.
- Continuam sem execução: envio real de email, OAuth Google, push FCM real, uploads para
  Storage e pagamento.
- Os dados dos painéis foram medidos com contas QA acabadas de criar, portanto **listas
  quase vazias**. Rotas com muitos registos reais podem revelar problemas adicionais
  (paginação, densidade, desempenho) que aqui não aparecem.

---

## 9. Nota de honestidade sobre este trabalho

Duas conclusões minhas anteriores foram corrigidas por medições feitas agora:

1. **"O modo escuro do painel está partido"** — errado. Medido na aplicação real, o fundo
   alterna corretamente e não há texto claro sobre fundo claro. As duas correções que propus
   e que foram revertidas não eram necessárias.
2. **"O painel do candidato renderiza vazio"** (no relatório anterior) — era artefacto de
   captura de ecrã; o DOM estava completo e pintado.

Também descartei, dentro desta auditoria, uma primeira passagem inteira de dados de UX
(contaminada por disco cheio) e um conjunto de 15 falhas de contraste (artefacto do meu
próprio medidor de transparências). Preferi repetir e corrigir a reportar números que não
se sustentavam.
