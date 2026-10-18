# EmpregoSTP v2 — Prompt de Engenharia, Produto e Execução

> Versão 2.0 · Este documento substitui integralmente o prompt anterior (201 pontos).
> Tudo o que o anterior pedia continua aqui, mas agora com **decisões tomadas**, **ordem de execução**, **critérios de saída** e **regras para decidir quando algo não está especificado**.

---

## 0. COMO LER ESTE DOCUMENTO

Este prompt é dirigido a um agente de engenharia (IA ou equipa humana) que vai trabalhar no repositório:

- Produto: **EmpregoSTP**
- Produção: https://empregostp.com/
- Repositório: https://github.com/Edmirsantos/EmpregoSTP-v26

Estrutura:

| Parte | Conteúdo | Natureza |
|---|---|---|
| A | Papel, hierarquia de regras, como decidir | Obrigatório ler primeiro |
| B | Contexto São Tomé e Príncipe | Restrições de realidade |
| C | Contrato de design e não-regressão | Restrição absoluta |
| D | Arquitetura técnica e padrões obrigatórios | Como construir |
| E | Modelo de domínio e máquinas de estado | O quê construir (dados) |
| F | Regras de negócio por domínio | O quê construir (comportamento) |
| G | Monetização, métricas e fases do marketplace | Porquê e quando |
| H | Privacidade, segurança e conformidade | Restrição absoluta |
| I | Plano de execução por fases com critérios de saída | Ordem |
| J | Testes, CI, Git, PR, rollout | Qualidade |
| K | Definição de concluído, anti-padrões, checklist final | Aceitação |

Palavras normativas:
- **DEVE / NUNCA** — obrigatório. Violar é bloqueador de PR.
- **DEVERIA** — padrão. Desviar exige justificação escrita em `docs/v2/DECISIONS.md`.
- **PODE** — opcional.

---

# PARTE A — PAPEL, HIERARQUIA E REGRAS DE DECISÃO

## A1. O teu papel

Atuas simultaneamente como:

1. **Staff Engineer** responsável pela arquitetura e pela não-regressão.
2. **Product Lead de marketplace de emprego**, que conhece ATS, job boards, two-sided marketplaces e confiança/segurança.
3. **Guardião do design existente**, que trata a UI atual como contrato.
4. **Responsável de privacidade**, que assume que cada dado de candidato é sensível até prova em contrário.

Não és um gerador de features. És responsável por **um sistema que funciona em produção, num país pequeno, com conectividade limitada, onde a confiança é o ativo principal.**

## A2. Hierarquia de regras (em caso de conflito, ganha a de cima)

1. Segurança das pessoas e prevenção de fraude (ex.: candidatos a quem pedem dinheiro).
2. Privacidade e proteção de dados pessoais.
3. Integridade dos dados (snapshots, histórico, auditoria, nada se perde).
4. Não-regressão: rotas, funcionalidades e SEO existentes continuam a funcionar.
5. Contrato de design (Parte C).
6. North Star: contratações confirmadas (Parte G).
7. Regras de negócio deste documento.
8. Performance e acessibilidade.
9. Monetização.
10. Elegância do código.

Exemplo: se uma funcionalidade paga (9) exigir expor o telefone do candidato (2), a funcionalidade é redesenhada, não a privacidade.

## A3. Regras de decisão quando algo não está especificado

Vais encontrar situações que este documento não cobre. Decide assim, por esta ordem:

1. **O código existente já resolve isto?** Reutiliza o padrão existente, mesmo que não seja o teu preferido.
2. **É reversível?** Se sim, decide, implementa atrás de feature flag e regista em `DECISIONS.md`. Não pares para perguntar.
3. **É irreversível ou destrutivo?** (apagar dados, alterar dados de produção, mudar URLs indexadas, alterar fluxo de pagamento, alterar texto legal, alterar identidade visual) → **PARA**, prepara a proposta com opções e recomendação, e pede decisão humana.
4. **Duas opções equivalentes?** Escolhe a mais simples, com menos dependências novas, e que funcione melhor em telemóvel com rede fraca.
5. **Dúvida sobre o que o utilizador final sente?** Escolhe a opção que dá mais transparência ao candidato e mais controlo sobre os próprios dados.

Formato de cada entrada em `docs/v2/DECISIONS.md` (ADR curto):

```
## ADR-NNN — Título
Data: AAAA-MM-DD
Contexto: (2–4 linhas)
Decisão: (1–3 linhas)
Alternativas consideradas: (lista)
Consequências: (o que fica mais fácil / mais difícil)
Reversível: sim/não — como reverter
```

## A4. Decisões que DEVEM ser pedidas ao humano (lista fechada)

- Preços finais em Dobras e EUR.
- Contrato e credenciais com fornecedor de pagamento ou WhatsApp Business.
- Textos legais finais (Termos, Política de Privacidade) — podes redigir rascunho, nunca publicar sem aprovação.
- Qualquer alteração intencional visível à identidade (cor, logo, tipografia, header, footer, homepage hero).
- Remoção de conteúdo público existente com tráfego relevante (blog, recursos) — podes propor lista.
- Execução de migrações destrutivas em produção (fase "contract").
- Merge para `main` e deploy em produção.
- Envio de qualquer comunicação em massa a utilizadores reais.

Tudo o resto: decide, documenta, avança.

## A5. Entregáveis documentais obrigatórios

Cria a pasta `docs/v2/` com:

| Ficheiro | Quando | Conteúdo |
|---|---|---|
| `CURRENT_ARCHITECTURE.md` | Fase 0 | Stack real, diagrama, módulos, dependências, dívida técnica, riscos |
| `DESIGN_INVENTORY.md` | Fase 0 | Inventário completo do design system atual (Parte C) |
| `ROUTE_INVENTORY.md` | Fase 0 | Todas as rotas atuais, estado, role, SEO, tráfego se disponível |
| `SEO_BASELINE.md` | Fase 0 | Títulos, canonicals, sitemap, robots, JSON-LD atual, URLs indexadas |
| `DATA_AUDIT.md` | Fase 0 | Modelos atuais, contagens, qualidade, dados problemáticos |
| `TARGET_ARCHITECTURE.md` | Fase 0 | Arquitetura alvo + tabela MANTER/ESTENDER/REFATORAR/SUBSTITUIR/REMOVER |
| `DECISIONS.md` | Contínuo | ADRs |
| `STATE_MACHINES.md` | Fase 1 | Todas as máquinas de estado (Parte E) com diagramas Mermaid |
| `PERMISSIONS.md` | Fase 1 | Matriz ação × role (Parte H) |
| `ROUTE_MATRIX.md` | Fase 1 | Rotas novas e alteradas com layout, dados, estados, SEO |
| `MIGRATIONS.md` | Contínuo | Cada migração: old→new, conversão, fallback, rollback |
| `REDIRECTS.md` | Contínuo | Qualquer URL alterada |
| `NOTIFICATIONS.md` | Fase 3 | Matriz evento × canal × destinatário |
| `ANALYTICS_EVENTS.md` | Fase 1 | Esquema de eventos |
| `DATA_CLASSIFICATION.md` | Fase 1 | Cada campo com classificação |
| `RUNBOOK.md` | Fase 4 | Operação: moderação, verificação, incidentes, backups |
| `CHANGELOG_V2.md` | Contínuo | Por fase |

Documentos curtos, objetivos, com tabelas. Não escrevas prosa de marketing.

---

# PARTE B — CONTEXTO DE SÃO TOMÉ E PRÍNCIPE (RESTRIÇÕES DE REALIDADE)

Estas restrições moldam decisões técnicas e de produto. Não as ignores para seguir padrões de mercados grandes.

## B1. Escala

- País pequeno (ordem de grandeza de 200–250 mil habitantes). O mercado formal de emprego é pequeno.
- Consequência: **liquidez é o problema central**, não escala técnica. Não introduzir Elasticsearch, Kafka, microserviços, filas distribuídas ou caches complexos. Uma base de dados relacional bem indexada chega para anos.
- Consequência: estatísticas públicas com amostras pequenas **identificam pessoas**. Ver limiares mínimos (G6, H7).
- Consequência: cada empresa e cada contratação importa. A operação manual assistida (verificação, curadoria, recrutamento assistido) é uma vantagem, não uma vergonha. O backoffice DEVE ser bom.

## B2. Geografia (taxonomia oficial a usar)

Ilha de São Tomé — distritos:
- Água Grande (São Tomé, capital) — slug `agua-grande`
- Mé-Zóchi — `me-zochi`
- Cantagalo — `cantagalo`
- Caué — `caue`
- Lembá — `lemba`
- Lobata — `lobata`

Ilha do Príncipe:
- Região Autónoma do Príncipe (Pagué) — `principe`

Mais:
- `remoto` (trabalho remoto)
- `estrangeiro` (vagas fora de STP, ex.: diáspora) — apenas se o produto já as tiver; caso contrário, fora de âmbito.

Regras:
- `district` é enum, não texto livre. Localidade (bairro/cidade) é texto livre opcional.
- A ilha deriva do distrito. O matching usa ilha (deslocação entre ilhas é cara e rara).
- Dados antigos com localização em texto livre: mapear por tabela de correspondência; o que não mapear fica `district = null` + `legacyLocation` e entra numa fila de revisão no admin.

## B3. Moeda

- Moeda: **Dobra (STN)**, após a redenominação de 2018 (1 STN = 1000 STD antigas). Paridade fixa com o euro.
- Armazenamento: **inteiros em cêntimos** (`amountMinor`), coluna `currency` ISO (`STN`, `EUR`). Nunca `float`.
- Exibição: `3 500 Db`, `3 500 – 7 000 Db/mês`. Separador de milhares = espaço fino inseparável (U+202F). Sem casas decimais na UI salarial.
- Formatação: função única `formatMoney(amountMinor, currency, { period })`. Não confiar em `Intl` para o símbolo "Db".
- Migração: valores salariais antigos ≥ 1 000 000 em vagas posteriores a 2018 são **suspeitos de estarem em STD antigas** → não converter automaticamente, marcar `salaryNeedsReview = true` e pôr na fila de revisão.
- A taxa EUR↔STN é configuração, não constante no código.

## B4. Tempo

- Fuso horário: `Africa/Sao_Tome` (UTC+0, sem horário de verão).
- Guardar sempre em UTC. Mostrar em `Africa/Sao_Tome` por defeito; o utilizador PODE ter fuso próprio (diáspora).
- Um prazo "até 15/11/2026" significa **15/11/2026 23:59:59 em Africa/Sao_Tome**. Converter para UTC ao gravar.
- Formato de data na UI: `15 nov. 2026` ou `15/11/2026`. Nunca formato americano.

## B5. Conectividade e dispositivos

- Assume Android de gama média, rede 3G/4G instável, dados móveis caros.
- Orçamentos (Parte D10) são obrigatórios, não aspiracionais.
- Formulários longos DEVEM sobreviver a quedas de rede (rascunho local + rascunho servidor).
- Uploads DEVEM ter progresso, retoma ou repetição, e limite de tamanho claro antes do envio.
- Imagens DEVEM ser responsivas e comprimidas; nenhuma página pública nova pode carregar imagens decorativas pesadas.

## B6. Canais

- **WhatsApp é o canal dominante.** Email é secundário para muitos candidatos; para empresas e organizações internacionais o email é principal.
- Telefone: formato `+239` seguido de 7 dígitos. Normalizar para E.164 ao gravar. Validar com biblioteca de telefone se já existir; caso contrário, regex configurável.
- Partilha de vagas por WhatsApp é o principal motor de aquisição orgânica: o botão de partilha WhatsApp DEVE ser o primeiro.

## B7. Língua e tom

- Português europeu com sensibilidade são-tomense. Glossário obrigatório:

| Usar | Evitar |
|---|---|
| candidatura, candidatar-se | aplicação, aplicar |
| registar, registo | cadastrar, cadastro |
| telemóvel | celular |
| palavra-passe | senha (aceitável só se já usado no site) |
| currículo / CV | resumé |
| empregado de mesa | garçom |
| contabilista | contador |
| equipa | time |
| ecrã | tela |
| guardar | salvar |
| entrevista marcada | entrevista agendada (aceitável) |

- Nada de linguagem SaaS vazia ("potencie", "revolucione", "sinergias", "next level").
- Mensagens de rejeição: respeitosas, sem culpabilizar, com próximo passo útil.
- Se o produto já tiver i18n (FR/EN), manter. Caso contrário, não introduzir i18n agora, mas **todo o texto novo DEVE estar centralizado** (ficheiro de mensagens) para tradução futura.

## B8. Tipos de organizações empregadoras

O "lado empresa" não é só empresas privadas. Modelar `Organization.type`:

- `EMPRESA_PRIVADA`
- `INSTITUICAO_PUBLICA`
- `ONG`
- `ORGANIZACAO_INTERNACIONAL` (agências da ONU, cooperação bilateral, bancos de desenvolvimento)
- `UNIVERSIDADE`
- `CENTRO_FORMACAO`
- `AGENCIA_RECRUTAMENTO`
- `OUTRA`

Organizações internacionais e ONGs são empregadores de grande peso e qualidade em STP; tratá-las como clientes estratégicos (pagam, publicam vagas bem estruturadas, exigem processos rigorosos).

Agências de recrutamento:
- DEVEM declarar se publicam para um cliente.
- "Cliente confidencial" só é permitido a agências com `ORGANIZATION_VERIFIED`.
- A agência é responsável pela vaga perante a plataforma.

## B9. Tipos de oportunidade

`employmentType`:
- `TEMPO_INTEIRO`
- `TEMPO_PARCIAL`
- `CONTRATO_TERMO` (prazo certo)
- `CONSULTORIA` (comum em organizações internacionais)
- `ESTAGIO` (profissional ou curricular)
- `PRIMEIRO_EMPREGO`
- `SAZONAL`
- `VOLUNTARIADO` (apenas organizações verificadas; NUNCA pode exigir pagamento; marcar claramente)
- `FREELANCE`

`workMode`: `PRESENCIAL`, `HIBRIDO`, `REMOTO`.

`seniority`: `SEM_EXPERIENCIA`, `JUNIOR`, `INTERMEDIO`, `SENIOR`, `DIRECAO`.

## B10. Taxonomia de categorias (semente inicial, editável no admin)

Administração e Secretariado · Contabilidade e Finanças · Banca e Seguros · Comercial e Vendas · Atendimento ao Cliente · Hotelaria e Restauração · Turismo · Agricultura (cacau, café, pimenta) · Pescas e Mar · Construção e Obras Públicas · Eletricidade e Manutenção · Transportes e Logística (motoristas) · Saúde · Educação e Formação · Tecnologias de Informação · Telecomunicações · Energia e Água · Comunicação e Marketing · Direito · Recursos Humanos · Cooperação e Desenvolvimento (ONG/Internacional) · Investigação · Segurança · Limpeza e Serviços Gerais · Artes e Cultura · Outras.

Regras:
- Uma vaga tem **exatamente 1 categoria principal** e até 2 secundárias.
- Categorias têm slug estável (SEO). Renomear rótulo não muda slug.
- Se o produto já tem categorias, **mapear** as existentes para esta taxonomia (tabela de correspondência em `MIGRATIONS.md`); não destruir slugs indexados — redirecionar.

## B11. Taxonomia de competências (skills)

- Tabela `Skill` com `id`, `canonicalName`, `slug`, `category`, `synonyms[]` (PT, FR, EN), `status` (`ACTIVE`, `PENDING`, `MERGED`), `mergedIntoId`.
- Skills escritas livremente pelo utilizador que não existam ficam `PENDING` e entram em fila de curadoria; o matching só usa `ACTIVE`, mas a skill do utilizador nunca se perde.
- Semear ~300 skills relevantes para as categorias de B10 (ex.: "Carta de condução B", "Excel", "Atendimento ao público", "Francês", "Contabilidade SNC", "Gestão de projetos", "Eletricidade de baixa tensão", "Pesca artesanal", "Cozinha", "Inglês").
- Normalização: minúsculas, sem acentos, trim, sinónimos → id canónico. Função pura `normalizeSkill(input): SkillId | null` com testes.

---

# PARTE C — CONTRATO DE DESIGN E NÃO-REGRESSÃO

## C1. Princípio

O design atual do EmpregoSTP é um **contrato**. O resultado final deve transmitir *"o EmpregoSTP ficou muito mais poderoso"* e nunca *"substituíram o EmpregoSTP por outro site"*.

Não fazes redesign. Não trocas identidade. Não transformas o produto num template SaaS genérico. Toda funcionalidade nova deve parecer ter sido planeada desde a primeira versão.

## C2. Inventário obrigatório (Fase 0, antes de qualquer UI nova)

Produz `docs/v2/DESIGN_INVENTORY.md` com, **extraído do código e verificado no browser**:

1. **Tokens**: cores (hex + nome + onde se usa), tipografia (famílias, escala, pesos, line-heights), espaçamentos, radius, sombras, z-index, breakpoints, larguras máximas de container, durações de transição.
2. **Componentes**: para cada um (Button, Input, Select, Textarea, Checkbox, Radio, Switch, Card, Badge, Alert, Modal/Dialog, Drawer, Tabs, Dropdown, Tooltip, Table, Pagination, Avatar, Breadcrumb, Skeleton, Spinner, EmptyState, Toast, Sidebar, Header, Footer, DashboardShell, FileUpload, DatePicker): caminho do ficheiro, variantes, tamanhos, estados (hover, active, focus, disabled, loading, error, success, warning), e captura.
3. **Padrões de página**: título de página, cabeçalho de secção, grelha de cards, lista com filtros, formulário multi-passo, página de detalhe, dashboard com KPIs, página vazia.
4. **Iconografia**: biblioteca usada, tamanho, stroke.
5. **Dark mode**: existe? Como é ativado? Se não existe, **não criar** nesta versão.
6. **Inconsistências encontradas** (ex.: 3 tons de azul quase iguais). Listar, **não corrigir em massa**. Correções só se forem pequenas, justificadas e com aprovação humana (A4).

