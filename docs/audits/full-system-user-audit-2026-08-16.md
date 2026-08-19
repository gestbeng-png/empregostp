# Auditoria integral do sistema como utilizador

**Sistema:** EmpregoSTP  
**Execução:** 15–16 de agosto de 2026  
**Perfis auditados:** candidato, empresa e administrador  
**Âmbito:** páginas públicas, autenticação, dashboards, vagas, candidaturas, entrevistas, mensagens, notificações, planos, Serviço RH, conteúdos, moderação e operações administrativas  
**Estado recomendado:** **não aprovar para produção antes de corrigir os achados críticos e altos**

## 1. Resultado executivo

O sistema tem uma base funcional ampla e muitos fluxos principais operam corretamente em ambiente isolado. O candidato consegue atualizar o perfil, guardar e remover vagas, candidatar-se, consultar o histórico, confirmar entrevistas, trocar mensagens, gerir notificações e preferências. As APIs empresariais aplicam autenticação e ownership em grande parte das operações de vagas e candidaturas. Todas as rotas e APIs administrativas inventariadas exigem o perfil `admin`.

Contudo, a auditoria encontrou um risco crítico de tomada de conta no fluxo de recuperação de senha, além de vários riscos altos de sessão, autorização, privacidade e abuso de notificações. Também há defeitos funcionais que atingem precisamente clientes pagos, como a quebra das vagas guardadas a partir de 31 favoritos.

O resultado global é:

- **1 vulnerabilidade crítica confirmada** no reset de senha;
- **11 achados altos ou alto-potenciais** de segurança, privacidade ou operação essencial;
- **11 achados médios** e **2 baixos/mistos** de integridade funcional, administração, acessibilidade e qualidade;
- melhorias mobile recentes confirmadas no footer e no detalhe de vaga;
- checkout, emails, push real e uploads classificados como não executados por segurança, e não como aprovados.

## 2. Método e limites de segurança

A auditoria combinou:

1. inventário de rotas, APIs e controlos de acesso;
2. análise estática dos fluxos e das regras Firebase;
3. testes unitários e de contrato;
4. chamadas HTTP autenticadas contra Auth e Firestore Emulators;
5. jornadas E2E em Chromium desktop e mobile;
6. validação visual manual em viewport móvel de **390 × 844 px**;
7. verificação de TypeScript, lint dirigido e build de produção;
8. revisão independente dos achados de autenticação.

Todos os utilizadores e dados usados eram fictícios. Não foram contactados serviços de produção. Não houve pagamento, email, push, OAuth Google, download de documento privado nem upload para Storage real.

### Classificação dos estados

| Estado | Significado |
|---|---|
| PASS | Operação concluída e resposta/estado final verificados |
| PASS parcial | Núcleo verificado, mas uma fronteira externa ou parte visual ficou fora do teste |
| FAIL | Defeito reproduzido ou ausência funcional confirmada |
| BLOCKED | A execução teria risco de efeito externo ou o laboratório deixou de responder |
| N/A | Operação não existe no produto atual |

## 3. Evidência objetiva de qualidade

| Verificação | Resultado | Interpretação |
|---|---:|---|
| TypeScript (`tsc --noEmit`) | **PASS** | Sem erros de tipos |
| Jest global | **74 suites / 373 testes PASS** | Regressão unitária limpa |
| Revisão auth dirigida | **7 suites / 39 testes PASS** | Os testes existentes passam, mas não cobrem os vetores encontrados |
| Revisão admin dirigida | **12 suites / 53 testes PASS** | Guards e contratos selecionados passaram |
| Contratos empresariais isolados | **3/3 PASS** | Confirmaram dois abusos de notificação e o erro de data de entrevista |
| ESLint dirigido ao código-fonte | **PASS** | Sem erros no âmbito limpo |
| ESLint padrão | **FAIL de configuração** | Analisa código gerado dentro de `tmp/**`; não é falha do código-fonte |
| Build de produção Next.js | **PASS** | TypeScript, compilação, 22 páginas estáticas e rotas dinâmicas concluíram |
| E2E global | **52 PASS, 50 FAIL, 4 skipped, 2 não executados** | A execução saturou o servidor dev após ~1,1 h; falhas de rede tardias são inconclusivas |
| Browser mobile manual | **PASS parcial** | Candidato, planos e detalhe de vaga verificados; servidor empresarial caiu após login |

### Nota sobre o E2E global

