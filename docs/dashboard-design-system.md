# Design system dos dashboards

## Fonte de verdade

Admin, Empresa e Candidato preservam a arquitetura e o conteúdo dos ficheiros
`Admin Dashboard.html`, `Dashboard Empresa.html` e `Dashboard Candidato.html` do
projeto Claude Design. A expressão visual final é Workbridge. O contrato
partilhado vive em `styles/dashboard-shell.css`; regras específicas de uma área
não devem redefinir fundo, superfície, texto ou comportamento de tema.

## Identidade

- Tipografia: Instrument Sans local, com Arial e `sans-serif` como fallback.
- Marca: branco, navy `#102441`, azul `#064bb5`, sky `#69c8ff`,
  verde-lima `#daff45` e neutros.
- Sidebar: 272 px no Admin e 268 px na Empresa/Candidato; drawer abaixo de 860 px.
- Superfícies: raio de 8 px; controlos e navegação usam 4 px.
- Sombras: removidas das superfícies normais; borda e contraste definem profundidade.
- Movimento: 180–350 ms; `prefers-reduced-motion` elimina transições não essenciais.

## Tokens de tema

| Token                   | Claro     | Escuro                  | Uso                     |
| ----------------------- | --------- | ----------------------- | ----------------------- |
| `--dash-canvas`         | `#eef4f8` | `#0d1526`               | Fundo do painel         |
| `--dash-canvas-soft`    | `#f8fafb` | `#111d35`               | Fundo secundário        |
| `--dash-surface`        | `#ffffff` | `#1a2540`               | Cards, menus e tabelas  |
| `--dash-surface-subtle` | `#f8fafb` | `#1e2b4d`               | Linhas e estados vazios |
| `--dash-ink`            | `#102441` | `rgba(255,255,255,.95)` | Texto principal         |
| `--dash-ink-muted`      | `#68717d` | `#b7c8e8`               | Texto secundário        |
| `--dash-border`         | `#e4e5e8` | `rgba(125,206,255,.14)` | Divisores e contornos   |
| `--dash-blue`           | `#064bb5` | `#6a9cff`               | Ações e navegação       |
| `--dash-sky`            | `#69c8ff` | `#7dceff`               | Informação e gráficos   |
| `--dash-lime`           | `#daff45` | `#daff45`               | Destaque e plano        |
| `--dash-success`        | `#168a55` | `#4ade80`               | Confirmação             |
| `--dash-danger`         | `#c23d4f` | `#f87191`               | Erro e ação destrutiva  |

As cores de texto para informação, sucesso, aviso e erro usam tokens separados
dos tons decorativos. Isso mantém contraste legível nos dois temas. O atributo
`data-theme` existe apenas na raiz `.dashShell`, e todos os papéis herdam o mesmo
conjunto de superfícies; nenhum papel pode forçar valores claros ou escuros.

## Estrutura comum

- `DashboardShell`: sidebar, topbar, pesquisa, tema, perfil e logout.
- `DashboardPageHeader`: título, contexto e ações de página.
- `DashboardMetricCard`: métrica com ícone, tendência e navegação opcional.
- `DashboardState`: carregamento, vazio, erro e sucesso com ação seguinte.
- `DashboardStatusBadge`: estado textual que não depende apenas da cor.
- `DashboardRouteFrame`: integra rotas antigas no shell sem duplicar navegação.

Cards só são usados para unidades reais de informação ou ação. Secções de página
permanecem sem molduras aninhadas. Botões com apenas ícone têm `aria-label` e área
interativa estável; comandos textuais usam verbo e resultado.

## Contexto por papel

### Candidato

Prioriza progresso do perfil, candidaturas ativas, entrevistas, vagas guardadas e
recomendações. A ação principal é explorar vagas; o gerador de CV é secundário.

### Empresa

Prioriza vagas ativas, candidaturas recebidas, banco de candidatos, entrevistas e
análise. A ação principal é publicar uma vaga.

### Admin

Prioriza métricas globais, verificações, utilizadores, vagas, relatórios, conteúdo,
planos, pagamentos e auditoria. Ações rápidas apontam sempre para rotas reais.

## Estados e feedback

- Carregamento: skeleton ou mensagem específica, sem mudança brusca de layout.
- Vazio: explica o que falta e apresenta uma única ação útil.
- Erro: mensagem específica e botão `Tentar novamente` quando recuperável.
- Sucesso: confirmação imediata que repete o nome da ação concluída.
- Navegação: cards e links apresentam estado de abertura sem bloquear novo separador.
- Tema: preferência persistida em `estp-theme` e sincronizada entre separadores.

## Responsividade e acessibilidade

- `>= 1080 px`: quatro métricas por linha e grelhas completas.
- `861–1079 px`: métricas em duas colunas e conteúdo principal numa coluna.
- `<= 860 px`: sidebar em drawer com Escape, backdrop e retorno de foco.
- `<= 560 px`: métricas e ações em coluna, tabelas com scroll próprio.
- Foco visível, ligação `Saltar para o conteúdo` e contraste independente do tema.
- Texto e controlos não mudam dimensões no hover; animações respeitam redução de movimento.
