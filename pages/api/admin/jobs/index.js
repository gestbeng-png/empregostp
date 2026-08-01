import { admin } from '../../../../lib/firebaseAdmin';
import {
  getEffectiveJobStatus,
  parseJobCloseDate,
  syncExpiredJobStatus,
} from '../../../../lib/jobExpiration';
import { logServerError } from '../../../../lib/serverLog';

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
  status: getEffectiveJobStatus(data),
  localizacao: data.localizacao || data.location || '',
  location: data.localizacao || data.location || '',
  tipoContrato: data.tipoContrato || '',
  categoria: data.categoria || '',
  salarioDe: data.salarioDe ?? '',
  salarioAte: data.salarioAte ?? '',
  currency: data.currency || 'STN',
  destaque: Boolean(data.destaque),
  views: data.views || 0,
  applicationsCount: data.applicationsCount || data.applicationCount || 0,
  createdAt: serializeTimestamp(data.createdAt),
  dataFecho: data.dataFecho || data.prazo || null,
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
      return res
        .status(401)
        .json({ message: 'Token de autorização ausente ou inválido' });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    const adminDoc = await admin
      .firestore()
      .collection('users')
      .doc(decodedToken.uid)
      .get();
    if (!adminDoc.exists || adminDoc.data().userType !== 'admin') {
      return res
        .status(403)
        .json({ message: 'Acesso negado. Apenas administradores.' });
    }

    if (req.method === 'GET') {
      const {
        status,
        search,
        empresaId,
        companyId,
        pageSize = '100',
      } = req.query;
      const limitN = Math.min(parseInt(pageSize, 10) || 100, 500);

      let q = admin
        .firestore()
        .collection('jobs')
        .orderBy('createdAt', 'desc')
        .limit(limitN);

      if (status && status !== 'all') {
        q = admin
          .firestore()
          .collection('jobs')
          .where('status', '==', status)
          .orderBy('createdAt', 'desc')
          .limit(limitN);
      }

      if (empresaId || companyId) {
        const normalizedCompanyId = companyId || empresaId;
        q = admin
          .firestore()
          .collection('jobs')
          .where('companyId', '==', normalizedCompanyId)
          .orderBy('createdAt', 'desc')
          .limit(limitN);
      }

      const snapshot = await q.get();
      let jobs = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const synced = await syncExpiredJobStatus(doc.ref, doc.data(), admin);
          return mapJobForResponse(doc.id, synced.jobData);
        }),
      );

      if (status && status !== 'all') {
        const normalizedStatus = String(status).toLowerCase();
        jobs = jobs.filter((job) => job.status === normalizedStatus);
      }

      if (search) {
        const s = search.toLowerCase();
        jobs = jobs.filter(
          (j) =>
            j.titulo.toLowerCase().includes(s) ||
            j.companyName.toLowerCase().includes(s) ||
            j.localizacao.toLowerCase().includes(s),
        );
      }

      const stats = {
        total: jobs.length,
        active: jobs.filter((j) => j.status === 'active').length,
        closed: jobs.filter((j) => j.status === 'closed').length,
        disabled: jobs.filter((j) => j.status === 'disabled').length,
        pendingReview: jobs.filter((j) => j.status === 'pending_review').length,
        destaque: jobs.filter((j) => j.destaque).length,
      };

      return res.status(200).json({ jobs, stats });
    } else if (req.method === 'POST') {
      const {
        companyId = '',
        companyName: submittedCompanyName = '',
        empresaNome: submittedEmpresaNome = '',
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
        tdrFileName = '',
      } = req.body;

      const normalizedCompanyId =
        typeof companyId === 'string' ? companyId.trim() : '';
      const normalizedSubmittedCompanyName =
        typeof submittedCompanyName === 'string'
          ? submittedCompanyName.trim()
          : '';
      const normalizedSubmittedEmpresaNome =
        typeof submittedEmpresaNome === 'string'
          ? submittedEmpresaNome.trim()
          : '';
      const manualCompanyName =
        normalizedSubmittedCompanyName || normalizedSubmittedEmpresaNome;

      if (
        (!normalizedCompanyId && !manualCompanyName) ||
        !titulo ||
        !descricao ||
        !localizacao ||
        !tipoContrato ||
        !dataFecho
      ) {
        return res
          .status(400)
          .json({
            message:
              'Empresa, título, descrição, localização, tipo de contrato e data de fecho são obrigatórios',
          });
      }

      if (manualCompanyName.length > 120) {
        return res
          .status(400)
          .json({
            message: 'O nome da empresa não pode exceder 120 caracteres',
          });
      }

      let companyDisplayName = manualCompanyName;
      if (normalizedCompanyId) {
        const companyDoc = await admin
          .firestore()
          .collection('users')
          .doc(normalizedCompanyId)
          .get();
        if (!companyDoc.exists || companyDoc.data().userType !== 'empresa') {
          return res.status(400).json({ message: 'Empresa inválida' });
        }

        const companyData = companyDoc.data();
        companyDisplayName =
          companyData.name ||
          companyData.fullName ||
          companyData.companyName ||
          'Empresa';
      }

      const companySource = normalizedCompanyId ? 'registered' : 'external';
      const normalizedKeywords = Array.isArray(palavrasChave)
        ? palavrasChave
        : `${palavrasChave}`
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean);
      const parsedCloseDate = parseJobCloseDate(dataFecho);
      const normalizedSalaryFrom =
        salarioDe === '' || salarioDe == null ? null : Number(salarioDe);
      const normalizedSalaryTo =
        salarioAte === '' || salarioAte == null ? null : Number(salarioAte);

      if (!parsedCloseDate) {
        return res.status(400).json({ message: 'Data de fecho inválida' });
      }

      if (
        (normalizedSalaryFrom !== null &&
          (!Number.isFinite(normalizedSalaryFrom) ||
            normalizedSalaryFrom <= 0)) ||
        (normalizedSalaryTo !== null &&
          (!Number.isFinite(normalizedSalaryTo) || normalizedSalaryTo <= 0))
      ) {
        return res.status(400).json({
          message: 'Os valores salariais devem ser números positivos',
        });
      }

      if (
        normalizedSalaryFrom !== null &&
        normalizedSalaryTo !== null &&
        normalizedSalaryTo < normalizedSalaryFrom
      ) {
        return res.status(400).json({
          message: 'O salário máximo não pode ser inferior ao salário mínimo',
        });
      }

      const jobData = {
        companyId: normalizedCompanyId,
        companyName: companyDisplayName,
        empresaNome: companyDisplayName,
        empresa: companyDisplayName,
        companySource,
        isExternalCompany: companySource === 'external',
        titulo: `${titulo}`.trim(),
        descricao: `${descricao}`.trim(),
        requisitos: `${requisitos}`.trim(),
        responsabilidades: `${responsabilidades}`.trim(),
        localizacao: `${localizacao}`.trim(),
        tipoContrato,
        nivelExperiencia,
        escolaridade,
        salarioDe: normalizedSalaryFrom ?? '',
        salarioAte: normalizedSalaryTo ?? '',
        currency: 'STN',
        beneficios,
        dataAbertura: dataAbertura || new Date().toISOString().split('T')[0],
        dataFecho: parsedCloseDate.toISOString().split('T')[0],
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
        publishedAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromDate(parsedCloseDate),
        createdBy: decodedToken.uid,
        createdByRole: 'admin',
      };

      const jobRef = await admin.firestore().collection('jobs').add(jobData);
      const savedJob = await jobRef.get();

      await admin
        .firestore()
        .collection('activities')
        .add({
          type: 'job_created',
          description: `Vaga "${jobData.titulo}" criada por administrador para ${companyDisplayName}`,
          jobId: jobRef.id,
          adminId: decodedToken.uid,
          companyId: normalizedCompanyId || null,
          companyName: companyDisplayName,
          createdAt: new Date().toISOString(),
        });

      return res.status(201).json({
        message: 'Vaga criada com sucesso',
        job: mapJobForResponse(savedJob.id, savedJob.data()),
      });
    } else {
      return res.status(405).json({ message: 'Método não permitido' });
    }
  } catch (error) {
    logServerError('admin_jobs.api_de_vagas_admin_failed', error);
    return res
      .status(500)
      .json({ message: 'Erro interno do servidor', error: error.message });
  }
}