O total bruto de 50 falhas não deve ser tratado como 50 defeitos do produto. Depois de uma execução longa e paralela, o Next dev server passou a devolver `ERR_NETWORK_IO_SUSPENDED`, `ERR_ABORTED` e timeouts de navegação. Foram separados três grupos:

- falhas estáveis com evidência funcional ou estática independente, reportadas abaixo;
- falhas claras de acessibilidade, sobretudo texto de 12–13 px na barra de anúncio desktop;
- falhas tardias de rede/laboratório, classificadas como inconclusivas.

A repetição serial foi preparada, mas não chegou a arrancar porque o serviço de aprovação do ambiente local foi interrompido. Não se atribuiu aprovação nem reprovação ao produto com base apenas nesse incidente.

## 4. Validação mobile solicitada

### Footer

Em 390 × 844 px, o footer público apresenta dois grandes blocos verticais:

1. navegação para candidatos e empresas;
2. plataforma e contacto.

O teste automatizado dedicado ao footer passou, e a inspeção visual confirmou leitura, espaçamento e ausência de corte horizontal.

### Detalhe de vaga

Na rota móvel `/vaga/audit-job-apply`:

- `overflow-x` medido: **0 px**;
- “Vagas semelhantes” aparece **uma única vez**;
- a secção surge depois de descrição, requisitos, informações complementares, resumo, compatibilidade, candidatura e empresa;
- depois dela começa o footer;
- a ação fixa de candidatura não encobre o conteúdo final.

Assim, a correção pedida anteriormente — vagas semelhantes apenas no fim, depois de todos os detalhes — está confirmada.

### Planos do candidato

Os três cartões são apresentados verticalmente, sem overflow horizontal. O modal de assinatura mostra plano, valor e dados de transferência fictícios. A auditoria abriu e cancelou o modal; não pressionou “Confirmar”, porque a operação pode acionar notificações externas.

## 5. Matriz — candidato

| Operação | Estado | Evidência/observação |
|---|---|---|
| Registar candidato | PASS parcial | Auth Emulator, `setup-user` e perfil responderam; falha intermédia pode criar conta órfã |
| Verificar email | BLOCKED | Nenhum email real enviado |
| Recuperar senha | FAIL de segurança | Link pode ser envenenado com `Origin` atacante |
| Login email/senha | PASS | Token fictício e endpoints protegidos validados; login visual concluído no browser raiz |
| Google login | BLOCKED | OAuth externo não executado |
| Ver dashboard | PASS | Métricas e ações principais renderizadas em mobile |
| Atualizar perfil | PASS | Leitura, atualização e restauração via API: 200 |
| Foto, CV e certificados | BLOCKED/FAIL de segurança | Cliente não se liga ao Storage Emulator; risco de atingir Storage real |
| Consultar vagas | PASS | Lista ativa e detalhe acessíveis; vaga fechada devolveu 404 no detalhe público |
| Guardar/remover vaga | PASS normal | POST 201, GET 200, DELETE 200 |
| Consultar 31+ favoritas | FAIL | 31 favoritas reproduziram erro 500 |
| Candidatar-se | PASS | Criação 201; duplicado 409; vaga fechada 400 |
| Consultar histórico/estados | PASS | Pendente, análise, rejeitada e timeline devolvidos |
| Retirar candidatura | N/A | Não existe rota nem ação de autoatendimento |
| Confirmar entrevista | PASS | Atualização devolveu 200 |
| Exportar entrevista ICS | FAIL parcial | Timestamp Firestore legado/misto devolveu 400 |
| Mensagens | PASS | Envio 201, leitura e contador de não lidas verificados |
| Notificações | PASS | Marcar uma/todas como lidas respondeu 200; conjunto grande também passou |
| Alertas de vagas | FAIL de produto | Cria subscrição, mas não permite cancelar nem evita duplicados |
| Ver catálogo de planos | PASS | Catálogo, plano atual e modal renderizados |
| Pedir/confirmar plano | BLOCKED | Confirmação final não executada; poderia acionar push/pagamento |
| Definições | PASS | GET, POST, verificação e restauração: 200 |
| 2FA | N/A | Interface indica “Brevemente” |
| Logout | FAIL de segurança | Firebase termina no cliente, mas cookie servidor permanece |

## 6. Matriz — empresa

