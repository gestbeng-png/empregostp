# Auditoria de front-end

Atualizado em 2026-07-26.

## Regressão final de 2026-07-26

- A rota `/vagas` passou a usar cartões compactos com empresa, estado, localização,
  salário, contrato, modalidade, categoria, experiência, publicação, prazo e ação
  de candidatura.
- O detalhe de vaga foi validado por navegação real a partir da listagem e mantém
  a candidatura com redirecionamento autenticado para a vaga de origem.
- As superfícies partilhadas dos dashboards Admin, Empresa e Candidato foram
  auditadas nos temas claro e escuro em 320 e 1440 px.
- Foram eliminados overflow horizontal, texto abaixo de 14 px, alvos abaixo de
  44 px e falhas de contraste nos componentes corrigidos.
- A composição da Home foi preservada; apenas os rótulos compactos passaram a
  respeitar o piso tipográfico de acessibilidade.
- A suíte E2E completa terminou com 74 de 74 testes aprovados em Chromium desktop
  e mobile, usando Firebase Auth e Firestore locais.
- TypeScript, ESLint, Jest e o build de produção foram aprovados.

Evidências:

- `data/targeted-after/vagas.json`
- `data/targeted-after/vaga-detalhe.json`
- `data/targeted-after/candidato-perfil-publico.json`
- `data/dashboard-after/{admin,empresa,candidato}-{light,dark}.json`
- `screenshots/targeted-after/vagas-{320,768,1024,1440}.png`
- `screenshots/dashboard-after/{admin,empresa,candidato}-{light,dark}-{320,1440}.png`

## Âmbito

Foram identificadas 68 rotas de interface. A matriz histórica abaixo documenta
o trabalho iniciado em 2026-07-12; a regressão final acima substitui as antigas
exclusões e cobre o sistema partilhado dos três dashboards sem alterar os fluxos
de negócio.

As rotas `/sobre` e `/registo` não existem. As rotas reais são `/sobre-nos` e `/register`.

## Escala de gravidade

- **Alta:** prejudica leitura, acessibilidade, operação por toque ou conclusão de uma tarefa.
- **Média:** cria inconsistência de sistema, hierarquia, interação ou linguagem.
- **Baixa:** refinamento visual sem impacto funcional direto.

## Fila de execução histórica

| Estado    | Rota                                     | Auditoria inicial                                                                          |
| --------- | ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| Concluído | `/candidatos`                            | Corrigida e validada em 320, 768, 1024 e 1440 px.                                          |
| Concluído | `/candidatos/nacional`                   | Base nacional validada visualmente, por métricas e por E2E.                                |
| Concluído | `/candidatos/internacional`              | Conteúdo e variante cromática internacional validados visualmente, por métricas e por E2E. |
| Concluído | `/candidatos/[id]`                       | Perfil real validado; acesso, estado restrito e acessibilidade preservados.                |
| Concluído | `/empresas`                              | Corrigida e validada em 320, 768, 1024 e 1440 px, incluindo E2E desktop e móvel.           |
| Concluído | `/sobre-nos`                             | Semântica, foco, carrossel, formulário e modal validados em desktop e móvel.               |
| Concluído | `/`                                      | Home refinada e validada visualmente, por métricas e por E2E desktop e móvel.              |
| Concluído | `/vagas`                                 | Semântica, filtros, estados e linguagem validados em quatro breakpoints e por E2E.         |
| Concluído | `/vaga/[id]`                             | Vaga publicada real validada visualmente, por métricas e por E2E.                          |
| Concluído | `/blog`                                  | Composição editorial, fallback visual, filtros e newsletter validados.                     |
| Concluído | `/blog/[id]`                             | Artigo real validado; fallback e estrutura editorial corrigidos.                           |
| Concluído | `/carreira`                              | Serviços, cursos, mentoria e ações validados em desktop e mobile.                          |
| Concluído | `/recursos`                              | Catálogo, filtros, FAQ, contactos e acessibilidade validados.                              |
| Concluído | `/recursos/guia/[id]`                    | Tema, conteúdo, estrutura editorial, alvos e linguagem corrigidos e validados.             |
| Concluído | `/recursos/gerador-cv`                   | Responsividade, rótulos, contraste, estados e linguagem corrigidos e validados.            |
| Concluído | `/recursos/calculadora-salarial`         | Interface partilhada, semântica e interação refinadas; acesso premium preservado.          |
| Concluído | `/recursos/calculadora-impostos`         | Interface partilhada, semântica e interação refinadas; acesso premium preservado.          |
| Concluído | `/premium`                               | Estado de encaminhamento acessível adicionado; decisão por tipo de conta preservada.       |
| Concluído | `/premium/candidatos`                    | Redirecionamento para os planos do candidato validado, sem alterar o dashboard.            |
| Concluído | `/premium/empresa`                       | Redirecionamento para os planos da empresa validado.                                       |
| Concluído | `/login`                                 | Tipografia, contraste, alvos, estados e linguagem corrigidos e validados.                  |
| Concluído | `/register`                              | Candidato, empresa, confirmação, grupos, estados e linguagem corrigidos e validados.       |
| Concluído | `/escolha-tipo`                          | Tipografia, comandos, contraste, erro e linguagem corrigidos e validados.                  |
| Concluído | `/verificar-email`                       | Hierarquia, estados, ícones e linguagem corrigidos e validados.                            |
| Concluído | `/recuperar-senha`                       | Formulário, estado enviado, ícones e linguagem corrigidos e validados.                     |
| Concluído | `/redefinir-senha`                       | Validação forte, hierarquia, regras e estados corrigidos e validados.                      |
| Concluído | `/profile`                               | Estado de encaminhamento, destinos e linguagem corrigidos; dashboard candidato intocado.   |
| Concluído | `/termos`                                | Semântica, alvo do link e linguagem corrigidos e validados.                                |
| Concluído | `/cookies`                               | Semântica, alvo do link e consistência visual corrigidos e validados.                      |
| Concluído | `/politica-privacidade`                  | Semântica, tipografia, contacto e linguagem corrigidos e validados.                        |
| Concluído | `/offline`                               | Tema, comandos, cache visual e verdade do texto corrigidos e validados.                    |
| Concluído | `/setup/seed`                            | Flag, guard de administrador, confirmação, interface e logs corrigidos e validados.        |
| Concluído | `/dashboard`                             | Encaminhamento, linguagem e destinos validados por tipo de conta.                          |
| Pendente  | `/dashboard/empresa`                     | Auditoria visual pendente.                                                                 |
| Pendente  | `/dashboard/empresa/profile`             | Auditoria visual pendente.                                                                 |
| Pendente  | `/dashboard/empresa/vagas`               | Auditoria visual pendente.                                                                 |
| Pendente  | `/dashboard/empresa/vaga/criar-vaga`     | Auditoria visual pendente.                                                                 |
| Pendente  | `/dashboard/empresa/vaga/[id]`           | Página dinâmica, auditoria individual pendente.                                            |
| Pendente  | `/dashboard/empresa/candidato/[id]`      | Página dinâmica, auditoria individual pendente.                                            |
| Pendente  | `/dashboard/admin`                       | Auditoria visual pendente.                                                                 |
| Pendente  | `/dashboard/admin/profile`               | Auditoria visual pendente.                                                                 |
| Pendente  | `/dashboard/admin/auditoria`             | Auditoria visual pendente.                                                                 |
| Pendente  | `/dashboard/admin/reports`               | Auditoria visual pendente.                                                                 |
| Pendente  | `/dashboard/admin/users`                 | Auditoria visual pendente.                                                                 |
| Pendente  | `/dashboard/admin/users/[id]`            | Página dinâmica, auditoria individual pendente.                                            |
| Pendente  | `/dashboard/admin/users/[id]/edit`       | Página dinâmica, auditoria individual pendente.                                            |
| Pendente  | `/dashboard/admin/jobs`                  | Auditoria visual pendente.                                                                 |
| Pendente  | `/dashboard/admin/jobs/create`           | Auditoria visual pendente.                                                                 |
| Pendente  | `/dashboard/admin/jobs/[id]`             | Página dinâmica, auditoria individual pendente.                                            |
| Pendente  | `/dashboard/admin/jobs/[id]/edit`        | Página dinâmica, auditoria individual pendente.                                            |
| Pendente  | `/dashboard/admin/news`                  | Auditoria visual pendente.                                                                 |
| Pendente  | `/dashboard/admin/news/[id]`             | Página dinâmica, auditoria individual pendente.                                            |
| Pendente  | `/dashboard/admin/blog`                  | Auditoria visual pendente.                                                                 |
| Pendente  | `/dashboard/admin/blog/[id]`             | Página dinâmica, auditoria individual pendente.                                            |
| Pendente  | `/dashboard/admin/services`              | Auditoria visual pendente.                                                                 |
| Pendente  | `/dashboard/admin/services/[id]`         | Página dinâmica, auditoria individual pendente.                                            |
| Pendente  | `/dashboard/admin/hr-services`           | Auditoria visual pendente.                                                                 |
| Pendente  | `/dashboard/admin/plans`                 | Auditoria visual pendente.                                                                 |
| Pendente  | `/dashboard/admin/payment-settings`      | Auditoria visual pendente.                                                                 |
| Pendente  | `/dashboard/admin/subscription-requests` | Auditoria visual pendente.                                                                 |
| Pendente  | `/dashboard/admin/verificacoes`          | Auditoria visual pendente.                                                                 |
| Pendente  | `/dashboard/admin/testimonials`          | Auditoria visual pendente.                                                                 |
| Pendente  | `/dashboard/admin/affiliates`            | Auditoria visual pendente.                                                                 |
| Pendente  | `/dashboard/admin/resources`             | Auditoria visual pendente.                                                                 |
| Pendente  | `/dashboard/admin/resources/[id]`        | Página dinâmica, auditoria individual pendente.                                            |

