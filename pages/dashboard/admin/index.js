import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Head from "next/head";
import dynamic from "next/dynamic";
import nookies from "nookies";
import {
  FiUsers,
  FiUserCheck,
  FiBriefcase,
  FiFileText,
  FiFolder,
  FiRss,
  FiSend,
  FiCheckCircle,
  FiXCircle,
  FiSlash,
  FiRefreshCw,
  FiShield,
  FiCreditCard,
  FiInbox,
  FiBarChart2,
  FiTool,
  FiStar,
  FiList,
  FiMessageSquare,
} from "react-icons/fi";
import DashboardShell, { Counter } from "../../../components/dashboard/DashboardShell";
import { useAuth } from "../../../context/AuthContext";
import { admin } from "../../../lib/firebaseAdmin";
import { auth } from "../../../lib/firebase";

const AdminSystemFlowChart = dynamic(
  () => import("../../../components/charts/AdminSystemFlowChart"),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          height: 260,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-3)",
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

const statusBadgeMap = {
  active: { label: "Ativa", cls: "badge-active" },
  closed: { label: "Fechada", cls: "badge-closed" },
  disabled: { label: "Desativada", cls: "badge-disabled" },
  default: { label: "Desconhecido", cls: "badge-disabled" },
};

function StatCard({ icon: Icon, value, label, delta, deltaType, accent, accentShadow, iconColor = "#fff", href }) {
  const style = { "--accent": accent, "--accent-shadow": accentShadow };
  const inner = (
    <>
      <div className="stat-icon" style={{ background: accent, color: iconColor, boxShadow: `0 8px 20px ${accentShadow}` }}>
        <Icon />
      </div>
      <div className="stat-value">
        <Counter value={value} />
      </div>
      <div className="stat-label">{label}</div>
      {delta ? <div className={`stat-delta ${deltaType || "up"}`}>{delta}</div> : null}
    </>
  );
  return href ? (
    <Link href={href} className="stat-card" style={style}>
      {inner}
    </Link>
  ) : (
    <div className="stat-card" style={style}>
      {inner}
    </div>
  );
}

function ActionCard({ href, label, icon: Icon, color, bg, border }) {
  return (
    <Link
      href={href}
      className="action-card"
      style={{ "--accent-color": color, "--accent-bg": bg, "--accent-border": border }}
    >
      <div className="action-card-icon">
        <Icon />
      </div>
      <div className="action-card-label">{label}</div>
    </Link>
  );
}

const ACTIONS = [
  { href: "/dashboard/admin/users", label: "Utilizadores", icon: FiUsers, color: "#2057d7", bg: "rgba(32,87,215,0.1)", border: "rgba(32,87,215,0.18)" },
  { href: "/dashboard/admin/jobs", label: "Vagas", icon: FiBriefcase, color: "#5fb8f5", bg: "rgba(95,184,245,0.12)", border: "rgba(95,184,245,0.24)" },
  { href: "/dashboard/admin/verificacoes", label: "Verificações", icon: FiShield, color: "#3dbb7a", bg: "rgba(61,187,122,0.12)", border: "rgba(61,187,122,0.22)" },
  { href: "/dashboard/admin/blog", label: "Blog", icon: FiFileText, color: "#2057d7", bg: "rgba(32,87,215,0.1)", border: "rgba(32,87,215,0.18)" },
  { href: "/dashboard/admin/news", label: "Notícias", icon: FiRss, color: "#7a9000", bg: "rgba(217,255,47,0.16)", border: "rgba(186,230,39,0.32)" },
  { href: "/dashboard/admin/resources", label: "Recursos", icon: FiFolder, color: "#5fb8f5", bg: "rgba(95,184,245,0.12)", border: "rgba(95,184,245,0.24)" },
  { href: "/dashboard/admin/services", label: "Serviços", icon: FiTool, color: "#2057d7", bg: "rgba(32,87,215,0.1)", border: "rgba(32,87,215,0.18)" },
  { href: "/dashboard/admin/hr-services", label: "Serviços RH", icon: FiBriefcase, color: "#3dbb7a", bg: "rgba(61,187,122,0.12)", border: "rgba(61,187,122,0.22)" },
  { href: "/dashboard/admin/testimonials", label: "Testemunhos", icon: FiMessageSquare, color: "#3dbb7a", bg: "rgba(61,187,122,0.12)", border: "rgba(61,187,122,0.22)" },
  { href: "/dashboard/admin/affiliates", label: "Afiliados", icon: FiUserCheck, color: "#7a9000", bg: "rgba(217,255,47,0.16)", border: "rgba(186,230,39,0.32)" },
  { href: "/dashboard/admin/plans", label: "Planos", icon: FiStar, color: "#7a9000", bg: "rgba(217,255,47,0.16)", border: "rgba(186,230,39,0.32)" },
  { href: "/dashboard/admin/payment-settings", label: "Pagamentos", icon: FiCreditCard, color: "#2057d7", bg: "rgba(32,87,215,0.1)", border: "rgba(32,87,215,0.18)" },
  { href: "/dashboard/admin/subscription-requests", label: "Solicitações", icon: FiInbox, color: "#5fb8f5", bg: "rgba(95,184,245,0.12)", border: "rgba(95,184,245,0.24)" },
  { href: "/dashboard/admin/reports", label: "Relatórios", icon: FiBarChart2, color: "#2057d7", bg: "rgba(32,87,215,0.1)", border: "rgba(32,87,215,0.18)" },
  { href: "/dashboard/admin/auditoria", label: "Auditoria", icon: FiList, color: "#64748b", bg: "rgba(100,116,139,0.12)", border: "rgba(100,116,139,0.24)" },
];

