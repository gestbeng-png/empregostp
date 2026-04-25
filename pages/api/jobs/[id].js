import { admin } from "../../../lib/firebaseAdmin";
import {
  canCreateJob,
  canHighlightJob,
  getEmpresaPlanSummary,
  getJobExpirationDate,
} from "../../../lib/empresaPlanFeatures";
import { buildJobApplicationPremiumFields } from "../../../lib/candidateApplicationPremium";
import {
  getEffectiveJobStatus,
  isJobExpired,
  syncExpiredJobStatus,
} from "../../../lib/jobExpiration";
import { normalizeSkillsAssessmentInput } from "../../../lib/skillsAssessment";

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

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

async function getAuthenticatedCompany(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token de autenticação não fornecido" });
    return null;
  }

  const token = authHeader.split("Bearer ")[1];
  const decodedToken = await admin.auth().verifyIdToken(token);
  const userDoc = await admin
    .firestore()
    .collection("users")
    .doc(decodedToken.uid)
    .get();

  if (!userDoc.exists) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return null;
  }

  if (userDoc.data().userType !== "empresa") {
    res.status(403).json({ error: "Somente empresas podem gerir vagas" });
    return null;
  }

  const userData = userDoc.data();
  const planSummary = getEmpresaPlanSummary(userData);

  return {
    uid: decodedToken.uid,
    userData,
    planSummary,
  };
}

export default async function handler(req, res) {
  if (!["GET", "PATCH", "PUT", "DELETE"].includes(req.method)) {
    return res
      .status(405)
      .setHeader("Allow", ["GET", "PATCH", "PUT", "DELETE"])
      .json({ error: "Método não permitido" });
  }

  try {
    const auth = await getAuthenticatedCompany(req, res);
    if (!auth) return;

    const { id } = req.query;
    const jobRef = admin.firestore().collection("jobs").doc(id);
    const jobDoc = await jobRef.get();

    if (!jobDoc.exists) {
      return res.status(404).json({ error: "Vaga não encontrada" });
    }

    const jobData = jobDoc.data();
    if (jobData.companyId !== auth.uid) {
      return res
        .status(403)
        .json({ error: "Você não tem permissão para gerir esta vaga" });
    }

    if (req.method === "GET") {
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

    if (req.method === "DELETE") {
      await jobRef.delete();
      return res.status(200).json({ message: "Vaga eliminada com sucesso" });
    }

    if (req.method === "PUT") {
      const {
        titulo,
        descricao,
        requisitos = "",
        responsabilidades = "",
        localizacao,
        tipoContrato,
        nivelExperiencia = "",
        escolaridade = "",
        salarioDe = "",
        salarioAte = "",
        beneficios = "",
        dataAbertura,
        dataFecho,
        remoto = false,
        destaque = false,
        tdrUrl = "",
        tdrFileName = "",
        vagasDisponiveis = 1,
        palavrasChave = "",
        categoria = "",
        skillsAssessment = null,
        premiumOnly = false,
        earlyAccessHours = 0,
        requireCoverLetter = false,
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
          .json({ error: "Preencha os campos obrigatórios da vaga" });
      }

      const requestedCloseDate = new Date(dataFecho);
      if (Number.isNaN(requestedCloseDate.getTime())) {
        return res.status(400).json({ error: "Data de fecho inválida" });
      }

      const maxExpirationDate = getJobExpirationDate(auth.planSummary.planId);
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

      const premiumApplicationFields = buildJobApplicationPremiumFields(
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
        salarioDe: salarioDe || "",
        salarioAte: salarioAte || "",
        beneficios: `${beneficios}`.trim(),
        dataAbertura:
          dataAbertura ||
          jobData.dataAbertura ||
          new Date().toISOString().split("T")[0],
        dataFecho: finalCloseDate.toISOString().split("T")[0],
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
        ...premiumApplicationFields,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromDate(finalCloseDate),
      };

      await jobRef.update(payload);

      return res.status(200).json({
        message: "Vaga atualizada com sucesso",
        warning:
          requestedCloseDate > maxExpirationDate
            ? `A data de fecho foi ajustada para ${payload.dataFecho} com base no limite do seu plano.`
            : null,
      });
    }

    const { status } = req.body || {};
    const validStatuses = ["active", "closed", "draft"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: "Status inválido" });
    }

    if (status === "active" && jobData.status !== "active") {
      if (isJobExpired(jobData)) {
        return res.status(400).json({
          error:
            "A data de fecho desta vaga ja expirou. Atualize o prazo antes de reativar.",
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

    await jobRef.update({
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      message: "Vaga atualizada com sucesso",
      job: {
        id: jobDoc.id,
        ...jobData,
        status,
      },
    });
  } catch (error) {
    console.error("Erro na API /api/jobs/[id]:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}