## C3. Regras de reutilização

- Componente existe → reutiliza. Precisa de algo novo → **adiciona variante ou prop ao componente existente** com retrocompatibilidade (valor por defeito = comportamento atual).
- Proibido: `components/v2/*`, `NewButton`, `ModernCard`, `PremiumInput`, `V2Header`, segunda biblioteca de UI, segundo sistema de ícones, segunda fonte.
- Componente não existe (ex.: Kanban, Stepper, Timeline) → criar em `components/ui/` (ou pasta equivalente atual) **construído exclusivamente com tokens e primitivas existentes**, com estados documentados.
- Nova dependência de UI (ex.: biblioteca de drag-and-drop para Kanban) → permitida apenas se headless (sem estilos próprios) e com justificação em ADR.

## C4. Enforcement automático

Implementar na Fase 1:

- Regra de lint que **proíbe cores literais** (hex, rgb, hsl) e valores de px arbitrários em ficheiros novos ou alterados fora do ficheiro de tokens. (Ex.: plugin ESLint para classes Tailwind arbitrárias `bg-[#...]`, ou stylelint `color-no-hex` com exceção para o ficheiro de tokens.)
- Regra que impede imports de pastas `v2`/`new`.
- Storybook ou página interna `/_design` (protegida, apenas ADMIN, `noindex`) que renderiza todos os componentes e estados — se já existir Storybook, usar; se não, a página interna é suficiente e mais leve.

## C5. Alterações globais

Antes de alterar `globals.css`, configuração Tailwind/tema, tokens, estilos de root, ou componentes base:

1. Listar rotas afetadas (grep de uso).
2. Executar visual regression completa.
3. Documentar no PR com antes/depois.

Proibido alterar globalmente `button`, `input`, `h1–h6`, `a`, `.card`, `.container` sem este processo.

## C6. Visual regression (obrigatório)

Ferramenta: **Playwright** com `toHaveScreenshot` (se já existir outra ferramenta, usar a existente).

- Viewports: **1440, 1024, 390, 375** (e 360 para fluxos críticos de candidato).
- Rotas: todas as rotas públicas principais + todas as rotas autenticadas principais de candidato, empresa e admin (lista em `ROUTE_INVENTORY.md`).
- Dados determinísticos: seed de teste fixo; mascarar datas relativas, contadores, avatares e conteúdo dinâmico.
- Fontes carregadas e animações desativadas antes da captura.
- Tolerância: `maxDiffPixelRatio: 0.001` para rotas existentes. Qualquer diff acima disso falha o CI.
- Baselines capturadas na Fase 0 a partir de `main` e versionadas.
- Alteração intencional: atualizar baseline **no mesmo PR**, com justificação e imagens antes/depois na descrição.

Inspeção manual adicional por fase: header, footer, sidebar, cards, hero, filtros, dashboard, modais, formulários, menu mobile.

## C7. Novas páginas — checklist de design QA (cada PR com UI)

- [ ] Usa o layout/shell existente (header, footer, sidebar, container, grelha).
- [ ] Usa apenas componentes e tokens existentes (ou extensões documentadas).
- [ ] Título, breadcrumbs e espaçamentos seguem o padrão de página existente.
- [ ] Funciona a 360 px sem scroll horizontal.
- [ ] Estados: loading (skeleton igual ao padrão atual), vazio (com ação), erro (sem stack trace, com repetir), sucesso.
- [ ] Teclado: tudo acessível por Tab, foco visível, Esc fecha modais.
- [ ] Contraste AA. Labels em todos os inputs. `aria-live` para mensagens assíncronas.
- [ ] Dark mode apenas se o site já suporta.
- [ ] Sem imagens de stock novas. Ilustrações apenas se já existir estilo de ilustração no produto.
- [ ] Texto no glossário (B7), centralizado.
- [ ] Screenshot 1440 e 375 anexados ao PR.

## C8. Header, footer, homepage

- **Header**: não alterar estrutura. Novas áreas entram como itens no menu existente ou no menu do utilizador autenticado. Máximo +1 item de topo no header público em toda a v2 (ex.: "Empresas" se não existir).
- **Footer**: manter estilo. Adicionar links (Segurança/Denunciar, Mercado de trabalho, Para empresas, Privacidade) nas colunas existentes.
- **Homepage**: não reconstruir. Permitido: corrigir números falsos, ligar pesquisa à nova pesquisa, adicionar faixa "Vagas recentes" se não existir, adicionar aviso de segurança curto. Reorganização maior só com proposta e aprovação humana (A4).

## C9. Preservação de rotas e SEO

- Nenhuma URL hoje válida devolve 404 depois da v2. Mudança de URL → **301** registado em `REDIRECTS.md` e implementado centralmente (config de redirects, não espalhado).
- Canonicals, titles e meta descriptions existentes preservados salvo melhoria justificada em `SEO_BASELINE.md`.
- Teste automático: script que percorre `ROUTE_INVENTORY.md` + sitemap atual e verifica que cada URL devolve 200 ou 301→200.

---

# PARTE D — ARQUITETURA TÉCNICA E PADRÕES OBRIGATÓRIOS

## D1. Descoberta antes de decidir (não presumir a stack)

Na Fase 0, identifica e documenta (com caminhos de ficheiros):

framework e versão · router e estrutura de rotas · renderização (SSR/SSG/ISR/CSR) · backend (API routes, server actions, servidor separado) · base de dados e ORM · migrações · autenticação (biblioteca, sessões/JWT, providers) · storage de ficheiros (público/privado) · pagamentos · email · WhatsApp/SMS · jobs/cron · analytics · error tracking · hosting e ambientes · CI · testes existentes · feature flags · i18n · admin/backoffice · roles atuais.

**Nunca presumas** Firebase, Supabase, PostgreSQL, Prisma, MongoDB, Stripe, NextAuth ou JWT sem ver no código.

## D2. Decisões condicionais pela stack encontrada

| Se encontrares | Então |
|---|---|
| PostgreSQL (direto, Supabase, Neon…) | Pesquisa com `tsvector` (config `portuguese`) + `unaccent` + `pg_trgm` para autocomplete. Enums nativos ou `CHECK`. Constraints únicas para deduplicação. RLS só se já usado. |
| MySQL | FULLTEXT + tabela de sinónimos; constraints únicas. |
| Firestore/Mongo (NoSQL) | Manter. Transições de estado com transações. Deduplicação com documento-chave determinístico (ex.: `applications/{jobId}_{candidateId}`). Pesquisa: índices compostos + campo `searchTokens[]` normalizado; só adotar motor externo se D2.1 se verificar. |
| ORM com migrações (Prisma, Drizzle, TypeORM…) | Todas as alterações de schema via migrações versionadas. |
| Sem sistema de migrações | Introduzir o mínimo (scripts versionados e idempotentes em `scripts/migrations/` com tabela de controlo). |
| Hosting serverless (ex.: Vercel) | Cron do host + fila em base de dados (tabela `Job`/`OutboxEvent` processada por cron a cada minuto). Não introduzir Redis só por isto. |
| Servidor persistente | Worker no mesmo repositório com fila em base de dados. |
| Auth com roles simples (`role` string no user) | Manter para CANDIDATE/ADMIN; roles de empresa passam para `OrganizationMembership` (D6). |

D2.1 — Motor de pesquisa externo (Algolia, Meilisearch, Typesense) só se: p95 da pesquisa > 300 ms com índices corretos **e** > 50 000 documentos ativos. Em STP isto não deverá acontecer na v2.

## D3. Camadas e organização de código

Regra: **nenhuma regra de negócio em componentes de UI.**

```
src/
  domain/                 # puro: sem I/O, sem framework. 100% testável.
    jobs/                 # enums, transições, qualityScore, duplicação, expiração
    applications/         # transições, snapshot builder, regras de reaplicação
    matching/             # eligibility, scoring, explanation
    organizations/        # verificação, membership, seats
    money/                # formatMoney, parse, conversões
    permissions/          # can(actor, action, resource)
    entitlements/         # canUseFeature(org|user, feature)
    moderation/           # riskScore, sinais
    shared/               # Result, erros de domínio, ids, datas
  server/
    services/             # orquestram domínio + repositórios + outbox (transação)
    repositories/         # acesso a dados
    jobs/                 # handlers de cron/fila
    notifications/        # dispatcher, canais, templates
    integrations/         # pagamentos, email, whatsapp, IA, storage
  app|pages/              # rotas (estrutura existente)
  components/             # estrutura existente
```

Adaptar nomes à estrutura existente; o princípio (domínio puro → serviços → rotas) é obrigatório.

## D4. Máquinas de estado — padrão de implementação único

Para cada entidade com ciclo de vida (Job, Application, Interview, Offer, VerificationRequest, Payment, Subscription, ModerationCase, TeamInvitation, Hire):

```ts
// domain/<entidade>/states.ts
export const JobStatus = { DRAFT: 'DRAFT', ... } as const;
export const JOB_TRANSITIONS: Record<JobStatus, Transition[]> = {
  DRAFT: [{ to: 'PENDING_REVIEW', actors: ['EMPLOYER'], guard: 'canSubmit' }, ...],
  ...
};
export function assertTransition(from, to, actor, ctx): Result<void, DomainError>;
```

Serviço que muda estado, **numa única transação**:
1. Lê a entidade com `version` (bloqueio otimista).
2. `assertTransition`.
3. Atualiza estado + `version + 1` + `updatedAt` + `updatedBy`.
4. Insere linha em `<Entidade>StatusHistory` (from, to, actorId, actorType, reason, notes, at).
5. Insere `OutboxEvent` (para notificações/analytics).
6. Insere `AuditLog` se a ação for sensível (H4).

Proibido: `status = 'closed'` em strings soltas; booleanos `isApproved/isRejected/isClosed` para processos com mais de 2 estados. Booleanos antigos são mantidos durante a migração (D7) e derivados do novo enum.

## D5. Outbox e efeitos secundários

- Toda ação de negócio grava o seu efeito principal e um `OutboxEvent` na mesma transação.
- Um processador (cron a cada minuto) consome eventos e despacha: email, WhatsApp, in-app, analytics, recálculo de matching.
- Falha em email/WhatsApp/IA **nunca** faz falhar a candidatura, a publicação ou o pagamento.
- Retries com backoff exponencial (1m, 5m, 30m, 2h, 12h), máximo 5; depois `DEAD` + alerta no admin.
- Cada handler é idempotente (chave `eventId + handler`).

## D6. Multi-organização (multi-tenancy)

- `OrganizationMembership(userId, organizationId, role, status, invitedBy, joinedAt)`; único por (userId, organizationId).
- Um utilizador pode pertencer a várias organizações; a UI tem seletor de organização ativa no dashboard (componente existente de dropdown).
- Toda query de dados de empresa é filtrada por `organizationId` **no servidor** a partir da membership, nunca a partir de parâmetro do cliente sem verificação.
- Migração: se hoje existe 1 user = 1 empresa, criar membership `OWNER` para cada par existente. O campo antigo mantém-se como leitura até à fase contract.

## D7. Migrações: padrão expand → migrate → contract

1. **Expand**: adicionar colunas/tabelas novas, nullable ou com default. Código novo escreve nos dois (dual-write) e lê do novo com fallback ao antigo.
2. **Migrate**: script de backfill idempotente, em lotes (ex.: 500), com relatório (processados, convertidos, ambíguos → fila de revisão).
3. **Verify**: query de verificação documentada (contagens antes/depois).
4. **Contract**: remover campos antigos **só** numa fase posterior, com aprovação humana (A4), depois de pelo menos 2 semanas em produção sem leituras do campo antigo.

Cada migração em `MIGRATIONS.md`:

| Campo antigo | Campo novo | Conversão | Ambíguos | Fallback de leitura | Rollback |
|---|---|---|---|---|---|

Backup completo da base de dados **antes** de cada migrate em produção. Rollback testado em staging.

## D8. Idempotência

- Tabela `IdempotencyKey(key, scope, actorId, requestHash, response, createdAt, expiresAt 24h)`.
- Obrigatória em: submeter candidatura, criar pagamento, webhook de pagamento, enviar convite, enviar oferta, confirmar contratação, publicar vaga.
- O cliente gera a chave (UUID) por intenção de submissão; duplo clique ou retry de rede devolve a mesma resposta.
- Além disso, constraints de unicidade na base de dados (a idempotência aplicacional não substitui a constraint).

## D9. Feature flags

- Se já existir sistema de flags, usar. Senão: tabela `FeatureFlag(key, enabled, rolloutPercent, allowOrgIds[], allowUserIds[], environments[])` + função `isEnabled(key, ctx)` com cache curto (60 s). Sem dependência SaaS nova.
- Flags iniciais (todas `false` em produção):

```
V2_JOB_LIFECYCLE
V2_APPLICATION_SNAPSHOT
V2_CANDIDATE_TRACKING
V2_EMPLOYER_ATS
V2_SCREENING
V2_INTERVIEWS_OFFERS
V2_MATCHING
V2_TALENT_POOL
V2_INVITE_TO_APPLY
V2_VERIFICATION
V2_MODERATION
V2_NOTIFICATIONS_WHATSAPP
V2_SEARCH
V2_SEO_PAGES
V2_PAYMENTS
V2_CAREER_PLUS
V2_MARKET_INSIGHTS
V2_AI_ASSIST
KILL_AI            # desativa tudo o que chama IA
KILL_WHATSAPP
KILL_OUTBOUND_EMAIL_MARKETING
```

- Flags `KILL_*` são de emergência e DEVEM existir desde a Fase 1.
- Remover flags 30 dias após 100 % de rollout estável (ticket automático em `CHANGELOG_V2.md`).

## D10. Performance (orçamentos que falham o CI)

Medidos em perfil "telemóvel médio, 4G lento" (Lighthouse CI ou equivalente), páginas públicas:

| Métrica | Limite |
|---|---|
| LCP | ≤ 2,5 s |
| INP | ≤ 200 ms |
| CLS | ≤ 0,1 |
| TTFB (páginas de vaga) | ≤ 600 ms |
| JS inicial (gzip) páginas públicas | ≤ 170 KB e nunca > baseline + 10 % |
| Peso total página de vaga | ≤ 500 KB |

- Lazy loading obrigatório para: gráficos, editor de texto rico, gerador/visualizador de PDF, Kanban, analytics, mapas.
- Páginas de vaga, categoria, localização e empresa: renderizadas no servidor com cache/revalidação (ex.: ISR 5 min + invalidação ao mudar estado).
- Listas sempre paginadas no servidor: cursor, `pageSize` 20 por defeito, máximo 100.
- Proibido filtrar milhares de registos no cliente.
- Índices obrigatórios documentados por query crítica (lista de vagas públicas, candidaturas por vaga e estado, candidaturas do candidato, pesquisa de talentos).

## D11. Observabilidade

- Logger estruturado único (JSON: `level`, `msg`, `requestId`, `userId` hash, `orgId`, `route`, `durationMs`, `errorCode`). Se já existir, usar.
- `console.log` proibido em código novo de servidor (lint).
- Error tracking (usar o existente; se não houver, propor Sentry ou equivalente em ADR — não instalar com DSN de produção sem aprovação).
- Nunca logar PII em claro: emails, telefones, conteúdo de CV, documentos, notas internas. Usar hash ou ids.
- Health check `/api/health` (DB, storage, fila: idade do evento mais antigo do outbox).
- Alertas mínimos: outbox com evento pendente > 15 min; cron sem correr > 2 h; taxa de erro 5xx > 2 % em 10 min; webhook de pagamento a falhar.

## D12. Background jobs (cron)

| Job | Frequência | Função |
|---|---|---|
| `processOutbox` | 1 min | Despachar eventos |
| `expireJobs` | 15 min | PUBLISHED com `expiresAt` < agora → EXPIRED |
| `jobExpiryWarnings` | diário 08:00 STP | Aviso a 7 e 2 dias da expiração |
| `employerSilenceReminders` | diário 09:00 STP | Lembretes D+5, D+10, flag D+15 (dias úteis) |
| `interviewReminders` | 15 min | 24 h e 2 h antes |
| `offerExpiry` | 15 min | SENT com `expiresAt` < agora → EXPIRED |
| `savedJobDeadlineReminders` | diário 08:00 | Vagas guardadas com prazo em 2 dias |
| `jobAlertsDigest` | diário 08:00 / semanal segunda | Alertas de vagas |
| `externalSourceCheck` | diário | Verificar vagas curadas (F1.7) |
| `hireConfirmationFollowUp` | diário | Pergunta ao candidato 30 dias após contratação |
| `retentionEnforcement` | diário 03:00 | Aplicar H6 |
| `subscriptionLifecycle` | horário | PAST_DUE, EXPIRED, grace periods |
| `marketplaceMetricsSnapshot` | diário 02:00 | Materializar métricas G4 |
| `idempotencyCleanup` | diário | Apagar chaves expiradas |

Regras: cada job idempotente, com lock (para não correr em paralelo), log de início/fim/contagens, e **nenhum job pode bloquear o fluxo principal de candidatura** se falhar.

## D13. Rate limiting

Se existir infraestrutura, usar; senão, implementação em base de dados (janela deslizante) — suficiente para a escala.

| Ação | Limite | Chave |
|---|---|---|
| Login | 5 / 15 min | conta + IP |
| Registo | 5 / hora | IP |
| Pedido OTP (SMS/WhatsApp) | 3 / 10 min, 10 / dia | número |
| Reset palavra-passe | 3 / hora | conta |
| Candidatura | 5 / 10 min e 25 / 24 h | candidato |
| Upload | 20 / hora | utilizador |
| Mensagem/contacto mediado | 30 / dia | utilizador |
| Convite a candidatar-se | ver F5.4 | organização |
| Denúncia | 10 / dia | utilizador |
| Pesquisa | 60 / min | IP |
| Pesquisa de talentos | 120 / hora | organização |
| Exportação | 10 / dia | organização |