## Rotas protegidas

| Estado   | Rota                                | Regra                                 |
| -------- | ----------------------------------- | ------------------------------------- |
| Excluída | `/dashboard/candidato`              | Não alterar visual ou funcionalmente. |
| Excluída | `/dashboard/candidato/candidaturas` | Não alterar visual ou funcionalmente. |
| Excluída | `/dashboard/candidato/vaga`         | Não alterar visual ou funcionalmente. |

## `/candidatos`, baseline

### Evidências

- `screenshots/before/candidatos-320-viewport.png`
- `screenshots/before/candidatos-768-viewport.png`
- `screenshots/before/candidatos-1024.png`
- `screenshots/before/candidatos-1440.png`

### Resultados

- **Alta:** vários textos funcionais e descrições usam entre 8,6 e 13,1 px.
- **Alta:** seletor Nacional/Internacional mede 40 px de altura; links do rodapé medem entre 21 e 24 px.
- **Média:** títulos usam letter spacing negativo e os controlos usam easing genérico em vez do token de movimento.
- **Média:** faltam estados `:active` e uma regra explícita para `prefers-reduced-motion`.
- **Média:** raios de controlos e cards variam entre 13, 15, 24 e 30 px sem uma escala única.
- **Média:** a página recria cores e sombras locais em vez de consumir apenas tokens semânticos globais.
- **Média:** o rodapé usa uma família de ícones diferente da página.
- **Média:** `LOGIN`, `Contato` e `Upload de CV` divergem do glossário em português europeu.
- **Baixa:** o logo do rodapé usa `<img>` e mantém um aviso de otimização do Next.js.
- **Aprovado:** um único `h1`, ordem lógica de headings, `main`, `nav`, `footer`, `lang=pt-PT`, inputs rotulados e ausência de overflow horizontal nos quatro breakpoints.

### Intervenção autorizada

Preservar hero, grelha, planos, serviços, CTA e identidade azul com lima. Corrigir apenas tokens, legibilidade, alvos, estados, semântica, linguagem e consistência do shell público.

## `/candidatos`, conclusão

Estado: **Concluído em 2026-07-12**.

### Correções aplicadas

- Mantida a estrutura original do hero, planos, serviços e CTA.
- Cores, sombras, raios, tipografia e movimento passaram a consumir tokens semânticos do sistema.
- Removido letter spacing negativo; transições normalizadas para 200 ms com `cubic-bezier(0.4, 0, 0.2, 1)`.
- Adicionados estados `:active`, indisponível e redução de movimento sem alterar a navegação existente.
- Definido piso tipográfico real de 14 px, incluindo o breakpoint global que usa raiz de 15 px.
- Alvos interativos ajustados para pelo menos 44 por 44 px.
- Contraste dos preços, resumos e notas dos planos corrigido para WCAG 2.1 AA.
- Cabeçalho e rodapé públicos harmonizados com a família Feather, `next/image` e linguagem em português europeu.
- Uniformizados “Iniciar sessão”, “Contactos” e “Carregar CV” apenas na experiência pública.
- Removidos quatro falsos links sociais com `href="#"`; não existia destino nem funcionalidade associada.

### Evidências finais

- `screenshots/after/candidatos-{320,768,1024,1440}.png`
- `screenshots/after/candidatos-nacional-{320,768,1024,1440}.png`
- `screenshots/after/candidatos-internacional-{320,768,1024,1440}.png`
- `data/after/candidatos.json`
- `data/after/candidatos-nacional.json`
- `data/after/candidatos-internacional.json`

### Verificação

- As três rotas responderam com HTTP 200 nos quatro breakpoints.
- Zero overflow horizontal, textos abaixo de 14 px, alvos abaixo de 44 px, erros de página ou consola.
- Zero violações Axe para WCAG 2.1 A e AA, IDs duplicados ou campos sem rótulo.
- Seis testes Playwright aprovados, cobrindo as três rotas em Chromium desktop e móvel.
- ESLint e TypeScript aprovados nos ficheiros alterados.
- Nenhum ficheiro das rotas protegidas do dashboard do candidato foi alterado nesta intervenção.

## `/candidatos/[id]`, baseline

### Evidências

- `screenshots/before/candidato-perfil-{320,768,1024,1440}.png`
- `data/before/candidato-perfil.json`

### Resultados

- **Alta:** a página cria um segundo `main` dentro do shell público.
- **Alta:** no estado público restrito, a grelha reserva uma coluna vazia e isola o único cartão de ação à direita.
- **Alta:** seis textos ficam abaixo de 14 px em mobile e dois permanecem abaixo do limite em desktop.
- **Alta:** o link de regresso mede apenas 22 a 23 px de altura.
- **Média:** ícones manuais divergem da família Feather usada pelo shell público.
- **Média:** títulos usam letter spacing negativo; ações não têm estados completos nem redução de movimento.
- **Média:** “Soft Skills”, “Website”, “Fazer upgrade” e “Entrar como Empresa” divergem do glossário do produto.
- **Aprovado:** HTTP 200, um `h1`, zero overflow, violações Axe, erros, IDs duplicados e campos sem rótulo nos quatro breakpoints.

### Intervenção autorizada

Preservar regras de acesso, informação exposta, destinos e composição do perfil completo. Corrigir apenas o estado restrito, semântica, legibilidade, ícones, estados e linguagem.

## `/candidatos/[id]`, conclusão

Estado: **Concluído em 2026-07-12**.

### Correções aplicadas

- Mantidas integralmente as regras de acesso e a ocultação de dados profissionais e de contacto.
- Removido o `main` duplicado criado dentro do shell público.
- O estado restrito passou a centrar a ação disponível, sem reservar uma coluna vazia.
- Aplicado piso tipográfico de 14 px e alvo mínimo de 44 px ao link de regresso e às ações.
- Substituídos ícones manuais pela família Feather já usada na experiência pública.
- Removido letter spacing negativo e adicionados foco visível, estados de interação e redução de movimento.
- Uniformizada a linguagem para “Site”, “Competências comportamentais”, “Escolher um plano” e “Iniciar sessão como empresa”.

### Evidências finais

- `screenshots/after/candidato-perfil-{320,768,1024,1440}.png`
- `data/after/candidato-perfil.json`

### Verificação

- Perfil verificado real respondeu com HTTP 200 nos quatro breakpoints.
- Zero overflow horizontal, textos abaixo de 14 px, alvos abaixo de 44 px, erros ou violações Axe.
- Um `h1`, um `main`, zero IDs duplicados e nenhum campo sem rótulo.
- Dois testes Playwright aprovados em Chromium desktop e móvel, incluindo a proteção dos detalhes.
- O fixture E2E do emulador passou a representar explicitamente um candidato verificado para tornar o teste determinístico.

## `/empresas`, baseline

### Evidências

- `screenshots/before/empresas-320.png`
- `screenshots/before/empresas-768.png`
- `screenshots/before/empresas-1024.png`
- `screenshots/before/empresas-1440.png`
- `data/before/empresas.json`

### Resultados

