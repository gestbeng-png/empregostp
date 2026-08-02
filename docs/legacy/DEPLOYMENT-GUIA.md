> **OBSOLETO — não reflete o estado atual do projeto.**
> Arquivado na auditoria de release de agosto de 2026. Mantido apenas como
> registo histórico. As fontes de verdade são o `README.md`, o
> `DESIGN-SYSTEM.md`, o `docs/DEPLOY-GUIDE.md` e o relatório em
> `docs/audits/release-audit-2026-08.md`.

## 🚀 GUIA DE DEPLOYMENT - Funcionalidades Implementadas

Este documento descreve como fazer deploy das novas funcionalidades para produção.

---

## ⚙️ Variáveis de Ambiente Necessárias

Adicione as seguintes variáveis no seu `.env.production`:

```bash
# Rate Limiting & Security
CRON_SECRET=sua_chave_secreta_super_longa_aqui_xyz123

# Firebase (já existem, mas confirme)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
# etc...
```

---

## 📋 Checklist de Deployment

### 1. Antes de fazer deploy:

- [ ] Teste todas as funcionalidades em desenvolvimento
- [ ] Confirme variáveis de ambiente
- [ ] Verifique se banco de dados está acessível
- [ ] Confirme permissões Firestore

### 2. Deploy via Vercel (Recomendado):

```bash
# Fazer push para GitHub
git add .
git commit -m "Implementação de 5 funcionalidades críticas: blog, notificações, cron planos, rate limiting, destaques vagas"
git push origin main

# Vercel faz deploy automaticamente
# Ou manualmente em dashboard.vercel.com
```

### 3. Configurar variáveis no Vercel:

1. Acesse `dashboard.vercel.com`
2. Selecione o projeto `EmpregoSTP-v26`
3. Vá em "Settings" → "Environment Variables"
4. Adicione:
   ```
   CRON_SECRET=sua_chave_secreta_super_longa_aqui_xyz123
   ```
5. Reimplant o projeto

### 4. Configurar Cron Job (Vercel Crons):

**Opção A: Vercel Crons (Mais fácil)**

1. Crie arquivo `/pages/api/cron/_middleware.js` (novo):
```javascript
export async function middleware(request) {
  if (request.method === 'POST') {
    // Vercel automaticamente chama esta rota
    return next();
  }
}
```

2. No `vercel.json`, adicione:
```json
{
  "crons": [{
    "path": "/api/cron/check-plan-expiration",
    "schedule": "0 2 * * *"
  }]
}
```

3. Deploy

**Opção B: Serviço Externo (Mais controle)**

Use services como:
- **AWS CloudWatch Events**
- **Google Cloud Scheduler**
- **EasyCron.com**
- **IFTTT.com**

Comando:
```bash
curl -X POST https://seu-site.com/api/cron/check-plan-expiration \
  -H "Authorization: Bearer seu_cron_secret"
```

---

## 🔍 Monitorar Após Deploy

### 1. Verificar Logs

**Vercel:**
```
Dashboard → Seu Projeto → Deployments → Logs
```

**Localmente:**
```bash
vercel logs --tail
```

### 2. Verificar Funcionalidades

- [ ] Blog: `/blog` carrega posts
- [ ] Notificações: Verificação aprova/rejeita e notifica
- [ ] Cron: Execute manualmente e veja audit logs
- [ ] Rate Limit: Teste com 11+ requisições
- [ ] Destaques: Empresa consegue destacar vagas

### 3. Monitorar Cron Job

Após configurar cron:
```
Vercel Dashboard → Seu Projeto → Crons
```

Deve mostrar:
- ✅ Próxima execução
- ✅ Status da última execução
- ✅ Logs de execução

---

## 🐛 Troubleshooting em Produção

### Blog mostra vazio após deploy

**Problema**: Posts não aparecem no blog
**Solução**:
1. Verifique se Firestore está acessível
2. Adicione posts na collection `posts`
3. Aguarde revalidação (1 hora) ou rebuild

