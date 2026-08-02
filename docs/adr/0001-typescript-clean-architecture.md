# ADR 0001: migração incremental para TypeScript e Clean Architecture

- Estado: aceite
- Data: 2026-07-12
- Responsáveis: equipa Empregos STP

## Contexto

O produto iniciou esta decisão com 216 ficheiros JavaScript e cerca de 61 500 linhas nas áreas de páginas, componentes, contexto e bibliotecas. Uma renomeação global sem contratos de domínio e testes tornaria o compilador verde sem aumentar a segurança real e ampliaria o risco de regressões nas jornadas já publicadas.

## Decisão

A migração será feita por fatias verticais completas. Cada fatia deve atravessar as seguintes fronteiras físicas:

- `domain/`: entidades, tipos nominais e regras puras, sem Firebase ou React.
- `application/`: casos de uso, contratos Zod e portas.
- `infrastructure/`: Firebase, HTTP e composição das implementações.
- `presentation/`: controladores React, estado assíncrono e componentes.

O `tsconfig.json` ativa `strict`, `noUncheckedIndexedAccess`, `noImplicitReturns` e `esModuleInterop`. `allowJs` permanece temporariamente ativo apenas para manter as áreas ainda não migradas executáveis. Todo ficheiro novo ou convertido deve ser TypeScript estrito, sem `any` explícito.

Os identificadores de domínio usam branded types. O contrato Zod de cada formulário é partilhado entre o navegador e a API. A autorização permanece no servidor e as gravações críticas passam pelo Firebase Admin. As regras do Firestore negam a gravação direta pelo cliente.

## Primeira fatia

As configurações do candidato são a implementação de referência:

1. `CandidateSettings` define a entidade e os valores permitidos.
2. Os casos de uso recebem `UserId` nominal e dependem de uma porta de repositório.
3. O repositório Firebase valida o tipo de conta e grava numa transação.
4. A API valida o mesmo schema usado pelo gateway HTTP.
5. O controlador React trata loading, erro e sucesso sem lógica de persistência no JSX.
6. As mensagens visíveis da fatia vivem em `shared/i18n/pt.ts`.

## Ferramentas e compatibilidade

- TypeScript 5.9 foi escolhido pela compatibilidade estável com o ecossistema ESLint instalado.
- Node 22.11 ou superior é o runtime suportado. O CI fixa a linha Node 22 e o repositório inclui `.nvmrc`.
- `@firebase/rules-unit-testing` 4 foi mantido porque o cliente atual usa Firebase 11.
- Firebase Admin 13.10 é exposto aos módulos legados por um adaptador modular em `lib/firebaseAdmin.js`; novas infraestruturas usam imports modulares diretos. A linha 14 foi rejeitada porque a sua cadeia de autenticação não executa no Node 22.11 padrão do ambiente.
- Tailwind CSS 4 é carregado sem Preflight nesta fase para não alterar silenciosamente os estilos globais existentes.
- Motion usa redução de movimento do sistema e transições de 240 ms.
- Firebase Emulator Suite exige Java 21 localmente e no CI.

## Verificação obrigatória por fatia

- Typecheck e lint.
- Testes unitários do caso de uso e do contrato.
- Teste de interface com Testing Library.
- Integração no Firebase Emulator quando houver persistência.
- Teste das Security Rules.
- Jornada Playwright em desktop e mobile, com axe.
- Build de produção.

## Consequências

A arquitetura passa a ter duas realidades durante a transição: funcionalidades migradas com garantias estritas e módulos JavaScript legados ainda aceites pelo compilador. Essa dívida é visível e mensurável no inventário de migração.

`allowJs` só pode ser removido quando o inventário JavaScript chegar a zero, o CI estiver verde e todas as jornadas visíveis tiverem cobertura. Renomear ficheiros sem tipar os contratos não conta como migração.