- **Alta:** 54 a 67 textos visíveis abaixo de 14 px, com mínimo de 8,1 px no painel ilustrativo.
- **Alta:** as três descrições da faixa de benefícios falham o contraste mínimo WCAG 2.1 AA.
- **Média:** títulos usam letter spacing negativo e componentes repetidos recriam cores, raios e sombras fora dos tokens globais.
- **Média:** ações usam easing genérico e não têm estado `:active` ou estado indisponível explícito.
- **Média:** linguagem mistura português europeu formal com “tuas”, “badge”, “templates”, “match”, “shortlist” e “analytics”.
- **Média:** cartões de ferramentas usam `h2` ao mesmo nível do título da secção, enfraquecendo a hierarquia semântica.
- **Aprovado:** HTTP 200, um único `h1`, `main`, `nav`, `footer`, ausência de overflow horizontal, alvos inferiores a 44 px, erros de execução, IDs duplicados e campos sem rótulo.

### Intervenção autorizada

Preservar a composição do hero, painel de recrutamento, grelha de ferramentas, processo, planos e CTA. Corrigir apenas legibilidade, contraste, tokens, estados, semântica e linguagem.

## `/empresas`, conclusão

Estado: **Concluído em 2026-07-12**.

### Correções aplicadas

- Preservadas integralmente a composição, grelhas, ordem de conteúdo e navegação.
- Aplicados tokens semânticos globais para cores, superfícies, raios e tipografia.
- Eliminados textos abaixo de 14 px, incluindo todos os detalhes do painel ilustrativo.
- Corrigido o contraste das três descrições da faixa de benefícios.
- Removido letter spacing negativo e normalizado o movimento para 200 ms com easing semântico.
- Adicionados estados `:active`, indisponível e redução de movimento completa.
- Corrigida a hierarquia dos cartões de ferramentas de `h2` para `h3`.
- Uniformizado o português europeu formal e substituídos termos ingleses visíveis por equivalentes claros.
- Ajustado o painel em 768 px para apresentar “Recebidas”, “Seleção” e “Entrevistas” sem truncagem.

### Evidências finais

- `screenshots/after/empresas-{320,768,1024,1440}.png`
- `data/after/empresas.json`

### Verificação

- HTTP 200 nos quatro breakpoints.
- Zero overflow, textos abaixo de 14 px, alvos abaixo de 44 px, erros de página ou consola.
- Zero violações Axe, IDs duplicados ou campos sem rótulo.
- Dois testes Playwright aprovados, cobrindo Chromium desktop e móvel.
- ESLint e TypeScript aprovados.
- Dashboard do candidato permaneceu intocada.

## `/vagas`, baseline

### Evidências

- `screenshots/before/vagas-320.png`
- `screenshots/before/vagas-768.png`
- `screenshots/before/vagas-1024.png`
- `screenshots/before/vagas-1440.png`
- `data/before/vagas.json`

### Resultados

- **Crítica:** o seletor de ordenação não tem nome acessível.
- **Alta:** a página cria um segundo `main` dentro do shell público.
- **Alta:** 178 a 261 textos visíveis abaixo de 14 px em filtros, destaque e cartões.
- **Alta:** 89 controlos ou links têm alvo inferior a 44 px, incluindo filtros, favoritos, títulos, candidatura, ordenação e vista.
- **Alta:** elementos do destaque e dos cartões falham contraste WCAG 2.1 AA.
- **Média:** 19 checkboxes expõem apenas a caixa nativa de 18 px como alvo medido, apesar de estarem dentro de labels.
- **Média:** intervalos salariais usam hífen decorativo e a linguagem mistura “skills” com português.
- **Aprovado:** HTTP 200, um `h1`, estados de loading e vazio, ausência de overflow, erros de execução e IDs duplicados.

### Intervenção autorizada

Preservar destaque, filtros, ordenação, grelha/lista, dados e destinos. Corrigir semântica, labels, tipografia, contraste, alvos, estados, movimento e linguagem.

## `/vagas`, conclusão

Estado: **Concluído em 2026-07-12**.

### Correções aplicadas

- Preservados os dados, filtros, ordenação, vista em grelha ou lista e destinos de candidatura.
- Corrigida a hierarquia para um único `main` e um `h1` estável, mesmo quando não existem vagas em destaque.
- Adicionado nome acessível ao seletor de ordenação e normalizados os estados de foco, hover, toque e indisponibilidade.
- Definido piso tipográfico de 14 px e alvos efetivos de pelo menos 44 por 44 px.
- Corrigidos os contrastes dos contadores, metadados e conteúdo sobre a superfície escura.
- Uniformizada a linguagem: “Tempo integral”, “Meio período”, “compatibilidade” e intervalos escritos com “a”.
- Normalizado o movimento para 200 ms, com suporte para redução de movimento.
- A auditoria passou a medir a `label` associada em checkbox e radio, refletindo corretamente a área clicável real.

### Evidências finais

- `screenshots/after/vagas-{320,768,1024,1440}.png`
- `data/after/vagas.json`

### Verificação

- HTTP 200 nos quatro breakpoints.
- Zero overflow horizontal, textos abaixo de 14 px, alvos abaixo de 44 px, erros de página ou consola.
- Um `h1`, um `main`, zero violações Axe, IDs duplicados ou campos sem rótulo.
- Dois testes Playwright aprovados em Chromium desktop e móvel, cobrindo filtros, vista, alerta e acessibilidade.
- ESLint aprovado nos ficheiros alterados.

## `/vaga/[id]`, baseline

### Evidências

- `screenshots/before/vaga-detalhe-{320,768,1024,1440}.png`
- `data/before/vaga-detalhe.json`

### Resultados

- **Alta:** 22 a 38 textos visíveis ficam abaixo de 14 px, com mínimos de 9,6 px em mobile.
- **Alta:** a barra fixa de candidatura ocupa duas linhas em 320 px e sobrepõe conteúdo de leitura.
- **Alta:** o link “Ver todas as vagas” tem apenas 24 a 25 px de altura; os controlos da barra superior ficam com 42 px em mobile.
- **Média:** intervalos salariais e experiência usam hífen decorativo.
- **Média:** a linguagem mistura “skills”, “liberar”, “upgrade” e formas verbais inconsistentes.
- **Média:** títulos usam letter spacing negativo e várias transições excedem os 250 ms definidos.
- **Aprovado:** HTTP 200, um `h1`, um `main`, zero overflow, violações Axe, erros, IDs duplicados e campos sem rótulo.

### Intervenção autorizada

Preservar conteúdo, candidatura, guarda, partilha, documentos, teste, empresa e vagas relacionadas. Corrigir legibilidade, barra móvel, alvos, movimento e linguagem.

## `/vaga/[id]`, conclusão

Estado: **Concluído em 2026-07-12**.

### Correções aplicadas

- Mantidas todas as ações e secções da vaga, incluindo candidatura, guarda, partilha, documentos e avaliação.
- Definido piso tipográfico de 14 px em metadados, etiquetas, detalhes, empresa e vagas relacionadas.
- A barra móvel foi reduzida a uma única ação em 320 px, diminuindo a obstrução do conteúdo sem retirar o acesso rápido à candidatura.
- Controlos superiores e links contextuais passaram a ter pelo menos 44 por 44 px.
- Removido letter spacing negativo e limitadas as transições a 250 ms, com redução de movimento.
- Uniformizados intervalos com “a”, valores em STD e linguagem como “Competências”, “Escolher um plano” e “A enviar”.
- Eliminada uma competência duplicada criada pela normalização de intervalos de experiência.

### Evidências finais

- `screenshots/after/vaga-detalhe-{320,768,1024,1440}.png`
- `data/after/vaga-detalhe.json`

### Verificação

- Vaga publicada real respondeu com HTTP 200 nos quatro breakpoints.
- Zero overflow horizontal, textos abaixo de 14 px, alvos abaixo de 44 px, erros ou violações Axe.
- Um `h1`, um `main`, zero IDs duplicados e nenhum campo sem rótulo.
- Dois testes Playwright aprovados em Chromium desktop e móvel.
- O emulador E2E passou a incluir uma vaga pública determinística para validar a rota dinâmica em CI.

## `/`, baseline

### Evidências

- `screenshots/before/home-320.png`
- `screenshots/before/home-768.png`
- `screenshots/before/home-1024.png`
- `screenshots/before/home-1440.png`
- `data/before/home.json`

### Resultados

