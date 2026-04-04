// Script para listar admins existentes
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import fs from 'fs';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccountPath = path.join(process.cwd(), 'lib', 'firebase-admin-credentials.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Arquivo de credenciais não encontrado');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
  });
}

async function listAdmins() {
  try {
    console.log('🔍 Buscando usuários admin...\n');
    
    const snapshot = await admin.firestore()
      .collection('users')
      .where('userType', '==', 'admin')
      .get();

    if (snapshot.empty) {
      console.log('❌ Nenhum admin encontrado no sistema.');
      console.log('\n💡 Para criar um admin, execute: node scripts/createAdmin.mjs\n');
      process.exit(0);
    }

    console.log(`✅ ${snapshot.size} admin(s) encontrado(s):\n`);
    console.log('======================================');

    snapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`\n${index + 1}. Admin:`);
      console.log(`   📧 Email: ${data.email}`);
      console.log(`   👤 Nome: ${data.name || data.fullName || 'Não informado'}`);
      console.log(`   🆔 UID: ${doc.id}`);
      console.log(`   📅 Criado em: ${data.createdAt?.toDate?.()?.toLocaleDateString('pt-PT') || 'Data não disponível'}`);
    });

    console.log('\n======================================');
    console.log('\n⚠️  NOTA: A senha não é armazenada no Firestore por segurança.');
    console.log('Se esqueceu a senha, você pode:');
    console.log('1. Usar "Esqueci minha senha" no login');
    console.log('2. Criar um novo admin com: node scripts/createAdmin.mjs\n');

  } catch (error) {
    console.error('❌ Erro ao listar admins:', error);
  } finally {
    process.exit(0);
  }
}

listAdmins();



