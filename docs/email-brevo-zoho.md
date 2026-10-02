# Email: envio pelo Brevo, receção no Zoho

Estado da arquitetura de email do EmpregoSTP.

- **Envio** (todos os emails automáticos): **Brevo**, API HTTP.
- **Receção** (caixa de entrada de `contacto@empregostp.com`): **Zoho Mail**, datacenter europeu.
- **DNS**: Cloudflare (`hope.ns.cloudflare.com`, `santino.ns.cloudflare.com`).
- **Remetente**: `EmpregoSTP <contacto@empregostp.com>`, respostas para o mesmo endereço.

Código em [`lib/email.js`](../lib/email.js). Nenhum outro módulo cria transportes próprios.

## Variáveis de ambiente

| Variável                                | Para quê                                 | Estado em produção (Vercel)   |
| --------------------------------------- | ---------------------------------------- | ----------------------------- |
| `BREVO_API_KEY`                         | Chave da API HTTP do Brevo (`xkeysib-…`) | definida                      |
| `EMAIL_FROM_ADDRESS`                    | Remetente institucional                  | definida                      |
| `EMAIL_REPLY_TO`                        | Destino das respostas                    | definida                      |
| `EMAIL_FROM_NAME`                       | Nome apresentado                         | definida                      |
| `BREVO_SMTP_LOGIN` / `BREVO_SMTP_KEY`   | Alternativa ao envio por API             | opcional                      |
| `ZOHO_SMTP_USER` / `ZOHO_SMTP_PASSWORD` | Alternativa pelo Zoho (exige plano pago) | não usada                     |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD`     | Fallback antigo                          | **a remover: já não é usado** |

Ordem de escolha do fornecedor: API do Brevo → SMTP do Brevo → Gmail.

No fallback Gmail o `De:` é forçado para a conta Gmail autenticada, porque o Gmail
rejeita remetentes que não sejam a própria conta; o endereço institucional
mantém-se no `Reply-To`. Assim que a `BREVO_API_KEY` existir, o `De:` passa
sozinho a `contacto@empregostp.com`.

## O remetente tem de estar validado no Brevo

A API do Brevo responde **201 com um `messageId` mesmo quando vai recusar o
envio**. A rejeição só aparece depois, no registo de eventos. Um "Enviado" no
terminal não prova entrega nenhuma.

Estado da conta desde 2026-08-22:

- Domínio `empregostp.com`: **autenticado e verificado**
- Qualquer endereço `@empregostp.com` serve como remetente
- Envios de `contacto@empregostp.com`: entregues, sem reescrita do `De:`

Antes da autenticação o Brevo reescrevia o remetente para
`…@11951740.brevosend.com` e recusava `contacto@empregostp.com`.

Há duas formas de validar um remetente no Brevo:

1. **Confirmação por email** — o Brevo envia um link para o endereço. Não serve
   aqui: `contacto@empregostp.com` não tem MX, portanto não recebe o link.
2. **Autenticar o domínio** — os registos DKIM/SPF abaixo. É o único caminho
   possível, e é também o que dá boa entregabilidade.

O `npm run test:email` verifica isto antes de enviar e confirma a entrega no
registo de eventos depois, em vez de confiar no `messageId`.

## Carregamento do `.env.local` nos scripts

Os scripts **não** usam `node --env-file-if-exists=`: o parser nativo do Node
engasga-se com valores entre aspas que contêm `\n` (o nosso
`FIREBASE_PRIVATE_KEY`, na linha 19) e perde silenciosamente a variável
seguinte. O `.env.local` é lido por [`scripts/loadEnv.mjs`](../scripts/loadEnv.mjs),
pré-carregado com `node --import ./scripts/preloadEnv.mjs` onde é preciso.

O `generate-firebase-sw-config.mjs` continua a não ler o ficheiro por si — é o
que permite ao teste de segurança verificar que falha quando falta uma variável.

## Registos DNS necessários na Cloudflare

Correr `npm run check:email-dns` para ver o que falta.

### Receção (Zoho) — feito

| Tipo | Nome | Conteúdo      | Prioridade | Proxy    |
| ---- | ---- | ------------- | ---------- | -------- |
| MX   | `@`  | `mx.zoho.eu`  | 10         | DNS only |
| MX   | `@`  | `mx2.zoho.eu` | 20         | DNS only |
| MX   | `@`  | `mx3.zoho.eu` | 50         | DNS only |

Sem MX o domínio não recebe nada e as respostas dos utilizadores são devolvidas.

### Envio (SPF) — feito

| Tipo | Nome | Conteúdo                                            |
| ---- | ---- | --------------------------------------------------- |
| TXT  | `@`  | `v=spf1 include:zoho.eu include:spf.brevo.com ~all` |

**Um único registo SPF** com os dois `include`. Dois registos SPF separados
invalidam-se mutuamente e mandam os emails para spam.

### Autenticação do Brevo — feito

Valores reais desta conta, obtidos da API do Brevo (`GET /v3/senders/domains/empregostp.com`):

| Tipo  | Nome                | Conteúdo                                      | Proxy    |
| ----- | ------------------- | --------------------------------------------- | -------- |
| CNAME | `brevo1._domainkey` | `b1.empregostp-com.dkim.brevo.com`            | DNS only |
| CNAME | `brevo2._domainkey` | `b2.empregostp-com.dkim.brevo.com`            | DNS only |
| TXT   | `@`                 | `brevo-code:56a94991ea26d4998f3324bb31e35bdc` | —        |

O DKIM do Brevo são **CNAME**, não TXT. Depois de criados, carregar em _Verify_
no painel do Brevo (ou esperar pela verificação automática).

### DKIM do Zoho — opcional

Só assina o correio enviado a partir do webmail do Zoho; os emails da aplicação
saem todos pelo Brevo. Fazer depois, em `mailadmin.zoho.eu` → _Email
Authentication_ → _DKIM_, selector `zoho`.

### DMARC — feito (obrigatório para o Brevo autenticar)

| Tipo | Nome     | Conteúdo                                           |
| ---- | -------- | -------------------------------------------------- |
| TXT  | `_dmarc` | `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com` |

Não é opcional: `PUT /v3/senders/domains/{dominio}/authenticate` recusa com
_"ensure Brevo code, DKIM record and DMARC record are added correctly"_
enquanto faltar. `p=none` só recolhe relatórios, não rejeita nada.

A autenticação pode ser disparada por API, sem passar pelo painel:

```bash
node --import ./scripts/preloadEnv.mjs -e "
fetch('https://api.brevo.com/v3/senders/domains/empregostp.com/authenticate',
  { method: 'PUT', headers: { 'api-key': process.env.BREVO_API_KEY } })
  .then(r => r.text()).then(console.log)"
