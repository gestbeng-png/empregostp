# Documentação Final — Plataforma de Emprego e Serviços (STP)
> **Data:** 2026-01-31
>
> **Ficheiro:** `Final.md`
>
> **Nota:** Este documento consolida e expande a documentação existente, adicionando arquitetura, páginas, fluxos e boas práticas.

----

## Índice
1. 1. Visão geral
2. 2. Objetivos, escopo e princípios
3. 3. Perfis de utilizador e permissões (RBAC)
4. 4. Mapa do site (sitemap) e estrutura de páginas
5. 5. Wireframes e layout (ASCII) + Design System
6. 6. Funcionalidades (core + complementares moderadas)
7. 7. Arquitetura recomendada (rápida, escalável e segura)
8. 8. Frontend (Next.js/React): rotas, componentes e padrões
9. 9. Backend (Node.js): módulos, APIs, validação e jobs
10. 10. Modelo de dados (MongoDB) + índices + ERD
11. 11. Fluxos principais (sequência) e estados de candidatura
12. 12. Segurança, privacidade e compliance
13. 13. Performance, caching e otimizações
14. 14. Observabilidade (logs, métricas, tracing)
15. 15. Testes (unit, integração, e2e) e qualidade
16. 16. CI/CD e ambientes
17. 17. Convenções e melhores práticas de programação
18. 18. Roadmap e backlog (controlado)
19. 19. Anexos (inclui documentação base importada)

----

## 1. Visão geral
A plataforma é um ecossistema de emprego e serviços em São Tomé e Príncipe, indo além da simples publicação de vagas:
- **Candidatos**: criam perfil, constroem CV (incluindo PDF), candidatam-se e acompanham estados.
- **Empresas**: publicam vagas, triagem de candidaturas, comunicação e métricas.
- **Admin/Backoffice**: moderação, suporte, auditoria, pagamentos e conteúdos.
- **Recursos/Serviços**: repatriação, habitação, escola, vistos, onboarding local, consultoria, etc.

O objetivo é ser **rápido**, **fiável**, **seguro** e **fácil de manter**.

## 2. Objetivos, escopo e princípios
### 2.1 Objetivos
- Aumentar a empregabilidade e reduzir fricção no processo de recrutamento.
- Centralizar vagas, candidaturas e comunicação.
- Fornecer serviços complementares úteis (sem “inflar” o produto com excesso de funcionalidades).
- Garantir boa experiência em mobile e desktop (responsivo).

### 2.2 Escopo (o que entra)
- Gestão de utilizadores (candidato/empresa/admin), autenticação e recuperação.
- Publicação e gestão de vagas.
- Candidaturas com estados e comunicação.
- Perfil do candidato + CV Builder + PDF.
- Perfil da empresa + verificação opcional.
- Módulo de pagamentos para serviços premium (ex.: destaque de vaga, CV premium, etc.).
- Módulo de recursos (serviços externos) com pedidos e acompanhamento.
- Backoffice com moderação, auditoria e suporte.

### 2.3 Não-objetivos (por agora)
- ATS completo corporativo (integração complexa com HRIS).
- Rede social profissional.
- Marketplace genérico sem foco em emprego.

### 2.4 Princípios
- **Performance por defeito** (paginação, caching, CDN, imagens otimizadas).
- **Segurança por defeito** (RBAC, validação, rate limiting, auditoria).
- **DX e manutenção** (arquitetura modular, testes, lint, CI).
- **Acessibilidade** (WCAG 2.1 AA como referência).

## 3. Perfis de utilizador e permissões (RBAC)
### 3.1 Roles
- **PUBLIC**: visitante não autenticado.
- **CANDIDATO**: utilizador à procura de emprego/serviços.
- **EMPRESA_OWNER**: proprietário da empresa (tudo).
- **EMPRESA_RECRUTADOR**: gestão de vagas/candidaturas.
- **EMPRESA_VIEWER**: apenas leitura/métricas.
- **ADMIN**: gestão completa.
- **SUPORTE**: apoio ao cliente e moderação limitada.

### 3.2 Regras base
- Candidato só vê/edita os seus dados.
- Empresa só gere vagas e candidaturas das suas vagas.
- Admin pode suspender contas, moderar conteúdo e gerir pagamentos.
- Todas as ações críticas geram **audit log**.

### 3.3 Matriz de permissões (exemplo)
| Recurso | PUBLIC | CANDIDATO | EMPRESA | ADMIN |
|---|---|---|---|---|
| Ver vagas | ✅ | ✅ | ✅ | ✅ |
| Candidatar-se | ❌ | ✅ | ❌ | ✅ (debug) |
| Criar vaga | ❌ | ❌ | ✅ | ✅ |
| Ver candidaturas | ❌ | ✅ (suas) | ✅ (suas vagas) | ✅ |
| Moderação | ❌ | ❌ | ❌ | ✅ |

## 4. Mapa do site (sitemap) e estrutura de páginas
### 4.1 Árvore (estrutura)

```
PÚBLICO
├─ / (Home)
├─ /vagas (Pesquisa)
│  └─ /vagas/[id] (Detalhe)
├─ /empresas
│  └─ /empresas/[slug]
├─ /planos
├─ /recursos
├─ /blog
│  └─ /blog/[slug]
├─ /ajuda
├─ /contacto
└─ /auth (+ recuperar)

CANDIDATO
├─ /candidato (Dashboard)
├─ /candidato/perfil
├─ /candidato/cv
├─ /candidato/candidaturas
├─ /candidato/alertas
├─ /candidato/mensagens
├─ /candidato/pagamentos
├─ /candidato/documentos
└─ /candidato/definicoes

EMPRESA
├─ /empresa (Dashboard)
├─ /empresa/perfil
├─ /empresa/vagas
│  ├─ /empresa/vagas/nova
│  └─ /empresa/vagas/[id]
├─ /empresa/candidaturas
├─ /empresa/mensagens
├─ /empresa/plano
├─ /empresa/equipa
└─ /empresa/definicoes

ADMIN
├─ /admin
├─ /admin/utilizadores
├─ /admin/vagas
├─ /admin/pagamentos
├─ /admin/conteudos
└─ /admin/auditoria
```
### 4.2 Páginas detalhadas

### Página: Home
- **Rota:** `/`
- **Acesso:** Público
- **Objetivo:** Landing page com proposta de valor, pesquisa rápida de vagas e CTA para registo.
**Conteúdo/Blocos**
- Header + pesquisa
- Conteúdo principal
- Blocos informativos
- CTA
- FAQ/links

**Ações do utilizador**
- Pesquisar/filtrar
- Abrir detalhes
- Criar/editar (quando aplicável)
- Partilhar/guardar (quando aplicável)
- Contactar suporte (quando aplicável)

**Estados e UX**
- Loading (skeletons, spinners mínimos)
- Empty state (mensagem + CTA claro)
- Erro (mensagem humana + retry)
- Sucesso (toast + redirecionamento opcional)
- Acessibilidade (teclado, foco, aria-labels)

**Eventos de analytics (exemplos)**
- `view_page_home`
- `click_primary_cta`
- `apply_filters`
- `submit_form_success (quando aplicável)`
- `submit_form_error (quando aplicável)`

**Wireframe (ASCII)**

```
+--------------------------------------------------------------+
| Home (/)                                                     |
+----------------------+---------------------------------------+
| NAV / SIDEBAR        | MAIN                                  |
| - Links              | Header + pesquisa                     |
|                      | Conteúdo principal                    |
|                      | Blocos informativos                   |
|                      | CTA                                   |
|                      | FAQ/links                             |
|                      | ...                                   |
+----------------------+---------------------------------------+
| FOOTER: links, contacto, termos, redes                        |
+--------------------------------------------------------------+
```
### Página: Pesquisar Vagas
- **Rota:** `/vagas`
- **Acesso:** Público
- **Objetivo:** Listagem pesquisável com filtros avançados, paginação e recomendações.
**Conteúdo/Blocos**
- Filtros
- Tabela/lista
- Ações por linha
- Paginação
- Exportar (CSV opcional)

**Ações do utilizador**
- Pesquisar/filtrar
- Abrir detalhes
- Criar/editar (quando aplicável)
- Partilhar/guardar (quando aplicável)
- Contactar suporte (quando aplicável)

**Estados e UX**
- Loading (skeletons, spinners mínimos)
- Empty state (mensagem + CTA claro)
- Erro (mensagem humana + retry)
- Sucesso (toast + redirecionamento opcional)
- Acessibilidade (teclado, foco, aria-labels)

**Eventos de analytics (exemplos)**
- `view_page_vagas`
- `click_primary_cta`
- `apply_filters`
- `submit_form_success (quando aplicável)`
- `submit_form_error (quando aplicável)`

**Wireframe (ASCII)**

```
+--------------------------------------------------------------+
| Pesquisar Vagas (/vagas)                                     |
+----------------------+---------------------------------------+
| NAV / SIDEBAR        | MAIN                                  |
| - Links              | Filtros                               |
|                      | Tabela/lista                          |
|                      | Ações por linha                       |
|                      | Paginação                             |
|                      |             |
|                      | ...                                   |
+----------------------+---------------------------------------+
| FOOTER: links, contacto, termos, redes                        |
+--------------------------------------------------------------+
```
### Página: Detalhe da Vaga
- **Rota:** `/vagas/[id]`
- **Acesso:** Público
- **Objetivo:** Detalhes completos, empresa, requisitos, candidatura, partilha.
**Conteúdo/Blocos**
- Header + pesquisa
- Conteúdo principal
- Blocos informativos
- CTA
- FAQ/links

**Ações do utilizador**
- Pesquisar/filtrar
- Abrir detalhes
- Criar/editar (quando aplicável)
- Partilhar/guardar (quando aplicável)
- Contactar suporte (quando aplicável)

**Estados e UX**
- Loading (skeletons, spinners mínimos)
- Empty state (mensagem + CTA claro)
- Erro (mensagem humana + retry)
- Sucesso (toast + redirecionamento opcional)
- Acessibilidade (teclado, foco, aria-labels)

**Eventos de analytics (exemplos)**
- `view_page_vagas_[id]`
- `click_primary_cta`
- `apply_filters`
- `submit_form_success (quando aplicável)`
- `submit_form_error (quando aplicável)`

**Wireframe (ASCII)**

```
+--------------------------------------------------------------+
| Detalhe da Vaga (/vagas/[id])                                |
+----------------------+---------------------------------------+
| NAV / SIDEBAR        | MAIN                                  |
| - Links              | Header + pesquisa                     |
|                      | Conteúdo principal                    |
|                      | Blocos informativos                   |
|                      | CTA                                   |
|                      | FAQ/links                             |
|                      | ...                                   |
+----------------------+---------------------------------------+
| FOOTER: links, contacto, termos, redes                        |
+--------------------------------------------------------------+
```
### Página: Empresas
- **Rota:** `/empresas`
- **Acesso:** Público
- **Objetivo:** Catálogo de empresas com perfis públicos e vagas abertas.
**Conteúdo/Blocos**
- Header + pesquisa
- Conteúdo principal
- Blocos informativos
- CTA
- FAQ/links

**Ações do utilizador**
- Pesquisar/filtrar
- Abrir detalhes
- Criar/editar (quando aplicável)
- Partilhar/guardar (quando aplicável)
- Contactar suporte (quando aplicável)

**Estados e UX**
- Loading (skeletons, spinners mínimos)
- Empty state (mensagem + CTA claro)
- Erro (mensagem humana + retry)
- Sucesso (toast + redirecionamento opcional)
- Acessibilidade (teclado, foco, aria-labels)

**Eventos de analytics (exemplos)**
- `view_page_empresas`
- `click_primary_cta`
- `apply_filters`
- `submit_form_success (quando aplicável)`
- `submit_form_error (quando aplicável)`

**Wireframe (ASCII)**

```
+--------------------------------------------------------------+
| Empresas (/empresas)                                         |
+----------------------+---------------------------------------+
| NAV / SIDEBAR        | MAIN                                  |
| - Links              | Header + pesquisa                     |
|                      | Conteúdo principal                    |
|                      | Blocos informativos                   |
|                      | CTA                                   |
|                      | FAQ/links                             |
|                      | ...                                   |
+----------------------+---------------------------------------+
| FOOTER: links, contacto, termos, redes                        |
+--------------------------------------------------------------+
```
### Página: Perfil Público da Empresa
- **Rota:** `/empresas/[slug]`
- **Acesso:** Público
- **Objetivo:** Apresentação da empresa, vagas, reviews e contactos.
**Conteúdo/Blocos**
- Dados base
- Branding/foto
- Documentos
- Preferências
- Salvar/validar

**Ações do utilizador**
- Pesquisar/filtrar
- Abrir detalhes
- Criar/editar (quando aplicável)
- Partilhar/guardar (quando aplicável)
- Contactar suporte (quando aplicável)

**Estados e UX**
- Loading (skeletons, spinners mínimos)
- Empty state (mensagem + CTA claro)
- Erro (mensagem humana + retry)
- Sucesso (toast + redirecionamento opcional)
- Acessibilidade (teclado, foco, aria-labels)

