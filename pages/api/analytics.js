import { admin } from '../../lib/firebaseAdmin';
import { canAccessAnalytics, getEmpresaPlanSummary } from '../../lib/empresaPlanFeatures';
import { logServerError, logServerWarning } from '../../lib/serverLog';

function isMissingIndexError(error) {
  return error?.code === 9 || String(error?.details || error?.message || '').toLowerCase().includes('requires an index');
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

async function fetchViewsForBatch(batch, thirtyDaysTimestamp) {
  const firestore = admin.firestore();

  try {
    return await firestore
      .collection('jobViews')
      .where('jobId', 'in', batch)
      .where('timestamp', '>=', thirtyDaysTimestamp)
      .get();
  } catch (error) {
    if (!isMissingIndexError(error)) {
      throw error;
    }

    logServerWarning('analytics.analytics_query_without_composite_index_usin_failed', batch);

    try {
      const fallbackSnapshot = await firestore
        .collection('jobViews')
        .where('jobId', 'in', batch)
        .get();

      const threshold = thirtyDaysTimestamp.toMillis();
      const filteredDocs = fallbackSnapshot.docs.filter((doc) => {
        const timestamp = doc.data()?.timestamp;
        return toMillis(timestamp) >= threshold;
      });

      return { docs: filteredDocs };
    } catch (fallbackError) {
      logServerWarning('analytics.analytics_batch_fallback_failed_using_global_failed', fallbackError);

      const fullSnapshot = await firestore.collection('jobViews').get();
      const jobSet = new Set(batch);
      const threshold = thirtyDaysTimestamp.toMillis();
      const filteredDocs = fullSnapshot.docs.filter((doc) => {
        const data = doc.data();
        return jobSet.has(data?.jobId) && toMillis(data?.timestamp) >= threshold;
      });

      return { docs: filteredDocs };
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split('Bearer ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    // Verificar token
    const decodedToken = await admin.auth().verifyIdToken(token);
    const companyUid = decodedToken.uid;

    const userDoc = await admin.firestore().collection('users').doc(companyUid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const userData = userDoc.data();
    if (userData.userType !== 'empresa') {
      return res.status(403).json({ error: 'Somente empresas podem aceder a analytics' });
    }

    const planSummary = getEmpresaPlanSummary(userData);
    const analyticsAccess = canAccessAnalytics(planSummary.planId);
    if (!analyticsAccess.allowed) {
      return res.status(403).json({
        error: analyticsAccess.reason,
        code: analyticsAccess.code,
        upgradeMessage: analyticsAccess.upgradeMessage,
        upgradeUrl: analyticsAccess.upgradeUrl
      });
    }


    // Buscar vagas da empresa
    const jobsSnapshot = await admin.firestore()
      .collection('jobs')
      .where('companyId', '==', companyUid)
      .get();

    const jobIds = jobsSnapshot.docs.map(doc => doc.id);
    const jobsData = {};

    jobsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      jobsData[doc.id] = {
        id: doc.id,
        titulo: data.titulo || '',
        views: data.views || 0,
        status: data.status || 'active'
      };
    });

    if (jobIds.length === 0) {
      return res.status(200).json({
        totalViews: 0,
        totalApplications: 0,
        conversionRate: 0,
        jobsAnalytics: [],
        viewsTimeline: [],
        topJobs: []
      });
    }

    // Buscar candidaturas
    const applicationsSnapshot = await admin.firestore()
      .collection('applications')
      .where('companyId', '==', companyUid)
      .get();

    const applicationsByJob = {};
    applicationsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const jobId = data.jobId;
      if (jobId) {
        applicationsByJob[jobId] = (applicationsByJob[jobId] || 0) + 1;
      }
    });

    // Buscar visualizações detalhadas (últimos 30 dias)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Firestore 'in' query limita-se a 10 itens — usar batches para empresas com >10 vagas
    const thirtyDaysTimestamp = admin.firestore.Timestamp.fromDate(thirtyDaysAgo);
    const BATCH_SIZE = 10;
    const viewsDocs = [];
    for (let i = 0; i < jobIds.length; i += BATCH_SIZE) {
      const batch = jobIds.slice(i, i + BATCH_SIZE);
      const batchSnapshot = await fetchViewsForBatch(batch, thirtyDaysTimestamp);
      viewsDocs.push(...batchSnapshot.docs);
    }

    // Calcular métricas
    let totalViews = 0;
    const viewsByJob = {};
    const viewsTimeline = {};

    viewsDocs.forEach(doc => {
      const data = doc.data();
      const jobId = data.jobId;
      viewsByJob[jobId] = (viewsByJob[jobId] || 0) + 1;
      totalViews++;

      // Timeline (por dia)
      const date = data.timestamp?.toDate ? data.timestamp.toDate().toISOString().split('T')[0] : null;
      if (date) {
        viewsTimeline[date] = (viewsTimeline[date] || 0) + 1;
      }
    });

    // Somar views das vagas (usando campo 'views' como fallback)
    Object.values(jobsData).forEach(job => {
      if (!viewsByJob[job.id]) {
        totalViews += job.views;
      }
    });

    const totalApplications = applicationsSnapshot.size;
    const conversionRate = totalViews > 0 ? ((totalApplications / totalViews) * 100).toFixed(2) : 0;

    // Analytics por vaga
    const jobsAnalytics = Object.values(jobsData).map(job => ({
      ...job,
      views: viewsByJob[job.id] || job.views || 0,
      applications: applicationsByJob[job.id] || 0,
      conversionRate: (viewsByJob[job.id] || job.views) > 0 
        ? (((applicationsByJob[job.id] || 0) / (viewsByJob[job.id] || job.views)) * 100).toFixed(2)
        : 0
    }));

    // Ordenar por views
    jobsAnalytics.sort((a, b) => b.views - a.views);

    // Top 5 vagas
    const topJobs = jobsAnalytics.slice(0, 5);

    // Timeline formatada
    const timelineArray = Object.entries(viewsTimeline)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    return res.status(200).json({
      totalViews,
      totalApplications,
      conversionRate: parseFloat(conversionRate),
      jobsAnalytics,
      viewsTimeline: timelineArray,
      topJobs
    });

  } catch (error) {
    logServerError('analytics.buscar_analytics_failed', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