```

## Verificar

```bash
npm run check:email-dns                              # estado do DNS
npm run test:email -- alguem@exemplo.com             # um email real
npm run preview:emails -- alguem@exemplo.com         # amostra dos 7 templates
npm run test:auth-emails -- conta@existente.com      # confirmação de conta + recuperação de senha
```

O `test:auth-emails` está separado porque gera códigos **verdadeiros** pelo
Firebase Admin: o endereço tem de ser de uma conta existente. O `preview:emails`
promete não tocar em nada real, e misturá-los quebrava essa garantia.

O `preview:emails` envia uma amostra de **cada** email automático para um único
destinatário, com dados fictícios. Não cria vagas, candidaturas nem subscrições
e não toca no Firestore — é a forma de validar os templates sem avisar
candidatos reais de uma vaga que não existe.

## Design dos emails

Todos os templates assentam em [`lib/emailLayout.js`](../lib/emailLayout.js), que
trata das partes chatas do HTML de email:

- **Tabelas** em vez de flex/grid (o Outlook não suporta layout moderno).
- **CSS em linha** no que tem de funcionar em todo o lado; o `<style>` só
  acrescenta melhorias (modo escuro, telemóvel).
- **Sem imagens externas** — o Gmail bloqueia-as por omissão, e o logótipo é SVG,
  formato que a maioria dos clientes de email não rende. A marca é texto.
- **Preheader**: o resumo que o Gmail mostra ao lado do assunto na lista. Sem
  ele, o Gmail vai buscar as primeiras palavras do corpo.

Helpers disponíveis: `renderEmail`, `botao`, `factos`, `painel`, `etiquetas`,
`paragrafo`.

Convenções: tratamento formal (`si`/`seu`) em todos os emails, e a marca **não**
se repete no assunto — o remetente já é "EmpregoSTP", e repeti-la rouba espaço à
parte que distingue a mensagem na lista.

Os templates vivem em `lib/` (e não dentro das rotas) precisamente para isto:
`jobModerationEmail.js`, `applicationEmails.js`, `newJobEmail.js`,
`jobAlertEmail.js`, `newsletterEmails.js`, com o `escapeHtml.js` partilhado.
Importam com extensão `.js` explícita para poderem correr em Node puro.

O `test:email` diz por que via saiu. Depois da chave do Brevo deve dizer
_"A enviar via Brevo (API HTTP)"_.

## Eventos com email automático

| Evento                         | Onde                                                           |
| ------------------------------ | -------------------------------------------------------------- |
| Vaga aprovada/rejeitada        | `pages/api/admin/jobs/[id]/moderate.js`                        |
| Nova candidatura recebida      | `pages/api/applications/index.js` + `lib/applicationEmails.js` |
| Alerta de nova vaga            | `lib/newJobBroadcast.js`, `lib/jobAlertEmail.js`               |
| Verificação de conta           | `lib/authEmails.js` → `pages/api/auth/send-verification.js`    |
| Recuperação de senha           | `lib/authEmails.js` → `pages/api/auth/send-password-reset.js`  |
| Newsletter / notícia publicada | `pages/api/newsletter/subscribe.js`, `broadcast.js`            |

O `broadcast` envia a subscritores da newsletter **e** a utilizadores
registados, sem duplicados, respeitando quem desligou
`settings.notifications.jobAlerts` (a mesma preferência dos avisos de vagas).

Todos os envios são best-effort: uma falha de email regista-se em log e nunca
interrompe a operação principal.