**Eventos de analytics (exemplos)**
- `view_page_empresas_[slug]`
- `click_primary_cta`
- `apply_filters`
- `submit_form_success (quando aplicável)`
- `submit_form_error (quando aplicável)`

**Wireframe (ASCII)**

```
+--------------------------------------------------------------+
| Perfil Público da Empresa (/empresas/[slug])                 |
+----------------------+---------------------------------------+
| NAV / SIDEBAR        | MAIN                                  |
| - Links              | Dados base                            |
|                      | Branding/foto                         |
|                      | Documentos                            |
|                      | Preferências                          |
|                      | Salvar/validar                        |
|                      | ...                                   |
+----------------------+---------------------------------------+
| FOOTER: links, contacto, termos, redes                        |
+--------------------------------------------------------------+
```
### Página: Planos e Preços
- **Rota:** `/planos`
- **Acesso:** Público
- **Objetivo:** Planos para empresas e candidatos, comparação e FAQ.
**Conteúdo/Blocos**
- Plano atual
- Histórico
- Método de pagamento
- Faturas
- Upgrade

**Ações do utilizador**
- Pesquisar/filtrar
- Abrir detalhes
- Criar/editar (quando aplicável)
- Partilhar/guardar (quando aplicável)
- Contactar suporte (quando aplicável)

**Estados e UX**
- Loading (skeletons, spinners mínimos)
- Empty state (mensagem + CTA claro)
- Erro (mensagem humana + retry)
- Sucesso (toast + redirecionamento opcional)
- Acessibilidade (teclado, foco, aria-labels)

**Eventos de analytics (exemplos)**
- `view_page_planos`
- `click_primary_cta`
- `apply_filters`
- `submit_form_success (quando aplicável)`
- `submit_form_error (quando aplicável)`

**Wireframe (ASCII)**

```
+--------------------------------------------------------------+
| Planos e Preços (/planos)                                    |
+----------------------+---------------------------------------+
| NAV / SIDEBAR        | MAIN                                  |
| - Links              | Plano atual                           |
|                      | Histórico                             |
|                      | Método de pagamento                   |
|                      | Faturas                               |
|                      | Upgrade                               |
|                      | ...                                   |
+----------------------+---------------------------------------+
| FOOTER: links, contacto, termos, redes                        |
+--------------------------------------------------------------+
```
### Página: Recursos
- **Rota:** `/recursos`
- **Acesso:** Público
- **Objetivo:** Serviços adicionais: repatriação, habitação, escola, vistos, apoio local, etc.
**Conteúdo/Blocos**
- Header + pesquisa
- Conteúdo principal
- Blocos informativos
- CTA
- FAQ/links

**Ações do utilizador**
- Pesquisar/filtrar
- Abrir detalhes
- Criar/editar (quando aplicável)
- Partilhar/guardar (quando aplicável)
- Contactar suporte (quando aplicável)

**Estados e UX**
- Loading (skeletons, spinners mínimos)
- Empty state (mensagem + CTA claro)
- Erro (mensagem humana + retry)
- Sucesso (toast + redirecionamento opcional)
- Acessibilidade (teclado, foco, aria-labels)

**Eventos de analytics (exemplos)**
- `view_page_recursos`
- `click_primary_cta`
- `apply_filters`
- `submit_form_success (quando aplicável)`
- `submit_form_error (quando aplicável)`

**Wireframe (ASCII)**

```
+--------------------------------------------------------------+
| Recursos (/recursos)                                         |
+----------------------+---------------------------------------+
| NAV / SIDEBAR        | MAIN                                  |
| - Links              | Header + pesquisa                     |
|                      | Conteúdo principal                    |
|                      | Blocos informativos                   |
|                      | CTA                                   |
|                      | FAQ/links                             |
|                      | ...                                   |
+----------------------+---------------------------------------+
| FOOTER: links, contacto, termos, redes                        |
+--------------------------------------------------------------+
```
### Página: Blog/Conteúdos
- **Rota:** `/blog`
- **Acesso:** Público
- **Objetivo:** Conteúdos SEO: guias de carreira e mercado em STP.
**Conteúdo/Blocos**
- Header + pesquisa
- Conteúdo principal
- Blocos informativos
- CTA
- FAQ/links

**Ações do utilizador**
- Pesquisar/filtrar
- Abrir detalhes
- Criar/editar (quando aplicável)
- Partilhar/guardar (quando aplicável)
- Contactar suporte (quando aplicável)

**Estados e UX**
- Loading (skeletons, spinners mínimos)
- Empty state (mensagem + CTA claro)
- Erro (mensagem humana + retry)
- Sucesso (toast + redirecionamento opcional)
- Acessibilidade (teclado, foco, aria-labels)

**Eventos de analytics (exemplos)**
- `view_page_blog`
- `click_primary_cta`
- `apply_filters`
- `submit_form_success (quando aplicável)`
- `submit_form_error (quando aplicável)`

**Wireframe (ASCII)**

```
+--------------------------------------------------------------+
| Blog/Conteúdos (/blog)                                       |
+----------------------+---------------------------------------+
| NAV / SIDEBAR        | MAIN                                  |
| - Links              | Header + pesquisa                     |
|                      | Conteúdo principal                    |
|                      | Blocos informativos                   |
|                      | CTA                                   |
|                      | FAQ/links                             |
|                      | ...                                   |
+----------------------+---------------------------------------+
| FOOTER: links, contacto, termos, redes                        |
+--------------------------------------------------------------+
```
### Página: Artigo
- **Rota:** `/blog/[slug]`
- **Acesso:** Público
- **Objetivo:** Artigo com schema.org, leitura, partilha e sugestões.
**Conteúdo/Blocos**
- Header + pesquisa
- Conteúdo principal
- Blocos informativos
- CTA
- FAQ/links

**Ações do utilizador**
- Pesquisar/filtrar
- Abrir detalhes
- Criar/editar (quando aplicável)
- Partilhar/guardar (quando aplicável)
- Contactar suporte (quando aplicável)

**Estados e UX**
- Loading (skeletons, spinners mínimos)
- Empty state (mensagem + CTA claro)
- Erro (mensagem humana + retry)
- Sucesso (toast + redirecionamento opcional)
- Acessibilidade (teclado, foco, aria-labels)

**Eventos de analytics (exemplos)**
- `view_page_blog_[slug]`
- `click_primary_cta`
- `apply_filters`
- `submit_form_success (quando aplicável)`
- `submit_form_error (quando aplicável)`

**Wireframe (ASCII)**

```
+--------------------------------------------------------------+
| Artigo (/blog/[slug])                                        |
+----------------------+---------------------------------------+
| NAV / SIDEBAR        | MAIN                                  |
| - Links              | Header + pesquisa                     |
|                      | Conteúdo principal                    |
|                      | Blocos informativos                   |
|                      | CTA                                   |
|                      | FAQ/links                             |
|                      | ...                                   |
+----------------------+---------------------------------------+
| FOOTER: links, contacto, termos, redes                        |
+--------------------------------------------------------------+
```
### Página: Ajuda / FAQ
- **Rota:** `/ajuda`
- **Acesso:** Público
- **Objetivo:** Base de conhecimento, pesquisa e formulários de contacto.
**Conteúdo/Blocos**
- Header + pesquisa
- Conteúdo principal
- Blocos informativos
- CTA
- FAQ/links

**Ações do utilizador**
- Pesquisar/filtrar
- Abrir detalhes
- Criar/editar (quando aplicável)
- Partilhar/guardar (quando aplicável)
- Contactar suporte (quando aplicável)

**Estados e UX**
- Loading (skeletons, spinners mínimos)
- Empty state (mensagem + CTA claro)
- Erro (mensagem humana + retry)
- Sucesso (toast + redirecionamento opcional)
- Acessibilidade (teclado, foco, aria-labels)

**Eventos de analytics (exemplos)**
- `view_page_ajuda`
- `click_primary_cta`
- `apply_filters`
- `submit_form_success (quando aplicável)`
- `submit_form_error (quando aplicável)`

**Wireframe (ASCII)**

```
+--------------------------------------------------------------+
| Ajuda / FAQ (/ajuda)                                         |
+----------------------+---------------------------------------+
| NAV / SIDEBAR        | MAIN                                  |
| - Links              | Header + pesquisa                     |
|                      | Conteúdo principal                    |
|                      | Blocos informativos                   |
|                      | CTA                                   |
|                      | FAQ/links                             |
|                      | ...                                   |
+----------------------+---------------------------------------+
| FOOTER: links, contacto, termos, redes                        |
+--------------------------------------------------------------+
```
### Página: Contacto
- **Rota:** `/contacto`
- **Acesso:** Público
- **Objetivo:** Formulário, canais, mapa e horários.
**Conteúdo/Blocos**
- Header + pesquisa
- Conteúdo principal
- Blocos informativos
- CTA
- FAQ/links

**Ações do utilizador**
- Pesquisar/filtrar
- Abrir detalhes
- Criar/editar (quando aplicável)
- Partilhar/guardar (quando aplicável)
- Contactar suporte (quando aplicável)

**Estados e UX**
- Loading (skeletons, spinners mínimos)
- Empty state (mensagem + CTA claro)
- Erro (mensagem humana + retry)
- Sucesso (toast + redirecionamento opcional)
- Acessibilidade (teclado, foco, aria-labels)

**Eventos de analytics (exemplos)**
- `view_page_contacto`
- `click_primary_cta`
- `apply_filters`
- `submit_form_success (quando aplicável)`
- `submit_form_error (quando aplicável)`

**Wireframe (ASCII)**

```
+--------------------------------------------------------------+
| Contacto (/contacto)                                         |
+----------------------+---------------------------------------+
| NAV / SIDEBAR        | MAIN                                  |
| - Links              | Header + pesquisa                     |
|                      | Conteúdo principal                    |
|                      | Blocos informativos                   |
|                      | CTA                                   |
|                      | FAQ/links                             |
|                      | ...                                   |
+----------------------+---------------------------------------+
| FOOTER: links, contacto, termos, redes                        |
+--------------------------------------------------------------+
```
### Página: Autenticação
- **Rota:** `/auth`
- **Acesso:** Público
- **Objetivo:** Login/Registo com escolha de perfil (Candidato/Empresa).
**Conteúdo/Blocos**
- Header + pesquisa
- Conteúdo principal
- Blocos informativos
- CTA
- FAQ/links

**Ações do utilizador**
- Pesquisar/filtrar
- Abrir detalhes
- Criar/editar (quando aplicável)
- Partilhar/guardar (quando aplicável)
- Contactar suporte (quando aplicável)

**Estados e UX**
- Loading (skeletons, spinners mínimos)
- Empty state (mensagem + CTA claro)
- Erro (mensagem humana + retry)
- Sucesso (toast + redirecionamento opcional)
- Acessibilidade (teclado, foco, aria-labels)

**Eventos de analytics (exemplos)**
- `view_page_auth`
- `click_primary_cta`
- `apply_filters`
- `submit_form_success (quando aplicável)`
- `submit_form_error (quando aplicável)`

**Wireframe (ASCII)**

```
+--------------------------------------------------------------+
| Autenticação (/auth)                                         |
+----------------------+---------------------------------------+
| NAV / SIDEBAR        | MAIN                                  |
| - Links              | Header + pesquisa                     |
|                      | Conteúdo principal                    |
|                      | Blocos informativos                   |
|                      | CTA                                   |
|                      | FAQ/links                             |
|                      | ...                                   |
+----------------------+---------------------------------------+
| FOOTER: links, contacto, termos, redes                        |
+--------------------------------------------------------------+
```
### Página: Recuperar Password
- **Rota:** `/auth/recuperar`
- **Acesso:** Público
- **Objetivo:** Recuperação por e-mail com tokens.
**Conteúdo/Blocos**
- Header + pesquisa
- Conteúdo principal
- Blocos informativos
- CTA
- FAQ/links

**Ações do utilizador**
- Pesquisar/filtrar
- Abrir detalhes
- Criar/editar (quando aplicável)
- Partilhar/guardar (quando aplicável)
- Contactar suporte (quando aplicável)

**Estados e UX**
- Loading (skeletons, spinners mínimos)
- Empty state (mensagem + CTA claro)
- Erro (mensagem humana + retry)
- Sucesso (toast + redirecionamento opcional)
- Acessibilidade (teclado, foco, aria-labels)

**Eventos de analytics (exemplos)**
- `view_page_auth_recuperar`
- `click_primary_cta`
- `apply_filters`
- `submit_form_success (quando aplicável)`
- `submit_form_error (quando aplicável)`

**Wireframe (ASCII)**

```
+--------------------------------------------------------------+
| Recuperar Password (/auth/recuperar)                         |
+----------------------+---------------------------------------+
| NAV / SIDEBAR        | MAIN                                  |
| - Links              | Header + pesquisa                     |
|                      | Conteúdo principal                    |
|                      | Blocos informativos                   |
|                      | CTA                                   |
|                      | FAQ/links                             |
|                      | ...                                   |
+----------------------+---------------------------------------+
| FOOTER: links, contacto, termos, redes                        |
+--------------------------------------------------------------+
```
### Página: Dashboard do Candidato
- **Rota:** `/candidato`
- **Acesso:** Candidato
- **Objetivo:** Resumo: vagas recomendadas, candidaturas, perfil e alertas.
**Conteúdo/Blocos**
- Cards de KPIs
- Ações rápidas
- Listas (recentes)
- Recomendações
- Avisos/notificações

