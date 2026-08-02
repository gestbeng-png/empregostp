# Sistema visual do EmpregoSTP

Todas as rotas, exceto a Home, seguem a linguagem visual Workbridge. Os
dashboards Admin, Empresa e Candidato preservam a arquitetura de informação do
projeto Claude Design `EmpregoSTP Design System`, mas usam a mesma tipografia,
paleta, geometria e estados do restante produto. A Home permanece visualmente
inalterada.

As especificações canónicas encontram-se em:

- [`docs/workbridge-design-system.md`](docs/workbridge-design-system.md), para as rotas públicas e autenticação;
- [`docs/dashboard-design-system.md`](docs/dashboard-design-system.md), para a adaptação Workbridge dos dashboards e respetivas rotas.

## Fonte de verdade no código

- Tema Workbridge isolado da Home: `styles/workbridge-theme.css`
- Tokens globais preexistentes: `styles/globals.css`
- Shell público: `styles/PublicPageShell.module.css`
- Navegação pública: `styles/LandingHeader.module.css`
- Footer: `styles/Footer.module.css`
- Autenticação: `styles/AuthPage.module.css`
- Dashboards e temas claro/escuro: `styles/dashboard-shell.css`
- Ajustes de cada rota: respetivo CSS Module em `styles/`

Novas superfícies devem reutilizar os tokens existentes e preservar o contrato funcional: nenhum trabalho visual pode alterar rotas, permissões, consultas, handlers, IDs, campos ou conteúdo dinâmico.
