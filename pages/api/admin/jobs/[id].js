import { admin } from '../../../../lib/firebaseAdmin';

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

    // Verificar se a vaga existe
    const jobDoc = await admin.firestore().collection('jobs').doc(id).get();
    if (!jobDoc.exists) {
      return res.status(404).json({ message: 'Vaga não encontrada' });
    }

    const jobData = jobDoc.data();

    // Métodos permitidos
    if (req.method === 'GET') {
      // Retorna os dados da vaga
      return res.status(200).json({
        id: jobDoc.id,
        ...jobData
      });
    } else if (req.method === 'PUT') {
      // Atualiza os dados da vaga
      const { 
        titulo, 
        descricao, 
        requisitos, 
        salario, 
        location, 
        tipoContrato, 
        status,
        prazo
      } = req.body;

      // Validar dados
      if (!titulo || !descricao) {
        return res.status(400).json({ message: 'Título e descrição são obrigatórios' });
      }

      if (!['active', 'closed', 'disabled'].includes(status)) {
        return res.status(400).json({ message: 'Status inválido' });
      }

      // Preparar dados para atualização
      const updateData = {
        titulo,
        descricao,
        status,
        updatedAt: new Date().toISOString(),
        updatedBy: adminUid
      };

      // Adicionar campos opcionais se fornecidos
      if (requisitos !== undefined) updateData.requisitos = requisitos;
      if (salario !== undefined) updateData.salario = salario;
      if (location !== undefined) updateData.location = location;
      if (tipoContrato !== undefined) updateData.tipoContrato = tipoContrato;
      if (prazo !== undefined) updateData.prazo = prazo;

      // Atualizar no Firestore
      await admin.firestore().collection('jobs').doc(id).update(updateData);

      // Registrar atividade
      await admin.firestore().collection('activities').add({
        type: 'job_updated',
        description: `Vaga "${titulo}" foi atualizada por um administrador`,
        jobId: id,
        adminId: adminUid,
        companyId: jobData.companyId,
        status,
        createdAt: new Date().toISOString()
      });

      return res.status(200).json({ 
        message: 'Vaga atualizada com sucesso',
        id
      });
    } else if (req.method === 'DELETE') {
      // Não permitimos exclusão real de vagas, apenas desativação
      await admin.firestore().collection('jobs').doc(id).update({
        status: 'disabled',
        updatedAt: new Date().toISOString(),
        updatedBy: adminUid
      });

      // Registrar atividade
      await admin.firestore().collection('activities').add({
        type: 'job_disabled',
        description: `Vaga "${jobData.titulo}" foi desativada por um administrador`,
        jobId: id,
        adminId: adminUid,
        companyId: jobData.companyId,
        createdAt: new Date().toISOString()
      });

      return res.status(200).json({ 
        message: 'Vaga desativada com sucesso',
        id
      });
    } else {
      return res.status(405).json({ message: 'Método não permitido' });
    }
  } catch (error) {
    console.error('Erro ao gerenciar vaga:', error);
    return res.status(500).json({ message: 'Erro interno do servidor', error: error.message });
  }
} 