**Ações do utilizador**
- Pesquisar/filtrar
- Abrir detalhes
- Criar/editar (quando aplicável)
- Partilhar/guardar (quando aplicável)
- Contactar suporte (quando aplicável)

**Estados e UX**
- Loading (skeletons, spinners mínimos)
- Empty state (mensagem + CTA claro)
- Erro (mensagem humana + retry)
- Sucesso (toast + redirecionamento opcional)
- Acessibilidade (teclado, foco, aria-labels)

**Eventos de analytics (exemplos)**
- `view_page_candidato`
- `click_primary_cta`
- `apply_filters`
- `submit_form_success (quando aplicável)`
- `submit_form_error (quando aplicável)`

**Wireframe (ASCII)**

```
+--------------------------------------------------------------+
| Dashboard do Candidato (/candidato)                          |
+----------------------+---------------------------------------+
| NAV / SIDEBAR        | MAIN                                  |
| - Links              | Cards de KPIs                         |
|                      | Ações rápidas                         |
|                      | Listas (recentes)                     |
|                      | Recomendações                         |
|                      | Avisos/notificações                   |
|                      | ...                                   |
+----------------------+---------------------------------------+
| FOOTER: links, contacto, termos, redes                        |
+--------------------------------------------------------------+
```
### Página: Perfil do Candidato
- **Rota:** `/candidato/perfil`
- **Acesso:** Candidato
- **Objetivo:** Dados pessoais, foto, experiência, skills, documentos.
**Conteúdo/Blocos**
- Dados base
- Branding/foto
- Documentos
- Preferências
- Salvar/validar

**Ações do utilizador**
- Pesquisar/filtrar
- Abrir detalhes
- Criar/editar (quando aplicável)
- Partilhar/guardar (quando aplicável)
- Contactar suporte (quando aplicável)

**Estados e UX**
- Loading (skeletons, spinners mínimos)
- Empty state (mensagem + CTA claro)
- Erro (mensagem humana + retry)
- Sucesso (toast + redirecionamento opcional)
- Acessibilidade (teclado, foco, aria-labels)

**Eventos de analytics (exemplos)**
- `view_page_candidato_perfil`
- `click_primary_cta`
- `apply_filters`
- `submit_form_success (quando aplicável)`
- `submit_form_error (quando aplicável)`

**Wireframe (ASCII)**

```
+--------------------------------------------------------------+
| Perfil do Candidato (/candidato/perfil)                      |
+----------------------+---------------------------------------+
| NAV / SIDEBAR        | MAIN                                  |
| - Links              | Dados base                            |
|                      | Branding/foto                         |
|                      | Documentos                            |
|                      | Preferências                          |
|                      | Salvar/validar                        |
|                      | ...                                   |
+----------------------+---------------------------------------+
| FOOTER: links, contacto, termos, redes                        |
+--------------------------------------------------------------+
```
### Página: CV Builder
- **Rota:** `/candidato/cv`
- **Acesso:** Candidato
- **Objetivo:** Criar CV avançado, templates, exportar PDF, partilhar link.
**Conteúdo/Blocos**
- Header + pesquisa
- Conteúdo principal
- Blocos informativos
- CTA
- FAQ/links

**Ações do utilizador**
- Pesquisar/filtrar
- Abrir detalhes
- Criar/editar (quando aplicável)
- Partilhar/guardar (quando aplicável)
- Contactar suporte (quando aplicável)

**Estados e UX**
- Loading (skeletons, spinners mínimos)
- Empty state (mensagem + CTA claro)
- Erro (mensagem humana + retry)
- Sucesso (toast + redirecionamento opcional)
- Acessibilidade (teclado, foco, aria-labels)

**Eventos de analytics (exemplos)**
- `view_page_candidato_cv`
- `click_primary_cta`
- `apply_filters`
- `submit_form_success (quando aplicável)`
- `submit_form_error (quando aplicável)`

**Wireframe (ASCII)**

```
+--------------------------------------------------------------+
| CV Builder (/candidato/cv)                                   |
+----------------------+---------------------------------------+
| NAV / SIDEBAR        | MAIN                                  |
| - Links              | Header + pesquisa                     |
|                      | Conteúdo principal                    |
|                      | Blocos informativos                   |
|                      | CTA                                   |
|                      | FAQ/links                             |
|                      | ...                                   |
+----------------------+---------------------------------------+
| FOOTER: links, contacto, termos, redes                        |
+--------------------------------------------------------------+
```
### Página: Candidaturas
- **Rota:** `/candidato/candidaturas`
- **Acesso:** Candidato
- **Objetivo:** Histórico, estados, mensagens e ações.
**Conteúdo/Blocos**
- Kanban/lista
- Estados
- Notas
- Mensagens
- Marcar entrevista

**Ações do utilizador**
- Pesquisar/filtrar
- Abrir detalhes
- Criar/editar (quando aplicável)
- Partilhar/guardar (quando aplicável)
- Contactar suporte (quando aplicável)

**Estados e UX**
- Loading (skeletons, spinners mínimos)
- Empty state (mensagem + CTA claro)
- Erro (mensagem humana + retry)
- Sucesso (toast + redirecionamento opcional)
- Acessibilidade (teclado, foco, aria-labels)

**Eventos de analytics (exemplos)**
- `view_page_candidato_candidaturas`
- `click_primary_cta`
- `apply_filters`
- `submit_form_success (quando aplicável)`
- `submit_form_error (quando aplicável)`

**Wireframe (ASCII)**

```
+--------------------------------------------------------------+
| Candidaturas (/candidato/candidaturas)                       |
+----------------------+---------------------------------------+
| NAV / SIDEBAR        | MAIN                                  |
| - Links              | Kanban/lista                          |
|                      | Estados                               |
|                      | Notas                                 |
|                      | Mensagens                             |
|                      | Marcar entrevista                     |
|                      | ...                                   |
+----------------------+---------------------------------------+
| FOOTER: links, contacto, termos, redes                        |
+--------------------------------------------------------------+
```
### Página: Alertas de Vagas
- **Rota:** `/candidato/alertas`
- **Acesso:** Candidato
- **Objetivo:** Criar alertas por filtros e periodicidade.
**Conteúdo/Blocos**
- Filtros
- Tabela/lista
- Ações por linha
- Paginação
- Exportar (CSV opcional)

**Ações do utilizador**
- Pesquisar/filtrar
- Abrir detalhes
- Criar/editar (quando aplicável)
- Partilhar/guardar (quando aplicável)
- Contactar suporte (quando aplicável)

**Estados e UX**
- Loading (skeletons, spinners mínimos)
- Empty state (mensagem + CTA claro)
- Erro (mensagem humana + retry)
- Sucesso (toast + redirecionamento opcional)
- Acessibilidade (teclado, foco, aria-labels)

**Eventos de analytics (exemplos)**
- `view_page_candidato_alertas`
- `click_primary_cta`
- `apply_filters`
- `submit_form_success (quando aplicável)`
- `submit_form_error (quando aplicável)`

**Wireframe (ASCII)**

```
+--------------------------------------------------------------+
| Alertas de Vagas (/candidato/alertas)                        |
+----------------------+---------------------------------------+
| NAV / SIDEBAR        | MAIN                                  |
| - Links              | Filtros                               |
|                      | Tabela/lista                          |
|                      | Ações por linha                       |
|                      | Paginação                             |
|                      | Exportar (CSV opcional)               |
|                      | ...                                   |
+----------------------+---------------------------------------+
| FOOTER: links, contacto, termos, redes                        |
+--------------------------------------------------------------+
```
### Página: Mensagens
- **Rota:** `/candidato/mensagens`
- **Acesso:** Candidato
- **Objetivo:** Chat/Inbox com empresas e equipa de suporte.
**Conteúdo/Blocos**
- Lista de conversas
- Janela de chat
- Anexos
- Templates
- Pesquisar

**Ações do utilizador**
- Pesquisar/filtrar
- Abrir detalhes
- Criar/editar (quando aplicável)
- Partilhar/guardar (quando aplicável)
- Contactar suporte (quando aplicável)

**Estados e UX**
- Loading (skeletons, spinners mínimos)
- Empty state (mensagem + CTA claro)
- Erro (mensagem humana + retry)
- Sucesso (toast + redirecionamento opcional)
- Acessibilidade (teclado, foco, aria-labels)

**Eventos de analytics (exemplos)**
- `view_page_candidato_mensagens`
- `click_primary_cta`
- `apply_filters`
- `submit_form_success (quando aplicável)`
- `submit_form_error (quando aplicável)`

**Wireframe (ASCII)**

```
+--------------------------------------------------------------+
| Mensagens (/candidato/mensagens)                             |
+----------------------+---------------------------------------+
| NAV / SIDEBAR        | MAIN                                  |
| - Links              | Lista de conversas                    |
|                      | Janela de chat                        |
|                      | Anexos                                |
|                      | Templates                             |
|                      | Pesquisar                             |
|                      | ...                                   |
+----------------------+---------------------------------------+
| FOOTER: links, contacto, termos, redes                        |
+--------------------------------------------------------------+
```
### Página: Pagamentos
- **Rota:** `/candidato/pagamentos`
- **Acesso:** Candidato
- **Objetivo:** Assinaturas/serviços pagos, faturas e histórico.
**Conteúdo/Blocos**
- Plano atual
- Histórico
- Método de pagamento
- Faturas
- Upgrade

**Ações do utilizador**
- Pesquisar/filtrar
- Abrir detalhes
- Criar/editar (quando aplicável)
- Partilhar/guardar (quando aplicável)
- Contactar suporte (quando aplicável)

**Estados e UX**
- Loading (skeletons, spinners mínimos)
- Empty state (mensagem + CTA claro)
- Erro (mensagem humana + retry)
- Sucesso (toast + redirecionamento opcional)
- Acessibilidade (teclado, foco, aria-labels)

**Eventos de analytics (exemplos)**
- `view_page_candidato_pagamentos`
- `click_primary_cta`
- `apply_filters`
- `submit_form_success (quando aplicável)`
- `submit_form_error (quando aplicável)`

**Wireframe (ASCII)**

```
+--------------------------------------------------------------+
| Pagamentos (/candidato/pagamentos)                           |
+----------------------+---------------------------------------+
| NAV / SIDEBAR        | MAIN                                  |
| - Links              | Plano atual                           |
|                      | Histórico                             |
|                      | Método de pagamento                   |
|                      | Faturas                               |
|                      | Upgrade                               |
|                      | ...                                   |
+----------------------+---------------------------------------+
| FOOTER: links, contacto, termos, redes                        |
+--------------------------------------------------------------+
```
### Página: Documentos
- **Rota:** `/candidato/documentos`
- **Acesso:** Candidato
- **Objetivo:** Upload/gestão de CV, certificados, carta, portfólio.
**Conteúdo/Blocos**
- Header + pesquisa
- Conteúdo principal
- Blocos informativos
- CTA
- FAQ/links

**Ações do utilizador**
- Pesquisar/filtrar
- Abrir detalhes
- Criar/editar (quando aplicável)
- Partilhar/guardar (quando aplicável)
- Contactar suporte (quando aplicável)

**Estados e UX**
- Loading (skeletons, spinners mínimos)
- Empty state (mensagem + CTA claro)
- Erro (mensagem humana + retry)
- Sucesso (toast + redirecionamento opcional)
- Acessibilidade (teclado, foco, aria-labels)

**Eventos de analytics (exemplos)**
- `view_page_candidato_documentos`
- `click_primary_cta`
- `apply_filters`
- `submit_form_success (quando aplicável)`
- `submit_form_error (quando aplicável)`

**Wireframe (ASCII)**

```
+--------------------------------------------------------------+
| Documentos (/candidato/documentos)                           |
+----------------------+---------------------------------------+
| NAV / SIDEBAR        | MAIN                                  |
| - Links              | Header + pesquisa                     |
|                      | Conteúdo principal                    |
|                      | Blocos informativos                   |
|                      | CTA                                   |
|                      | FAQ/links                             |
|                      | ...                                   |
+----------------------+---------------------------------------+
| FOOTER: links, contacto, termos, redes                        |
+--------------------------------------------------------------+
```
### Página: Definições
- **Rota:** `/candidato/definicoes`
- **Acesso:** Candidato
- **Objetivo:** Segurança, privacidade, notificações,
**Conteúdo/Blocos**
- Header + pesquisa
- Conteúdo principal
- Blocos informativos
- CTA
- FAQ/links

**Ações do utilizador**
- Pesquisar/filtrar
- Abrir detalhes
- Criar/editar (quando aplicável)
- Partilhar/guardar (quando aplicável)
- Contactar suporte (quando aplicável)