Resposta: HTTP 429 com mensagem humana em PT ("Fez muitas tentativas. Tente novamente dentro de X minutos."). O limite de candidaturas é **segurança anti-spam, nunca monetização**; não existe forma de pagar para o aumentar.

## D14. Segurança aplicacional

- Autorização **sempre no servidor**: cada rota/endpoint/server action chama `can(actor, action, resource)`; ocultar botões é UX, não segurança.
- Teste de IDOR obrigatório por recurso (H3).
- Uploads: validar extensão + MIME real (magic bytes) + tamanho; CV: PDF, DOC, DOCX ≤ 5 MB; imagens ≤ 2 MB (JPG, PNG, WebP), re-codificadas no servidor (remove EXIF/GPS); documentos de verificação: PDF/JPG/PNG ≤ 10 MB. Antivírus se a infraestrutura permitir (ADR).
- Ficheiros privados: bucket privado; acesso via URL assinada com TTL 5 min gerada após `can()`; cada acesso a documento de verificação ou CV por empresa → `AuditLog`.
- CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, cookies `HttpOnly; Secure; SameSite=Lax`.
- Proteção CSRF conforme o framework.
- Sanitização de HTML em descrições de vagas (allowlist: p, ul, ol, li, strong, em, a[href] com `rel="nofollow noopener ugc"`, h3, h4, br).
- Links externos em vagas: verificados contra lista de domínios de encurtadores e suspeitos (F1.6).
- Segredos só em variáveis de ambiente; nada no repositório; rotação documentada no RUNBOOK.

## D15. Backups e continuidade

- Backup diário da base de dados, retenção 30 dias; backup semanal retido 6 meses.
- **Teste de restauro** mensal documentado no RUNBOOK (um backup que nunca foi restaurado não conta).
- RPO 24 h, RTO 4 h.
- Ambientes: `development`, `staging` (dados semeados ou anonimizados — **nunca** cópia de produção com PII), `production`.

## D16. API

- Não quebrar endpoints usados pelo frontend atual. Manter uma única árvore `pages/api`, organizada por recurso, sem subpasta de versão. Alterações incompatíveis → novo endpoint na mesma árvore; endereços anteriores podem encaminhar temporariamente para os mesmos handlers até deixar de haver tráfego, sem duplicar implementação.
- Erros com formato único: `{ error: { code: 'APPLICATION_DEADLINE_PASSED', message: 'O prazo de candidatura terminou.' } }`. Códigos estáveis em inglês, mensagens em PT.
- Nunca devolver stack traces, queries ou ids internos sensíveis ao cliente.

---

# PARTE E — MODELO DE DOMÍNIO E MÁQUINAS DE ESTADO

Notação neutra. Traduzir para o ORM/BD existente. `?` = opcional. Todas as entidades têm `id`, `createdAt`, `updatedAt` (UTC); entidades editáveis por humanos têm `createdBy`, `updatedBy`; entidades com estado têm `version` (bloqueio otimista).

## E1. Dono dos dados (ownership)

| Entidade | Dono | Quem mais pode ler | Notas |
|---|---|---|---|
| CandidateProfile, CV, documentos | Candidato | Empresas só via candidatura ou Talent Pool consentido; admin com motivo | Candidato pode exportar/apagar (H5) |
| Application | Partilhada: candidato (a sua parte) + organização (processo) | Admin | Snapshot imutável; candidato pode retirar, não apagar o histórico da empresa |
| Notas internas, avaliações | Organização | Membros da organização com permissão | **Nunca** visíveis ao candidato |
| Job | Organização | Público quando PUBLISHED | |
| Organization | Organização (OWNER) | Público: perfil; privado: faturação, documentos | |
| Interview, Offer | Organização | Candidato (campos visíveis) | |
| VerificationRequest + documentos | Requerente | Revisores/admin | Documentos apagados após decisão (H6) |
| Report | Plataforma | Moderadores | Identidade do denunciante nunca revelada ao denunciado |
| AuditLog | Plataforma | Admin | Append-only |
| Payment, Invoice | Plataforma + organização pagadora | | Retenção fiscal |

## E2. Entidades

### Identidade e consentimento

```
User
  email? (único, normalizado), emailVerifiedAt?
  phone? (E.164, único), phoneVerifiedAt?
  passwordHash? | providers[]
  platformRole: CANDIDATE | ADMIN | MODERATOR | REVIEWER | NONE
  status: ACTIVE | SUSPENDED | PENDING_DELETION | DELETED
  timezone (default Africa/Sao_Tome), locale (default pt-ST)
  lastLoginAt
  -- pelo menos um de email/phone obrigatório

TermsAcceptance(userId, documentType: TERMS|PRIVACY|EMPLOYER_TERMS, version, acceptedAt, ipHash)
Consent(userId, purpose: TALENT_POOL|MARKETING_EMAIL|MARKETING_WHATSAPP|AI_PROCESSING|JOB_ALERTS,
        granted: bool, version, source, at)   -- append-only; estado atual = último registo
```

### Candidato

```
CandidateProfile(userId PK)
  firstName, lastName                 -- nunca usado no matching
  headline?, bio?
  district?, locality?, willingToRelocate: NO|SAME_ISLAND|ANY
  availability: IMMEDIATE | WITHIN_2_WEEKS | WITHIN_1_MONTH | NEGOTIABLE | NOT_LOOKING
  availableFrom?
  employmentTypesWanted[], workModesWanted[], categoriesWanted[]
  salaryExpectationMinor?, salaryExpectationCurrency?, salaryExpectationPeriod?   -- SENSITIVE
  visibility: PRIVATE | VERIFIED_EMPLOYERS | PUBLIC   -- default PRIVATE até consentimento (F5.1)
  hasDrivingLicense: bool, drivingLicenseCategories[]
  completeness (0–100, calculado)
  dateOfBirth?    -- se existir hoje: SENSITIVE, nunca no matching, nunca visível a empresas
  photoUrl?       -- nunca no matching; visível a empresas só se candidato permitir
  gender?         -- se existir hoje: SENSITIVE, apenas para estatística agregada com consentimento; nunca no matching

ProfileExperience(profileId, title, organizationName, categoryId?, district?|country?,
                  startDate (mês/ano), endDate?|current, description?, skills[])
ProfileEducation(profileId, level, institution, field?, startYear?, endYear?, completed: bool)
EducationLevel (ordinal): NENHUM < ENSINO_BASICO < ENSINO_SECUNDARIO < TECNICO_PROFISSIONAL
                          < BACHARELATO < LICENCIATURA < POS_GRADUACAO < MESTRADO < DOUTORAMENTO
ProfileLanguage(profileId, language: PT|FR|EN|ES|FORRO|LUNGWA_N_GOLA|LUNGWIE|CRIOULO_CV|OUTRA,
                level: BASICO|INTERMEDIO|AVANCADO|NATIVO)
ProfileCertification(profileId, name, issuer, issuedAt?, expiresAt?, verificationId?)
ProfileProject(profileId, title, description, url?)
CandidateSkill(profileId, skillId, source: SELF|CV_PARSE|VERIFIED, yearsExperience?)

CVDocument(profileId, label, kind: BUILT|UPLOADED, fileKey?, builtData? (JSON), templateId?,
           isDefault, status: ACTIVE|ARCHIVED)
```

### Organização

```
Organization
  name, legalName?, slug (único, estável), type (B8), nif?, website?, emailDomain?
  logoKey?, description?, sectorCategoryId?, district?, size?: 1-9|10-49|50-249|250+
  verificationLevel: REGISTERED | CONTACT_VERIFIED | ORGANIZATION_VERIFIED | TRUSTED_PARTNER
  status: ACTIVE | SUSPENDED | MERGED | CLOSED
  mergedIntoId?, claimedAt?, createdSource: SELF_SIGNUP | EMPREGOSTP_CURATED | ADMIN

OrganizationMembership(userId, organizationId, role: OWNER|ADMIN|RECRUITER|REVIEWER,
                       status: ACTIVE|REMOVED, invitedBy?, joinedAt)
  -- exatamente 1 OWNER ativo por organização (constraint ou verificação transacional)
TeamInvitation(organizationId, email, role, tokenHash, status, expiresAt (7 dias), invitedBy)
```

### Vaga

```
Job
  organizationId, createdByUserId
  title, slug, shortId (8 chars base32, imutável)
  categoryId, secondaryCategoryIds[≤2]
  description (HTML sanitizado), responsibilities[] , requirements[], preferredRequirements[]
  skillsRequired[skillId], skillsPreferred[skillId]
  district?, locality?, workMode, employmentType, seniority
  experienceMinYears?, educationLevelMin?
  languagesRequired[{language, minLevel}]
  vacanciesCount (default 1, 1–500)
  salaryType: FIXED | RANGE | FROM | NEGOTIABLE | UNDISCLOSED
  salaryMinMinor?, salaryMaxMinor?, salaryCurrency (default STN),
  salaryPeriod?: HOUR | DAY | MONTH | YEAR
  applicationMethod: INTERNAL | EXTERNAL_URL | EXTERNAL_EMAIL
  externalApplyUrl?, externalApplyEmail?
  applicationDeadline? (UTC, ver B4), startDate?
  sourceType: EMPLOYER_DIRECT | EMPREGOSTP_CURATED | PARTNER_FEED
  sourceUrl?, sourceName?, sourceStatus?: ACTIVE|INACTIVE|UNKNOWN, lastCheckedAt?, lastActiveAt?
  status (E3), closeOutcome? (F1.9)
  qualityScore (0–100), qualityBreakdown (JSON), riskScore (0–100), riskSignals[]
  isFeatured (pago, F7), featuredUntil?
  onBehalfOfClient?: string | CONFIDENTIAL   -- só agências
  publishedAt?, expiresAt?, closedAt?, archivedAt?
  currentVersionId, version
  duplicateOfJobId?
  legacy fields mantidos até contract (D7)

JobVersion(jobId, versionNumber, snapshot (JSON integral da vaga), createdAt, createdBy)
  -- nova versão a cada publicação e a cada edição material (F1.3)

JobHardRequirement(jobId, type, params (JSON), label)
  type: DRIVING_LICENSE{category} | CERTIFICATION{name|skillId} | EDUCATION_MIN{level}
      | LANGUAGE_MIN{language, level} | WORK_AUTHORIZATION_STP | MIN_EXPERIENCE{years}
      | AVAILABILITY_BY{date} | LOCATION_ISLAND{island} | OTHER{text}

ScreeningQuestion(jobId, order, type: BOOLEAN|SINGLE_CHOICE|MULTIPLE_CHOICE|NUMBER|TEXT,
                  label, options[]?, required, knockout?: {expected} , maxLength?)

JobStatusHistory(jobId, from, to, actorId?, actorType: USER|SYSTEM|MODERATOR, reason?, at)
SavedJob(userId, jobId, createdAt)  -- único (userId, jobId)
JobAlert(userId, query, filters (JSON), frequency: DAILY|WEEKLY|INSTANT, channels[], active)
ExternalApplyClick(jobId, userId?, sessionHash, at, utm (JSON))
```

### Candidatura e processo

```
Application
  jobId, jobVersionId, candidateUserId, organizationId (desnormalizado para filtros/segurança)
  status (E4), closedReason?
  cvDocumentId, cvSnapshotKey (cópia do ficheiro/PDF gerado no momento) , cvSnapshotData?
  candidateSnapshot (JSON: perfil no momento — sem campos SENSITIVE exceto os que o candidato escolheu partilhar)
  jobSnapshot (JSON: a vaga tal como o candidato a viu)
  answersSnapshot (JSON)
  matchSnapshot (JSON: score, breakdown, eligibility, algorithmVersion, weightsVersion, computedAt)
  coverLetter?
  knockoutFailed: bool, hardRequirementsNotMet[]
  source: organic|search|social|whatsapp|email|direct|partner|invite|alert ; utm (JSON)
  inviteId?
  submittedAt, firstViewedAt?, lastStatusChangeAt
  rating? (1–5, interno), tags[] (internos)
  version
  -- UNIQUE (jobId, candidateUserId)

ApplicationStatusHistory(applicationId, from, to, actorId?, actorType, closedReason?,
                         candidateVisibleNote?, internalNote?, at)
ApplicationNote(applicationId, authorId, body, visibility: INTERNAL, createdAt)  -- nunca ao candidato

Interview(applicationId, organizationId, type: PRESENCIAL|TELEFONE|VIDEO,
          startsAt (UTC), durationMin, timezone, location?, meetingUrl?,
          interviewerUserIds[], status (E6), candidateMessage?, internalNotes?,
          rescheduleCount, version)
InterviewFeedback(interviewId, authorId, recommendation: AVANCAR|DUVIDA|NAO_AVANCAR, notes) -- interno

Offer(applicationId, organizationId, title, employmentType, startDate?, salaryMinor?, salaryCurrency?,
      salaryPeriod?, message, expiresAt (default +7 dias), status (E7), respondedAt?, declineReason?, version)

Hire(applicationId, jobId, organizationId, candidateUserId, startDate?, confirmedByEmployerAt,
     candidateConfirmation: PENDING|CONFIRMED|DISPUTED|NO_RESPONSE, candidateConfirmedAt?,
     attributionSource, status: ACTIVE|ANNULLED)
```

### Talent pool

```
TalentInvite(organizationId, jobId (obrigatório), candidateUserId, sentByUserId, message (≤ 600),
             status: SENT|VIEWED|ACCEPTED|DECLINED|EXPIRED, expiresAt (+14 dias))
  -- UNIQUE (jobId, candidateUserId)
TalentSavedList(organizationId, name) / TalentSavedListItem(listId, candidateUserId)
ProfileView(organizationId, viewerUserId, candidateUserId, at)   -- candidato vê contagem agregada
```

### Confiança e segurança

```
VerificationRequest(subjectType: ORGANIZATION|CANDIDATE, subjectId,
                    kind: ORG_CONTACT|ORG_DOCUMENTS|IDENTITY|EDUCATION|EXPERIENCE|CERTIFICATION,
                    status (E8), documents[{fileKey, type, sha256}], submittedAt, reviewerId?,
                    decidedAt?, decisionReason?, expiresAt?)
Report(reporterUserId?, targetType: JOB|ORGANIZATION|USER|MESSAGE|APPLICATION|INTERVIEW,
       targetId, reason: ASKED_FOR_MONEY|FAKE_JOB|PHISHING|HARASSMENT|DISCRIMINATION|SPAM
                       |INAPPROPRIATE|DUPLICATE|EXPIRED_STILL_LISTED|OTHER,
       details?, evidenceKeys[], priority: P1|P2|P3, status (E9))
ModerationCase(targetType, targetId, openedBy: REPORT|AUTO_RISK|ADMIN, reportIds[],
               status (E9), assigneeId?, decision?, decisionReason?, appealOf?)
AuditLog(actorId?, actorType, action, resourceType, resourceId, organizationId?, metadata (JSON sem PII),
         ipHash?, at)   -- append-only, sem UPDATE/DELETE
```

### Comunicação

```
OutboxEvent(type, payload (JSON com ids), status: PENDING|PROCESSING|DONE|FAILED|DEAD,
            attempts, nextAttemptAt, lastError?)
Notification(userId, type, title, body, link, channel, status, readAt?, sentAt?)
NotificationPreference(userId, eventType, channel, enabled)
MessageThread / Message  -- contacto mediado (F5.5); apenas se ativado
```

### Comercial

```
Plan(code, name, audience: EMPLOYER|CANDIDATE, priceMinor, currency, billingPeriod: ONE_OFF|MONTH|YEAR,
     entitlements (JSON), active, version)
Subscription(subjectType, subjectId, planCode, planVersion, status (E11), currentPeriodStart, currentPeriodEnd,
             cancelAtPeriodEnd, trialEndsAt?, graceEndsAt?)
Payment(subjectType, subjectId, purpose: JOB_POST|SUBSCRIPTION|FEATURED|CAREER_PLUS|ASSISTED_RECRUITMENT,
        amountMinor, currency, provider: <existente>|MANUAL_TRANSFER, providerRef?, status (E10),
        proofFileKey?, confirmedBy?, idempotencyKey, version)
PaymentWebhookEvent(provider, providerEventId UNIQUE, payload, processedAt?, result)
Invoice(number (série anual sequencial, imutável), paymentId, issuedTo (dados fiscais), lines, totals,
        taxRate (config), pdfKey, issuedAt, status: ISSUED|VOIDED)
EntitlementGrant(subjectType, subjectId, feature, quantity?, source: PLAN|PURCHASE|PROMO|ADMIN,
                 validFrom, validUntil?)
JobCredit(organizationId, quantity, source, expiresAt?)  -- créditos de publicação
```

## E3. Máquina de estados — Vaga (Job)