| Operação | Estado | Evidência/observação |
|---|---|---|
| Registo/login/recuperação | PASS parcial | Página e autenticação iniciaram; browser empresarial terminou em erro do laboratório |
| Atualizar perfil | PASS parcial | Allowlist e contratos cobertos; percurso visual incompleto |
| Criar vaga | PASS parcial | API, autenticação e ownership cobertos; notificação ocorre cedo demais |
| Editar vaga | PASS parcial | Operação existe, mas o editor admin/legado usa campos incompatíveis com o modelo público |
| Fechar/reabrir vaga | PASS parcial | Contratos cobertos |
| Pausar vaga | FAIL de UX | API admite `draft`, mas não há ação “Pausar” na interface |
| Eliminar vaga | PASS com risco | Vaga é removida; candidaturas relacionadas podem ficar órfãs |
| Ver candidaturas | PASS parcial | Escopo por empresa presente |
| Alterar estado | PASS normal | Fluxo existe; data de entrevista inválida produz 500 |
| Consultar perfil/talentos | FAIL de privacidade | URLs diretas de certificados ficam expostas |
| Mensagens | PASS parcial | Participantes, papéis e plano são validados nas APIs |
| Notificações de nova vaga | FAIL alto | Endpoint aceita vaga inexistente ou de outra empresa |
| Serviço RH | PASS parcial | Autenticação, validação e escopo por empresa presentes |
| Ver planos | PASS parcial | Catálogo/entitlements cobertos; checkout externo não executado |
| Definições empresariais | N/A parcial | Não existe área clara e completa de definições |
| Logout | FAIL de segurança | Mesmo problema global do cookie persistente |

## 7. Matriz — administrador

| Operação | Estado | Evidência/observação |
|---|---|---|
| Aceder às páginas admin | PASS | 25/25 páginas inventariadas exigem `userType: admin` |
| Chamar APIs admin | PASS | 24/24 APIs inventariadas têm guarda admin |
| Dashboard/métricas | FAIL parcial | Contagens podem incluir vagas ativas já expiradas e totais inconsistentes |
| Gerir utilizadores | PASS parcial | Listar/editar/desativar existe; “Novo utilizador” não cria utilizador |
| Desativar/suspender conta | FAIL de autorização | Só altera Firestore; Auth e guards não aplicam `status` |
| Proteger o último admin/a si próprio | FAIL | Não há bloqueio robusto de despromoção/desativação |
| Gerir vagas | PASS parcial | CRUD existe; modelo de campos diverge e moderação pode ser contornada |
| Moderar vaga pendente | FAIL de fluxo | Endpoint dedicado existe, mas não há UI efetiva para o usar |
| Gerir planos | PASS com risco | Aprovação existe; reset pode sobrescrever edições sem confirmação |
| Ver comprovativo antes de aprovar | FAIL parcial | Separador geral não mostra prova; página dedicada mostra |
| Verificações de candidato/empresa | FAIL alto | API aceita `uid` de ação diferente do `uid` verificado |
| Auditoria | FAIL parcial | UI lê `activities`; operações gravam também em `admin_activities` |
| Conteúdo/blog/notícias | PASS parcial | CRUD existe; guards SSR de blog/notícias falham abertos em exceção |
| Recursos | FAIL de administração | Recurso predefinido eliminado é recriado por sincronização SSR |
| Afiliados/depoimentos/RH | PASS parcial | Operações existem, mas nem todas geram trilho de auditoria |
| Gestão específica de empresas/candidatos | N/A parcial | Predomina gestão genérica; faltam superfícies operacionais completas |

## 8. Achados críticos e altos

### AUD-001 — CRÍTICO — Password-reset poisoning e possível tomada de conta

**Evidência:** `lib/authEmails.js:31-46`, `lib/authEmails.js:143`, `pages/api/auth/send-password-reset.js:22-24`.

`resolveBaseUrl(req)` prioriza `req.headers.origin` e depois `Host`, sem allowlist. O endpoint público inclui essa base no email que contém o `oobCode`.

**Cenário:** um atacante pede reset para o email da vítima enviando `Origin: https://attacker.example`. A vítima recebe um email aparentemente legítimo, mas o link entrega o código ao domínio atacante.

**Impacto:** tomada de conta se a vítima clicar. A rota também não tem rate limit, permitindo email bombing e consumo de quota.

**Correção mínima:** usar apenas uma origem canónica configurada no servidor; rejeitar Host/Origin não permitidos; limitar pedidos por IP + email; testar explicitamente origins hostis.

### AUD-002 — ALTO — Open redirect e possível DOM XSS após login

**Evidência:** `pages/login.js:28-30`, `pages/login.js:65-66`, `pages/login.js:136-141`, `pages/login.js:155-156`.

