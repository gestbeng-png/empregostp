#!/usr/bin/env node

/**
 * Deploy direto para Vercel usando API
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Fazendo deploy direto para Vercel...\n');

// Ler token do Vercel
const vercelToken = process.env.VERCEL_TOKEN || process.env.VERCEL_OIDC_TOKEN;

if (!vercelToken) {
  console.log('⚠️  Token do Vercel não encontrado nas variáveis de ambiente.');
  console.log('💡 Tentando usar o token do arquivo .vercel...\n');
}

// Ler configuração do projeto
const projectConfigPath = path.join(process.cwd(), '.vercel', 'project.json');
let projectConfig = {};
if (fs.existsSync(projectConfigPath)) {
  projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, 'utf-8'));
  console.log('📋 Projeto:', projectConfig.projectName);
  console.log('🆔 Project ID:', projectConfig.projectId);
  console.log('👥 Org ID:', projectConfig.orgId);
  console.log('');
}

// Criar um arquivo temporário sem Git
const tempDir = path.join(process.cwd(), '.vercel-temp');
if (fs.existsSync(tempDir)) {
  execSync(`rm -rf ${tempDir}`, { stdio: 'inherit' });
}
fs.mkdirSync(tempDir, { recursive: true });

console.log('📦 Preparando arquivos para deploy...');

// Copiar arquivos necessários (sem .git)
const filesToCopy = [
  'package.json',
  'package-lock.json',
  'next.config.js',
  'vercel.json',
  'pages',
  'components',
  'lib',
  'context',
  'styles',
  'public',
  'scripts'
];

filesToCopy.forEach(file => {
  const src = path.join(process.cwd(), file);
  const dest = path.join(tempDir, file);
  if (fs.existsSync(src)) {
    execSync(`cp -r "${src}" "${dest}"`, { stdio: 'pipe' });
  }
});

// Criar .gitignore temporário
fs.writeFileSync(path.join(tempDir, '.gitignore'), 'node_modules\n.env.local\n.vercel\n');

console.log('✅ Arquivos preparados\n');

// Tentar deploy usando vercel deploy sem Git
process.chdir(tempDir);

try {
  console.log('🔄 Iniciando deploy...\n');
  
  // Criar um commit vazio no diretório temporário
  execSync('git init', { stdio: 'pipe' });
  execSync('git add .', { stdio: 'pipe' });
  execSync('git commit -m "Deploy" --author="Deploy Bot <deploy@vercel.com>"', { stdio: 'pipe' });
  
  // Fazer deploy
  execSync('npx vercel --prod --yes', { stdio: 'inherit', cwd: tempDir });
  
  console.log('\n✅ Deploy realizado com sucesso!');
} catch (error) {
  console.error('\n❌ Erro no deploy:', error.message);
  console.log('\n💡 Tentando método alternativo...\n');
  
  // Método alternativo: usar vercel deploy diretamente
  try {
    execSync('npx vercel deploy --prod --yes --force', { stdio: 'inherit', cwd: tempDir });
  } catch (error2) {
    console.error('\n❌ Erro no método alternativo:', error2.message);
    console.log('\n📝 Por favor, faça o deploy manualmente:');
    console.log('1. Acesse: https://vercel.com/edmirfoncecas-projects/emprego-stp');
    console.log('2. Vá em Deployments');
    console.log('3. Clique em "Redeploy" no último deployment');
  }
} finally {
  // Voltar ao diretório original e limpar
  process.chdir(process.cwd());
  execSync(`rm -rf ${tempDir}`, { stdio: 'pipe' });
}

console.log('\n🌐 URL: https://emprego-stp-edmirfoncecas-projects.vercel.app');

