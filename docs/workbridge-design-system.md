# Sistema visual Workbridge — EmpregoSTP

Este documento define o contrato visual comum do site público, autenticação e dashboards. O conteúdo, as permissões, os dados e os fluxos de cada rota permanecem independentes do tema.

## Direção

- Estrutura editorial composta por grandes superfícies brancas, navy, sky e lime.
- Instrument Sans para interface e títulos; Inter para dados, metadados, tabelas e valores compactos.
- Geometria plana, bordas finas, muito espaço negativo e raios de 4–10 px.
- Azul identifica ação e navegação; lime identifica estado, prioridade e ênfase.
- Sombras são excecionais. Cards normais dependem de borda e contraste de superfície.
- O anel monumental e os starbursts pertencem apenas à Home.
- Páginas editoriais usam o arco circular claro do template; ferramentas,
  artigos e detalhes usam cabeçalhos compactos adequados à tarefa.

## Tokens

| Função                        | Valor     | Token principal             |
| ----------------------------- | --------- | --------------------------- |
| Ink / superfície estrutural   | `#102441` | `--app-brand-dark`          |
| Campo editorial navy          | `#1e2b4d` | `--dash-field-navy`         |
| Ação primária                 | `#064bb5` | `--app-brand-primary`       |
| Hover de ação                 | `#0a65cc` | `--app-brand-primary-hover` |
| Informação / plano sky        | `#69c8ff` | `--app-brand-secondary`     |
| Destaque lime                 | `#daff45` | `--app-brand-lime`          |
| Texto corrido                 | `#383750` | `--app-text-secondary`      |
| Texto auxiliar acessível      | `#596371` | `--app-text-muted`          |
| Cinzento neutro da referência | `#767f8c` | `--app-gray`                |
| Borda                         | `#e4e5e8` | `--app-border-subtle`       |
| Fundo auxiliar azul           | `#eef4f8` | `--app-primary-light`       |
| Fundo auxiliar lime           | `#eefabf` | `--app-secondary-light`     |
| Superfície                    | `#ffffff` | `--app-surface-1`           |

## Tipografia

| Nível            | Desktop  | Mobile   | Peso / entrelinha |
| ---------------- | -------- | -------- | ----------------- |
| Hero editorial   | 64 px    | 44–46 px | 700 / 1.05        |
| Título de secção | 46 px    | 36 px    | 700 / 1.2         |
| H3               | 32 px    | 28 px    | 600–700 / 1.15    |
| H4               | 26 px    | 22 px    | 600 / 1.4         |
| Título de card   | 20 px    | 18 px    | 600 / 1.4         |
| Lead             | 18 px    | 17 px    | 400 / 1.5         |
| Corpo            | 16 px    | 16 px    | 400 / 1.5         |
| Metadado         | 14 px    | 14 px    | 400–600 / 1.5     |
| Badge            | 12–14 px | 12–14 px | 600–700 / 1.5     |

Nenhum texto funcional deve ficar abaixo de 14 px. Botões usam 14–16 px e peso
600–700, com rótulos em frase para manter leitura natural.

## Layout e componentes

- Container público: 1200 px com padding lateral responsivo.
- Secções: 120 px em `>=1280`, 80 px entre 992 e 1279, 60 px abaixo de 768.
- Botões e inputs: raio 4 px, altura mínima de 44 px.
- Cards: raio 8 px; categorias podem usar 10 px.
- Badges e avatares podem ser circulares.
- Foco: outline azul visível de 3 px; não depende apenas de mudança de cor.
- Tabelas: Inter, cabeçalho em superfície auxiliar, scroll horizontal em ecrãs estreitos.
- Modais: overlay navy translúcido, superfície branca, raio 8 px e uma única ação primária.

## Responsividade

- `>=1280 px`: tipografia e espaçamento máximos, grelhas de três colunas.
- `992–1279 px`: secções de 80 px, grelhas principais com duas colunas quando necessário.
- `<=991 px`: navegação pública e sidebar tornam-se drawers; layouts split empilham.
- `<=767 px`: secções de 60 px, notícias e CTAs em uma coluna.
- `<=479 px`: hero de 52 px; grelhas, cards e botões ocupam a largura disponível.

## Aplicação por superfície

- Home: não recebe o wrapper Workbridge desta migração e conserva integralmente
  o seu desenho existente.
- Rotas públicas editoriais: arco claro, tipografia navy e progressão visual para
  a secção seguinte; não repetem o anel da Home.
- Listagens, detalhes, artigos e ferramentas: superfícies brancas, bordas finas,
  grelhas funcionais e ações azuis.
- Autenticação: painel branco sobre azul Workbridge, com formulários planos.
- Dashboards: sidebar `#102441`, item ativo lime, ações azuis, canvas `#eef4f8`, cards brancos com borda.
- Estados globais, PWA e notificações: caixas navy planas com sinal sky/lime.

## Regra de segurança de implementação

O tema não pode alterar handlers, campos, IDs, rotas, SSR, autorização, consultas, conteúdo ou valores dinâmicos. Estilos inline só permanecem quando representam dados (por exemplo, percentagem ou posição); cor, raio, sombra e espaçamento pertencem a CSS local ou aos tokens partilhados.