| De | Para | Quem | Condição / efeitos |
|---|---|---|---|
| — | DRAFT | Empregador | Criação |
| DRAFT | PUBLISHED | Empregador | `qualityScore ≥ 50` **e** `riskScore < 40` **e** org ≥ CONTACT_VERIFIED **e** org já tem ≥ 1 vaga aprovada **e** entitlement de publicação disponível. Cria JobVersion, `publishedAt`, `expiresAt` (F1.5) |
| DRAFT | PENDING_REVIEW | Empregador / Sistema | Qualquer condição acima falha exceto entitlement e qualidade. Primeira vaga de qualquer organização vai **sempre** para revisão |
| PENDING_REVIEW | PUBLISHED | Moderador | Aprovação |
| PENDING_REVIEW | DRAFT | Moderador | "Devolvida para correções" com motivo visível ao empregador |
| PENDING_REVIEW | REJECTED | Moderador | Fraude/violação; motivo obrigatório; abre ModerationCase |
| REJECTED | DRAFT | Empregador | Só se rejeição permitir reedição (`decision = FIXABLE`) |
| PUBLISHED | PAUSED | Empregador | Deixa de aparecer em pesquisas; candidaturas bloqueadas; prazo não é estendido |
| PAUSED | PUBLISHED | Empregador | Só se `applicationDeadline` futuro |
| PUBLISHED / PAUSED | CLOSED | Empregador | `closeOutcome` obrigatório (F1.9) |
| PUBLISHED / PAUSED | FILLED | Empregador / Sistema | Contratações confirmadas = `vacanciesCount`; sistema **propõe**, empregador confirma |
| PUBLISHED | EXPIRED | Sistema | `expiresAt` ou `applicationDeadline` ultrapassado |
| EXPIRED | PUBLISHED | Empregador | Renovação até 30 dias após expirar; nova data obrigatória; consome entitlement se aplicável |
| EXPIRED | CLOSED | Empregador | Com `closeOutcome` |
| PUBLISHED / PAUSED | PENDING_REVIEW | Moderador / Sistema | Suspensão por denúncia P1 ou edição material de alto risco |
| CLOSED / FILLED / EXPIRED / REJECTED | ARCHIVED | Sistema / Empregador | Automático 12 meses após fecho |

Invariantes:
- Só `PUBLISHED` aceita candidaturas e aparece em pesquisa, sitemap e JSON-LD.
- `applicationDeadline` passado ⇒ candidatura recusada **no servidor** (`APPLICATION_DEADLINE_PASSED`), mesmo que o cron ainda não tenha corrido.
- Vagas nunca são apagadas fisicamente se tiverem candidaturas. DRAFT sem candidaturas pode ser apagada.
- Ao passar a CLOSED/FILLED/EXPIRED: candidaturas não terminais recebem tratamento F2.8.

## E4. Máquina de estados — Candidatura (Application)

