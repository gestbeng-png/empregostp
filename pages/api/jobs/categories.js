import { admin } from '../../../lib/firebaseAdmin';
import { logServerError } from '../../../lib/serverLog';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Buscar todas as vagas ativas
        const jobsSnapshot = await admin.firestore()
            .collection('jobs')
            .where('status', '==', 'active')
            .get();

        // Contar vagas por categoria
        const categoryCounts = {};

        jobsSnapshot.docs.forEach(doc => {
            const job = doc.data();
            const categoria = job.categoria || job.category || 'Outros';

            if (categoryCounts[categoria]) {
                categoryCounts[categoria]++;
            } else {
                categoryCounts[categoria] = 1;
            }
        });

        // Ordenar categorias por número de vagas (decrescente)
        const sortedCategories = Object.entries(categoryCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([name, count]) => ({
                name,
                count
            }));

        return res.status(200).json({
            categories: sortedCategories,
            totalJobs: jobsSnapshot.size
        });

    } catch (error) {
        logServerError('jobs_categories.fetching_job_categories_failed', error);
        return res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
}
