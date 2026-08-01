import { admin } from '../../../../lib/firebaseAdmin';
import { logServerError } from '../../../../lib/serverLog';

export default async function handler(req, res) {
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

    // Métodos permitidos
    if (req.method === 'GET') {
      // Buscar todos os serviços
      const servicesSnapshot = await admin.firestore().collection('services').get();
      const services = servicesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return res.status(200).json({ services });
    } else if (req.method === 'POST') {
      // Criar um novo serviço
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

      // Criar serviço no Firestore
      const serviceData = {
        title,
        description,
        category,
        status,
        createdAt: new Date().toISOString(),
        createdBy: adminUid,
        updatedAt: new Date().toISOString(),
        updatedBy: adminUid
      };

      const serviceRef = await admin.firestore().collection('services').add(serviceData);

      // Registrar atividade
      await admin.firestore().collection('activities').add({
        type: 'service_created',
        description: `Serviço "${title}" foi criado por um administrador`,
        serviceId: serviceRef.id,
        adminId: adminUid,
        createdAt: new Date().toISOString()
      });

      return res.status(201).json({ 
        message: 'Serviço criado com sucesso',
        id: serviceRef.id,
        ...serviceData
      });
    } else {
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ message: 'Método não permitido' });
    }
  } catch (error) {
    logServerError('admin_services.gerenciar_servicos_failed', error);
    return res.status(500).json({ message: 'Erro interno do servidor', error: error.message });
  }
} 