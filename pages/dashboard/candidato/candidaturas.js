import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Head from "next/head";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiBriefcase,
  FiRefreshCw,
  FiSearch,
} from "react-icons/fi";
import {
  downloadInterviewICS,
  formatMaybeDateTimePt,
  getInterviewStatusLabelPt,
  isLikelyUrl,
} from "../../../lib/interviewClient";
import styles from "../../../styles/CandidaturasPage.module.css";

const ALLOWED_FILTERS = [
  "all",
  "pending",
  "interview",
  "approved",
  "rejected",
];

const hasValidScheduledInterview = (app) => {
  const scheduledAt = app?.interviewDetails?.scheduledAt;
  if (!scheduledAt) return false;
  const time = new Date(scheduledAt).getTime();
  return !Number.isNaN(time);
};

export default function CandidaturasPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [applications, setApplications] = useState([]);
  const [filter, setFilter] = useState("all");

  const setFilterAndSyncUrl = (nextFilter) => {
    setFilter(nextFilter);
    if (!router.isReady) return;
    const query = { ...router.query };
    if (nextFilter && nextFilter !== "all") query.filter = nextFilter;
    else delete query.filter;
    router.replace({ pathname: router.pathname, query }, undefined, {
      shallow: true,
    });
  };

  useEffect(() => {
    if (!router.isReady) return;
    const q = router.query.filter;
    if (typeof q !== "string") return;
    if (ALLOWED_FILTERS.includes(q)) {
      setFilter(q);
    }
  }, [router.isReady, router.query.filter]);

  useEffect(() => {
    async function fetchApplications() {
      try {
        setLoading(true);
        setError("");
        const { getAuth } = await import("firebase/auth");
        const auth = getAuth();
        const currentUser = auth.currentUser;
        const uid = currentUser?.uid;

        if (!uid) {
          router.push("/login");
          return;
        }

        const token = await currentUser.getIdToken();
        const res = await fetch(`/api/profile?uid=${uid}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (res.status === 401) {
          router.push("/login");
          return;
        }

        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            json.error || "Não foi possível carregar as candidaturas.",
          );
        }
        setApplications(json.applications || []);
      } catch (err) {
        console.error("Erro ao carregar candidaturas:", err);
        setError(
          err?.message ||
            "Não foi possível carregar as candidaturas. Tente novamente.",
        );
      } finally {
        setLoading(false);
      }
    }
    fetchApplications();
  }, [router, reloadKey]);

  const { sortedApplications, stats } = useMemo(() => {
    const nextStats = {
      total: applications.length,
      pending: 0,
      interview: 0,
      approved: 0,
      rejected: 0,
    };

    applications.forEach((application) => {
      const status = application?.status || "pending";
      if (status === "pending") nextStats.pending += 1;
      if (status === "approved") nextStats.approved += 1;
      if (status === "rejected") nextStats.rejected += 1;
      if (hasValidScheduledInterview(application)) nextStats.interview += 1;
    });

    const sorted = [...applications].sort((a, b) => {
      const rawA = a?.appliedAt || a?.createdAt;
      const rawB = b?.appliedAt || b?.createdAt;
      const timeA = rawA ? new Date(rawA).getTime() : 0;
      const timeB = rawB ? new Date(rawB).getTime() : 0;
      return (Number.isNaN(timeB) ? 0 : timeB) -
        (Number.isNaN(timeA) ? 0 : timeA);
    });

    return { sortedApplications: sorted, stats: nextStats };
  }, [applications]);

  const filteredApplications = useMemo(
    () =>
      sortedApplications.filter((application) => {
        if (filter === "all") return true;
        if (filter === "interview") {
          return hasValidScheduledInterview(application);
        }
        if (filter === "pending") {
          return application.status === "pending" || !application.status;
        }
        return application.status === filter;
      }),
    [filter, sortedApplications],
  );

  if (loading) {
    return (
      <>
        <Head>
          <title>Minhas Candidaturas - EmpregoSTP</title>
        </Head>
        <div className={styles.loadingPage} aria-live="polite">
          <div className={styles.loadingSpinner} aria-hidden="true" />
          <div>
            <strong>A carregar candidaturas</strong>
            <p className={styles.loadingText}>A organizar o seu histórico mais recente.</p>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Head>
          <title>Minhas Candidaturas - EmpregoSTP</title>
        </Head>
        <div className={styles.page}>
          <div className={styles.container}>
            <Link href="/dashboard/candidato" className={styles.backLink}>
              <FiArrowLeft aria-hidden="true" />
              <span>Voltar ao dashboard</span>
            </Link>
            <section className={styles.errorState} role="alert">
              <span className={styles.errorIcon} aria-hidden="true">
                <FiAlertCircle />
              </span>
              <h1>Não foi possível carregar as candidaturas</h1>
              <p>{error}</p>
              <button
                type="button"
                className={styles.retryButton}
                onClick={() => setReloadKey((value) => value + 1)}
              >
                <FiRefreshCw aria-hidden="true" /> Tentar novamente
              </button>
            </section>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Minhas Candidaturas - EmpregoSTP</title>
      </Head>
      <div className={styles.page}>
        <div className={styles.container}>
          {(() => {
            const isInterviewView = filter === "interview";
            return (
              <>
                <header className={styles.hero}>
                  <Link href="/dashboard/candidato" className={styles.backLink}>
                    <FiArrowLeft aria-hidden="true" />
                    <span>Voltar ao dashboard</span>
                  </Link>

                  <div className={styles.heroMain}>
                  <div className={styles.heroCopy}>
                    <span className={styles.heroEyebrow}>
                      {isInterviewView
                        ? "Agenda de entrevistas"
                        : "Painel de candidaturas"}
                    </span>
                    <h1 className={styles.heroTitle}>
                      {isInterviewView
                        ? "Minhas entrevistas"
                        : "Minhas candidaturas"}
                    </h1>
                    <p className={styles.heroDescription}>
                      {isInterviewView
                        ? "Consulte datas, locais e links das entrevistas agendadas."
                        : "Acompanhe cada processo e saiba qual é o próximo passo."}
                    </p>
                  </div>
                  <Link href="/vagas" className={styles.heroAction}>
                    <FiSearch aria-hidden="true" /> Procurar vagas
                  </Link>
                  </div>
                </header>

                {!isInterviewView ? (
                  <section className={styles.statsGrid}>
                    <StatCard
                      value={stats.total}
                      label="Total"
                      color="#2057d7"
                      darkColor="#8eb4ff"
                      active={filter === "all"}
                      onClick={() => setFilterAndSyncUrl("all")}
                    />
                    <StatCard
                      value={stats.pending}
                      label="Pendentes"
                      color="#1e2b4d"
                      darkColor="#b7c8e8"
                      active={filter === "pending"}
                      onClick={() => setFilterAndSyncUrl("pending")}
                    />
                    <StatCard
                      value={stats.interview}
                      label="Entrevistas"
                      color="#5fb8f5"
                      darkColor="#7dceff"
                      active={filter === "interview"}
                      onClick={() => setFilterAndSyncUrl("interview")}
                    />
                    <StatCard
                      value={stats.approved}
                      label="Aprovadas"
                      color="#8ea800"
                      darkColor="#d9ff2f"
                      active={filter === "approved"}
                      onClick={() => setFilterAndSyncUrl("approved")}
                    />
                    <StatCard
                      value={stats.rejected}
                      label="Rejeitadas"
                      color="#ef4444"
                      darkColor="#fda4af"
                      active={filter === "rejected"}
                      onClick={() => setFilterAndSyncUrl("rejected")}
                    />
                  </section>
                ) : (
                  <section className={styles.interviewBanner}>
                    <div className={styles.interviewBannerText}>
                      Entrevistas agendadas: <strong>{stats.interview}</strong>
                    </div>
                    <Link
                      href="/dashboard/candidato/candidaturas"
                      className={styles.interviewBannerLink}
                    >
                      Ver todas as candidaturas
                    </Link>
                  </section>
                )}

                {filteredApplications.length > 0 ? (
                  <section className={styles.cards}>
                    {filteredApplications.map((application, index) => (
                      <ApplicationDetailCard
                        key={application.id || application.jobId || index}
                        application={application}
                      />
                    ))}
                  </section>
                ) : (
                  <section className={styles.emptyState}>
                    <span className={styles.emptyIcon} aria-hidden="true">
                      <FiBriefcase />
                    </span>
                    <h3 className={styles.emptyTitle}>
                      {filter === "all"
                        ? "Nenhuma candidatura ainda"
                        : `Nenhuma candidatura ${
                            filter === "pending"
                              ? "pendente"
                              : filter === "interview"
                                ? "com entrevista"
                                : filter === "approved"
                                  ? "aprovada"
                                  : filter === "rejected"
                                    ? "rejeitada"
                                    : ""
                          }`}
                    </h3>
                    <p className={styles.emptyDescription}>
                      {filter === "all"
                        ? "Explore as vagas e candidate-se às oportunidades alinhadas com o seu perfil."
                        : "Escolha outro filtro para consultar as restantes candidaturas."}
                    </p>
                    {filter === "all" ? (
                      <Link href="/vagas" className={styles.emptyAction}>
                        Procurar vagas
                      </Link>
                    ) : null}
                  </section>
                )}
              </>
            );
          })()}
        </div>
      </div>
    </>
  );
}

function StatCard({ value, label, color, darkColor, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${styles.statCard} ${active ? styles.statCardActive : ""}`}
      style={{
        "--stat-accent": color,
        "--stat-accent-dark": darkColor,
      }}
    >
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </button>
  );
}

function ApplicationDetailCard({ application }) {
  const getStatusInfo = (status) => {
    switch (status) {
      case "approved":
        return {
          bg: "rgba(217, 255, 47, 0.18)",
          border: "rgba(217, 255, 47, 0.28)",
          color: "#1e2b4d",
          darkBg: "rgba(217, 255, 47, 0.12)",
          darkBorder: "rgba(217, 255, 47, 0.32)",
          darkColor: "#d9ff2f",
          text: "Aprovada",
        };
      case "analysis":
        return {
          bg: "rgba(95, 184, 245, 0.16)",
          border: "rgba(32, 87, 215, 0.24)",
          color: "#2057d7",
          darkBg: "rgba(106, 156, 255, 0.14)",
          darkBorder: "rgba(142, 180, 255, 0.34)",
          darkColor: "#8eb4ff",
          text: "Em análise",
        };
      case "interview":
        return {
          bg: "rgba(95, 184, 245, 0.18)",
          border: "rgba(32, 87, 215, 0.24)",
          color: "#2057d7",
          darkBg: "rgba(125, 206, 255, 0.13)",
          darkBorder: "rgba(125, 206, 255, 0.32)",
          darkColor: "#7dceff",
          text: "Entrevista",
        };
      case "rejected":
        return {
          bg: "rgba(239, 68, 68, 0.15)",
          border: "rgba(239, 68, 68, 0.3)",
          color: "#ef4444",
          darkBg: "rgba(248, 113, 145, 0.13)",
          darkBorder: "rgba(253, 164, 175, 0.32)",
          darkColor: "#fda4af",
          text: "Rejeitada",
        };
      default:
        return {
          bg: "rgba(30, 43, 77, 0.08)",
          border: "rgba(30, 43, 77, 0.18)",
          color: "#1e2b4d",
          darkBg: "rgba(183, 200, 232, 0.1)",
          darkBorder: "rgba(183, 200, 232, 0.24)",
          darkColor: "#b7c8e8",
          text: "Pendente",
        };
    }
  };

  const statusInfo = getStatusInfo(application.status);
  const assessment = application.skillsAssessmentResult;
  const premiumBadges = [
    application.priorityApplied
      ? {
          key: "priority",
          label: "Prioritária",
          bg: "rgba(217, 255, 47, 0.16)",
          border: "rgba(217, 255, 47, 0.28)",
          color: "#1e2b4d",
          darkBg: "rgba(217, 255, 47, 0.12)",
          darkBorder: "rgba(217, 255, 47, 0.3)",
          darkColor: "#d9ff2f",
        }
      : null,
    application.applicationHighlighted
      ? {
          key: "highlight",
          label: "Em destaque",
          bg: "rgba(95, 184, 245, 0.14)",
          border: "rgba(32, 87, 215, 0.24)",
          color: "#2057d7",
          darkBg: "rgba(106, 156, 255, 0.13)",
          darkBorder: "rgba(142, 180, 255, 0.3)",
          darkColor: "#8eb4ff",
        }
      : null,
    application.premiumOnlyJob
      ? {
          key: "premium-job",
          label: "Vaga premium",
          bg: "rgba(30, 43, 77, 0.08)",
          border: "rgba(32, 87, 215, 0.18)",
          color: "#1e2b4d",
          darkBg: "rgba(183, 200, 232, 0.1)",
          darkBorder: "rgba(183, 200, 232, 0.24)",
          darkColor: "#b7c8e8",
        }
      : null,
    application.accessedDuringEarlyWindow
      ? {
          key: "early",
          label: "Acesso antecipado",
          bg: "rgba(95, 184, 245, 0.14)",
          border: "rgba(32, 87, 215, 0.24)",
          color: "#2057d7",
          darkBg: "rgba(125, 206, 255, 0.12)",
          darkBorder: "rgba(125, 206, 255, 0.3)",
          darkColor: "#7dceff",
        }
      : null,
    application.coverLetter
      ? {
          key: "cover-letter",
          label: "Carta incluída",
          bg: "rgba(217, 255, 47, 0.14)",
          border: "rgba(217, 255, 47, 0.24)",
          color: "#1e2b4d",
          darkBg: "rgba(217, 255, 47, 0.11)",
          darkBorder: "rgba(217, 255, 47, 0.28)",
          darkColor: "#d9ff2f",
        }
      : null,
  ].filter(Boolean);
  const [interviewActionLoading, setInterviewActionLoading] = useState(false);
  const [interviewError, setInterviewError] = useState("");
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [localInterview, setLocalInterview] = useState(
    application.interviewDetails || null,
  );

  useEffect(() => {
    setLocalInterview(application.interviewDetails || null);
  }, [application.interviewDetails]);

  const interviewStatus = String(
    localInterview?.status || "scheduled",
  ).toLowerCase();
  const hasInterview = Boolean(localInterview?.scheduledAt);
  const interviewStatusLabel = getInterviewStatusLabelPt(interviewStatus);

  const handleConfirmInterview = async () => {
    if (!application.id || !hasInterview || interviewActionLoading) return;
    setInterviewError("");
    setInterviewActionLoading(true);
    try {
      const { getAuth } = await import("firebase/auth");
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Não autenticado");

      const res = await fetch(
        `/api/applications/${application.id}/interview-response`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action: "confirm" }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível confirmar.");
      setLocalInterview(data.interviewDetails || localInterview);
    } catch (err) {
      setInterviewError(err.message || "Erro ao confirmar.");
    } finally {
      setInterviewActionLoading(false);
    }
  };

  const handleRequestReschedule = async () => {
    if (!application.id || !hasInterview || interviewActionLoading) return;
    const trimmed = String(rescheduleReason || "").trim();
    if (trimmed.length < 5) {
      setInterviewError("Informe um motivo curto (mín. 5 caracteres).");
      return;
    }
    setInterviewError("");
    setInterviewActionLoading(true);
    try {
      const { getAuth } = await import("firebase/auth");
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Não autenticado");

      const res = await fetch(
        `/api/applications/${application.id}/interview-response`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: "request_reschedule",
            reason: trimmed,
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          data.error || "Não foi possível solicitar reagendamento.",
        );
      setLocalInterview(data.interviewDetails || localInterview);
      setRescheduleOpen(false);
      setRescheduleReason("");
    } catch (err) {
      setInterviewError(err.message || "Erro ao solicitar.");
    } finally {
      setInterviewActionLoading(false);
    }
  };

  const handleDownloadICS = async () => {
    if (!application.id || !hasInterview) return;
    setInterviewError("");
    try {
      await downloadInterviewICS(application.id);
    } catch (err) {
      setInterviewError(err.message || "Erro ao baixar calendário.");
    }
  };

  return (
    <article
      className={styles.applicationCard}
      style={{
        "--card-accent": statusInfo.color,
        "--card-accent-bg": statusInfo.bg,
        "--card-accent-border": statusInfo.border,
        "--card-accent-dark": statusInfo.darkColor,
        "--card-accent-bg-dark": statusInfo.darkBg,
        "--card-accent-border-dark": statusInfo.darkBorder,
      }}
    >
      <div className={styles.cardHeader}>
        <div className={styles.cardIdentity}>
          <h3 className={styles.cardTitle}>{application.jobTitle}</h3>
          {application.company ? (
            <p className={styles.cardCompany}>{application.company}</p>
          ) : null}
        </div>

        <div className={styles.statusPill}>{statusInfo.text}</div>
      </div>

      <div className={styles.infoGrid}>
        {application.appliedAt ? (
          <InfoItem
            label="Data de Candidatura"
            value={new Date(application.appliedAt).toLocaleDateString("pt-PT", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          />
        ) : null}
        {application.jobLocation ? (
          <InfoItem label="Localização" value={application.jobLocation} />
        ) : null}
        {application.jobType ? (
          <InfoItem label="Tipo de Contrato" value={application.jobType} />
        ) : null}
      </div>

      {premiumBadges.length > 0 ? (
        <div className={styles.badgesRow}>
          {premiumBadges.map((badge) => (
            <span
              key={badge.key}
              className={styles.featureBadge}
              style={{
                "--badge-bg": badge.bg,
                "--badge-border": badge.border,
                "--badge-color": badge.color,
                "--badge-bg-dark": badge.darkBg,
                "--badge-border-dark": badge.darkBorder,
                "--badge-color-dark": badge.darkColor,
              }}
            >
              {badge.label}
            </span>
          ))}
        </div>
      ) : null}

      {typeof application.compatibilityScore === "number" ||
      application.compatibilityReasons?.length ? (
        <section
          className={styles.insightBox}
          style={{
            "--panel-accent": "rgba(6, 182, 212, 0.24)",
            "--panel-bg": "rgba(6, 182, 212, 0.08)",
          }}
        >
          <h4 className={styles.sectionTitle}>Compatibilidade registada</h4>
          <div className={styles.sectionGrid}>
            {typeof application.compatibilityScore === "number" ? (
              <InfoItem
                label="Score"
                value={`${application.compatibilityScore}%`}
              />
            ) : null}
            {application.compatibilityLabel ? (
              <InfoItem
                label="Leitura"
                value={application.compatibilityLabel}
              />
            ) : null}
          </div>

          {application.compatibilityReasons?.length ? (
            <p className={styles.sectionText}>
              {application.compatibilityReasons.slice(0, 3).join(" • ")}
            </p>
          ) : null}

          {application.compatibilityMatchedSkills?.length ? (
            <div className={styles.skillBlock}>
              <div className={styles.skillLabelPositive}>
                Competencias alinhadas
              </div>
              <div className={styles.skillList}>
                {application.compatibilityMatchedSkills
                  .slice(0, 5)
                  .map((skill) => (
                    <span
                      key={skill}
                      className={`${styles.skillChip} ${styles.skillChipPositive}`}
                    >
                      {skill}
                    </span>
                  ))}
              </div>
            </div>
          ) : null}

          {application.compatibilityMissingSkills?.length ? (
            <div className={styles.skillBlock}>
              <div className={styles.skillLabelNegative}>
                Lacunas a reforcar
              </div>
              <div className={styles.skillList}>
                {application.compatibilityMissingSkills
                  .slice(0, 5)
                  .map((skill) => (
                    <span
                      key={skill}
                      className={`${styles.skillChip} ${styles.skillChipNegative}`}
                    >
                      {skill}
                    </span>
                  ))}
              </div>
            </div>
          ) : null}

          {application.applicationFeedback ? (
            <div className={styles.feedbackBox}>
              {application.applicationFeedback}
            </div>
          ) : null}

          {application.cvOptimizationTips?.length ? (
            <div className={styles.tipsBlock}>
              <div className={styles.skillLabelNeutral}>Como melhorar</div>
              <ul className={styles.tipList}>
                {application.cvOptimizationTips.slice(0, 3).map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {assessment && typeof assessment.score === "number" ? (
        <section
          className={styles.insightBox}
          style={{
            "--panel-accent": "rgba(59, 130, 246, 0.24)",
            "--panel-bg": "rgba(59, 130, 246, 0.10)",
          }}
        >
          <h4 className={styles.sectionTitle}>Teste de habilidades</h4>
          <div className={styles.sectionGrid}>
            <InfoItem label="Pontuação" value={`${assessment.score}%`} />
            <InfoItem
              label="Resultado"
              value={`${assessment.correctAnswers ?? 0}/${assessment.totalQuestions ?? 0} ${assessment.passed ? "(Aprovado)" : "(Não aprovado)"}`}
            />
          </div>
        </section>
      ) : null}

      {application.coverLetter ? (
        <section
          className={styles.insightBox}
          style={{
            "--panel-accent": "rgba(34, 197, 94, 0.22)",
            "--panel-bg": "rgba(34, 197, 94, 0.08)",
          }}
        >
          <h4 className={styles.sectionTitle}>Carta de apresentação enviada</h4>
          <div className={styles.coverLetter}>{application.coverLetter}</div>
        </section>
      ) : null}

      {hasInterview ? (
        <section
          className={styles.insightBox}
          style={{
            "--panel-accent": "rgba(139, 92, 246, 0.28)",
            "--panel-bg": "rgba(139, 92, 246, 0.12)",
          }}
        >
          <h4 className={styles.sectionTitle}>Detalhes da entrevista</h4>

          <div className={styles.interviewTop}>
            <span className={styles.interviewStatus}>
              {interviewStatusLabel}
            </span>
            <button
              type="button"
              onClick={handleDownloadICS}
              className={styles.ghostButton}
            >
              Adicionar ao calendário
            </button>
          </div>

          <div className={styles.sectionGrid}>
            <InfoItem
              label="Data e hora"
              value={formatMaybeDateTimePt(localInterview.scheduledAt)}
            />
            <InfoItem
              label={localInterview.mode === "presencial" ? "Local" : "Link"}
              value={
                localInterview.mode === "presencial" ? (
                  localInterview.location || "Local a confirmar"
                ) : localInterview.link ? (
                  isLikelyUrl(localInterview.link) ? (
                    <a
                      href={localInterview.link}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.inlineLink}
                    >
                      {localInterview.link}
                    </a>
                  ) : (
                    localInterview.link
                  )
                ) : (
                  "Link a confirmar"
                )
              }
            />
          </div>

          {localInterview.notes ? (
            <p className={styles.sectionText}>{localInterview.notes}</p>
          ) : null}
          {interviewError ? (
            <div className={styles.errorText}>{interviewError}</div>
          ) : null}

          <div className={styles.actionRow}>
            <button
              type="button"
              onClick={handleConfirmInterview}
              disabled={
                interviewActionLoading || interviewStatus === "confirmed"
              }
              className={`${styles.actionButton} ${styles.actionButtonPositive}`}
            >
              {interviewActionLoading
                ? "A processar..."
                : interviewStatus === "confirmed"
                  ? "Presença confirmada"
                  : "Confirmar presença"}
            </button>
            <button
              type="button"
              onClick={() => setRescheduleOpen((v) => !v)}
              disabled={interviewActionLoading}
              className={`${styles.actionButton} ${styles.actionButtonWarning}`}
            >
              Pedir reagendamento
            </button>
          </div>

          {rescheduleOpen ? (
            <div className={styles.rescheduleBox}>
              <textarea
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
                placeholder="Explique o motivo e sugira horários alternativos (opcional)."
                rows={3}
                className={styles.textarea}
              />
              <div className={styles.actionRow}>
                <button
                  type="button"
                  onClick={handleRequestReschedule}
                  disabled={interviewActionLoading}
                  className={`${styles.actionButton} ${styles.actionButtonAccent}`}
                >
                  {interviewActionLoading ? "A enviar..." : "Enviar pedido"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRescheduleOpen(false);
                    setRescheduleReason("");
                    setInterviewError("");
                  }}
                  disabled={interviewActionLoading}
                  className={`${styles.actionButton} ${styles.actionButtonNeutral}`}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {application.timeline && application.timeline.length > 0 ? (
        <section className={styles.timelineSection}>
          <h4 className={styles.sectionTitlePlain}>Histórico</h4>
          <div className={styles.timelineList}>
            {application.timeline.map((event, index) => (
              <div key={index} className={styles.timelineItem}>
                <span className={styles.timelineDot} />
                <div className={styles.timelineContent}>
                  <div className={styles.timelineTitle}>{event.title}</div>
                  <div className={styles.timelineDescription}>
                    {event.description}
                  </div>
                  <div className={styles.timelineDate}>
                    {new Date(event.date).toLocaleString("pt-PT")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className={styles.footerActions}>
        {application.jobId ? (
          <Link
            href={`/vaga/${application.jobId}`}
            className={styles.primaryLink}
          >
            Ver Vaga
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function InfoItem({ label, value }) {
  return (
    <div className={styles.infoItem}>
      <div className={styles.infoLabel}>{label}</div>
      <div className={styles.infoValue}>{value}</div>
    </div>
  );
}
