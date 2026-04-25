import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Head from "next/head";
import dynamic from "next/dynamic";
import nookies from "nookies";
import LandingHeader from "../../../components/LandingHeader";
import { admin } from "../../../lib/firebaseAdmin";
import { auth } from "../../../lib/firebase";
import styles from "../../../styles/AdminPanel.module.css";

const AdminSystemFlowChart = dynamic(
  () => import("../../../components/charts/AdminSystemFlowChart"),
  {
    ssr: false,
    loading: () => (
      <div
        className={styles.chartWrap}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#607394",
        }}
      >
        Carregando gráfico...
      </div>
    ),
  },
);

const formatDate = (value, locale = "pt-PT", options = {}) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString(locale, options);
};

const statusConfigMap = {
  active: {
    label: "Ativa",
    bg: "rgba(217, 255, 47, 0.22)",
    color: "#1e2b4d",
    border: "1px solid rgba(217, 255, 47, 0.35)",
  },
  closed: {
    label: "Fechada",
    bg: "rgba(239, 68, 68, 0.2)",
    color: "#fca5a5",
    border: "1px solid rgba(239, 68, 68, 0.3)",
  },
  disabled: {
    label: "Desativada",
    bg: "rgba(100, 116, 139, 0.2)",
    color: "#94a3b8",
    border: "1px solid rgba(100, 116, 139, 0.3)",
  },
  default: {
    label: "Desconhecido",
    bg: "rgba(203, 213, 225, 0.2)",
    color: "#cbd5e1",
    border: "1px solid rgba(203, 213, 225, 0.3)",
  },
};

function StatCard({ title, value, color }) {
  return (
    <div className={styles.statCard} style={{ "--accent-color": color }}>
      <p className={styles.statValue}>{value}</p>
      <p className={styles.statLabel}>{title}</p>
    </div>
  );
}

function AdminActionButton({ href, label, color }) {
  return (
    <Link
      href={href}
      className={styles.actionCard}
      style={{ "--accent-color": color }}
    >
      {label}
    </Link>
  );
}

function StatusBadge({ status }) {
  const config = statusConfigMap[status] || statusConfigMap.default;
  return (
    <span
      className={`${styles.badge} ${styles.badgeSmall}`}
      style={{
        "--badge-bg": config.bg,
        "--badge-color": config.color,
        "--badge-border": config.border,
      }}
    >
      {config.label}
    </span>
  );
}