- **Alta:** 62 a 77 textos visíveis abaixo de 14 px, com mínimo inferior a 9 px em badges e metadados.
- **Alta:** cinco links de navegação contextual medem apenas 23 a 28 px de altura.
- **Alta:** metadados de data e leitura em dois artigos falham o contraste WCAG 2.1 AA.
- **Média:** títulos usam letter spacing negativo e transições usam easing genérico.
- **Média:** faltam estados `:active`, indisponível e redução de movimento específica da página.
- **Média:** “BUSCA”, “OPEN”, “TODAS”, “EXPLORAR”, “CANDIDATAR-ME” e o hífen entre salários quebram o glossário humano do site.
- **Média:** a mensagem dinâmica da newsletter usa estilo inline em vez do sistema de classes.
- **Aprovado:** HTTP 200, um `h1`, um `main`, formulários rotulados e ausência de overflow, erros, IDs duplicados e campos sem rótulo.

### Intervenção autorizada

Preservar hero circular, vagas, categorias, métricas, apresentação, processo, candidatos, notícias e CTAs. Corrigir legibilidade, contraste, alvos, tokens, estados e linguagem.

## `/`, conclusão

Estado: **Concluído em 2026-07-12**.

### Correções aplicadas

- Preservada toda a composição da página inicial e os dados dinâmicos existentes.
- Eliminados 62 a 77 textos abaixo de 14 px, incluindo o componente partilhado de vagas.
- Links contextuais passaram a ter alvos mínimos de 44 px.
- Corrigido o contraste dos metadados dos artigos.
- Tokens de cor, sombra, tipografia e movimento normalizados.
- Removido letter spacing negativo e transições limitadas a 240 ms.
- Adicionados estados `:active`, indisponível e redução de movimento.
- Uniformizados “Pesquisar”, “Aberta”, “Ver todas”, “Explorar artigos”, “Criar perfil” e “Criar conta de empresa”.
- Intervalos salariais passaram a usar “a” em vez de hífen decorativo.
- Estado da newsletter deixou de usar estilos inline e passou a classes semânticas.
- Quatro imagens dinâmicas da home e do cartão partilhado passaram a `next/image` sem alterar URLs externas.

### Evidências finais

- `screenshots/after/home-{320,768,1024,1440}.png`
- `data/after/home.json`

### Verificação

- HTTP 200, um `h1` e um `main` nos quatro breakpoints.
- Zero overflow, textos abaixo de 14 px, alvos abaixo de 44 px, erros, violações Axe, IDs duplicados ou campos sem rótulo.
- Dois testes Playwright aprovados em desktop e móvel, cobrindo validação da newsletter e encaminhamento da pesquisa.
- ESLint e TypeScript aprovados.
- Dashboard do candidato permaneceu intocada.

## `/blog`, baseline

### Evidências

- `screenshots/before/blog-{320,768,1024,1440}.png`
- `data/before/blog.json`

### Resultados

- **Alta:** 37 a 44 textos visíveis ficam abaixo de 14 px.
- **Alta:** a página cria um segundo `main` dentro do shell público.
- **Alta:** quatro ações contextuais têm alvo inferior a 44 px.
- **Alta:** a imagem ausente do artigo em destaque produz uma área cinzenta vazia e dominante.
- **Média:** uma regra tardia transforma acidentalmente o destaque de grelha em cartão vertical, contrariando a composição definida no início do módulo.
- **Média:** ícones manuais divergem da família Feather usada no shell público.
- **Média:** títulos usam letter spacing negativo e faltam estados completos de interação e redução de movimento.
- **Média:** o formulário usa “Seu email”, feedback inline e mensagens com tom inconsistente.
- **Aprovado:** HTTP 200, um `h1`, zero overflow, violações Axe, erros, IDs duplicados e campos sem rótulo.

### Intervenção autorizada

Preservar pesquisa, filtros, artigos, notícias, categorias, newsletter e destinos. Corrigir composição, fallback visual, semântica, legibilidade, alvos, ícones, estados e linguagem.

## `/blog`, conclusão

Estado: **Concluído em 2026-07-12**.

### Correções aplicadas

- Preservados pesquisa, categorias, conteúdo editorial, notícias, newsletter e todos os destinos.
- Restaurada a grelha original do artigo em destaque, que estava a ser sobrescrita por uma regra tardia.
- Adicionado fallback editorial local quando a imagem está vazia ou o servidor externo falha.
- Removido o `main` duplicado e substituídos ícones manuais pela família Feather.
- Definido piso tipográfico de 14 px e alvos mínimos de 44 px nas categorias.
- Removido letter spacing negativo; adicionados estados completos e redução de movimento.
- Categorias passaram a expor `aria-pressed`, tornando o estado selecionado explícito.
- Newsletter passou a usar “O seu email”, feedback por classes semânticas e mensagens naturais.

### Evidências finais

- `screenshots/after/blog-{320,768,1024,1440}.png`
- `data/after/blog.json`

### Verificação

- HTTP 200 nos quatro breakpoints.
- Zero overflow horizontal, textos abaixo de 14 px, alvos abaixo de 44 px, erros ou violações Axe.
- Um `h1`, um `main`, zero IDs duplicados e nenhum campo sem rótulo.
- Dois testes Playwright aprovados em Chromium desktop e móvel, cobrindo pesquisa, categorias e newsletter.
- O emulador E2E passou a incluir artigos e notícia publicados para validação determinística em CI.

## `/blog/[id]`, baseline

### Evidências

- `screenshots/before/blog-artigo-{320,768,1024,1440}.png`
- `data/before/blog-artigo.json`

### Resultados

- **Alta:** a página cria um segundo `main` dentro do shell público.
- **Alta:** a imagem editorial externa falha e deixa o hero como uma grande área cinzenta.
- **Alta:** conteúdo editorial em texto simples é injetado como HTML e perde quebras, subtítulos e listas.
- **Alta:** quatro textos ficam abaixo de 14 px e o link de regresso mede apenas 38 px de altura.
- **Média:** a categoria usa estilos inline; título e etiqueta usam letter spacing negativo ou decorativo.
- **Média:** o estado de carregamento usa “Carregando...” e não respeita o glossário em português europeu.
- **Aprovado:** HTTP 200, um `h1`, zero overflow, violações Axe, erros, IDs duplicados e campos sem rótulo.

### Intervenção autorizada

Preservar título, autor, metadados, conteúdo e regresso ao blog. Corrigir hero, fallback, estrutura editorial, semântica, legibilidade, alvo, estados e linguagem.

## `/blog/[id]`, conclusão

Estado: **Concluído em 2026-07-12**.

### Correções aplicadas

- Preservados título, autor, metadados, conteúdo integral e regresso à listagem.
- Adicionado fallback editorial local quando a imagem do artigo está ausente ou falha.
- Conteúdo em texto simples passou a respeitar parágrafos, subtítulos e listas; conteúdo HTML continua suportado.
- Removido o `main` duplicado e substituído o carácter de seta por um ícone Feather.
- Aplicado piso tipográfico de 14 px e alvo de 44 px ao link de regresso.
- Removidos estilos inline da categoria e letter spacing negativo.
- Corrigida a posição do fallback em mobile para não interferir com o título.
- Estado de carregamento uniformizado para “A carregar”.

### Evidências finais

- `screenshots/after/blog-artigo-{320,768,1024,1440}.png`
- `data/after/blog-artigo.json`

### Verificação

- Artigo publicado real respondeu com HTTP 200 nos quatro breakpoints.
- Zero overflow horizontal, textos abaixo de 14 px, alvos abaixo de 44 px, erros ou violações Axe.
- Um `h1`, um `main`, zero IDs duplicados e nenhum campo sem rótulo.
- Dois testes Playwright aprovados em Chromium desktop e móvel, incluindo a estruturação de texto simples.
- O artigo fixture do emulador passou a incluir conteúdo estruturável para validar a rota em CI.

## `/carreira`, baseline

### Evidências

- `screenshots/before/carreira-{320,768,1024,1440}.png`
- `data/before/carreira.json`

### Resultados

- **Alta:** 68 textos visíveis ficam abaixo de 14 px em todos os breakpoints.
- **Alta:** dois botões de serviço falham contraste WCAG 2.1 AA.
- **Alta:** a página cria um segundo `main` dentro do shell público.
- **Alta:** botões de serviços, cursos e consulta não executam qualquer ação apesar da promessa visual.
- **Média:** ícones manuais divergem da família Feather usada no shell público.
- **Média:** títulos usam letter spacing negativo e faltam estados de interação e redução de movimento.
- **Média:** a linguagem mistura português com “roadmap”, “networking”, “personal branding”, “boards”, “shortlist”, “rating” e cargos ingleses.
- **Aprovado:** HTTP 200, um `h1`, zero overflow, erros, IDs duplicados, campos sem rótulo e alvos abaixo de 44 px.

### Intervenção autorizada

