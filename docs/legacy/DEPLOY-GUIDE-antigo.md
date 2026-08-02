> **OBSOLETO — substituído por `docs/DEPLOY-GUIDE.md`.**
> Arquivado na auditoria de release de agosto de 2026.

# 🚀 Guia de Deploy Automatizado

Este guia explica como fazer deploy automatizado do EmpregoSTP para a Vercel.

## ✨ Deploy Automático

O projeto está configurado para fazer deploy automático sempre que você enviar código para o GitHub. A Vercel detecta automaticamente as mudanças e faz o deploy.

## 📦 Como Fazer Deploy

### Opção 1: Usando o Script de Deploy (Recomendado)

Execute o comando:

```bash
npm run deploy
```

Ou com mensagem personalizada:

```bash
./deploy.sh "Sua mensagem de commit aqui"
```

### Opção 2: Manualmente

```bash
git add .
git commit -m "Sua mensagem"
git push origin main
```

## 🎯 O que o Script Faz

1. ✅ Adiciona todas as mudanças (`git add .`)
2. ✅ Faz commit com mensagem personalizada
3. ✅ Envia para o GitHub (`git push origin main`)
4. ✅ A Vercel detecta automaticamente e faz o deploy

## ⚡ Verificar Status do Deploy

Após executar o deploy, você pode acompanhar em:
- **Dashboard da Vercel**: https://vercel.com/dashboard
- **GitHub Actions**: (se configurado)

## 📝 Comandos Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run deploy` | Deploy rápido com mensagem padrão |
| `./deploy.sh "mensagem"` | Deploy com mensagem personalizada |
| `npm run dev` | Rodar localmente |
| `npm run build` | Build de produção |

## ⏱️ Tempo de Deploy

- **Upload para GitHub**: ~5 segundos
- **Build na Vercel**: 1-3 minutos
- **Total**: ~3-5 minutos

## 🔧 Troubleshooting

### Erro de Permissão
Se receber erro de permissão, execute:
```bash
chmod +x deploy.sh
```

### Deploy Não Inicia
1. Verifique se o projeto está conectado à Vercel
2. Confirme que está no branch `main`
3. Verifique sua conexão com internet

### Build Falhou na Vercel
1. Acesse o dashboard da Vercel
2. Veja os logs de erro
3. Corrija o problema localmente
4. Execute `npm run deploy` novamente

## 🎉 Pronto!

Agora você pode fazer deploy com um simples comando!

```bash
npm run deploy
```

---

**Desenvolvido com ❤️ para EmpregoSTP**


