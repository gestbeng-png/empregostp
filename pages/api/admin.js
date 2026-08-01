import { admin } from '../../lib/firebaseAdmin';
import { logServerError } from '../../lib/serverLog';

export default async function handler(req, res) {
  // Verificar se o método é GET
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    // Verificar o token de autenticação
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Token de autorização ausente ou inválido' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;

    // Verificar se o usuário é um administrador
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    const userData = userDoc.data();
    if (userData.userType !== 'admin') {
      return res.status(403).json({ message: 'Acesso negado. Apenas administradores podem acessar esta API' });
    }

    // Buscar estatísticas do sistema
    const [
      usersSnapshot,
      candidatosSnapshot,
      empresasSnapshot,
      jobsSnapshot,
      applicationsSnapshot
    ] = await Promise.all([
      admin.firestore().collection('users').get(),
      admin.firestore().collection('users').where('userType', '==', 'candidato').get(),
      admin.firestore().collection('users').where('userType', '==', 'empresa').get(),
      admin.firestore().collection('jobs').get(),
      admin.firestore().collection('applications').get()
    ]);

    // Estatísticas de vagas
    const jobsData = jobsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const activeJobs = jobsData.filter(job => job.status === 'active').length;
    const closedJobs = jobsData.filter(job => job.status === 'closed').length;
    const disabledJobs = jobsData.filter(job => job.status === 'disabled').length;

    // Retornar os dados
    return res.status(200).json({
      stats: {
        totalUsers: usersSnapshot.size,
        totalCandidatos: candidatosSnapshot.size,
        totalEmpresas: empresasSnapshot.size,
        totalJobs: jobsSnapshot.size,
        activeJobs,
        closedJobs,
        disabledJobs,
        totalApplications: applicationsSnapshot.size
      },
      lastJobs: jobsData.slice(0, 5) // Últimas 5 vagas
    });
  } catch (error) {
    logServerError('admin.buscar_dados_de_administrador_failed', error);
    return res.status(500).json({ message: 'Erro interno do servidor', error: error.message });
  }
}