**Estados e UX**
- Loading (skeletons, spinners mínimos)
- Empty state (mensagem + CTA claro)
- Erro (mensagem humana + retry)
- Sucesso (toast + redirecionamento opcional)
- Acessibilidade (teclado, foco, aria-labels)

**Eventos de analytics (exemplos)**
- `view_page_candidato_definicoes`
- `click_primary_cta`
- `apply_filters`
- `submit_form_success (quando aplicável)`
- `submit_form_error (quando aplicável)`

**Wireframe (ASCII)**

```
+--------------------------------------------------------------+
| Definições (/candidato/definicoes)                           |
+----------------------+---------------------------------------+
| NAV / SIDEBAR        | MAIN                                  |
| - Links              | Header + pesquisa                     |
|                      | Conteúdo principal                    |
|                      | Blocos informativos                   |
|                      | CTA                                   |
|                      | FAQ/links                             |
|                      | ...                                   |
+----------------------+---------------------------------------+
| FOOTER: links, contacto, termos, redes                        |
+--------------------------------------------------------------+
```
### Página: Dashboard da Empresa
- **Rota:** `/empresa`
- **Acesso:** Empresa
- **Objetivo:** Resumo: vagas, candidaturas, mensagens, performance.
**Conteúdo/Blocos**
- Cards de KPIs
- Ações rápidas
- Listas (recentes)
- Recomendações
- Avisos/notificações

**Ações do utilizador**
- Pesquisar/filtrar
- Abrir detalhes
- Criar/editar (quando aplicável)
- Partilhar/guardar (quando aplicável)
- Contactar suporte (quando aplicável)

**Estados e UX**
- Loading (skeletons, spinners mínimos)
- Empty state (mensagem + CTA claro)
- Erro (mensagem humana + retry)
- Sucesso (toast + redirecionamento opcional)
- Acessibilidade (teclado, foco, aria-labels)

**Eventos de analytics (exemplos)**
- `view_page_empresa`
- `click_primary_cta`
- `apply_filters`
- `submit_form_success (quando aplicável)`
- `submit_form_error (quando aplicável)`

**Wireframe (ASCII)**

```
+--------------------------------------------------------------+
| Dashboard da Empresa (/empresa)                              |
+----------------------+---------------------------------------+
| NAV / SIDEBAR        | MAIN                                  |
| - Links              | Cards de KPIs                         |
|                      | Ações rápidas                         |
|                      | Listas (recentes)                     |
|                      | Recomendações                         |
|                      | Avisos/notificações                   |
|                      | ...                                   |
+----------------------+---------------------------------------+
| FOOTER: links, contacto, termos, redes                        |
+--------------------------------------------------------------+
```
### Página: Perfil da Empresa
- **Rota:** `/empresa/perfil`
- **Acesso:** Empresa
- **Objetivo:** Dados legais, branding, equipa e verificação.
**Conteúdo/Blocos**
- Dados base
- Branding/foto
- Documentos
- Preferências
- Salvar/validar

**Ações do utilizador**
- Pesquisar/filtrar
- Abrir detalhes
- Criar/editar (quando aplicável)
- Partilhar/guardar (quando aplicável)
- Contactar suporte (quando aplicável)

**Estados e UX**
- Loading (skeletons, spinners mínimos)
- Empty state (mensagem + CTA claro)
- Erro (mensagem humana + retry)
- Sucesso (toast + redirecionamento opcional)
- Acessibilidade (teclado, foco, aria-labels)

**Eventos de analytics (exemplos)**
- `view_page_empresa_perfil`
- `click_primary_cta`
- `apply_filters`
- `submit_form_success (quando aplicável)`
- `submit_form_error (quando aplicável)`

**Wireframe (ASCII)**

```
+--------------------------------------------------------------+
| Perfil da Empresa (/empresa/perfil)                          |
+----------------------+---------------------------------------+
| NAV / SIDEBAR        | MAIN                                  |
| - Links              | Dados base                            |
|                      | Branding/foto                         |
|                      | Documentos                            |
|                      | Preferências                          |
|                      | Salvar/validar                        |
|                      | ...                                   |
+----------------------+---------------------------------------+
| FOOTER: links, contacto, termos, redes                        |
+--------------------------------------------------------------+
```
### Página: Criar Vaga
- **Rota:** `/empresa/vagas/nova`
- **Acesso:** Empresa
- **Objetivo:** Editor de vaga com validações, rascunho e publicação.
**Conteúdo/Blocos**
- Formulário multi-step
- Preview
- Validações
- Guardar rascunho
- Publicar

**Ações do utilizador**
- Pesquisar/filtrar
- Abrir detalhes
- Criar/editar (quando aplicável)
- Partilhar/guardar (quando aplicável)
- Contactar suporte (quando aplicável)

**Estados e UX**
- Loading (skeletons, spinners mínimos)
- Empty state (mensagem + CTA claro)
- Erro (mensagem humana + retry)
- Sucesso (toast + redirecionamento opcional)
- Acessibilidade (teclado, foco, aria-labels)

**Eventos de analytics (exemplos)**
- `view_page_empresa_vagas_nova`
- `click_primary_cta`
- `apply_filters`
- `submit_form_success (quando aplicável)`
- `submit_form_error (quando aplicável)`

**Wireframe (ASCII)**

```
+--------------------------------------------------------------+
| Criar Vaga (/empresa/vagas/nova)                             |
+----------------------+---------------------------------------+
| NAV / SIDEBAR        | MAIN                                  |
| - Links              | Formulário multi-step                 |
|                      | Preview                               |
|                      | Validações                            |
|                      | Guardar rascunho                      |
|                      | Publicar                              |
|                      | ...                                   |
+----------------------+---------------------------------------+
| FOOTER: links, contacto, termos, redes                        |
+--------------------------------------------------------------+
```
### Página: Minhas Vagas
- **Rota:** `/empresa/vagas`
- **Acesso:** Empresa
- **Objetivo:** Gestão de vagas: editar, fechar, duplicar, destacar.
**Conteúdo/Blocos**
- Filtros
- Tabela/lista
- Ações por linha
- Paginação
- Exportar (CSV opcional)

**Ações do utilizador**
- Pesquisar/filtrar
- Abrir detalhes
- Criar/editar (quando aplicável)
- Partilhar/guardar (quando aplicável)
- Contactar suporte (quando aplicável)

**Estados e UX**
- Loading (skeletons, spinners mínimos)
- Empty state (mensagem + CTA claro)
- Erro (mensagem humana + retry)
- Sucesso (toast + redirecionamento opcional)
- Acessibilidade (teclado, foco, aria-labels)

**Eventos de analytics (exemplos)**
- `view_page_empresa_vagas`
- `click_primary_cta`
- `apply_filters`
- `submit_form_success (quando aplicável)`
- `submit_form_error (quando aplicável)`

**Wireframe (ASCII)**

```
+--------------------------------------------------------------+
| Minhas Vagas (/empresa/vagas)                                |
+----------------------+---------------------------------------+
| NAV / SIDEBAR        | MAIN                                  |
| - Links              | Filtros                               |
|                      | Tabela/lista                          |
|                      | Ações por linha                       |
|                      | Paginação                             |
|                      | Exportar (CSV opcional)               |
|                      | ...                                   |
+----------------------+---------------------------------------+
| FOOTER: links, contacto, termos, redes                        |
+--------------------------------------------------------------+
```
### Página: Detalhe da Vaga (Empresa)
- **Rota:** `/empresa/vagas/[id]`
- **Acesso:** Empresa
- **Objetivo:** Métricas, candidaturas recebidas e triagem.
**Conteúdo/Blocos**
- Header + pesquisa
- Conteúdo principal
- Blocos informativos
- CTA
- FAQ/links

**Ações do utilizador**
- Pesquisar/filtrar
- Abrir detalhes
- Criar/editar (quando aplicável)
- Partilhar/guardar (quando aplicável)
- Contactar suporte (quando aplicável)

**Estados e UX**
- Loading (skeletons, spinners mínimos)
- Empty state (mensagem + CTA claro)
- Erro (mensagem humana + retry)
- Sucesso (toast + redirecionamento opcional)
- Acessibilidade (teclado, foco, aria-labels)

**Eventos de analytics (exemplos)**
- `view_page_empresa_vagas_[id]`
- `click_primary_cta`
- `apply_filters`
- `submit_form_success (quando aplicável)`
- `submit_form_error (quando aplicável)`

**Wireframe (ASCII)**

```
+--------------------------------------------------------------+
| Detalhe da Vaga (Empresa) (/empresa/vagas/[id])              |
+----------------------+---------------------------------------+
| NAV / SIDEBAR        | MAIN                                  |
| - Links              | Header + pesquisa                     |
|                      | Conteúdo principal                    |
|                      | Blocos informativos                   |
|                      | CTA                                   |
|                      | FAQ/links                             |
|                      | ...                                   |
+----------------------+---------------------------------------+
| FOOTER: links, contacto, termos, redes                        |
+--------------------------------------------------------------+
```
### Página: Candidaturas Recebidas
- **Rota:** `/empresa/candidaturas`
- **Acesso:** Empresa
- **Objetivo:** Pipeline/Kanban, filtros e notas internas.
**Conteúdo/Blocos**
- Kanban/lista
- Estados
- Notas
- Mensagens
- Marcar entrevista

**Ações do utilizador**
- Pesquisar/filtrar
- Abrir detalhes
- Criar/editar (quando aplicável)
- Partilhar/guardar (quando aplicável)
- Contactar suporte (quando aplicável)

**Estados e UX**
- Loading (skeletons, spinners mínimos)
- Empty state (mensagem + CTA claro)
- Erro (mensagem humana + retry)
- Sucesso (toast + redirecionamento opcional)
- Acessibilidade (teclado, foco, aria-labels)

**Eventos de analytics (exemplos)**
- `view_page_empresa_candidaturas`
- `click_primary_cta`
- `apply_filters`
- `submit_form_success (quando aplicável)`
- `submit_form_error (quando aplicável)`

**Wireframe (ASCII)**

```
+--------------------------------------------------------------+
| Candidaturas Recebidas (/empresa/candidaturas)               |
+----------------------+---------------------------------------+
| NAV / SIDEBAR        | MAIN                                  |
| - Links              | Kanban/lista                          |
|                      | Estados                               |
|                      | Notas                                 |
|                      | Mensagens                             |
|                      | Marcar entrevista                     |
|                      | ...                                   |
+----------------------+---------------------------------------+
| FOOTER: links, contacto, termos, redes                        |
+--------------------------------------------------------------+
```
### Página: Mensagens (Empresa)
- **Rota:** `/empresa/mensagens`
- **Acesso:** Empresa
- **Objetivo:** Conversas com candidatos e templates.
**Conteúdo/Blocos**
- Lista de conversas
- Janela de chat
- Anexos
- Templates
- Pesquisar

**Ações do utilizador**
- Pesquisar/filtrar
- Abrir detalhes
- Criar/editar (quando aplicável)
- Partilhar/guardar (quando aplicável)
- Contactar suporte (quando aplicável)

**Estados e UX**
- Loading (skeletons, spinners mínimos)
- Empty state (mensagem + CTA claro)
- Erro (mensagem humana + retry)
- Sucesso (toast + redirecionamento opcional)
- Acessibilidade (teclado, foco, aria-labels)

**Eventos de analytics (exemplos)**
- `view_page_empresa_mensagens`
- `click_primary_cta`
- `apply_filters`
- `submit_form_success (quando aplicável)`
- `submit_form_error (quando aplicável)`

**Wireframe (ASCII)**

```
+--------------------------------------------------------------+
| Mensagens (Empresa) (/empresa/mensagens)                     |
+----------------------+---------------------------------------+
| NAV / SIDEBAR        | MAIN                                  |
| - Links              | Lista de conversas                    |
|                      | Janela de chat                        |
|                      | Anexos                                |
|                      | Templates                             |
|                      | Pesquisar                             |
|                      | ...                                   |
+----------------------+---------------------------------------+
| FOOTER: links, contacto, termos, redes                        |
+--------------------------------------------------------------+
```
### Página: Plano e Faturação
- **Rota:** `/empresa/plano`
- **Acesso:** Empresa
- **Objetivo:** Plano atual, upgrade, addons e faturas.
**Conteúdo/Blocos**
- Plano atual
- Histórico
- Método de pagamento
- Faturas
- Upgrade

**Ações do utilizador**
- Pesquisar/filtrar
- Abrir detalhes
- Criar/editar (quando aplicável)
- Partilhar/guardar (quando aplicável)
- Contactar suporte (quando aplicável)

**Estados e UX**
- Loading (skeletons, spinners mínimos)
- Empty state (mensagem + CTA claro)
- Erro (mensagem humana + retry)
- Sucesso (toast + redirecionamento opcional)
- Acessibilidade (teclado, foco, aria-labels)

**Eventos de analytics (exemplos)**
- `view_page_empresa_plano`
- `click_primary_cta`
- `apply_filters`
- `submit_form_success (quando aplicável)`
- `submit_form_error (quando aplicável)`

**Wireframe (ASCII)**

