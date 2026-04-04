#!/usr/bin/env node

/**
 * Script para abrir automaticamente o link de criação do índice do Firestore
 * 
 * Execute: node scripts/open-index-link.js
 */

const { exec } = require('child_process');
const os = require('os');

const indexLink = 'https://console.firebase.google.com/v1/r/project/empregostp/firestore/indexes?create_composite=Ck9wcm9qZWN0cy9lbXByZWdvc3RwL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9hcHBsaWNhdGlvbnMvaW5kZXhlcy9fEAEaDwoLY2FuZGlkYXRlSWQQARoNCgljcmVhdGVkQXQQARoMCghfX25hbWVfXxAB';

console.log('🚀 Abrindo link para criar índice do Firestore...\n');
console.log('📋 Link:', indexLink);
console.log('\n💡 Se o navegador não abrir automaticamente, copie e cole o link acima.\n');

const platform = os.platform();
let command;

if (platform === 'darwin') {
  // macOS
  command = `open "${indexLink}"`;
} else if (platform === 'win32') {
  // Windows
  command = `start "${indexLink}"`;
} else {
  // Linux
  command = `xdg-open "${indexLink}"`;
}

exec(command, (error) => {
  if (error) {
    console.error('❌ Erro ao abrir navegador:', error.message);
    console.log('\n📋 Por favor, copie e cole este link manualmente:');
    console.log(indexLink);
  } else {
    console.log('✅ Navegador aberto!');
    console.log('📝 No Firebase Console, clique em "Create Index" para criar o índice.');
    console.log('⏳ O índice pode levar alguns minutos para ficar ativo.');
  }
});