Preservar hero, serviços, cursos, mentores, testemunhos e CTA. Corrigir legibilidade, contraste, semântica, ações sem destino, ícones, estados e linguagem.

## `/carreira`, conclusão

Estado: **Concluído em 2026-07-12**.

### Correções aplicadas

- Preservadas a composição, grelhas, preços, serviços, cursos, mentores e testemunhos.
- Eliminados os 68 textos abaixo de 14 px e corrigido o contraste dos botões verde e azul claro.
- Removido o `main` duplicado e substituídos ícones manuais por ícones Feather existentes.
- Ações antes inertes passaram a encaminhar para contacto ou recursos com rótulos verdadeiros.
- Cores dinâmicas inline foram substituídas por quatro tons semânticos no módulo CSS.
- Removido letter spacing negativo; adicionados hover, foco, active e redução de movimento.
- Uniformizada a linguagem e removidos anglicismos desnecessários em serviços, cargos e métricas.

### Evidências finais

- `screenshots/after/carreira-{320,768,1024,1440}.png`
- `data/after/carreira.json`

### Verificação

- HTTP 200 nos quatro breakpoints.
- Zero overflow horizontal, textos abaixo de 14 px, alvos abaixo de 44 px, erros ou violações Axe.
- Um `h1`, um `main`, zero IDs duplicados e nenhum campo sem rótulo.
- Dois testes Playwright aprovados em Chromium desktop e móvel, incluindo os destinos das ações.
- ESLint aprovado.

## `/recursos`, baseline

### Evidências

- `screenshots/before/recursos-{320,768,1024,1440}.png`
- `data/before/recursos.json`

### Resultados

- **Alta:** uma chave React duplicada (`carta-motivacao`) pode duplicar ou omitir cartões.
- **Alta:** 98 textos ficam abaixo de 14 px em todos os breakpoints.
- **Alta:** 25 filtros, descargas, ferramentas e links têm alvo inferior a 44 px.
- **Alta:** metadados dos quatro guias falham contraste WCAG 2.1 AA.
- **Alta:** perguntas do FAQ são `div` clicáveis, sem teclado, `aria-expanded` ou associação à resposta.
- **Média:** ícones manuais divergem da família Feather e cores dinâmicas são aplicadas inline.
- **Média:** textos visíveis têm acentos em falta, português brasileiro e termos ingleses desnecessários.
- **Média:** contactos divergem dos dados oficiais apresentados no rodapé.
- **Aprovado:** HTTP 200, um `h1`, um `main`, zero overflow, IDs duplicados e campos sem rótulo.

### Intervenção autorizada

Preservar catálogo, filtros, pesquisa, downloads, guias, ferramentas, FAQ, links e acesso premium. Corrigir chaves, legibilidade, contraste, alvos, semântica, ícones, estados, contactos e linguagem.

## `/recursos`, conclusão

Estado: **Concluído em 2026-07-12**.

### Correções aplicadas

- Preservados o catálogo, os destinos, a lógica premium, a pesquisa e todos os filtros.
- Chaves de cartões passaram a incluir índice estável, eliminando a colisão em dados legados.
- Eliminados 98 textos abaixo de 14 px e 25 alvos inferiores a 44 px.
- Corrigido o contraste dos metadados dos guias.
- FAQ convertido para botões semânticos com teclado, `aria-expanded`, `aria-controls` e regiões nomeadas.
- Substituídos ícones manuais por Feather e removidos estilos inline de cores e dimensões.
- Filtros passaram a expor `aria-pressed` e todos os controlos receberam estados consistentes.
- Contactos convertidos em links reais e alinhados com `suporte@empregos.st` e `+239 986 9673`.
- Uniformizada a linguagem em português europeu, incluindo “Descarregar”, “Modelos e documentos” e acentuação.

### Evidências finais

- `screenshots/after/recursos-{320,768,1024,1440}.png`
- `data/after/recursos.json`

### Verificação

- HTTP 200 nos quatro breakpoints.
- Zero overflow horizontal, textos abaixo de 14 px, alvos abaixo de 44 px, erros ou violações Axe.
- Um `h1`, um `main`, zero IDs duplicados e nenhum campo sem rótulo.
- Dois testes Playwright aprovados em Chromium desktop e móvel, cobrindo filtros, pesquisa, FAQ e contactos.
- ESLint aprovado.

## `/recursos/guia/[id]`, baseline

### Evidências

- `screenshots/before/recurso-guia-{320,768,1024,1440}.png`
- `data/before/recurso-guia.json`

### Resultados

- **Crítica:** a área de leitura aplica um tema preto isolado que entra em conflito com o shell público claro e deixa o título sem contraste suficiente.
- **Alta:** um rascunho curto guardado na base de dados substitui o guia completo já incluído no catálogo, apresentando apenas uma frase ao utilizador.
- **Alta:** três a quatro textos ficam abaixo de 14 px e o link de regresso mede apenas 16 a 17 px de altura.
- **Alta:** o título falha o contraste WCAG 2.1 AA em todos os breakpoints.
- **Média:** todo o layout usa estilos inline, cores fora dos tokens e uma composição que deixa uma extensa área preta depois do conteúdo.
- **Média:** o guia é apresentado num elemento `pre`, sem subtítulos, listas ou estrutura de leitura semântica.
- **Média:** a linguagem usa uma seta feita com caracteres, “Baixar”, “paginas” e mensagens sem acentuação.
- **Aprovado:** HTTP 200, um `h1`, um `main`, zero overflow, erros, IDs duplicados ou campos sem rótulo.

### Intervenção autorizada

Preservar a rota, os dados do Firestore, o anexo, o catálogo de fallback e o regresso aos recursos. Corrigir tema, contraste, conteúdo incompleto, estrutura editorial, tokens, alvos, estados e linguagem.

## `/recursos/guia/[id]`, conclusão

Estado: **Concluído em 2026-07-12**.

### Correções aplicadas

- Preservados a rota dinâmica, o documento do Firestore, o anexo e o regresso ao catálogo.
- Substituído o tema preto isolado pelo shell público e pelos tokens semânticos já validados.
- O conteúdo passou a ser apresentado como subtítulos, listas ordenadas, listas simples e parágrafos, sem injeção de HTML.
- Um rascunho com menos de 80 caracteres deixa de ocultar o guia completo incluído no catálogo.
- Adicionado estado vazio claro quando não existe conteúdo na base de dados nem no catálogo.
- Aplicados piso tipográfico de 14 px, alvo mínimo de 44 px, foco visível, hover, active e redução de movimento.
- Substituída a seta feita com caracteres por Feather e uniformizada a linguagem para “Voltar aos recursos”, “Descarregar anexo” e “páginas”.
- Cópias legadas conhecidas são normalizadas na apresentação sem alterar documentos de produção nem conteúdo personalizado.
- Adicionados fixture determinístico e teste E2E para a rota dinâmica.

### Evidências finais

- `data/after/recurso-guia.json`

### Verificação

- HTTP 200 e conteúdo completo verificados no navegador ativo.
- Zero overflow horizontal, textos abaixo de 14 px, alvos abaixo de 44 px, IDs duplicados ou campos sem rótulo nos quatro breakpoints.
- Um `h1`, um `main`, um `nav` e um `footer`; contraste do conteúdo principal sem falhas.
- ESLint aprovado nos ficheiros alterados.
- O teste Playwright foi criado, mas a execução local ficou bloqueada pelo sandbox do macOS antes da abertura da página; não houve falha da aplicação.

## `/recursos/gerador-cv`, baseline

### Evidências

- `data/before/gerador-cv.json`

### Resultados

- **Crítica:** em 320 px, o painel lateral do hero mantém uma largura mínima dentro de uma linha flexível e cria 223 px de overflow horizontal.
- **Alta:** os componentes de texto e área de texto do fluxo autenticado apresentam um rótulo visual em `span`, sem associação semântica ao campo.
- **Alta:** o botão principal usa texto branco sobre um gradiente que termina num azul claro sem contraste suficiente.
- **Alta:** o link de regresso mede apenas 23 a 24 px de altura.
- **Média:** um a quatro textos ficam abaixo de 14 px, incluindo a etiqueta do hero e benefícios do acesso premium.
- **Média:** o progresso das etapas depende de estilo inline e não expõe o valor através de um elemento semântico.
- **Média:** título e pré visualização usam letter spacing negativo e as transições não seguem o easing do sistema.
- **Média:** a linguagem mistura “CV Builder”, “upgrade”, “dashboard”, “stack” e mensagens sem acentuação.
- **Aprovado:** HTTP 200, um `h1`, um `main`, zero erros de execução e fluxo de acesso premium funcional.

