// Regras de «Apagar conta» do candidato (especificação H5).
//
// Pedido → confirmação → PENDING durante 7 dias (pode cancelar) → execução
// pelo cron diário `/api/cron/account-deletions`. Este módulo só decide; a
// escrita está em `lib/accountDeletionExecutor.js`.

export const ACCOUNT_DELETION_GRACE_DAYS = 7;
const DAY_MS = 86_400_000;

// A confirmação por OTP da especificação é substituída por uma reautenticação
// recente (palavra-passe ou Google): não há fornecedor de SMS/WhatsApp, e um
// código por email não prova mais do que a própria palavra-passe.
export const ACCOUNT_DELETION_REAUTH_MAX_AGE_SECONDS = 5 * 60;
export const ACCOUNT_DELETION_CONFIRMATION_WORD = 'ELIMINAR';
export const REMOVED_CANDIDATE_NAME = 'Candidato removido';

function deletionError(code, message) {
  return { ok: false, code, message };
}

export function getPendingDeletion(userData) {
  const deletion = userData?.deletion;
  if (!deletion || deletion.status !== 'PENDING') return null;
  if (!Number.isFinite(deletion.executeAfterMs)) return null;
  return deletion;
}

export function evaluateDeletionRequest({
  userData,
  authTimeSeconds,
  confirmation,
  nowMs,
}) {
  if (userData?.userType !== 'candidato') {
    return deletionError(
      'NOT_CANDIDATE',
      'A eliminação automática está disponível para contas de candidato. Para contas de empresa, contacte o suporte.',
    );
  }
  if (getPendingDeletion(userData)) {
    return deletionError(
      'ALREADY_PENDING',
      'Já pediu a eliminação desta conta.',
    );
  }
  if (
    String(confirmation || '')
      .trim()
      .toUpperCase() !== ACCOUNT_DELETION_CONFIRMATION_WORD
  ) {
    return deletionError(
      'CONFIRMATION_REQUIRED',
      `Escreva ${ACCOUNT_DELETION_CONFIRMATION_WORD} para confirmar.`,
    );
  }
  const authAgeSeconds = Math.floor(nowMs / 1000) - Number(authTimeSeconds);
  if (
    !Number.isFinite(authAgeSeconds) ||
    authAgeSeconds < 0 ||
    authAgeSeconds > ACCOUNT_DELETION_REAUTH_MAX_AGE_SECONDS
  ) {
    return deletionError(
      'REAUTH_REQUIRED',
      'Por segurança, termine a sessão, volte a entrar e repita o pedido nos 5 minutos seguintes.',
    );
  }
  return { ok: true };
}

export function buildPendingDeletion(nowMs) {
  return {
    status: 'PENDING',
    requestedAtMs: nowMs,
    executeAfterMs: nowMs + ACCOUNT_DELETION_GRACE_DAYS * DAY_MS,
  };
}

export function isDeletionDue(userData, nowMs) {
  const pending = getPendingDeletion(userData);
  return Boolean(pending && pending.executeAfterMs <= nowMs);
}

// Candidaturas ainda em curso passam a retiradas. As já decididas (contratada,
// aprovada, rejeitada, retirada) mantêm o estado: é história da empresa.
const OPEN_LIFECYCLE_STATUSES = new Set([
  'SUBMITTED',
  'UNDER_REVIEW',
  'SHORTLISTED',
  'INTERVIEW',
  'OFFER',
]);
const OPEN_LEGACY_STATUSES = new Set(['pending', 'analysis', 'interview']);

export function isApplicationOpenForDeletion(application = {}) {
  if (typeof application.v2Status === 'string') {
    return OPEN_LIFECYCLE_STATUSES.has(application.v2Status);
  }
  return OPEN_LEGACY_STATUSES.has(
    String(application.status || 'pending').toLowerCase(),
  );
}

/**
 * Campos a gravar numa candidatura de quem apagou a conta. Mantém-se só o que
 * a empresa precisa para a integridade do processo e das estatísticas: vaga,
 * estado, datas. Nome → «Candidato removido»; contactos, carta, respostas,
 * documentos e sinais tirados do perfil desaparecem.
 */
export function planApplicationAnonymization(application = {}, nowIso) {
  const withdraw = isApplicationOpenForDeletion(application);
  const timeline = Array.isArray(application.timeline)
    ? application.timeline.map((entry) => ({
        title: entry?.title || '',
        date: entry?.date || null,
        icon: entry?.icon || '',
        byType: entry?.byType || null,
      }))
    : [];
  timeline.push({
    title: withdraw
      ? 'Candidatura retirada — conta eliminada'
      : 'Dados do candidato removidos',
    date: nowIso,
    icon: '🗑️',
    byType: 'sistema',
  });

  const update = {
    candidateName: REMOVED_CANDIDATE_NAME,
    candidateEmail: null,
    candidatePhone: null,
    coverLetter: '',
    applicationForm: null,
    skillsAssessmentResult: null,
    compatibilityReasons: [],
    compatibilityMatchedSkills: [],
    compatibilityMissingSkills: [],
    compatibilityKeywords: [],
    cvOptimizationTips: [],
    applicationFeedback: '',
    cvSnapshotKey: null,
    cvSnapshotData: null,
    cvUrl: null,
    candidateSnapshot: null,
    answersSnapshot: null,
    sharedContacts: null,
    candidateRemoved: true,
    timeline,
  };

  if (!withdraw) return { update, withdraw: false };

  if (typeof application.v2Status === 'string') {
    return {
      update: {
        ...update,
        status: 'withdrawn',
        v2Status: 'WITHDRAWN',
        withdrawalReason: 'ACCOUNT_DELETED',
        version:
          (Number.isSafeInteger(application.version)
            ? application.version
            : 0) + 1,
      },
      withdraw: true,
      from: application.v2Status,
    };
  }
  return {
    update: {
      ...update,
      status: 'withdrawn',
      withdrawalReason: 'ACCOUNT_DELETED',
    },
    withdraw: true,
    from: null,
  };
}

// Pastas do Storage com ficheiros do próprio candidato. Os comprovativos de
// pagamento (`payment-proofs/`) ficam: são documentos de faturação, retidos
// pelo prazo fiscal (H5).
export const VERIFICATION_DOCUMENT_TYPES = Object.freeze([
  'identity',
  'selfie',
  'certificates',
  'academic',
  'experience',
  'cv',
  'competencies',
]);

export function candidateStoragePrefixes(uid) {
  if (typeof uid !== 'string' || !/^[A-Za-z0-9_-]{6,128}$/.test(uid)) {
    throw new Error('Identificador de utilizador inválido');
  }
  return [
    `cvUrl/${uid}/`,
    `certificados/${uid}/`,
    `photoUrl/${uid}/`,
    `candidaturas/${uid}/`,
    `company-covers/${uid}/`,
    `users/${uid}/`,
    ...VERIFICATION_DOCUMENT_TYPES.map(
      (type) => `verification/${type}/${uid}/`,
    ),
  ];
}

/** O que fica em `users/{uid}`: só o necessário para nomes em histórico. */
export function buildDeletedUserTombstone(nowMs, deletion) {
  return {
    userType: 'deleted',
    status: 'deleted',
    fullName: REMOVED_CANDIDATE_NAME,
    name: REMOVED_CANDIDATE_NAME,
    displayName: REMOVED_CANDIDATE_NAME,
    deletedAtMs: nowMs,
    deletion: {
      status: 'DONE',
      requestedAtMs: deletion?.requestedAtMs ?? null,
      executedAtMs: nowMs,
    },
  };
}
