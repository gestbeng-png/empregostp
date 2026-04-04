# 🚀 Guia de Deploy no Vercel

## ⚡ Deploy Automático Não Funcionou?

Se o Vercel não fez o deploy automático após o push, siga estas soluções:

---

## ✅ Solução 1: Verificar Dashboard do Vercel

### Passo a Passo:

1. **Acesse:** https://vercel.com/dashboard

2. **Entre no seu projeto:** EmpregoSTP

3. **Verifique o Status:**
   - Vá em **Deployments**
   - Veja se há deployments recentes
   - Veja se há erros (vermelho)

4. **Verifique Configurações Git:**
   ```
   Settings → Git
   ├── Production Branch: main ✅
   ├── Automatically deploy branch: ATIVADO ✅
   └── GitHub Repository: Edmirsantos/EmpregoSTP ✅
   ```

5. **Se estiver desabilitado:**
   - Marque ☑️ "Automatically deploy branch"
   - Clique em **Save**

---

## 🔄 Solução 2: Redeploy Manual (Dashboard)

### Método Rápido:

1. Dashboard → EmpregoSTP → Deployments
2. Clique no último deployment
3. Clique em **"Redeploy"** (canto superior direito)
4. Selecione **"Use existing Build Cache"** (mais rápido)
5. Clique em **"Redeploy"**

### OU criar novo deploy:

1. Dashboard → EmpregoSTP
2. Botão **"Deploy"** (canto superior direito)
3. Selecione branch: **main**
4. Clique em **"Deploy"**

---

## 💻 Solução 3: Deploy via CLI (Terminal)

### Primeira vez - Login:

```bash
# Login no Vercel (abre navegador para autenticar)
npx vercel login

# Siga as instruções no navegador
```

### Deploy de Produção:

```bash
# Navegar até a pasta do projeto
cd /Users/edmirdossantos/Desktop/Programação/sistemaDeVagas-main

# Deploy para produção
npx vercel --prod

# OU com confirmação automática
npx vercel --prod --yes
```

### Deploy de Preview (teste):

```bash
# Deploy de preview (não afeta produção)
npx vercel
```

---

## 🔍 Solução 4: Verificar Logs de Erro

### No Dashboard:

1. EmpregoSTP → Deployments
2. Clique no deployment que falhou (se houver)
3. Veja a aba **"Building"** ou **"Runtime Logs"**
4. Procure por erros em vermelho

### Erros Comuns:

#### ❌ Erro de Build:
```
Error: Build failed
```
**Solução:** Verifique se `npm run build` funciona localmente:
```bash
npm install
npm run build
```

#### ❌ Erro de Variáveis de Ambiente:
```
Error: Missing environment variables
```
**Solução:** Configure as variáveis no Vercel:
1. Settings → Environment Variables
2. Adicione todas as variáveis do arquivo `vercel-env-vars.env`

#### ❌ Erro de Node Version:
```
Error: Node version not supported
```
**Solução:** Defina versão do Node:
- Crie arquivo `.nvmrc` na raiz:
```
18
```

---

## 🔄 Solução 5: Reconnectar Git ao Vercel

Se o Vercel perdeu conexão com o GitHub:

### Passo a Passo:

1. Dashboard → EmpregoSTP → Settings → Git

2. **Disconnect Git Repository** (se estiver conectado)