```bash
vercel rebuild
```

### Rate Limiting muito restritivo

**Problema**: Usuários recebem "Too many requests" com frequência
**Solução**:
1. Aumente o limite em `/lib/rateLimit.js`
2. Ou aumente os limites específicos na API

```javascript
// De 10 para 20 requests por minuto
rateLimitMiddleware(req, res, handler, 20)
```

### Cron não executa

**Problema**: Planos não são downgraçados
**Solução**:
1. Verifique `CRON_SECRET` em variáveis de ambiente
2. Verifique logs no Vercel
3. Teste manualmente:

```bash
curl -X POST https://seu-site.com/api/cron/check-plan-expiration \
  -H "Authorization: Bearer seu_cron_secret"
```

### Destaques não salvam

**Problema**: Clica destaque mas não funciona
**Solução**:
1. Verifique token de autenticação
2. Verifique se usuário é `userType: 'empresa'`
3. Verifique limites do plano
4. Veja console do navegador para erro

---

## 📊 Monitoramento Contínuo

### Recomendações:

1. **Sentry.io** - Para rastreamento de erros
   ```javascript
   // Adicione em _app.js
   import * as Sentry from "@sentry/react";
   
   Sentry.init({
     dsn: "sua_dsn_sentry",
     environment: "production"
   });
   ```

2. **Google Analytics** - Para track de uso
   - Blog views
   - Dashboard de destaques
   - Rate limiting blocks

3. **Firestore Monitoring** - Para verifi car performance
   - Queries no blog (otimizar se necessário)
   - Tamanho de coleções

---

## 🔒 Segurança em Produção

### Checklist:

- [ ] `CRON_SECRET` é uma string longa (mínimo 32 caracteres)
- [ ] `CRON_SECRET` não está no git (apenas em variáveis de ambiente)
- [ ] Rate limiting está ativo em todas as APIs críticas
- [ ] Firestore rules estão configuradas corretamente
- [ ] Admin-only endpoints verificam `userType === 'admin'`

### Exemplo de Firestore rules para planos expirados:

```firestore
match /users/{userId} {
  // Apenas o próprio usuário ou admin pode ler
  allow read: if request.auth.uid == userId || 
                request.auth.token.admin == true;
  // Apenas backend (Admin SDK) pode atualizar planExpiredAt
  allow update: if request.auth.token.firebase.sign_in_provider == 'anonymous' ||
                   request.auth.token.admin == true;
}
```

---

## 📈 Métricas a Acompanhar

Após deployment, monitore:

| Métrica | Meta | Tool |
|---|---|---|
| Blog Page Load | < 2s | Google Lighthouse |
| Notification Delay | < 100ms | Firebase Console |
| Cron Success Rate | > 99% | Vercel/CloudWatch |
| Rate Limit Blocks | < 1% | Application Logs |
| Featured Jobs CTR | > 5% | Google Analytics |

---

## 🎯 Rollback Plan

Se algo der errado após deploy:

### Opção 1: Rollback rápido
```bash
vercel rollback
```

### Opção 2: Voltar commit anterior
```bash
git revert HEAD
git push origin main
```

### Opção 3: Desabilitar funcionalidade específica
```javascript
// Em cada arquivo, adicione feature flag
if (process.env.FEATURE_BLOG_ENABLED === 'true') {
  // Código do blog
}
```

---

## 📞 Suporte Pós-Deploy

Após deployment bem-sucedido:

1. **Documentar em CHANGELOG.md**
2. **Notificar usuários** sobre novos recursos
3. **Monitorar feedback** de usuários
4. **Registrar em status page** de atualizações

---

## ✅ Checklist Final

- [ ] Todas as 5 funcionalidades testadas
- [ ] Variáveis de ambiente configuradas
- [ ] Cron job agendado
- [ ] Monitores configurados
- [ ] Rollback plan pronto
- [ ] Documentação atualizada
- [ ] Time notificado

---

**Deploy concluído com sucesso!** 🎉
