> **OBSOLETO — não reflete o estado atual do projeto.**
> Arquivado na auditoria de release de agosto de 2026. Mantido apenas como
> registo histórico. As fontes de verdade são o `README.md`, o
> `DESIGN-SYSTEM.md`, o `docs/DEPLOY-GUIDE.md` e o relatório em
> `docs/audits/release-audit-2026-08.md`.

# Funcoes do painel admin

Este arquivo resume as funcoes atuais do painel administrativo conforme as paginas em `pages/dashboard/admin`.

## Dashboard administrativo (/dashboard/admin)
- Visao geral do sistema: total de usuarios, candidatos, empresas e vagas.
- Estatisticas de vagas: ativas, fechadas, desativadas, candidaturas totais.
- Lista das ultimas vagas criadas com status, data e link para detalhes.
- Botao de atualizar para recarregar os dados.
- Atalhos para gestao de usuarios, vagas, servicos, planos, configuracoes de pagamento, solicitacoes e relatorios.
- Insights inteligentes com grafico de indicadores do sistema.
- IA Hiring Advisor com dicas de gestao e recrutamento.
- Banco de talentos (previa) com acesso rapido a usuarios.

## Usuarios (/dashboard/admin/users)
- Listar todos os usuarios com pesquisa por nome, email ou telefone.
- Filtrar por tipo (candidato, empresa, admin).
- Ver detalhes do usuario.
- Editar usuario (nome, tipo e status; email bloqueado).
- Desativar usuario.
- Para candidatos: ver historico de candidaturas e abrir perfil completo.

## Vagas (/dashboard/admin/jobs)
- Listar vagas com pesquisa por titulo, empresa e localizacao.
- Filtrar por status (ativa, fechada, desativada).
- Ver contagem de candidaturas e visualizacoes por vaga.
- Ver detalhes da vaga (descricao, requisitos, beneficios, salario, datas).
- Alterar status da vaga (ativar, fechar, desativar).
- Editar vaga (titulo, descricao, requisitos, salario, localizacao, tipo de contrato, prazo, status).
- Ver lista de candidaturas por vaga e acessar o perfil do candidato.

## Servicos (/dashboard/admin/services)
- Listar servicos com pesquisa por titulo, descricao ou categoria.
- Filtrar por status (ativo/inativo).
- Adicionar novo servico (titulo, descricao, categoria, status).
- Ver detalhes do servico.
- Alterar status do servico (ativar/inativar).
- Excluir servico.

## Planos e assinaturas (/dashboard/admin/plans)
- Listar planos por tipo (empresa ou candidato).
- Criar, editar e excluir planos.
- Criar planos padrao.
- Definir recursos, duracao, preco, limite de vagas e destaques.
- Ver estatisticas de solicitacoes (total, pendentes, aprovadas, rejeitadas).
- Aprovar ou rejeitar solicitacoes de assinatura.

## Solicitacoes de assinatura (/dashboard/admin/subscription-requests)
- Listar pedidos de assinatura premium.
- Aprovar ou rejeitar pedidos.

## Configuracoes de pagamento (/dashboard/admin/payment-settings)
- Visualizar e editar dados de pagamento (numero da conta, nome da conta, banco, email, instrucoes).

## Relatorios (/dashboard/admin/reports)
- Relatorio de usuarios (totais por tipo).
- Relatorio de vagas (totais e status).
- Relatorio de candidaturas (total).
- Atividades recentes (ultimas 10 entradas).

## Observacoes
- Existe um link de "Editar" na lista de servicos para `/dashboard/admin/services/[id]/edit`, mas essa rota nao esta presente no codigo atual.
