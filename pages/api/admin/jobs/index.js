import { admin } from '../../../../lib/firebaseAdmin';

const serializeTimestamp = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  return value;
};

const mapJobForResponse = (id, data) => ({
  id,
  titulo: data.titulo || '',
  companyId: data.companyId || data.empresaId || '',
  companyName: data.companyName || data.empresaNome || '',
  empresaNome: data.companyName || data.empresaNome || '',
  status: data.status || 'active',
  localizacao: data.localizacao || data.location || '',
  location: data.localizacao || data.location || '',
  tipoContrato: data.tipoContrato || '',
  categoria: data.categoria || '',
  salarioDe: data.salarioDe || '',
  salarioAte: data.salarioAte || '',
  destaque: Boolean(data.destaque),
  views: data.views || 0,
  applicationsCount: data.applicationsCount || data.applicationCount || 0,
  createdAt: serializeTimestamp(data.createdAt),
  dataFecho: data.dataFecho || data.prazo || null
});

export default async function handler(req, res) {
  try {
    // Auth
    const authHeader = req.headers.authorization;
    let token;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split('Bearer ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ message: 'Token de autorização ausente ou inválido' });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    const adminDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
    if (!adminDoc.exists || adminDoc.data().userType !== 'admin') {
      return res.status(403).json({ message: 'Acesso negado. Apenas administradores.' });
    }

    if (req.method === 'GET') {
      const { status, search, empresaId, companyId, pageSize = '100' } = req.query;
      const limitN = Math.min(parseInt(pageSize, 10) || 100, 500);

      let q = admin.firestore().collection('jobs').orderBy('createdAt', 'desc').limit(limitN);

      if (status && status !== 'all') {
        q = admin.firestore().collection('jobs')
          .where('status', '==', status)
          .orderBy('createdAt', 'desc')
          .limit(limitN);
      }

      if (empresaId || companyId) {
        const normalizedCompanyId = companyId || empresaId;
        q = admin.firestore().collection('jobs')
          .where('companyId', '==', normalizedCompanyId)
          .orderBy('createdAt', 'desc')
          .limit(limitN);
      }

      const snapshot = await q.get();
      let jobs = snapshot.docs.map(doc => mapJobForResponse(doc.id, doc.data()));

      if (search) {
        const s = search.toLowerCase();
        jobs = jobs.filter(j =>
          j.titulo.toLowerCase().includes(s) ||
          j.companyName.toLowerCase().includes(s) ||
          j.localizacao.toLowerCase().includes(s)
        );
      }

      const stats = {
        total: jobs.length,
        active: jobs.filter(j => j.status === 'active').length,
        closed: jobs.filter(j => j.status === 'closed').length,
        disabled: jobs.filter(j => j.status === 'disabled').length,
        destaque: jobs.filter(j => j.destaque).length,
      };

      return res.status(200).json({ jobs, stats });
    } else if (req.method === 'POST') {
      const {
        companyId,
        titulo,
        descricao,
        requisitos = '',
        responsabilidades = '',
        localizacao,
        tipoContrato,
        nivelExperiencia = '',
        escolaridade = '',
        salarioDe = '',
        salarioAte = '',
        beneficios = '',
        dataAbertura = '',
        dataFecho,
        remoto = false,
        destaque = false,
        vagasDisponiveis = 1,
        palavrasChave = '',
        categoria = '',
        tdrUrl = '',
        tdrFileName = ''
      } = req.body;

      if (!companyId || !titulo || !descricao || !localizacao || !tipoContrato || !dataFecho) {
        return res.status(400).json({ message: 'Empresa, título, descrição, localização, tipo de contrato e data de fecho são obrigatórios' });
      }

      const companyDoc = await admin.firestore().collection('users').doc(companyId).get();
      if (!companyDoc.exists || companyDoc.data().userType !== 'empresa') {
        return res.status(400).json({ message: 'Empresa inválida' });
      }

      const companyData = companyDoc.data();
      const companyDisplayName = companyData.name || companyData.fullName || 'Empresa';
      const normalizedKeywords = Array.isArray(palavrasChave)
        ? palavrasChave
        : `${palavrasChave}`.split(',').map((value) => value.trim()).filter(Boolean);

      const jobData = {
        companyId,
        companyName: companyDisplayName,
        empresaNome: companyDisplayName,
        titulo: `${titulo}`.trim(),
        descricao: `${descricao}`.trim(),
        requisitos: `${requisitos}`.trim(),
        responsabilidades: `${responsabilidades}`.trim(),
        localizacao: `${localizacao}`.trim(),
        tipoContrato,
        nivelExperiencia,
        escolaridade,
        salarioDe: salarioDe || '',
        salarioAte: salarioAte || '',
        beneficios,
        dataAbertura: dataAbertura || new Date().toISOString().split('T')[0],
        dataFecho,
        remoto: Boolean(remoto),
        destaque: Boolean(destaque),
        vagasDisponiveis: Number(vagasDisponiveis) || 1,
        palavrasChave: normalizedKeywords,
        categoria,
        tdrUrl,
        tdrFileName,
        status: 'active',
        views: 0,
        applicationCount: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: decodedToken.uid,
        createdByRole: 'admin'
      };

      const jobRef = await admin.firestore().collection('jobs').add(jobData);
      const savedJob = await jobRef.get();

      await admin.firestore().collection('activities').add({
        type: 'job_created',
        description: `Vaga "${jobData.titulo}" criada por administrador para ${companyDisplayName}`,
        jobId: jobRef.id,
        adminId: decodedToken.uid,
        companyId,
        createdAt: new Date().toISOString()
      });

      return res.status(201).json({
        message: 'Vaga criada com sucesso',
        job: mapJobForResponse(savedJob.id, savedJob.data())
      });

    } else {
      return res.status(405).json({ message: 'Método não permitido' });
    }
  } catch (error) {
    console.error('Erro na API de vagas admin:', error);
    return res.status(500).json({ message: 'Erro interno do servidor', error: error.message });
  }
}
