import { admin } from '../../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    // Buscar apenas vagas ativas
    const jobsSnapshot = await admin.firestore()
      .collection('jobs')
      .where('status', '==', 'active')
      .get();

    const jobs = await Promise.all(jobsSnapshot.docs.map(async (doc) => {
      const jobData = doc.data();
      let companyData = {};

      // Buscar informações da empresa
      if (jobData.companyId) {
        const companyDoc = await admin.firestore()
          .collection('users')
          .doc(jobData.companyId)
          .get();

        if (companyDoc.exists) {
          companyData = {
            companyName: companyDoc.data().name || companyDoc.data().fullName || 'Empresa',
            logo: companyDoc.data().logo || ''
          };
        }
      }

      return {
        id: doc.id,
        ...jobData,
        ...companyData,
        // Garantir que os campos necessários para o frontend existam
        titulo: jobData.titulo || 'Sem título',
        localizacao: jobData.localizacao || jobData.location || 'Local não especificado',
        tipoContrato: jobData.tipoContrato || 'full-time',
        salarioDe: jobData.salario || 'A combinar',
        salarioAte: jobData.salarioAte || 'A combinar',
        empresaLogo: companyData.logo || '',
        empresaNome: companyData.companyName || 'Empresa',
        empresa: companyData.companyName || 'Empresa',
        // Adicionar campos de data para ordenação
        // Função auxiliar para data segura
        createdAt: (() => {
          if (!jobData.createdAt) return new Date().toISOString();
          if (typeof jobData.createdAt.toDate === 'function') return jobData.createdAt.toDate().toISOString();
          if (jobData.createdAt instanceof Date) return jobData.createdAt.toISOString();
          return new Date(jobData.createdAt).toISOString();
        })(),
        updatedAt: (() => {
          if (!jobData.updatedAt) return new Date().toISOString();
          if (typeof jobData.updatedAt.toDate === 'function') return jobData.updatedAt.toDate().toISOString();
          if (jobData.updatedAt instanceof Date) return jobData.updatedAt.toISOString();
          return new Date(jobData.updatedAt).toISOString();
        })()
      };
    }));

    // Ordenar por data de criação (mais recentes primeiro)
    jobs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.status(200).json({ jobs });
  } catch (error) {
    console.error('Error fetching active jobs:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
