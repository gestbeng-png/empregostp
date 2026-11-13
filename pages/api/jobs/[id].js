import { admin } from '../../../lib/firebaseAdmin';
import { requireActiveApiUser } from '../../../lib/apiUserAuth';
import {
  canCreateJob,
  canHighlightJob,
  getEmpresaPlanSummary,
  getJobExpirationDate,
} from '../../../lib/empresaPlanFeatures';
import { buildJobApplicationPolicy } from '../../../lib/applicationPolicy';
import {
  getEffectiveJobStatus,
  isJobExpired,
  syncExpiredJobStatus,
} from '../../../lib/jobExpiration';
import { normalizeSkillsAssessmentInput } from '../../../lib/skillsAssessment';
import { logServerError } from '../../../lib/serverLog';
import { normalizeRequiredDocuments } from '../../../lib/applicationDocuments';
import { planJobExpand } from '../../../domain/jobs/expand';
import { deadlineToUtc } from '../../../domain/jobs/deadlines';
import { readJobLifecycle } from '../../../domain/jobs/legacyView';
import { assertTransition } from '../../../domain/jobs/states';
import { buildJobSnapshot } from '../../../domain/applications/snapshot';
import { getJobClosingService } from '../../../infrastructure/firebase/jobs/createJobClosingService';

function jobManagementError(code, message) {
  return Object.assign(new Error(message), { code });
}

