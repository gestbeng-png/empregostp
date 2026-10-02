import { admin } from "../../../../lib/firebaseAdmin";
import ApplicationSubmission, {
  serializeApplicationSubmission,
} from "../../../../components/empresa/ApplicationSubmission";
import nookies from "nookies";
import Link from "next/link";
import Head from "next/head";
import { useState } from "react";
import { useRouter } from "next/router";
import { FiArrowLeft } from "react-icons/fi";
import DashboardShell from "../../../../components/dashboard/DashboardShell";
import styles from "../../../../styles/EmpresaJobDetail.module.css";

function safeTimestampToMillis(timestamp) {
  if (!timestamp) return null;
  if (typeof timestamp.toMillis === "function") return timestamp.toMillis();
  if (typeof timestamp === "number") return timestamp;
  if (typeof timestamp === "string") return new Date(timestamp).getTime();
  return null;
}

const JOB_STATUS_LABELS = {
  active: "Ativa",
  closed: "Fechada",
  disabled: "Desativada",
};

const APPLICATION_STATUS_LABELS = {
  pending: "Pendente",
  approved: "Aprovada",
  analysis: "Em análise",
  interview: "Entrevista",
  rejected: "Rejeitada",
  withdrawn: "Retirada",
};

function splitCsv(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDate(value) {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatCurrency(value) {
  if (!value) return "Não informado";
  return Number(value).toLocaleString("pt-ST", {
    style: "currency",
    currency: "STN",
  });
}

function StatCard({ title, value, tone = "default" }) {
  return (
    <article
      className={`${styles.statCard} ${styles[`stat${tone.charAt(0).toUpperCase()}${tone.slice(1)}`] || ""}`.trim()}
    >
      <span className={styles.statLabel}>{title}</span>
      <strong className={styles.statValue}>{value}</strong>
    </article>
  );
}

export default function DetalheVaga({ vaga, candidaturas }) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState("");

  const getAuthToken = async () => {
    const { getAuth } = await import("firebase/auth");
    return getAuth().currentUser?.getIdToken();
  };

  const alterarStatus = async (novoStatus) => {
    try {
      setIsProcessing(true);
      setStatusFeedback("");
      const token = await getAuthToken();
      if (!token) {
        setStatusFeedback("A sessão expirou. Inicie sessão novamente.");
        return;
      }

      const response = await fetch(`/api/jobs/${vaga.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: novoStatus }),
      });

      const data = await response.json();
      if (!response.ok) {
        setStatusFeedback(data.error || "Erro ao atualizar status");
        return;
      }

      router.reload();
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      setStatusFeedback(
        error.message || "Erro ao atualizar status. Tente novamente.",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const eliminarVaga = async () => {
    if (
      !confirm(
        "Tem certeza que deseja eliminar esta vaga? Esta acao e irreversivel.",
      )
    )
      return;
    try {
      setIsProcessing(true);
      const token = await getAuthToken();
      if (!token) throw new Error("A sessão expirou");

      const response = await fetch(`/api/jobs/${vaga.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Erro ao eliminar vaga");
      }

      router.push("/dashboard/empresa?tab=jobs");
    } catch (error) {
      console.error("Erro ao eliminar vaga:", error);
      alert(error.message || "Erro ao eliminar vaga. Tente novamente.");
    } finally {
      setIsProcessing(false);
    }
  };

  const alterarStatusCandidatura = async (candidaturaId, novoStatus) => {
    try {
      setIsProcessing(true);
      const token = await getAuthToken();
      if (!token) throw new Error("A sessão expirou");

      const response = await fetch(
        `/api/applications/${candidaturaId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: novoStatus }),
        },
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error || "Erro ao atualizar status da candidatura",
        );
      }

      router.reload();
    } catch (error) {
      console.error("Erro ao atualizar status da candidatura:", error);
      alert(error.message || "Erro ao atualizar status. Tente novamente.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!vaga) {
    return (
      <>
        <Head>
          <title>Vaga nao encontrada - EmpregoSTP</title>
        </Head>
        <DashboardShell
          role="empresa"
          active="jobs"
          title="Detalhe da vaga"
          profile={{ name: "Empresa", role: "Empresa" }}
        >
          <div className="dash-page">
            <Link href="/dashboard/empresa?tab=jobs" className="dash-back">
              <FiArrowLeft /> Voltar às vagas
            </Link>
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <p>Vaga não encontrada.</p>
            </div>
          </div>
        </DashboardShell>
      </>
    );
  }

  const {
    titulo,
    descricao,
    requisitos,
    localizacao,
    tipoContrato,
    salarioDe,
    salarioAte,
    beneficios,
    dataAbertura,
    dataFecho,
    isPrivada,
    status,
    skillsAssessment,
    createdAt,
  } = vaga;

  const requisitosList = splitCsv(requisitos);
  const beneficiosList = splitCsv(beneficios);
  const statusLabel = JOB_STATUS_LABELS[status] || status || "Desconhecido";
  const statusKey = status || "unknown";
  const closingDateMillis = safeTimestampToMillis(dataFecho);
  const canReopenExpiredJob =
    status === "closed" && closingDateMillis && closingDateMillis < Date.now();

  const pendingCount = candidaturas.filter(
    (c) => c.status === "pending" || !c.status,
  ).length;
  const approvedCount = candidaturas.filter(
    (c) => c.status === "approved",
  ).length;
  const rejectedCount = candidaturas.filter(
    (c) => c.status === "rejected",
  ).length;

  const salaryRange =
    salarioDe || salarioAte
      ? `${formatCurrency(salarioDe)} - ${formatCurrency(salarioAte)}`
      : "Não informado";

  return (
    <>
      <Head>
        <title>{titulo} - EmpregoSTP</title>
      </Head>

      <DashboardShell
        role="empresa"
        active="jobs"
        title="Detalhe da vaga"
        subtitle={titulo}
        profile={{ name: "Empresa", role: "Empresa" }}
      >
        <div className="dash-page">
          <Link href="/dashboard/empresa?tab=jobs" className="dash-back">
            <FiArrowLeft /> Voltar às vagas
          </Link>

        <section className={styles.heroCard}>
          <div className={styles.heroHeader}>
            <div className={styles.heroHeading}>
              <div className={styles.heroBadgeRow}>
                <span className={styles.heroBadge}>Detalhe da vaga</span>
                {isPrivada ? (
                  <span
                    className={`${styles.heroBadge} ${styles.heroBadgeMuted}`}
                  >
                    Privada
                  </span>
                ) : null}
              </div>
              <h1 className={styles.heroTitle}>{titulo}</h1>
              <div className={styles.heroMeta}>
                {localizacao ? <span>{localizacao}</span> : null}
                {tipoContrato ? <span>{tipoContrato}</span> : null}
                <span>
                  Publicada em {formatDate(createdAt || dataAbertura)}
                </span>
              </div>
            </div>

            <div
              className={`${styles.statusBadge} ${styles[`status${statusKey.charAt(0).toUpperCase()}${statusKey.slice(1)}`] || styles.statusDefault}`}
            >
              {statusLabel}
            </div>
          </div>

          <div className={styles.heroStats}>
            <StatCard
              title="Candidaturas"
              value={candidaturas.length}
              tone="blue"
            />
            <StatCard title="Pendentes" value={pendingCount} tone="amber" />
            <StatCard title="Aprovadas" value={approvedCount} tone="green" />
            <StatCard title="Rejeitadas" value={rejectedCount} tone="red" />
          </div>
        </section>

        <section className={styles.contentGrid}>
          <div className={styles.mainColumn}>
            <article className={styles.panel}>
              <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Descrição</h2>
              </div>
              <p className={styles.bodyCopy}>{descricao || "Não informado"}</p>
            </article>

            {requisitosList.length > 0 ? (
              <article className={styles.panel}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Requisitos</h2>
                </div>
                <ul className={styles.list}>
                  {requisitosList.map((req, index) => (
                    <li key={`${req}-${index}`}>{req}</li>
                  ))}
                </ul>
              </article>
            ) : null}

            {skillsAssessment?.enabled &&
            skillsAssessment.questions?.length > 0 ? (
              <article className={styles.panel}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Teste de Habilidades</h2>
                  <span className={styles.sectionMeta}>
                    {skillsAssessment.questions.length} pergunta(s)
                  </span>
                </div>
                <div className={styles.assessmentCard}>
                  <p className={styles.assessmentSummary}>
                    Nota mínima:{" "}
                    <strong>{skillsAssessment.passingScore || 70}%</strong>
                  </p>
                  <div className={styles.assessmentList}>
                    {skillsAssessment.questions.map((question, index) => (
                      <div
                        key={question.id || index}
                        className={styles.assessmentItem}
                      >
                        <strong>
                          {index + 1}. {question.prompt}
                        </strong>
                        <span>
                          {Array.isArray(question.options)
                            ? question.options.length
                            : 0}{" "}
                          opções
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </article>
            ) : null}

            {beneficiosList.length > 0 ? (
              <article className={styles.panel}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Benefícios</h2>
                </div>
                <ul className={styles.list}>
                  {beneficiosList.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              </article>
            ) : null}
          </div>

          <aside className={styles.sidebarColumn}>
            <article className={styles.panel}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Resumo da vaga</h2>
              </div>
              <dl className={styles.summaryList}>
                <div className={styles.summaryItem}>
                  <dt>Salário</dt>
                  <dd>{salaryRange}</dd>
                </div>
                <div className={styles.summaryItem}>
                  <dt>Período</dt>
                  <dd>
                    {formatDate(dataAbertura)} até {formatDate(dataFecho)}
                  </dd>
                </div>
                <div className={styles.summaryItem}>
                  <dt>Contrato</dt>
                  <dd>{tipoContrato || "Não informado"}</dd>
                </div>
                <div className={styles.summaryItem}>
                  <dt>Localização</dt>
                  <dd>{localizacao || "Não informado"}</dd>
                </div>
                <div className={styles.summaryItem}>
                  <dt>Privacidade</dt>
                  <dd>{isPrivada ? "Privada" : "Pública"}</dd>
                </div>
              </dl>
            </article>

            {vaga.tdrUrl ? (
              <article className={styles.panel}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Documentação</h2>
                </div>
                <div className={styles.docCard}>
                  <div className={styles.docIcon}>
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                  </div>
                  <div className={styles.docInfo}>
                    <strong>Termos de Referência</strong>
                    <span>Ficheiro PDF/Documento associado a esta vaga.</span>
                  </div>
                </div>
                <a
                  href={vaga.tdrUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.docButton}
                >
                  Visualizar TDR
                </a>
              </article>
            ) : null}

            <article className={styles.panel}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Ações</h2>
              </div>
              {statusFeedback ? (
                <div className={styles.inlineNotice} role="status" aria-live="polite">
                  <p>{statusFeedback}</p>
                </div>
              ) : null}
              {canReopenExpiredJob && !statusFeedback ? (
                <div className={styles.inlineNotice}>
                  <p>
                    Esta vaga já expirou. Atualize a data de fecho antes de a
                    reabrir.
                  </p>
                </div>
              ) : null}
              <div className={styles.actionsGrid}>
                {vaga.status === "active" ? (
                  <button
                    type="button"
                    onClick={() => alterarStatus("closed")}
                    disabled={isProcessing}
                    className={`${styles.actionButton} ${styles.actionWarning}`}
                  >
                    {isProcessing ? "Processando..." : "Fechar Vaga"}
                  </button>
                ) : null}

                {vaga.status === "closed" ? (
                  <button
                    type="button"
                    onClick={() => alterarStatus("active")}
                    disabled={isProcessing}
                    className={`${styles.actionButton} ${styles.actionSuccess}`}
                  >
                    {isProcessing ? "Processando..." : "Reabrir Vaga"}
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/dashboard/empresa/vaga/criar-vaga?edit=${vaga.id}`,
                    )
                  }
                  disabled={isProcessing}
                  className={`${styles.actionButton} ${styles.actionPrimary}`}
                >
                  Editar Vaga
                </button>

                <button
                  type="button"
                  onClick={eliminarVaga}
                  disabled={isProcessing}
                  className={`${styles.actionButton} ${styles.actionDanger}`}
                >
                  {isProcessing ? "Eliminando..." : "Eliminar Vaga"}
                </button>
              </div>
            </article>
          </aside>
        </section>

        <section className={styles.applicationsPanel}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Candidaturas</h2>
            <span className={styles.sectionMeta}>
              {candidaturas.length} no total
            </span>
          </div>

          {candidaturas.length === 0 ? (
            <div className={styles.emptyApplications}>
              <h3>Nenhuma candidatura ainda</h3>
              <p>
                As candidaturas aparecerão aqui assim que alguém responder à vaga.
              </p>
            </div>
          ) : (
            <div className={styles.applicationList}>
              {candidaturas.map((candidatura) => {
                const applicationStatus = candidatura.status || "pending";
                const applicationStatusLabel =
                  APPLICATION_STATUS_LABELS[applicationStatus] ||
                  applicationStatus;
                const result = candidatura.skillsAssessmentResult;
                const premiumBadges = [
                  candidatura.priorityApplied
                    ? {
                        key: "priority",
                        label: "Prioritária",
                        className: styles.applicationBadgePriority,
                      }
                    : null,
                  candidatura.applicationHighlighted
                    ? {
                        key: "highlight",
                        label: "Destaque",
                        className: styles.applicationBadgeHighlight,
                      }
                    : null,
                  candidatura.premiumOnlyJob
                    ? {
                        key: "premium",
                        label: "Vaga premium",
                        className: styles.applicationBadgePremium,
                      }
                    : null,
                  candidatura.accessedDuringEarlyWindow
                    ? {
                        key: "early",
                        label: "Acesso antecipado",
                        className: styles.applicationBadgeEarly,
                      }
                    : null,
                ].filter(Boolean);
                return (
                  <article
                    key={candidatura.id}
                    className={styles.applicationCard}
                  >
                    <div className={styles.applicationMain}>
                      <div className={styles.applicationIdentity}>
                        <Link
                          href={`/dashboard/empresa/candidato/${candidatura.candidateId}`}
                          className={styles.applicationName}
                        >
                          {candidatura.candidateName || "Candidato"}
                        </Link>
                        {candidatura.candidateEmail ? (
                          <p className={styles.applicationEmail}>
                            {candidatura.candidateEmail}
                          </p>
                        ) : null}
                        {candidatura.createdAt ? (
                          <p className={styles.applicationDate}>
                            Candidatou-se em {formatDate(candidatura.createdAt)}
                          </p>
                        ) : null}
                        {premiumBadges.length > 0 ? (
                          <div className={styles.applicationBadgeRow}>
                            {premiumBadges.map((badge) => (
                              <span
                                key={badge.key}
                                className={`${styles.applicationBadge} ${badge.className}`}
                              >
                                {badge.label}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {result ? (
                          <div className={styles.applicationMetrics}>
                            <span
                              className={`${styles.assessmentBadge} ${result.passed ? styles.assessmentPassed : styles.assessmentReview}`}
                            >
                              Teste: {result.score}%
                            </span>
                            <span className={styles.assessmentMeta}>
                              {result.correctAnswers}/{result.totalQuestions}{" "}
                              corretas
                            </span>
                          </div>
                        ) : null}
                        {typeof candidatura.compatibilityScore === "number" ||
                        candidatura.compatibilityReasons?.length ? (
                          <div className={styles.applicationInsight}>
                            <strong>Compatibilidade</strong>
                            {typeof candidatura.compatibilityScore ===
                            "number" ? (
                              <p>
                                Compatibilidade registada:{" "}
                                {candidatura.compatibilityScore}%
                              </p>
                            ) : null}
                            {candidatura.compatibilityReasons?.length ? (
                              <span>
                                {candidatura.compatibilityReasons
                                  .slice(0, 2)
                                  .join(" • ")}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                        <ApplicationSubmission
                          applicationId={candidatura.id}
                          form={candidatura.applicationForm}
                          documents={candidatura.documents}
                          requiredDocuments={candidatura.requiredDocuments}
                        />
                      </div>

                      <div className={styles.applicationAside}>
                        <span
                          className={`${styles.applicationStatus} ${styles[`application${applicationStatus.charAt(0).toUpperCase()}${applicationStatus.slice(1)}`] || styles.applicationPending}`}
                        >
                          {applicationStatusLabel}
                        </span>

                        {applicationStatus === "pending" ||
                        !applicationStatus ? (
                          <div className={styles.applicationActions}>
                            <button
                              type="button"
                              onClick={() =>
                                alterarStatusCandidatura(
                                  candidatura.id,
                                  "approved",
                                )
                              }
                              disabled={isProcessing}
                              className={`${styles.smallActionButton} ${styles.smallActionApprove}`}
                            >
                              Aprovar
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                alterarStatusCandidatura(
                                  candidatura.id,
                                  "rejected",
                                )
                              }
                              disabled={isProcessing}
                              className={`${styles.smallActionButton} ${styles.smallActionReject}`}
                            >
                              Rejeitar
                            </button>
                          </div>
                        ) : null}

                        {applicationStatus === "approved" ? (
                          <button
                            type="button"
                            onClick={() =>
                              alterarStatusCandidatura(
                                candidatura.id,
                                "rejected",
                              )
                            }
                            disabled={isProcessing}
                            className={`${styles.smallActionButton} ${styles.smallActionNeutral}`}
                          >
                            Reverter
                          </button>
                        ) : null}

                        {applicationStatus === "rejected" ? (
                          <button
                            type="button"
                            onClick={() =>
                              alterarStatusCandidatura(
                                candidatura.id,
                                "approved",
                              )
                            }
                            disabled={isProcessing}
                            className={`${styles.smallActionButton} ${styles.smallActionNeutral}`}
                          >
                            Reconsiderar
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
        </div>
      </DashboardShell>
    </>
  );
}

export async function getServerSideProps(context) {
  try {
    const { id } = context.params;
    const cookies = nookies.get(context);

    if (!cookies.token) {
      return { redirect: { destination: "/login", permanent: false } };
    }

    const token = await admin.auth().verifyIdToken(cookies.token);
    const uid = token.uid;

    const userDoc = await admin.firestore().collection("users").doc(uid).get();
    if (!userDoc.exists || userDoc.data().userType !== "empresa") {
      return { redirect: { destination: "/login", permanent: false } };
    }

    const vagaDoc = await admin.firestore().collection("jobs").doc(id).get();
    if (!vagaDoc.exists) {
      return { notFound: true };
    }

    const vagaData = vagaDoc.data();

    if (vagaData.companyId !== uid) {
      return {
        redirect: { destination: "/dashboard/empresa", permanent: false },
      };
    }

    const vaga = {
      id: vagaDoc.id,
      titulo: vagaData.titulo || "",
      descricao: vagaData.descricao || "",
      requisitos: vagaData.requisitos || "",
      localizacao: vagaData.localizacao || "",
      tipoContrato: vagaData.tipoContrato || "",
      salarioDe: vagaData.salarioDe || "",
      salarioAte: vagaData.salarioAte || "",
      beneficios: vagaData.beneficios || "",
      dataAbertura: vagaData.dataAbertura || "",
      dataFecho: vagaData.dataFecho || "",
      isPrivada: vagaData.isPrivada || false,
      status: vagaData.status || "active",
      skillsAssessment: vagaData.skillsAssessment || null,
      companyId: vagaData.companyId || "",
      tdrUrl:
        vagaData.tdrUrl ||
        vagaData.tdr ||
        vagaData.tdrLink ||
        vagaData.tdrPdf ||
        "",
      createdAt: safeTimestampToMillis(vagaData.createdAt)
        ? new Date(safeTimestampToMillis(vagaData.createdAt)).toISOString()
        : null,
    };

    const candidaturasSnap = await admin
      .firestore()
      .collection("applications")
      .where("jobId", "==", id)
      .get();

    const candidaturas = candidaturasSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        candidateId: data.candidateId || "",
        candidateName: data.candidateName || "",
        candidateEmail: data.candidateEmail || "",
        status: data.status || "pending",
        skillsAssessmentResult: data.skillsAssessmentResult || null,
        ...serializeApplicationSubmission(data),
        priorityApplied: Boolean(data.priorityApplied),
        applicationHighlighted: Boolean(data.applicationHighlighted),
        priorityLevel: Number(data.priorityLevel) || 0,
        premiumOnlyJob: Boolean(data.premiumOnlyJob),
        accessedDuringEarlyWindow: Boolean(data.accessedDuringEarlyWindow),
        compatibilityScore: Number.isFinite(Number(data.compatibilityScore))
          ? Number(data.compatibilityScore)
          : null,
        compatibilityReasons: Array.isArray(data.compatibilityReasons)
          ? data.compatibilityReasons
          : [],
        createdAt: safeTimestampToMillis(data.createdAt)
          ? new Date(safeTimestampToMillis(data.createdAt)).toISOString()
          : null,
        updatedAt: safeTimestampToMillis(data.updatedAt)
          ? new Date(safeTimestampToMillis(data.updatedAt)).toISOString()
          : null,
      };
    });

    candidaturas.sort((a, b) => {
      const priorityDiff =
        (Number(b.priorityLevel) || 0) - (Number(a.priorityLevel) || 0);
      if (priorityDiff !== 0) return priorityDiff;
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return {
      props: { vaga, candidaturas },
    };
  } catch (error) {
    console.error("Erro no getServerSideProps:", error);
    return { redirect: { destination: "/login", permanent: false } };
  }
}
