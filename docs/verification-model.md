# Modelo de verificação de candidatos

A plataforma distingue o selo incluído no Premium e a aprovação por competências.

## Verificação automática do Premium

O plano Premium ativo (`unlimited_candidato`) ativa automaticamente o selo
`paid`, sem pedido adicional, envio de documentos ou segunda compra. A regra
usa exclusivamente o plano já ativado em `users/{uid}`; selecionar um plano,
criar um pedido ou enviar um comprovativo ainda em análise não ativa o selo.
Vale para Premium existentes e para ativações futuras, manuais ou online.

`hasActivePremiumVerification` verifica o plano atual e a validade das datas.
`getCandidateVerification` e `buildCandidateVisibility` aplicam a mesma regra
ao dashboard, API de perfil, perfil público e listagens de verificados. Não é
necessária uma migração nem escrever flags permanentes durante uma leitura.
O benefício termina quando o Premium expira ou muda para outro plano, salvo
se o candidato também tiver uma verificação independente aprovada.

Este selo comercial não significa que a identidade ou as competências foram
analisadas. Não cria registos fictícios de documentos aprovados. Pedidos
antigos pendentes ou rejeitados não anulam o benefício do Premium.

## Verificação documental

O produto Verificação (`verification_candidato`) mantém o fluxo existente de
envio de documentos e aprovação administrativa, independente do Premium.

Campos compatíveis:

- `verificationType: "paid"`
- `verificationTypes: ["paid"]`
- `verificationStatus`, `verificationSummary` e `verificationItems`

Os campos históricos `verified`, `verificado` e `isVerified` continuam a ser aceites para não retirar selos de dados antigos. Quando uma nova revisão é gravada, a origem passa a ser explicitamente `paid`.

## Alta qualificação

É gratuita e depende da análise administrativa das informações, descrições,
links e comprovativos enviados. Só uma aprovação concede `qualified`
(“Altamente qualificado”). Completar o perfil ou comprar Premium não aprova
competências automaticamente. Um candidato pode ter ambos os selos.

O preenchimento do perfil e a existência de CV, competências e experiência
continuam a ajudar na análise, mas não equivalem a uma aprovação.

Campos calculados:

- `qualifiedVerified`;
- `qualificationScore`;
- `qualificationLabel: "Altamente qualificado"`;
- `verificationTypes: ["qualified"]` ou `['paid', 'qualified']`.

## Estado e controlo administrativo

- `paidVerified`, `qualifiedVerified`, `premiumVerified` e `verificationTypes`
  são a projeção efetiva dos selos.
- A API de perfil expõe `verificationStatus: "verified"` quando o selo está
  ativo e mantém o estado documental em `verificationReviewStatus`.
- `verificationSummary` e `verificationItems` continuam a representar a
  análise de evidências, não a subscrição.
- Uma desativação global explícita pelo admin guarda
  `verificationDisabled: true`, suspendendo também o selo Premium; uma
  aprovação/reativação global remove essa suspensão. Rejeitar um documento
  não suspende o benefício comercial.

## Exposição para empresas

O banco de talentos e os perfis públicos mostram os dois selos separadamente. A área da empresa pode filtrar por:

- todos os verificados;
- verificação documental;
- alta qualificação.

O cálculo é feito no servidor com os dados atuais do plano e da revisão.
As regras existentes de privacidade e acesso a perfis permanecem aplicadas.

## Regra de produto

Alta qualificação não melhora a ordem de candidaturas nem cria prioridade paga. O selo comunica qualidade do perfil; não substitui a avaliação da empresa nem a verificação de identidade.
