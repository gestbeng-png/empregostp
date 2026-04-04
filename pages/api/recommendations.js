import { admin } from '../../lib/firebaseAdmin';
import { getPlanSummary } from '../../lib/candidatePlanFeatures';

const normalizeText = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const serializeTimestamp = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return null;
};

const scoreJob = (job, candidateSignals) => {
  const text = normalizeText(
    [
      job.titulo,
      job.descricao,
      job.requisitos,
      job.localizacao,
      job.tipoContrato,
      job.empresa,
      job.empresaNome
    ]
      .filter(Boolean)
      .join(' ')
  );

  let score = 0;
  const reasons = [];

  const matchedSkills = candidateSignals.skills.filter((skill) => skill && text.includes(skill)).slice(0, 3);
  if (matchedSkills.length) {
    score += matchedSkills.length * 18;
    reasons.push(`Compatível com ${matchedSkills.join(', ')}`);
  }

  if (candidateSignals.area && text.includes(candidateSignals.area)) {
    score += 24;
    reasons.push(`Alinhada com a sua área: ${candidateSignals.areaRaw}`);
  }

  const jobLocation = normalizeText(job.localizacao || job.location || '');
  if (job.remoto) {
    score += 12;
    reasons.push('Aceita trabalho remoto');
  } else if (
    candidateSignals.location &&
    jobLocation &&
    (jobLocation.includes(candidateSignals.location) || candidateSignals.location.includes(jobLocation))
  ) {
    score += 14;
    reasons.push(`Localização compatível: ${job.localizacao || job.location}`);
  }

  const contractType = normalizeText(job.tipoContrato || job.contractType || '');
  if (candidateSignals.objectiveType && contractType && contractType.includes(candidateSignals.objectiveType)) {
    score += 10;
    reasons.push(`Tipo de contrato alinhado: ${job.tipoContrato || job.contractType}`);
  }

  const createdAt = serializeTimestamp(job.createdAt);
  if (createdAt) {
    const ageInDays = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
    if (ageInDays <= 14) {
      score += 6;
      reasons.push('Vaga publicada recentemente');
    }
  }

  if (!reasons.length) {
    reasons.push('Compatibilidade geral com o seu perfil');
  }

  return { score, reasons };
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticacao nao fornecido' });
  }

  try {
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;

    const [userDoc, profileDoc, applicationsSnap, jobsSnap] = await Promise.all([
      admin.firestore().collection('users').doc(uid).get(),
      admin.firestore().collection('profiles').doc(uid).get(),
      admin.firestore().collection('applications').where('candidateId', '==', uid).get(),
      admin.firestore().collection('jobs').where('status', '==', 'active').get()
    ]);

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Usuario nao encontrado' });
    }

    const userData = userDoc.data();
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

    const candidateSignals = {
      skills: [
        ...toArray(profileData.skillsHard),
        ...toArray(profileData.skillsSoft),
        ...toArray(profileData.digitalSkills)
      ]
        .map((skill) => normalizeText(skill))
        .filter(Boolean),
      area: normalizeText(profileData.objectiveArea || ''),
      areaRaw: profileData.objectiveArea || '',
      location: normalizeText(profileData.city || profileData.location || userData.location || ''),
      objectiveType: normalizeText(profileData.objectiveType || '')
    };

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
        const { score, reasons } = scoreJob(job, candidateSignals);
        const fallbackScore = hasEnoughSignals ? score : 8;
        const normalizedReasons = hasEnoughSignals ? reasons : ['Vaga ativa recente para explorar novas oportunidades'];

        return {
          ...job,
          score: fallbackScore,
          reasons: normalizedReasons.slice(0, 3)
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
    console.error('Erro ao gerar recomendacoes:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
