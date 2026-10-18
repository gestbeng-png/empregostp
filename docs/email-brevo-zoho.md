# Email

O envio é centralizado em [`lib/email.js`](../lib/email.js). A prioridade implementada é API Brevo → SMTP Brevo → SMTP Zoho → SMTP Gmail, conforme as credenciais disponíveis. Os fallbacks existem no código; não são serviços confirmados em produção por este documento.

| Variável                                | Função                                          |
| --------------------------------------- | ----------------------------------------------- |
| `BREVO_API_KEY`                         | Envio pela API Brevo                            |
| `BREVO_SMTP_LOGIN`, `BREVO_SMTP_KEY`    | Alternativa SMTP Brevo                          |
| `ZOHO_SMTP_USER`, `ZOHO_SMTP_PASSWORD`  | Alternativa SMTP Zoho                           |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD`      | Alternativa SMTP Gmail                          |
| `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME` | Endereço e nome do remetente                    |
| `EMAIL_REPLY_TO`                        | Destino das respostas                           |
| `CONTACT_INBOX`                         | Destino das mensagens do formulário de contacto |

Defina as credenciais em `.env.local` e no ambiente de publicação. O remetente e o domínio têm de estar autorizados no fornecedor escolhido. Valide os registos DNS no fornecedor; este documento não mantém cópias de registos externos nem afirma o seu estado atual.

## Ferramentas

- `npm run preview:emails`: pré-visualização dos templates.
- `npm run check:email-dns`: diagnóstico DNS.
- `npm run test:email`: teste de envio; pode enviar email real.
- `npm run test:auth-emails`: diagnóstico de emails de autenticação; reveja os parâmetros antes de executar.

Os scripts correspondentes em `scripts/` documentam os parâmetros disponíveis. Confirme a entrega no destinatário e nos registos do fornecedor; uma resposta de aceitação não confirma entrega.
