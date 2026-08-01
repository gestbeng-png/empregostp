import { admin } from '../../../../lib/firebaseAdmin';
import { logServerError } from '../../../../lib/serverLog';

export default async function handler(req, res) {
  const { id } = req.query;

  // Verificar o token de autenticação
  try {
    const authHeader = req.headers.authorization;
    let token;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split('Bearer ')[1];
    } else {
      // Se não tiver no header, tenta buscar dos cookies
      const cookies = req.cookies;
      if (cookies && cookies.token) {
        token = cookies.token;
      }
    }

    if (!token) {
      return res.status(401).json({ message: 'Token de autorização ausente ou inválido' });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    const adminUid = decodedToken.uid;

    // Verificar se o usuário é um administrador
    const adminDoc = await admin.firestore().collection('users').doc(adminUid).get();
    if (!adminDoc.exists) {
      return res.status(404).json({ message: 'Usuário administrador não encontrado' });
    }

    const adminData = adminDoc.data();
    if (adminData.userType !== 'admin') {
      return res.status(403).json({ message: 'Acesso negado. Apenas administradores podem acessar esta API' });
    }

    // Verificar se o usuário a ser gerenciado existe
    const userDoc = await admin.firestore().collection('users').doc(id).get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    // Métodos permitidos
    if (req.method === 'GET') {
      // Retorna os dados do usuário
      return res.status(200).json({
        id: userDoc.id,
        ...userDoc.data()
      });
    } else if (req.method === 'PUT') {
      // Atualiza os dados do usuário
      const { name, userType, status } = req.body;

      // Validar dados
      if (!name) {
        return res.status(400).json({ message: 'Nome é obrigatório' });
      }

      if (!['candidato', 'empresa', 'admin'].includes(userType)) {
        return res.status(400).json({ message: 'Tipo de usuário inválido' });
      }

      if (!['active', 'suspended', 'inactive'].includes(status)) {
        return res.status(400).json({ message: 'Status inválido' });
      }

      // Atualizar no Firestore
      await admin.firestore().collection('users').doc(id).update({
        name,
        userType,
        status,
        updatedAt: new Date().toISOString(),
        updatedBy: adminUid
      });

      // Registrar atividade
      await admin.firestore().collection('activities').add({
        type: 'user_updated',
        description: `Usuário ${name} (${userType}) foi atualizado por um administrador`,
        userId: id,
        adminId: adminUid,
        createdAt: new Date().toISOString()
      });

      return res.status(200).json({ 
        message: 'Usuário atualizado com sucesso',
        id
      });
    } else if (req.method === 'DELETE') {
      // Não permitimos exclusão real de usuários, apenas inativação
      await admin.firestore().collection('users').doc(id).update({
        status: 'inactive',
        updatedAt: new Date().toISOString(),
        updatedBy: adminUid
      });

      // Registrar atividade
      const userData = userDoc.data();
      await admin.firestore().collection('activities').add({
        type: 'user_deactivated',
        description: `Usuário ${userData.name || userData.email} foi desativado por um administrador`,
        userId: id,
        adminId: adminUid,
        createdAt: new Date().toISOString()
      });

      return res.status(200).json({ 
        message: 'Usuário desativado com sucesso',
        id
      });
    } else {
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      return res.status(405).json({ message: 'Método não permitido' });
    }
  } catch (error) {
    logServerError('admin_users_id.gerenciar_usuario_failed', error);
    return res.status(500).json({ message: 'Erro interno do servidor', error: error.message });
  }
} 