function toIsoDateString(value) {
  if (!value) return null;
  try {
    const date = value.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch (error) {
    return null;
  }
}

function normalizeKeywords(value) {
  if (Array.isArray(value)) {
    return value.map((item) => `${item}`.trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

async function getAuthenticatedCompany(req, res) {
  const auth = await requireActiveApiUser(req, res, { adminApp: admin });
  if (!auth) return null;
  const { uid, userData } = auth;
  if (userData.userType !== 'empresa') {
    res.status(403).json({ error: 'Somente empresas podem gerir vagas' });
    return null;
  }

  const planSummary = getEmpresaPlanSummary(userData);

  return {
    uid,
    userData,
    planSummary,
  };
}

export default async function handler(req, res) {
  if (!['GET', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
    return res
      .status(405)
      .setHeader('Allow', ['GET', 'PATCH', 'PUT', 'DELETE'])
      .json({ error: 'Método não permitido' });
  }

  try {
    const auth = await getAuthenticatedCompany(req, res);
    if (!auth) return;

    const { id } = req.query;
    const jobRef = admin.firestore().collection('jobs').doc(id);
    const jobDoc = await jobRef.get();

    if (!jobDoc.exists) {
      return res.status(404).json({ error: 'Vaga não encontrada' });
    }

    const jobData = jobDoc.data();
    if (jobData.companyId !== auth.uid) {
      return res
        .status(403)
        .json({ error: 'Não tem permissão para gerir esta vaga.' });
    }

    if (req.method === 'GET') {
      const synced = await syncExpiredJobStatus(jobRef, jobData, admin);
      return res.status(200).json({
        job: {
          id: jobDoc.id,
          ...synced.jobData,
          status: getEffectiveJobStatus(synced.jobData),
          createdAt: toIsoDateString(synced.jobData.createdAt),
          updatedAt: toIsoDateString(synced.jobData.updatedAt),
          publishedAt: toIsoDateString(synced.jobData.publishedAt),
          expiresAt: toIsoDateString(synced.jobData.expiresAt),
        },
      });
    }

    if (req.method === 'DELETE') {
      // Apagar só a vaga deixava para trás as candidaturas e os favoritos que
      // lhe apontavam: registos que a interface tenta abrir e nao encontra, e
      // que continuavam a contar para estatisticas. Removidos no mesmo lote.
      const [applicationsSnapshot, savedSnapshot] = await Promise.all([
        admin
          .firestore()
          .collection('applications')
          .where('jobId', '==', id)
          .get(),
        admin
          .firestore()
          .collection('savedJobs')
          .where('jobId', '==', id)
          .get(),
      ]);

      const batch = admin.firestore().batch();
      applicationsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
      savedSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();

      await jobRef.delete();
      return res.status(200).json({
        message: 'Vaga eliminada com sucesso',
        removidos: {
          candidaturas: applicationsSnapshot.size,
          vagasGuardadas: savedSnapshot.size,
        },
      });
    }

    if (req.method === 'PUT') {
      const {
        titulo,
        descricao,
        requisitos = '',
        responsabilidades = '',
        localizacao,
        tipoContrato,
        nivelExperiencia = '',
        escolaridade = '',
        salarioDe = '',
        salarioAte = '',
        beneficios = '',
        dataAbertura,
        dataFecho,
        remoto = false,
        destaque = false,
        tdrUrl = '',
        tdrFileName = '',
        vagasDisponiveis = 1,
        palavrasChave = '',
        categoria = '',
        skillsAssessment = null,
        premiumOnly = false,
        earlyAccessHours = 0,
        requireCoverLetter = false,
        requiredDocuments,
      } = req.body || {};

      if (
        !titulo ||
        !descricao ||
        !localizacao ||
        !tipoContrato ||
        !dataFecho
      ) {
        return res
          .status(400)
          .json({ error: 'Preencha os campos obrigatórios da vaga' });
      }

      const requestedCloseDate = deadlineToUtc(dataFecho);
      if (!requestedCloseDate) {
        return res.status(400).json({ error: 'Data de fecho inválida' });
      }

      const maxExpirationDate = deadlineToUtc(
        getJobExpirationDate(auth.planSummary.planId)
          .toISOString()
          .slice(0, 10),
      );
      const finalCloseDate =
        requestedCloseDate > maxExpirationDate
          ? maxExpirationDate
          : requestedCloseDate;

      if (Boolean(destaque) && !jobData.destaque) {
        const highlightCheck = await canHighlightJob(
          auth.uid,
          auth.planSummary.planId,
          admin,
        );
        if (!highlightCheck.allowed) {
          return res.status(403).json(highlightCheck);
        }
      }

      const premiumApplicationFields = buildJobApplicationPolicy(
        {
          premiumOnly,
          earlyAccessHours,
          requireCoverLetter,
          publishedAt: jobData.publishedAt || jobData.createdAt,
          createdAt: jobData.createdAt,
        },
        jobData.publishedAt?.toDate?.() ||
          jobData.createdAt?.toDate?.() ||
          new Date(),
      );

      const payload = {
        titulo: `${titulo}`.trim(),
        descricao: `${descricao}`.trim(),
        requisitos: `${requisitos}`.trim(),
        responsabilidades: `${responsabilidades}`.trim(),
        localizacao: `${localizacao}`.trim(),
        tipoContrato: `${tipoContrato}`.trim(),
        nivelExperiencia: `${nivelExperiencia}`.trim(),
        escolaridade: `${escolaridade}`.trim(),
        salarioDe: salarioDe || '',
        salarioAte: salarioAte || '',
        beneficios: `${beneficios}`.trim(),
        dataAbertura:
          dataAbertura ||
          jobData.dataAbertura ||
          new Date().toISOString().split('T')[0],
        dataFecho: finalCloseDate.toISOString().split('T')[0],
        remoto: Boolean(remoto),
        destaque: Boolean(destaque),
        tdrUrl: `${tdrUrl}`.trim(),
        tdrFileName: `${tdrFileName}`.trim(),
        vagasDisponiveis:
          Number.parseInt(vagasDisponiveis, 10) > 0
            ? Number.parseInt(vagasDisponiveis, 10)
            : 1,
        palavrasChave: normalizeKeywords(palavrasChave),
        categoria: `${categoria}`.trim(),
        skillsAssessment: normalizeSkillsAssessmentInput(skillsAssessment),
        requiredDocuments: normalizeRequiredDocuments(
          requiredDocuments ?? jobData.requiredDocuments ?? {},
        ),
        ...premiumApplicationFields,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromDate(finalCloseDate),
      };

      // The application flow reads the expanded fields first. Regenerate them
      // from the edited form, and snapshot the same revision atomically.
      await admin.firestore().runTransaction(async (tx) => {
        const fresh = (await tx.get(jobRef)).data();
        if (!fresh)
          throw jobManagementError('NOT_FOUND', 'Vaga não encontrada');
        if (fresh.companyId !== auth.uid)
          throw jobManagementError(
            'FORBIDDEN',
            'Sem permissão para gerir esta vaga.',
          );
        if (typeof fresh.v2Status !== 'string') {
          tx.update(jobRef, payload);
          return;
        }
        const expanded = planJobExpand({
          ...fresh,
          ...payload,
          applicationDeadline: payload.dataFecho,
        }).fields;
        const preservedFields = new Set([
          'v2Status',
          'version',
          'organizationId',
          'applicationMethod',
          'sourceType',
          'expandVersion',
          'secondaryCategoryIds',
        ]);
        const editableFields = Object.fromEntries(
          Object.entries(expanded).filter(
            ([field]) => !preservedFields.has(field),
          ),
        );
        const version =
          (Number.isSafeInteger(fresh.version) ? fresh.version : 0) + 1;
        const currentVersionId = `${id}_v${version}`;
        const update = {
          ...payload,
          ...editableFields,
          version,
          currentVersionId,
          updatedBy: auth.uid,
        };
        tx.update(jobRef, update);
        tx.create(
          admin.firestore().collection('jobVersions').doc(currentVersionId),
          {
            jobId: id,
            versionNumber: version,
            snapshot: buildJobSnapshot(
              id,
              { ...fresh, ...update },
              currentVersionId,
            ),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: auth.uid,
          },
        );
      });

      return res.status(200).json({
        message: 'Vaga atualizada com sucesso',
        warning:
          requestedCloseDate > maxExpirationDate
            ? `A data de fecho foi ajustada para ${payload.dataFecho} com base no limite do seu plano.`
            : null,
      });
    }

    const { status } = req.body || {};
    const validStatuses = ['active', 'closed', 'draft'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }

    if (status === 'closed') {
      const result = await getJobClosingService().close(auth.uid, id, req.body);
      if (!result.ok) {
        return res.status(result.error.code === 'FORBIDDEN' ? 403 : 409).json({
          error: result.error.message,
          code: result.error.code,
        });
      }
      return res.status(200).json({ message: 'Vaga fechada com sucesso' });
    }

    if (status === 'active' && jobData.status !== 'active') {
      if (isJobExpired(jobData)) {
        return res.status(400).json({
          error:
            'A data de fecho desta vaga ja expirou. Atualize o prazo antes de reativar.',
        });
      }
      const planSummary = getEmpresaPlanSummary(auth.userData);
      const createCheck = await canCreateJob(
        auth.uid,
        planSummary.planId,
        admin,
      );
      if (!createCheck.allowed) {
        return res.status(403).json(createCheck);
      }
    }

    const job = await admin.firestore().runTransaction(async (tx) => {
      const fresh = (await tx.get(jobRef)).data();
      if (!fresh) throw jobManagementError('NOT_FOUND', 'Vaga não encontrada');
      if (fresh.companyId !== auth.uid)
        throw jobManagementError(
          'FORBIDDEN',
          'Sem permissão para gerir esta vaga.',
        );
      const lifecycle = readJobLifecycle(fresh);
      if (
        ['PENDING_REVIEW', 'REJECTED', 'ARCHIVED', 'FILLED'].includes(
          lifecycle.status,
        )
      )
        throw jobManagementError(
          'JOB_REQUIRES_MODERATION',
          'Esta vaga não pode ser ativada por esta ação. Consulte o estado da revisão.',
        );
      const to = status === 'active' ? 'PUBLISHED' : 'DRAFT';
      const tracked = typeof fresh.v2Status === 'string';
      if (to === 'PUBLISHED' && lifecycle.status === 'DRAFT')
        throw jobManagementError(
          'INVALID_TRANSITION',
          'Submeta a vaga para publicação antes de a ativar.',
        );
      if (
        status === 'active' &&
        (isJobExpired(fresh) ||
          (lifecycle.applicationDeadline &&
            lifecycle.applicationDeadline <= new Date()) ||
          (lifecycle.expiresAt && lifecycle.expiresAt <= new Date()))
      )
        throw jobManagementError(
          'JOB_EXPIRED',
          'Atualize o prazo antes de reativar a vaga.',
        );
      if (tracked && lifecycle.status !== to) {
        const allowed = assertTransition(lifecycle.status, to, 'EMPLOYER', {
          guards: { deadlineFuture: true, canRenew: true },
        });
        if (!allowed.ok)
          throw jobManagementError(
            'INVALID_TRANSITION',
            'Esta mudança de estado não é permitida. Publique uma nova vaga para iniciar outro processo.',
          );
      }
      const update = {
        status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: auth.uid,
        ...(status === 'active'
          ? {
              jobEndPending: false,
              jobEndState: null,
              jobEndedAt: null,
              jobEndMessageConfirmed: false,
              closedAutomatically: false,
              closedReason: null,
              closedAt: null,
              expiredAt: null,
            }
          : {}),
      };
      if (tracked) {
        update.v2Status = to;
        if (lifecycle.status !== to) {
          update.version = lifecycle.version + 1;
          tx.create(admin.firestore().collection('jobsStatusHistory').doc(), {
            entityId: id,
            from: lifecycle.status,
            to,
            actorId: auth.uid,
            actorType: 'EMPLOYER',
            reason: 'EMPLOYER_STATUS_CHANGE',
            at: admin.firestore.FieldValue.serverTimestamp(),
            version: update.version,
          });
          tx.create(admin.firestore().collection('outboxEvents').doc(), {
            type: 'entity_status_changed',
            schemaVersion: 1,
            payload: {
              entityId: id,
              entityKind: 'Job',
              version: update.version,
            },
            status: 'PENDING',
            attempts: 0,
            createdAtMs: Date.now(),
            nextAttemptAtMs: Date.now(),
          });
        }
      }
      tx.update(jobRef, update);
      return { id, ...fresh, ...update };
    });

    return res.status(200).json({
      message: 'Vaga atualizada com sucesso',
      job,
    });
  } catch (error) {
    if (
      [
        'NOT_FOUND',
        'FORBIDDEN',
        'JOB_REQUIRES_MODERATION',
        'JOB_EXPIRED',
        'INVALID_TRANSITION',
      ].includes(error.code)
    ) {
      return res
        .status(
          error.code === 'NOT_FOUND'
            ? 404
            : error.code === 'FORBIDDEN'
              ? 403
              : 409,
        )
        .json({
          error: error.message,
          code: error.code,
        });
    }
    logServerError('jobs_id.api_api_jobs_id_failed', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