O consumidor lê `router.query.redirect` sem validação e atribui-o a `window.location.href` depois do login. A função segura de `lib/loginRedirect.js` protege quem constrói links internos, mas não protege uma query criada diretamente pelo atacante.

**Impacto:** phishing pós-login e redirecionamento para origem externa. Esquemas como `javascript:` constituem um vetor provável de DOM XSS; essa variante não foi executada na auditoria.

### AUD-003 — ALTO — Logout não encerra a sessão no servidor

**Evidência:** `context/AuthContext.js:20-42`, `pages/login.js:45-49`, `pages/login.js:137-141`, `lib/adminPageGuard.js:9-18`.

O logout chama apenas `signOut(auth)`. O cookie `token`, criado por 30 dias, não é destruído. Enquanto o ID token não expirar, SSR e APIs podem continuar a aceitar a sessão.

### AUD-004 — ALTO — Contas suspensas/desativadas continuam autorizadas

**Evidência:** `pages/api/admin/users/[id].js:92-112` e guards de login/SSR/API.

A operação administrativa altera apenas `users.status` no Firestore. Não desativa o utilizador no Firebase Auth e os guards verificam tipo, não estado.

### AUD-005 — ALTO — Notificações de vagas podem ser forjadas

**Evidência:** `pages/api/notify-candidates.js:36-51`, `pages/dashboard/empresa/vaga/criar-vaga.js:526-539`.

Reprodução isolada, com push mockado:

- vaga inexistente: aceite, notificação gravada e push invocado;
- vaga fechada pertencente a outra empresa: também aceite;
- título e localização do corpo foram usados como fallback.

Além disso, a UI chama a notificação imediatamente após criar uma vaga, mesmo quando ela ainda está em `pending_review`.

### AUD-006 — ALTO — Certificados privados expostos por URL direta

**Evidência:** `pages/dashboard/empresa/candidato/[id].js:373-404`, `pages/dashboard/empresa/candidato/[id].js:745-749`, `lib/candidateFileAccess.js`, `storage.rules:34`.

O perfil empresarial inclui e renderiza `certificateFiles` diretamente, independentemente de `contactLocked`. URLs com token de download contornam a intenção das Storage Rules depois de obtidas.

### AUD-007 — ALTO — Modo emulador não liga o Storage Emulator

**Evidência:** `lib/firebase.js:43-57`.

Auth e Firestore são ligados aos emuladores; Storage não. CV, foto, capa, certificados, verificação e comprovativos podem atingir o Storage real durante testes locais. Por isso todos os uploads foram bloqueados nesta auditoria.

### AUD-008 — ALTO — Registo pode criar conta órfã e irrecuperável

**Evidência:** `pages/register.js:288`, `pages/register.js:324-336`, `pages/login.js:143-149`, `firestore.rules:31`.

Depois de criar o utilizador Auth, o cliente ignora resposta não-OK ou falha de rede de `setup-user` e mostra sucesso. O login seguinte rejeita a ausência do documento Firestore; novo registo falha porque o email já existe. Não há retry ou reparação acessível ao utilizador.

### AUD-009 — ALTO — Vagas guardadas quebram para clientes pagos a partir de 31

**Evidência:** `pages/api/saved-jobs.js:43-47`, `lib/candidatePlanFeatures.js:64-98`.

Reprodução: foram criados 31 favoritos temporários no emulador; `GET /api/saved-jobs` demorou 9,8 s e devolveu 500. A query envia todos os IDs num único `where(documentId(), 'in', ids)`, cujo limite é 30, enquanto os planos permitem 50 ou ilimitados. Os dados temporários foram removidos.

### AUD-010 — ALTO — Moderação de vaga pode ser contornada

**Evidência:** endpoint `/api/admin/jobs/[id]/moderate`, CRUD genérico de vagas admin e `pages/dashboard/admin/jobs.js`.

O endpoint dedicado aplica estado pendente, metadados, log e notificação, mas não tem chamador efetivo na UI. O PUT genérico permite ativar uma vaga pendente sem passar pelo fluxo de moderação.

### AUD-011 — ALTO — Ação de verificação pode atingir o utilizador errado

**Evidência:** `pages/api/admin/verify-action.js:65`, `pages/api/admin/verify-action.js:156-185`.

A elegibilidade usa o `uid` do pedido de verificação, mas sincronização, log e notificação usam um `uid` fornecido pelo cliente sem exigir igualdade entre ambos.