### Intervenção autorizada

Preservar autenticação, controlo de plano, pré preenchimento, seis etapas, pré visualização e exportação PDF. Corrigir responsividade, semântica de formulário, contraste, tipografia, alvos, movimento e linguagem.

## `/recursos/gerador-cv`, conclusão

Estado: **Concluído em 2026-07-12**.

### Correções aplicadas

- Preservadas integralmente a validação do plano, a hidratação do perfil, as seis etapas e a geração do PDF.
- O hero passa a empilhar corretamente em tablet e mobile, eliminando os 223 px de overflow em 320 px.
- Campos de texto e áreas de texto passaram a usar `label` associado por envolvimento, sem alterar o estado React.
- O progresso inline foi substituído por um elemento `progress` com valor e nome acessível.
- O botão principal passou ao azul sólido do sistema, garantindo contraste para texto branco.
- Aplicados piso tipográfico de 14 px, alvos mínimos de 44 px, foco visível, active, disabled e redução de movimento.
- Removidos letter spacing negativo e transições normalizadas para 200 ms com easing semântico.
- Estados de carregamento, erro, foto e exportação passaram a anunciar atualizações por `status` ou `alert`.
- Uniformizada a linguagem para “Currículo profissional”, “Iniciar sessão”, “Ver planos”, “painel do candidato” e “ferramentas utilizadas”.
- Adicionado teste E2E para o estado público e o encaminhamento para sessão ou planos.

### Evidências finais

- `data/after/gerador-cv.json`

### Verificação

- HTTP 200 nos quatro breakpoints através do navegador ativo.
- Zero overflow, textos abaixo de 14 px, alvos abaixo de 44 px, IDs duplicados ou campos sem rótulo.
- Um `h1`, um `main`, um `nav` e um `footer`; contraste do conteúdo principal corrigido.
- ESLint aprovado sem erros; permanecem apenas dois avisos históricos para imagens `data:` da fotografia do CV.
- O teste Playwright foi criado; o runner local continua bloqueado pelo sandbox antes da navegação.

## `/recursos/calculadora-salarial`, baseline

### Resultados

- **Alta:** toda a ferramenta usa um tema preto isolado e diverge do centro público de recursos.
- **Alta:** estilos de layout, cores, tipografia e estados estão definidos inline, impedindo foco, hover e redução de movimento consistentes.
- **Alta:** fonte, rótulos, resultados e nota usam tamanhos entre 12,5 e 13,6 px.
- **Alta:** o link de regresso e os botões de modo não garantem alvos de 44 px.
- **Média:** resultados são apresentados em elementos genéricos e não anunciam alterações ao utilizador.
- **Média:** textos visíveis têm acentos em falta e usam abreviações pouco claras.
- **Aprovado:** cálculo, consulta de vagas, fallback de mercado e proteção do plano profissional estão implementados.

### Intervenção autorizada

Preservar fórmulas, fatores, dados do Firestore, fontes externas e controlo premium. Corrigir composição, tokens, semântica, alvos, estados, responsividade e linguagem.

## `/recursos/calculadora-salarial`, conclusão

Estado: **Concluído em 2026-07-12**.

### Correções aplicadas

- Mantidas todas as fórmulas, fontes de mercado, fatores e regras de acesso.
- Aplicado o shell público e um módulo CSS partilhado, sem estilos inline.
- Modos candidato e empresa passaram a um controlo segmentado com `aria-pressed` e ícones Feather.
- Campos usam labels envolventes, piso de 14 px, altura de 48 px e estados completos.
- Resultados passaram a elementos `output`, com atualização anunciada e unidades explícitas.
- Fonte de referência convertida numa faixa informativa com ligação externa acessível.
- Linguagem normalizada, incluindo “Área profissional”, “Júnior”, “Sénior”, “Liderança”, “Híbrido” e “orçamento mensal”.

### Verificação

- Redirecionamento anónimo para `/login` confirmado no navegador, preservando a proteção premium.
- Teste unitário aprovado para rótulos, alternância de perspetiva e atualização do cálculo.
- ESLint aprovado.
- A captura do estado autenticado requer uma conta com plano Profissional ou Premium e permanece como risco visual residual.

## `/recursos/calculadora-impostos`, baseline

### Resultados

- **Alta:** repete o tema preto e todos os estilos inline da calculadora salarial.
- **Alta:** fonte, rótulos, resultados e nota ficam abaixo de 14 px.
- **Alta:** controlos não têm estados globais de foco visível, hover, active ou redução de movimento.
- **Média:** resultados dinâmicos usam elementos genéricos sem nome ou anúncio acessível.
- **Média:** textos têm acentos em falta e usam símbolos como separadores de frase.
- **Aprovado:** IRS, segurança social, vínculo independente, período anual e proteção premium estão implementados.

### Intervenção autorizada

Preservar fórmulas fiscais, tabelas, perfis de INSS, fontes e controlo premium. Corrigir composição, tokens, semântica, alvos, estados, responsividade e linguagem.

## `/recursos/calculadora-impostos`, conclusão

Estado: **Concluído em 2026-07-12**.

### Correções aplicadas

- Preservadas todas as fórmulas de IRS, segurança social, salário líquido e custo da entidade empregadora.
- Aplicado o mesmo módulo visual claro da calculadora salarial, com variante âmbar e sem estilos inline.
- Fontes fiscais organizadas numa faixa própria, com ligações externas de 44 px.
- Campos e resultados ganharam semântica explícita, atualização anunciada e unidades legíveis.
- A contribuição manual mantém-se condicional ao vínculo independente.
- Aplicados piso tipográfico, alvos, foco, hover, active, disabled e redução de movimento.
- Linguagem e acentuação revistas em títulos, campos, resultados, fontes e nota legal.

### Verificação

- Redirecionamento anónimo para `/login` confirmado no navegador, preservando a proteção premium.
- Teste unitário aprovado para atualização do salário líquido e contribuição independente.
- ESLint aprovado.
- Smoke test Playwright criado para os dois redirecionamentos; o runner local permanece bloqueado pelo sandbox.
- A captura do estado autenticado requer uma conta com plano Profissional ou Premium e permanece como risco visual residual.

## `/premium`, baseline

### Resultados

- **Alta:** a rota devolve `null` durante a leitura da autenticação e do perfil, produzindo um ecrã branco sem contexto ou estado de carregamento.
- **Média:** usa uma segunda subscrição direta ao Firebase Auth em vez do contexto de autenticação já montado na aplicação.
- **Média:** falhas de perfil redirecionam corretamente, mas não existe feedback semântico durante a espera.
- **Aprovado:** a decisão entre candidato, empresa e sessão inválida está implementada.

### Intervenção autorizada

Preservar a decisão por tipo de conta e todos os destinos. Adicionar estado visível, reutilizar o contexto de autenticação e tornar a espera acessível.

## `/premium`, conclusão

Estado: **Concluído em 2026-07-12**.

### Correções aplicadas

- O ecrã branco foi substituído por um estado de encaminhamento com logo, título, descrição e indicador de progresso.
- A rota passou a usar `useAuth`, evitando uma subscrição Firebase paralela.
- A consulta do perfil mantém o token e os destinos anteriores, agora com cancelamento por `AbortController` ao desmontar.
- O estado partilhado usa `role="status"`, `aria-live` e `aria-busy`.
- Removidas decorações em forma de orbes, letter spacing decorativo e texto abaixo de 14 px do componente partilhado.
- Linguagem normalizada para “A abrir os seus planos” e “Só um instante”.

### Verificação

- Quatro testes unitários aprovados para loading, sessão anónima, candidato autenticado e destinos por tipo de conta.
- ESLint aprovado.

## `/premium/candidatos` e `/premium/empresa`, conclusão

Estado: **Concluído em 2026-07-12**.

### Verificação

- Mantidos redirecionamentos de servidor, sem ecrã intermédio desnecessário.
- `/premium/candidatos` continua a apontar para `/dashboard/candidato?tab=plans`.
- `/premium/empresa` continua a apontar para `/dashboard/empresa?tab=plans`.
- Destinos validados em teste unitário e smoke test Playwright.
- Nenhum ficheiro ou comportamento da dashboard do candidato foi alterado.

## `/login`, baseline

### Evidências

- `data/before/login.json`

### Resultados

