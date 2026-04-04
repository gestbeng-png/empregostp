#!/bin/bash

# Script de Deploy Automatizado para Vercel
# Uso: ./deploy.sh "mensagem do commit"

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Iniciando deploy automatizado...${NC}\n"

# Verificar se há mudanças
if [[ -z $(git status -s) ]]; then
    echo -e "${YELLOW}⚠️  Nenhuma mudança detectada para fazer commit.${NC}"
    exit 0
fi

# Mensagem de commit (usar argumento ou mensagem padrão)
COMMIT_MSG="${1:-Atualização automática do sistema}"

echo -e "${BLUE}📝 Adicionando arquivos...${NC}"
git add .

echo -e "${BLUE}💾 Fazendo commit: ${COMMIT_MSG}${NC}"
git commit -m "$COMMIT_MSG"

echo -e "${BLUE}📤 Enviando para GitHub...${NC}"
git push origin main

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✅ Deploy enviado com sucesso!${NC}"
    echo -e "${GREEN}🌐 A Vercel irá automaticamente fazer o deploy em alguns minutos.${NC}"
    echo -e "${BLUE}📊 Acompanhe em: https://vercel.com/dashboard${NC}\n"
else
    echo -e "\n${YELLOW}⚠️  Erro ao fazer push. Verifique sua conexão e permissões.${NC}\n"
    exit 1
fi