### AUD-012 — ALTO potencial — HTML administrativo é publicado sem sanitização

**Evidência:** `components/AnnouncementBar.js:101`, `pages/blog/[id].js:466-468`.

Conteúdo de notícia e artigo é renderizado com `dangerouslySetInnerHTML`; não foi encontrado sanitizador nem CSP defensiva. O vetor é armazenado e público, embora dependa de capacidade de edição administrativa. Não foi injetado payload na auditoria.

## 9. Achados médios e baixos

### AUD-013 — MÉDIO/ALTO — Alertas sem cancelamento e sem deduplicação

`pages/api/job-alerts/index.js` oferece apenas POST e cria sempre novo documento. `lib/jobAlertEmail.js:185-243` não inclui link/token de cancelamento. A preferência do dashboard não controla a coleção anónima `jobAlerts`.

### AUD-014 — MÉDIO — Datas de entrevista inconsistentes

- `pages/api/applications/[id]/status.js:182-196` chama `toISOString()` antes de validar; data inválida reproduziu **500**;
- `pages/api/applications/[id]/interview-ics.js:75-87` assume string; Timestamp Firestore legado/misto devolveu **400**.

### AUD-015 — MÉDIO/ALTO funcional — Editor admin usa esquema antigo de vaga

O editor/API admin trabalha com `salario`, `location` e `prazo`; a criação e página pública usam `salarioDe`, `salarioAte`, `localizacao` e `dataFecho`. Uma edição pode parecer guardada sem alterar os valores canónicos publicados.

### AUD-016 — MÉDIO — Trilho de auditoria dividido e incompleto

A UI/API de auditoria lê `activities`; mudanças de candidatura gravam `admin_activities`. Conteúdos, depoimentos, afiliados e partes do Serviço RH não registam todas as ações relevantes.

### AUD-017 — MÉDIO — Operações administrativas destrutivas ou inconsistentes

- recurso predefinido eliminado pode ser recriado pelo `syncCollectionDefaults` no SSR;
- reset de planos sobrescreve edições sem confirmação clara;
- estatísticas incluem totais imprecisos, como vagas “ativas” expiradas;
- aprovação de assinatura no separador geral não mostra o comprovativo, embora a página dedicada o faça.

### AUD-018 — MÉDIO — Compatibilidade mostra lacunas duplicadas e falsas

`lib/candidateOptimizationInsights.js:167-205` transforma título e contrato em supostas competências sem deduplicar. Uma candidatura real devolveu `Gestor de Projetos Júnior` duas vezes e `full-time` duas vezes como “Lacunas a reforçar”.

### AUD-019 — MÉDIO — Texto inferior a 14 px na barra de anúncio desktop

Os testes desktop de várias páginas falharam de forma consistente com os mesmos elementos: `NOVIDADE` e `Saiba mais`. `styles/AnnouncementBar.module.css` usa 12 px no badge e 13 px na CTA. A variante mobile aumenta/oculta esses elementos e passou em várias rotas.

### AUD-020 — MÉDIO — Analytics/Installations tenta sair para a rede no modo emulador

`lib/firebase.js` inicializa Analytics mesmo com configuração fictícia. O browser registou pedidos de Analytics/Installations com API key inválida. Além de ruído e lentidão, isto reduz o isolamento do ambiente de QA.

### AUD-021 — MÉDIO — Pipeline E2E e lint não são herméticos

- execução E2E paralela de uma hora saturou o servidor dev;
- há testes de redirect premium com expectativa antiga, divergente do comportamento atual de login com `redirect`;
- ESLint padrão percorre builds gerados em `tmp/**`;
- jornadas autenticadas importantes não possuem E2E dedicado: candidatura, favoritos, mensagens, entrevistas, uploads, checkout e logout servidor.

### AUD-022 — MÉDIO — Eliminar vaga pode deixar candidaturas órfãs

`pages/api/jobs/[id].js:120` elimina a vaga sem transação/cascade para candidaturas relacionadas.

### AUD-023 — MÉDIO/baixo — Superfícies administrativas incompletas

Não há criação real por trás de “Novo utilizador”, não existe gestão especializada completa de empresas/candidatos e falta uma visão global operacional de candidaturas.

### AUD-024 — BAIXO — Falhas sem feedback útil

- envio de mensagem restaura texto, mas não mostra erro claro;
- falha de `navigator.share` vai apenas ao console, sem fallback para clipboard;
- visualização de perfil pode ser registada antes da decisão final de privacidade.

### AUD-025 — MÉDIO — Bundle global pesado para páginas públicas