```
+--------------------------------------------------------------+
| Plano e Faturação (/empresa/plano)                           |
+----------------------+---------------------------------------+
| NAV / SIDEBAR        | MAIN                                  |
| - Links              | Plano atual                           |
|                      | Histórico                             |
|                      | Método de pagamento                   |
|                      | Faturas                               |
|                      | Upgrade                               |
|                      | ...                                   |
+----------------------+---------------------------------------+
| FOOTER: links, contacto, termos, redes                        |
+--------------------------------------------------------------+
```
### Página: Equipa e Permissões
- **Rota:** `/empresa/equipa`
- **Acesso:** Empresa
- **Objetivo:** Convites, roles, auditoria de ações.
**Conteúdo/Blocos**
- Header + pesquisa
- Conteúdo principal
- Blocos informativos
- CTA
- FAQ/links

**Ações do utilizador**
- Pesquisar/filtrar
- Abrir detalhes
- Criar/editar (quando aplicável)
- Partilhar/guardar (quando aplicável)
- Contactar suporte (quando aplicável)

**Estados e UX**
- Loading (skeletons, spinners mínimos)
- Empty state (mensagem + CTA claro)
- Erro (mensagem humana + retry)
- Sucesso (toast + redirecionamento opcional)
- Acessibilidade (teclado, foco, aria-labels)

**Eventos de analytics (exemplos)**
- `view_page_empresa_equipa`
- `click_primary_cta`
- `apply_filters`
- `submit_form_success (quando aplicável)`
- `submit_form_error (quando aplicável)`

**Wireframe (ASCII)**

```
+--------------------------------------------------------------+
| Equipa e Permissões (/empresa/equipa)                        |
+----------------------+---------------------------------------+
| NAV / SIDEBAR        | MAIN                                  |
| - Links              | Header + pesquisa                     |
|                      | Conteúdo principal                    |
|                      | Blocos informativos                   |
|                      | CTA                                   |
|                      | FAQ/links                             |
|                      | ...                                   |
+----------------------+---------------------------------------+
| FOOTER: links, contacto, termos, redes                        |
+--------------------------------------------------------------+
```
### Página: Definições (Empresa)
- **Rota:** `/empresa/definicoes`
- **Acesso:** Empresa
- **Objetivo:** Segurança, integrações, webhooks (opcional).
**Conteúdo/Blocos**
- Header + pesquisa
- Conteúdo principal
- Blocos informativos
- CTA
- FAQ/links

**Ações do utilizador**
- Pesquisar/filtrar
- Abrir detalhes
- Criar/editar (quando aplicável)
- Partilhar/guardar (quando aplicável)
- Contactar suporte (quando aplicável)

**Estados e UX**
- Loading (skeletons, spinners mínimos)
- Empty state (mensagem + CTA claro)
- Erro (mensagem humana + retry)
- Sucesso (toast + redirecionamento opcional)
- Acessibilidade (teclado, foco, aria-labels)

**Eventos de analytics (exemplos)**
- `view_page_empresa_definicoes`
- `click_primary_cta`
- `apply_filters`
- `submit_form_success (quando aplicável)`
- `submit_form_error (quando aplicável)`

**Wireframe (ASCII)**

```
+--------------------------------------------------------------+
| Definições (Empresa) (/empresa/definicoes)                   |
+----------------------+---------------------------------------+
| NAV / SIDEBAR        | MAIN                                  |
| - Links              | Header + pesquisa                     |
|                      | Conteúdo principal                    |
|                      | Blocos informativos                   |
|                      | CTA                                   |
|                      | FAQ/links                             |
|                      | ...                                   |
+----------------------+---------------------------------------+
| FOOTER: links, contacto, termos, redes                        |
+--------------------------------------------------------------+
```
### Página: Admin - Visão Geral
- **Rota:** `/admin`
- **Acesso:** Admin
- **Objetivo:** KPIs do sistema, saúde, moderação e suporte.
**Conteúdo/Blocos**
- Header + pesquisa
- Conteúdo principal
- Blocos informativos
- CTA
- FAQ/links

**Ações do utilizador**
- Pesquisar/filtrar
- Abrir detalhes
- Criar/editar (quando aplicável)
- Partilhar/guardar (quando aplicável)
- Contactar suporte (quando aplicável)

**Estados e UX**
- Loading (skeletons, spinners mínimos)
- Empty state (mensagem + CTA claro)
- Erro (mensagem humana + retry)
- Sucesso (toast + redirecionamento opcional)
- Acessibilidade (teclado, foco, aria-labels)

**Eventos de analytics (exemplos)**
- `view_page_admin`
- `click_primary_cta`
- `apply_filters`
- `submit_form_success (quando aplicável)`
- `submit_form_error (quando aplicável)`

**Wireframe (ASCII)**

```
+--------------------------------------------------------------+
| Admin - Visão Geral (/admin)                                 |
+----------------------+---------------------------------------+
| NAV / SIDEBAR        | MAIN                                  |
| - Links              | Header + pesquisa                     |
|                      | Conteúdo principal                    |
|                      | Blocos informativos                   |
|                      | CTA                                   |
|                      | FAQ/links                             |
|                      | ...                                   |
+----------------------+---------------------------------------+
| FOOTER: links, contacto, termos, redes                        |
+--------------------------------------------------------------+
```
### Página: Admin - Utilizadores
- **Rota:** `/admin/utilizadores`
- **Acesso:** Admin
- **Objetivo:** Gestão de contas, bloqueios e verificação.
**Conteúdo/Blocos**
- Header + pesquisa
- Conteúdo principal
- Blocos informativos
- CTA
- FAQ/links

**Ações do utilizador**
- Pesquisar/filtrar
- Abrir detalhes
- Criar/editar (quando aplicável)
- Partilhar/guardar (quando aplicável)
- Contactar suporte (quando aplicável)

**Estados e UX**
- Loading (skeletons, spinners mínimos)
- Empty state (mensagem + CTA claro)
- Erro (mensagem humana + retry)
- Sucesso (toast + redirecionamento opcional)
- Acessibilidade (teclado, foco, aria-labels)

**Eventos de analytics (exemplos)**
- `view_page_admin_utilizadores`
- `click_primary_cta`
- `apply_filters`
- `submit_form_success (quando aplicável)`
- `submit_form_error (quando aplicável)`

**Wireframe (ASCII)**

```
+--------------------------------------------------------------+
| Admin - Utilizadores (/admin/utilizadores)                   |
+----------------------+---------------------------------------+
| NAV / SIDEBAR        | MAIN                                  |
| - Links              | Header + pesquisa                     |
|                      | Conteúdo principal                    |
|                      | Blocos informativos                   |
|                      | CTA                                   |
|                      | FAQ/links                             |
|                      | ...                                   |
+----------------------+---------------------------------------+
| FOOTER: links, contacto, termos, redes                        |
+--------------------------------------------------------------+
```
### Página: Admin - Vagas
- **Rota:** `/admin/vagas`
- **Acesso:** Admin
- **Objetivo:** Moderação, relatórios, anti-fraude e qualidade.
**Conteúdo/Blocos**
- Filtros
- Tabela/lista
- Ações por linha
- Paginação
- Exportar (CSV opcional)

**Ações do utilizador**
- Pesquisar/filtrar
- Abrir detalhes
- Criar/editar (quando aplicável)
- Partilhar/guardar (quando aplicável)
- Contactar suporte (quando aplicável)

**Estados e UX**
- Loading (skeletons, spinners mínimos)
- Empty state (mensagem + CTA claro)
- Erro (mensagem humana + retry)
- Sucesso (toast + redirecionamento opcional)
- Acessibilidade (teclado, foco, aria-labels)

**Eventos de analytics (exemplos)**
- `view_page_admin_vagas`
- `click_primary_cta`
- `apply_filters`
- `submit_form_success (quando aplicável)`
- `submit_form_error (quando aplicável)`

**Wireframe (ASCII)**

```
+--------------------------------------------------------------+
| Admin - Vagas (/admin/vagas)                                 |
+----------------------+---------------------------------------+
| NAV / SIDEBAR        | MAIN                                  |
| - Links              | Filtros                               |
|                      | Tabela/lista                          |
|                      | Ações por linha                       |
|                      | Paginação                             |
|                      | Exportar (CSV opcional)               |
|                      | ...                                   |
+----------------------+---------------------------------------+
| FOOTER: links, contacto, termos, redes                        |
+--------------------------------------------------------------+
```
### Página: Admin - Pagamentos
- **Rota:** `/admin/pagamentos`
- **Acesso:** Admin
- **Objetivo:** Reembolsos, faturas e reconciliação.
**Conteúdo/Blocos**
- Plano atual
- Histórico
- Método de pagamento
- Faturas
- Upgrade

**Ações do utilizador**
- Pesquisar/filtrar
- Abrir detalhes
- Criar/editar (quando aplicável)
- Partilhar/guardar (quando aplicável)
- Contactar suporte (quando aplicável)

**Estados e UX**
- Loading (skeletons, spinners mínimos)
- Empty state (mensagem + CTA claro)
- Erro (mensagem humana + retry)
- Sucesso (toast + redirecionamento opcional)
- Acessibilidade (teclado, foco, aria-labels)

**Eventos de analytics (exemplos)**
- `view_page_admin_pagamentos`
- `click_primary_cta`
- `apply_filters`
- `submit_form_success (quando aplicável)`
- `submit_form_error (quando aplicável)`

**Wireframe (ASCII)**

```
+--------------------------------------------------------------+
| Admin - Pagamentos (/admin/pagamentos)                       |
+----------------------+---------------------------------------+
| NAV / SIDEBAR        | MAIN                                  |
| - Links              | Plano atual                           |
|                      | Histórico                             |
|                      | Método de pagamento                   |
|                      | Faturas                               |
|                      | Upgrade                               |
|                      | ...                                   |
+----------------------+---------------------------------------+
| FOOTER: links, contacto, termos, redes                        |
+--------------------------------------------------------------+
```
### Página: Admin - Conteúdos
- **Rota:** `/admin/conteudos`
- **Acesso:** Admin
- **Objetivo:** Gestão de blog/FAQ e banners.
**Conteúdo/Blocos**
- Header + pesquisa
- Conteúdo principal
- Blocos informativos
- CTA
- FAQ/links

**Ações do utilizador**
- Pesquisar/filtrar
- Abrir detalhes
- Criar/editar (quando aplicável)
- Partilhar/guardar (quando aplicável)
- Contactar suporte (quando aplicável)

**Estados e UX**
- Loading (skeletons, spinners mínimos)
- Empty state (mensagem + CTA claro)
- Erro (mensagem humana + retry)
- Sucesso (toast + redirecionamento opcional)
- Acessibilidade (teclado, foco, aria-labels)

**Eventos de analytics (exemplos)**
- `view_page_admin_conteudos`
- `click_primary_cta`
- `apply_filters`
- `submit_form_success (quando aplicável)`
- `submit_form_error (quando aplicável)`

**Wireframe (ASCII)**

```
+--------------------------------------------------------------+
| Admin - Conteúdos (/admin/conteudos)                         |
+----------------------+---------------------------------------+
| NAV / SIDEBAR        | MAIN                                  |
| - Links              | Header + pesquisa                     |
|                      | Conteúdo principal                    |
|                      | Blocos informativos                   |
|                      | CTA                                   |
|                      | FAQ/links                             |
|                      | ...                                   |
+----------------------+---------------------------------------+
| FOOTER: links, contacto, termos, redes                        |
+--------------------------------------------------------------+
```
### Página: Admin - Auditoria
- **Rota:** `/admin/auditoria`
- **Acesso:** Admin
- **Objetivo:** Logs de ações e trilhas de auditoria.
**Conteúdo/Blocos**
- Header + pesquisa
- Conteúdo principal
- Blocos informativos
- CTA
- FAQ/links

**Ações do utilizador**
- Pesquisar/filtrar
- Abrir detalhes
- Criar/editar (quando aplicável)
- Partilhar/guardar (quando aplicável)
- Contactar suporte (quando aplicável)

**Estados e UX**
- Loading (skeletons, spinners mínimos)
- Empty state (mensagem + CTA claro)
- Erro (mensagem humana + retry)
- Sucesso (toast + redirecionamento opcional)
- Acessibilidade (teclado, foco, aria-labels)

**Eventos de analytics (exemplos)**
- `view_page_admin_auditoria`
- `click_primary_cta`
- `apply_filters`
- `submit_form_success (quando aplicável)`
- `submit_form_error (quando aplicável)`

**Wireframe (ASCII)**

```
+--------------------------------------------------------------+
| Admin - Auditoria (/admin/auditoria)                         |
+----------------------+---------------------------------------+
| NAV / SIDEBAR        | MAIN                                  |
| - Links              | Header + pesquisa                     |
|                      | Conteúdo principal                    |
|                      | Blocos informativos                   |
|                      | CTA                                   |
|                      | FAQ/links                             |
|                      | ...                                   |
+----------------------+---------------------------------------+
| FOOTER: links, contacto, termos, redes                        |
+--------------------------------------------------------------+
```
## 5. Wireframes e layout + Design System
### 5.1 Layout global (desktop)
- **Header**: logo, pesquisa, links principais, botão login/registo ou menu do utilizador.
- **Sidebar (áreas autenticadas)**: navegação do perfil, atalhos e estado do plano.
- **Main**: conteúdo (cards, tabelas, listas).
- **Footer**: termos, privacidade, contactos, redes.

