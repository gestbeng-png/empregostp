# EmpregoSTP

Plataforma de emprego em São Tomé e Príncipe, com Next.js (Pages Router), React e Firebase. As versões das dependências estão em `package.json`; `package-lock.json` fixa a instalação.

## Desenvolvimento

1. Use Node.js 22, no mínimo 22.11 (`nvm use`, se tiver nvm).
2. Execute `npm ci`.
3. Configure `.env.local` com as variáveis descritas no [guia de publicação](docs/DEPLOY-GUIDE.md).
4. Execute `npm run dev` e abra `http://localhost:3000`.

O projeto usa Firebase remoto. Para desenvolvimento, use um projeto de testes com credenciais próprias. Não há infraestrutura de emuladores.

Os testes unitários usam mocks e não devem ser convertidos em testes de escrita na base online. `firebase.json` mantém apenas regras e índices para publicação explícita. Os scripts `scripts/v2/backfill-jobs.mjs` e `backfill-memberships.mjs` aceitam apenas `--input ficheiro.json`: analisam exports localmente, sem alterar dados.

Os relatórios antigos em `docs/v2/` conservam evidências históricas de ferramentas entretanto removidas; os comandos de emulação nesses relatórios já não são suportados.

## Verificação

```sh
npm run quality
npm run build
```

`quality` executa TypeScript, ESLint e testes unitários. Os testes de integração e regras que dependiam de emuladores foram removidos; não estão cobertos pelo CI atual.

Os testes de navegador restantes exigem um ambiente dedicado, configurado e com dados de teste:

```sh
E2E_BASE_URL=https://seu-ambiente-de-testes npm run test:e2e
```

Use `npm run format:check` para verificar formatação. `npm run format` altera os ficheiros; reveja o diff antes de guardar as alterações.

## Estrutura

| Diretório                           | Responsabilidade                                                        |
| ----------------------------------- | ----------------------------------------------------------------------- |
| `pages/`                            | Rotas, páginas e APIs do Next.js                                        |
| `components/`, `hooks/`, `context/` | Interface e estado partilhado                                           |
| `lib/`                              | Integrações e funções usadas pela aplicação                             |
| `domain/`, `application/`           | Regras de domínio, contratos e casos de uso em TypeScript               |
| `infrastructure/`, `presentation/`  | Implementações de persistência e interface das funcionalidades migradas |
| `styles/`, `public/`, `shared/`     | Estilos, recursos públicos e contratos partilhados                      |
| `tests/`, `e2e/`                    | Testes unitários e de navegador                                         |
| `scripts/`                          | Ferramentas operacionais e geração de configuração                      |

JavaScript e TypeScript coexistem. A migração é incremental; `allowJs` continua necessário. As configurações do candidato são uma referência da organização por camadas. Autorização e validação de dados permanecem no servidor.

## Porque existem estes ficheiros de configuração

| Ficheiro                                                     | Uso                                                                                 |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `package.json`, `package-lock.json`                          | Comandos, dependências e versões instaláveis                                        |
| `.nvmrc`                                                     | Seleciona Node.js 22                                                                |
| `next.config.mjs`                                            | Build e cabeçalhos HTTP de segurança                                                |
| `tsconfig.json`                                              | Verificação TypeScript e aliases de imports                                         |
| `eslint.config.mjs`                                          | Regras de análise estática                                                          |
| `.prettierrc.json`, `.prettierignore`                        | Formatação e exclusão de artefactos gerados                                         |
| `postcss.config.mjs`, `tailwind.config.js`                   | Estilos Tailwind; a configuração é importada por `styles/globals.css`               |
| `jest.config.ts`, `jest.setup.ts`                            | Execução e preparação dos testes unitários                                          |
| `playwright.config.ts`                                       | Testes de navegador desktop e mobile                                                |
| `firebase.json`, `.firebaserc`                               | Ficheiros de regras e projeto Firebase usado pelo CLI                               |
| `firestore.rules`, `storage.rules`, `firestore.indexes.json` | Permissões e índices da base de dados e dos ficheiros                               |
| `vercel.json`                                                | Agendamento das tarefas de expiração                                                |
| `.vercelignore`                                              | Exclusões de uploads pelo CLI da Vercel                                             |
| `.gitignore`, `.gitattributes`                               | Exclusões do Git e normalização de texto                                            |
| `.github/workflows/quality.yml`                              | Verificações automáticas de qualidade e build                                       |
| `.claude/launch.json`                                        | Atalho opcional de desenvolvimento da ferramenta Claude; não é usado pela aplicação |

`.env.local` contém configuração privada. `.next/`, `.next-*/`, `node_modules/`, `.swc/`, `test-results/`, `next-env.d.ts` e `*.tsbuildinfo` são gerados e não entram no Git. `.vercel/` guarda a ligação local ao projeto de publicação.

## Documentação operacional

- [Publicação e reversão](docs/DEPLOY-GUIDE.md)
- [Configuração de email](docs/email-brevo-zoho.md)
- [Índice completo da documentação](docs/README.md)

Resultados antigos em `docs/audits/data/` são artefactos de auditoria, não requisitos atuais. Os registos de contas de teste e as cópias de regras para reversão foram preservados. Relatórios textuais obsoletos podem ser consultados no histórico Git.
