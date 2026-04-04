#!/usr/bin/env node

/**
 * Script para criar o índice composto do Firestore automaticamente
 * 
 * Este script usa o Firebase CLI para fazer deploy do arquivo firestore.indexes.json
 * 
 * Execute: node scripts/create-firestore-index.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Criando índice composto do Firestore...\n');

// Verificar se o arquivo de índices existe
const indexesFile = path.join(process.cwd(), 'firestore.indexes.json');
if (!fs.existsSync(indexesFile)) {
  console.error('❌ Arquivo firestore.indexes.json não encontrado!');
  process.exit(1);
}

// Verificar se o Firebase CLI está disponível
try {
  console.log('📦 Verificando Firebase CLI...');
  execSync('npx firebase --version', { stdio: 'pipe' });
  console.log('✅ Firebase CLI encontrado\n');
} catch (error) {
  console.error('❌ Firebase CLI não encontrado. Instalando...');
  try {
    execSync('npm install --save-dev firebase-tools', { stdio: 'inherit' });
    console.log('✅ Firebase CLI instalado\n');
  } catch (installError) {
    console.error('❌ Erro ao instalar Firebase CLI:', installError.message);
    process.exit(1);
  }
}

// Verificar se está autenticado
try {
  console.log('🔐 Verificando autenticação...');
  execSync('npx firebase projects:list', { stdio: 'pipe' });
  console.log('✅ Autenticado no Firebase\n');
} catch (error) {
  console.log('⚠️  Não autenticado. Por favor, autentique-se primeiro:');
  console.log('   Execute: npx firebase login\n');
  console.log('   Ou use o link direto do erro para criar o índice manualmente:');
  console.log('   https://console.firebase.google.com/v1/r/project/empregostp/firestore/indexes\n');
  process.exit(1);
}

// Fazer deploy dos índices
try {
  console.log('📤 Fazendo deploy do índice...');
  execSync('npx firebase deploy --only firestore:indexes', { stdio: 'inherit' });
  console.log('\n✅ Índice criado com sucesso!');
  console.log('⏳ O índice pode levar alguns minutos para ficar ativo.');
  console.log('📧 Você receberá um email quando estiver pronto.\n');
} catch (error) {
  console.error('\n❌ Erro ao criar índice:', error.message);
  console.log('\n💡 Alternativa: Use o link direto do erro para criar manualmente:');
  console.log('   https://console.firebase.google.com/v1/r/project/empregostp/firestore/indexes\n');
  process.exit(1);
}

