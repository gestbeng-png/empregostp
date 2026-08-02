> **OBSOLETO — não reflete o estado atual do projeto.**
> Arquivado na auditoria de release de agosto de 2026. Mantido apenas como
> registo histórico. As fontes de verdade são o `README.md`, o
> `DESIGN-SYSTEM.md`, o `docs/DEPLOY-GUIDE.md` e o relatório em
> `docs/audits/release-audit-2026-08.md`.

# Auditoria Técnica — EmpregoSTP

> Documento de auditoria completa da plataforma **EmpregoSTP** — plataforma de vagas de emprego em São Tomé e Príncipe.
> Data da auditoria: **2026-08-01** · Branch: `main` · Elaborado a partir da leitura do código-fonte.

---

## Índice

1. [Sumário executivo](#1-sumário-executivo)
2. [Stack tecnológico](#2-stack-tecnológico)
3. [Arquitetura geral](#3-arquitetura-geral)
4. [Modelo de segurança](#4-modelo-de-segurança)
5. [Autenticação e tipos de utilizador](#5-autenticação-e-tipos-de-utilizador)
6. [Modelo de dados (coleções Firestore)](#6-modelo-de-dados-coleções-firestore)
7. [Rotas públicas (páginas)](#7-rotas-públicas-páginas)
8. [Dashboard do Candidato](#8-dashboard-do-candidato)
9. [Dashboard da Empresa](#9-dashboard-da-empresa)
10. [Dashboard do Administrador](#10-dashboard-do-administrador)
11. [Rotas de API (backend)](#11-rotas-de-api-backend)
12. [Sistemas de negócio](#12-sistemas-de-negócio)
13. [Integrações externas](#13-integrações-externas)
14. [Tarefas agendadas (cron)](#14-tarefas-agendadas-cron)
15. [Testes e qualidade](#15-testes-e-qualidade)
16. [Variáveis de ambiente](#16-variáveis-de-ambiente)
17. [Achados, riscos e recomendações](#17-achados-riscos-e-recomendações)

---

## 1. Sumário executivo

O **EmpregoSTP** é um marketplace de emprego a três lados (candidatos, empresas, administradores) construído em **Next.js (Pages Router)** com **Firebase** como backend (Authentication, Firestore, Storage, Cloud Messaging). Está preparado para deploy em **Vercel** (crons configurados em `vercel.json`).

Números do projeto:

| Métrica | Valor aproximado |
|---|---|
| Páginas/rotas (não-API) | ~70 |
| Rotas de API | ~75 |
| Componentes React | ~35 |
| Bibliotecas de lógica (`lib/`) | ~50 ficheiros |
| Coleções Firestore em uso | ~35 |
| Linhas nas páginas (não-API) | ~46.700 |
| Linhas nas rotas de API | ~10.700 |
| Testes (unit + integração + rules + e2e) | ~50 ficheiros |

**Padrão arquitetural-chave:** *todas* as escritas no Firestore/Storage passam pelo **Firebase Admin SDK** dentro das rotas de API do Next.js. O cliente tem permissão **apenas de leitura** nas regras de segurança (`allow write: if false` em praticamente todas as coleções). Isto centraliza a validação e a lógica de negócio no servidor.

**Estado geral:** o produto está funcionalmente muito completo (candidaturas, planos pagos com aprovação manual de comprovativos, verificação de perfil multi-tipo, mensagens, entrevistas, analytics, IA para dicas de carreira, push, newsletter, afiliados, serviços de RH, gerador de CV, calculadoras). Há dívida técnica e algumas inconsistências de legado descritas na [secção 17](#17-achados-riscos-e-recomendações).

---

## 2. Stack tecnológico

### Frontend
- **Next.js 16.2** (Pages Router, `--webpack`)
- **React 19.2** / React DOM 19.2
- **react-icons** (ícones), **recharts** (gráficos), **motion** (animações)
- **Tailwind CSS 4** + PostCSS + **CSS Modules** (a maioria dos estilos vive em `styles/*.module.css`)
- PWA: `manifest.webmanifest` + service worker (`public/sw.js`), prompt de instalação, gestão offline

### Backend / dados
- **Firebase 11** (client SDK: Auth, Firestore, Storage, Analytics)
- **firebase-admin 13** (Admin SDK server-side — todas as escritas)
- **@google/generative-ai** (Gemini 2.5 Flash) — dicas de carreira por IA
- **nodemailer 9** (Gmail SMTP) — emails transacionais e newsletter
- **Firebase Cloud Messaging (FCM)** — notificações push web
- **jspdf** — geração de PDFs (gerador de CV)
- **zod 4** — validação de esquemas (camada TypeScript)
- **nookies** — cookies de sessão para SSR

### Tooling / qualidade
- **TypeScript 5.9** (migração incremental — ver ADR 0001)
- **ESLint 9** + `eslint-config-next` + `eslint-config-prettier` + Prettier
- **Jest 30** (unit + integração + rules) e **Playwright 1.61** (e2e), `@axe-core/playwright` (acessibilidade)
- **firebase-tools** (emuladores: Auth 9099, Firestore 8080, Storage 9199, UI 4000)

### Scripts npm relevantes
`dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:integration`, `test:rules`, `test:e2e`, `quality` (typecheck+lint+test), `deploy` (`deploy.sh`), utilitários de índices Firestore.

---

## 3. Arquitetura geral

### 3.1 Camadas

```
pages/                → Rotas Next.js (UI) + pages/api (backend serverless)
components/           → Componentes React reutilizáveis
context/              → React Context (AuthContext, DashboardShellContext)
lib/                  → Lógica de negócio, integrações, utilitários (~50 ficheiros)
styles/              → CSS global + módulos + tema Workbridge
public/              → Assets estáticos, PWA (sw.js, manifest)
scripts/            → Scripts utilitários (criar admin, gerar env, índices)

# Camada "Clean Architecture" (migração incremental TS — ADR 0001)
domain/             → Entidades e regras puras (candidate-settings, shared)
application/        → Casos de uso, contratos (schemas zod), portas
infrastructure/     → Implementações Firebase (repositórios, auth, container DI)
presentation/       → Controladores/hooks de apresentação
shared/i18n/        → Strings PT
```

> **Nota:** A "Clean Architecture" (domain/application/infrastructure/presentation) está aplicada **apenas ao módulo `candidate-settings`** (configurações do candidato) como piloto da migração para TypeScript, conforme documentado em [`docs/adr/0001-typescript-clean-architecture.md`](docs/adr/0001-typescript-clean-architecture.md). O resto do backend segue o padrão clássico de API routes em JS.

### 3.2 Padrão de dados "servidor-autoritativo"

O modelo de segurança mais importante da aplicação:

- **Cliente (browser):** lê Firestore diretamente (para dados públicos/próprios) e obtém o **ID token** do Firebase Auth.
- **Escritas:** o cliente **nunca** escreve diretamente. Envia `Authorization: Bearer <idToken>` para uma rota de API que:
  1. verifica o token (`admin.auth().verifyIdToken`);
  2. lê o documento `users/{uid}` para determinar `userType` e o plano;
  3. aplica limites/permissões de plano;
  4. escreve via Admin SDK (que ignora as regras de segurança).

Este padrão está presente em ~55 rotas de API que fazem `verifyIdToken`.

### 3.3 Shell de dashboard unificado

- [`components/dashboard/DashboardShell.js`](components/dashboard/DashboardShell.js) + [`DashboardRouteFrame.js`](components/dashboard/DashboardRouteFrame.js) — casca comum de navegação para os três dashboards, alimentada por [`components/dashboard/dashboardNav.js`](components/dashboard/dashboardNav.js).
- Tema visual "Workbridge" aplicado a todas as rotas exceto a Home (ver [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md), [`docs/workbridge-design-system.md`](docs/workbridge-design-system.md), [`docs/dashboard-design-system.md`](docs/dashboard-design-system.md)).

---

## 4. Modelo de segurança

### 4.1 Regras Firestore ([`firestore.rules`](firestore.rules))

Funções auxiliares: `signedIn()`, `isOwner(uid)`, `isAdmin()`, `isCompany()`, `isCandidate()` (os três últimos leem `users/{uid}.userType`).

| Coleção | Leitura | Escrita |
|---|---|---|
| `users` | dono ou admin | **negada** (só via API) |
| `profiles` | dono ou admin | **negada** |
| `jobs` | **pública** | só admin (mas empresas criam via Admin SDK na API) |
| `applications` | admin, ou candidato dono, ou empresa dona | **negada** |
| `savedJobs` | candidato dono | **negada** |
| `notifications` | admin ou dono | **negada** |
| `verifications` | admin ou dono | **negada** |
| `plans`, `posts`, `news`, `services`, `platform_stats`, `resources_*` | **pública** | só admin |
| `testimonials` | aprovados públicos; pendentes só admin | só admin |
| `affiliateApplications` | admin ou dono | **negada** |
| `conversations` / `.../messages` | admin ou participante | **negada** |
| `{document=**}` (catch-all) | **negada** | **negada** |

**Conclusão:** modelo restritivo e correto — o cliente lê apenas o que precisa; qualquer escrita passa obrigatoriamente pela API server-side.

### 4.2 Regras Storage ([`storage.rules`](storage.rules))

| Caminho | Leitura | Escrita |
|---|---|---|
| `company-covers/{uid}`, `company-logos/{uid}` | pública | dono autenticado |
| `job-tdr/{uid}` | autenticados | dono |
| `users/{uid}` | dono | dono |
| `cvUrl/{uid}`, `photoUrl/{uid}`, `certificados/{uid}` | **pública** | dono |
| `verification/{docType}/{uid}` | dono | dono |
| `payment-proofs/{uid}` | dono **ou admin** | dono; `< 10 MB`; só `image/*` ou `application/pdf` |
| catch-all | negada | negada |

> ⚠️ **Nota de privacidade:** CVs, fotos e certificados (`cvUrl`, `photoUrl`, `certificados`) têm `allow read: if true` — qualquer pessoa com o URL consegue ler o ficheiro. Comprovativos de pagamento estão corretamente restritos a dono/admin.

### 4.3 Rate limiting

- [`lib/rateLimit.js`](lib/rateLimit.js) — limitador **em memória** por IP (janela 60s, default 5 req/min). Usado em registo, notificações, subscrições, contacto, newsletter, testemunhos, alertas de vaga. Limitação: em ambiente serverless (Vercel) o estado não é partilhado entre instâncias, pelo que o limite é aproximado ("best effort").
- [`lib/firestoreRateLimit.js`](lib/firestoreRateLimit.js) — limitador **persistente** (coleção `apiRateLimits`), usado na rota de IA (`career-advice`, 5/min por utilizador) — fiável entre instâncias.

### 4.4 Rotas internas protegidas por flags

- [`pages/api/create-admin.js`](pages/api/create-admin.js) — só ativa com `ENABLE_INTERNAL_TOOLS=true`.
- [`pages/api/debug-user.js`](pages/api/debug-user.js) — `ENABLE_INTERNAL_TOOLS=true` **+** verificação de admin.
- [`pages/setup/seed.js`](pages/setup/seed.js) — SSR devolve `notFound` se `ENABLE_DEV_SEED_PAGE !== 'true'` (testado em `e2e/seed-route-security.spec.ts`).

### 4.5 Segredos

`.gitignore` cobre `.env*.local`, `.env`, `lib/firebase-admin-credentials.json`, `*.env`, `vercel-env-vars.env`. Confirmado que `.env.local` e as credenciais admin estão ignorados pelo git. ⚠️ [`lib/firebase.js`](lib/firebase.js) contém **valores de fallback hardcoded** da config Firebase web (apiKey, etc.) — para Firebase web estas chaves não são secretas (protegidas pelas regras), mas ficam versionadas.

---

## 5. Autenticação e tipos de utilizador

### 5.1 Contexto de auth

[`context/AuthContext.js`](context/AuthContext.js) — `AuthProvider` escuta `onAuthStateChanged`, expõe `{ user, loading, logout }`. Persistência `browserLocalPersistence`. O `logout` também desregista o token de push e limpa caches do service worker.

### 5.2 Tipos de utilizador ([`lib/businessRules.js`](lib/businessRules.js))

| Tipo | Plano default | Dashboard |
|---|---|---|
| `candidato` | `basic_candidato` | `/dashboard/candidato` |
| `empresa` | `basic_empresa` | `/dashboard/empresa` |
| `admin` | — | `/dashboard/admin` |

### 5.3 Fluxos de registo/login

- **Registo email/password:** [`pages/register.js`](pages/register.js) → [`POST /api/auth/register`](pages/api/auth/register.js). Valida email + password forte (mín. 8, maiúscula/minúscula/número/especial via [`lib/validation.js`](lib/validation.js)), rate limit 5/min, cria user no Auth, cria `users/{uid}` e `subscriptions/{uid}` com plano básico.
- **Registo/login OAuth (Google):** após login, [`POST /api/auth/setup-user`](pages/api/auth/setup-user.js) inicializa idempotentemente o documento do utilizador com plano básico.
- **Escolha de tipo:** [`pages/escolha-tipo.js`](pages/escolha-tipo.js) — candidato vs empresa.
- **Recuperação de senha:** [`pages/recuperar-senha.js`](pages/recuperar-senha.js) / [`redefinir-senha.js`](pages/redefinir-senha.js) → [`/api/auth/send-password-reset`](pages/api/auth/send-password-reset.js) (emails de marca via SMTP próprio — ver memória "branded-auth-emails").
- **Verificação de email:** [`pages/verificar-email.js`](pages/verificar-email.js) → [`/api/auth/send-verification`](pages/api/auth/send-verification.js).
- **Guarda de redirecionamento:** [`components/auth/RedirectGate.js`](components/auth/RedirectGate.js) + [`lib/dashboardNavigation.js`](lib/dashboardNavigation.js).

### 5.4 Proteção de páginas admin (SSR)

[`lib/adminPageGuard.js`](lib/adminPageGuard.js) — `requireAdminPageAuth(context)` lê o cookie `token`, verifica o ID token, confirma `userType === 'admin'`; redireciona para `/login` ou `/dashboard` caso contrário.

---

## 6. Modelo de dados (coleções Firestore)

Coleções detetadas em uso (frequência de referência no código):

| Coleção | Propósito |
|---|---|
| `users` | Perfil de conta + plano ativo (`userType`, `currentPlan`, `planId`, `planTierId`, `planEndDate`, `vagasLimit`, `destaque`, `curriculoDestacado`, dados de verificação) |
| `profiles` | Perfil profissional detalhado (candidato/empresa) |
| `jobs` | Vagas (título, descrição, requisitos, localização, salário, `status`, `destaque`, `expiresAt`, `skillsAssessment`, campos premium, `views`) |
| `applications` | Candidaturas (`jobId`, `candidateId`, `companyId`, `status`, `timeline`, compatibilidade, carta, prioridade) — doc id = `${jobId}_${uid}` |
| `savedJobs` | Vagas guardadas por candidatos |
| `subscriptions` | Assinatura ativa por utilizador |
| `subscription-requests` | Pedidos de plano pago (fluxo de aprovação manual) |
| `plans` | Catálogo de planos editável pelo admin |
| `notifications` | Notificações in-app |
| `push-subscriptions` | Tokens FCM por utilizador |
| `verifications` | Pedidos de verificação de perfil (multi-tipo) |
| `conversations` + subcoleção `messages` | Mensagens diretas candidato↔empresa |
| `activities` / `admin_activities` / `audit_logs` | Registos de atividade e auditoria |
| `jobViews` | Eventos de visualização de vaga (analytics) |
| `candidateProfileViews` | Quem viu o perfil do candidato |
| `candidate_usage` | Contador de candidaturas por mês (`${uid}_${YYYY-MM}`) |
| `scheduledTasks` | Tarefas agendadas (ex.: `REVERT_TO_BASIC_PLAN`) |
| `posts` / `news` | Blog e notícias |
| `services` | Serviços da plataforma |
| `hrServiceRequests` | Pedidos de serviços de RH das empresas |
| `affiliateApplications` | Candidaturas ao programa de afiliados |
| `testimonials` | Testemunhos (com moderação) |
| `newsletterSubscribers` | Subscritores da newsletter |
| `jobAlerts` | Alertas de vaga por email |
| `contactMessages` | Mensagens do formulário de contacto |
| `settings` (doc `payment`) | Configurações de pagamento (conta bancária, instruções) |
| `resources_*` | Catálogos de recursos (templates, guides, tools, etc.) |
| `apiRateLimits` | Estado do rate limiter persistente |

---

## 7. Rotas públicas (páginas)

### 7.1 Institucionais / marketing

| Rota | Página | Conteúdo |
|---|---|---|
| `/` | [index.js](pages/index.js) | Home: hero + pesquisa, vagas em destaque, categorias populares, testemunhos, "sobre", processo, notícias/blog, **newsletter**, secção dupla candidato/empresa, estatísticas dinâmicas |
| `/sobre-nos` | [sobre-nos.js](pages/sobre-nos.js) | Institucional |
| `/carreira` | [carreira.js](pages/carreira.js) | Conteúdo de carreira + dicas por IA |
| `/contacto` | [contacto.js](pages/contacto.js) | Formulário → `/api/contact` (grava `contactMessages` + email de suporte) |
| `/blog` + `/blog/[id]` | [blog.js](pages/blog.js) | Blog público (coleção `posts`) |
| `/premium`, `/premium/candidatos`, `/premium/empresa` | [premium.js](pages/premium.js) | Preços e planos |
| `/cookies`, `/politica-privacidade`, `/termos` | — | Páginas legais |
| `/offline` | [offline.js](pages/offline.js) | Fallback PWA offline |

### 7.2 Vagas e empresas

| Rota | Descrição |
|---|---|
| `/vagas` | [vagas/index.js](pages/vagas/index.js) — listagem/pesquisa/filtros de vagas ativas (~1.500 linhas) |
| `/vaga/[id]` | [vaga/[id].js](pages/vaga/[id].js) — detalhe premium da vaga (~2.050 linhas), candidatura, teste de skills, tracking de views |
| `/empresas` + `/empresas/[id]` | Diretório de empresas + perfil público da empresa |
| `/candidatos` + `/candidatos/[id]` | Diretório público de candidatos + perfil público |
| `/candidatos/nacional`, `/candidatos/internacional` | Segmentação de candidatos |

### 7.3 Recursos e ferramentas

| Rota | Ferramenta |
|---|---|
| `/recursos` | [recursos.js](pages/recursos.js) — hub de recursos (templates, guias, ferramentas, cursos, FAQs) |
| `/recursos/guia/[id]` | Guia individual |
| `/recursos/gerador-cv` | [gerador-cv.js](pages/recursos/gerador-cv.js) — **gerador de CV em PDF** (jsPDF, ~2.770 linhas, estilo Europass) |
| `/recursos/calculadora-salarial` | Calculadora salarial (dados STP em [`lib/stpCompensationData.js`](lib/stpCompensationData.js)) |
| `/recursos/calculadora-impostos` | Calculadora de impostos |

> Catálogos default em [`lib/resourcesCatalog.js`](lib/resourcesCatalog.js) (templates de CV/carta/contrato, guias de carreira/recrutamento, ferramentas). O acesso premium a recursos é mediado por [`lib/resourcePremiumAccess.js`](lib/resourcePremiumAccess.js).

### 7.4 Autenticação

`/login`, `/register`, `/escolha-tipo`, `/recuperar-senha`, `/redefinir-senha`, `/verificar-email`, `/profile` (perfil unificado), `/setup/seed` (dev-only).

---

## 8. Dashboard do Candidato

Página principal: [`pages/dashboard/candidato/index.js`](pages/dashboard/candidato/index.js) (~5.380 linhas, orientada a *tabs* via `?tab=`). Rotas irmãs: `candidaturas.js`, `vaga/index.js`.

**Tabs / funcionalidades:**

| Tab | Funcionalidade |
|---|---|
| `overview` (dashboard) | Visão geral: estatísticas, insights de otimização de perfil, atalhos |
| `profile` | "Meu perfil" — edição de perfil (card único sempre editável, layout de duas colunas — ver memória `profile-config-mockup`) |
| `candidaturas` | Candidaturas enviadas + timeline de estado (rota própria `candidaturas.js`) |
| `saved` | Vagas guardadas (recurso PRO — planos Profissional/Premium) |
| `interviews` | Entrevistas agendadas + resposta a convites |
| `messages` | Mensagens diretas com empresas |
| `notifications` | Notificações in-app |
| `settings` | Configurações (módulo Clean Architecture — [`components/candidates/CandidateSettings.tsx`](components/candidates/CandidateSettings.tsx)), incluindo **privacidade** e mudança de password |
| `verification` | Submissão de verificação de perfil (identidade, certificados, académico, experiência, competências) |
| `plans` | Planos premium do candidato + fluxo de subscrição |

**Insights e IA:** [`lib/candidateProfileInsights.js`](lib/candidateProfileInsights.js), [`lib/candidateOptimizationInsights.js`](lib/candidateOptimizationInsights.js) (compatibilidade CV↔vaga), dicas de carreira via Gemini.

**Componente overview:** [`components/dashboard/CandidateDashboardOverview.js`](components/dashboard/CandidateDashboardOverview.js) · gráfico [`CandidateApplicationsChart.js`](components/charts/CandidateApplicationsChart.js).

---

## 9. Dashboard da Empresa

Página principal: [`pages/dashboard/empresa/index.js`](pages/dashboard/empresa/index.js) (~5.020 linhas). Rotas irmãs: `vagas.js`, `vaga/[id].js`, `vaga/criar-vaga.js`, `candidato/[id].js`, `profile.js`.

**Tabs / funcionalidades:**

| Tab | Funcionalidade | Restrição de plano |
|---|---|---|
| `dashboard` | Visão geral + KPIs | — |
| `jobs` | Gerir minhas vagas (criar/editar/pausar) | limite de vagas ativas por plano |
| `applications` | Candidaturas recebidas (pipeline ATS) + badge de pendentes | — |
| `candidates` | **Banco de talentos** (talent pool) | exclusivo plano PRO |
| `interviews` | Agendamento de entrevistas (ICS + resposta) | Profissional/PRO |
| `messages` | Mensagens diretas com candidatos | envio direto: exclusivo PRO |
| `analytics` | Análise (views, candidaturas, conversão) | exclusivo PRO |
| `hr-services` | Pedidos de serviços de RH | — |
| `plans` | Planos da empresa + subscrição | — |
| `affiliate` | "Ser afiliado" — candidatura ao programa | — |

**Criação de vaga:** [`criar-vaga.js`](pages/dashboard/empresa/vaga/criar-vaga.js) (~1.410 linhas) → [`POST /api/jobs`](pages/api/jobs/index.js). Suporta: TDR (upload), palavras-chave, teste de skills (`skillsAssessment`), campos premium (`premiumOnly`, `earlyAccessHours`, `requireCoverLetter`), destaque. **A vaga é criada diretamente com `status: 'active'`** (sem fila de moderação para vagas de empresa).

**Gráficos:** [`EmpresaApplicationsChart.js`](components/charts/EmpresaApplicationsChart.js), [`EmpresaWeeklyViewsAppsChart.js`](components/charts/EmpresaWeeklyViewsAppsChart.js).

**Talent pool:** [`GET /api/talent-pool`](pages/api/talent-pool.js) — filtra por área/skills/disponibilidade, respeita privacidade do candidato ([`lib/candidatePrivacy.js`](lib/candidatePrivacy.js)); exclusivo do plano PRO.

**Exportação:** [`GET /api/export/applications`](pages/api/export/applications.js) — CSV das candidaturas (Profissional/PRO).

---

## 10. Dashboard do Administrador

Página principal: [`pages/dashboard/admin/index.js`](pages/dashboard/admin/index.js) (~960 linhas). Navegação em [`dashboardNav.js`](components/dashboard/dashboardNav.js).

**Gestão**
- `/dashboard/admin` — visão geral + [`AdminSystemFlowChart.js`](components/charts/AdminSystemFlowChart.js)
- `/dashboard/admin/users` (+ `/[id]`, `/[id]/edit`) — gestão de utilizadores
- `/dashboard/admin/jobs` (+ `create`, `/[id]`, `/[id]/edit`) — gestão de vagas (admin pode criar/editar/apagar; ver [`lib/adminJobManagement.js`](lib/adminJobManagement.js))
- `/dashboard/admin/verificacoes` — moderação de pedidos de verificação

**Conteúdo**
- `/dashboard/admin/blog` (+ `/[id]`) — CRUD de artigos + **broadcast por email** (`/api/newsletter/broadcast`)
- `/dashboard/admin/news` (+ `/[id]`) — notícias
- `/dashboard/admin/resources` (+ `/[id]`) — recursos
- `/dashboard/admin/services` (+ `/[id]`) — serviços
- `/dashboard/admin/hr-services` — pedidos de RH das empresas
- `/dashboard/admin/testimonials` — moderação de testemunhos

**Negócio**
- `/dashboard/admin/plans` — CRUD de planos (~1.150 linhas; ver memória `candidate-plans-fixed-three` — o candidato tem 3 tiers fixos: Verificação/Profissional/Premium)
- `/dashboard/admin/payment-settings` — dados de pagamento (conta bancária/instruções)
- `/dashboard/admin/subscription-requests` — **aprovação/rejeição de pedidos de plano + comprovativos**
- `/dashboard/admin/affiliates` — gestão de afiliados

**Sistema**
- `/dashboard/admin/reports` — relatórios
- `/dashboard/admin/auditoria` — trilha de auditoria (`audit_logs` / `activities`)

---

## 11. Rotas de API (backend)

> Convenção: quase todas verificam `Authorization: Bearer <idToken>` e, quando aplicável, `userType`. As rotas de admin verificam `userType === 'admin'`.

### 11.1 Autenticação
| Rota | Métodos | Notas |
|---|---|---|
| `/api/auth/register` | POST | Registo email/password, rate limit 5/min, password forte |
| `/api/auth/setup-user` | POST | Inicializa doc do utilizador (idempotente) pós-OAuth |
| `/api/auth/send-verification` | POST | Email de verificação (marca própria) |
| `/api/auth/send-password-reset` | POST | Reset de password (marca própria) |

### 11.2 Vagas
| Rota | Métodos | Notas |
|---|---|---|
| `/api/jobs` | GET, POST | Empresa: lista as suas vagas / cria vaga (aplica limites de plano) |
| `/api/jobs/[id]` | GET, PUT, DELETE | Gestão de uma vaga |
| `/api/jobs/[id]/destaque` | POST | Destacar vaga (limite de plano) |
| `/api/jobs/active` | GET | **Pública** — vagas ativas + dados da empresa |
| `/api/jobs/categories` | GET | Categorias |
| `/api/track-view` | POST | Incrementa `views` + regista `jobViews` |

### 11.3 Candidaturas
| Rota | Métodos | Notas |
|---|---|---|
| `/api/applications` | GET, POST | Candidatar-se (transação: verifica duplicados, limite mensal, acesso premium, teste de skills, carta); GET lista as do candidato |
| `/api/applications/[id]/status` | POST/PUT | Empresa/admin atualiza estado + timeline + notificação |
| `/api/applications/[id]/interview-response` | POST | Candidato responde a convite de entrevista |
| `/api/applications/[id]/interview-ics` | GET | Gera ficheiro `.ics` (calendário) |
| `/api/export/applications` | GET | CSV (Profissional/PRO) |
| `/api/notify-candidates` | POST | Empresa notifica candidatos compatíveis (só Premium ilimitado recebe) |
| `/api/recommendations` | GET | Recomendações de vagas por compatibilidade |
| `/api/saved-jobs` | GET/POST/DELETE | Guardar/remover vagas (limite de plano) |
| `/api/job-alerts` | POST | Subscrever alerta de vaga + email imediato |

### 11.4 Planos e subscrições
| Rota | Métodos | Notas |
|---|---|---|
| `/api/subscribe-plan` | POST | Cria pedido de plano; grátis ativa já; pago cria `subscription-requests` + notifica admins (rate limit 10/min) |
| `/api/subscription-requests/current` | GET | Pedido atual do utilizador |
| `/api/subscription-requests/[id]/payment-proof` | POST | Upload de comprovativo (→ `payment_submitted`) |
| `/api/candidate/plan-status` | GET | Estado do plano + limites + insights |
| `/api/candidate/plans` | GET | Planos disponíveis para candidatos |
| `/api/candidate/settings` (TS) | GET/PUT | Configurações do candidato (Clean Architecture) |

### 11.5 Verificação
| Rota | Métodos | Notas |
|---|---|---|
| `/api/verifications` | GET, POST, PUT | Submeter/consultar/rever verificação; PUT só admin; sincroniza estado em `users` e `profiles`; grava `audit_logs` |

### 11.6 Mensagens
| Rota | Métodos | Notas |
|---|---|---|
| `/api/messages` | GET, POST | Listar/iniciar conversa (política em [`lib/conversationPolicy.js`](lib/conversationPolicy.js): só candidato↔empresa; envio direto exige PRO) |
| `/api/messages/[conversationId]` | GET, POST | Mensagens da conversa (escrita atómica — testada) |

### 11.7 Notificações e push
| Rota | Métodos | Notas |
|---|---|---|
| `/api/notifications` | GET/POST/PATCH | CRUD de notificações (rate limit 30/min) |
| `/api/push-subscriptions` | POST/DELETE | Registar/remover token FCM |

### 11.8 Conteúdo público / marketing
| Rota | Métodos | Notas |
|---|---|---|
| `/api/contact` | POST | Grava `contactMessages` + email suporte |
| `/api/newsletter/subscribe` | POST | Subscrição + email de boas-vindas |
| `/api/newsletter/broadcast` | POST | Admin envia artigo a todos (BCC em lotes de 80; anti-reenvio) |
| `/api/testimonials` | GET, POST | Listar aprovados / submeter (moderado) |
| `/api/affiliate/apply` | GET, POST | Candidatura a afiliado |
| `/api/hr-services` | GET, POST | Pedidos de serviços de RH |
| `/api/resources/download` | — | Download de recursos (acesso premium) |
| `/api/career-advice` | POST | **IA Gemini** — dicas de carreira (só candidato; rate limit persistente 5/min) |
| `/api/analytics` | — | Analytics de empresa (PRO; fallback sem índice composto) |
| `/api/profile`, `/api/profile/update`, `/api/profile/upload-cv` | POST | Perfil + upload de CV |

### 11.9 Administração
| Rota | Métodos |
|---|---|
| `/api/admin/users` (+ `/[id]`) | GET, POST, PUT, DELETE |
| `/api/admin/jobs` (+ `/[id]`) | GET, POST, PUT, DELETE |
| `/api/admin/plans` (+ `/[id]`, `/setup`) | GET, POST, PUT, DELETE |
| `/api/admin/services` (+ `/[id]`) | GET, POST, PUT, DELETE |
| `/api/admin/hr-services` (+ `/[id]`) | GET, POST, PATCH, DELETE |
| `/api/admin/testimonials` (+ `/[id]`) | GET, POST, PATCH, DELETE |
| `/api/admin/affiliates` (+ `/[id]`) | GET, POST, PATCH, DELETE |
| `/api/admin/subscription-requests` (+ `/[id]`) | GET / POST (aprovar/rejeitar) |
| `/api/admin/payment-settings` | GET, POST, PUT |
| `/api/admin/verifications`, `/api/admin/verify-action` | moderação de verificações |
| `/api/admin/activities` | GET (trilha de atividade) |
| `/api/admin/migrate-verifications` | migração pontual |

### 11.10 Cron / internas
| Rota | Notas |
|---|---|
| `/api/cron/check-plan-expiration` | Diária 02:00 — reverte planos expirados para básico (protegida por `CRON_SECRET`) |
| `/api/cron/check-job-expiration` | Diária 02:15 — fecha vagas expiradas (protegida por `CRON_SECRET`) |
| `/api/create-admin`, `/api/debug-user` | Dev-only (`ENABLE_INTERNAL_TOOLS`) |

---

## 12. Sistemas de negócio

### 12.1 Planos de candidato ([`lib/candidatePlanFeatures.js`](lib/candidatePlanFeatures.js))

| Plano | Preço (Dobras) | Candidaturas/mês | Recursos-chave |
|---|---|---|---|
| **Básico** (`basic_candidato`) | 0 | 3 | upload de CV; sem guardar vagas, sem notificações |
| **Verificação** (`verification_candidato`) | 20 | 3 | igual ao básico + verificação de perfil |
| **Profissional** (`professional_candidato`) | 50 | 20 | guardar vagas (50), currículo destacado, notificações, gerador de CV, cartas, prioridade, vagas premium/early access, certificados (5) |
| **Premium** (`unlimited_candidato`) | 200 | ∞ | tudo + ver quem viu o perfil, estatísticas, certificados ∞, prioridade máxima, verificação incluída |

Funções de gating: `canApplyToJob`, `canSaveJob`, `canUploadCertificate`, `canApplyToFeaturedJob`, `canAccessPremiumJob`, `canAccessEarlyAccessJob`, `canUseCoverLetter`, `canVerifyProfile`, `canUseCvGenerator`. Normalização robusta de ids/nomes legados via `normalizeCandidatePlanId`. Planos expirados revertem automaticamente para básico em runtime (`getPlanSummary`) e via cron.

### 12.2 Planos de empresa ([`lib/empresaPlanFeatures.js`](lib/empresaPlanFeatures.js))

| Plano | Preço | Vagas ativas | Recursos-chave | Duração vaga |
|---|---|---|---|---|
| **Básico** (`basic_empresa`) | 0 | 1 | ver CV; máx. 10 candidaturas/vaga | 15 dias |
| **Profissional** (`professional_empresa`) | 100/mês | 5 | destaque (1), ver contacto, exportar, filtros, agendar entrevistas, templates, empresa verificada, logo, prioridade | 30 dias |
| **PRO** (`unlimited_empresa`) | 2000/mês | ∞ | tudo + analytics, mensagens diretas, talent pool, destaques ∞, empresa em destaque | 60 dias |

Gating: `canCreateJob`, `canHighlightJob`, `canViewCandidateContact`, `canSendDirectMessage`, `canScheduleInterview`, `canUseMessageTemplates`, `canAccessAnalytics`, `canExportApplications`, `canAccessTalentPool`.

### 12.3 Fluxo de subscrição e pagamento (manual)

1. Utilizador escolhe plano → [`POST /api/subscribe-plan`](pages/api/subscribe-plan.js).
   - Bloqueia se já houver pedido em aberto; valida tier permitido; só permite **upgrade** (não downgrade com plano ativo).
   - Plano grátis: ativa imediatamente. Plano pago: cria `subscription-requests` (status `pending`) + notifica admins (in-app + push) com instruções de pagamento.
2. Utilizador transfere e faz upload do comprovativo → [`/api/subscription-requests/[id]/payment-proof`](pages/api/subscription-requests/[id]/payment-proof.js) (status `payment_submitted`).
3. Admin aprova/rejeita → [`/api/admin/subscription-requests/[id]`](pages/api/admin/subscription-requests/[id].js).
   - **Aprovação exige comprovativo** para planos pagos. Transação atualiza `subscriptions` + `users` (tier, `planEndDate`, features), agenda `scheduledTasks/REVERT_TO_BASIC_PLAN` na data de expiração, notifica o utilizador.
   - Versão de ativação (`activationVersion`) evita revert de planos renovados ([`lib/subscriptionLifecycle.js`](lib/subscriptionLifecycle.js)).

### 12.4 Ciclo de vida das vagas ([`lib/jobExpiration.js`](lib/jobExpiration.js))

- Estados definidos (`JOB_STATUS`): draft, pending_review, active, paused, filled, expired, closed.
- `getEffectiveJobStatus` calcula o estado real considerando a data de fecho; `syncExpiredJobStatus` fecha em runtime; o cron faz o fecho em lote e notifica a empresa.
- A data de fecho é limitada pela duração máxima do plano (`getJobExpirationDate`).

### 12.5 Verificação de perfil ([`lib/candidateVerification.js`](lib/candidateVerification.js))

5 tipos de verificação: **identity, certificates, academic, experience, competencies**. Cada tipo tem checklist e evidências; o admin aprova/rejeita por tipo ou global. O estado público (`verified`, `verificationStatus`) é sincronizado em `users` e `profiles`. Selo público via [`components/VerificationBadge.js`](components/VerificationBadge.js) / [`VerificationStatus.js`](components/VerificationStatus.js). Requer plano Verificação ou Premium.

### 12.6 Candidatura (transacional)

[`POST /api/applications`](pages/api/applications/index.js) aplica, numa transação Firestore: unicidade (`${jobId}_${uid}`), limite mensal por `candidate_usage`, acesso premium/early-access, destaque, teste de skills obrigatório, carta obrigatória/opcional, cálculo de compatibilidade CV↔vaga, prioridade por plano, e notificações para empresa e candidato.

### 12.7 Outros sistemas

- **Mensagens/entrevistas:** conversas restritas candidato↔empresa; entrevistas com geração de ICS e resposta do candidato ([`lib/interviewClient.js`](lib/interviewClient.js)).
- **Afiliados:** [`components/affiliate/AffiliateSection.js`](components/affiliate/AffiliateSection.js) + `/api/affiliate/apply` + gestão admin.
- **Serviços de RH:** [`components/hrServices/HRServicesSection.js`](components/hrServices/HRServicesSection.js) + `/api/hr-services` + gestão admin.
- **Testemunhos:** submissão moderada, exibição pública dos aprovados.
- **Newsletter:** subscrição + broadcast de artigos por email.
- **Recursos:** catálogos + gerador de CV (PDF) + calculadoras (salarial/impostos) com dados de compensação de STP.

---

## 13. Integrações externas

| Integração | Uso | Ficheiros | Config |
|---|---|---|---|
| **Firebase Auth** | Autenticação (email/password + Google) | [`lib/firebase.js`](lib/firebase.js), [`lib/firebaseAdmin.js`](lib/firebaseAdmin.js) | `NEXT_PUBLIC_FIREBASE_*`, `FIREBASE_*` |
| **Firestore** | Base de dados | idem | idem |
| **Firebase Storage** | CVs, logos, TDR, comprovativos | [`lib/firebaseStorage.js`](lib/firebaseStorage.js) | `FIREBASE_STORAGE_BUCKET` |
| **Firebase Cloud Messaging** | Push web | [`lib/serverNotifications.js`](lib/serverNotifications.js), [`components/WebPushManager.js`](components/WebPushManager.js) | `NEXT_PUBLIC_FIREBASE_VAPID_KEY` |
| **Google Gemini** (2.5 Flash) | Dicas de carreira | [`pages/api/career-advice.js`](pages/api/career-advice.js) | `GEMINI_API_KEY` |
| **Gmail SMTP** (nodemailer) | Emails transacionais + newsletter | [`lib/email.js`](lib/email.js), [`lib/authEmails.js`](lib/authEmails.js), [`lib/jobAlertEmail.js`](lib/jobAlertEmail.js) | `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `EMAIL_FROM_NAME` |
| **Vercel Cron** | Expiração de planos/vagas | [`vercel.json`](vercel.json) | `CRON_SECRET` |

> A inicialização do Admin SDK ([`lib/firebaseAdmin.js`](lib/firebaseAdmin.js)) é resiliente: tenta emulador → env → ficheiro de credenciais → application default, por esta ordem.
> IA: se `GEMINI_API_KEY` estiver ausente ou a resposta for fraca, devolve dicas default (degradação graciosa).
> Email: se `GMAIL_*` estiver ausente, `sendEmail` lança `EMAIL_NOT_CONFIGURED` e os fluxos degradam sem quebrar.

---

## 14. Tarefas agendadas (cron)

Definidas em [`vercel.json`](vercel.json), ambas protegidas por `CRON_SECRET` (header `Authorization: Bearer`), aceitam GET (Vercel) e POST (manual):

| Cron | Horário (UTC) | Ação |
|---|---|---|
| `/api/cron/check-plan-expiration` | `0 2 * * *` (02:00) | Processa `scheduledTasks/REVERT_TO_BASIC_PLAN` vencidas → reverte utilizador+assinatura para básico e notifica (transacional, valida `activationVersion`) |
| `/api/cron/check-job-expiration` | `15 2 * * *` (02:15) | Fecha vagas ativas cuja data de fecho passou (batch) + notifica a empresa |

---

## 15. Testes e qualidade

**Unitários (Jest):**
- API/segurança: `AdminApplicationManagement`, `AdminJobCreation`, `CronAndMessages`, `MessagesAtomicWrite`, `ProfileAndRegistrationSecurity`, `SubscriptionLifecycle`, `firestoreRateLimit`, `SeedPageGuard`.
- Auth: `DashboardRedirect`, `PasswordRecovery`, `PremiumRedirect`, `RegisterAccountType`.
- Candidate-settings: `SaveCandidateSettingsUseCase`, `candidatePrivacy`, `candidateSettingsSchema`, `careerAdvice`, `conversationPolicy`, `CandidateSettings`.
- Empresa/vagas: `CompanyProfilePage`, `EmpresaPlansCatalog`, `EmpresaPublicPlans`, `applicationOwnership`, `publicCompanyProfile`, `adminJobManagement`, `jobExpiration`, `jobAlertEmail`, `publicJob`.
- Recursos/segurança: `ResourceCalculators`, `ResourceDownloads`, `externalUrl`.

**Integração:** `FirebaseCandidateSettingsRepository` (emulador Firestore).
**Rules:** `tests/rules/firestore.rules.test.ts` (emulador).
**E2E (Playwright):** ~25 specs cobrindo rotas públicas, auth, dashboards (admin/empresa), calculadoras, segurança da rota seed, offline, acessibilidade (axe).

**Documentação de auditoria de frontend existente:** [`docs/audits/frontend-audit.md`](docs/audits/frontend-audit.md) + screenshots comparativos (before/after) por rota e breakpoint, e captura automatizada via [`scripts/capture-ui-audit.mjs`](scripts/capture-ui-audit.mjs).

---

## 16. Variáveis de ambiente

**Firebase (cliente):** `NEXT_PUBLIC_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_STORAGE_BUCKET`, `_MESSAGING_SENDER_ID`, `_APP_ID`, `_MEASUREMENT_ID`, `_VAPID_KEY`.
**Firebase (admin):** `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_STORAGE_BUCKET`.
**Emuladores:** `NEXT_PUBLIC_USE_FIREBASE_EMULATORS`, `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST`, `NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST`.
**Integrações:** `GEMINI_API_KEY`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `EMAIL_FROM_NAME`, `CONTACT_INBOX`, `NEXT_PUBLIC_SITE_URL`.
**Operações/segurança:** `CRON_SECRET`, `ENABLE_INTERNAL_TOOLS`, `ENABLE_DEV_SEED_PAGE`.
**Deploy/auditoria:** `VERCEL_TOKEN`, `VERCEL_OIDC_TOKEN`, `AUDIT_*`.

---

## 17. Achados, riscos e recomendações

### 🔴 A rever (prioridade alta)

1. **CVs/fotos/certificados publicamente legíveis no Storage.** As regras `cvUrl`, `photoUrl`, `certificados` têm `allow read: if true`. Qualquer pessoa com o URL acede ao ficheiro (URLs longos/aleatórios, mas não é controlo de acesso real). Considerar restringir a autenticados e servir via URLs assinados de curta duração — especialmente para CVs, dado que o produto tem controlos de privacidade do candidato no resto da stack.
2. **Vagas de empresa não passam por moderação.** [`POST /api/jobs`](pages/api/jobs/index.js) cria com `status: 'active'` diretamente, apesar de existir o estado `pending_review` e de o README prometer "moderação de vagas". Se a moderação for um requisito, falta o fluxo.

### 🟠 Inconsistências / dívida técnica (prioridade média)

3. **Legado em [`lib/businessRules.js`](lib/businessRules.js).** `canUpgrade()` e `USER_TYPES` não contemplam o tier `verification_candidato` e usam caminhos de upgrade diferentes da lógica autoritativa em [`subscribe-plan.js`](pages/api/subscribe-plan.js). Como a rota de subscrição tem a sua própria lógica (correta), `canUpgrade` parece morto/desatualizado — confirmar e remover ou alinhar.
4. **Rate limiter em memória não é fiável em serverless.** [`lib/rateLimit.js`](lib/rateLimit.js) guarda estado por instância; no Vercel o limite efetivo multiplica-se pelo número de instâncias. Já existe alternativa persistente ([`firestoreRateLimit.js`](lib/firestoreRateLimit.js)) usada na IA — considerar migrar registo/contacto/newsletter para o limitador persistente.
5. **Nomenclatura de planos de empresa.** O tier `unlimited_empresa` tem `name: 'PRO'` enquanto o médio é 'Profissional' — potencial confusão de marca/UI ("Profissional" vs "PRO"). O salto de preço (100 → 2000 Dobras) é grande; confirmar se intencional.
6. **Config Firebase hardcoded em [`lib/firebase.js`](lib/firebase.js).** Fallbacks com apiKey/appId reais versionados. Não é um segredo para Firebase web, mas é boa prática remover e exigir env.
7. **Muitas queries dependem de fallback por falta de índices compostos.** `firestore.indexes.json` só define 1 índice; várias rotas (`analytics`, `messages`, `notifications`, `canApplyToJob`) têm código de fallback "ordenar/filtrar em memória". Funciona para volumes baixos, mas degrada com escala — criar os índices compostos.

### 🟢 Pontos fortes

8. **Modelo de segurança sólido:** escrita exclusivamente server-side via Admin SDK; regras Firestore restritivas com catch-all `deny`; comprovativos de pagamento corretamente restritos.
9. **Operações transacionais** nos pontos críticos (candidatura, aprovação de plano, expiração) evitam corridas e duplicados.
10. **Degradação graciosa** em IA e email quando as chaves não estão configuradas.
11. **Rotas internas/dev bem protegidas** por flags de ambiente + verificação de admin, com teste de segurança e2e para a rota seed.
12. **Boa cobertura de testes** (unit, integração, rules, e2e com acessibilidade) e trilha de auditoria (`audit_logs`, `activities`).
13. **Emails de marca própria** (não usa emails default do Firebase) e sistema de notificações unificado (in-app + push).

### 📋 Documentação legada dispersa

Existem ~30 ficheiros `.md` na raiz (FEATURED-JOBS-*, DEPLOY-*, IMPLEMENTACOES-*, etc.) e um `importantes.md` de ~107 KB. Muitos são notas históricas e não refletem necessariamente o estado atual. Recomenda-se consolidar em `docs/` e marcar os obsoletos, mantendo esta auditoria e a documentação de design como fontes de verdade.

---

*Fim da auditoria. Para aprofundar qualquer secção (ex.: revisão de segurança formal com `/security-review`, ou análise de uma rota específica), é possível detalhar sob pedido.*