O build de produção passou, mas os artefactos não comprimidos mostram aproximadamente **460 KB** só no chunk de `pages/_app`, além de chunks base com cerca de 188 KB e 136 KB. Como `_app` envolve também as páginas públicas com `AuthProvider`, cada visita anónima paga parte relevante do custo de autenticação/Firebase e infraestrutura global. Os chunks específicos do dashboard do candidato e da empresa acrescentam cerca de 140 KB e 96 KB, respetivamente.

Recomenda-se medir os tamanhos comprimidos e Core Web Vitals num staging, separar providers autenticados das rotas públicas e carregar SDKs Firebase/notifications apenas quando a rota ou ação realmente os exigir.

## 10. Prioridade de correção

### Bloqueadores imediatos — antes de qualquer release

1. tornar a origem do reset de senha canónica e aplicar rate limit;
2. validar `redirect` no próprio login e bloquear esquemas externos/perigosos;
3. destruir/revogar a sessão servidor no logout;
4. fazer todos os guards aplicarem `status` e desativar Auth quando necessário;
5. corrigir autorização de `notify-candidates` e só notificar vaga aprovada/ativa;
6. proteger certificados com endpoint autenticado e URLs de curta duração;
7. ligar Storage Emulator e desativar Analytics/FCM em modo emulador;
8. tornar o registo transacional ou recuperável;
9. dividir queries de favoritos em blocos de até 30;
10. exigir igualdade de UID nas verificações administrativas;
11. fechar o bypass da moderação;
12. sanitizar HTML e aplicar uma CSP apropriada.

### Próxima iteração

1. normalizar o esquema de vagas;
2. corrigir datas de entrevista/ICS;
3. implementar cancelamento e deduplicação de alertas;
4. unificar o audit log;
5. impedir orfandade de candidaturas;
6. corrigir estatísticas, resets e fluxos de comprovativos;
7. corrigir a barra de anúncio desktop;
8. remover falsas competências do matching.

### Endurecimento de qualidade

1. executar E2E contra build de produção ou servidor dedicado, não Next dev saturável;
2. dividir a suíte por perfil e usar seeds isolados por worker;
3. adicionar E2E autenticado para cada operação da matriz;
4. excluir artefactos gerados de lint/test discovery;
5. adicionar testes de abuso para Origin/Host, redirect, status, ownership, UIDs e limites Firestore.

## 11. Critérios mínimos de reteste

Uma correção só deve ser considerada aceite quando:

- reset sempre gera link para o domínio configurado, mesmo com Origin/Host hostil;
- `/login?redirect=` rejeita URL absoluta, `//host`, backslash e esquemas não HTTP internos;
- depois de “Sair”, SSR e API protegida negam imediatamente o token anterior;
- conta suspensa falha em login, SSR e API;
- empresa não consegue notificar vaga inexistente, alheia, fechada ou pendente;
- certificado nunca aparece como URL permanente no payload HTML;
- todos os SDKs Firebase ficam restritos aos emuladores em QA;
- falha de `setup-user` faz rollback ou apresenta retry funcional;
- 31, 50 e 100 favoritos são devolvidos sem erro;
- ação admin rejeita UIDs divergentes;
- HTML malicioso é neutralizado;
- a suíte E2E completa passa em execução limpa e repetível.

## 12. Operações conscientemente não executadas

Estas fronteiras ficaram fora da execução por poderem produzir efeitos externos:

- envio real de email de verificação, reset ou alerta;
- OAuth Google;
- push FCM real;
- upload de CV, foto, certificado, documento de verificação ou comprovativo;
- pagamento/transferência e confirmação final de plano;
- ações destrutivas contra dados de produção.

Isto significa **não auditado externamente**, e não “PASS”. Os fluxos foram levados até ao último ponto seguro, e os contratos internos foram testados com mocks/emuladores quando possível.

## 13. Conclusão

A responsividade móvel pedida está substancialmente melhor nas áreas verificadas, incluindo footer, planos e detalhe de vaga. O produto, porém, ainda não deve ser promovido como seguro para produção: o reset de senha pode entregar o código a um domínio controlado pelo atacante, e há riscos altos adicionais em sessão, suspensão de contas, notificações, documentos privados e moderação.

O caminho mais seguro é corrigir primeiro os 12 bloqueadores listados, executar uma suíte E2E hermética por perfil e só depois validar integrações reais num staging separado, com contas, email, Storage, FCM e pagamento de teste próprios.
