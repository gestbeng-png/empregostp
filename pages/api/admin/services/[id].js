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

    // Verificar se o serviço existe
    const serviceDoc = await admin.firestore().collection('services').doc(id).get();
    if (!serviceDoc.exists) {
      return res.status(404).json({ message: 'Serviço não encontrado' });
    }

    const serviceData = serviceDoc.data();

    // Métodos permitidos
    if (req.method === 'GET') {
      // Retorna os dados do serviço
      return res.status(200).json({
        id: serviceDoc.id,
        ...serviceData
      });
    } else if (req.method === 'PUT') {
      // Atualiza os dados do serviço
      const { title, description, category, status } = req.body;

      // Validar dados
      if (!title || !description) {
        return res.status(400).json({ message: 'Título e descrição são obrigatórios' });
      }

      if (!['formacao', 'consultoria', 'mentoria', 'workshop', 'curso'].includes(category)) {
        return res.status(400).json({ message: 'Categoria inválida' });
      }

      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json({ message: 'Status inválido' });
      }

      // Atualizar no Firestore
      const updateData = {
        title,
        description,
        category,
        status,
        updatedAt: new Date().toISOString(),
        updatedBy: adminUid
      };

      await admin.firestore().collection('services').doc(id).update(updateData);

      // Registrar atividade
      await admin.firestore().collection('activities').add({
        type: 'service_updated',
        description: `Serviço "${title}" foi atualizado por um administrador`,
        serviceId: id,
        adminId: adminUid,
        createdAt: new Date().toISOString()
      });

      return res.status(200).json({ 
        message: 'Serviço atualizado com sucesso',
        id
      });
    } else if (req.method === 'DELETE') {
      // Exclui o serviço
      await admin.firestore().collection('services').doc(id).delete();

      // Registrar atividade
      await admin.firestore().collection('activities').add({
        type: 'service_deleted',
        description: `Serviço "${serviceData.title}" foi excluído por um administrador`,
        serviceId: id,
        adminId: adminUid,
        createdAt: new Date().toISOString()
      });

      return res.status(200).json({ 
        message: 'Serviço excluído com sucesso',
        id
      });
    } else {
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      return res.status(405).json({ message: 'Método não permitido' });
    }
  } catch (error) {
    logServerError('admin_services_id.gerenciar_servico_failed', error);
    return res.status(500).json({ message: 'Erro interno do servidor', error: error.message });
  }
} 