3. **Connect Git Repository** novamente:
   - Escolha GitHub
   - Selecione: **Edmirsantos/EmpregoSTP**
   - Branch: **main**
   - Root Directory: **/** (raiz)

4. **Permissions:**
   - Autorize o Vercel no GitHub se solicitado

5. **Save** e aguarde reconexão

---

## 🎯 Solução 6: Forçar Novo Deploy (GitHub)

### Já fiz isso para você! ✅

Enviei um commit vazio que deve triggerar o deploy:

```bash
✅ Commit: 9369a6b - "🚀 Trigger Vercel deploy"
✅ Pushed to: main
✅ Status: Aguardando deploy...
```

**Aguarde 1-3 minutos e verifique:**
- https://vercel.com/dashboard
- Veja se novo deployment apareceu

---

## 📋 Checklist de Verificação

### Antes de fazer deploy, verifique:

- [ ] ✅ Código commitado e pushed para GitHub
- [ ] ✅ Branch `main` atualizada
- [ ] ✅ `npm run build` funciona localmente
- [ ] ✅ Variáveis de ambiente configuradas no Vercel
- [ ] ✅ Deploy automático habilitado no Vercel
- [ ] ✅ Repositório conectado corretamente
- [ ] ✅ Sem erros no último build

---

## 🔐 Solução 7: Reconfigurar Credenciais Firebase (PROBLEMA COMUM!)

### Se o erro for relacionado a Firebase Admin / Credenciais:

**Sintomas:**
- ❌ Erro: "Firebase Admin not initialized"
- ❌ Erro: "Invalid credentials"
- ❌ Erro: "FIREBASE_PRIVATE_KEY not found"
- ❌ Funções admin não funcionam na Vercel

**Causa:** Variáveis de ambiente do Firebase não configuradas ou incorretas no Vercel.

### Passo a Passo para Resolver:

#### 1️⃣ Acesse Variáveis de Ambiente no Vercel:

```
Dashboard → EmpregoSTP → Settings → Environment Variables
```

#### 2️⃣ Verifique se estas 10 variáveis existem:

**Frontend (7 variáveis):**
- ✅ `NEXT_PUBLIC_FIREBASE_API_KEY`
- ✅ `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- ✅ `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- ✅ `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- ✅ `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- ✅ `NEXT_PUBLIC_FIREBASE_APP_ID`
- ✅ `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`

**Backend (3 variáveis - CRÍTICAS):**
- ✅ `FIREBASE_PROJECT_ID`
- ✅ `FIREBASE_CLIENT_EMAIL`
- ✅ `FIREBASE_PRIVATE_KEY`

#### 3️⃣ Reconfigure as Variáveis Backend:

**IMPORTANTE:** Copie EXATAMENTE como mostrado abaixo:

**A) FIREBASE_PROJECT_ID:**
```
empregostp
```

**B) FIREBASE_CLIENT_EMAIL:**
```
firebase-adminsdk-fbsvc@empregostp.iam.gserviceaccount.com
```

**C) FIREBASE_PRIVATE_KEY:**
```
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC4FkQ/HE6p4Aiv
FMu47W2RGQ+SfNvPItELrj+Wv0fdjShqRsmxpIrOduw64mmkPzKii5VVCqC5WJnA
nmSwQ5usBYCVBMO5G52tBch1k9N0ckoPWkLmAH+02mywEkRXs+F5MgsxigOe6t22
m/C1NjuIBgj+fLyoJhMO/1kLyopLTKPmDHWoiQN6bM+vrAlTezf7U9hPgIb0K72U
+4nD0HliZyGPPMSDiZbT/5ZO9r/AMZ2xO7sWL0IaGJkyd1AJwj6wG/VzcfkbhTWB
mTrV6y5bl+S/u5yrv4gUupglWNfxbMSXkbHJpRBQL75ywoRUG/3wAc3a9/14c9du
w+JbJp4zAgMBAAECggEADjS9sIcdNPPSh7xZmlxMO8nMz1euWNZNfpLEWnxJbfoC
N+1djEVv5s37nfGyCFhOLogKDqWC0LrbJqeyin21KjnEefuDpSnR6bPMC/LL+y0E
tRmYlwpL0KeYgp/uQTxi9ojbn0eQzvc+A+UV1s4oGu+oSwdSQcGqb9pZw1Suhm/y
bkNOzljzu5jHgKjRv81VXKyvLD9GWLyWQbK6LyzYQ5YL1pQA/Z0DiJefFlpvxLMD
SdyvwSP/X4BsaR5ZmVS+fQaNTUkwkOJd2xsHPvn/Dsp1jWvRwJI/872IDBodVOHZ
fiGMz0+Ri3DVyhcRJ6l40JB7WtWXQEDlNRKkhCJ0kQKBgQDzbW0jZGxbTJ4/jzh0
jZul9eziE9scIpHH4nv8TC9FrTPfJdnp/AZ6Pk8IS6e8Rtm0p3Plu5PW6gwmgbb7
m3ULip/TYBvWu+sk2j2HilvC2SzOdSiffkboNsjjqMzCN/ey8r4BukRNID01ksRq
Cf2rXuFl1uN4KI2zbGXmcDiwowKBgQDBmD8X3tZ4nvZraBW3AoJmXN4ZShMtay3x
Bqa8n3BvSd/lRLiytmJUQlBsGae9ltBoJWTYHxFVF9AdrPEW0dl/Fb2dt8tfcLBT
JEn92uXZKJiTP2TkgcZyxFUUJceqXTJv0cX/o3EEosE/Gmm0NPqjWemqyk12KPDs
nAz3MjnlMQKBgQCh9tvX4ZhrAsaD+bIRcqruOHu9TILL7IBco2flTXdif8R0o8Wi
9moE6fJBzbyz+9wcZBIr96t9IkqlUEdEj4HIBRskU90R+gSRh5fK2BcHxOIYGEHI
JQfet5zgRM7AJubrLLGZiqqpOlsfiyCegTlDzaRg0yKULz9g8y21rlM5ywKBgEwK
jw3DO57ZYZVCpvThiXLHm313eRzn8n2vzSJdxf4QmF8npRydQvYxrgEn+pkfefDO
b1PssBQqbFabrX73ImUmlvoyTTHJw5iEsoOBzbKEnZmI1wpiZx6BO6HUTR7/yGXf
kdQd0LCvdRRiPY7JGIG9OWkaWV7GKgvmJ7mZAuChAoGAYkFElDpZtscfljUVfSjp
zIHqye4LLwI6VvrEL/EY/1rZjCxaDIiphNZld74jcjP3Vs9CJSZIOzfGJ2wq/KuV
ddNYrcxVRl/q4s3dUypIwV9SmQIgwecPUSVju6+qhGeSRv7DwFa4Z+vU2fbJt+Pw
RB1If6qTQ0UGSKlwg3I1dNk=
-----END PRIVATE KEY-----
```

**⚠️ ATENÇÃO ao copiar FIREBASE_PRIVATE_KEY:**
- ✅ Cole EXATAMENTE como está acima
- ✅ Com `-----BEGIN PRIVATE KEY-----` no começo
- ✅ Com `-----END PRIVATE KEY-----` no final
- ✅ Com todas as quebras de linha
- ❌ NÃO adicione aspas extras
- ❌ NÃO adicione `\n` manualmente
- ❌ NÃO remova os hifens

#### 4️⃣ Configurar Ambientes:

Para cada variável, marque os 3 ambientes:
- ☑️ Production
- ☑️ Preview
- ☑️ Development

#### 5️⃣ Salvar e Redeploy:

Após adicionar/atualizar todas as variáveis:

**Opção A - Via Dashboard:**
```
1. Deployments → Último deployment
2. Botão "..." (três pontinhos)
3. "Redeploy"
4. Marcar ☑️ "Clear Build Cache" (IMPORTANTE!)
5. Clicar "Redeploy"
```

**Opção B - Via Terminal:**
```bash
cd /Users/edmirdossantos/Desktop/Programação/sistemaDeVagas-main
npx vercel --prod --force
```

O parâmetro `--force` garante que o cache será limpo e as novas variáveis serão usadas.

---

## 🆘 Ainda Não Funcionou?

### Opção 1: Deploy Manual Completo

```bash
# 1. Garantir que está na pasta correta
cd /Users/edmirdossantos/Desktop/Programação/sistemaDeVagas-main

# 2. Limpar cache e node_modules
rm -rf .next node_modules

# 3. Reinstalar dependências
npm install

# 4. Testar build local
npm run build

# 5. Se funcionou localmente, fazer deploy
npx vercel login
npx vercel --prod --force
```

### Opção 2: Suporte Vercel

Se nada funcionou, pode ser um problema do Vercel:

1. **Vercel Status:** https://www.vercel-status.com/
2. **Suporte:** https://vercel.com/support
3. **Discord:** https://vercel.com/discord

---

## 📊 Verificar Deploy Bem-Sucedido

### Sinais de sucesso:

1. **Dashboard Vercel:**
   - Deployment com ✅ verde
   - Status: "Ready"
   - URL de produção ativa

2. **GitHub:**
   - ✅ Check verde no último commit
   - Badge "Deployed by Vercel"

3. **Site ao vivo:**
   - Abra a URL de produção
   - Veja as mudanças aplicadas
   - Tema escuro funcionando
   - Responsividade funcionando

---

## 🎉 Deploy Bem-Sucedido!

Quando o deploy funcionar:

- ✅ **URL de Produção:** `https://seu-projeto.vercel.app`
- ✅ **Mudanças visíveis:** Tema escuro + Responsividade
- ✅ **Deploy automático:** Funcionando para próximos pushes

---

## 💡 Dicas para Próximos Deploys

### Deploy Automático:

- ✅ Sempre faça `git push origin main`
- ✅ Vercel fará deploy automaticamente em ~2 minutos
- ✅ Acompanhe no dashboard

### Deploy Manual Rápido:

```bash
# Se automático não funcionar
npx vercel --prod --yes
```

### Preview Deploys:

```bash
# Para testar antes de fazer push para main
git checkout -b feature/nova-funcionalidade
git push origin feature/nova-funcionalidade
# Vercel criará preview automático
```

---

## 📞 Repositórios e Links

- **GitHub:** https://github.com/Edmirsantos/EmpregoSTP
- **Vercel Dashboard:** https://vercel.com/dashboard
- **Docs Vercel:** https://vercel.com/docs

---

**Última atualização:** 31/10/2025  
**Commit atual:** `9369a6b - 🚀 Trigger Vercel deploy`



