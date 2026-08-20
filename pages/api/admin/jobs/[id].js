import { admin } from '../../../../lib/firebaseAdmin';
import { JOB_STATUS_PENDING_REVIEW } from '../../../../lib/jobModeration';
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
      // Campos canónicos — os mesmos que a criação de vagas grava e que
      // lib/publicJob.js lê. O editor usava `salario`, `location` e `prazo`:
      // `salario` não existe sequer na cadeia de leitura do público, e `prazo`
      // fica sempre atrás de `dataFecho`. Resultado: o administrador editava,
      // via "guardado com sucesso", e a vaga publicada não mudava.
      const {
        titulo,
        descricao,
        requisitos,
        salarioDe,
        salarioAte,
        localizacao,
        tipoContrato,
        status,
        dataFecho
      } = req.body;

      // Validar dados
      if (!titulo || !descricao) {
        return res.status(400).json({ message: 'Título e descrição são obrigatórios' });
      }

      if (!['active', 'closed', 'disabled'].includes(status)) {
        return res.status(400).json({ message: 'Status inválido' });
      }

      // Uma vaga à espera de moderação só sai desse estado pela rota dedicada
      // (/api/admin/jobs/[id]/moderate), que regista quem decidiu, o motivo,
      // grava a auditoria e notifica a empresa. Permitir a mudança aqui era um
      // caminho paralelo que publicava a vaga sem nada disso.
      if (String(jobData.status || '') === JOB_STATUS_PENDING_REVIEW) {
        return res.status(409).json({
          message: 'Esta vaga está em moderação. Use a acção de aprovar ou rejeitar.',
          code: 'JOB_REQUIRES_MODERATION'
        });
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
      if (salarioDe !== undefined) updateData.salarioDe = salarioDe;
      if (salarioAte !== undefined) updateData.salarioAte = salarioAte;
      if (localizacao !== undefined) updateData.localizacao = localizacao;
      if (tipoContrato !== undefined) updateData.tipoContrato = tipoContrato;
      if (dataFecho !== undefined) updateData.dataFecho = dataFecho;

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
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      return res.status(405).json({ message: 'Método não permitido' });
    }
  } catch (error) {
    logServerError('admin_jobs_id.gerenciar_vaga_failed', error);
    return res.status(500).json({ message: 'Erro interno do servidor', error: error.message });
  }
} 