### 5.2 Layout global (mobile)
- Header compacto com pesquisa (ícone).
- Navegação por **bottom bar** (quando autenticado) ou menu hamburger (público).
- Conteúdo em coluna única com cards e ações grandes.

### 5.3 Design system (resumo)
- Tipografia: 1 família principal + 1 para títulos (opcional).
- Escala de espaçamento: 4, 8, 12, 16, 24, 32.
- Componentes: Button, Input, Select, Modal, Drawer, Tabs, Toast, Badge, Card, Table, Pagination.
- Estados: hover/focus/disabled/loading.
- Acessibilidade: foco visível, contraste adequado, labels e aria.

### 5.4 Padrões de UI
- Evitar páginas “pesadas”: carregar incrementalmente (infinite scroll com cuidado).
- Usar skeletons em listas.
- Confirmar ações destrutivas (fechar vaga, eliminar documento).

## 6. Funcionalidades
### 6.1 Core
- Autenticação (email+password) + recuperação.
- Perfis (candidato/empresa) com onboarding.
- Publicação de vagas + gestão (editar/fechar/duplicar).
- Candidatura com tracking de estados.
- Mensagens empresa↔candidato (inbox).
- Upload de documentos (CV, certificados).
- CV Builder com exportação PDF.

### 6.2 Complementares (moderadas, para deixar completo)
- Alertas de vagas (email/push).
- Vagas recomendadas (matching simples com skills/localização).
- “Destacar vaga” (premium) com etiqueta e prioridade na lista.
- Templates de mensagens e respostas rápidas.
- Verificação de empresa (badge) mediante prova/validação.
- Serviços “Recursos” (repatriação, residência, escolas, vistos, onboarding local).
- Blog/FAQ para SEO e redução de suporte repetitivo.

### 6.3 Anti-spam e qualidade
- Rate limit em formulários.
- Captcha (apenas quando necessário, adaptativo).
- Moderação automática básica: palavras proibidas + revisão manual em casos suspeitos.

## 7. Arquitetura recomendada (rápida, escalável e segura)
### 7.1 Visão macro
Recomendação: **Monorepo** (para produtividade) com separação clara:
- `apps/web` (Next.js)
- `apps/api` (Node.js - Fastify ou NestJS)
- `packages/ui` (componentes partilhados)
- `packages/shared` (tipos, validações, utils)
- `infra/` (Docker, compose, k8s opcional)

### 7.2 Porquê esta arquitetura?
- Reduz duplicação (tipos e contratos partilhados).
- Acelera desenvolvimento (DX).
- Permite escalar API e web separadamente em produção.

### 7.3 Componentes
- **Web**: Next.js (SSR/SSG onde faz sentido), React Query / TanStack Query, Zod para validação.
- **API**: Node.js + Fastify/NestJS, validação (Zod/Joi), OpenAPI.
- **DB**: MongoDB (documentos) + índices; opcional: PostgreSQL se precisares forte consistência relacional.
- **Cache/Queue**: Redis (cache, sessões, filas BullMQ).
- **Storage**: S3 compatível / Firebase Storage (com regras e URLs assinadas).
- **Search (opcional)**: Meilisearch/Algolia; alternativa simples: Mongo text indexes + filtros.
- **Observability**: OpenTelemetry + logs estruturados + métricas.
- **CDN**: para assets e imagens.

### 7.4 Diagrama (alto nível)

```mermaid
graph TD
  U[Utilizador] --> W[Web (Next.js)]
  W -->|HTTPS| A[API (Node/Fastify)]
  A --> M[(MongoDB)]
  A --> R[(Redis)]
  A --> S[(Storage: S3/Firebase)]
  A --> Q[Workers/Jobs]
  Q --> R
  Q --> M
  W --> CDN[CDN/Images]
```
## 8. Frontend (Next.js/React): rotas, componentes e padrões
### 8.1 Estrutura (exemplo)
- `src/app` (rotas)
- `src/components` (UI)
- `src/features` (domínios: vagas, candidaturas, perfil)
- `src/lib` (api client, auth, config)
- `src/styles` (tokens)

### 8.2 Padrões recomendados
- Server Components (quando útil) + Client Components para interações.
- Data fetching com caching (Next) e/ou TanStack Query.
- Formularios com React Hook Form + Zod.
- “Design system” consistente (shadcn/ui ou UI própria).

### 8.3 Boas práticas
- Code splitting por rota.
- Otimização de imagens (next/image).
- Evitar estados globais desnecessários (preferir cache de query).
- A11y: foco, aria, labels.

## 9. Backend (Node.js): módulos, APIs, validação e jobs
### 9.1 Módulos (domínios)
- Auth (login, refresh, recuperação)
- Users (candidato/empresa/admin)
- Jobs/Vagas
- Applications/Candidaturas
- Messaging
- Payments/Plans
- Resources/Serviços
- Admin/Moderation
- Audit Logs
- Notifications (email/push)
- Files/Uploads

### 9.2 Padrões na API
- REST bem definido ou REST + RPC interno.
- DTOs/Validações em todas as entradas.
- Erros consistentes:
  - 400 validação
  - 401 auth
  - 403 permissão
  - 404 não encontrado
  - 409 conflito
  - 429 rate limit
  - 500 erro interno

### 9.3 Jobs
- Envio de e-mails (confirmação, alerta, recuperação).
- Processamento de PDFs (geração CV).
- Limpeza de tokens e sessões antigas.
- Indexação e cache warm-up.

### 9.4 Exemplo de rotas (resumo)
- `POST /auth/login`
- `POST /auth/register`
- `POST /auth/forgot-password`
- `GET /jobs`
- `POST /jobs`
- `POST /jobs/:id/apply`
- `GET /applications`
- `POST /messages`

## 10. Modelo de dados (MongoDB) + índices + ERD
### 10.1 Coleções principais
- `users`
- `companies`
- `jobs`
- `applications`
- `messages`
- `plans`
- `subscriptions`
- `payments`
- `resources_requests`
- `audit_logs`
- `files`

### 10.2 Índices essenciais
- `jobs`: `{ status, createdAt }`, `{ companyId }`, `{ location }`, `{ tags }`
- `applications`: `{ jobId, createdAt }`, `{ candidateId, createdAt }`, `{ status }`
- `messages`: `{ threadId, createdAt }`
- `users`: `{ email }` único, `{ role }`

### 10.3 ERD (simplificado)

```mermaid
erDiagram
  USER ||--o{ APPLICATION : submits
  COMPANY ||--o{ JOB : posts
  JOB ||--o{ APPLICATION : receives
  APPLICATION ||--o{ MESSAGE_THREAD : discusses
  MESSAGE_THREAD ||--o{ MESSAGE : contains
  USER ||--o{ FILE : uploads
  COMPANY ||--o{ SUBSCRIPTION : has
  SUBSCRIPTION ||--o{ PAYMENT : records
```
## 11. Fluxos principais e estados
### 11.1 Estados de candidatura (exemplo)
- `SUBMETIDA`
- `EM_ANALISE`
- `CURTA_LISTA`
- `ENTREVISTA`
- `PROPOSTA`
- `REJEITADA`
- `CONTRATADA`
- `CANCELADA_PELO_CANDIDATO`

### 11.2 Sequência: candidatura

```mermaid
sequenceDiagram
  participant C as Candidato
  participant W as Web
  participant A as API
  participant DB as MongoDB
  C->>W: Clica "Candidatar"
  W->>A: POST /jobs/:id/apply (token)
  A->>DB: cria Application
  DB-->>A: ok
  A-->>W: 201 Created + estado SUBMETIDA
  W-->>C: Confirmação + tracking
```
## 12. Segurança, privacidade e compliance
- Passwords: hash com Argon2 ou bcrypt (custo adequado).
- JWT curto + refresh token rotativo (opcional).
- Proteções:
  - Rate limiting (login, recuperação, submissões)
  - Validação e sanitização
  - CORS restrito
  - Headers de segurança (Helmet)
- Uploads: validação de tipo/tamanho, URLs assinadas, antivírus (opcional).
- Privacidade: consentimentos, retenção de dados e exportação.
- Auditoria: ações críticas (login falhado, alteração de plano, moderação).

**Nota:** se trabalhares com dados sensíveis (documentos), reforçar encriptação e acesso (least privilege).

## 13. Performance, caching e otimizações
- Paginação em tudo o que lista.
- Cache em endpoints públicos (vagas) via Redis + TTL.
- CDN para imagens e assets.
- Estratégia de query:
  - Projeções (não enviar campos desnecessários)
  - Índices corretos
  - Evitar N+1 (agregar quando necessário)
- Frontend:
  - Lazy load de secções
  - Prefetch de rotas
  - Imagens responsivas
- Workers:
  - Tarefas pesadas fora do request/response

## 14. Observabilidade
- Logs estruturados (JSON) com correlação por requestId.
- Métricas: latência, erros, throughput, filas.
- Tracing: OpenTelemetry.
- Alertas: erros 5xx, aumento de latência, falhas em jobs.

## 15. Testes e qualidade
- Unit tests: serviços e utilitários.
- Integração: endpoints (supertest).
- E2E: Playwright/Cypress.
- Contratos: OpenAPI + testes de schema.
- Linters/format: ESLint + Prettier.
- Commits: Conventional Commits.

## 16. CI/CD e ambientes
- Ambientes: `dev`, `staging`, `prod`.
- Pipeline:
  - lint → test → build → security scan → deploy
- Deploy:
  - Web: Vercel/Cloud Run/Nginx
  - API: containers (Docker) + autoscaling
  - DB: managed (Atlas) recomendado
- Migrações:
  - Mongo: scripts versionados e reversíveis quando possível

## 17. Convenções e melhores práticas
- Clean Architecture (leve): controllers → use-cases → repositories.
- Separar domínio de infraestrutura.
- Validar tudo na fronteira (API).
- Nunca confiar no cliente.
- Erros padronizados.
- Código com tipos (TypeScript).
- Documentar contratos e decisões (ADR).

## 18. Roadmap e backlog (controlado)
### MVP (curto prazo)
- Auth + perfis
- Vagas + candidaturas
- Mensagens
- CV Builder + PDF
- Backoffice mínimo

### V1
- Pagamentos + planos
- Alertas
- Recursos/serviços com tracking

### V2 (opcional)
- Search dedicado
- Matching melhorado
- Integrações (webhooks, calendários)

## 19. Anexos
### 19.1 Documentação base (importada e preservada)
> Conteúdo original incluído para não perder detalhes anteriores.

# 📚 DOCUMENTAÇÃO COMPLETA - EmpregoSTP

## Plataforma de Vagas de Emprego em São Tomé e Príncipe

**Versão:** 1.0.0  
**Autor:** Edmir dos Santos  
**Data:** Janeiro 2026

---

## 📋 ÍNDICE

