# Auditoria de rotas dos dashboards

Este documento é a lista de controlo visual e funcional dos painéis EmpregoSTP. As rotas partilham `DashboardShell`; páginas antigas são integradas por `DashboardRouteFrame` até à migração completa.

## Entrada e encaminhamento

| Rota | Responsabilidade |
| --- | --- |
| `/dashboard` | Identifica o papel autenticado e encaminha para o painel correto. |

## Candidato

| Rota/área | Conteúdo principal |
| --- | --- |
| `/dashboard/candidato` | Visão geral e progresso profissional. |
| `?tab=profile` | Perfil e dados profissionais. |
| `?tab=applications` | Candidaturas e respetivos estados. |
| `?tab=saved` | Vagas guardadas. |
| `?tab=interviews` | Entrevistas e respostas. |
| `?tab=messages` | Conversas com empresas. |
| `?tab=notifications` | Notificações e ações relacionadas. |
| `?tab=settings` | Preferências da conta e notificações. |
| `?tab=verification` | Verificação modular do perfil. |
| `?tab=plans` | Planos e upgrade. |
| `?tab=affiliate` | Programa de afiliados. |
| `/dashboard/candidato/candidaturas` | Vista dedicada das candidaturas. |
| `/dashboard/candidato/vaga` | Compatibilidade da área de vagas guardadas. |

## Empresa

| Rota/área | Conteúdo principal |
| --- | --- |
| `/dashboard/empresa` | Visão geral operacional. |
| `?tab=jobs` | Vagas da empresa. |
| `?tab=applications` | Candidaturas recebidas e pipeline. |
| `?tab=candidates` | Banco de talentos. |
| `?tab=interviews` | Entrevistas e decisões. |
| `?tab=messages` | Conversas com candidatos. |
| `?tab=analytics` | Métricas e desempenho. |
| `?tab=hr-services` | Pedidos de serviço RH. |
| `?tab=plans` | Planos empresariais. |
| `?tab=affiliate` | Programa de afiliados. |
| `/dashboard/empresa/profile` | Perfil institucional. |
| `/dashboard/empresa/vagas` | Gestão dedicada de vagas. |
| `/dashboard/empresa/vaga/criar-vaga` | Criação de vaga. |
| `/dashboard/empresa/vaga/[id]` | Detalhe e gestão de uma vaga. |
| `/dashboard/empresa/candidato/[id]` | Avaliação do perfil de candidato. |

## Admin

| Rota | Conteúdo principal |
| --- | --- |
| `/dashboard/admin` | Métricas globais e prioridades operacionais. |
| `/dashboard/admin/users` | Utilizadores. |
| `/dashboard/admin/users/[id]` | Detalhe do utilizador. |
| `/dashboard/admin/users/[id]/edit` | Edição do utilizador. |
| `/dashboard/admin/jobs` | Vagas da plataforma. |
| `/dashboard/admin/jobs/create` | Criação administrativa de vaga. |
| `/dashboard/admin/jobs/[id]` | Detalhe da vaga. |
| `/dashboard/admin/jobs/[id]/edit` | Edição da vaga. |
| `/dashboard/admin/verificacoes` | Pedidos de verificação. |
| `/dashboard/admin/subscription-requests` | Solicitações de subscrição. |
| `/dashboard/admin/plans` | Planos e regras comerciais. |
| `/dashboard/admin/payment-settings` | Dados e instruções de pagamento. |
| `/dashboard/admin/services` | Catálogo de serviços. |
| `/dashboard/admin/services/[id]` | Edição de serviço. |
| `/dashboard/admin/hr-services` | Operação dos serviços RH. |
| `/dashboard/admin/affiliates` | Afiliados. |
| `/dashboard/admin/blog` | Conteúdo do blog. |
| `/dashboard/admin/blog/[id]` | Edição de artigo. |
| `/dashboard/admin/news` | Notícias. |
| `/dashboard/admin/news/[id]` | Edição de notícia. |
| `/dashboard/admin/resources` | Recursos. |
| `/dashboard/admin/resources/[id]` | Edição de recurso. |
| `/dashboard/admin/testimonials` | Testemunhos. |
| `/dashboard/admin/reports` | Relatórios operacionais. |
| `/dashboard/admin/auditoria` | Registo de auditoria. |

## Critérios de conclusão por rota

- Uma única navegação e um único `<main>`.
- Título, contexto e ação principal inequívocos.
- Estado de carregamento sem salto de layout.
- Estado vazio que explica e orienta.
- Erro recuperável com ação “Tentar novamente”.
- Sucesso com confirmação explícita.
- Foco visível, rótulos persistentes e áreas interativas adequadas.
- Texto funcional e metadados com pelo menos 14 px.
- Sem overflow horizontal a 390 px nem nas vistas desktop suportadas.
- Tabelas com scroll próprio em ecrãs pequenos.
- Sem perda de funcionalidade, autorização ou dados.
