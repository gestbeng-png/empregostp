import { admin } from '../../lib/firebaseAdmin';
import {
  canAccessTalentPool,
  getEmpresaPlanSummary,
} from '../../lib/empresaPlanFeatures';
import { normalizeUserType } from '../../lib/defaultPlans';
import { PREMIUM_CANDIDATE_QUERY_FILTERS } from '../../lib/candidatePlanFeatures';
import {
  buildCandidateVisibility,
  compareCandidatesByVisibility,
} from '../../lib/candidateProfileInsights';
import {
  canCandidateAppearInTalentPool,
  getCandidatePrivacy,
} from '../../lib/candidatePrivacy';
import { logServerError } from '../../lib/serverLog';
import {
  BLOCKED_ACCOUNT_MESSAGE,
  isUserAccountActive,
} from '../../lib/userStatus';

/**
 * GET /api/talent-pool
 * Lista candidatos disponíveis para recrutamento (plano Premium/Ilimitado)
 *
 * Query params:
 *   area      — filtrar por área de actuação (objectiveArea)
 *   skills    — filtrar por competências (skillsHard, partialcontains)
 *   available — "true" filtra apenas candidatos disponíveis
 *   limit     — número de resultados (default 20, máx 50)
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res
      .status(401)
      .json({ error: 'Token de autenticação não fornecido' });
  }
  const token = authHeader.split('Bearer ')[1];

  let uid;
  try {
    const decoded = await admin.auth().verifyIdToken(token, true);
    uid = decoded.uid;
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }

  // Verificar que é empresa
  const userDoc = await admin.firestore().collection('users').doc(uid).get();
  if (!userDoc.exists) {
    return res.status(404).json({ error: 'Utilizador não encontrado' });
  }
  const userData = userDoc.data();
  if (!isUserAccountActive(userData)) {
    return res.status(403).json({
      error: BLOCKED_ACCOUNT_MESSAGE,
      code: 'ACCOUNT_BLOCKED',
    });
  }
  if (userData.userType !== 'empresa') {
    return res
      .status(403)
      .json({ error: 'Apenas empresas podem aceder ao banco de talentos' });
  }

  // Verificar plano
  const planSummary = getEmpresaPlanSummary(userData);
  const access = canAccessTalentPool(planSummary.planId);
  if (!access.allowed) {
    return res.status(403).json({
      error: access.reason,
      code: access.code,
      upgradeMessage: access.upgradeMessage,
      upgradeUrl: access.upgradeUrl,
    });
  }

  try {
    const { area, skills, available, limit: limitParam } = req.query;
    const limit = Math.min(parseInt(limitParam, 10) || 20, 50);

    const db = admin.firestore();
    const maxFetch = Math.min(limit * 10, 300); // keep reads bounded

    // Os dois selos usam a mesma projeção. Consultar também os Premium sem
    // flags antigas, mesmo quando a primeira página de candidatos já encheu.
    const candidateSnapshots = await Promise.all([
      db
        .collection('users')
        .where('userType', '==', 'candidato')
        .where('verified', '==', true)
        .limit(maxFetch)
        .get(),
      db
        .collection('users')
        .where('userType', '==', 'candidato')
        .where('verificationStatus', '==', 'verified')
        .limit(maxFetch)
        .get(),
      db
        .collection('users')
        .where('userType', '==', 'candidato')
        .where('verificado', '==', true)
        .limit(maxFetch)
        .get(),
      db
        .collection('users')
        .where('userType', '==', 'candidato')
        .where('isVerified', '==', true)
        .limit(maxFetch)
        .get(),
      db
        .collection('users')
        .where('userType', '==', 'candidato')
        .limit(maxFetch)
        .get(),
      ...PREMIUM_CANDIDATE_QUERY_FILTERS.map(([field, value]) =>
        db
          .collection('users')
          .where('userType', '==', 'candidato')
          .where(field, '==', value)
          .limit(maxFetch)
          .get(),
      ),
    ]);

    const usersById = new Map();
    for (const snapshot of candidateSnapshots) {
      for (const doc of snapshot.docs) usersById.set(doc.id, doc.data() || {});
    }

    const candidateIds = Array.from(usersById.keys());
    const profileDocs = candidateIds.length
      ? await db.getAll(
          ...candidateIds.map((uid) => db.collection('profiles').doc(uid)),
        )
      : [];
    const profilesById = new Map();
    for (const doc of profileDocs) {
      if (doc.exists) profilesById.set(doc.id, doc.data() || {});
    }

    // Filtros de texto aplicados em memória (Firestore não suporta full-text search)
    const areaLower = (area || '').toLowerCase();
    const skillsLower = (skills || '').toLowerCase();

    const candidates = [];
    for (const candidateId of candidateIds) {
      const u = usersById.get(candidateId) || {};
      const d = profilesById.get(candidateId) || {};

      // Double-check type in case legacy docs have wrong userType.
      if (normalizeUserType(u.userType) !== 'candidato') continue;
      if (!canCandidateAppearInTalentPool(d)) continue;

      const visibility = buildCandidateVisibility(u, d);
      const verified = visibility.verified;
      if (!verified) continue;

      if (available === 'true' && !d.availableForWork) continue;

      if (areaLower) {
        const docArea = String(d.objectiveArea || '').toLowerCase();
        if (!docArea.includes(areaLower)) continue;
      }

      if (skillsLower) {
        const hard = Array.isArray(d.skillsHard)
          ? d.skillsHard.join(', ')
          : String(d.skillsHard || '');
        const soft = Array.isArray(d.skillsSoft)
          ? d.skillsSoft.join(', ')
          : String(d.skillsSoft || '');
        const userSkills = Array.isArray(u.skills)
          ? u.skills.join(', ')
          : String(u.skills || '');
        const docSkills = `${hard} ${soft} ${userSkills}`.toLowerCase();
        if (!docSkills.includes(skillsLower)) continue;
      }

      const privacy = getCandidatePrivacy(d);
      const canExposeCv = Boolean(
        privacy.showContactInfo &&
        planSummary.features?.canViewCandidateContact,
      );

      candidates.push({
        id: candidateId,
        fullName: d.fullName || d.name || u.fullName || u.name || 'Candidato',
        headline: d.headline || d.profession || d.objectiveArea || '',
        objectiveArea: d.objectiveArea || '',
        location:
          d.location || d.city || u.cidade || u.localizacao || u.location || '',
        skillsHard: Array.isArray(d.skillsHard)
          ? d.skillsHard.join(', ')
          : d.skillsHard || '',
        availableForWork: d.availableForWork || false,
        photoUrl: d.photoUrl || u.photoUrl || null,
        // Só a existência do CV; o download passa por
        // /api/files/candidate-cv, que reavalia a permissão e assina um URL
        // de curta duração em vez de devolver o link permanente.
        hasCv: canExposeCv && Boolean(d.cvUrl || u.cvUrl),
        verified: true,
        verificationTypes: visibility.verificationTypes,
        verificationType: visibility.verificationType,
        paidVerified: visibility.paidVerified,
        qualifiedVerified: visibility.qualifiedVerified,
        qualificationScore: visibility.qualificationScore,
        qualificationLabel: visibility.qualificationLabel,
        highlighted: visibility.highlighted,
        profileComplete: visibility.isProfileComplete,
        completionScore: visibility.completionScore,
        visibilityScore: visibility.visibilityScore,
        priorityInSearch: visibility.priorityInSearch,
        createdAtMillis: visibility.createdAtMillis,
      });
    }

    candidates.sort(compareCandidatesByVisibility);

    return res.status(200).json({
      candidates: candidates.slice(0, limit),
      total: candidates.length,
    });
  } catch (error) {
    logServerError('talent_pool.buscar_banco_de_talentos_failed', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
