import { admin } from '../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (process.env.ENABLE_INTERNAL_TOOLS !== 'true') {
    return res.status(404).json({ message: 'Rota não disponível' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Email, senha e nome são obrigatórios' });
    }

    // Verificar se o email já está em uso
    try {
      const userRecord = await admin.auth().getUserByEmail(email);
      if (userRecord) {
        return res.status(400).json({ message: 'Este email já está em uso' });
      }
    } catch (error) {
      // Se o erro for auth/user-not-found, significa que o email está disponível
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    // Criar usuário no Firebase Auth
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name,
    });

    // Adicionar usuário ao Firestore com tipo 'admin'
    await admin.firestore().collection('users').doc(userRecord.uid).set({
      name,
      email,
      userType: 'admin',
      createdAt: new Date().toISOString(),
    });

    return res.status(201).json({ 
      message: 'Administrador criado com sucesso',
      uid: userRecord.uid
    });
  } catch (error) {
    console.error('Erro ao criar administrador:', error);
    return res.status(500).json({ message: 'Erro ao criar administrador', error: error.message });
  }
} 
