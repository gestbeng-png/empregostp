// Usar import/export ES modules
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import fs from 'fs';
import admin from 'firebase-admin';
import readline from 'readline';

// Configurar readline
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Obter o diretório atual do módulo
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Caminho para o arquivo de credenciais
const serviceAccountPath = path.join(process.cwd(), 'lib', 'firebase-admin-credentials.json');

// Verificar se o arquivo de credenciais existe
if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Arquivo de credenciais do Firebase Admin não encontrado em:', serviceAccountPath);
  process.exit(1);
}

// Carregar as credenciais
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

// Inicializar o Firebase Admin
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
    });
  } catch (error) {
    console.error('❌ Erro ao inicializar o Firebase Admin:', error);
    process.exit(1);
  }
}

async function createAdminUser() {
  try {
    // Solicitar dados do novo administrador
    rl.question('Digite o email do novo administrador: ', async (email) => {
      rl.question('Digite a senha (mínimo 6 caracteres): ', async (password) => {
        if (password.length < 6) {
          console.error('❌ A senha deve ter no mínimo 6 caracteres');
          rl.close();
          return;
        }

        try {
          console.log('\n⏳ Criando usuário administrador...');
          
          // 1. Criar usuário de autenticação
          const userRecord = await admin.auth().createUser({
            email: email,
            password: password,
            emailVerified: true
          });

          // 2. Adicionar dados do usuário ao Firestore
          await admin.firestore().collection('users').doc(userRecord.uid).set({
            email: email,
            userType: 'admin',
            name: 'Administrador',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          console.log('\n✅ Usuário administrador criado com sucesso!');
          console.log('======================================');
          console.log(`📧 Email: ${email}`);
          console.log(`🔑 Senha: ${'*'.repeat(password.length)}`);
          console.log(`🆔 UID: ${userRecord.uid}`);
          console.log('======================================');
          console.log('\nAgora você pode fazer login no sistema com este email e senha.');
        } catch (error) {
          console.error('\n❌ Erro ao criar usuário administrador:', error.message);
          if (error.code === 'auth/email-already-exists') {
            console.log('Este email já está em uso. Tente com outro email.');
          }
        } finally {
          rl.close();
        }
      });
    });
  } catch (error) {
    console.error('❌ Erro inesperado:', error);
    rl.close();
  }
}

// Executar a função
createAdminUser();
