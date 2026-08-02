# Inventário da migração TypeScript

Atualizado em 2026-07-12.

## Estado inicial

- 216 ficheiros JavaScript e JSX.
- Aproximadamente 61 500 linhas em `pages`, `components`, `context` e `lib`.
- Sem configuração TypeScript, Jest, Playwright ou testes das regras Firebase.

## Estado atual

| Contexto | TypeScript estrito | Domínio e casos de uso | Contrato partilhado | Testes |
| --- | --- | --- | --- | --- |
| Configurações do candidato | Concluído | Concluído | Zod | Unitário, interface, integração, regras e E2E autenticado |
| Autenticação e registo | Pendente | Pendente | Pendente | Login público e autenticado no emulador |
| Dashboard do candidato | Pendente | Pendente | Pendente | Pendente |
| Dashboard da empresa | Pendente | Pendente | Pendente | Pendente |
| Serviços de RH | Pendente | Pendente | Pendente | Pendente |
| Administração | Pendente | Pendente | Pendente | Pendente |
| Planos e pagamentos | Pendente | Pendente | Pendente | Pendente |
| Mensagens e notificações | Pendente | Pendente | Pendente | Pendente |

## Ordem de migração

1. Autenticação, sessão e perfis.
2. Serviços de RH, incluindo submissão, análise e entrega de resultados.
3. Planos, comprovativos e estados de pagamento.
4. Candidaturas, vagas e entrevistas.
5. Mensagens, notificações e restantes recursos.
6. Remoção de `allowJs`, auditoria final de dependências e cobertura E2E completa.

## Critério de conclusão

A migração termina apenas quando não existirem ficheiros JavaScript de aplicação, `allowJs` estiver desativado, todos os contratos externos forem validados e cada jornada visível tiver pelo menos um teste E2E para loading, vazio, erro e sucesso quando esses estados forem aplicáveis.
