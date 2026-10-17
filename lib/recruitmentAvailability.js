/**
 * ADR-019 — «Recrutamento e equipa» está retirado do site por agora.
 *
 * Um único interruptor para servidor e browser: as páginas redirecionam, as
 * APIs do lado empresa/equipa respondem 404 e a navegação esconde os itens.
 * O código mantém-se; para reativar, definir
 * NEXT_PUBLIC_RECRUITMENT_WORKSPACE_ENABLED=true e voltar a fazer o build
 * (as variáveis NEXT_PUBLIC_ são embutidas no código do browser).
 *
 * O lado do candidato (acompanhamento, retirar, confirmar entrevista e início
 * de atividade) não depende deste interruptor.
 */
export function isRecruitmentWorkspaceEnabled() {
  return process.env.NEXT_PUBLIC_RECRUITMENT_WORKSPACE_ENABLED === 'true';
}