export default function AdminDashboard({ initialStats = null, lastJobs = [] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(!initialStats);
  const [stats, setStats] = useState(initialStats || {});
  const [error, setError] = useState(null);
  const [hiringTips, setHiringTips] = useState([]);
  const [loadingTips, setLoadingTips] = useState(true);
  const [verifications, setVerifications] = useState([]);
  const [loadingVerifications, setLoadingVerifications] = useState(true);
  const [selectedVerification, setSelectedVerification] = useState(null);
  const [processingAction, setProcessingAction] = useState(false);

  const chartData = useMemo(
    () => [
      { name: "Usuários", value: Number(stats.totalUsers) || 0 },
      { name: "Empresas", value: Number(stats.totalEmpresas) || 0 },
      { name: "Candidatos", value: Number(stats.totalCandidatos) || 0 },
      { name: "Vagas", value: Number(stats.totalJobs) || 0 },
      { name: "Candidaturas", value: Number(stats.totalApplications) || 0 },
    ],
    [stats],
  );

  useEffect(() => {
    let active = true;

    async function loadTips() {
      setLoadingTips(true);
      const tips = [
        {
          title: "Qualidade das vagas",
          content:
            "Revise descrições e requisitos para reduzir candidaturas desalinhadas.",
          category: "GESTÃO",
        },
        {
          title: "Aumente o engajamento",
          content:
            "Destaque vagas estratégicas para acelerar o volume de candidatos.",
          category: "CRESCIMENTO",
        },
        {
          title: "Tempo de resposta",
          content:
            "Mantenha feedback rápido para melhorar a reputação da plataforma.",
          category: "EXPERIÊNCIA",
        },
      ];

      if (active) {
        setHiringTips(tips);
        setLoadingTips(false);
      }
    }

    loadTips();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    fetchVerifications();
  }, []);

  const fetchVerifications = async () => {
    setLoadingVerifications(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        console.error("No authenticated user");
        return;
      }
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/verifications", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.status === 304) {
        return;
      }
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        setVerifications(data.verifications || []);
      } else {
        console.error("Failed to fetch verifications:", await response.text());
      }
    } catch (fetchError) {
      console.error("Error fetching verifications:", fetchError);
    } finally {
      setLoadingVerifications(false);
    }
  };

  const handleVerificationAction = async (verificationId, uid, action) => {
    setProcessingAction(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        alert("Não autenticado");
        return;
      }
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/verify-action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ verificationId, uid, action }),
      });
      if (response.ok) {
        alert(
          `Verificação ${action === "approve" ? "aprovada" : "rejeitada"} com sucesso!`,
        );
        setSelectedVerification(null);
        fetchVerifications();
      } else {
        const errorData = await response.json();
        alert(`Erro: ${errorData.error}`);
      }
    } catch (actionError) {
      console.error("Error processing verification:", actionError);
      alert("Erro ao processar verificação");
    } finally {
      setProcessingAction(false);
    }
  };

  return (
    <>
      <Head>
        <title>Dashboard Admin - EmpregoSTP</title>
      </Head>
      <LandingHeader />

      <main className={styles.page}>
        {loading ? (
          <div className={styles.loadingState}>
            <div className={`${styles.spinner} ${styles.spinnerLarge}`} />
            <p className={styles.loadingText}>Carregando dashboard...</p>
          </div>
        ) : error ? (
          <div className={styles.emptyState}>
            <h2 className={styles.sectionTitle}>Erro</h2>
            <p className={styles.emptyText}>{error}</p>
            <div className={styles.loadMoreWrap}>
              <Link
                href="/login"
                className={`${styles.linkButton} ${styles.buttonPrimary}`}
              >
                Voltar para o Login
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.headerCard}>
              <div className={styles.headerCopy}>
                <h1 className={styles.headerTitle}>Dashboard Administrativo</h1>
                <p className={styles.headerSubtitle}>
                  Visão geral do sistema EmpregoSTP
                </p>
              </div>
              <div className={styles.headerActions}>
                <button
                  type="button"
                  onClick={() => router.reload()}
                  className={`${styles.buttonBase} ${styles.buttonAccent}`}
                  style={{
                    "--button-bg": "rgba(95, 184, 245, 0.18)",
                    "--button-border": "rgba(32, 87, 215, 0.24)",
                    "--button-color": "#2057d7",
                  }}
                >
                  Atualizar
                </button>
              </div>
            </div>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Visão Geral do Sistema</h2>
              <div className={styles.gridStats}>
                <StatCard
                  title="Usuários Totais"
                  value={stats.totalUsers || 0}
                  color="#2057d7"
                />
                <StatCard
                  title="Candidatos"
                  value={stats.totalCandidatos || 0}
                  color="#5fb8f5"
                />
                <StatCard
                  title="Empresas"
                  value={stats.totalEmpresas || 0}
                  color="#d9ff2f"
                />
                <StatCard
                  title="Vagas Totais"
                  value={stats.totalJobs || 0}
                  color="#1e2b4d"
                />
                <StatCard
                  title="Artigos no Blog"
                  value={stats.totalPosts || 0}
                  color="#2057d7"
                />
                <StatCard
                  title="Templates/Recursos"
                  value={stats.totalResources || 0}
                  color="#5fb8f5"
                />
                <StatCard
                  title="Notícias"
                  value={stats.totalNews || 0}
                  color="#1e2b4d"
                />
              </div>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Estatísticas de Vagas</h2>
              <div className={styles.gridStats}>
                <StatCard
                  title="Vagas Ativas"
                  value={stats.activeJobs || 0}
                  color="#d9ff2f"
                />
                <StatCard
                  title="Vagas Fechadas"
                  value={stats.closedJobs || 0}
                  color="#ef4444"
                />
                <StatCard
                  title="Vagas Desativadas"
                  value={stats.disabledJobs || 0}
                  color="#64748b"
                />
                <StatCard
                  title="Candidaturas"
                  value={stats.totalApplications || 0}
                  color="#2057d7"
                />
              </div>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Insights Inteligentes</h2>
              <div className={styles.gridInsights}>
                <div className={styles.surface}>
                  <div className={styles.chartPanel}>
                    <h3 className={styles.chartTitle}>Fluxo do Sistema</h3>
                    <div className={styles.chartWrap}>
                      <AdminSystemFlowChart data={chartData} />
                    </div>
                  </div>
                </div>

                <div className={styles.advisorPanel}>
                  <div className={styles.advisorHeader}>
                    <div className={styles.advisorIcon}>✨</div>
                    <h3 className={styles.advisorTitle}>IA Hiring Advisor</h3>
                  </div>
                  <div className={styles.advisorList}>
                    {loadingTips ? (
                      <div className={styles.advisorSkeleton} />
                    ) : (
                      hiringTips.map((tip, idx) => (
                        <div key={idx} className={styles.advisorItem}>
                          <div className={styles.advisorCategory}>
                            {tip.category}
                          </div>
                          <div className={styles.advisorItemTitle}>
                            {tip.title}
                          </div>
                          <div className={styles.advisorItemText}>
                            {tip.content}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/admin/plans")}
                    className={`${styles.buttonBase} ${styles.buttonPrimary}`}
                  >
                    Gerenciar Planos e Insights
                  </button>
                </div>
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeading}>
                <div className={styles.sectionTitleWrap}>
                  <h2 className={styles.sectionTitle}>
                    Verificações Pendentes
                  </h2>
                  <span className={styles.countBadge}>
                    {verifications.length} pedido
                    {verifications.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <Link
                  href="/dashboard/admin/verificacoes"
                  className={`${styles.linkButton} ${styles.buttonAccent} ${styles.buttonSmall}`}
                  style={{
                    "--button-bg": "rgba(95, 184, 245, 0.18)",
                    "--button-border": "rgba(32, 87, 215, 0.24)",
                    "--button-color": "#2057d7",
                  }}
                >
                  Ver todas →
                </Link>
              </div>

              {loadingVerifications ? (
                <div className={styles.loadingState}>
                  <div className={styles.spinner} />
                  <p className={styles.loadingText}>
                    Carregando verificações...
                  </p>
                </div>
              ) : verifications.length === 0 ? (
                <div className={styles.emptyState}>
                  <p className={styles.emptyText}>
                    Nenhuma verificação pendente no momento.
                  </p>
                </div>
              ) : (
                <div className={styles.tableShell}>
                  <div className={`${styles.tableWrap} ${styles.tableWrapMin}`}>
                    <table className={styles.table}>
                      <thead>
                        <tr className={styles.tableHeadRow}>
                          <th className={styles.tableHeadCell}>Candidato</th>
                          <th className={styles.tableHeadCell}>Email</th>
                          <th className={styles.tableHeadCell}>Data</th>
                          <th
                            className={`${styles.tableHeadCell} ${styles.alignCenter}`}
                          >
                            Ações
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {verifications.map((verification) => (
                          <tr key={verification.id} className={styles.tableRow}>
                            <td
                              className={`${styles.tableCell} ${styles.tableCellStrong} ${styles.nowrap}`}
                            >
                              {verification.candidateName}
                            </td>
                            <td
                              className={`${styles.tableCell} ${styles.tableCellMuted} ${styles.nowrap}`}
                            >
                              {verification.candidateEmail}
                            </td>
                            <td
                              className={`${styles.tableCell} ${styles.tableCellSoft} ${styles.nowrap}`}
                            >
                              {verification.submittedAt
                                ? formatDate(verification.submittedAt, "pt-BR")
                                : "N/A"}
                            </td>
                            <td
                              className={`${styles.tableCell} ${styles.alignCenter}`}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedVerification(verification)
                                }
                                className={`${styles.buttonBase} ${styles.buttonAccent} ${styles.buttonSmall}`}
                                style={{
                                  "--button-bg": "rgba(95, 184, 245, 0.18)",
                                  "--button-border": "rgba(32, 87, 215, 0.24)",
                                  "--button-color": "#2057d7",
                                }}
                              >
                                Ver Detalhes
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Gerenciamento</h2>
              <div className={styles.gridActions}>
                <AdminActionButton
                  href="/dashboard/admin/users"
                  label="Gerenciar Usuários"
                  color="#2057d7"
                />
                <AdminActionButton
                  href="/dashboard/admin/blog"
                  label="Gerenciar Blog"
                  color="#5fb8f5"
                />
                <AdminActionButton
                  href="/dashboard/admin/news"
                  label="Gerenciar Notícias"
                  color="#1e2b4d"
                />
                <AdminActionButton
                  href="/dashboard/admin/resources"
                  label="Gerenciar Recursos"
                  color="#2057d7"
                />
                <AdminActionButton
                  href="/dashboard/admin/jobs"
                  label="Gerenciar Vagas"
                  color="#d9ff2f"
                />
                <AdminActionButton
                  href="/dashboard/admin/services"
                  label="Gerenciar Serviços"
                  color="#5fb8f5"
                />
                <AdminActionButton
                  href="/dashboard/admin/plans"
                  label="Gerenciar Planos"
                  color="#1e2b4d"
                />
                <AdminActionButton
                  href="/dashboard/admin/payment-settings"
                  label="Config. Pagamento"
                  color="#2057d7"
                />
                <AdminActionButton
                  href="/dashboard/admin/subscription-requests"
                  label="Solicitações"
                  color="#5fb8f5"
                />
                <AdminActionButton
                  href="/dashboard/admin/reports"
                  label="Relatórios"
                  color="#1e2b4d"
                />
                <AdminActionButton
                  href="/dashboard/admin/verificacoes"
                  label="Verificações"
                  color="#d9ff2f"
                />
                <AdminActionButton
                  href="/dashboard/admin/auditoria"
                  label="Auditoria"
                  color="#64748b"
                />
              </div>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Últimas Vagas Criadas</h2>
              {lastJobs.length === 0 ? (
                <div className={styles.emptyState}>
                  <p className={styles.emptyText}>Nenhuma vaga encontrada</p>
                </div>
              ) : (
                <div className={styles.tableShell}>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr className={styles.tableHeadRow}>
                          <th className={styles.tableHeadCell}>Título</th>
                          <th className={styles.tableHeadCell}>Empresa</th>
                          <th className={styles.tableHeadCell}>Status</th>
                          <th className={styles.tableHeadCell}>Data</th>
                          <th
                            className={`${styles.tableHeadCell} ${styles.alignRight}`}
                          >
                            Ações
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {lastJobs.map((job) => (
                          <tr key={job.id} className={styles.tableRow}>
                            <td
                              className={`${styles.tableCell} ${styles.tableCellStrong}`}
                            >
                              {job.titulo}
                            </td>
                            <td
                              className={`${styles.tableCell} ${styles.tableCellMuted}`}
                            >
                              {job.companyName || "N/A"}
                            </td>
                            <td className={styles.tableCell}>
                              <StatusBadge status={job.status} />
                            </td>
                            <td
                              className={`${styles.tableCell} ${styles.tableCellMuted}`}
                            >
                              {job.createdAt
                                ? formatDate(job.createdAt, "pt-PT", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })
                                : "N/A"}
                            </td>
                            <td
                              className={`${styles.tableCell} ${styles.alignRight}`}
                            >
                              <Link
                                href={`/dashboard/admin/jobs/${job.id}`}
                                className={`${styles.linkButton} ${styles.buttonPrimary} ${styles.buttonSmall}`}
                              >
                                Ver Detalhes
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {selectedVerification && (
        <div
          className={styles.modalOverlay}
          onClick={() => !processingAction && setSelectedVerification(null)}
        >
          <div
            className={styles.modalCard}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Revisão de Verificação</h2>
              <p className={styles.modalSubtitle}>
                Candidato: <strong>{selectedVerification.candidateName}</strong>
              </p>
            </div>

            <div className={styles.modalBodyStack}>
              <div className={styles.modalInfoCard}>
                <h3 className={styles.modalInfoTitle}>
                  📧 Informações de Contato
                </h3>
                <p className={styles.infoText}>
                  <strong>Email:</strong>{" "}
                  {selectedVerification.documents?.contact?.email ||
                    "Não informado"}
                </p>
                <p className={styles.infoText}>
                  <strong>Telefone:</strong>{" "}
                  {selectedVerification.documents?.contact?.phone ||
                    "Não informado"}
                </p>
              </div>

              {selectedVerification.documents?.idDocument?.url && (
                <div className={styles.modalInfoCard}>
                  <h3 className={styles.modalInfoTitle}>
                    🪪 Documento de Identidade
                  </h3>
                  <p className={styles.infoText}>
                    <strong>Tipo:</strong>{" "}
                    {selectedVerification.documents.idDocument.type ||
                      "Não especificado"}
                  </p>
                  <a
                    href={selectedVerification.documents.idDocument.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${styles.linkButton} ${styles.buttonAccent} ${styles.buttonSmall}`}
                    style={{
                      "--button-bg": "rgba(95, 184, 245, 0.18)",
                      "--button-border": "rgba(32, 87, 215, 0.24)",
                      "--button-color": "#2057d7",
                    }}
                  >
                    Ver Documento
                  </a>
                </div>
              )}

              {selectedVerification.documents?.selfieDocument?.url && (
                <div className={styles.modalInfoCard}>
                  <h3 className={styles.modalInfoTitle}>
                    🤳 Selfie de Verificação
                  </h3>
                  <a
                    href={selectedVerification.documents.selfieDocument.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${styles.linkButton} ${styles.buttonAccent} ${styles.buttonSmall}`}
                    style={{
                      "--button-bg": "rgba(95, 184, 245, 0.18)",
                      "--button-border": "rgba(32, 87, 215, 0.24)",
                      "--button-color": "#2057d7",
                    }}
                  >
                    Ver Selfie
                  </a>
                </div>
              )}

              {selectedVerification.documents?.cvDocument?.url && (
                <div className={styles.modalInfoCard}>
                  <h3 className={styles.modalInfoTitle}>📄 Currículo</h3>
                  <a
                    href={selectedVerification.documents.cvDocument.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${styles.linkButton} ${styles.buttonAccent} ${styles.buttonSmall}`}
                    style={{
                      "--button-bg": "rgba(95, 184, 245, 0.18)",
                      "--button-border": "rgba(32, 87, 215, 0.24)",
                      "--button-color": "#2057d7",
                    }}
                  >
                    Ver Currículo
                  </a>
                </div>
              )}
            </div>

            <div className={styles.buttonGroupEnd}>
              <button
                type="button"
                onClick={() => setSelectedVerification(null)}
                disabled={processingAction}
                className={`${styles.buttonBase} ${styles.buttonGhost}`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() =>
                  handleVerificationAction(
                    selectedVerification.id,
                    selectedVerification.uid,
                    "reject",
                  )
                }
                disabled={processingAction}
                className={`${styles.buttonBase} ${styles.buttonDanger}`}
              >
                ❌ Rejeitar
              </button>
              <button
                type="button"
                onClick={() =>
                  handleVerificationAction(
                    selectedVerification.id,
                    selectedVerification.uid,
                    "approve",
                  )
                }
                disabled={processingAction}
                className={`${styles.buttonBase} ${styles.buttonSuccess}`}
              >
                {processingAction ? "Processando..." : "✅ Aprovar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export async function getServerSideProps(context) {
  try {
    const cookies = nookies.get(context);

    if (!cookies.token) {
      return { redirect: { destination: "/login", permanent: false } };
    }

    const token = await admin.auth().verifyIdToken(cookies.token);
    const { uid } = token;

    const userDoc = await admin.firestore().collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return { redirect: { destination: "/login", permanent: false } };
    }

    const userData = userDoc.data();

    if (userData.userType !== "admin") {
      return { redirect: { destination: "/dashboard", permanent: false } };
    }

    const [
      usersSnapshot,
      candidatosSnapshot,
      empresasSnapshot,
      jobsSnapshot,
      applicationsSnapshot,
      postsSnapshot,
      resourcesSnapshot,
      newsSnapshot,
    ] = await Promise.all([
      admin.firestore().collection("users").get(),
      admin
        .firestore()
        .collection("users")
        .where("userType", "==", "candidato")
        .get(),
      admin
        .firestore()
        .collection("users")
        .where("userType", "==", "empresa")
        .get(),
      admin.firestore().collection("jobs").get(),
      admin.firestore().collection("applications").get(),
      admin.firestore().collection("posts").get(),
      admin.firestore().collection("resources_templates").get(),
      admin.firestore().collection("news").get(),
    ]);

    const serializeTimestamp = (timestamp) => {
      if (!timestamp) return null;
      if (timestamp.toDate) return timestamp.toDate().toISOString();
      if (timestamp.toMillis)
        return new Date(timestamp.toMillis()).toISOString();
      if (typeof timestamp === "string") return timestamp;
      if (timestamp instanceof Date) return timestamp.toISOString();
      return null;
    };

    const serializeJob = (job) => ({
      id: job.id,
      titulo: job.titulo || "",
      status: job.status || "",
      companyId: job.companyId || null,
      createdAt: serializeTimestamp(job.createdAt),
      lastViewedAt: serializeTimestamp(job.lastViewedAt),
      updatedAt: serializeTimestamp(job.updatedAt),
      ...Object.keys(job).reduce((acc, key) => {
        if (
          key !== "id" &&
          key !== "createdAt" &&
          key !== "lastViewedAt" &&
          key !== "updatedAt"
        ) {
          const value = job[key];
          acc[key] =
            value && (value.toDate || value.toMillis)
              ? serializeTimestamp(value)
              : value;
        }
        return acc;
      }, {}),
    });

    const jobsData = jobsSnapshot.docs.map((doc) =>
      serializeJob({ id: doc.id, ...doc.data() }),
    );
    const activeJobs = jobsData.filter((job) => job.status === "active").length;
    const closedJobs = jobsData.filter((job) => job.status === "closed").length;
    const disabledJobs = jobsData.filter(
      (job) => job.status === "disabled",
    ).length;

    const sortedJobs = [...jobsData].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    const lastJobs = sortedJobs.slice(0, 5);

    const jobsWithCompanyNames = await Promise.all(
      lastJobs.map(async (job) => {
        if (job.companyId) {
          const companyDoc = await admin
            .firestore()
            .collection("users")
            .doc(job.companyId)
            .get();
          if (companyDoc.exists) {
            const companyData = companyDoc.data();
            return {
              ...job,
              companyName:
                companyData.name || companyData.fullName || "Empresa",
            };
          }
        }

        return {
          ...job,
          companyName: null,
        };
      }),
    );

    return {
      props: {
        initialStats: {
          totalUsers: usersSnapshot.size,
          totalCandidatos: candidatosSnapshot.size,
          totalEmpresas: empresasSnapshot.size,
          totalJobs: jobsSnapshot.size,
          activeJobs,
          closedJobs,
          disabledJobs,
          totalApplications: applicationsSnapshot.size,
          totalPosts: postsSnapshot.size,
          totalResources: resourcesSnapshot.size,
          totalNews: newsSnapshot.size,
        },
        lastJobs: jobsWithCompanyNames,
      },
    };
  } catch (serverError) {
    console.error("Erro no getServerSideProps:", serverError);
    return { redirect: { destination: "/login", permanent: false } };
  }
}
