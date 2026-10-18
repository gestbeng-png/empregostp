import { admin } from '../../../lib/firebaseAdmin';
import { countJobsByCategory } from '../../../lib/jobCategoryCounts';
import { logServerError } from '../../../lib/serverLog';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Buscar todas as vagas ativas
    const jobsSnapshot = await admin
      .firestore()
      .collection('jobs')
      .where('status', '==', 'active')
      .get();

    const sortedCategories = countJobsByCategory(
      jobsSnapshot.docs.map((doc) => doc.data()),
    );

    return res.status(200).json({
      categories: sortedCategories,
      totalJobs: jobsSnapshot.size,
    });
  } catch (error) {
    logServerError('jobs_categories.fetching_job_categories_failed', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message,
    });
  }
}
