# Auditoria de conteúdo (F9.1/F9.2)

Data: 2026-10-10. Leitura só-de-leitura do Firestore (títulos, estado, datas; sem PII). Tráfego por URL indisponível (sem acesso a analytics nesta sessão) — **confirmar antes de despublicar**. Nada foi apagado nem despublicado.

## F9.2 — corrigido já (não requer aprovação)

| Onde | Problema | Correção |
| --- | --- | --- |
| `/` métricas | `7+`, `N+`: número exato apresentado como «mais de» | número exato, sem «+» |
| `/` métricas | «Empresas ativas» contava todas as contas de empresa | rótulo «Empresas registadas» |
| `/` testemunhos | sem testemunhos aprovados mostrava iniciais fictícias «ES», «ST», «JP» | só iniciais de testemunhos aprovados |
| `/recursos` modelos | «N descargas»: valores do seed (2 918, 3 124, 2 453, 1 650, 1 432, 982); nenhum código incrementa `downloads` | contagem removida; texto fixo «Modelo pronto a usar» |
| `/recursos` modelos | selo «Popular» atribuído ao primeiro da lista | só o selo marcado no admin |

O campo `downloads` continua guardado (expand-only); deixa de ser mostrado. Contador real só com evento próprio (`resource_download`) — Fase 5.

## F9.1 — proposta para aprovação humana (A4)

| Coleção / id | Título | Estado | Recomendação | Motivo |
| --- | --- | --- | --- | --- |
| resources_guides / g8rBWnDmdu6nnjsiPNlF | «ssssss» | sem estado | despublicar (410) | placeholder |
| resources_premium / ol4l7Akp0rZtbuqnnWl8 | «Premiun» | sem estado | despublicar (410) | placeholder; leitura pública já fechada (SEC-05) |
| resources_templates / Tytf5c7WF79FPVFvEOz7 | «Carta» | sem estado, sem ficheiro | despublicar | sem ficheiro nem descrição |
| resources_templates / contrato-freelancer, cv-classico, cv-moderno, job-description, proposta-salarial | modelos do seed | sem ficheiro | corrigir (anexar ficheiro real) ou despublicar | F9.2: «ficheiros reais, verificados, com tamanho e formato» |
| news / 2hF4jGej0qoPDqctmEcS | «Limpeza PM» | `status` nulo | rever (corrigir ou despublicar) | sem estado; título não informativo |
| news / trfshDvaHI1VR5G1IlZ3 | «Início das aulas para OUTOBRO» | publicado, categoria PARCERIA | rever | confirmar que a parceria existe; corrigir «OUTOBRO» |
| news / kALaY6SJxYm15s8mZpAm | «Noite Catchupa» | publicado | rever | confirmar evento real e data |
| posts / oAZRP7PW5OBDEQRssq2o | «Tendências Tech que Marcam 2026» | publicado | corrigir | verificar factos e datas |
| posts / jYrKezESC0CjX8B3RVz3 | «IA e Busca Ativa de Emprego…» | publicado | OK, rever factos | — |
| posts / 44svC77ZTeKJxb1Cd0Ht, KuppO1ONyPzH95L65UPC, LuefSFfD4A67FRXiJt7W | artigos de mercado/dicas | publicados | OK, rever factos e links | — |
| testimonials / u0nKi0DhxMek7DgbmTs9 | (1 aprovado) | aprovado | OK se a pessoa existir e autorizou | — |

### Risco a montante

`pages/setup/seed.js` (admin, devolve 404 em produção) contém conteúdo fictício que **não pode voltar a ser semeado** em produção: «EmpregoSTP atinge marca histórica de 10.000 candidatos», «Parceria com Ministério do Trabalho», «Maria encontrou emprego em 7 dias», visualizações «4.8k». Recomendação: retirar esses textos do seed ou restringi-lo a emuladores. Não alterado aqui (pede decisão).

## Como despublicar depois de aprovado

Redirecionar 301 para a categoria/artigo relacionado, ou 410 se for lixo sem tráfego (registar em `REDIRECTS.md`). Nunca apagar o documento: marcar `status: 'archived'` (expand-only).

## Execução (aprovada pelo utilizador, 2026-10-10)

Script `scripts/v2/unpublish-content.mjs` (dry-run → `--apply`; reversível com `--restore`). Cópia integral em `contentArchive/{coleção}__{id}` antes de cada alteração; AuditLog por item; relatório em `docs/v2/content-unpublish-apply-2026-10-10.json`. Só Firestore — nada publicado no Vercel.

| Item | Ação | Efeito verificado em produção |
| --- | --- | --- |
| resources_guides «ssssss» | arquivado | `/recursos/guia/g8rBWnDmdu6nnjsiPNlF` → 404 (410 quando o código for publicado) |
| resources_premium «Premiun» | arquivado | não era público (só admin) |
| resources_templates «Carta» (sem ficheiro) | arquivado | sai de `/recursos` |
| news «Limpeza PM» | `status: draft` | sai da faixa de notícias e de `/blog/{id}` |
| news «Início das aulas para OUTOBRO» | `status: draft` | idem (parceria não identificada, sem informação) |
| 6 modelos com «descargas» do seed | `downloads: null` | `/recursos` deixa de mostrar contagens |
| news «Noite Catchupa» | sem ação | já expirada a 30 ago. 2026, não aparece |

Pendente (código, sai com o próximo deploy aprovado): os 5 modelos sem ficheiro (`cv-classico`, `cv-moderno`, `job-description`, `proposta-salarial`, `contrato-freelancer`) também existem como valores por omissão em `lib/resourcesCatalog.js`; continuam listados sem botão de descarga até haver ficheiro real ou serem retirados do catálogo.