- **Alta:** dois links contextuais medem apenas 18 a 22 px de altura.
- **Alta:** três a cinco textos ficam abaixo de 14 px, incluindo labels, recuperação e separador.
- **Alta:** o botão principal termina num azul claro e não garante contraste suficiente para texto branco.
- **Alta:** o separador “Ou” falha o contraste mínimo.
- **Média:** a linguagem mistura “Login”, “Entrar”, “popup”, “usuário”, “cadastro” e formas do português brasileiro.
- **Média:** o shell usa orbes decorativos, raios de 30 a 34 px e não oferece redução de movimento local.
- **Aprovado:** um `h1`, um `main`, formulários rotulados, fluxo Google, recuperação, confirmação e erros anunciados.

### Intervenção autorizada

Preservar autenticação Firebase, cookies, redirecionamentos, Google e reenvio de confirmação. Corrigir tokens, contraste, alvos, movimento, ícones e linguagem.

## `/login`, conclusão

Estado: **Concluído em 2026-07-12**.

### Correções aplicadas

- Preservados todos os fluxos de autenticação, token, perfil, reenvio e destinos.
- Eliminados textos abaixo de 14 px e links abaixo de 44 px.
- Botão principal passou ao azul sólido do sistema e o separador ganhou contraste adequado.
- Removidos orbes decorativos e normalizados raios, foco, active, disabled, movimento e redução de movimento no shell partilhado.
- Ícones de feedback passaram à família Feather, mantendo os anúncios `status` e `alert`.
- Glossário uniformizado para “Iniciar sessão”, “Email”, “Recuperar senha”, “Utilizador” e “Criar conta”.
- Mensagens de erro foram revistas para um tom natural em português europeu.

### Evidências finais

- `data/after/login.json`

### Verificação

- HTTP 200 nos quatro breakpoints.
- Zero overflow, textos abaixo de 14 px, alvos abaixo de 44 px, campos sem rótulo ou falhas de contraste no conteúdo principal.
- Um `h1`, um `main` e validação vazia confirmada no navegador ativo.
- Teste E2E existente atualizado para o novo glossário; execução local do runner continua limitada pelo sandbox.
- ESLint aprovado.

## `/register`, baseline

### Resultados

- **Alta:** a página não tem `h1`; o título principal é um `h2`.
- **Alta:** “Tipo de conta” é um texto solto antes dos rádios, sem `fieldset` ou `legend`.
- **Média:** regras de senha usam texto abaixo de 14 px e caracteres manuais para estados cumpridos ou pendentes.
- **Média:** confirmação e erros usam emojis em vez da família de ícones do sistema.
- **Média:** linguagem mistura “Criar Conta”, “Registro”, “popup”, “caractere”, “Faça Login” e formas brasileiras.
- **Aprovado:** criação Firebase, Google, candidato, empresa, campos condicionais, validação forte, confirmação e reenvio estão implementados.

### Intervenção autorizada

Preservar criação Firebase, payloads, validação, tipos de conta, campos empresariais, Google e confirmação. Corrigir hierarquia, grupos, ícones, alvos, estados e linguagem.

## `/register`, conclusão

Estado: **Concluído em 2026-07-12**.

### Correções aplicadas

- Título principal e estado de confirmação passaram a `h1`.
- Tipo de conta convertido para `fieldset` e `legend`, preservando rádios e estado React.
- Regras de senha e feedback passaram a ícones Feather.
- Variantes de candidato e empresa mantêm todos os campos associados aos respetivos labels.
- Mensagem vazia da empresa passou a indicar especificamente o nome da empresa.
- Uniformizada a linguagem para “Criar conta”, “Email”, “Iniciar sessão”, “Setor de atividade” e verbos naturais.
- Cópias de erro, Google, carregamento e confirmação revistas em português europeu.
- Beneficia das correções partilhadas de tipografia, contraste, alvos, foco e redução de movimento do shell de autenticação.

### Evidências finais

- `data/after/register.json`

### Verificação

- Candidato, regras de senha e empresa verificados no navegador ativo.
- Zero overflow, textos abaixo de 14 px, alvos abaixo de 44 px ou campos sem rótulo nos quatro breakpoints.
- Um `h1`, um `main` e um grupo de tipo de conta nomeado.
- Teste E2E criado para alternância, campos de empresa, validação, métricas e Axe.
- ESLint aprovado.

## `/escolha-tipo`, baseline

### Resultados

- **Alta:** etiquetas de candidato e empregador ficam entre 11 e 11,8 px.
- **Alta:** o fluxo Google apresenta falhas através de `alert()`, bloqueando a interface e sem região persistente de erro.
- **Alta:** o botão de candidato termina num azul claro sem contraste garantido para texto branco.
- **Média:** comandos estão integralmente em maiúsculas e a linguagem mistura “conectada”, “Onboarding”, “inscrever se” e formas brasileiras.
- **Média:** cartões e imagens internas usam raios de 20 a 26 px e letter spacing decorativo.
- **Aprovado:** um `h1`, um `main`, duas imagens relevantes, dois destinos e fluxo Google implementados.

### Intervenção autorizada

Preservar imagens, duas opções, configuração Google, payloads e destinos. Corrigir erro, contraste, tipografia, raios, comandos e linguagem.

## `/escolha-tipo`, conclusão

Estado: **Concluído em 2026-07-12**.

### Correções aplicadas

- Preservadas as opções e os destinos de candidato e empresa.
- Erro bloqueante substituído por mensagem inline com `role="alert"`.
- Etiquetas passaram ao piso de 14 px, sem maiúsculas forçadas ou letter spacing.
- Botões usam azul primário e verde escuro sólidos, com contraste adequado e estados completos.
- Raios alinhados à escala do design system.
- Textos revistos para “Conta ligada”, “Configuração”, “Conta de candidato”, “Conta de empresa” e comandos explícitos.
- Estado Google passou a `role="status"` sem introduzir headings fora de ordem.

### Evidências finais

- `data/after/escolha-tipo.json`

### Verificação

- Zero overflow, textos abaixo de 14 px ou alvos abaixo de 44 px nos quatro breakpoints.
- Um `h1`, um `main` e destinos de candidato e empresa confirmados no navegador.
- Teste E2E criado para conteúdo, destinos, métricas e Axe.
- ESLint aprovado.

## `/verificar-email`, baseline e conclusão

Estado: **Concluído em 2026-07-12**.

### Resultados iniciais

- **Alta:** os três estados usam `h2` e a rota não apresenta qualquer `h1`.
- **Média:** relógio, sucesso e erro são emojis, divergindo da família de ícones.
- **Média:** estados não têm regiões próprias de `status` ou `alert` e a linguagem usa “login”.

### Correções aplicadas

- Estados a confirmar, confirmado e inválido passaram a `h1` e ícones Feather.
- Espera e sucesso usam `role="status"`; link inválido usa `role="alert"`.
- Cópia uniformizada para “Iniciar sessão” e frases sem pontuação decorativa.
- Link inválido sem código foi validado em 320 px com um `h1`, um `main`, zero overflow, texto pequeno ou alvo curto.

## `/recuperar-senha`, baseline e conclusão

Estado: **Concluído em 2026-07-12**.

### Resultados iniciais

- **Alta:** formulário e estado enviado usam `h2`, sem `h1`.
- **Média:** estado enviado e erros usam emojis; linguagem mistura “e-mail”, “Digite” e “Faça Login”.

### Correções aplicadas

- Formulário e estado enviado passaram a `h1`, com ícones Feather e região `status`.
- Labels, placeholders, erros, carregamento e regresso foram revistos para português europeu.
- Validação vazia confirmada no navegador com zero overflow, texto pequeno, alvo curto ou campo sem rótulo.
- Teste unitário aprovado para envio, normalização do email e estado de privacidade.

## `/redefinir-senha`, baseline e conclusão

Estado: **Concluído em 2026-07-12**.

### Resultados iniciais

- **Crítica:** a rota aceita apenas 6 caracteres, contrariando as regras fortes de 8 caracteres usadas no registo e documentadas no validador partilhado.
- **Alta:** todos os estados usam `h2`, sem `h1`.
- **Média:** estados usam emojis e não anunciam espera, erro ou conclusão de forma consistente.

### Correções aplicadas

- Redefinição passou a usar `isStrongPassword`, a mesma regra partilhada do registo e da API.
- Adicionada lista dinâmica de cinco requisitos com ícones Feather.
- Estados a validar, inválido, concluído e formulário passaram a `h1`, `status` ou `alert` conforme o caso.
- Mensagens e comandos uniformizados para “Senha alterada”, “Iniciar sessão” e carregamento natural.
- Três testes unitários aprovados para senha fraca, senha forte e conclusão Firebase simulada.
- E2E criado para os três estados públicos de recuperação, incluindo métricas e Axe.

## `/termos`, `/cookies` e `/politica-privacidade`, baseline

