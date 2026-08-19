import { admin } from '../../lib/firebaseAdmin';
import { getPlanSummary } from '../../lib/candidatePlanFeatures';
import { buildCandidateSignals } from '../../lib/candidateProfileInsights';
import { analyzeCandidateJobFit } from '../../lib/candidateOptimizationInsights';
import { logServerError } from '../../lib/serverLog';
import { requireActiveApiUser } from '../../lib/apiUserAuth';

const serializeTimestamp = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return null;
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const authResult = await requireActiveApiUser(req, res, {
      missingTokenMessage: 'Token de autenticacao nao fornecido',
      missingUserMessage: 'Usuario nao encontrado',
    });
    if (!authResult) return;
    const { uid, userData } = authResult;

    const [profileDoc, applicationsSnap, jobsSnap] = await Promise.all([
      admin.firestore().collection('profiles').doc(uid).get(),
      admin.firestore().collection('applications').where('candidateId', '==', uid).get(),
      admin.firestore().collection('jobs').where('status', '==', 'active').get()
    ]);

    if (userData.userType !== 'candidato') {
      return res.status(403).json({ error: 'Apenas candidatos podem aceder a recomendacoes' });
    }

    const planSummary = getPlanSummary(userData);
    if (!planSummary.features?.canReceiveRecommendations) {
      return res.status(403).json({
        error: 'Recomendacoes personalizadas estao disponiveis apenas nos planos Profissional e Premium.',
        code: 'FEATURE_PRO_ONLY',
        upgradeMessage: 'Faça upgrade para desbloquear recomendações personalizadas.',
        upgradeUrl: '/premium/candidatos'
      });
    }

    const profileData = profileDoc.exists ? profileDoc.data() : {};
    const appliedJobIds = new Set(
      applicationsSnap.docs
        .map((doc) => doc.data()?.jobId)
        .filter(Boolean)
    );

    const candidateSignals = buildCandidateSignals(userData, profileData);

    const jobs = jobsSnap.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: serializeTimestamp(data.createdAt),
          updatedAt: serializeTimestamp(data.updatedAt)
        };
      })
      .filter((job) => !appliedJobIds.has(job.id));

    const hasEnoughSignals =
      candidateSignals.skills.length > 0 ||
      Boolean(candidateSignals.area) ||
      Boolean(candidateSignals.location) ||
      Boolean(candidateSignals.objectiveType);

    const recommendations = jobs
      .map((job) => {
        const { matchPercent, reasons, visibility, matchLabel, missingSkills, cvOptimizationTips } = analyzeCandidateJobFit(job, userData, profileData);
        const fallbackScore = hasEnoughSignals ? matchPercent : 18;
        const normalizedReasons = hasEnoughSignals ? reasons : ['Vaga ativa recente para explorar novas oportunidades'];

        return {
          ...job,
          score: fallbackScore,
          matchPercent: fallbackScore,
          matchLabel: hasEnoughSignals ? matchLabel : 'Compatibilidade exploratoria',
          reasons: normalizedReasons.slice(0, 3),
          missingSkills: hasEnoughSignals ? missingSkills.slice(0, 3) : [],
          cvOptimizationTips: hasEnoughSignals ? cvOptimizationTips.slice(0, 2) : [],
          candidatePriority: visibility.priorityInSearch,
          candidateProfileComplete: visibility.isProfileComplete
        };
      })
      .filter((job) => job.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      })
      .slice(0, 6);

    return res.status(200).json({ recommendations });
  } catch (error) {
    logServerError('recommendations.gerar_recomendacoes_failed', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