export default function AdminDashboard({ initialStats = null, lastJobs = [] }) {
  const router = useRouter();
  const { user } = useAuth();
  const [loading] = useState(!initialStats);
  const [stats] = useState(initialStats || {});
  const [error] = useState(null);
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
          content: "Revise descrições e requisitos para reduzir candidaturas desalinhadas.",
          category: "GESTÃO",
        },
        {
          title: "Aumente o engajamento",
          content: "Destaque vagas estratégicas para acelerar o volume de candidatos.",
          category: "CRESCIMENTO",
        },
        {
          title: "Tempo de resposta",
          content: "Mantenha feedback rápido para melhorar a reputação da plataforma.",
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
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.error("No authenticated user");
        return;
      }
      const token = await currentUser.getIdToken();
      const response = await fetch("/api/admin/verifications", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 304) return;
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
      const currentUser = auth.currentUser;
      if (!currentUser) {
        alert("Não autenticado");
        return;
      }
      const token = await currentUser.getIdToken();
      const response = await fetch("/api/admin/verify-action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ verificationId, uid, action }),
      });
      if (response.ok) {
        alert(`Verificação ${action === "approve" ? "aprovada" : "rejeitada"} com sucesso!`);
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

  const today = new Date().toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <Head>
        <title>Dashboard Admin - EmpregoSTP</title>
      </Head>

      <DashboardShell
        role="admin"
        active="overview"
        title="Visão geral"
        subtitle={`Bem-vindo, ${user?.displayName || "Admin"} · ${today}`}
        profile={{ name: user?.displayName || "Administrador", role: "Administrador", plan: "ADMIN" }}
        navBadges={{ verificacoes: verifications.length || undefined }}
        topbarActions={
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => router.reload()}
            aria-label="Atualizar"
          >
            <FiRefreshCw /> Atualizar
          </button>
        }
      >
        {loading ? (
          <div className="loading-state">
            <div className="spinner spinner-lg" />
            <p>Carregando dashboard...</p>
          </div>
        ) : error ? (
          <div className="empty-state">
            <div className="empty-state-icon">⚠️</div>
            <p>{error}</p>
            <div style={{ marginTop: 16 }}>
              <Link href="/login" className="btn btn-primary">
                Voltar para o Login
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="header-card">
              <div>
                <div className="header-eyebrow">Dashboard · Admin</div>
                <h1 className="header-title">Painel de Controlo</h1>
                <p className="header-sub">Visão geral da plataforma EmpregoSTP em tempo real.</p>
              </div>
              <div className="header-actions">
                <Link href="/dashboard/admin/verificacoes" className="btn btn-lime">
                  <FiShield /> Verificações ({verifications.length})
                </Link>
                <Link href="/dashboard/admin/jobs" className="btn btn-primary">
                  <FiBriefcase /> Gerir vagas
                </Link>
              </div>
            </div>

            <div className="stats-grid">
              <StatCard icon={FiUsers} value={stats.totalUsers || 0} label="Utilizadores totais" delta="Contas registadas" accent="linear-gradient(135deg,#2057d7,#4f8ef7)" accentShadow="rgba(32,87,215,0.28)" href="/dashboard/admin/users" />
              <StatCard icon={FiUserCheck} value={stats.totalCandidatos || 0} label="Candidatos" delta="Perfis de candidato" accent="linear-gradient(135deg,#5fb8f5,#7dceff)" accentShadow="rgba(95,184,245,0.28)" href="/dashboard/admin/users" />
              <StatCard icon={FiBriefcase} value={stats.totalEmpresas || 0} label="Empresas registadas" delta="Contas de empresa" deltaType="warn" accent="linear-gradient(135deg,#d9ff2f,#bae619)" iconColor="#162a55" accentShadow="rgba(186,230,39,0.28)" href="/dashboard/admin/users" />
              <StatCard icon={FiSend} value={stats.totalApplications || 0} label="Candidaturas enviadas" delta="Total acumulado" accent="linear-gradient(135deg,#3dbb7a,#22c55e)" accentShadow="rgba(61,187,122,0.28)" href="/dashboard/admin/jobs" />
            </div>

            <div className="dash-section">
              <h2 className="dash-section-title">Estatísticas de vagas</h2>
              <div className="stats-grid">
                <StatCard icon={FiCheckCircle} value={stats.activeJobs || 0} label="Vagas ativas" accent="linear-gradient(135deg,#3dbb7a,#22c55e)" accentShadow="rgba(61,187,122,0.28)" href="/dashboard/admin/jobs" />
                <StatCard icon={FiXCircle} value={stats.closedJobs || 0} label="Vagas fechadas" accent="linear-gradient(135deg,#ef4444,#dc6a7c)" accentShadow="rgba(220,106,124,0.28)" href="/dashboard/admin/jobs" />
                <StatCard icon={FiSlash} value={stats.disabledJobs || 0} label="Vagas desativadas" accent="linear-gradient(135deg,#94a3b8,#64748b)" accentShadow="rgba(100,116,139,0.24)" href="/dashboard/admin/jobs" />
                <StatCard icon={FiBriefcase} value={stats.totalJobs || 0} label="Vagas totais" accent="linear-gradient(135deg,#2057d7,#5fb8f5)" accentShadow="rgba(32,87,215,0.28)" href="/dashboard/admin/jobs" />
              </div>
            </div>

            <div className="dash-section">
              <h2 className="dash-section-title">Conteúdo publicado</h2>
              <div className="stats-grid cols-3">
                <StatCard icon={FiFileText} value={stats.totalPosts || 0} label="Artigos no blog" accent="linear-gradient(135deg,#2057d7,#5fb8f5)" accentShadow="rgba(32,87,215,0.28)" href="/dashboard/admin/blog" />
                <StatCard icon={FiFolder} value={stats.totalResources || 0} label="Templates / recursos" accent="linear-gradient(135deg,#5fb8f5,#7dceff)" accentShadow="rgba(95,184,245,0.28)" href="/dashboard/admin/resources" />
                <StatCard icon={FiRss} value={stats.totalNews || 0} label="Notícias" accent="linear-gradient(135deg,#d9ff2f,#bae619)" iconColor="#162a55" accentShadow="rgba(186,230,39,0.28)" href="/dashboard/admin/news" />
              </div>
            </div>

            <div className="grid-2">
              <div className="panel">
                <div className="panel-title">
                  Fluxo do sistema
                  <span className="panel-badge">Tempo real</span>
                </div>
                <AdminSystemFlowChart data={chartData} />
              </div>

              <div className="panel">
                <div className="panel-title">
                  IA Hiring Advisor
                  <span className="panel-badge">✨ Insights</span>
                </div>
                {loadingTips ? (
                  <div className="skeleton" style={{ height: 180 }} />
                ) : (
                  <>
                    {hiringTips.map((tip, idx) => (
                      <div key={idx} className="advisor-item">
                        <div className="advisor-cat">{tip.category}</div>
                        <div className="advisor-title">{tip.title}</div>
                        <div className="advisor-text">{tip.content}</div>
                      </div>
                    ))}
                    <Link href="/dashboard/admin/plans" className="btn btn-primary" style={{ width: "100%", marginTop: 6 }}>
                      Gerir planos e insights
                    </Link>
                  </>
                )}
              </div>
            </div>

            <div className="dash-section">
              <div className="dash-flex-between" style={{ marginBottom: 16 }}>
                <div className="dash-flex">
                  <h2 className="dash-section-title" style={{ margin: 0 }}>Verificações pendentes</h2>
                  <span className="dash-count-badge">
                    {verifications.length} pedido{verifications.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <Link href="/dashboard/admin/verificacoes" className="btn btn-ghost btn-sm">
                  Ver todas →
                </Link>
              </div>

              {loadingVerifications ? (
                <div className="loading-state">
                  <div className="spinner" />
                  <p>Carregando verificações...</p>
                </div>
              ) : verifications.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">✅</div>
                  <p>Nenhuma verificação pendente no momento.</p>
                </div>
              ) : (
                <div className="table-shell">
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Candidato</th>
                          <th>Email</th>
                          <th>Data</th>
                          <th className="td-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {verifications.map((verification) => (
                          <tr key={verification.id}>
                            <td className="td-strong">{verification.candidateName}</td>
                            <td className="td-muted">{verification.candidateEmail}</td>
                            <td className="td-muted">
                              {verification.submittedAt
                                ? formatDate(verification.submittedAt, "pt-BR")
                                : "N/A"}
                            </td>
                            <td className="td-center">
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => setSelectedVerification(verification)}
                              >
                                Ver detalhes
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="dash-section">
              <h2 className="dash-section-title">Gestão rápida</h2>
              <div className="action-cards">
                {ACTIONS.map((a) => (
                  <ActionCard key={a.href} {...a} />
                ))}
              </div>
            </div>

            <div className="dash-section">
              <h2 className="dash-section-title">Últimas vagas criadas</h2>
              {lastJobs.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📋</div>
                  <p>Nenhuma vaga encontrada.</p>
                </div>
              ) : (
                <div className="table-shell">
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Título</th>
                          <th>Empresa</th>
                          <th>Estado</th>
                          <th>Data</th>
                          <th className="td-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lastJobs.map((job) => {
                          const badge = statusBadgeMap[job.status] || statusBadgeMap.default;
                          return (
                            <tr key={job.id}>
                              <td className="td-strong">{job.titulo}</td>
                              <td className="td-muted">{job.companyName || "N/A"}</td>
                              <td>
                                <span className={`badge ${badge.cls}`}>
                                  <span className="badge-dot" />
                                  {badge.label}
                                </span>
                              </td>
                              <td className="td-muted">
                                {job.createdAt
                                  ? formatDate(job.createdAt, "pt-PT", {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                    })
                                  : "N/A"}
                              </td>
                              <td className="td-right">
                                <Link href={`/dashboard/admin/jobs/${job.id}`} className="btn btn-primary btn-sm">
                                  Ver detalhes
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {selectedVerification && (
          <div
            className="modal-overlay"
            onClick={() => !processingAction && setSelectedVerification(null)}
          >
            <div className="modal-card" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <h2 className="modal-title">Revisão de verificação</h2>
                  <p className="modal-sub">
                    Candidato: <strong>{selectedVerification.candidateName}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => !processingAction && setSelectedVerification(null)}
                >
                  ✕
                </button>
              </div>

              <div className="modal-info-card">
                <h3 className="modal-info-title">📧 Informações de contacto</h3>
                <p className="dash-muted" style={{ fontSize: "0.9rem" }}>
                  <strong>Email:</strong>{" "}
                  {selectedVerification.documents?.contact?.email || "Não informado"}
                </p>
                <p className="dash-muted" style={{ fontSize: "0.9rem" }}>
                  <strong>Telefone:</strong>{" "}
                  {selectedVerification.documents?.contact?.phone || "Não informado"}
                </p>
              </div>

              {selectedVerification.documents?.idDocument?.url && (
                <div className="modal-info-card">
                  <h3 className="modal-info-title">🪪 Documento de identidade</h3>
                  <p className="dash-muted" style={{ fontSize: "0.9rem", marginBottom: 10 }}>
                    <strong>Tipo:</strong>{" "}
                    {selectedVerification.documents.idDocument.type || "Não especificado"}
                  </p>
                  <a
                    href={selectedVerification.documents.idDocument.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost btn-sm"
                  >
                    Ver documento
                  </a>
                </div>
              )}

              {selectedVerification.documents?.selfieDocument?.url && (
                <div className="modal-info-card">
                  <h3 className="modal-info-title">🤳 Selfie de verificação</h3>
                  <a
                    href={selectedVerification.documents.selfieDocument.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost btn-sm"
                  >
                    Ver selfie
                  </a>
                </div>
              )}

              {selectedVerification.documents?.cvDocument?.url && (
                <div className="modal-info-card">
                  <h3 className="modal-info-title">📄 Currículo</h3>
                  <a
                    href={selectedVerification.documents.cvDocument.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost btn-sm"
                  >
                    Ver currículo
                  </a>
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setSelectedVerification(null)}
                  disabled={processingAction}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() =>
                    handleVerificationAction(
                      selectedVerification.id,
                      selectedVerification.uid,
                      "reject",
                    )
                  }
                  disabled={processingAction}
                >
                  ❌ Rejeitar
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={() =>
                    handleVerificationAction(
                      selectedVerification.id,
                      selectedVerification.uid,
                      "approve",
                    )
                  }
                  disabled={processingAction}
                >
                  {processingAction ? "Processando..." : "✅ Aprovar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </DashboardShell>
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
      if (timestamp.toMillis) return new Date(timestamp.toMillis()).toISOString();
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
    const disabledJobs = jobsData.filter((job) => job.status === "disabled").length;

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
              companyName: companyData.name || companyData.fullName || "Empresa",
            };
          }
        }
        return { ...job, companyName: null };
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
