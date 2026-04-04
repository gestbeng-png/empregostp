#!/usr/bin/env node

/**
 * Script para forçar deploy no Vercel
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Iniciando deploy forçado no Vercel...\n');

// Verificar se está no diretório correto
if (!fs.existsSync('package.json')) {
  console.error('❌ Execute este script na raiz do projeto!');
  process.exit(1);
}

// Verificar se há mudanças não commitadas
try {
  const status = execSync('git status --porcelain', { encoding: 'utf-8' });
  if (status.trim()) {
    console.log('⚠️  Há mudanças não commitadas. Fazendo commit...');
    execSync('git add -A', { stdio: 'inherit' });
    execSync('git commit -m "Deploy: atualizações automáticas"', { stdio: 'inherit' });
  }
} catch (error) {
  console.warn('⚠️  Erro ao verificar status do Git:', error.message);
}

// Fazer push para GitHub
try {
  console.log('\n📤 Fazendo push para GitHub...');
  execSync('git push origin main', { stdio: 'inherit' });
  console.log('✅ Push realizado com sucesso!\n');
} catch (error) {
  console.error('❌ Erro ao fazer push:', error.message);
  process.exit(1);
}

// Tentar deploy via CLI
console.log('🔄 Tentando deploy via Vercel CLI...\n');
try {
  execSync('npx vercel --prod --yes', { stdio: 'inherit' });
  console.log('\n✅ Deploy realizado com sucesso via CLI!');
} catch (error) {
  console.log('\n⚠️  Deploy via CLI falhou (pode ser problema de permissões)');
  console.log('📝 O deploy será feito automaticamente via GitHub se estiver conectado.\n');
}

console.log('\n🌐 URL de Produção:');
console.log('https://emprego-stp-edmirfoncecas-projects.vercel.app\n');

console.log('📊 Verificar status do deploy:');
console.log('https://vercel.com/edmirfoncecas-projects/emprego-stp/deployments\n');

console.log('💡 Se o deploy não iniciar automaticamente:');
console.log('1. Acesse: https://vercel.com/edmirfoncecas-projects/emprego-stp');
console.log('2. Vá em Settings > Git');
console.log('3. Verifique se o repositório está conectado');
console.log('4. Clique em "Redeploy" no último deployment\n');

