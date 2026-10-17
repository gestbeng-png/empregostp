import { admin } from '../../../lib/firebaseAdmin';
import { isJobPubliclyVisible } from '../../../lib/jobExpiration';
import { projectPublicJob } from '../../../lib/publicJob';
import { logServerError } from '../../../lib/serverLog';

function toIsoDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    // Buscar apenas vagas ativas
    const jobsSnapshot = await admin
      .firestore()
      .collection('jobs')
      .where('status', '==', 'active')
      .get();

    const jobs = await Promise.all(
      jobsSnapshot.docs.map(async (doc) => {
        const jobData = { id: doc.id, ...doc.data() };
        if (!isJobPubliclyVisible(jobData)) return null;
        let companyData = {};

        // Buscar informações da empresa
        if (jobData.companyId) {
          const companyDoc = await admin
            .firestore()
            .collection('users')
            .doc(jobData.companyId)
            .get();

          if (companyDoc.exists) {
            companyData = {
              companyName:
                companyDoc.data().name ||
                companyDoc.data().fullName ||
                'Empresa',
              logo: companyDoc.data().logoUrl || companyDoc.data().logo || '',
            };
          }
        }

        const publicJob = projectPublicJob({
          ...jobData,
          companyName: companyData.companyName || jobData.companyName,
          empresaNome:
            companyData.companyName ||
            jobData.empresaNome ||
            jobData.companyName,
          companyLogo: companyData.logo || jobData.companyLogo || '',
          empresaLogo: companyData.logo || jobData.empresaLogo || '',
        });

        return {
          ...publicJob,
          createdAt: toIsoDate(publicJob.createdAt) || new Date().toISOString(),
          updatedAt: toIsoDate(publicJob.updatedAt),
          publishedAt: toIsoDate(publicJob.publishedAt),
          publicadoEm: toIsoDate(publicJob.publicadoEm),
          dataFecho: toIsoDate(publicJob.dataFecho) || publicJob.dataFecho,
          deadline: toIsoDate(publicJob.deadline) || publicJob.deadline,
          expiresAt: toIsoDate(publicJob.expiresAt) || publicJob.expiresAt,
        };
      }),
    );

    // Ordenar por data de criação (mais recentes primeiro)
    const publicJobs = jobs.filter(Boolean);
    publicJobs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.status(200).json({ jobs: publicJobs });
  } catch (error) {
    logServerError('jobs_active.fetching_active_jobs_failed', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