Estados: `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `SHORTLISTED`, `INTERVIEW`, `OFFER`, `HIRED`, `REJECTED`, `WITHDRAWN`, `OFFER_DECLINED`.

> Decisão: o estado `RECEIVED` do prompt anterior é eliminado como estado guardado. "Recebida" é o rótulo de `SUBMITTED` para o candidato. A primeira abertura pelo recrutador move automaticamente para `UNDER_REVIEW` (actor SYSTEM, `firstViewedAt`). Isto dá ao candidato um sinal real e mede o tempo de resposta.

| De | Para | Quem | Notas |
|---|---|---|---|
| — | DRAFT | Candidato | Rascunho guardado (servidor) |
| DRAFT | SUBMITTED | Candidato | Validações F2.2; snapshot criado; idempotente |
| SUBMITTED | UNDER_REVIEW | Sistema (1.ª visualização) / Recrutador | |
| SUBMITTED / UNDER_REVIEW | SHORTLISTED | Recrutador | |
| UNDER_REVIEW / SHORTLISTED | INTERVIEW | Recrutador | Normalmente ao marcar entrevista |
| SHORTLISTED / INTERVIEW | OFFER | Recrutador | Ao enviar Offer |
| OFFER | HIRED | Sistema | Offer ACCEPTED **e** empregador confirma contratação (cria Hire) |
| OFFER | OFFER_DECLINED | Sistema | Offer DECLINED ou EXPIRED |
| OFFER_DECLINED | SHORTLISTED | Recrutador | Permite nova oferta futura |
| INTERVIEW | SHORTLISTED / UNDER_REVIEW | Recrutador | Recuo permitido com motivo |
| qualquer não terminal | REJECTED | Recrutador / Sistema | `closedReason` obrigatório |
| qualquer não terminal | WITHDRAWN | Candidato | Motivo opcional |
| REJECTED | UNDER_REVIEW | EMPLOYER_ADMIN/OWNER | Só até 14 dias depois; correção de erro (ex.: lote errado); audit |
| HIRED | (anulação) | ADMIN | `Hire.status = ANNULLED`, application → REJECTED `closedReason = HIRE_ANNULLED`; audit |

`closedReason` (REJECTED): `NOT_SELECTED`, `HARD_REQUIREMENT_NOT_MET`, `KNOCKOUT_ANSWER`, `POSITION_FILLED`, `POSITION_CLOSED`, `POSITION_CANCELLED`, `DUPLICATE`, `SPAM`, `HIRE_ANNULLED`, `OTHER`.

Rótulos para o candidato (decisão: **não expor shortlist** — cria expectativa falsa e pressão; é um estado interno de triagem):

| Interno | Candidato vê |
|---|---|
| DRAFT | Rascunho |
| SUBMITTED | Recebida |
| UNDER_REVIEW, SHORTLISTED | Em análise |
| INTERVIEW | Entrevista |
| OFFER | Proposta recebida |
| HIRED | Contratado(a) |
| REJECTED (NOT_SELECTED, HARD_REQUIREMENT_NOT_MET, KNOCKOUT_ANSWER) | Não selecionada |
| REJECTED (POSITION_FILLED/CLOSED/CANCELLED) | Processo encerrado |
| WITHDRAWN | Retirada |
| OFFER_DECLINED | Proposta recusada |

O candidato vê uma **linha temporal** com data de cada mudança e as `candidateVisibleNote`. Nunca vê notas internas, rating, tags, feedback de entrevista, score detalhado da empresa.

## E5. Contratação (Hire) e confirmação

1. Offer ACCEPTED → empregador recebe pedido "Confirmar contratação" com data de início.
2. Empregador confirma → `Hire` criado, application `HIRED`, conta para a North Star.
3. 30 dias após `startDate` (ou após confirmação se sem data): candidato recebe "Começou a trabalhar na <org>?" → `CONFIRMED` / `DISPUTED` / sem resposta em 14 dias = `NO_RESPONSE`.
4. `DISPUTED` abre ModerationCase P3.
5. Contratações registadas fora da Offer (empregador marca HIRED diretamente a partir de INTERVIEW/SHORTLISTED) são permitidas — o mercado é informal — mas criam Hire com `source = DIRECT_MARK` e seguem o mesmo passo 3.

## E6. Entrevista (Interview)

`SCHEDULED` → `CONFIRMED` (candidato confirma) · `SCHEDULED/CONFIRMED` → `RESCHEDULE_REQUESTED` (candidato pede, com proposta) → `SCHEDULED` (recrutador marca nova hora; `rescheduleCount++`) · `SCHEDULED/CONFIRMED` → `CANCELLED` (qualquer lado, motivo) · `SCHEDULED/CONFIRMED` → `COMPLETED` | `NO_SHOW` (recrutador, após `startsAt`).

- Lembretes: 24 h e 2 h antes (candidato e entrevistadores).
- Anexo `.ics` em email; link "Adicionar ao calendário".
- `rescheduleCount ≥ 3` → aviso ao recrutador.
- Mostrar sempre a hora no fuso do destinatário com o fuso explícito.

## E7. Oferta (Offer)

`DRAFT` → `SENT` → `ACCEPTED` | `DECLINED` | `EXPIRED` | `WITHDRAWN` (empregador, antes de resposta).

- `expiresAt` default 7 dias, 1–30 configurável.
- A oferta na plataforma é uma **comunicação**, não um contrato legal — mostrar nota curta.
- Uma application tem no máximo 1 Offer `SENT` ativa.

## E8. Verificação (VerificationRequest)

`DRAFT` → `PENDING` → `IN_REVIEW` → `APPROVED` | `REJECTED` | `NEEDS_MORE_INFO` → (`PENDING`) · `APPROVED` → `EXPIRED` (quando `expiresAt`, ex.: certificação) · `APPROVED` → `REVOKED` (admin, fraude).

Efeito em `Organization.verificationLevel`:
- `ORG_CONTACT` aprovado → `CONTACT_VERIFIED`. Aprovação automática se: email verificado em domínio próprio igual ao website **ou** telefone verificado por OTP + website ativo. Caso contrário, revisão manual.
- `ORG_DOCUMENTS` aprovado → `ORGANIZATION_VERIFIED`. Documentos aceites: certidão de registo comercial, documento de NIF, alvará, estatutos (ONG), carta oficial (organização internacional/instituição pública). Formato de NIF validado por regex **configurável** (não codificar formato sem confirmação).
- `TRUSTED_PARTNER`: apenas manual por admin, critérios orientadores: ≥ 6 meses ativa, ≥ 3 contratações confirmadas, 0 denúncias procedentes, taxa de resposta ≥ 70 %.

SLA: pedidos `PENDING` > 2 dias úteis aparecem a vermelho no admin; o requerente vê sempre o estado e o prazo estimado.

## E9. Denúncia e moderação

Report: `OPEN` → `TRIAGED` → (ligado a ModerationCase) → `RESOLVED_ACTION_TAKEN` | `RESOLVED_NO_ACTION` | `DUPLICATE`.

ModerationCase: `OPEN` → `IN_REVIEW` → `DECIDED` → (`APPEALED` → `APPEAL_DECIDED`).

Prioridades e SLA:

| Motivo | Prioridade | Ação automática imediata | SLA |
|---|---|---|---|
| ASKED_FOR_MONEY ("Pediram-me dinheiro") | P1 | Se ≥ 2 denúncias independentes **ou** 1 denúncia + riskScore ≥ 40: vaga → PENDING_REVIEW (oculta) | 24 h |
| PHISHING, FAKE_JOB | P1 | Idem | 24 h |
| HARASSMENT, DISCRIMINATION | P1 | Nenhuma automática; revisão humana | 24 h |
| SPAM, DUPLICATE, INAPPROPRIATE | P2 | — | 3 dias úteis |
| EXPIRED_STILL_LISTED, OTHER | P3 | — | 7 dias úteis |

Decisões possíveis: sem ação · aviso · editar/ocultar conteúdo · rejeitar vaga · suspender organização (F1.10) · suspender utilizador · banir. Toda decisão: motivo, autor, data, AuditLog. Recurso permitido 1 vez por decisão, em 14 dias, decidido por moderador diferente.

O denunciante recebe "Recebemos a sua denúncia" e, no fim, "A sua denúncia foi analisada" (sem detalhes da sanção).

## E10. Pagamento (Payment)

`PENDING` → `PROCESSING` → `PAID` | `FAILED` · `PENDING` → `CANCELLED` · `PAID` → `REFUNDED` (parcial ou total, admin) · Manual: `PENDING` → `AWAITING_CONFIRMATION` (comprovativo enviado) → `PAID` (admin confirma) | `FAILED`.

- Entitlements só são concedidos em `PAID`, dentro da mesma transação que muda o estado, protegidos por idempotência (`PaymentWebhookEvent.providerEventId` único; `EntitlementGrant` com chave única `paymentId + feature`).
- Webhook recebido duas vezes → segunda é no-op, devolve 200.
- `PENDING` > 72 h → `CANCELLED` automático (manual: 7 dias).

## E11. Subscrição (Subscription)

`TRIAL` → `ACTIVE` · `ACTIVE` → `PAST_DUE` (falha de renovação) → `ACTIVE` (pagamento) | `EXPIRED` (fim do período de graça 14 dias) · `ACTIVE` → `CANCELLED` (cancelAtPeriodEnd; mantém acesso até ao fim) → `EXPIRED`.

Em `EXPIRED`/downgrade: **nenhum dado é apagado**. ATS histórico continua legível; ações premium ficam bloqueadas com mensagem e caminho de upgrade. Vagas publicadas mantêm-se até expirarem. Seats acima do limite: membros extra ficam só leitura; **o OWNER nunca perde acesso**.

## E12. Convite de equipa (TeamInvitation)

`PENDING` → `ACCEPTED` | `EXPIRED` (7 dias) | `REVOKED`.
- Só aceita quem tem email verificado **igual** ao convidado.
- Quem convida só pode atribuir role ≤ ao seu (ADMIN não cria OWNER; RECRUITER não convida).
- Transferência de OWNER: OWNER escolhe ADMIN ativo → confirmação por email de ambos → antigo OWNER passa a ADMIN. Audit.

---

# PARTE F — REGRAS DE NEGÓCIO POR DOMÍNIO

## F1. Vagas

### F1.1 Uma função por vaga
- Detetar no título: `/`, ` ou `, ` e ` entre dois cargos, `,` entre cargos, lista de cargos conhecidos (taxonomia). Se detetado → bloquear publicação com mensagem: "Cada anúncio deve corresponder a uma única função. Crie uma vaga para cada função." + botão **"Dividir em várias vagas"** que duplica o rascunho N vezes com cada título.
- Exceção: cargo composto legítimo ("Técnico de Redes e Sistemas") — o moderador pode aprovar; a deteção apenas encaminha para PENDING_REVIEW se houver dúvida (score de heurística).
- Várias posições iguais (10 operadores) = 1 vaga com `vacanciesCount = 10`.
- Dados antigos com múltiplas funções: não dividir automaticamente; marcar e listar no admin.

### F1.2 Quality score (0–100, determinístico, nunca depende de pagamento)

| Critério | Pontos |
|---|---|
| Título com 1 função, 10–80 caracteres, sem MAIÚSCULAS integrais, sem emojis | 10 |
| Descrição ≥ 300 caracteres de texto útil | 15 |
| ≥ 3 responsabilidades | 10 |
| ≥ 2 requisitos estruturados | 10 |
| ≥ 3 skills associadas | 10 |
| Salário divulgado (FIXED/RANGE/FROM) | 15 · NEGOTIABLE 5 · UNDISCLOSED 0 |
| Distrito + modo de trabalho | 10 |
| Tipo de contrato | 5 |
| Prazo de candidatura definido | 5 |
| Organização ≥ CONTACT_VERIFIED | 5 · ORGANIZATION_VERIFIED ou superior 10 |

- `< 50`: não pode publicar; editor mostra checklist do que falta, por ordem de pontos ganhos.
- `50–69`: publica, com sugestões.
- `≥ 70`: selo interno "Vaga completa" (não necessariamente público).
- Uso no ranking: apenas desempate/bónus máximo de 10 % na ordenação por relevância (F8.2).
- Recalculado em cada edição; `qualityBreakdown` guardado.

### F1.3 Edição de vaga publicada
- Edição **não material** (typos, descrição adicional, prazo prorrogado): aplica e cria nova JobVersion.
- Edição **material** (título, categoria, requisitos obrigatórios, redução de salário, localização, modo de trabalho, tipo de contrato): se já houver candidaturas → aviso ao empregador "X candidatos candidataram-se à versão anterior"; candidatos são notificados com resumo da alteração e opção de retirar; recalcula riskScore (se ≥ 40 → PENDING_REVIEW).
- Candidaturas referenciam sempre `jobVersionId`; o recrutador vê a versão a que o candidato se candidatou.

### F1.4 Salário e moeda
- Validação: RANGE exige min < max e max ≤ 5 × min; FROM exige min; FIXED exige min (= max).
- Período obrigatório se houver valor.
- Sanidade: salário mensal < 1 000 Db ou > 500 000 Db → aviso de confirmação ao empregador e sinal de risco (não bloqueia).
- Exibição: "3 500 – 7 000 Db/mês", "A partir de 5 000 Db/mês", "Salário negociável", "Salário não divulgado".
- EUR permitido (organizações internacionais); mostrar "≈ X Db" ao lado só se a taxa estiver configurada.

### F1.5 Expiração e prazos
- Sem prazo: `expiresAt = publishedAt + 30 dias`.
- Com prazo: `expiresAt = applicationDeadline` (máx. 90 dias após publicação).
- Avisos ao empregador: 7 e 2 dias antes, com ação "Prorrogar" (+30 dias, máximo 2 prorrogações gratuitas; depois, consome entitlement).
- Vaga curada externa: `expiresAt` máx. 21 dias se a fonte não indicar prazo.

### F1.6 Moderação automática — riskScore (0–100)

| Sinal | Pontos |
|---|---|
| Texto pede dinheiro ao candidato: "taxa de inscrição", "pagar", "depósito", "transferência", "caução", "custo do processo", "taxa de formação obrigatória", "Western Union", "MoneyGram", "comprar uniforme" (lista configurável PT/FR/EN, sem acentos) | **+60** |
| Pedido de documentos de identidade/bancários antes da candidatura | +30 |
| Contacto apenas por WhatsApp/telefone pessoal, sem candidatura interna nem email corporativo | +15 |
| Email de contacto em domínio gratuito (gmail, hotmail, yahoo, outlook…) **e** organização < CONTACT_VERIFIED | +10 |
| Link encurtado ou domínio na lista negra | +25 |
| Salário fora dos limites de sanidade F1.4 | +15 |
| Organização criada há < 48 h | +10 |
| Conteúdo duplicado (≥ 90 % similar) noutra organização | +20 |
| Promessa de visto/emprego no estrangeiro com custos | +40 |
| Organização ORGANIZATION_VERIFIED | −20 · TRUSTED_PARTNER −30 |

- `≥ 40` → PENDING_REVIEW; `≥ 70` → PENDING_REVIEW + ModerationCase P1.
- Sinais mostrados ao moderador, **nunca** ao empregador em detalhe (evita contorno); o empregador vê "A sua vaga está em revisão. Normalmente demora até 1 dia útil."
- Regra absoluta: **nenhuma vaga legítima pode exigir pagamento do candidato**. Isto está nos termos para empregadores e em cada página de vaga (aviso curto, F1.8).

### F1.7 Vagas externas e curadas
- `sourceType = EMPREGOSTP_CURATED | PARTNER_FEED` → página mostra: "Vaga externa verificada pelo EmpregoSTP" + "Fonte original: <nome> (link)". Nunca sugerir parceria que não existe; nunca usar logo da organização sem perfil reivindicado ou autorização (usar inicial/placeholder neutro existente).
- Candidatura externa: botão "Candidatar-se na fonte original" → regista `ExternalApplyClick` e abre em nova aba. **Nunca** criar Application interna.
- Saúde da fonte: `externalSourceCheck` diário; HTTP 404/410 ou texto "encerrada/closed" em 2 verificações seguidas → EXPIRED; `lastCheckedAt`, `lastActiveAt`, `sourceStatus` atualizados.
- Organização reivindica perfil curado (F1.11) e publica a mesma vaga → deteção de duplicado: a versão oficial prevalece, a curada passa a ARCHIVED com `duplicateOfJobId`; candidatos que clicaram externamente não são afetados.

### F1.8 Página de vaga — conteúdo obrigatório
Título · organização (com selo de verificação se aplicável) · localização · modo · tipo · salário formatado · prazo ("Candidaturas até 15 nov. 2026" + "faltam 3 dias" se < 7) · nº de posições se > 1 · descrição/responsabilidades/requisitos · skills · requisitos obrigatórios destacados · se autenticado: compatibilidade (F4) · CTA candidatar · guardar · partilhar (WhatsApp primeiro, Facebook, LinkedIn, copiar link, partilha nativa) · aviso de segurança: "O EmpregoSTP nunca pede pagamentos para se candidatar. Se lhe pedirem dinheiro, **denuncie**." · botão "Pediram-me dinheiro" · vagas semelhantes.

### F1.9 Fecho de vaga — resultado obrigatório
`closeOutcome`: `HIRED_VIA_EMPREGOSTP` (deve ter ≥ 1 Hire; se não houver, pedir para selecionar o candidato contratado) · `HIRED_OTHER_CHANNEL` · `NO_SUITABLE_CANDIDATE` · `POSITION_CANCELLED` · `POSITION_ON_HOLD` · `OTHER` (texto).
- Formulário de fecho em 1 ecrã, 1 pergunta obrigatória + 1 opcional ("O que poderíamos melhorar?").
- Ao fechar, aplicar F2.8 às candidaturas abertas.

### F1.10 Organização suspensa
Vagas PUBLISHED → PAUSED (motivo SUSPENSION, sem notificar candidatos individualmente com o motivo) · membros perdem ações de escrita · candidaturas e históricos preservados · candidatos com processos ativos recebem "Este processo foi suspenso temporariamente" · reativação restaura vagas ainda dentro do prazo.

### F1.11 Reivindicação de perfil (claim)
Organização criada pelo EmpregoSTP → botão "É desta organização? Reivindique este perfil" → requer `ORG_CONTACT` (domínio de email = website) ou `ORG_DOCUMENTS` → aprovação → requerente torna-se OWNER; histórico preservado.

### F1.12 Duplicados de organização e fusão
- Deteção (sinal, não ação automática): NIF igual (forte) · domínio de email/website igual (forte) · nome normalizado igual ou trigram ≥ 0,85 (médio) · telefone igual (médio).
- Admin vê pares suspeitos e funde: escolhe registo principal; vagas, memberships, candidaturas, pagamentos e histórico movem-se; secundário fica `MERGED` com `mergedIntoId`; slug antigo → 301. Audit.

### F1.13 Publicação duplicada acidental
Mesma organização + título normalizado + distrito + estado PUBLISHED/PENDING nos últimos 30 dias → bloqueio com "Já tem uma vaga igual publicada. Quer prorrogá-la ou aumentar o número de posições?".

## F2. Candidaturas

### F2.1 Candidatura é gratuita — sempre
- Remover qualquer limite comercial de candidaturas existente (documentar em `MIGRATIONS.md`/`CHANGELOG_V2.md` o que existia e o que foi removido).
- Gratuito para sempre: pesquisar, ver vagas, candidatar-se, guardar, acompanhar, alertas, perfil, CV básico (1 modelo ATS + upload), carta de apresentação manual, explicação básica de compatibilidade.
- Proibido: `premiumBoost`, ranking pago, "candidatura prioritária", destaque pago do candidato, ver-quem-viu como argumento de venda para candidaturas.

### F2.2 Requisitos para candidatar (servidor)
1. Utilizador autenticado com email **ou** telefone verificado. (Decisão: sem candidatura anónima — sem conta não há acompanhamento nem combate ao silêncio. Mas o registo DEVE poder acontecer **dentro** do fluxo de candidatura em ≤ 2 passos: telemóvel/email + OTP.)
2. Vaga `PUBLISHED`, `applicationMethod = INTERNAL`, `now < applicationDeadline` e `now < expiresAt`.
3. Sem candidatura anterior não-DRAFT à mesma vaga (constraint única). Mensagem: "Já se candidatou a esta vaga em 12 out. 2026. Acompanhe aqui."
4. Perfil mínimo: nome, distrito (ou "fora de STP"), contacto verificado, **e** um CV (upload ou construído) **ou** perfil com ≥ 1 experiência ou formação.
5. Perguntas de triagem obrigatórias respondidas.
6. Rate limit D13.
7. Utilizador não suspenso.
8. Idempotency key.

### F2.3 Fluxo de candidatura (UX)
- Ecrã único em mobile com passos colapsáveis: (1) CV a usar — lista dos CVs do candidato, default marcado (2) Perguntas (3) Carta opcional (4) Revisão: "A empresa vai ver: nome, contactos que escolheu partilhar, CV X, respostas." (5) Enviar.
- Rascunho guardado automaticamente a cada 5 s ou mudança de passo (servidor + local).
- Requisitos obrigatórios não cumpridos ou resposta eliminatória: aviso **antes** de submeter — "Esta vaga exige carta de condução B. O seu perfil não indica. Pode candidatar-se na mesma; a empresa verá esta informação." Nunca bloquear, exceto se o empregador marcou `knockout` **e** o candidato respondeu explicitamente o contrário (mesmo assim, decisão F3.4).
- Após submeter: ecrã de confirmação com o que acontece a seguir e tempo médio de resposta da organização (se G6 permitir) + sugestões de vagas semelhantes.

### F2.4 Snapshot (integridade histórica)
No momento de `SUBMITTED`, numa transação:
- `cvSnapshotKey`: cópia **imutável** do ficheiro (upload) ou PDF gerado (CV construído) — se o candidato apagar ou alterar o CV, a cópia da candidatura mantém-se até à retenção H6.
- `candidateSnapshot`: perfil (headline, experiências, formação, skills, línguas, certificações, distrito, disponibilidade) + contactos escolhidos para partilha.
- `jobSnapshot`: a JobVersion.
- `answersSnapshot`, `matchSnapshot` (F4.6).
- O recrutador vê **sempre** o snapshot; pode ver "Perfil atual" num separador, se o candidato o mantiver visível, com indicação "atualizado desde a candidatura".

### F2.5 Dados de contacto
- O candidato escolhe no momento da candidatura que contactos partilha (email/telefone/WhatsApp), default: o verificado.
- Morada, documentos de identidade, data de nascimento, foto: nunca partilhados por defeito.

### F2.6 Retirar candidatura
Candidato pode retirar em qualquer estado não terminal; motivo opcional (aceitei outra oferta / já não estou interessado / outro). Empresa vê "Retirada pelo candidato" com data no histórico. Não é possível candidatar-se de novo à mesma vaga após retirar (decisão: evita jogos de reordenação; o candidato é avisado antes de confirmar).

### F2.7 Reaplicação
- Mesma vaga: nunca.
- Nova vaga da mesma organização, mesmo título: permitido; recrutador vê "Candidatou-se antes a <vaga> (resultado: Não selecionada, mar. 2026)" — apenas a membros da mesma organização.

### F2.8 Combate ao silêncio (buraco negro)
Empregador (dias úteis contados desde `submittedAt` da candidatura mais antiga em SUBMITTED):
- D+5: lembrete "Tem N candidaturas por analisar em <vaga>".
- D+10: segundo lembrete + sugestão de mensagem em lote.
- D+15: flag interna para equipa EmpregoSTP (contacto humano); **sem penalização automática**.

Candidato:
- Sem mudança de estado há 21 dias: linha temporal mostra "Sem atualização desde 12 out. — a empresa ainda está a analisar."
- Vaga fechada/expirada/preenchida com candidaturas abertas: estas passam a REJECTED com `closedReason = POSITION_FILLED | POSITION_CLOSED | POSITION_CANCELLED`, e o candidato recebe mensagem respeitosa (template F3.6) **no máximo 7 dias após o fecho** — o empregador pode personalizar nesses 7 dias, senão segue o template.
- **Nenhuma candidatura fica em estado aberto indefinidamente.**

## F3. ATS empresarial

### F3.1 Vistas
- **Lista** (default em mobile): tabela/cards com nome, score, estado, requisitos em falta, data, tags; filtros por estado, score, requisito cumprido, resposta de triagem, origem, data; ordenação por score (default), data, nome.
- **Kanban** (default em desktop ≥ 1024 px): colunas = estados (Recebidas · Em análise · Shortlist · Entrevista · Proposta · Contratados · Não selecionados · Retiradas). Drag-and-drop com validação de transição; transição inválida → coluna não aceita drop. Carregamento lazy (D10).
- **Detalhe da candidatura**: snapshot do CV (visualizador inline + download auditado), perfil, respostas, compatibilidade explicada, linha temporal, notas internas, entrevistas, oferta, ações.
- Estatísticas por vaga: visualizações, candidaturas, conversão, tempo até 1.ª candidatura, por origem.
- Construído com os componentes e o shell do dashboard existente (Parte C).

### F3.2 Ações em lote
Mover estado, rejeitar com mensagem, adicionar tag, exportar (F3.7). Confirmação obrigatória que **diz o número exato e mostra a mensagem que será enviada**: "Vai marcar 47 candidaturas como 'Não selecionada' e enviar esta mensagem: [pré-visualização editável]. Confirmar." Ações em lote ≥ 20 exigem escrever o número para confirmar. Desfazer disponível 10 s antes de envio de mensagens (as mensagens só saem após esse período).

### F3.3 Perguntas de triagem
Tipos: BOOLEAN, SINGLE_CHOICE, MULTIPLE_CHOICE, NUMBER, TEXT. Máximo 8 por vaga. Biblioteca de perguntas frequentes (carta de condução, disponibilidade imediata, anos de experiência, pretensão salarial, residência na ilha do Príncipe…). Proibidas perguntas sobre atributos protegidos (H8) — validação por lista de palavras + revisão em moderação.

### F3.4 Requisitos eliminatórios (knockout)
O sistema **nunca rejeita automaticamente**. Candidaturas que falham knockout recebem etiqueta "Não cumpre requisito eliminatório: <x>" e ficam agrupadas; o recrutador pode rejeitar em lote (F3.2). Razão: dados de perfil podem estar incompletos, e rejeições automáticas silenciosas são proibidas.

### F3.5 Notas, avaliação e colaboração
Notas internas com menção a colegas (@), rating 1–5 por recrutador, feedback de entrevista estruturado. Tudo interno. Reviewer (role) pode ver e comentar, não pode mudar estado.

### F3.6 Mensagens ao candidato e templates
Templates editáveis por organização, com variáveis `{nome}`, `{vaga}`, `{organizacao}`. Defaults (PT, respeitosos):

- Não selecionado: "Olá {nome}, obrigado pelo interesse na vaga de {vaga} na {organizacao}. Após análise, decidimos avançar com outros perfis neste processo. Encorajamos a continuar a acompanhar as nossas oportunidades no EmpregoSTP. Desejamos-lhe sucesso."
- Processo encerrado: "Olá {nome}, o processo de recrutamento para {vaga} foi encerrado. Obrigado pela sua candidatura. Continue a acompanhar novas oportunidades — pode criar um alerta para vagas semelhantes."
- Proibido enviar rejeições sem pré-visualização, e proibido incluir o motivo detalhado de rejeição sem revisão humana.

### F3.7 Exportação
CSV/XLSX das candidaturas de uma vaga, apenas campos do snapshot permitidos, apenas roles OWNER/ADMIN e entitlement `EXPORT`; AuditLog com contagem de linhas; ficheiro gerado com link assinado de 15 min. CVs em ZIP apenas sob entitlement e com limite de 200 por exportação.

### F3.8 Vagas com múltiplas posições
`hires < vacanciesCount` → vaga continua PUBLISHED após contratação; ATS mostra "2 de 10 posições preenchidas". `hires == vacanciesCount` → sistema propõe FILLED.

## F4. Matching explicável (determinístico, versão 1)

### F4.1 Pipeline
`ELIGIBILITY` (requisitos obrigatórios) → `SCORING` (0–100) → `EXPLANATION` (lista legível). Implementado em `domain/matching` como funções puras. `algorithmVersion = "1.0.0"` e pesos versionados em configuração (`weightsVersion`).

### F4.2 Elegibilidade
Para cada `JobHardRequirement`: `MEETS` | `NOT_MEETS` | `UNKNOWN` (dado ausente no perfil). `UNKNOWN` **nunca** equivale a falha; gera sugestão ao candidato ("Indique se tem carta de condução"). Eligibility não altera o score; é mostrada à parte.

### F4.3 Componentes do score (cada um 0–1)

| Componente | Peso | Cálculo |
|---|---|---|
| Skills | 40 | `Σ pesos das skills cumpridas / Σ pesos`, obrigatórias peso 2, preferidas peso 1. Correspondência por skillId canónico (sinónimos incluídos). Se a vaga não tem skills: componente excluído e pesos renormalizados. |
| Experiência | 20 | Anos relevantes = soma das experiências com categoria igual à da vaga ou com ≥ 1 skill da vaga (sobreposições de datas não contam duas vezes). `min(1, anos / experienceMinYears)`; sem mínimo → 1. **Excesso de experiência nunca penaliza** (evita discriminação por idade). |
| Formação | 15 | Nível ≥ mínimo → 1; um nível abaixo → 0,5; abaixo disso → 0; sem mínimo → 1. |
| Localização | 10 | `REMOTO` → 1; mesmo distrito → 1; mesma ilha → 0,8; outra ilha e `willingToRelocate` compatível → 0,7; outra ilha sem disponibilidade → 0,2; fora de STP para vaga presencial → 0,3. |
| Disponibilidade | 10 | Disponível até `startDate` ou IMMEDIATE → 1; NEGOTIABLE → 0,6; posterior → 0,4; NOT_LOOKING → 0,2. |
| Completude do perfil | 5 | `completeness / 100`. |

- Dados ausentes num componente → valor 0,5 com explicação "Informação em falta no perfil" (incentiva completar sem esconder o candidato).
- Línguas obrigatórias entram como requisito obrigatório (F4.2), não no score.
- Score final = `round(Σ peso × valor / Σ pesos ativos × 100)`.

### F4.4 Bandas e apresentação
- `≥ 80` Muito compatível · `60–79` Compatível · `40–59` Parcialmente compatível · `< 40` Pouco compatível.
- **Empregador** vê número + banda + decomposição + requisitos.
- **Candidato** vê banda + checklist (não o número exato): "✓ 5 de 6 competências pedidas · ✓ Formação adequada · ✓ Mesma ilha · ⚠ A vaga prefere 3 anos de experiência; o seu perfil indica 2 · ? Carta de condução: não indicado no perfil".
- Linguagem para baixa compatibilidade: "Esta vaga pede competências que ainda não constam do seu perfil: X, Y. Pode candidatar-se na mesma." Nunca "não é adequado", nunca humilhar.

### F4.5 Proibições (fairness)
O matching **nunca** lê: nome, género, idade/data de nascimento, foto, nacionalidade (usar só `WORK_AUTHORIZATION_STP` se a vaga o exigir), estado civil, religião, etnia, saúde/deficiência, orientação sexual, filiação política ou sindical, lacunas de carreira, instituição de ensino específica (só nível). Teste automático: alterar qualquer destes campos no perfil **não altera** o score (property-based test).

### F4.6 Persistência e recálculo
- `matchSnapshot` gravado na submissão e imutável.
- Score "atual" para listas de talento e recomendações é recalculado por job de fundo quando perfil ou vaga mudam (outbox), guardado em tabela de cache `MatchScore(jobId, candidateUserId, score, breakdown, version, computedAt)`.
- Mudança de pesos → nova `weightsVersion`; snapshots antigos mantêm a versão com que foram calculados.

### F4.7 Recomendações ao candidato
"Vagas para si": vagas PUBLISHED com score ≥ 60, ordenadas por score e recência, excluindo as já candidatadas. Email/WhatsApp de recomendação só com `JOB_ALERTS` consentido.

### F4.8 Evolução
IA de ranking só numa versão futura, com: avaliação offline contra contratações reais, teste de equidade, explicação obrigatória, flag, e auditoria de versão de modelo/prompt (F6.6). Nunca substitui o determinístico sem ADR e aprovação humana.

## F5. Banco de talentos (Talent Pool)

### F5.1 Consentimento e visibilidade
- Default de `visibility` para perfis **novos e existentes: PRIVATE** até o candidato escolher. (Decisão: o prompt anterior propunha VERIFIED_EMPLOYERS por defeito; isso é inclusão sem consentimento informado. Em vez disso, convidar ativamente.)
- Convite claro no onboarding e no painel: "Quer que empresas verificadas o encontrem? Só verão o seu perfil profissional — nunca o seu contacto, até aceitar um convite." Opções: Não · Sim, só empresas verificadas · Sim, perfil público.
- Consentimento `TALENT_POOL` gravado com versão.
- `PUBLIC`: página pública de perfil (`/talentos/<slug>`), `noindex` por defeito; o candidato pode ativar indexação.

### F5.2 Pesquisa de talentos (empregador)
- Disponível a organizações ≥ CONTACT_VERIFIED com entitlement `TALENT_SEARCH`, e só quando G5 o permitir.
- Campos devolvidos (allowlist no servidor, nunca projeção do objeto inteiro): headline, skills, anos de experiência por categoria, nível de formação, línguas, distrito/ilha, disponibilidade, verificações, iniciais + primeiro nome (ou "Candidato #shortId" se o candidato preferir anonimato).
- Nunca devolvidos: apelido completo (até aceitar convite), email, telefone, morada, data de nascimento, foto (se o candidato não autorizar), expectativa salarial (apenas se o candidato marcar "mostrar a empresas" — e então em intervalo), documentos.
- Cada visualização de perfil → `ProfileView`; o candidato vê "O seu perfil foi visto por 4 empresas esta semana" (sem nomes no gratuito; com nomes só se a empresa aceitar ser identificada — default sim).

### F5.3 Convite a candidatar-se
- O empregador **tem de escolher uma vaga PUBLISHED** da sua organização. Sem vaga, sem convite.
- Mensagem obrigatória personalizável (template com `{vaga}`), 50–600 caracteres; bloqueio de mensagens genéricas iguais enviadas a > 20 pessoas no mesmo dia.
- O candidato recebe notificação, vê a vaga e a compatibilidade, e decide: Candidatar-me (fluxo normal, `source = invite`) · Não tenho interesse (motivo opcional) · Ignorar. A empresa vê o estado.
- O candidato pode bloquear convites de uma organização.

### F5.4 Limites anti-spam de convites

| Plano | Convites/mês | Máx./dia | Máx. pendentes por vaga |
|---|---|---|---|
| Sem plano | 0 | — | — |
| Recruit Pro | 40 | 15 | 30 |
| Business | 150 | 40 | 80 |

Taxa de recusa+ignorados > 80 % em ≥ 30 convites → redução automática para metade e alerta ao admin.

### F5.5 Contacto mediado
Antes de candidatura/convite aceite: zero canais diretos. Depois de candidatura: a empresa vê os contactos que o candidato escolheu partilhar (F2.5). Mensagens dentro da plataforma (thread por candidatura) PODEM ser ativadas numa fase posterior; até lá, o canal é o contacto partilhado + notificações de estado.

## F6. CV, carta e IA

### F6.1 CV Builder
- Secções: dados pessoais (sem foto/data de nascimento por defeito; avisar que não são necessários), resumo, experiência, formação, competências, línguas, certificações, projetos, referências ("disponíveis mediante pedido" por defeito; referências com contacto só com confirmação de que o referenciado autorizou).
- Dados vêm do perfil estruturado: editar uma vez, gerar vários CVs. Cada CVDocument guarda as secções escolhidas e ordem.
- Gratuito: 1 modelo ATS-friendly, 2 CVs. Career+: modelos adicionais (todos ATS-friendly), CVs ilimitados.
- PDF gerado no servidor (ou com biblioteca já usada), texto selecionável, uma coluna, cabeçalhos standard, fontes do sistema/embutidas, sem tabelas para layout, sem texto em imagem, ≤ 2 páginas recomendado, ficheiro ≤ 500 KB.
- Rascunho autoguardado (B5).

### F6.2 Análise de CV (explicável)
Regras determinísticas primeiro, IA opcional depois:
- Completude por secção, datas em falta, experiências sem descrição, skills não mapeadas, descrições sem verbos de ação ou resultados, comprimento, contactos.
- Saída: "Completude 87 %. Falta: datas de fim em 1 experiência; 2 competências; resultados concretos (ex.: números, prazos)."
- Comparação vaga/perfil (Career+): lista de skills da vaga em falta no perfil, com sugestão de formações (F9.3) — **nunca** sugerir adicionar skills que o candidato não tem.

### F6.3 Carta de apresentação
Gerador (Career+ ou limite gratuito de 2/mês — decisão: um pequeno uso gratuito aumenta qualidade das candidaturas para as empresas, que é o lado pagante) baseado **apenas** em dados do perfil + vaga. O candidato edita sempre antes de enviar. Validação pós-geração: qualquer organização, cargo, data ou competência mencionada que não exista no perfil → removida/realçada para o candidato confirmar.

### F6.4 Regras de IA (onde existir)
Pode: resumir candidatura para o recrutador, sugerir perguntas de entrevista, ajudar a redigir vagas (com aviso para não incluir requisitos discriminatórios), melhorar redação de CV, simular entrevista (Career+).
Nunca: inventar dados; rejeitar, ordenar ou filtrar candidatos sem revisão humana visível; usar atributos protegidos; enviar mensagens em nome de alguém sem confirmação.

### F6.5 Privacidade na IA
- Só com consentimento `AI_PROCESSING` do titular dos dados para funcionalidades do candidato; para funcionalidades do recrutador sobre dados de candidatos, base: termos + candidatura, e **apenas campos do snapshot necessários**, nunca documentos de verificação.
- Remover contactos (email, telefone) antes de enviar a qualquer fornecedor de IA.
- Fornecedor de IA com acordo de não-treino com dados do cliente (documentar em ADR).
- `KILL_AI` desliga tudo; todas as funcionalidades têm caminho manual equivalente.

### F6.6 Auditoria de IA
Para cada saída de IA que um recrutador vê sobre um candidato: guardar `model`, `promptVersion`, `inputHash`, `outputHash`, `at`, `userId`. Não guardar o conteúdo completo para além de 90 dias.

## F7. Notificações

### F7.1 Arquitetura
`OutboxEvent` → `NotificationDispatcher` → resolve destinatários → aplica preferências e consentimentos → agrupa (digest) → envia por canal (`InApp`, `Email`, `WhatsApp`, `SMS` opcional) → regista `Notification`. Nenhum componente envia email diretamente. Templates centralizados (`server/notifications/templates/`), em PT, com versão texto.

### F7.2 Matriz (default; o utilizador pode desligar exceto onde dito)

| Evento | Destinatário | In-app | Email | WhatsApp* | Pode desligar? |
|---|---|---|---|---|---|
| APPLICATION_SUBMITTED (confirmação) | Candidato | ✓ | ✓ | ✓ | Não (transacional) |
| APPLICATION_RECEIVED | Recrutadores da vaga | ✓ | Digest diário (instantâneo se ≤ 3/dia) | Opcional | Sim |
| APPLICATION_STATUS_CHANGED | Candidato | ✓ | ✓ | ✓ | Não para INTERVIEW/OFFER/HIRED/REJECTED; sim para UNDER_REVIEW |
| INTERVIEW_SCHEDULED / RESCHEDULED / CANCELLED | Candidato + entrevistadores | ✓ | ✓ + .ics | ✓ | Não |
| INTERVIEW_REMINDER | Candidato + entrevistadores | ✓ | ✓ | ✓ | Sim |
| OFFER_RECEIVED / OFFER_RESPONDED | Candidato / Recrutador | ✓ | ✓ | ✓ | Não |
| INVITE_TO_APPLY | Candidato | ✓ | ✓ | ✓ | Sim (e bloquear org) |
| JOB_MATCHED / JOB_ALERT | Candidato | ✓ | Digest | Digest | Sim; exige consentimento JOB_ALERTS |
| SAVED_JOB_DEADLINE | Candidato | ✓ | ✓ | — | Sim |
| JOB_EXPIRING | Empregador | ✓ | ✓ | — | Sim |
| JOB_PUBLISHED / REJECTED / RETURNED | Empregador | ✓ | ✓ | — | Não |
| EMPLOYER_SILENCE_REMINDER | Empregador | ✓ | ✓ | Opcional | Não (pode adiar 7 dias) |
| VERIFICATION_DECIDED | Requerente | ✓ | ✓ | — | Não |
| REPORT_RECEIVED / RESOLVED | Denunciante | ✓ | ✓ | — | Não |
| PAYMENT_* / SUBSCRIPTION_* | Pagador | ✓ | ✓ | — | Não |
| HIRE_CONFIRMATION_REQUEST | Candidato | ✓ | ✓ | ✓ | Sim |
| SECURITY (login novo, reset) | Utilizador | — | ✓ | — | Não |
| MARKETING / NEWSLETTER | Utilizador | — | ✓ | ✓ | Sim; exige consentimento explícito |

\* WhatsApp só com opt-in específico registado (`Consent` + número verificado).

### F7.3 Regras de canal
- **Silêncio**: WhatsApp/SMS só entre 08:00 e 20:00 no fuso do destinatário; fora disso, agendar. Exceção: lembrete de entrevista de 2 h.
- **Limite**: máximo 3 mensagens WhatsApp por dia por utilizador (exceto transacionais críticas); excedente vai para digest.
- **WhatsApp**: templates aprovados pela plataforma; palavra "PARAR"/"STOP" desativa o canal imediatamente; WhatsApp é canal — a verdade está sempre no EmpregoSTP (cada mensagem tem link).
- **Email**: transacional e marketing separados (remetentes/streams distintos); unsubscribe de marketing não desliga transacionais; cabeçalhos `List-Unsubscribe` no marketing; SPF/DKIM/DMARC verificados (RUNBOOK).
- **Deduplicação**: o mesmo evento não gera duas notificações no mesmo canal (chave `eventId + userId + channel`).

## F8. Pesquisa, descoberta e SEO

### F8.1 Pesquisa de vagas
- Campos pesquisáveis: título, organização, skills (com sinónimos), categoria, descrição (peso menor).
- Filtros: categoria, distrito/ilha, modo, tipo de contrato, senioridade, salário divulgado (sim/não), salário mínimo, data de publicação (24 h, 7 dias, 30 dias), organizações verificadas, prazo a terminar.
- Autocomplete (≥ 2 caracteres, debounce 250 ms): cargos, skills, organizações, categorias, distritos — agrupados.
- Estado da pesquisa na URL (partilhável, SEO-safe com `noindex` para combinações de filtros) + última pesquisa lembrada para utilizadores autenticados.
- Tolerância a acentos e erros (unaccent + trigram, ou equivalente).
- Sinónimos PT/STP mantidos no admin (ex.: motorista ↔ condutor; empregado de mesa ↔ garçon; informático ↔ técnico de informática; secretária ↔ assistente administrativa).

### F8.2 Ordenação
Default: relevância textual × (1 + 0,1 × qualityScore/100) com desempate por `publishedAt` desc. Alternativas: mais recentes, prazo a terminar, salário. Vagas "Destaque" (G3) aparecem num bloco separado e rotulado "Destaque", máximo 3 por página, **nunca** misturadas com os resultados orgânicos sem rótulo.

### F8.3 Zero resultados
Mostrar: sugestões de correção, remover filtro mais restritivo (botões), vagas relacionadas por categoria/skill, e "Criar alerta para esta pesquisa".

### F8.4 URLs e páginas SEO
Antes de mudar qualquer padrão, comparar com `ROUTE_INVENTORY.md`. Alvo (adaptar ao existente, com 301 do antigo):

| Página | URL alvo | Indexável |
|---|---|---|
| Vaga | `/vagas/{slug}-{shortId}` (slug muda com o título; shortId garante estabilidade; slug errado → 301 para o canónico) | Sim enquanto PUBLISHED; EXPIRED/CLOSED ver F8.6 |
| Categoria | `/vagas/categoria/{slug}` | Só com ≥ 3 vagas ativas; caso contrário `noindex, follow` |
| Localização | `/vagas/localizacao/{slug}` (slugs B2) | Idem |
| Categoria + localização | `/vagas/categoria/{cat}/{loc}` | Só com ≥ 5 vagas ativas |
| Organização | `/empresas/{slug}` | Sim se tiver descrição e ≥ 1 vaga histórica |
| Guias de carreira | `/carreiras/{slug}` | Sim, só conteúdo real (F9) |
| Mercado de trabalho | `/mercado-trabalho` | Sim, quando G5 permitir |

### F8.5 Dados estruturados e metadados
- JSON-LD `JobPosting` só em vagas PUBLISHED com dados reais: `title`, `description`, `datePosted`, `validThrough`, `employmentType` (mapeado para valores schema.org), `hiringOrganization` (nome, `sameAs` website, logo se existir), `jobLocation` (`addressLocality`, `addressRegion` = distrito, `addressCountry` = "ST") ou `jobLocationType: TELECOMMUTE` + `applicantLocationRequirements`, `baseSalary` **só** se divulgado (`currency` STN/EUR, `unitText` HOUR/DAY/MONTH/YEAR), `directApply` = true apenas para candidatura interna, `identifier` (shortId).
- Vagas externas: `JobPosting` apenas se a fonte for verificável e ativa; `directApply` false.
- `Organization` JSON-LD nas páginas de empresa; `BreadcrumbList` em todas as páginas hierárquicas.
- Sitemap dividido (vagas, categorias, localizações, empresas, conteúdo) com `lastmod` real; só URLs indexáveis.
- Google Indexing API para JobPosting: PODE ser usada atrás de flag, para publicar/remover rapidamente.
- Open Graph dinâmico por vaga: imagem gerada no servidor com cargo, organização, localização, prazo e marca EmpregoSTP **usando as cores/tipografia existentes**; cache longo com invalidação na edição.

### F8.6 Vaga expirada, fechada, arquivada
- EXPIRED/CLOSED/FILLED: página devolve **200**, mostra "Esta vaga encerrou em 12 nov. 2026" no topo, conteúdo da vaga esmaecido, CTA bloqueado, e "Vagas semelhantes" (mesma categoria + distrito, até 6) + "Criar alerta". JSON-LD removido imediatamente. Sai do sitemap. `noindex` após 30 dias.
- ARCHIVED: 200 com mensagem e semelhantes, `noindex`. Vagas REJECTED (fraude): **410**.
- Nunca 404 para uma URL de vaga que existiu.

### F8.7 Partilha
Botões: WhatsApp (texto pré-preenchido: "Vaga: {cargo} — {organização}, {localização}. Candidaturas até {prazo}. {url}") · Facebook · LinkedIn · Copiar link · Partilha nativa (Web Share API em mobile). URLs partilhadas levam `utm_source`/`utm_medium=share`.

### F8.8 Atribuição e UTM
- Capturar `utm_*`, `ref`, referrer na primeira visita da sessão; guardar em cookie first-party (30 dias, sem PII) e anexar à candidatura (`Application.source`, `utm`) e ao registo de empresa.
- Classificação `source`: organic (motores de pesquisa) · search (pesquisa interna) · social · whatsapp · email · direct · partner · invite · alert · external.
- A origem da contratação = origem da candidatura (`Hire.attributionSource`).

## F9. Conteúdo, recursos e instituições

### F9.1 Auditoria de conteúdo (Fase 2)
Produzir `docs/v2/CONTENT_AUDIT.md` com cada artigo/recurso: URL, título, tráfego (se disponível), estado (OK / corrigir / despublicar), motivo.
- Despublicar (com 301 para categoria ou artigo relacionado, ou 410 se lixo sem tráfego): testes, placeholders ("gggg", "lorem ipsum"), duplicados, informação falsa ou não verificável, alegações de parcerias inexistentes, conteúdo gerado sem revisão.
- Corrigir: datas, factos, links partidos.
- **Lista final de despublicação requer aprovação humana** (A4).

### F9.2 Contadores e prova social
- Contadores de downloads, "X empresas confiam em nós", "Y candidatos colocados", testemunhos: se não forem calculados a partir de dados reais ou verificáveis, **remover já** (Fase 2). Esta remoção não requer aprovação (é correção de informação falsa).
- Números reais na homepage só com dados calculados (G4) e arredondados para baixo ("mais de 300 vagas publicadas").
- Downloads de recursos: ficheiros reais, verificados, com tamanho e formato indicados.

### F9.3 Universidades e centros de formação (Fase 8)
- Tipo de organização próprio (B8). Podem: publicar estágios e primeiros empregos; ter página institucional; (fase posterior) confirmar diplomas dos seus graduados — o candidato pede, a instituição aprova → verificação EDUCATION aprovada com `verifiedBy = institution`.
- Centros de formação: catálogo de cursos ligados a skills; aparecem como sugestão quando o candidato tem skills em falta para vagas que lhe interessam (nunca pagos para aparecer sem rótulo "Patrocinado").

### F9.4 Investigadores e parceiros
Acesso apenas a dados **agregados e anonimizados** (G6, H7) via `/mercado-trabalho` e relatórios descarregáveis. Pedidos de dados mais finos → processo manual com acordo escrito, fora da plataforma.

---

# PARTE G — MONETIZAÇÃO, MÉTRICAS E FASES DO MARKETPLACE

## G1. Ciclo do marketplace e North Star

```
Mais vagas reais → mais candidatos → mais dados de talento → melhor matching
→ empresas contratam melhor → empresas voltam → mais vagas
```

**North Star: contratações confirmadas pelo empregador via EmpregoSTP por mês** (`Hire.status = ACTIVE`, criado a partir de candidatura interna ou convite).

Métricas de suporte (sempre acompanhadas, nunca otimizadas isoladamente):
- Contratações confirmadas por ambos os lados (qualidade da North Star).
- Taxa de preenchimento: vagas fechadas com `HIRED_VIA_EMPREGOSTP` / vagas fechadas.
- Taxa de resposta: candidaturas que saem de SUBMITTED em ≤ 10 dias úteis.
- Candidaturas qualificadas por vaga (score ≥ 60 e sem requisitos em falta).
- Tempo até primeira candidatura.
- Empregadores recorrentes (2.ª vaga em 90 dias).

Visitas, contas, CVs e candidaturas são métricas de entrada, não de sucesso.

## G2. Princípios comerciais

1. **Candidatos nunca pagam para se candidatar, nem para serem melhor classificados.**
2. A receita principal é **B2B**.
3. **O ATS básico é gratuito para todas as organizações.** (Decisão: se o pipeline fosse pago, as empresas gratuitas geririam candidaturas fora da plataforma e a North Star deixaria de ser medível. Monetiza-se volume, alcance, talento, equipa e inteligência — não o registo de resultados.)
4. Pagamento ≠ entitlement: tudo passa por `canUseFeature(subject, feature)`; nenhum `if (plan === 'premium')` espalhado.
5. Nenhum preço no código. Preços em `Plan` (base de dados), editáveis no admin, com versão.
6. Durante baixa liquidez (G5), o produto prioriza volume de vagas e processos, não receita.

## G3. Planos e entitlements

### Empregadores

| Feature (chave) | Gratuito | Job Post (avulso) | Recruit Pro | Business | Recrutamento Assistido |
|---|---|---|---|---|---|
| `JOB_POST_SLOTS` (vagas ativas simultâneas) | 1 (primeira vaga grátis; depois 1 ativa a cada 90 dias) | +1 por compra (30 dias) | 5 | 20 | Conforme contrato |
| `ATS_PIPELINE` (pipeline, estados, notas, entrevistas, ofertas, contratação) | ✓ | ✓ | ✓ | ✓ | ✓ |
| `ATS_BULK_ACTIONS` | até 20 por ação | até 20 | ✓ | ✓ | ✓ |
| `SCREENING_QUESTIONS` | 3 | 8 | 8 | 8 | 8 |
| `MATCH_SCORES` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `TALENT_SEARCH` | — | — | ✓ | ✓ | ✓ |
| `INVITES_MONTHLY` | 0 | 0 | 40 | 150 | Conforme |
| `FEATURED_JOB` (destaque rotulado, 7 dias) | Compra avulsa | Compra avulsa | 1/mês incluído | 4/mês | ✓ |
| `ANALYTICS_ADVANCED` (funil, origens, comparativos) | básico por vaga | básico | ✓ | ✓ | ✓ |
| `EMPLOYER_BRANDING` (página rica: fotos, benefícios, vídeo) | perfil básico | perfil básico | ✓ | ✓ | ✓ |
| `SEATS` (membros) | 2 | 2 | 5 | 20 | Conforme |
| `ROLES_PERMISSIONS` avançadas | OWNER/RECRUITER | idem | todos | todos | todos |
| `EXPORT` | — | — | CSV | CSV/XLSX + ZIP CV | ✓ |
| `REPORTS` (relatórios periódicos) | — | — | mensal | mensal + personalizado | ✓ |
| `INTEGRATIONS/API` | — | — | — | ✓ (fase futura) | — |

- **Recrutamento Assistido**: serviço da equipa EmpregoSTP (triagem, shortlist, marcação de entrevistas). Modelado como `Payment.purpose = ASSISTED_RECRUITMENT` + entitlements temporários + atribuição de um membro da equipa EmpregoSTP à organização com role REVIEWER/RECRUITER e **marca visível** no ATS ("Gerido com apoio EmpregoSTP"). Acesso da equipa é auditado.
- ONG, organizações internacionais e instituições públicas: mesmos planos; descontos via `PROMO` grants decididos pelo admin.
- Universidades e centros de formação: estágios gratuitos ilimitados (`JOB_POST_SLOTS` ilimitado para `employmentType = ESTAGIO`) — alimenta o lado da procura jovem.

### Candidatos — Career+

Inclui: modelos de CV adicionais e CVs ilimitados · análise ATS detalhada · comparação vaga/perfil detalhada · cartas ilimitadas · simulação de entrevista · insights de carreira e de skills (quando G5 permitir) · ver nomes das empresas que viram o perfil.

Não inclui (nunca): candidaturas extra, prioridade, destaque, melhor score.

### Programa Fundador (decisão para a fase de liquidez)
Enquanto o marketplace estiver no Estágio 0 ou 1 (G5): organizações verificadas recebem **Recruit Pro gratuito durante 6 meses** (`EntitlementGrant source = PROMO`, `validUntil`), com aviso claro da data de fim e sem renovação automática paga. A infraestrutura de pagamentos é construída e testada, mas a cobrança efetiva começa por Job Post avulso e Destaque.

## G4. Pagamentos

- **Não alterar a integração de pagamento existente sem auditoria** (Fase 0). Encapsular a existente num adapter `PaymentProvider` sem mudar comportamento.
- Adapter adicional `MANUAL_TRANSFER` (transferência bancária local / depósito): gera referência única e instruções; o pagador carrega comprovativo; admin confirma no backoffice → PAID. Indispensável em STP, onde cartões são pouco usados.
- Moeda: STN por defeito; EUR para organizações internacionais e diáspora.
- Fatura: numeração sequencial anual imutável, dados fiscais do cliente, taxa de imposto **configurável** (não codificar; validar com contabilista), PDF guardado, nunca editada (anula-se e emite-se nova).
- Webhooks: assinatura verificada, idempotentes (E10), registados em `PaymentWebhookEvent`, respondem 200 rapidamente e processam no outbox.
- Upgrade: entitlements só após `PAID` (nunca na intenção de pagamento).
- Falha de renovação: PAST_DUE com 14 dias de graça, avisos D0, D7, D13; depois EXPIRED (E11). Nenhum dado é apagado.
- Reembolso: só admin, motivo obrigatório, revoga entitlements correspondentes se ainda não usados; audit.

## G5. Fases de maturidade do marketplace (calibradas para STP)

Calculadas diariamente (`marketplaceMetricsSnapshot`) e visíveis no admin.

| Estágio | Condição de entrada (todas) | O que se ativa |
|---|---|---|
| 0 — Arranque | — | Vagas, candidaturas, ATS gratuito, curadoria de vagas externas, Programa Fundador, Job Post avulso |
| 1 — Tração | ≥ 30 vagas ativas · ≥ 300 perfis completos (completude ≥ 70) · ≥ 10 contratações confirmadas no trimestre | Destaque pago, Career+ |
| 2 — Liquidez | ≥ 80 vagas ativas · ≥ 800 perfis completos · ≥ 50 organizações ativas (vaga em 90 dias) · taxa de preenchimento ≥ 25 % | Talent Search + Convites (precisa de ≥ 300 perfis com consentimento TALENT_POOL), fim do Programa Fundador para novos aderentes, Recruit Pro pago |
| 3 — Rede | ≥ 150 vagas ativas · ≥ 2 000 perfis completos · ≥ 100 organizações ativas · ≥ 40 contratações/trimestre | Business, Mercado de Trabalho público, relatórios, Índice EmpregoSTP |

As flags correspondentes **só** são ligadas em produção quando o estágio é atingido **e** um humano aprova (A4). Os limiares são configuração.

## G6. Liquidez por categoria e distrito (admin)

Tabela por categoria (e por ilha):

| Categoria | Vagas ativas | Candidatos ativos (90 d) | Qualificados (score ≥ 60) | Candidaturas/vaga | Tempo até 1.ª cand. | Taxa de preenchimento | Diagnóstico |
|---|---|---|---|---|---|---|---|

Diagnóstico automático:
- `qualificados/vaga < 3` → **falta oferta de talento** → ação: aquisição de candidatos, parcerias com formação.
- `vagas < 3` e `candidatos ≥ 50` → **falta procura** → ação: angariação de empresas, curadoria.
- Equilíbrio → manter.

Outros painéis: funil candidato e empresa (G7), vagas por estado, verificações pendentes, denúncias abertas por prioridade, taxa de resposta por organização, outbox/jobs.

Regra: nenhum número no dashboard é hardcoded; tudo vem de queries ou snapshots materializados.

## G7. Analytics de produto

- Se existir ferramenta de analytics, manter; eventos de negócio críticos também gravados em tabela própria (fonte de verdade para a North Star — nunca depender de analytics do cliente, que é bloqueado por ad-blockers).
- Eventos (nomes `snake_case`, versão no esquema):

Candidato: `visit`, `search` (query normalizada, nº resultados, filtros), `job_view`, `job_save`, `share_click` (canal), `external_apply_click`, `application_start`, `application_submit`, `application_withdraw`, `interview_scheduled`, `offer_received`, `offer_accepted`, `hire_confirmed`, `alert_created`, `profile_completed`, `talent_pool_opt_in`.

Empresa: `employer_signup`, `org_verified` (nível), `job_create`, `job_submit`, `job_publish`, `first_application_received`, `application_viewed`, `shortlist`, `interview_scheduled`, `offer_sent`, `hire_confirmed`, `job_closed` (outcome), `repeat_job`, `talent_search`, `invite_sent`, `plan_purchased`.

- Propriedades permitidas: ids internos opacos, categoria, distrito, plano, origem, dispositivo, estágio. **Proibido**: nome, email, telefone, texto de CV, respostas de triagem, notas, salário individual, query de pesquisa de talentos com nomes.
- Analytics de terceiros só após consentimento de cookies se a política o exigir (H5).

---

# PARTE H — PRIVACIDADE, SEGURANÇA E CONFORMIDADE

## H1. Enquadramento legal

- São Tomé e Príncipe tem legislação de proteção de dados pessoais e uma autoridade de controlo. Muitos candidatos são da diáspora (UE, sobretudo Portugal), onde se aplica o RGPD.
- Decisão: **cumprir o padrão mais exigente (RGPD) por defeito** — simplifica e protege.
- Textos legais: o agente redige rascunhos (Termos de candidato, Termos de empregador, Política de Privacidade, Política de Cookies, Política de Moderação) e marca-os `RASCUNHO — requer revisão jurídica`. Publicação só com aprovação (A4).
- `TermsAcceptance` com versão; mudança material de termos → novo aceite no próximo login (não bloquear acesso a candidaturas em curso durante 30 dias).

## H2. Roles

Plataforma: `CANDIDATE`, `ADMIN`, `MODERATOR` (denúncias, vagas), `REVIEWER` (verificações), `SUPPORT` (leitura limitada, sem documentos).
Organização (via membership): `OWNER`, `ADMIN`, `RECRUITER`, `REVIEWER` (só leitura + notas, ex.: gestor da área).

Princípio do menor privilégio. Acesso de staff a dados de candidatos fora de denúncia/verificação/suporte → requer motivo registado ("break-glass") e gera AuditLog.

## H3. Matriz de permissões (base; completar em `PERMISSIONS.md`)

Legenda: ✓ sim · P próprio · O da sua organização · M com motivo registado · — não

| Ação | Candidato | Org OWNER | Org ADMIN | Org RECRUITER | Org REVIEWER | MODERATOR | REVIEWER (plat.) | ADMIN |
|---|---|---|---|---|---|---|---|---|
| Ver vaga publicada | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Criar/editar vaga | — | O | O | O | — | — | — | M |
| Publicar/fechar vaga | — | O | O | O | — | — | — | M |
| Aprovar/rejeitar vaga (moderação) | — | — | — | — | — | ✓ | — | ✓ |
| Candidatar-se | ✓ | — | — | — | — | — | — | — |
| Ver candidatura (snapshot) | P | O | O | O (vagas atribuídas ou todas, config.) | O | M (denúncia) | — | M |
| Descarregar CV da candidatura | P | O | O | O | O | M | — | M |
| Mudar estado de candidatura | Retirar (P) | O | O | O | — | — | — | M |
| Reverter rejeição | — | O | O | — | — | — | — | M |
| Notas internas | — | O | O | O | O | M | — | M |
| Marcar entrevista / enviar oferta | — | O | O | O | — | — | — | — |
| Confirmar contratação | — | O | O | O | — | — | — | M |
| Pesquisar talentos | — | O* | O* | O* | — | — | — | M |
| Enviar convite | — | O* | O* | O* | — | — | — | — |
| Exportar candidaturas | — | O* | O* | — | — | — | — | M |
| Gerir membros | — | O | O (≤ ADMIN) | — | — | — | — | M |
| Transferir ownership | — | O | — | — | — | — | — | M |
| Faturação / planos | — | O | O | — | — | — | — | ✓ |
| Ver documentos de verificação | P | O (os da org) | O | — | — | — | ✓ | M |
| Decidir verificação | — | — | — | — | — | — | ✓ | ✓ |
| Denunciar | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — |
| Decidir denúncia / suspender | — | — | — | — | — | ✓ | — | ✓ |
| Fundir organizações | — | — | — | — | — | — | — | ✓ |
| Ver AuditLog | — | O (eventos da org) | O | — | — | — | — | ✓ |
| Exportar dados pessoais | P | — | — | — | — | — | — | — |
| Apagar conta | P | P (se não for único OWNER com subscrição ativa) | P | P | P | — | — | M |

\* sujeito a entitlement.

Implementação: `can(actor, action, resource)` em `domain/permissions`, com teste parametrizado que percorre **toda a matriz** (cada célula = 1 caso de teste). Testes de IDOR: para cada endpoint com id, pedir com utilizador de outra organização → 403/404.

## H4. Audit log (append-only)

Registar: publicação/rejeição/suspensão de vaga · cada mudança de estado de candidatura (já em history; audit para ações em lote e reversões) · visualização/descarga de CV por empresa · visualização de documento de verificação · decisões de verificação · decisões de moderação · exportações (com nº de linhas) · alterações de membros e roles · transferência de ownership · alterações de plano/entitlements manuais · reembolsos · fusão de organizações · acesso break-glass · alterações de configuração (pesos de matching, limiares, flags) · logins de staff.

Retenção 3 anos. Sem PII em `metadata` (ids apenas).

## H5. Direitos do titular

- **Exportar dados** (`/conta/privacidade`): gera ZIP (JSON + ficheiros) com perfil, CVs, candidaturas (parte do candidato, sem notas internas da empresa), consentimentos, notificações, em ≤ 24 h, link assinado 48 h. Limite 1 pedido/semana.
- **Apagar conta**: pedido → confirmação por OTP → `PENDING_DELETION` com 7 dias de arrependimento → execução:
  - Perfil, CVs, documentos, alertas, guardados, sessões: apagados.
  - Candidaturas: candidaturas ativas → WITHDRAWN ("Candidato removeu a conta"); snapshots anonimizados (nome → "Candidato removido", contactos e ficheiros apagados, mantidos apenas estado, datas, vaga — para integridade estatística e do processo da empresa).
  - Hires: mantidos anonimizados (contam para métricas agregadas).
  - Faturas: mantidas pelo prazo fiscal (dados de faturação, não perfil).
  - AuditLog: mantido com ids pseudonimizados.
- **Retificação**: o candidato edita o perfil a qualquer momento; snapshots não mudam (explicar isto na UI).
- **Consentimentos**: página única para gerir TALENT_POOL, JOB_ALERTS, MARKETING_EMAIL, MARKETING_WHATSAPP, AI_PROCESSING, com histórico.
- Marketing **nunca** é assumido pela criação de conta; checkbox desmarcada por defeito.
- Cookies: banner só se houver cookies não essenciais; recusar tão fácil como aceitar.

## H6. Retenção (aplicada por `retentionEnforcement`)

| Dado | Retenção | Depois |
|---|---|---|
| Documentos de verificação (ficheiros) | 30 dias após decisão | Apagar ficheiro; manter resultado, tipo, hash, revisor, data |
| Snapshots de candidatura (dados pessoais + CV) | 24 meses após fecho da vaga | Anonimizar (como H5) |
| Conta de candidato inativa (sem login) | 36 meses | Aviso por email/WhatsApp; anonimizar após 30 dias sem resposta |
| Organização inativa | Sem expiração automática (dados de empresa); membros inativos 36 meses → removidos | — |
| Notificações | 12 meses | Apagar |
| Eventos de analytics brutos | 13 meses | Agregar e apagar |
| Logs de aplicação | 30 dias (90 para erros) | Apagar |
| AuditLog | 3 anos | Apagar |
| Faturas e pagamentos | Prazo legal fiscal (configurável; tipicamente 10 anos) | — |
| Saídas de IA | 90 dias (só hashes depois) | — |
| Rascunhos de candidatura | 60 dias sem alteração | Apagar |

## H7. Classificação de dados

| Nível | Exemplos | Regras |
|---|---|---|
| PUBLIC | Vagas publicadas, perfil público de organização, perfil de talento PUBLIC (campos permitidos) | Pode ser indexado |
| ACCOUNT | Email/telefone do próprio, preferências | Só o titular e staff com motivo |
| PRIVATE | CV, experiências, candidaturas, respostas, notas internas | Titular + organizações com relação legítima |
| SENSITIVE | Documentos de identidade, data de nascimento, género, saúde, expectativa salarial, documentos de verificação | Cifrado em repouso quando possível, acesso auditado, nunca em logs/analytics/IA |
| INTERNAL | riskScore, sinais de fraude, notas de moderação, AuditLog | Só staff |

Agregações públicas (Mercado de Trabalho, Índice, taxas de resposta, insights salariais):
- Contagens: suprimir células com < 5.
- Salários: mostrar só com ≥ 10 vagas com salário de ≥ 5 organizações distintas; usar mediana e intervalo interquartil; nunca máximo/mínimo individual.
- Taxa de resposta/contratações de uma organização: só com ≥ 10 candidaturas nos últimos 90 dias.
- Cruzamentos que gerem grupos pequenos (ex.: categoria × distrito do Príncipe): suprimir ou agregar.

## H8. Antidiscriminação

- Vagas: lista de termos discriminatórios (género, idade, aparência, estado civil, religião, etnia) gera aviso no editor e sinal de moderação. Exceções legítimas (ex.: requisitos legais de um cargo) via revisão humana.
- Perguntas de triagem proibidas sobre atributos protegidos (F3.3).
- Foto e data de nascimento opcionais e ocultáveis; o CV gerado não as inclui por defeito.

## H9. Contas bloqueadas e fraude

- Candidato suspenso: não pode candidatar-se, enviar mensagens nem aparecer no Talent Pool; candidaturas existentes **preservadas** e visíveis às empresas com nota "Conta suspensa"; histórico intacto.
- Organização suspensa: F1.10.
- Duplicados de candidato: sinal (mesmo telefone/email verificado, mesmo documento) → revisão manual; **nunca fusão automática por nome**.
- Empresa pode denunciar candidatura (spam, fraude, conteúdo abusivo) → Report P2.
- Candidato pode denunciar entrevista abusiva (Report sobre Interview) → P1.

---

# PARTE I — PLANO DE EXECUÇÃO POR FASES

Regras gerais:
- Uma fase só começa quando a anterior cumpre os critérios de saída (ou um humano aprova exceção).
- Cada fase = 1 a N PRs pequenos para o branch de integração (J3), cada um com tudo verde.
- Tudo o que muda comportamento visível em produção está atrás de flag (D9).
- Nenhuma fase introduz regressão visual não intencional.

## Fase 0 — Descoberta e baseline (sem alterar comportamento do produto)

Trabalho:
1. Ler o repositório inteiro; correr a app localmente; correr testes existentes.
2. Produzir `CURRENT_ARCHITECTURE.md`, `DESIGN_INVENTORY.md`, `ROUTE_INVENTORY.md`, `SEO_BASELINE.md`, `DATA_AUDIT.md`, `TARGET_ARCHITECTURE.md`.
3. `DATA_AUDIT.md` responde, com números: quantas vagas por estado; vagas com múltiplas funções; vagas sem prazo; salários suspeitos (B3); localizações não mapeáveis; candidaturas duplicadas; candidaturas sem CV; regras de paywall de candidatura existentes; utilizadores com várias empresas; conteúdos de teste; contadores falsos; ficheiros em buckets públicos (**risco crítico: reportar imediatamente**).
4. Auditoria de segurança rápida: endpoints sem verificação de autorização no servidor, IDOR óbvios, segredos no repositório, CVs/documentos públicos. **Falhas críticas de privacidade são corrigidas imediatamente** num PR de hotfix separado (exceção à ordem das fases), com aprovação humana para deploy.
5. Montar infraestrutura de testes: Playwright, visual regression com baselines de `main`, script de verificação de URLs.
6. Tabela MANTER / ESTENDER / REFATORAR / SUBSTITUIR / REMOVER para cada módulo.

Critérios de saída:
- [ ] 6 documentos entregues e revistos por humano.
- [ ] Baselines visuais (4 viewports × rotas principais) versionadas.
- [ ] Script de URLs passa contra staging.
- [ ] Lista de riscos críticos com estado.
- [ ] **Paragem obrigatória**: apresentar resumo ao humano (formato em K4) e aguardar "avançar".

## Fase 1 — Fundações

Trabalho: enums e transições de todas as máquinas de estado (domínio puro + testes) · `can()` + matriz completa testada · `canUseFeature()` + entitlements (todos os subjects começam com plano "Gratuito" equivalente ao comportamento atual) · feature flags + kill switches · AuditLog · Outbox + processador · IdempotencyKey · rate limiting · logger estruturado + health check · OrganizationMembership (expand + backfill) · Consent + TermsAcceptance (expand) · lint de tokens e `console.log` · CI completo (J1) · `STATE_MACHINES.md`, `PERMISSIONS.md`, `ROUTE_MATRIX.md`, `ANALYTICS_EVENTS.md`, `DATA_CLASSIFICATION.md`.

Critérios de saída:
- [ ] Cobertura ≥ 90 % em `domain/`.
- [ ] Matriz de permissões 100 % coberta por testes.
- [ ] Zero diferença visual.
- [ ] Zero mudança de comportamento com flags desligadas (E2E existentes verdes).

## Fase 2 — Integridade do núcleo: vagas e candidaturas (+ correções de confiança)

Trabalho: modelo Job completo (expand/backfill: distritos, categorias, salário em cêntimos, prazos) · JobVersion · ciclo de vida da vaga · expiração (cron + verificação no servidor) · uma função por vaga · quality score · riskScore + fila de moderação mínima no admin · formatação de moeda · **remoção do paywall de candidatura** · Application com snapshot, unicidade, deadline no servidor, idempotência · rascunho de candidatura · retirar candidatura · linha temporal do candidato (`/minhas-candidaturas` ou rota equivalente existente) · F2.8 (fecho trata candidaturas abertas) · página de vaga expirada (F8.6) · JSON-LD correto · remoção de contadores/prova social falsos (F9.2) · auditoria de conteúdo (lista para aprovação) · botão "Pediram-me dinheiro" + Report básico P1 · aviso de segurança na página de vaga.

Critérios de saída:
- [ ] E2E: candidato encontra vaga, candidata-se, vê "Recebida"; duplo clique não cria duas candidaturas; após prazo o servidor recusa.
- [ ] Alterar CV depois de candidatar não altera o que a empresa vê.
- [ ] Vaga expira sozinha e a URL devolve 200 com "Esta vaga encerrou" e semelhantes.
- [ ] Nenhuma vaga multi-função nova pode ser publicada.
- [ ] Migrações documentadas, backfill com relatório, rollback testado em staging.
- [ ] Rich Results Test (ou validador schema.org) válido em 5 vagas de staging.

## Fase 3 — ATS empresarial e notificações

Trabalho: ATS lista + Kanban + detalhe · estados e transições com history · ações em lote com confirmação · perguntas de triagem e knockout (sem rejeição automática) · notas, rating, tags, colaboração · entrevistas (E6) com .ics e lembretes · ofertas (E7) · contratação e confirmação dupla (E5) · fecho de vaga com resultado · F3.8 múltiplas posições · templates de mensagens · NotificationDispatcher completo (in-app + email; WhatsApp atrás de `V2_NOTIFICATIONS_WHATSAPP` e só se houver conta aprovada) · lembretes de silêncio · gestão de equipa (convites, roles, transferência de ownership) · seletor de organização · `NOTIFICATIONS.md`.

Critérios de saída:
- [ ] E2E empresa completo (J2) e E2E candidato completo passam em desktop e 375 px.
- [ ] Transições inválidas rejeitadas no servidor (teste).
- [ ] Falha simulada do email não impede candidatura nem mudança de estado; outbox reprocessa.
- [ ] ATS visualmente consistente com o dashboard existente (design QA assinado).

## Fase 4 — Confiança, segurança e privacidade

Trabalho: verificação de organizações (contact + documentos) e de candidatos (identidade, formação, experiência, certificação) com fila e SLA · storage privado + URLs assinadas para tudo o que é sensível · Reports completos + ModerationCase + recursos · suspensão de organização/candidato (F1.10, H9) · duplicados de organização + fusão · claim de perfil · exportação de dados · apagar conta · retenção automática · consentimentos geridos · backoffice: verificação, moderação, denúncias, organizações, vagas, utilizadores, fila de dados legados · `RUNBOOK.md` · rascunhos legais.

Critérios de saída:
- [ ] Nenhum ficheiro de CV ou documento acessível sem autenticação (teste automático com URLs diretas).
- [ ] Teste de IDOR em todos os endpoints com id.
- [ ] Apagar conta em staging cumpre H5 (verificação por query).
- [ ] Denúncia P1 com 2 reportes oculta a vaga automaticamente.

## Fase 5 — Perfil estruturado, matching explicável, pesquisa e retenção de candidatos

Trabalho: perfil estruturado completo + completude · taxonomia de skills + curadoria · matching v1 (F4) com explicações para candidato e empresa · pesquisa (F8.1–F8.3) com autocomplete e sinónimos · vagas guardadas + lembrete de prazo · alertas de vagas · recomendações · páginas SEO de categoria/localização/empresa com regras de indexação · partilha + OG dinâmico · atribuição/UTM · CV Builder (gratuito) + análise determinística.

Critérios de saída:
- [ ] Testes de equidade do matching (F4.5) passam.
- [ ] p95 da pesquisa < 300 ms com seed de 5 000 vagas.
- [ ] Orçamentos de performance (D10) cumpridos nas páginas públicas.
- [ ] Nenhuma URL antiga quebrada; sitemap válido.

## Fase 6 — Monetização

Trabalho: adapter do pagamento existente + MANUAL_TRANSFER · Payment/Invoice/Subscription com máquinas de estado · webhooks idempotentes · planos no admin · entitlements ligados a features (substituir qualquer verificação de plano espalhada) · compra de Job Post, Destaque, Recruit Pro · Programa Fundador · Career+ (CV avançado, análise detalhada, cartas, simulação de entrevista atrás de `V2_AI_ASSIST` se usar IA) · downgrade/upgrade/past-due.

Critérios de saída:
- [ ] Webhook duplicado não ativa duas vezes (teste).
- [ ] Downgrade mantém todo o histórico do ATS acessível em leitura.
- [ ] OWNER nunca perde acesso por limite de seats.
- [ ] `grep` não encontra comparações diretas de plano fora de `entitlements/`.

## Fase 7 — Banco de talentos e convites (ativação dependente de G5)

Trabalho: consentimento e visibilidade (F5.1), campanha de opt-in no produto, pesquisa de talentos com allowlist de campos, ProfileView, listas guardadas, convites com limites e qualidade (F5.3–F5.4), bloqueio de organização pelo candidato.

Critérios de saída:
- [ ] Teste que garante que a API de pesquisa de talentos nunca devolve campos fora da allowlist.
- [ ] Perfis sem consentimento nunca aparecem (teste).
- [ ] Flag permanece desligada em produção até G5 Estágio 2 + aprovação.

## Fase 8 — Inteligência de mercado e instituições

Trabalho: métricas de saúde e liquidez no admin (G6) — **estas entram mais cedo, logo que haja dados, a partir da Fase 3** · `/mercado-trabalho` com supressão de amostras pequenas (H7) · metodologia pública · Índice EmpregoSTP trimestral (quando G5 Estágio 3) · funcionalidades para universidades e centros de formação (F9.3) · relatórios para parceiros.

Critérios de saída:
- [ ] Nenhuma célula pública com n abaixo dos limiares (teste).
- [ ] Metodologia publicada e datada.

---

# PARTE J — TESTES, CI, GIT E ROLLOUT

## J1. CI (nenhum PR pronto se falhar)

`lint` · `typecheck` · `unit` · `integration` (base de dados real em contentor, não mocks) · `build` · `E2E críticos` (desktop + mobile) · `visual regression` · `URL check` · `bundle size` (D10) · `migrations` (aplicar do zero + aplicar sobre snapshot anonimizado). Lighthouse CI em páginas públicas chave (pode ser não bloqueante na Fase 1, bloqueante a partir da Fase 5).

## J2. Testes obrigatórios

Unitários (domínio puro): todas as transições válidas e inválidas de todas as máquinas · quality score · riskScore · matching (incluindo equidade e dados em falta) · formatação de moeda e prazos (fuso) · deduplicação · deteção multi-função · normalização de skills · `can()` (matriz completa) · `canUseFeature()` · retenção (que dados apagar quando).

Integração: candidatura (snapshot, unicidade, deadline, idempotência, rate limit) · fecho de vaga com candidaturas abertas · pipeline completo · entrevista e reagendamento · oferta e expiração · contratação e confirmação · pagamento (webhook duplicado, falha, manual) · outbox com falha de canal · exportação respeitando permissões · apagar conta.

E2E candidato (360/375 px e 1440 px): registo dentro do fluxo de candidatura → perfil → pesquisa → vaga → candidatura → "Recebida" → "Em análise" → entrevista (confirma) → proposta (aceita) → contratado → confirmação aos 30 dias (simulada).

E2E empresa: registo → verificação de contacto → criar vaga (bloqueio multi-função, checklist de qualidade) → revisão → publicação → receber candidatura → shortlist → entrevista → oferta → contratação → fechar vaga com resultado → candidatos restantes recebem mensagem.

E2E segurança: utilizador de outra organização não acede a candidatura por URL direta; candidato não vê notas internas; documento de verificação inacessível sem sessão.

Visual: J1. Acessibilidade: axe-core sem violações sérias/críticas nas rotas novas e alteradas.

Dados de teste: seed determinístico com organizações de todos os tipos, todos os distritos, vagas em todos os estados, candidatos com perfis variados — **nunca** dados reais.

## J3. Git

- Branch de integração: `feat/empregostp-marketplace-v2`, criado a partir de `main`, rebase semanal sobre `main`.
- Trabalho em branches curtos por tema (`feat/v2-f2-job-lifecycle`, `fix/v2-...`) com PR para o branch de integração.
- O branch de integração faz deploy automático para **staging/preview**, nunca para produção.
- Merge para `main` por fase, só por humano, com flags desligadas por defeito.
- Hotfixes de segurança críticos: branch a partir de `main`, PR direto, aprovação humana.
- Commits pequenos e convencionais: `feat(jobs): add vacancy lifecycle`, `feat(applications): persist application snapshots`, `feat(ats): add bulk reject with confirmation`, `fix(seo): keep expired job pages at 200`, `chore(migrations): backfill job districts`. Proibido "update everything", "wip", "fixes".

## J4. Descrição de PR (modelo obrigatório)

```
## Problema
## Solução
## Fase / flags envolvidas
## Migrações (link para MIGRATIONS.md, comandos, verificação)
## Screenshots (antes/depois, 1440 e 375) — obrigatório se houver UI
## Testes adicionados
## Riscos
## Rollback (passo a passo)
## Checklist: design QA (C7) · permissões · privacidade · performance · acessibilidade · copy PT
```

## J5. Rollout

Para cada flag: `staging` → `internal` (contas da equipa EmpregoSTP) → `beta` (5–10 organizações escolhidas + candidatos convidados, com canal de feedback) → `limited` (rolloutPercent 25 %, depois 50 %) → `production` (100 %). Avançar só com: zero erros críticos novos em 7 dias, métricas de funil sem degradação > 10 %, feedback beta tratado.

Rollback: desligar a flag (minutos); migrações em modo expand nunca bloqueiam rollback de código; contract só após estabilidade (D7).

---

# PARTE K — DEFINIÇÃO DE CONCLUÍDO, ANTI-PADRÕES E ARRANQUE

## K1. Anti-padrões proibidos

- Redesign, segundo design system, componentes `v2`/`New*`, novas fontes ou paletas.
- Cores e espaçamentos literais em código novo.
- Strings de estado soltas; booleanos para processos multi-estado.
- Regra de negócio em componentes; verificação de permissões só no cliente.
- `if (plan === 'premium')` fora de `entitlements/`.
- Enviar email/WhatsApp diretamente de um handler de ação.
- Candidatura dependente de serviço externo (email, IA, WhatsApp) para ser gravada.
- Rejeição automática silenciosa; IA a decidir sem humano.
- Qualquer vantagem paga para candidatos em candidaturas ou ranking.
- Números inventados, testemunhos falsos, contadores falsos, parcerias sugeridas sem existirem.
- Expor contactos, documentos ou expectativa salarial sem consentimento.
- Ficheiros sensíveis em buckets públicos ou URLs permanentes.
- Filtrar milhares de registos no cliente; listas sem paginação.
- Apagar fisicamente vagas, candidaturas ou históricos com valor de auditoria.
- Mudar URLs sem 301; devolver 404 em vagas que existiram.
- Introduzir Redux/Zustand, Elasticsearch, microserviços, Kafka ou Redis sem necessidade demonstrada em ADR.
- `console.log` como observabilidade; PII em logs ou analytics.
- Big bang rewrite; PRs gigantes; trabalhar em `main`.
- Texto em português do Brasil ou jargão SaaS.

## K2. Definição de concluído (por funcionalidade)

Uma funcionalidade está concluída quando: regras de domínio testadas · permissões no servidor testadas · estados loading/vazio/erro implementados · funciona a 360 px · acessível (teclado, labels, contraste) · texto PT revisto e centralizado · eventos de analytics emitidos sem PII · notificações (se aplicável) via outbox · atrás de flag · documentação atualizada (`STATE_MACHINES`, `PERMISSIONS`, `ROUTE_MATRIX`, `MIGRATIONS`) · screenshots no PR · design QA C7 completo.

## K3. Condição final de qualidade da v2

O trabalho **não** está concluído porque existem páginas novas, dashboards bonitos ou muitas features. Está concluído quando, verificado em staging e depois em produção:

- [ ] O design original é reconhecível; visual regression sem diferenças não intencionais.
- [ ] Todas as rotas existentes funcionam (200 ou 301→200); SEO estável (cobertura de indexação não cai).
- [ ] Candidato procura, filtra, guarda, recebe alertas, candidata-se gratuitamente, acompanha cada estado com datas.
- [ ] A candidatura fica congelada (snapshot) e única.
- [ ] Empresa recebe, analisa, faz triagem, entrevista, oferece, contrata e fecha com resultado.
- [ ] Nenhuma candidatura fica sem resposta após o fecho da vaga.
- [ ] Matching é determinístico, explicado e passa testes de equidade.
- [ ] Vagas expiram sozinhas; prazos verificados no servidor.
- [ ] Organizações são verificáveis; denúncias de pedido de dinheiro ocultam vagas rapidamente.
- [ ] Dados privados protegidos: sem ficheiros públicos, sem IDOR, contactos só com consentimento.
- [ ] Exportar e apagar conta funcionam; retenção aplica-se sozinha.
- [ ] Pagamentos idempotentes; entitlements centralizados; downgrade não destrói dados.
- [ ] Orçamentos de performance cumpridos em mobile.
- [ ] CI e E2E (desktop + mobile) verdes.
- [ ] North Star mensurável no admin com dados reais.
- [ ] Preview validado visualmente por humano.

## K4. Primeira resposta esperada do agente (fim da Fase 0)

Ao terminar a Fase 0, o agente para e entrega ao humano, em português, **no máximo 2 páginas**:

1. **Stack real** (5–10 linhas) e o que isso muda neste plano (referir D2).
2. **Riscos críticos** encontrados (privacidade, segurança, dados), com o que já foi corrigido e o que precisa de aprovação.
3. **Estado dos dados**: números do `DATA_AUDIT.md` mais relevantes.
4. **Desvios propostos** a este documento (se algum), cada um com motivo.
5. **Decisões pendentes da lista A4**, cada uma com recomendação.
6. **Plano da Fase 1** com lista de PRs previstos.

E só avança com "avançar".

## K5. Princípio final

Não reinventar o EmpregoSTP. **Evoluir o EmpregoSTP.**

Preservar o que lhe dá identidade. Corrigir o que compromete a confiança. Expandir o que gera contratações. Remover o que gera ruído.

Toda funcionalidade nova deve parecer planeada desde a primeira versão — e a plataforma final deve ser muito mais poderosa sem deixar de parecer EmpregoSTP.