1. [Visão Geral](#1-visão-geral)
2. [Tecnologias Utilizadas](#2-tecnologias-utilizadas)
3. [Estrutura do Projeto](#3-estrutura-do-projeto)
4. [Configuração do Ambiente](#4-configuração-do-ambiente)
5. [Banco de Dados (Firebase Firestore)](#5-banco-de-dados-firebase-firestore)
6. [Sistema de Autenticação](#6-sistema-de-autenticação)
7. [Tipos de Usuários e Permissões](#7-tipos-de-usuários-e-permissões)
8. [Sistema de Planos](#8-sistema-de-planos)
9. [APIs do Sistema](#9-apis-do-sistema)
10. [Funcionalidades por Módulo](#10-funcionalidades-por-módulo)
11. [Credenciais e Configurações](#11-credenciais-e-configurações)
12. [Deploy e Produção](#12-deploy-e-produção)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. VISÃO GERAL

### O que é o EmpregoSTP?

EmpregoSTP é uma plataforma completa de recrutamento desenvolvida especificamente para São Tomé e Príncipe. Conecta candidatos a oportunidades de emprego e permite que empresas publiquem vagas e gerenciem candidaturas.

### Principais Funcionalidades

- **Para Candidatos:**
  - Criar perfil profissional completo
  - Buscar e filtrar vagas por categoria, localização, tipo de contrato
  - Candidatar-se a vagas com um clique
  - Salvar vagas favoritas (planos PRO)
  - Ver estatísticas de visualização do perfil (planos PRO)
  - Verificação de perfil (selo de verificado)
  - Upload de CV e certificados
  - Acesso a mentoria e recursos de carreira
  - Chat com IA (Gemini) para orientação

- **Para Empresas:**
  - Publicar e gerenciar vagas
  - Visualizar candidaturas recebidas
  - Buscar candidatos qualificados
  - Destacar vagas (planos PRO)
  - Analytics de vagas
  - Contatar candidatos diretamente

- **Para Administradores:**
  - Dashboard completo de gestão
  - Gerenciar usuários (candidatos e empresas)
  - Aprovar/rejeitar vagas
  - Gerenciar planos e assinaturas
  - Códigos de ativação para planos premium
  - Relatórios e analytics
  - Gerenciar notícias e recursos
  - Sistema de notificações

---

## 2. TECNOLOGIAS UTILIZADAS

### Frontend
| Tecnologia | Versão | Descrição |
|------------|--------|-----------|
| Next.js | 16.2.0-canary.21 | Framework React com SSR/SSG |
| React | 19.1.0 | Biblioteca UI |
| React Icons | 5.5.0 | Ícones |
| CSS Modules | - | Estilos isolados |

### Backend
| Tecnologia | Versão | Descrição |
|------------|--------|-----------|
| Firebase | 11.10.0 | Auth, Firestore, Storage |
| Firebase Admin | 13.4.0 | SDK servidor |
| Next.js API Routes | - | APIs serverless |

### Integrações
| Serviço | Uso |
|---------|-----|
| Google Gemini AI | Chat de mentoria com IA |
| Firebase Authentication | Login/registro |
| Firebase Firestore | Banco de dados |
| Firebase Storage | Upload de arquivos |
| Vercel | Hospedagem |

---

## 3. ESTRUTURA DO PROJETO

```
empregostp/
├── components/                 # Componentes React
│   ├── admin/                 # Componentes do admin
│   │   ├── ConfirmModal.js
│   │   ├── ExportButton.js
│   │   ├── FilterBar.js
│   │   └── Pagination.js
│   ├── ads/                   # Sistema de anúncios
│   ├── candidates/            # Cards de candidatos
│   ├── companies/             # Cards de empresas
│   ├── home/                  # Componentes da homepage
│   │   ├── FAQ.js
│   │   ├── Footer.js
│   │   ├── JobList.js
│   │   ├── PartnersSection.js
│   │   ├── StatsSection.js
│   │   ├── Testimonials.js
│   │   └── TopCandidates.js
│   ├── recursos/              # Componentes de recursos
│   ├── ui/                    # Componentes UI reutilizáveis
│   ├── JobCard.js             # Card de vaga
│   ├── LandingHeader.js       # Header principal
│   ├── CandidateSidebar.js    # Menu lateral candidato
│   └── ...
│
├── context/
│   └── AuthContext.js         # Context de autenticação
│
├── lib/                       # Bibliotecas e utilitários
│   ├── firebase.js            # Config Firebase Client
│   ├── firebaseAdmin.js       # Config Firebase Admin
│   ├── enums.js               # Enumerações do sistema
│   ├── candidatePlanFeatures.js # Recursos planos candidato
│   ├── companyPlanFeatures.js # Recursos planos empresa
│   ├── businessRules.js       # Regras de negócio
│   ├── errorHandler.js        # Tratamento de erros
│   ├── notifications.js       # Sistema de notificações
│   ├── stateMachines.js       # Máquinas de estado
│   ├── profileValidation.js   # Validação de perfil
│   └── ...
│
├── pages/                     # Páginas Next.js
│   ├── api/                   # API Routes (66 endpoints)
│   │   ├── admin/             # APIs administrativas
│   │   ├── applications/      # APIs de candidaturas
│   │   ├── auth/              # APIs de autenticação
│   │   ├── candidate/         # APIs do candidato
│   │   ├── candidates/        # APIs de listagem
│   │   ├── companies/         # APIs de empresas
│   │   ├── jobs/              # APIs de vagas
│   │   ├── gemini/            # APIs do chat IA
│   │   └── ...
│   ├── dashboard/
│   │   ├── admin/             # Dashboard administrativo
│   │   ├── candidato/         # Dashboard do candidato
│   │   └── empresa/           # Dashboard da empresa
│   ├── vagas/                 # Listagem de vagas
│   ├── candidatos/            # Listagem de candidatos
│   ├── empresas/              # Listagem de empresas
│   ├── premium/               # Páginas de planos
│   ├── recursos/              # Recursos e guias
│   └── ...
│
├── public/                    # Arquivos estáticos
│   └── assets/               # Imagens e logos
│
├── styles/                    # Estilos globais
│   ├── globals.css
│   ├── improvements.css
│   └── ...
│
├── tests/                     # Testes automatizados
│   ├── unit/
│   └── integration/
│
├── scripts/                   # Scripts utilitários
│   ├── createAdmin.mjs
│   └── ...
│
├── firestore.rules           # Regras de segurança Firestore
├── storage.rules             # Regras do Storage
├── firebase.json             # Config Firebase
└── package.json
```

---

## 4. CONFIGURAÇÃO DO AMBIENTE

### Pré-requisitos

- Node.js 18+ 
- NPM ou Yarn
- Conta Firebase
- Conta Vercel (para deploy)

### Passo a Passo

#### 1. Clonar o repositório
```bash
git clone https://github.com/seu-usuario/empregostp.git
cd empregostp
```

#### 2. Instalar dependências
```bash
npm install
```

#### 3. Criar arquivo `.env.local`

```env
# ================================
# FIREBASE CLIENT (Frontend)
# ================================
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCeexPh-jaUffQosOgfR8FIYuwQSO6Zt0A
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=empregostp.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=empregostp
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=empregostp.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1003664770533
NEXT_PUBLIC_FIREBASE_APP_ID=1:1003664770533:web:38bccc1147f4948fff5b0c
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-C1BJJJS1DB

# ================================
# FIREBASE ADMIN (Backend/Server)
# ================================
FIREBASE_PROJECT_ID=empregostp
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@empregostp.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...sua_chave_privada...\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_BUCKET=empregostp.firebasestorage.app

# ================================
# GOOGLE GEMINI AI (Chat IA)
# ================================
GEMINI_API_KEY=sua_chave_api_gemini
```

#### 4. Obter credenciais Firebase Admin

1. Acesse [Firebase Console](https://console.firebase.google.com)
2. Selecione o projeto "empregostp"
3. Vá em **Configurações do Projeto** > **Contas de Serviço**
4. Clique em **Gerar nova chave privada**
5. Baixe o arquivo JSON
6. Copie os valores para o `.env.local`:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (manter as quebras de linha `\n`)

#### 5. Executar em desenvolvimento
```bash
npm run dev
```

Acesse: `http://localhost:3000`

---

## 5. BANCO DE DADOS (FIREBASE FIRESTORE)

### Coleções Principais

#### `users` - Usuários do sistema
```javascript
{
  id: "uid_do_firebase",
  email: "usuario@email.com",
  fullName: "Nome Completo",
  userType: "candidato" | "empresa" | "admin",
  
  // Campos comuns
  photoUrl: "url_da_foto",
  phone: "+239 999 9999",
  createdAt: Timestamp,
  updatedAt: Timestamp,
  
  // Plano
  currentPlan: "basic_candidato" | "professional_candidato" | "unlimited_candidato",
  planId: "id_do_plano",
  planName: "Nome do Plano",
  planStartDate: Timestamp,
  planEndDate: Timestamp | null,
  
  // Verificação
  verified: boolean,
  verificationExpiresAt: Timestamp,
  
  // Candidato específico
  skills: ["skill1", "skill2"],
  experience: "5 anos",
  education: "Licenciatura",
  cvUrl: "url_do_cv",
  location: "São Tomé",
  bio: "Resumo profissional",
  linkedIn: "url",
  portfolio: "url",
  curriculoDestacado: boolean,
  
  // Empresa específico
  companyName: "Nome da Empresa",
  nif: "123456789",
  logoUrl: "url_do_logo",
  coverImageUrl: "url_da_capa",
  website: "www.empresa.com",
  sector: "Tecnologia",
  size: "10-50 funcionários",
  description: "Sobre a empresa",
  address: "Endereço"
}
```

#### `jobs` - Vagas de emprego
```javascript
{
  id: "job_id",
  titulo: "Título da Vaga",
  descricao: "Descrição completa",
  requisitos: "Requisitos",
  localizacao: "São Tomé",
  tipoContrato: "Tempo Integral" | "Meio Período" | "Estágio" | ...,
  salarioDe: 5000,
  salarioAte: 10000,
  remoto: boolean,
  
  // Empresa
  companyId: "uid_da_empresa",
  empresaNome: "Nome da Empresa (denormalizado)",
  empresaLogo: "url_do_logo (denormalizado)",
  empresaCoverImage: "url_da_capa",
  
  // Status
  status: "draft" | "active" | "paused" | "closed" | "disabled",
  destaque: boolean, // Vaga em destaque
  
  // Datas
  createdAt: Timestamp,
  updatedAt: Timestamp,
  publicadoEm: Timestamp,
  dataAbertura: Timestamp,
  dataFecho: Timestamp,
  
  // Métricas
  views: number,
  applicationCount: number,
  
  // Campos TDR (Termos de Referência)
  referencia: "REF-001",
  pontosChave: ["ponto1", "ponto2"],
  coverImageUrl: "url_imagem_vaga",
  documentoUrl: "url_documento_tdr",
  documentoNome: "nome_arquivo.pdf",
  
  // Soft delete
  deletedAt: Timestamp | null
}
```

#### `applications` - Candidaturas
```javascript
{
  id: "application_id",
  jobId: "id_da_vaga",
  candidateId: "uid_do_candidato",
  companyId: "uid_da_empresa",
  
  // Status
  status: "pending" | "reviewing" | "shortlisted" | "interviewed" | "accepted" | "rejected" | "withdrawn",
  
  // Dados do candidato (snapshot)
  candidateName: "Nome",
  candidateEmail: "email@email.com",
  candidatePhone: "telefone",
  candidateCvUrl: "url_cv",
  
  // Dados da vaga (snapshot)
  jobTitle: "Título da Vaga",
  companyName: "Nome da Empresa",
  
  // Notas
  coverLetter: "Carta de apresentação",
  notes: "Notas do recrutador",
  
  // Avaliação
  rating: 1-5,
  
  // Datas
  createdAt: Timestamp,
  updatedAt: Timestamp,
  
  // Soft delete
  deletedAt: Timestamp | null
}
```

#### `notifications` - Notificações
```javascript
{
  id: "notification_id",
  userId: "uid_destinatario",
  type: "application" | "SUBSCRIPTION_REQUEST" | "PLAN_ACTIVATED" | ...,
  title: "Título",
  message: "Mensagem",
  data: { /* dados extras */ },
  read: boolean,
  readAt: Timestamp,
  createdAt: Timestamp
}
```

#### `subscription-requests` - Solicitações de assinatura
```javascript
{
  id: "request_id",
  userId: "uid_do_usuario",
  userEmail: "email",
  userName: "nome",
  userType: "candidato" | "empresa",
  
  currentPlan: "plano_atual",
  requestedPlan: "plano_solicitado",
  
  status: "pending" | "approved" | "rejected",
  
  // Comprovante de pagamento
  paymentProofUrl: "url_comprovante",
  paymentMethod: "Transferência",
  paymentDate: Timestamp,
  
  // Admin
  adminNotes: "Notas do admin",
  processedBy: "uid_admin",
  processedAt: Timestamp,
  
  createdAt: Timestamp
}
```

#### `activation-codes` - Códigos de ativação
```javascript
{
  code: "CODIGO123",
  planId: "professional_candidato",
  userType: "candidato" | "empresa",
  duration: 30, // dias
  
  status: "active" | "used" | "expired",
  usedBy: "uid_usuario",
  usedAt: Timestamp,
  
  createdAt: Timestamp,
  expiresAt: Timestamp
}
```

#### `savedJobs` - Vagas salvas
```javascript
{
  id: "candidateId_jobId",
  candidateId: "uid_candidato",
  jobId: "id_vaga",
  createdAt: Timestamp
}
```

#### `profileViews` - Visualizações de perfil
```javascript
{
  id: "view_id",
  candidateId: "uid_candidato",
  viewerId: "uid_visualizador",
  viewerType: "empresa" | "candidato",
  viewerName: "Nome",
  viewerCompany: "Empresa",
  createdAt: Timestamp
}
```

#### `jobViews` - Visualizações de vagas
```javascript
{
  id: "view_id",
  jobId: "id_vaga",
  viewerId: "uid_ou_ip",
  createdAt: Timestamp
}
```

#### `plans` - Planos disponíveis
```javascript
{
  id: "professional_candidato",
  name: "Profissional",
  type: "candidato" | "empresa",
  price: 500,
  duration: 30, // dias
  features: ["feature1", "feature2"],
  active: boolean
}
```

#### `geminiConversations` - Conversas com IA
```javascript

```

#### `noticias` - Notícias/Blog
```javascript
{
  id: "noticia_id",
  title: "Título",
  slug: "titulo-slug",
  content: "Conteúdo HTML",
  excerpt: "Resumo",
  coverImage: "url_imagem",
  category: "carreira" | "dicas" | "mercado",
  author: "Nome do Autor",
  published: boolean,
  views: number,
  createdAt: Timestamp,
  publishedAt: Timestamp
}
```

---

## 6. SISTEMA DE AUTENTICAÇÃO

### Fluxo de Autenticação

```
1. Usuário acessa /login ou /register
2. Firebase Authentication valida credenciais
3. AuthContext detecta mudança de estado
4. API /api/profile busca dados do usuário
5. Profile é armazenado no contexto
6. Redirecionamento baseado em userType
```

### Context de Autenticação (`AuthContext.js`)

```javascript
// Valores disponíveis no contexto
{
  user: FirebaseUser | null,      // Usuário do Firebase
  profile: UserProfile | null,    // Dados do perfil no Firestore
  loading: boolean,               // Estado de carregamento
  refreshProfile: () => void      // Função para recarregar perfil
}

// Uso em componentes
import { useAuth } from '../context/AuthContext';

function MeuComponente() {
  const { user, profile, loading } = useAuth();
  
  if (loading) return <Loading />;
  if (!user) return <Redirect to="/login" />;
  
  return <div>Olá, {profile?.fullName}</div>;
}
```

### Proteção de Rotas

As rotas são protegidas de duas formas:

1. **Client-side:** Verificação no componente
2. **Server-side:** Verificação na API

```javascript
// API - Verificação de autenticação
export default async function handler(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;
    
    // Verificar se é admin
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    if (userDoc.data()?.userType !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    // Continuar...
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}
```

---

## 7. TIPOS DE USUÁRIOS E PERMISSÕES

### Candidato (`userType: 'candidato'`)

| Ação | Basic | Professional | Premium |
|------|-------|--------------|---------|
| Criar perfil | ✅ | ✅ | ✅ |
| Buscar vagas | ✅ | ✅ | ✅ |
| Candidatar-se | 3/mês | 20/mês | ∞ |
| Salvar vagas | ❌ | 50 | ∞ |
| Ver estatísticas | ❌ | ❌ | ✅ |
| Perfil destacado | ❌ | ✅ | ✅ |
| Ver quem visualizou | ❌ | ❌ | ✅ |
| Vagas em destaque | ❌ | ✅ | ✅ |
| Verificar perfil | ❌ | ✅ | ✅ |
| Upload certificados | ❌ | 5 | ∞ |
| Mentoria | ❌ | ✅ | ✅ |

### Empresa (`userType: 'empresa'`)

| Ação | Basic | Professional | Unlimited |
|------|-------|--------------|-----------|
| Criar vagas | 1/mês | 5/mês | ∞ |
| Destacar vagas | ❌ | ✅ | ✅ |
| Ver candidaturas | ✅ | ✅ | ✅ |
| Analytics | ❌ | ✅ | ✅ |
| Exportar dados | ❌ | ✅ | ✅ |
| Salvar candidatos | 10 | 50 | ∞ |
| Prioridade busca | ❌ | ✅ | ✅ |

### Admin (`userType: 'admin'`)

- Acesso total ao sistema
- Gerenciar todos os usuários
- Aprovar/rejeitar vagas
- Gerenciar planos e assinaturas
- Gerar códigos de ativação
- Ver relatórios e analytics
- Publicar notícias

---

## 8. SISTEMA DE PLANOS

### Planos de Candidato

| Plano | ID | Preço | Duração |
|-------|------|-------|---------|
| Básico | `basic_candidato` | Grátis | Permanente |
| Profissional | `professional_candidato` | 500 Db | 30 dias |
| Premium | `unlimited_candidato` | 2000 Db | 30 dias |

### Planos de Empresa

| Plano | ID | Preço | Duração |
|-------|------|-------|---------|
| Básico | `basic_empresa` | Grátis | Permanente |
| Profissional | `professional_empresa` | 1000 Db | 30 dias |
| Ilimitado | `unlimited_empresa` | 5000 Db | 30 dias |

### Fluxo de Upgrade

```
1. Usuário solicita upgrade em /premium/candidatos ou /premium/empresa
2. Envia comprovante de pagamento
3. Cria subscription-request com status "pending"
4. Admin aprova/rejeita em /dashboard/admin/subscription-requests
5. Se aprovado:
   - Atualiza currentPlan do usuário
   - Define planEndDate
   - Envia notificação
```

### Códigos de Ativação

Admins podem gerar códigos para ativar planos:

```javascript
// Criar código
POST /api/admin/activation-codes
{
  planId: "professional_candidato",
  duration: 30, // dias
  quantity: 10  // quantos códigos gerar
}

// Ativar código
POST /api/admin/activation-codes/activate
{
  code: "ABC123XYZ"
}
```

---

## 9. APIS DO SISTEMA

### Autenticação

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/auth/register` | Registrar novo usuário |
| GET | `/api/profile` | Obter perfil do usuário |
| PUT | `/api/profile/update` | Atualizar perfil |

### Vagas

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/jobs/active` | Listar vagas ativas |
| POST | `/api/jobs/create` | Criar nova vaga |
| GET | `/api/candidates` | Listar candidatos |
| GET | `/api/candidates/[id]` | Detalhes do candidato |

### Candidaturas

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/applications` | Listar candidaturas |
| POST | `/api/applications` | Criar candidatura |
| POST | `/api/applications/[id]/withdraw` | Retirar candidatura |

### Admin

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/admin/users` | Listar usuários |
| PUT | `/api/admin/users/[id]` | Atualizar usuário |
| GET | `/api/admin/jobs` | Listar vagas (admin) |
| PUT | `/api/admin/jobs/[id]` | Atualizar vaga |
| POST | `/api/admin/jobs/create` | Criar vaga (admin) |
| GET | `/api/admin/subscription-requests` | Listar solicitações |
| PUT | `/api/admin/subscription-requests/[id]` | Aprovar/rejeitar |
| POST | `/api/admin/activation-codes` | Criar códigos |
| GET | `/api/admin/analytics` | Obter analytics |

### Outros

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/upload` | Upload de arquivos |
| POST | `/api/saved-jobs` | Salvar/remover vaga |
| POST | `/api/track-view` | Registrar visualização |
| POST | `/api/gemini/chat` | Chat com IA |
| GET | `/api/notifications` | Listar notificações |

---

## 10. FUNCIONALIDADES POR MÓDULO

### Homepage (`/`)

- Hero section com busca
- Vagas em destaque
- Categorias populares
- Empresas parceiras
- FAQs
- Candidatos em destaque
- Testemunhos
- Como funciona

### Dashboard Candidato (`/dashboard/candidato`)

| Página | Rota | Funcionalidade |
|--------|------|----------------|
| Principal | `/dashboard/candidato` | Visão geral, estatísticas |
| Perfil | `/dashboard/candidato/profile` | Editar perfil |
| Candidaturas | `/dashboard/candidato/candidaturas` | Ver candidaturas |
| CV Builder | `/dashboard/candidato/cv-builder` | Criar currículo |
| Mentoria | `/dashboard/candidato/mentoria` | Agendar mentoria |
| Estatísticas | `/dashboard/candidato/stats` | Analytics (PRO) |
| Quem viu | `/dashboard/candidato/profile-views` | Visualizações (PRO) |
| Verificação | `/dashboard/candidato/verificacao` | Solicitar selo |
| Relocation | `/dashboard/candidato/relocation` | Guia de mudança |
| Recursos | `/dashboard/candidato/recursos` | Materiais de apoio |
| Gemini | `/dashboard/candidato/gemini-mentor` | Chat IA |

### Dashboard Empresa (`/dashboard/empresa`)

| Página | Rota | Funcionalidade |
|--------|------|----------------|
| Principal | `/dashboard/empresa` | Visão geral |
| Perfil | `/dashboard/empresa/profile` | Editar perfil |
| Criar Vaga | `/dashboard/empresa/vaga/criar-vaga` | Publicar vaga |
| Ver Vaga | `/dashboard/empresa/vaga/[id]` | Detalhes e candidaturas |
| Candidato | `/dashboard/empresa/candidato/[id]` | Ver candidato |

### Dashboard Admin (`/dashboard/admin`)

| Página | Rota | Funcionalidade |
|--------|------|----------------|
| Principal | `/dashboard/admin` | Métricas gerais |
| Usuários | `/dashboard/admin/users` | Gerenciar usuários |
| Vagas | `/dashboard/admin/jobs` | Gerenciar vagas |
| Criar Vaga | `/dashboard/admin/jobs/create` | Criar como admin |
| Candidaturas | `/dashboard/admin/applications` | Ver candidaturas |
| Assinaturas | `/dashboard/admin/subscription-requests` | Aprovar planos |
| Códigos | `/dashboard/admin/activation-codes` | Gerar códigos |
| Planos | `/dashboard/admin/plans` | Configurar planos |
| Notícias | `/dashboard/admin/noticias` | Publicar notícias |
| Analytics | `/dashboard/admin/analytics` | Relatórios |
| Atividades | `/dashboard/admin/activities` | Log de ações |
| Notificações | `/dashboard/admin/notifications` | Enviar notificações |
| Recursos | `/dashboard/admin/resources` | Gerenciar recursos |
| Serviços | `/dashboard/admin/services` | Gerenciar serviços |
| Pagamentos | `/dashboard/admin/payment-settings` | Config pagamentos |

---

## 11. CREDENCIAIS E CONFIGURAÇÕES

### ⚠️ IMPORTANTE: Segurança

**NUNCA** compartilhe as credenciais em repositórios públicos!

### Firebase Console

- **URL:** https://console.firebase.google.com
- **Projeto:** empregostp
- **Região:** us-central

### Configurações Firebase Client

```javascript
// lib/firebase.js
const firebaseConfig = {
  apiKey: "AIzaSyCeexPh-jaUffQosOgfR8FIYuwQSO6Zt0A",
  authDomain: "empregostp.firebaseapp.com",
  projectId: "empregostp",
  storageBucket: "empregostp.firebasestorage.app",
  messagingSenderId: "1003664770533",
  appId: "1:1003664770533:web:38bccc1147f4948fff5b0c",
  measurementId: "G-C1BJJJS1DB"
};
```

### Firebase Admin (Service Account)

O arquivo de credenciais do Firebase Admin (`firebase-admin-credentials.json`) deve ser obtido no Firebase Console:

1. Acesse: https://console.firebase.google.com/project/empregostp/settings/serviceaccounts/adminsdk
2. Clique em "Gerar nova chave privada"
3. Salve o arquivo como `lib/firebase-admin-credentials.json`

**OU** configure via variáveis de ambiente (recomendado para produção):

```env
FIREBASE_PROJECT_ID=empregostp
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@empregostp.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### Google Gemini AI

Para o chat de mentoria com IA:

1. Acesse: https://makersuite.google.com/app/apikey
2. Crie uma nova API Key
3. Adicione ao `.env.local`:
```env
GEMINI_API_KEY=sua_chave_aqui
```

### Vercel (Produção)

1. Acesse: https://vercel.com
2. Importe o projeto do GitHub
3. Configure as variáveis de ambiente:
   - Todas as variáveis do `.env.local`
4. Deploy automático a cada push

---

## 12. DEPLOY E PRODUÇÃO

### Deploy na Vercel

```bash
# Instalar Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

### Deploy do Firestore Rules

```bash
# Instalar Firebase CLI
npm i -g firebase-tools

# Login
firebase login

# Deploy rules
firebase deploy --only firestore:rules
```

### Deploy do Storage Rules

```bash
firebase deploy --only storage
```

### Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev

# Build de produção
npm run build

# Iniciar produção
npm start

# Testes
npm test
npm run test:watch
npm run test:coverage

# Criar admin
npm run gen:env  # Gerar arquivo de credenciais
node scripts/createAdmin.mjs

# Deploy
npm run deploy
```

---

## 13. TROUBLESHOOTING

### Erro: "Firebase Admin não inicializado"

**Causa:** Credenciais do Firebase Admin não configuradas.

**Solução:**
1. Verifique se `lib/firebase-admin-credentials.json` existe
2. OU configure as variáveis de ambiente corretamente

### Erro: "Índice não encontrado"

**Causa:** Firestore precisa de índices compostos para algumas queries.

**Solução:**
1. Acesse o link do erro no console
2. Crie o índice solicitado
3. Aguarde alguns minutos para indexação

### Erro: "CORS"

**Causa:** Requisições de domínios não autorizados.

**Solução:**
1. Configure os domínios autorizados no Firebase Console
2. Authentication > Settings > Authorized domains

### Erro: "Storage bucket não encontrado"

**Causa:** Bucket do Storage não existe ou nome incorreto.

**Solução:**
1. Verifique o nome do bucket no Firebase Console
2. Atualize `FIREBASE_STORAGE_BUCKET` no `.env.local`

### Limpeza de Cache

```bash
# Limpar cache do Next.js
rm -rf .next

# Limpar cache do npm
rm -rf node_modules/.cache

# Reinstalar dependências
rm -rf node_modules
npm install
```

---

## 📞 SUPORTE

Para dúvidas ou problemas:

- **Email:** edmir@empregostp.com
- **GitHub Issues:** https://github.com/seu-usuario/empregostp/issues

---

## 📄 LICENÇA

Este projeto está sob a licença ISC.

---

**EmpregoSTP** - Conectando Talentos ao Sucesso 🚀

*Made with ❤️ in São Tomé e Príncipe*
Use os .png disponiveis na pasta!
