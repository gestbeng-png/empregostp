# 🔐 Configuração do Login com Google

Este guia explica como ativar o login com Google no Firebase para o EmpregoSTP.

## ✅ O que foi implementado:

- ✅ Botão "Continuar com Google" na página de Login
- ✅ Botão "Continuar com Google" na página de Registro
- ✅ Fluxo automático de escolha de tipo (Candidato/Empresa)
- ✅ Sincronização de dados do Google (nome, email, foto)
- ✅ Redirecionamento inteligente baseado no tipo de usuário

## 🔧 Configuração Necessária no Firebase:

### **Passo 1: Acessar o Firebase Console**

1. Acesse: https://console.firebase.google.com
2. Selecione seu projeto **EmpregoSTP**
3. No menu lateral, clique em **"Authentication"**

### **Passo 2: Ativar Google como Provedor**

1. Clique na aba **"Sign-in method"**
2. Na lista de provedores, encontre **"Google"**
3. Clique em **"Google"** para editar
4. Ative o botão **"Enable"** (Ativar)
5. Configure:
   - **Project support email:** Seu email (ex: edmirfonceca@gmail.com)
   - **Project public-facing name:** EmpregoSTP
6. Clique em **"Save"** (Salvar)

### **Passo 3: Configurar Domínios Autorizados**

1. Ainda em **Authentication → Settings**
2. Vá para **"Authorized domains"**
3. Adicione seus domínios:
   - `localhost` (já deve estar)
   - Seu domínio Vercel (ex: `emprego-stp.vercel.app`)
   - Domínio customizado (se tiver)

### **Passo 4: Configurar OAuth Consent Screen (Opcional)**

Se quiser personalizar a tela de consentimento do Google:

1. Acesse: https://console.cloud.google.com
2. Selecione o projeto do Firebase
3. Vá para **APIs & Services → OAuth consent screen**
4. Configure:
   - **App name:** EmpregoSTP
   - **User support email:** Seu email
   - **App logo:** (opcional) Logo do EmpregoSTP
   - **Scopes:** email, profile
   - **Authorized domains:** seu domínio

## 🎯 Como Funciona:

### **Fluxo para Novo Usuário (Google):**

```
1. Usuário clica "Continuar com Google"
2. Popup do Google aparece
3. Usuário escolhe conta Google
4. Sistema verifica se é primeira vez
5. Se SIM → Redireciona para /escolha-tipo
6. Usuário escolhe: Candidato ou Empresa
7. Sistema salva userType no Firestore
8. Redireciona para dashboard apropriado
```

### **Fluxo para Usuário Existente (Google):**

```
1. Usuário clica "Continuar com Google"
2. Popup do Google aparece
3. Usuário escolhe conta Google
4. Sistema identifica usuário existente
5. Lê userType do Firestore
6. Redireciona direto para dashboard
```

## 📱 Recursos Implementados:

### **Página de Login (/login)**
- ✅ Botão Google estilizado
- ✅ Logo oficial do Google
- ✅ Estados de loading
- ✅ Tratamento de erros
- ✅ Suporte a redirect URL

### **Página de Registro (/register)**
- ✅ Botão Google estilizado
- ✅ Escolha de tipo antes de registrar
- ✅ Sincronização de dados do Google
- ✅ Detecção de conta existente

### **Página de Escolha de Tipo (/escolha-tipo)**
- ✅ Suporte a fluxo Google (`?google=true`)
- ✅ Mensagem de confirmação quando via Google
- ✅ Atualização automática do userType
- ✅ Redirecionamento inteligente

## 🔒 Segurança:

- ✅ Tokens JWT gerados pelo Firebase
- ✅ Cookies seguros (httpOnly em produção)
- ✅ Verificação de domínios autorizados
- ✅ Proteção contra popups bloqueados
- ✅ Tratamento de erros completo

## 🧪 Para Testar:

### **1. Desenvolvimento Local:**

```bash
npm run dev
```

Acesse: http://localhost:3000/login

### **2. Teste de Login:**

1. Clique em "Continuar com Google"
2. Escolha uma conta Google
3. Se for primeira vez:
   - Escolha "Candidato" ou "Empresa"
   - Será redirecionado para o dashboard
4. Se já tiver conta:
   - Vai direto para o dashboard

### **3. Teste de Registro:**

1. Vá para `/register`
2. Clique em "Continuar com Google"
3. Escolha tipo de conta
4. Complete o perfil no dashboard

## ⚠️ Notas Importantes:

### **Dados Sincronizados do Google:**
- ✅ Nome completo (displayName)
- ✅ Email
- ✅ Foto de perfil (photoURL)
- ✅ Provider: 'google'

### **Dados Adicionais Necessários:**
Após login com Google, o usuário deve completar:
- Para Candidato: Telefone, localização, skills, CV
- Para Empresa: Nome da empresa, CNPJ, endereço

### **Compatibilidade:**
- ✅ Desktop (Chrome, Firefox, Safari, Edge)
- ✅ Mobile (Chrome, Safari)
- ✅ Tablets
- ⚠️ Requer popups habilitados

## 🎨 Design:

- Botão estilizado com logo oficial do Google
- Cores oficiais do Google (azul, vermelho, amarelo, verde)
- Hover effects suaves
- Estados de loading
- Responsivo

## 📊 Benefícios:

1. ✅ **Login mais rápido** - 1 clique vs preencher formulário
2. ✅ **Mais seguro** - OAuth 2.0 do Google
3. ✅ **Menos fricção** - Não precisa lembrar senha
4. ✅ **Dados verificados** - Email já verificado pelo Google
5. ✅ **Foto automática** - Usa foto do Google
6. ✅ **UX moderna** - Padrão da indústria

## 🚀 Deploy:

Após configurar no Firebase Console, o sistema estará pronto!

```bash
npm run deploy
```

---

**Desenvolvido com ❤️ para EmpregoSTP**