### Resultados

- **Alta:** as três rotas criam um segundo `main` dentro do `PublicPageShell`.
- **Alta:** links contextuais medem apenas 24 px de altura.
- **Alta:** etiqueta e data da política ficam abaixo de 14 px.
- **Média:** a política usa marcadores decorativos em gradiente e raios entre 20 e 28 px.
- **Média:** linguagem mistura “Termos de Uso”, “você”, “conectar”, “oferecidos” e possessivos brasileiros.
- **Média:** o contacto da política é texto simples e diverge do email oficial no rodapé.
- **Aprovado:** todas as rotas têm `h1`, conteúdo legível e destinos internos válidos.

### Intervenção autorizada

Preservar o sentido das cláusulas, secções, data e destinos. Corrigir landmarks, alvos, tipografia, marcadores, raios, contacto e linguagem sem introduzir novas promessas jurídicas.

## Páginas legais, conclusão

Estado: **Concluído em 2026-07-12**.

### Correções aplicadas

- Removidos os três `main` aninhados; cada rota usa apenas o landmark do shell público.
- Links passaram a alvos de 44 px, com foco, hover e active consistentes.
- Etiqueta e data passaram ao piso de 14 px, sem maiúsculas ou letter spacing decorativo.
- Raios alinhados ao design system e marcadores vazios removidos.
- Termos e política revistos para português europeu sem alterar o sentido das cláusulas.
- Contacto alinhado com `suporte@empregos.st` e convertido em `mailto:`.

### Verificação

- `/termos`, `/cookies` e `/politica-privacidade` validados em 320 e 1440 px.
- Um `h1`, um `main`, zero overflow, texto abaixo de 14 px ou alvo abaixo de 44 px em cada rota.
- Quatro testes E2E criados para estrutura, contacto, métricas e Axe.
- ESLint aprovado.

## `/offline`, baseline e conclusão

Estado: **Concluído em 2026-07-12**.

### Resultados iniciais

- **Alta:** toda a página usa estilos inline e um tema preto isolado.
- **Alta:** etiqueta “Offline” fica abaixo de 14 px e usa letter spacing decorativo.
- **Alta:** o texto promete acesso offline a mensagens e painel, comportamento que o service worker não garante.
- **Média:** ações não têm foco, active, redução de movimento ou ícones consistentes.

### Correções aplicadas

- Interface convertida para módulo CSS claro, baseada nos tokens globais.
- Adicionado logo local já incluído no `APP_SHELL` do service worker, servido sem otimizador remoto.
- Texto passou a descrever apenas a retoma depois de a rede voltar.
- Ações receberam ícones Feather, alvos de 48 px e estados completos.
- Validada em quatro breakpoints com um `h1`, um `main` e zero overflow, texto pequeno ou alvo curto.
- Teste E2E criado para conteúdo, recuperação, regresso, métricas e Axe.

## `/profile`, baseline e conclusão

Estado: **Concluído em 2026-07-12**.

### Resultados iniciais

- **Média:** a rota usava `push` num encaminhamento automático, deixando uma página transitória no histórico do navegador.
- **Média:** o texto misturava formas brasileiras e não explicava de modo natural que o destino depende do tipo de conta.
- **Aprovado:** os destinos de candidato, empresa e administrador já correspondiam aos painéis existentes.

### Correções aplicadas

- Encaminhamento convertido para `replace`, evitando que a ação de voltar reabra o estado transitório.
- Título e descrição revistos em português europeu.
- Destinos e consulta do perfil preservados; nenhum ficheiro do dashboard do candidato foi alterado.

## `/setup/seed`, baseline e conclusão

Estado: **Concluído em 2026-07-12**.

### Resultados iniciais

- **Crítica:** quando a variável de desenvolvimento estava ativa, qualquer utilizador autenticado podia executar a criação de dados.
- **Alta:** a operação destrutiva ou repetível não exigia confirmação explícita e algumas coleções criam novos documentos a cada execução.
- **Média:** a página dependia de autenticação Google no cliente, usava estilos inline num tema isolado e apresentava comandos e logs em inglês.
- **Aprovado:** a flag de ambiente já permitia ocultar a rota fora de ambientes autorizados.

### Correções aplicadas

- A rota responde com 404 enquanto `ENABLE_DEV_SEED_PAGE` não for exatamente `true`.
- Adicionada proteção no servidor que exige uma sessão de administrador antes de renderizar a interface.
- Removido o início de sessão Google local e adicionada confirmação consciente antes da execução.
- Interface convertida para módulo CSS alinhado com o painel administrativo, com headings, estados e logs acessíveis em português.

### Verificação

- Três testes unitários aprovados para flag inativa, sessão sem privilégios e administrador autorizado.
- A rota respondeu com 404 no ambiente atual.
- ESLint aprovado; foi criado um smoke test E2E para confirmar que a rota nunca fica publicamente exposta.

## `/dashboard`, baseline e conclusão

Estado: **Concluído em 2026-07-12**.

### Resultados iniciais

- **Média:** os encaminhamentos automáticos usavam `push`, mantendo a rota intermédia no histórico.
- **Média:** título e descrição usavam formas brasileiras e reticências decorativas.
- **Aprovado:** os três tipos de conta e os estados de perfil ausente ou inválido tinham destinos definidos.

### Correções aplicadas

- Todos os encaminhamentos passaram a `replace`, sem alterar os destinos existentes.
- Estado visual partilhado preservado e texto uniformizado para “A abrir o seu painel”.
- Mensagens internas revistas para “utilizador”, mantendo o fallback seguro para a página inicial.

### Verificação

- Teste unitário cobre carregamento, sessão anónima, empresa, candidato, administrador e tipo desconhecido.
- A dashboard do candidato e as suas subrotas permaneceram intocadas nesta intervenção.

## `/sobre-nos`, baseline

### Evidências

- `screenshots/before/sobre-nos-320.png`
- `screenshots/before/sobre-nos-768.png`
- `screenshots/before/sobre-nos-1024.png`
- `screenshots/before/sobre-nos-1440.png`
- `data/before/sobre-nos.json`

### Resultados

- **Alta:** a página não tem `h1` e cria um segundo elemento `main` dentro do shell público.
- **Alta:** `aria-label` é aplicado a `span` sem role semântico nas classificações dos testemunhos.
- **Alta:** cinco indicadores do carrossel medem 9 px e cinco botões de avaliação medem 40 px.
- **Alta:** 18 a 25 textos visíveis ficam abaixo de 14 px, incluindo labels de formulário.
- **Média:** transições variam entre 150 e 550 ms, com vários easings não semânticos e sem redução de movimento local.
- **Média:** headings e rótulos usam letter spacing negativo ou decorativo.
- **Média:** o modal de candidatura abre sem gestão explícita de foco.
- **Aprovado:** HTTP 200, fotografias reais da equipa, formulários com labels, ausência de overflow, erros de execução e IDs duplicados.

### Intervenção autorizada

Preservar conteúdo, fotografias, secções, carrossel, formulário e identidade visual. Corrigir semântica, foco, legibilidade, alvos, movimento, tokens e estados.

## `/sobre-nos`, conclusão

Estado: **Concluído em 2026-07-12**.

### Correções aplicadas

- Removido o `main` duplicado e promovido o título inicial a único `h1`.
- Corrigida a classificação dos testemunhos com role semântico e ARIA permitida.
- Indicadores do carrossel mantêm aparência compacta dentro de alvos estáveis de 44 px.
- Botões de avaliação passaram a 44 px e organizam-se em três mais dois no telemóvel estreito.
- Eliminados todos os textos abaixo de 14 px e todo o letter spacing negativo ou decorativo.
- Transições e animações limitadas a 200 ms, com easing semântico e redução de movimento.
- Adicionados estados `:active`, indisponível e foco coerente.
- Modal passou a receber foco, conter a navegação por Tab, fechar com Escape e devolver foco ao botão de origem.
- Raios e controlos passaram a consumir a escala global do design system.

### Evidências finais

- `screenshots/after/sobre-nos-{320,768,1024,1440}.png`
- `data/after/sobre-nos.json`

### Verificação

- HTTP 200, um `h1` e um `main` nos quatro breakpoints.
- Zero overflow, texto abaixo de 14 px, alvos abaixo de 44 px, erros, violações Axe, IDs duplicados ou campos sem rótulo.
- Dois testes Playwright aprovados em desktop e móvel, cobrindo carrossel, validação do formulário, modal, Escape e restituição de foco.
- ESLint e TypeScript aprovados.
- Dashboard do candidato permaneceu intocada.
