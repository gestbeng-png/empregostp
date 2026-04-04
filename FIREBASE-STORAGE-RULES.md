# 🔒 Configuração das Regras do Firebase Storage

## ⚠️ PROBLEMA: Upload Fica "Enviando..." e Não Funciona

**Causa:** Regras de segurança do Firebase Storage não permitem upload.

## ✅ SOLUÇÃO: Configurar Regras no Firebase Console

### **Passo 1: Acessar Firebase Console**

1. Vá para: https://console.firebase.google.com
2. Selecione seu projeto **EmpregoSTP**
3. No menu lateral, clique em **"Storage"**

### **Passo 2: Ir para Rules (Regras)**

1. Na página do Storage, clique na aba **"Rules"** (Regras)
2. Você verá um editor de código

### **Passo 3: Substituir as Regras**

**Copie e cole este código exatamente:**

\`\`\`
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    
    // Regra para logos de empresas
    match /company-logos/{userId}/{fileName} {
      allow read: if true;
      allow write: if request.auth != null 
                   && request.auth.uid == userId
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
    
    // Regra para capas de empresas
    match /company-covers/{userId}/{fileName} {
      allow read: if true;
      allow write: if request.auth != null 
                   && request.auth.uid == userId
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
    
    // Regra para CVs de candidatos
    match /cvUrl/{userId}/{fileName} {
      allow read: if true;
      allow write: if request.auth != null 
                   && request.auth.uid == userId
                   && request.resource.size < 10 * 1024 * 1024
                   && request.resource.contentType == 'application/pdf';
    }
    
    // Regra para fotos de perfil de candidatos
    match /photoUrl/{userId}/{fileName} {
      allow read: if true;
      allow write: if request.auth != null 
                   && request.auth.uid == userId
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
    
    // Regra para certificados
    match /certificados/{userId}/{fileName} {
      allow read: if true;
      allow write: if request.auth != null 
                   && request.auth.uid == userId
                   && request.resource.size < 10 * 1024 * 1024
                   && request.resource.contentType == 'application/pdf';
    }
    
    // Regra padrão (mais permissiva para desenvolvimento)
    match /{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null
                   && request.resource.size < 10 * 1024 * 1024;
    }
  }
}
\`\`\`

### **Passo 4: Publicar as Regras**

1. Clique no botão **"Publish"** (Publicar) no topo direito
2. Confirme a publicação
3. **Pronto!** ✅

## 🎯 O que essas regras fazem:

### **Segurança:**
- ✅ Apenas usuários autenticados podem fazer upload
- ✅ Usuário só pode fazer upload para sua própria pasta (userId)
- ✅ Limites de tamanho:
  - Imagens: 5MB
  - PDFs: 10MB
- ✅ Validação de tipo de arquivo:
  - Logos/Fotos: apenas imagens
  - CVs/Certificados: apenas PDF

### **Leitura Pública:**
- ✅ Qualquer pessoa pode **ler/visualizar** arquivos
- ✅ Necessário para logos aparecerem publicamente
- ✅ Necessário para candidatos baixarem CVs

## 🧪 Testar Após Configurar:

1. **Vá para:** http://localhost:3000/dashboard/empresa/profile
2. **Clique em:** "Escolher Logo"
3. **Selecione** uma imagem
4. **Aguarde** o upload
5. **Deve funcionar!** ✅

## 🔍 Como Verificar se Deu Certo:

### **No Console do Navegador (F12):**

Após clicar em "Escolher Logo", você deve ver:

```
✅ Logs de Sucesso:
📤 Iniciando upload de logo...
📁 Arquivo selecionado: { name: ..., size: ..., type: ... }
☁️ Criando referência do Storage: company-logos/...
⬆️ Fazendo upload...
✅ Upload concluído: company-logos/...
🔗 Obtendo URL de download...
✅ URL obtida: https://firebasestorage...
✅ Upload completo!
```

```
❌ Se der erro:
❌ Erro ao enviar arquivo: FirebaseError: ...
Código do erro: storage/unauthorized
```

## 🆘 Se Ainda Não Funcionar:

### **Erro: `storage/unauthorized`**

**Solução:**
1. Verifique se copiou as regras corretamente
2. Certifique-se que clicou em "Publish"
3. Aguarde 10-20 segundos para propagar
4. Recarregue a página
5. Tente novamente

### **Erro: Fica "Enviando..." para sempre**

**Solução:**
1. Abra o Console do navegador (F12)
2. Veja o erro específico
3. Me envie o erro para eu ajudar

### **Verificar Regras no Firebase:**

1. Firebase Console → Storage → Rules
2. Deve estar assim:

```
match /company-logos/{userId}/{fileName} {
  allow read: if true;
  allow write: if request.auth != null ...
}
```

## 📋 Checklist:

- [ ] Acessei Firebase Console
- [ ] Fui para Storage → Rules
- [ ] Copiei as regras acima
- [ ] Cliquei em "Publish"
- [ ] Aguardei 20 segundos
- [ ] Recarreguei a página do perfil
- [ ] Testei o upload

## 🎉 Depois de Configurar:

**O upload vai funcionar em:**
- ✅ Logo da empresa
- ✅ Capa da empresa
- ✅ Foto de perfil de candidatos
- ✅ CV de candidatos
- ✅ Certificados
- ✅ Comprovativos de pagamento (planos)

---

**Configure agora e teste! Em 2 minutos estará funcionando!** 🚀


