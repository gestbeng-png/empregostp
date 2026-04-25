import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useAuth } from "../../../context/AuthContext";
import { getCareerAdvice } from "../../../lib/geminiService";
import { extractLinkedInProfileHints } from "../../../lib/linkedin";
import {
  downloadInterviewICS,
  isLikelyUrl,
} from "../../../lib/interviewClient";
import { VERIFICATION_TYPE_CONFIG } from "../../../lib/candidateVerification";
import { getFirebaseStorageErrorMessage } from "../../../lib/firebaseStorageError";
import styles from "../../../styles/DashboardCandidato.module.css";

const CandidateApplicationsChart = dynamic(
  () => import("../../../components/charts/CandidateApplicationsChart"),
  {
    ssr: false,
    loading: () => (
      <div
        className={styles.chartWrapper}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#94a3b8",
        }}
      >
        Carregando gráfico...
      </div>
    ),
  },
);

const CandidatePremiumPlansExperience = dynamic(
  () => import("../../../components/CandidatePremiumPlansExperience"),
  {
    ssr: false,
    loading: () => (
      <div
        className={styles.planCard}
        style={{ padding: "1rem", color: "#94a3b8" }}
      >
        Carregando planos...
      </div>
    ),
  },
);

const icons = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="7" r="4" />
      <path d="M5.5 21a8.5 8.5 0 0113 0" />
    </svg>
  ),
  verification: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  applications: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12h6M9 16h6" />
    </svg>
  ),
  messages: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  ),
  notifications: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  ),
  plans: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 17l2-11 5 5 3-7 3 7 5-5 2 11z" />
      <path d="M2 17h20" />
    </svg>
  ),
  saved: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
    </svg>
  ),
  briefcase: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
    </svg>
  ),
  eye: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  trophy: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9H4.5a2.5 2.5 0 010-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 000-5H18" />
      <path d="M4 22h16" />
      <path d="M10 22V8a4 4 0 018 0v14" />
    </svg>
  ),
  mic: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0014 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
};

const STATUS_LABELS = {
  pending: "Pendente",
  analysis: "Em Analise",
  interview: "Entrevista",
  approved: "Aprovada",
  rejected: "Rejeitada",
};

const getInitials = (value = "") =>
  String(value)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "U";

const VERIFICATION_TYPE_ORDER = [
  "identity",
  "certificates",
  "academic",
  "experience",
  "competencies",
];

const VERIFICATION_STATUS_META = {
  draft: {
    label: "Nao iniciado",
    toneClass: "verificationStatusMuted",
    summary: "Ainda nao existe um pedido completo para revisao.",
  },
  not_requested: {
    label: "Disponivel",
    toneClass: "verificationStatusMuted",
    summary: "Este bloco ainda nao foi solicitado.",
  },
  pending: {
    label: "Em analise",
    toneClass: "verificationStatusPending",
    summary: "A equipa esta a rever este bloco de verificacao.",
  },
  approved: {
    label: "Aprovado",
    toneClass: "verificationStatusApproved",
    summary: "Este bloco ja foi validado com sucesso.",
  },
  verified: {
    label: "Verificado",
    toneClass: "verificationStatusApproved",
    summary: "Este bloco ja foi validado com sucesso.",
  },
  rejected: {
    label: "Rejeitado",
    toneClass: "verificationStatusRejected",
    summary: "Faltam ajustes ou novos comprovativos para este bloco.",
  },
  partial: {
    label: "Parcial",
    toneClass: "verificationStatusMixed",
    summary: "Ha blocos aprovados e outros que exigem correcao.",
  },
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-PT");
};

const getVerificationStatusMeta = (status) => {
  if (!status) return VERIFICATION_STATUS_META.draft;
  return VERIFICATION_STATUS_META[status] || VERIFICATION_STATUS_META.draft;
};

const createVerificationForm = (profileData, userState) => ({
  contactEmail: profileData?.email || userState?.email || "",
  contactPhone: profileData?.phone || userState?.phone || "",
  certificationsText: profileData?.certifications || "",
  educationSummary: profileData?.education || "",
  experienceSummary: "",
  portfolioUrl: profileData?.website || "",
  linkedin: profileData?.linkedin || "",
  competencyNotes: "",
  identityDocument: null,
  selfieDocument: null,
  certificateDocuments: [],
  academicDocument: null,
  employmentProof: null,
  cvDocument: null,
  competencyDocument: null,
});

const formatInterviewDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const NAV_MENU = [
  { id: "dashboard", label: "Visao Geral", icon: "dashboard" },
  { id: "profile", label: "Meu Perfil", icon: "profile" },
  { id: "verification", label: "Ser Verificado", icon: "verification" },
  { id: "applications", label: "Candidaturas", icon: "applications" },
  { id: "saved", label: "Vagas Salvas", icon: "saved" },
  { id: "messages", label: "Mensagens", icon: "messages" },
  { id: "notifications", label: "Notificacoes", icon: "notifications" },
  { id: "plans", label: "Planos", icon: "plans" },
];

const getPlanFeatureList = (features) => {
  if (Array.isArray(features)) {
    return features;
  }

  if (!features || typeof features !== "object") {
    return ["Recursos padrão"];
  }

  const list = [];
  if (features.maxApplicationsPerMonth !== undefined) {
    if (features.maxApplicationsPerMonth === null) {
      list.push("Candidaturas ilimitadas");
    } else {
      list.push(`Até ${features.maxApplicationsPerMonth} candidaturas/mês`);
    }
  }
  if (features.canSaveJobs) {
    list.push("Salvar vagas favoritas");
  }
  if (features.canApplyToFeaturedJobs) {
    list.push("Candidaturas a vagas em destaque");
  }
  if (features.canUploadCertificates) {
    list.push("Upload seguro de certificados");
  }
  if (features.prioritySupport) {
    list.push("Suporte prioritário");
  }
  if (list.length === 0 && features.name) {
    list.push(features.name);
  }

  return list.length ? list : ["Recursos padrão"];
};

const emptyExperience = { company: "", role: "", period: "", description: "" };

const buildProfileForm = (profileData, userState) => {
  const skillsArray = profileData?.skillsHard || userState?.skills || [];
  const experiences = profileData?.experience || userState?.experience || [];

  const normalizedSkills = Array.isArray(skillsArray)
    ? skillsArray.join(", ")
    : typeof skillsArray === "string"
      ? skillsArray
      : "";

  const sanitizedExperiences = experiences.length
    ? experiences.map((exp) => ({
        company: exp?.company || "",
        role: exp?.role || "",
        period: exp?.period || "",
        description: exp?.description || "",
      }))
    : [{ ...emptyExperience }];

  return {
    name: profileData?.fullName || userState?.name || "",
    headline:
      profileData?.headline ||
      profileData?.profession ||
      userState?.headline ||
      "",
    bio: profileData?.bio || userState?.bio || "",
    location: profileData?.city || userState?.location || "",
    phone: profileData?.phone || userState?.phone || "",
    skills: normalizedSkills,
    experiences: sanitizedExperiences,
    // Extended Form Fields
    birthDate: profileData?.birthDate || "",
    nationality: profileData?.nationality || "",
    gender: profileData?.gender || "",
    maritalStatus: profileData?.maritalStatus || "",
    linkedin: profileData?.linkedin || "",
    website: profileData?.website || "",
    objectiveArea: profileData?.objectiveArea || "",
    objectiveType: profileData?.objectiveType || "",
    objectiveAspiration: profileData?.objectiveAspiration || "",
    skillsSoft: profileData?.skillsSoft || "",
    digitalSkills: profileData?.digitalSkills || [],
    education: profileData?.education || "",
    languages: profileData?.languages || "",
    certifications: profileData?.certifications || "",
    certificateFiles: profileData?.certificateFiles || [],
  };
};

const StatCard = ({
  label,
  value,
  change,
  trend,
  icon,
  color = "#2057d7",
  sublabel,
  sublabelWarning,
}) => (
  <div className={styles.statCard}>
    <div className={styles.statHeader}>
      <div
        className={styles.statIcon}
        style={{ background: `${color}15`, color: color }}
      >
        {icon}
      </div>
      {change !== undefined && (
        <span
          className={`${styles.statTrend} ${trend === "up" ? styles.up : trend === "down" ? styles.down : ""}`}
        >
          {trend === "up" ? "+" : trend === "down" ? "-" : ""}
          {change}%
        </span>
      )}
      {sublabel !== undefined && (
        <span
          style={{
            fontSize: "0.7rem",
            padding: "2px 7px",
            borderRadius: "6px",
            fontWeight: 600,
            background: sublabelWarning
              ? "rgba(239,68,68,0.15)"
              : "rgba(95,184,245,0.12)",
            color: sublabelWarning ? "#f87171" : "#2057d7",
          }}
        >
          {sublabel}
        </span>
      )}
    </div>
    <p className={styles.statValue}>{value}</p>
    <p className={styles.statLabel}>{label}</p>
  </div>
);

const ApplicationTable = ({ applications }) => (
  <div className={styles.tableContainer}>
    <table className={styles.applicationTable}>
      <thead>
        <tr>
          <th>Cargo</th>
          <th>Empresa</th>
          <th>Status</th>
          <th>Data</th>
          <th>Ação</th>
        </tr>
      </thead>
      <tbody>
        {applications.map((app) => (
          <tr key={app.id} className={styles.tableRow}>
            <td>{app.jobTitle}</td>
            <td>{app.company}</td>
            <td>
              <span
                className={`${styles.statusPill} ${styles[app.status?.toLowerCase()] || ""}`}
              >
                {STATUS_LABELS[app.status?.toLowerCase()] || "Pendente"}
              </span>
            </td>
            <td>
              {formatDate(app.appliedAt || app.appliedDate || app.createdAt)}
            </td>
            <td>
              {app.interviewDetails?.scheduledAt ? (
                <Link
                  className={styles.secondaryLink}
                  href="/dashboard/candidato/candidaturas?filter=interview"
                >
                  Entrevista
                </Link>
              ) : (
                <Link
                  className={styles.secondaryLink}
                  href={`/vaga/${app.jobId || ""}`}
                >
                  Ver
                </Link>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

function InterviewPlaceOrLink({ interviewDetails }) {
  if (!interviewDetails) return null;
  const mode = interviewDetails?.mode;
  if (mode === "presencial") {
    return <span>{interviewDetails?.location || "Local a confirmar"}</span>;
  }
  const value = interviewDetails?.link || "";
  if (!value) return <span>Link a confirmar</span>;
  return isLikelyUrl(value) ? (
    <a
      href={value}
      target="_blank"
      rel="noreferrer noopener"
      style={{
        color: "#2057d7",
        textDecoration: "underline",
        wordBreak: "break-word",
      }}
    >
      {value}
    </a>
  ) : (
    <span>{value}</span>
  );
}

const Sidebar = ({
  activeTab,
  setActiveTab,
  unreadMessages,
  unreadNotifications,
  savedJobsCount,
  user,
  profile,
  planName = "Gratuito",
  mobileMenuOpen,
  setMobileMenuOpen,
  onLogout,
}) => {
  return (
    <aside
      className={`${styles.sidebar} ${mobileMenuOpen ? styles.sidebarMobileOpen : ""}`}
    >
      <div className={styles.sidebarLogo}>
        <Link href="/">
          <img
            src="/assets/Emprego STP Logo (2) 1.png"
            alt="EmpregoSTP"
            style={{ height: "40px", objectFit: "contain", cursor: "pointer" }}
          />
        </Link>
      </div>

      <div className={styles.sidebarProfile}>
        <div className={styles.profileAvatar}>
          {profile?.photoUrl || user?.avatar ? (
            <img
              src={profile?.photoUrl || user?.avatar || ""}
              alt={profile?.fullName || user?.name || "User"}
            />
          ) : (
            <span>{(user?.name || "U")[0].toUpperCase()}</span>
          )}
        </div>
        <div className={styles.profileInfo}>
          <p className={styles.profileName}>{user?.name || "Candidato"}</p>
        </div>
      </div>

      <div className={styles.sidebarDivider} />

      <nav className={styles.sidebarNav}>
        <p className={styles.navSection}>Menu Principal</p>
        {NAV_MENU.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setActiveTab(item.id);
              setMobileMenuOpen(false);
            }}
            className={`${styles.navButton} ${activeTab === item.id ? styles.navActive : ""}`}
          >
            <span className={styles.navIcon}>{icons[item.icon]}</span>
            <span className={styles.navLabel}>{item.label}</span>
            {item.id === "messages" && unreadMessages > 0 && (
              <span className={styles.navBadge}>{unreadMessages}</span>
            )}
            {item.id === "notifications" && unreadNotifications > 0 && (
              <span className={styles.navBadge}>{unreadNotifications}</span>
            )}
            {item.id === "saved" && savedJobsCount > 0 && (
              <span className={styles.navBadge}>{savedJobsCount}</span>
            )}
          </button>
        ))}
      </nav>

      <div className={styles.sidebarDivider} />

      <div className={styles.sidebarActions}>
        <Link href="/vagas" className={styles.searchJobsBtn}>
          <span className={styles.navIcon}>{icons.search}</span>
          Procurar Vagas
        </Link>
        {onLogout && (
          <button
            type="button"
            className={styles.searchJobsBtn}
            onClick={onLogout}
            style={{
              marginTop: "0.5rem",
              background: "rgba(239, 68, 68, 0.1)",
              color: "#ef4444",
              borderColor: "rgba(239, 68, 68, 0.2)",
            }}
          >
            <span className={styles.navIcon}>{icons.logout}</span>
            Sair
          </button>
        )}
      </div>

      <div className={styles.sidebarFooter}>
        <div className={styles.planCard}>
          <div className={styles.planCardHeader}>
            <span className={styles.planCardIcon}>{icons.plans}</span>
            <div>
              <p className={styles.planCardTitle}>Plano {planName}</p>
              <p className={styles.planCardDesc}>
                {planName === "Gratuito"
                  ? "Recursos limitados"
                  : "Acesso completo"}
              </p>
            </div>
          </div>
          {planName === "Gratuito" && (
            <button
              type="button"
              className={styles.upgradeButton}
              onClick={() => setActiveTab("plans")}
            >
              Fazer Upgrade
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};

const CandidateDashboard = () => {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [applications, setApplications] = useState([]);
  const [recommendedJobs, setRecommendedJobs] = useState([]);
  const [savedJobs, setSavedJobs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [planStatus, setPlanStatus] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState(() =>
    buildProfileForm(null, null),
  );
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState(null);
  const [careerTips, setCareerTips] = useState([]);
  const [loadingTips, setLoadingTips] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef(null);
  const [cvState, setCvState] = useState({
    url: "",
    name: "",
    uploading: false,
    message: "",
    type: "success",
  });
  const [selectedConversation, setSelectedConversation] = useState(null);

  const [verificationRecord, setVerificationRecord] = useState(null);
  const [verificationFetching, setVerificationFetching] = useState(false);
  const [verificationForm, setVerificationForm] = useState(() =>
    createVerificationForm(null, null),
  );
  const [selectedVerificationTypes, setSelectedVerificationTypes] = useState(
    [],
  );
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState(null);

  useEffect(() => {
    if (!router.isReady) return;
    const requestedTab = String(router.query.tab || "").toLowerCase();
    if (!requestedTab) return;
    if (!NAV_MENU.some((item) => item.id === requestedTab)) return;
    if (requestedTab !== activeTab) {
      setActiveTab(requestedTab);
    }
  }, [router.isReady, router.query.tab, activeTab]);

  // Profile Photos State
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

  const unreadMessages = useMemo(
    () => conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0),
    [conversations],
  );
  const profileDisplayName = useMemo(
    () =>
      profile?.fullName ||
      profile?.name ||
      user?.name ||
      user?.email?.split("@")[0] ||
      "Candidato",
    [profile, user],
  );
  const profileCoverUrl = String(profile?.coverUrl || user?.cover || "").trim();
  const hasProfileCover = profileCoverUrl.length > 0;
  const profileAvatarUrl = String(profile?.photoUrl || user?.avatar || "").trim();
  const hasProfileAvatar = profileAvatarUrl.length > 0;
  const profileAvatarInitials = useMemo(
    () => getInitials(profileDisplayName),
    [profileDisplayName],
  );
  const upcomingInterviews = useMemo(
    () =>
      applications
        .filter((application) =>
          Boolean(application.interviewDetails?.scheduledAt),
        )
        .sort(
          (a, b) =>
            new Date(a.interviewDetails.scheduledAt).getTime() -
            new Date(b.interviewDetails.scheduledAt).getTime(),
        )
        .slice(0, 3),
    [applications],
  );

  const fetchRecommended = useCallback(async (token) => {
    if (!token) return;
    try {
      const response = await fetch("/api/recommendations", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setRecommendedJobs([]);
        return;
      }

      setRecommendedJobs(data.recommendations || []);
    } catch (err) {
      console.error("Erro ao buscar vagas recomendadas:", err);
      setRecommendedJobs([]);
    }
  }, []);

  const fetchVerificationRecord = useCallback(
    async (token, targetUid = user?.uid, { silent = false } = {}) => {
      if (!token || !targetUid) return null;
      if (!silent) {
        setVerificationFetching(true);
      }

      try {
        const response = await fetch(`/api/verifications?uid=${targetUid}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || "Erro ao carregar verificacao");
        }

        const latestVerification = data.verifications?.[0] || null;
        setVerificationRecord(latestVerification);
        return latestVerification;
      } catch (error) {
        console.error("Erro ao carregar verificacao tipada:", error);
        setVerificationRecord(null);
        return null;
      } finally {
        if (!silent) {
          setVerificationFetching(false);
        }
      }
    },
    [user?.uid],
  );

  const fetchNotificationsRealtime = useCallback(async () => {
    try {
      const { getAuth } = await import("firebase/auth");
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const response = await fetch("/api/notifications", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) return;

      const data = await response.json();
      setNotifications(data.notifications || []);
    } catch (error) {
      console.error("Erro ao buscar notificações:", error);
    }
  }, []);

  const fetchConversationsRealtime = useCallback(async () => {
    try {
      const { getAuth } = await import("firebase/auth");
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      const token = await currentUser.getIdToken();
      const response = await fetch("/api/messages", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;

      const data = await response.json();
      setConversations(data.conversations || []);
    } catch (error) {
      console.error("Erro ao buscar conversas:", error);
    }
  }, []);

  const fetchConversationMessagesRealtime = useCallback(
    async (conversationId, { silent = false } = {}) => {
      if (!conversationId) {
        setMessages([]);
        return;
      }

      if (!silent) {
        setLoadingMessages(true);
      }

      try {
        const { getAuth } = await import("firebase/auth");
        const auth = getAuth();
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        const token = await currentUser.getIdToken();
        const response = await fetch(`/api/messages/${conversationId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;

        const data = await response.json();
        setMessages(data.messages || []);
        setConversations((prev) =>
          prev.map((conversation) =>
            conversation.id === conversationId
              ? { ...conversation, unreadCount: 0 }
              : conversation,
          ),
        );
      } catch (error) {
        console.error("Erro ao buscar mensagens:", error);
      } finally {
        if (!silent) {
          setLoadingMessages(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    const handleRealtimeEvent = (event) => {
      fetchNotificationsRealtime();
      const payloadType = event?.detail?.payload?.data?.type || "";
      if (payloadType === "message" || payloadType === "direct_message") {
        fetchConversationsRealtime();
        if (selectedConversation) {
          fetchConversationMessagesRealtime(selectedConversation, {
            silent: true,
          });
        }
      }
    };

    window.addEventListener("app-notification-received", handleRealtimeEvent);
    return () =>
      window.removeEventListener(
        "app-notification-received",
        handleRealtimeEvent,
      );
  }, [
    fetchConversationMessagesRealtime,
    fetchConversationsRealtime,
    fetchNotificationsRealtime,
    selectedConversation,
  ]);

  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      try {
        const { getAuth } = await import("firebase/auth");
        const auth = getAuth();
        const userInstance = auth.currentUser;
        if (!userInstance) {
          router.push("/login");
          return;
        }

        const uid = userInstance.uid;
        const token = await userInstance.getIdToken();

        const profileRes = await fetch(`/api/profile?uid=${uid}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (profileRes.status === 401) {
          router.push("/login");
          return;
        }
        const profileJson = await profileRes.json();
        if (!isMounted) return;

        const profileData = profileJson.profile?.data || {};
        setProfile(profileData);
        setApplications(profileJson.applications || []);

        const headlineFallback =
          profileData.headline ||
          profileData.profession ||
          user?.headline ||
          "";
        const planData = await fetchPlanStatus(token);
        await Promise.all([
          planData?.plan?.features?.canReceiveRecommendations
            ? fetchRecommended(token)
            : Promise.resolve(setRecommendedJobs([])),
          fetchVerificationRecord(token, uid),
          fetchSavedJobs(token),
          fetchNotifications(token),
          fetchCareerTips(headlineFallback),
        ]);
      } catch (err) {
        console.error("Erro ao carregar dashboard do candidato:", err);
        setProfile(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    const fetchSavedJobs = async (token) => {
      if (!token) return;
      try {
        const response = await fetch("/api/saved-jobs", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setSavedJobs(data.savedJobs || []);
        }
      } catch (err) {
        console.error("Erro ao buscar vagas salvas:", err);
      }
    };

    const fetchPlanStatus = async (token) => {
      if (!token) return;
      try {
        const response = await fetch("/api/candidate/plan-status", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setPlanStatus(data);
          return data;
        }
      } catch (err) {
        console.error("Erro ao buscar status do plano:", err);
      }
      return null;
    };

    const fetchNotifications = async (token) => {
      if (!token) return;
      try {
        const response = await fetch("/api/notifications", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          if (isMounted) setNotifications(data.notifications || []);
        }
      } catch (err) {
        console.error("Erro ao buscar notificações:", err);
      }
    };

    const fetchCareerTips = async (headline) => {
      setLoadingTips(true);
      try {
        const tips = await getCareerAdvice(headline);
        if (isMounted) setCareerTips(tips);
      } catch (err) {
        console.error("Erro ao buscar dicas de carreira:", err);
      } finally {
        if (isMounted) setLoadingTips(false);
      }
    };

    initialize();

    return () => {
      isMounted = false;
    };
  }, [router, user, fetchRecommended, fetchVerificationRecord]);

  const refreshPlanStatus = useCallback(async () => {
    try {
      const { getAuth } = await import("firebase/auth");
      const auth = getAuth();
      const currentUser = auth.currentUser;
      const token = await currentUser?.getIdToken();
      if (!token) return;
      const response = await fetch("/api/candidate/plan-status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;
      const data = await response.json().catch(() => null);
      if (data) setPlanStatus(data);
    } catch (error) {
      // best effort
    }
  }, []);

  useEffect(() => {
    setVerificationForm((prev) => ({
      ...prev,
      contactEmail: prev.contactEmail || profile?.email || user?.email || "",
      contactPhone: prev.contactPhone || profile?.phone || user?.phone || "",
      certificationsText:
        prev.certificationsText || profile?.certifications || "",
      educationSummary: prev.educationSummary || profile?.education || "",
      portfolioUrl: prev.portfolioUrl || profile?.website || "",
      linkedin: prev.linkedin || profile?.linkedin || "",
    }));
  }, [profile, user]);

  const handleLogout = async () => {
    try {
      const result = await logout();
      if (result.success) {
        router.push("/login");
      } else {
        alert("Erro ao fazer logout. Tente novamente.");
      }
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      alert("Erro ao fazer logout.");
    }
  };

  useEffect(() => {
    if (!editingProfile) {
      setProfileForm(buildProfileForm(profile, user));
    }
  }, [profile, user, editingProfile]);

  useEffect(() => {
    setCvState((prev) => ({
      ...prev,
      url: profile?.cvUrl || "",
      name: profile?.cvName || "",
    }));
  }, [profile]);

  const handleVerificationFieldChange = (field, value) => {
    setVerificationForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleVerificationFileChange = (
    field,
    files,
    { multiple = false } = {},
  ) => {
    const normalized = multiple ? Array.from(files || []) : files?.[0] || null;
    setVerificationForm((prev) => ({
      ...prev,
      [field]: normalized,
    }));
  };

  const toggleVerificationType = (type) => {
    setSelectedVerificationTypes((prev) =>
      prev.includes(type)
        ? prev.filter((entry) => entry !== type)
        : [...prev, type],
    );
  };

  // Fetch conversations when messages tab becomes active
  useEffect(() => {
    if (activeTab !== "messages") return;
    fetchConversationsRealtime();
  }, [activeTab, fetchConversationsRealtime]);

  useEffect(() => {
    if (activeTab !== "messages") return undefined;

    const intervalId = setInterval(() => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      )
        return;
      fetchConversationsRealtime();
    }, 12000);

    return () => clearInterval(intervalId);
  }, [activeTab, fetchConversationsRealtime]);

  // Fetch messages when a conversation is selected
  useEffect(() => {
    if (activeTab !== "messages") return undefined;
    if (!selectedConversation) {
      setMessages([]);
      return;
    }
    fetchConversationMessagesRealtime(selectedConversation);

    const intervalId = setInterval(() => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      )
        return;
      fetchConversationMessagesRealtime(selectedConversation, { silent: true });
    }, 5000);

    return () => clearInterval(intervalId);
  }, [activeTab, selectedConversation, fetchConversationMessagesRealtime]);

  useEffect(() => {
    if (!user) return undefined;

    fetchNotificationsRealtime();

    const intervalId = setInterval(() => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      )
        return;
      fetchNotificationsRealtime();
    }, 20000);

    return () => clearInterval(intervalId);
  }, [user, fetchNotificationsRealtime]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedConversation || sendingMessage) return;
    const text = messageInput.trim();
    setMessageInput("");
    setSendingMessage(true);
    try {
      const { getAuth } = await import("firebase/auth");
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      const token = await currentUser.getIdToken();
      const res = await fetch(`/api/messages/${selectedConversation}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: `temp-${Date.now()}`,
            senderId: currentUser.uid,
            text,
            createdAt: new Date().toISOString(),
          },
        ]);
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConversation
              ? {
                  ...c,
                  lastMessage: text.substring(0, 100),
                  lastMessageAt: new Date().toISOString(),
                }
              : c,
          ),
        );
      } else {
        setMessageInput(text);
      }
    } catch (err) {
      console.error("Erro ao enviar mensagem:", err);
      setMessageInput(text);
    } finally {
      setSendingMessage(false);
    }
  };

  const markNotificationAsRead = async (notificationId) => {
    if (!notificationId) return;

    const target = notifications.find(
      (notification) => notification.id === notificationId,
    );
    if (!target || target.read) return;

    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === notificationId
          ? { ...notification, read: true, readAt: new Date().toISOString() }
          : notification,
      ),
    );

    try {
      const { getAuth } = await import("firebase/auth");
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ notificationId }),
      });

      if (!response.ok) {
        throw new Error("Falha ao marcar notificação como lida");
      }
    } catch (error) {
      console.error("Erro ao marcar notificação como lida:", error);
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === notificationId
            ? { ...notification, read: false }
            : notification,
        ),
      );
    }
  };

  const markAllNotificationsAsRead = async () => {
    const unreadIds = notifications
      .filter((notification) => !notification.read)
      .map((notification) => notification.id);
    if (unreadIds.length === 0) return;

    setNotifications((prev) =>
      prev.map((notification) => ({ ...notification, read: true })),
    );

    try {
      const { getAuth } = await import("firebase/auth");
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ markAll: true }),
      });

      if (!response.ok) {
        throw new Error("Falha ao marcar todas as notificações");
      }
    } catch (error) {
      console.error("Erro ao marcar todas as notificações:", error);
      setNotifications((prev) =>
        prev.map((notification) =>
          unreadIds.includes(notification.id)
            ? { ...notification, read: false }
            : notification,
        ),
      );
    }
  };

  const chartData = useMemo(() => {
    const dayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
    const counts = { Dom: 0, Seg: 0, Ter: 0, Qua: 0, Qui: 0, Sex: 0, Sab: 0 };
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    applications.forEach((app) => {
      try {
        const d = app.createdAt
          ? app.createdAt.toDate
            ? app.createdAt.toDate()
            : new Date(app.createdAt)
          : null;
        if (d && d >= sevenDaysAgo) {
          const key = dayLabels[d.getDay()];
          counts[key] = (counts[key] || 0) + 1;
        }
      } catch (_) {}
    });
    return dayLabels.map((name) => ({ name, value: counts[name] || 0 }));
  }, [applications]);

  const stats = useMemo(() => {
    const interviews = applications.filter(
      (app) =>
        app.status?.toLowerCase() === "interview" ||
        app.interviewDetails?.scheduledAt,
    ).length;
    const offers = applications.filter(
      (app) => app.status?.toLowerCase() === "offered",
    ).length;
    const views = planStatus?.plan?.views || 0;
    const appResource = planStatus?.resources?.applications;
    const appLimit = appResource?.limit ?? 3;
    const appUsed = appResource?.current ?? 0;
    const appRemaining =
      appLimit !== null ? Math.max(0, appLimit - appUsed) : null;
    const appLabel =
      appLimit !== null ? `${appUsed}/${appLimit} este mês` : "Ilimitadas";
    return [
      {
        label: "Candidaturas",
        value: applications.length,
        sublabel: appLabel,
        sublabelWarning: appRemaining !== null && appRemaining <= 1,
        icon: icons.applications,
        color: "#2057d7",
      },
      {
        label: "Entrevistas",
        value: interviews,
        change: 4,
        trend: "up",
        icon: icons.mic,
        color: "#5fb8f5",
      },
      {
        label: "Visualizacoes",
        value: views,
        change: 5,
        trend: "neutral",
        icon: icons.eye,
        color: "#1e2b4d",
      },
      {
        label: "Ofertas",
        value: offers,
        change: 100,
        trend: "up",
        icon: icons.trophy,
        color: "#8ea800",
      },
    ];
  }, [applications, planStatus]);

  const activePlan = planStatus?.plan || {
    planId: "basic_candidato",
    planName: "Básico",
    price: 0,
    isActive: true,
    daysRemaining: null,
    features: {},
  };

  const planResources = planStatus?.resources || {
    applications: { allowed: true, current: 0, limit: 3 },
    savedJobs: { allowed: false, current: 0, limit: 0 },
    certificates: { allowed: false, current: 0, limit: 0 },
  };

  const planHeading =
    activePlan.price === 0
      ? "Plano Grátis"
      : activePlan.planName || "Plano EmpregoSTP";
  const planFeatureList = getPlanFeatureList(activePlan.features);
  const profileViewers = planStatus?.profileViewers || [];
  const profileCompletion = planStatus?.profileCompletion || {
    score: 0,
    label: "Perfil inicial",
    isProfileComplete: false,
    checklist: [],
    nextSteps: [],
    completedCount: 0,
    totalItems: 0,
    missingCount: 0,
  };
  const profileVisibility = planStatus?.visibility || {
    highlighted: false,
    verified: profile?.verificationStatus === "verified",
    completionScore: profileCompletion.score,
    isProfileComplete: profileCompletion.isProfileComplete,
    priorityInSearch: false,
  };
  const profileViewsSummary = planStatus?.profileViewsSummary || {
    total: planResources?.profileViews?.current || 0,
    uniqueCompanies: profileViewers.length,
    canSeeDetailedViewers: false,
  };
  const optimizationInsights = planStatus?.optimizationInsights || {
    employabilityScore: 0,
    employabilityLabel: "Perfil inicial",
    averageTopMatch: 0,
    bestMatchScore: 0,
    summarySuggestion: "",
    strengths: [],
    improvementActions: [],
    marketSkillGaps: [],
    searchKeywords: [],
    topMatches: [],
    activeJobsAnalyzed: 0,
  };

  const verificationSummary = useMemo(
    () =>
      verificationRecord?.summary ||
      profile?.verificationSummary || {
        status:
          profile?.verificationStatus === "verified"
            ? "approved"
            : profile?.verificationStatus === "pending"
              ? "pending"
              : profile?.verificationStatus === "rejected"
                ? "rejected"
                : "draft",
        requestedCount: 0,
        approvedCount: 0,
        pendingCount: 0,
        rejectedCount: 0,
        progressPercent: 0,
        lastSubmittedAt: null,
        types: {},
      },
    [
      profile?.verificationStatus,
      profile?.verificationSummary,
      verificationRecord?.summary,
    ],
  );

  const verificationItems = useMemo(
    () =>
      VERIFICATION_TYPE_ORDER.map((type) => {
        const config = VERIFICATION_TYPE_CONFIG[type];
        const detailedItem = verificationRecord?.verificationItems?.[type];
        const fallbackSummary =
          verificationSummary?.types?.[type] ||
          profile?.verificationItems?.[type] ||
          {};
        return {
          type,
          label: config?.label || type,
          description: config?.description || "",
          requested:
            detailedItem?.requested ?? fallbackSummary?.requested ?? false,
          status:
            detailedItem?.status || fallbackSummary?.status || "not_requested",
          checklist: detailedItem?.checklist || [],
          evidence: detailedItem?.evidence || [],
          reviewReason: detailedItem?.reviewReason || "",
          reviewedAt: detailedItem?.reviewedAt || null,
          submittedAt:
            detailedItem?.submittedAt ||
            verificationSummary?.lastSubmittedAt ||
            null,
          completedChecklistCount:
            detailedItem?.completedChecklistCount ??
            fallbackSummary?.completedChecklistCount ??
            0,
          totalChecklistCount:
            detailedItem?.totalChecklistCount ??
            fallbackSummary?.totalChecklistCount ??
            0,
          evidenceCount:
            detailedItem?.evidenceCount ?? fallbackSummary?.evidenceCount ?? 0,
        };
      }),
    [profile?.verificationItems, verificationRecord, verificationSummary],
  );

  const canRequestVerification = Boolean(activePlan.features?.canVerifyProfile);
  const verificationOverallStatus =
    verificationRecord?.status || verificationSummary?.status || "draft";
  const verificationOverallMeta = getVerificationStatusMeta(
    verificationOverallStatus,
  );

  useEffect(() => {
    const availableTypes = verificationItems
      .filter((item) => item.status !== "approved")
      .map((item) => item.type);

    if (!availableTypes.length) {
      setSelectedVerificationTypes([]);
      return;
    }

    setSelectedVerificationTypes((prev) => {
      const filtered = prev.filter((type) => availableTypes.includes(type));
      return filtered;
    });
  }, [verificationItems]);

  const handleVerificationSubmit = async () => {
    if (!canRequestVerification) {
      setVerificationMessage({
        type: "error",
        text: "A verificacao de perfil esta disponivel nos planos Verificacao e Premium.",
      });
      return;
    }

    if (!selectedVerificationTypes.length) {
      setVerificationMessage({
        type: "error",
        text: "Selecione pelo menos um bloco de verificacao para enviar.",
      });
      return;
    }

    const selectedTypesSet = new Set(selectedVerificationTypes);
    const profileSkillsCount = [
      ...(Array.isArray(profile?.skillsHard) ? profile.skillsHard : []),
      ...(Array.isArray(profile?.skillsSoft) ? profile.skillsSoft : []),
      ...(Array.isArray(profile?.digitalSkills) ? profile.digitalSkills : []),
    ].filter(Boolean).length;
    const validationMessages = [];

    if (selectedTypesSet.has("identity")) {
      if (!verificationForm.contactEmail || !verificationForm.contactPhone) {
        validationMessages.push(
          "Preencha email e telefone para enviar Identidade.",
        );
      }
      if (!verificationForm.identityDocument) {
        validationMessages.push(
          "Anexe o documento de identidade para enviar Identidade.",
        );
      }
      if (!verificationForm.selfieDocument) {
        validationMessages.push(
          "Anexe a selfie com documento para enviar Identidade.",
        );
      }
    }

    if (selectedTypesSet.has("certificates")) {
      const hasCertificatesContext =
        verificationForm.certificateDocuments.length > 0 ||
        Boolean(String(verificationForm.certificationsText || "").trim()) ||
        Boolean(profile?.certificateFiles?.length) ||
        Boolean(String(profile?.certifications || "").trim());

      if (!hasCertificatesContext) {
        validationMessages.push(
          "Adicione certificados ou um resumo antes de enviar Certificados.",
        );
      }
    }

    if (selectedTypesSet.has("academic")) {
      const hasAcademicContext =
        Boolean(String(verificationForm.educationSummary || "").trim()) ||
        Boolean(verificationForm.academicDocument) ||
        Boolean(String(profile?.education || "").trim());

      if (!hasAcademicContext) {
        validationMessages.push(
          "Informe a formação ou anexe um comprovativo antes de enviar Académica.",
        );
      }
    }

    if (selectedTypesSet.has("experience")) {
      const hasExperienceContext =
        Boolean(String(verificationForm.experienceSummary || "").trim()) ||
        Boolean(profile?.experience?.length);
      const hasExperienceProof =
        Boolean(verificationForm.employmentProof) ||
        Boolean(verificationForm.cvDocument) ||
        Boolean(profile?.cvUrl);

      if (!hasExperienceContext || !hasExperienceProof) {
        validationMessages.push(
          "Para Experiência, informe histórico profissional e anexe CV ou comprovativo.",
        );
      }
    }

    if (selectedTypesSet.has("competencies")) {
      const hasCompetencyContext =
        Boolean(String(verificationForm.competencyNotes || "").trim()) ||
        Boolean(String(verificationForm.portfolioUrl || "").trim()) ||
        Boolean(String(verificationForm.linkedin || "").trim()) ||
        Boolean(verificationForm.competencyDocument) ||
        profileSkillsCount >= 3;

      if (!hasCompetencyContext) {
        validationMessages.push(
          "Adicione competências, links ou comprovativo antes de enviar Competências.",
        );
      }
    }

    if (validationMessages.length > 0) {
      setVerificationMessage({
        type: "error",
        text: validationMessages[0],
      });
      return;
    }

    setVerificationLoading(true);
    setVerificationMessage(null);

    try {
      const { getAuth } = await import("firebase/auth");
      const { ref, uploadBytesResumable, getDownloadURL } =
        await import("firebase/storage");
      const { storage } = await import("../../../lib/firebase");

      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("Utilizador nao autenticado.");
      }

      const uploadSingleFile = async (file, path) => {
        if (!file) return null;
        const storageRef = ref(
          storage,
          `${path}/${currentUser.uid}/${Date.now()}_${file.name}`,
        );
        try {
          await new Promise((resolve, reject) => {
            const uploadTask = uploadBytesResumable(storageRef, file);
            uploadTask.on("state_changed", null, reject, resolve);
          });
        } catch (error) {
          throw new Error(
            getFirebaseStorageErrorMessage(
              error,
              "Erro ao enviar ficheiro de verificacao.",
            ),
          );
        }

        const url = await getDownloadURL(storageRef);
        return {
          label: file.name,
          url,
          fileName: file.name,
          type: "file",
        };
      };

      const uploadMultipleFiles = async (files, path) => {
        if (!Array.isArray(files) || files.length === 0) return [];
        return Promise.all(files.map((file) => uploadSingleFile(file, path)));
      };

      const [
        identityDocument,
        selfieDocument,
        certificateDocuments,
        academicDocument,
        employmentProof,
        cvDocument,
        competencyDocument,
      ] = await Promise.all([
        selectedVerificationTypes.includes("identity")
          ? uploadSingleFile(
              verificationForm.identityDocument,
              "verification/identity",
            )
          : Promise.resolve(null),
        selectedVerificationTypes.includes("identity")
          ? uploadSingleFile(
              verificationForm.selfieDocument,
              "verification/selfie",
            )
          : Promise.resolve(null),
        selectedVerificationTypes.includes("certificates")
          ? uploadMultipleFiles(
              verificationForm.certificateDocuments,
              "verification/certificates",
            )
          : Promise.resolve([]),
        selectedVerificationTypes.includes("academic")
          ? uploadSingleFile(
              verificationForm.academicDocument,
              "verification/academic",
            )
          : Promise.resolve(null),
        selectedVerificationTypes.includes("experience")
          ? uploadSingleFile(
              verificationForm.employmentProof,
              "verification/experience",
            )
          : Promise.resolve(null),
        selectedVerificationTypes.includes("experience")
          ? uploadSingleFile(verificationForm.cvDocument, "verification/cv")
          : Promise.resolve(null),
        selectedVerificationTypes.includes("competencies")
          ? uploadSingleFile(
              verificationForm.competencyDocument,
              "verification/competencies",
            )
          : Promise.resolve(null),
      ]);

      const token = await currentUser.getIdToken();
      const response = await fetch("/api/verifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          uid: currentUser.uid,
          documents: {
            requestedTypes: selectedVerificationTypes,
            contact: {
              email: verificationForm.contactEmail,
              phone: verificationForm.contactPhone,
            },
            idDocument: identityDocument,
            selfieDocument,
            certificateDocuments,
            certificationsText: verificationForm.certificationsText,
            academicDocument,
            educationSummary: verificationForm.educationSummary,
            employmentProof,
            cvDocument:
              cvDocument ||
              (profile?.cvUrl
                ? {
                    label: profile?.cvName || "CV atual",
                    url: profile.cvUrl,
                    fileName: profile?.cvName || "",
                  }
                : null),
            experienceSummary: verificationForm.experienceSummary,
            competencyDocument,
            portfolioUrl: verificationForm.portfolioUrl,
            linkedin: verificationForm.linkedin,
            competencyNotes: verificationForm.competencyNotes,
          },
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setVerificationMessage({
          type: "error",
          text: data.error || "Erro ao solicitar verificacao",
        });
        return;
      }

      const latestRecord = await fetchVerificationRecord(
        token,
        currentUser.uid,
        { silent: true },
      );
      await refreshPlanStatus();

      const nextSummary =
        latestRecord?.summary || data.verification?.summary || null;
      const nextPublicStatus = nextSummary?.publicVerified
        ? "verified"
        : nextSummary?.pendingCount > 0
          ? "pending"
          : nextSummary?.rejectedCount > 0
            ? "rejected"
            : "unverified";

      setProfile((prev) => ({
        ...prev,
        verificationStatus: nextPublicStatus,
        verificationSummary: nextSummary || prev?.verificationSummary,
        verificationItems:
          latestRecord?.summary?.types ||
          data.verification?.summary?.types ||
          prev?.verificationItems,
        verificationId: latestRecord?.id || data.id || prev?.verificationId,
      }));

      setVerificationForm((prev) => ({
        ...prev,
        identityDocument: null,
        selfieDocument: null,
        certificateDocuments: [],
        academicDocument: null,
        employmentProof: null,
        cvDocument: null,
        competencyDocument: null,
      }));

      setVerificationMessage({
        type: "success",
        text: data.message || "Pedido de verificacao enviado com sucesso.",
      });
    } catch (err) {
      console.error("Erro na verificacao:", err);
      setVerificationMessage({
        type: "error",
        text:
          getFirebaseStorageErrorMessage(
            err,
            "Erro ao enviar verificacao. Tente novamente.",
          ) || "Erro ao enviar verificacao. Tente novamente.",
      });
    } finally {
      setVerificationLoading(false);
    }
  };

  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const messagesContent = conversations.find(
    (c) => c.id === selectedConversation,
  );

  const handleCvChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setCvState((prev) => ({ ...prev, uploading: true, message: "" }));

    try {
      const { getAuth } = await import("firebase/auth");
      const { ref, uploadBytesResumable, getDownloadURL } =
        await import("firebase/storage");
      const { storage } = await import("../../../lib/firebase");
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Usuário não autenticado.");

      const storageRef = ref(
        storage,
        `cvUrl/${currentUser.uid}/${Date.now()}_${file.name}`,
      );
      await new Promise((resolve, reject) => {
        const uploadTask = uploadBytesResumable(storageRef, file);
        uploadTask.on("state_changed", null, reject, resolve);
      });
      const downloadUrl = await getDownloadURL(storageRef);
      const token = await currentUser.getIdToken();

      const response = await fetch("/api/profile/upload-cv", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          cvUrl: downloadUrl,
          cvName: file.name,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Falha ao atualizar CV");
      }

      setProfile(data.profile);
      await refreshPlanStatus();
      await fetchRecommended(token);
      setCvState({
        url: downloadUrl,
        name: file.name,
        uploading: false,
        message: "CV enviado com sucesso!",
      });
    } catch (err) {
      console.error("Erro ao enviar CV:", err);
      setCvState((prev) => ({
        ...prev,
        uploading: false,
        message: getFirebaseStorageErrorMessage(err, "Erro ao enviar CV"),
      }));
    }
  };

  const handlePhotoUpload = async (event, type) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const setLoading =
      type === "avatar" ? setAvatarUploading : setCoverUploading;
    setLoading(true);

    try {
      const { getAuth } = await import("firebase/auth");
      const { ref, uploadBytesResumable, getDownloadURL } =
        await import("firebase/storage");
      const { storage } = await import("../../../lib/firebase");

      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Usuário não autenticado.");

      const path = type === "avatar" ? "photoUrl" : "company-covers"; // Using existing paths logic or generic 'covers'
      const timestamp = Date.now();
      const storageRef = ref(
        storage,
        `${path}/${currentUser.uid}/${timestamp}_${file.name}`,
      );

      await uploadBytesResumable(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);
      const token = await currentUser.getIdToken();
      const updateData =
        type === "avatar"
          ? { photoUrl: downloadUrl }
          : { coverUrl: downloadUrl };
      const response = await fetch("/api/profile/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Erro ao atualizar imagem");
      }

      setProfile(data.profile);
      await refreshPlanStatus();
      setProfileForm((prev) => ({
        ...prev,
        ...(type === "avatar"
          ? { photoUrl: downloadUrl }
          : { coverUrl: downloadUrl }),
      }));

      setProfileFeedback({
        type: "success",
        message: `${type === "avatar" ? "Foto de perfil" : "Capa"} atualizada com sucesso!`,
      });
    } catch (err) {
      console.error(`Erro ao atualizar ${type}:`, err);
      setProfileFeedback({
        type: "error",
        message: getFirebaseStorageErrorMessage(
          err,
          `Erro ao atualizar ${type}.`,
        ),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProfileFieldChange = (field, value) => {
    setProfileForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleExperienceChange = (index, field, value) => {
    setProfileForm((prev) => {
      const nextExperiences = [...prev.experiences];
      nextExperiences[index] = {
        ...nextExperiences[index],
        [field]: value,
      };
      return { ...prev, experiences: nextExperiences };
    });
  };

  const handleAddExperience = () => {
    setProfileForm((prev) => ({
      ...prev,
      experiences: [...prev.experiences, { ...emptyExperience }],
    }));
  };

  const handleRemoveExperience = (index) => {
    setProfileForm((prev) => {
      const nextExperiences = [...prev.experiences];
      nextExperiences.splice(index, 1);
      return {
        ...prev,
        experiences: nextExperiences.length
          ? nextExperiences
          : [{ ...emptyExperience }],
      };
    });
  };

  const handleCancelEdit = () => {
    setProfileForm(buildProfileForm(profile, user));
    setEditingProfile(false);
    setProfileFeedback(null);
  };

  const handleStartEditing = () => {
    setProfileForm(buildProfileForm(profile, user));
    setProfileFeedback(null);
    setEditingProfile(true);
  };

  // Helper functions for extended profile
  const addDigitalSkill = (e) => {
    e.preventDefault();
    const val = e.target.elements.skill.value.trim();
    if (val && !profileForm.digitalSkills.includes(val)) {
      setProfileForm((prev) => ({
        ...prev,
        digitalSkills: [...prev.digitalSkills, val],
      }));
    }
    e.target.reset();
  };

  const removeDigitalSkill = (skill) => {
    setProfileForm((prev) => ({
      ...prev,
      digitalSkills: prev.digitalSkills.filter((s) => s !== skill),
    }));
  };

  const handleCertUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    if (
      !activePlan.features?.canUploadCertificates ||
      !planResources.certificates?.allowed
    ) {
      setProfileFeedback({
        type: "error",
        message:
          planResources.certificates?.upgradeMessage ||
          "Upload de certificados é exclusivo dos planos Profissional e Premium.",
      });
      return;
    }

    if (
      planResources.certificates?.limit !== null &&
      (planResources.certificates?.current || 0) + files.length >
        (planResources.certificates?.limit || 0)
    ) {
      setProfileFeedback({
        type: "error",
        message: `O seu plano permite no máximo ${planResources.certificates.limit} certificado(s).`,
      });
      return;
    }

    setProfileSaving(true); // Reuse saving state or add new loading state
    try {
      const { getAuth } = await import("firebase/auth");
      const { ref, uploadBytesResumable, getDownloadURL } =
        await import("firebase/storage");
      const { storage } = await import("../../../lib/firebase");

      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Usuário não autenticado");

      const uploadedUrls = [];
      for (const f of files) {
        const storageRef = ref(
          storage,
          `certificados/${currentUser.uid}/${Date.now()}_${f.name}`,
        );
        await uploadBytesResumable(storageRef, f);
        const url = await getDownloadURL(storageRef);
        uploadedUrls.push(url);
      }

      setProfileForm((prev) => ({
        ...prev,
        certificateFiles: [...prev.certificateFiles, ...uploadedUrls],
      }));
      setProfileFeedback({
        type: "success",
        message: "Certificados adicionados!",
      });
    } catch (err) {
      console.error(err);
      setProfileFeedback({
        type: "error",
        message: getFirebaseStorageErrorMessage(
          err,
          "Erro ao enviar certificados.",
        ),
      });
    } finally {
      setProfileSaving(false);
    }
  };

  const removeCertificate = (index) => {
    setProfileForm((prev) => ({
      ...prev,
      certificateFiles: prev.certificateFiles.filter((_, i) => i !== index),
    }));
  };

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    setProfileFeedback(null);
    try {
      const { getAuth } = await import("firebase/auth");
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("Usuário não autenticado.");
      }
      const token = await currentUser.getIdToken();
      const skillsArray = (profileForm.skills || "")
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean);
      const sanitizedExperiences = (profileForm.experiences || [])
        .map((item) => ({
          company: (item.company || "").trim(),
          role: (item.role || "").trim(),
          period: (item.period || "").trim(),
          description: (item.description || "").trim(),
        }))
        .filter(
          (item) =>
            item.company || item.role || item.period || item.description,
        );

      const response = await fetch("/api/profile/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: profileForm.name,
          headline: profileForm.headline,
          bio: profileForm.bio,
          location: profileForm.location,
          phone: profileForm.phone,
          skills: skillsArray,
          experiences: sanitizedExperiences,
          // Extended Fields
          birthDate: profileForm.birthDate,
          nationality: profileForm.nationality,
          gender: profileForm.gender,
          maritalStatus: profileForm.maritalStatus,
          linkedin: profileForm.linkedin,
          website: profileForm.website,
          objectiveArea: profileForm.objectiveArea,
          objectiveType: profileForm.objectiveType,
          objectiveAspiration: profileForm.objectiveAspiration,
          skillsSoft: profileForm.skillsSoft,
          digitalSkills: profileForm.digitalSkills,
          education: profileForm.education,
          languages: profileForm.languages,
          certifications: profileForm.certifications,
          certificateFiles: profileForm.certificateFiles,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Falha ao salvar o perfil.");
      }

      const updatedUser = {
        ...user,
        name: data.profile.fullName || user?.name,
        headline: data.profile.headline || user?.headline,
        bio: data.profile.bio || user?.bio,
        location: data.profile.city || user?.location,
        phone: data.profile.phone || user?.phone,
        skills:
          data.profile.skillsHard && data.profile.skillsHard.length
            ? data.profile.skillsHard
            : user?.skills,
      };

      setProfile(data.profile);
      setProfileForm(buildProfileForm(data.profile, updatedUser));
      await refreshPlanStatus();
      await fetchRecommended(token);
      setProfileFeedback({
        type: "success",
        message: data.message || "Perfil atualizado com sucesso.",
      });
      setEditingProfile(false);
    } catch (err) {
      console.error("Erro ao salvar perfil:", err);
      setProfileFeedback({
        type: "error",
        message: err.message || "Não foi possível salvar o perfil.",
      });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleImportLinkedIn = () => {
    const hints = extractLinkedInProfileHints(profileForm.linkedin);
    if (!hints.normalizedUrl || !hints.normalizedUrl.includes("linkedin.com")) {
      setProfileFeedback({
        type: "error",
        message:
          "Informe uma URL válida do LinkedIn para importar os dados básicos.",
      });
      return;
    }

    setProfileForm((prev) => ({
      ...prev,
      linkedin: hints.normalizedUrl,
      name: prev.name || hints.inferredName || prev.name,
    }));
    setProfileFeedback({
      type: "success",
      message: hints.inferredName
        ? `URL do LinkedIn normalizada. Nome sugerido: ${hints.inferredName}.`
        : "URL do LinkedIn normalizada com sucesso.",
    });
  };

  const renderContent = () => {
    if (loading) {
      return <div className={styles.loading}>Carregando dados...</div>;
    }

    switch (activeTab) {
      case "dashboard":
        return (
          <div className={styles.contentArea}>
            <div className={styles.statsGrid}>
              {stats.map((stat) => (
                <StatCard key={stat.label} {...stat} />
              ))}
            </div>

            <div className={styles.insightsGrid}>
              <section
                className={`${styles.sectionBlock} ${styles.insightPanel}`}
              >
                <div className={styles.profileCompletionHeader}>
                  <div>
                    <p className={styles.insightEyebrow}>
                      Visibilidade do perfil
                    </p>
                    <h3 className={styles.profileCompletionValue}>
                      {profileCompletion.score}%
                    </h3>
                    <p className={styles.profileCompletionText}>
                      {profileCompletion.label}
                    </p>
                  </div>
                  <div className={styles.profileInsightBadges}>
                    <span
                      className={`${styles.profileInsightBadge} ${profileCompletion.isProfileComplete ? styles.profileInsightBadgeComplete : styles.profileInsightBadgeMuted}`}
                    >
                      {profileCompletion.isProfileComplete
                        ? "Perfil completo"
                        : "A melhorar"}
                    </span>
                    {profileVisibility.highlighted && (
                      <span
                        className={`${styles.profileInsightBadge} ${styles.profileInsightBadgeHighlight}`}
                      >
                        Em destaque
                      </span>
                    )}
                    {(profileVisibility.verified ||
                      profile?.verificationStatus === "verified") && (
                      <span
                        className={`${styles.profileInsightBadge} ${styles.profileInsightBadgeVerified}`}
                      >
                        Verificado
                      </span>
                    )}
                  </div>
                </div>

                <div className={styles.profileCompletionBar}>
                  <span
                    style={{
                      width: `${Math.max(6, profileCompletion.score)}%`,
                    }}
                  />
                </div>
                <p className={styles.insightDescription}>
                  {profileCompletion.completedCount} de{" "}
                  {profileCompletion.totalItems} blocos concluídos.
                  {profileVisibility.priorityInSearch
                    ? " O seu plano também dá prioridade adicional nas buscas."
                    : ""}
                </p>

                <ul className={styles.profileChecklist}>
                  {profileCompletion.checklist.slice(0, 6).map((item) => (
                    <li
                      key={item.id}
                      className={`${styles.profileChecklistItem} ${item.completed ? styles.profileChecklistDone : styles.profileChecklistPending}`}
                    >
                      <span>{item.completed ? "✓" : "○"}</span>
                      <div>
                        <strong>{item.label}</strong>
                        {!item.completed && <small>{item.hint}</small>}
                      </div>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setActiveTab("profile")}
                >
                  {profileCompletion.isProfileComplete
                    ? "Gerir perfil"
                    : "Completar perfil"}
                </button>
              </section>

              <section
                className={`${styles.sectionBlock} ${styles.insightPanel}`}
              >
                <div className={styles.sectionTitle}>
                  <span>Quem viu o seu perfil</span>
                  <small>
                    {profileViewsSummary.total || 0} visualização(ões)
                  </small>
                </div>

                {activePlan.features?.canSeeWhoViewedProfile ? (
                  profileViewers.length ? (
                    <div className={styles.viewerList}>
                      {profileViewers.slice(0, 5).map((viewer) => (
                        <div key={viewer.id} className={styles.viewerItem}>
                          <div className={styles.viewerAvatar}>
                            {String(viewer.companyName || "E")
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                          <div className={styles.viewerContent}>
                            <strong>{viewer.companyName || "Empresa"}</strong>
                            <span>
                              {viewer.viewedAt
                                ? formatDate(viewer.viewedAt)
                                : "Data indisponível"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.viewerEmptyState}>
                      Ainda não há empresas registadas nesta secção. Continue a
                      melhorar o perfil para aumentar a visibilidade.
                    </div>
                  )
                ) : (
                  <div className={styles.viewerUpgradeBox}>
                    <p className={styles.insightDescription}>
                      Ver as empresas que visitaram o seu perfil é um recurso do
                      plano Premium.
                    </p>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      onClick={() => setActiveTab("plans")}
                    >
                      Ver planos
                    </button>
                  </div>
                )}
              </section>
            </div>

            <div className={styles.gridTwoCols}>
              <section
                className={`${styles.sectionBlock} ${styles.optimizationPanel}`}
              >
                <div className={styles.sectionTitle}>
                  <span>Motor de Empregabilidade</span>
                  <small>
                    {optimizationInsights.activeJobsAnalyzed || 0} vaga(s)
                    analisada(s)
                  </small>
                </div>

                <div className={styles.optimizationScoreRow}>
                  <div className={styles.optimizationScoreCard}>
                    <strong className={styles.optimizationScoreValue}>
                      {optimizationInsights.employabilityScore || 0}
                    </strong>
                    <span className={styles.optimizationScoreSuffix}>/100</span>
                  </div>
                  <div className={styles.optimizationScoreMeta}>
                    <h3>
                      {optimizationInsights.employabilityLabel ||
                        "Perfil inicial"}
                    </h3>
                    <p>
                      Melhor aderencia atual:{" "}
                      {optimizationInsights.bestMatchScore || 0}%. Media das
                      melhores vagas:{" "}
                      {optimizationInsights.averageTopMatch || 0}%.
                    </p>
                  </div>
                </div>

                {optimizationInsights.strengths?.length > 0 && (
                  <>
                    <p className={styles.optimizationSectionLabel}>
                      Pontos fortes
                    </p>
                    <div className={styles.insightChipList}>
                      {optimizationInsights.strengths.map((strength) => (
                        <span key={strength} className={styles.insightChip}>
                          {strength}
                        </span>
                      ))}
                    </div>
                  </>
                )}

                {optimizationInsights.improvementActions?.length > 0 && (
                  <>
                    <p className={styles.optimizationSectionLabel}>
                      Proximos ajustes
                    </p>
                    <div className={styles.optimizationActionList}>
                      {optimizationInsights.improvementActions
                        .slice(0, 3)
                        .map((action) => (
                          <article
                            key={action.id || action.title}
                            className={styles.optimizationActionItem}
                          >
                            <div>
                              <strong>{action.title}</strong>
                              <p>{action.detail}</p>
                            </div>
                            <span className={styles.optimizationImpactBadge}>
                              {action.impact || "medio"}
                            </span>
                          </article>
                        ))}
                    </div>
                  </>
                )}
              </section>

              <section
                className={`${styles.sectionBlock} ${styles.optimizationPanel}`}
              >
                <div className={styles.sectionTitle}>
                  <span>Palavras-chave e Mercado</span>
                  <small>Otimizar para busca e matching</small>
                </div>

                <p className={styles.optimizationSectionLabel}>
                  Palavras-chave do seu perfil
                </p>
                {optimizationInsights.searchKeywords?.length ? (
                  <div className={styles.insightChipList}>
                    {optimizationInsights.searchKeywords
                      .slice(0, 8)
                      .map((keyword) => (
                        <span
                          key={keyword}
                          className={`${styles.insightChip} ${styles.insightChipPrimary}`}
                        >
                          {keyword}
                        </span>
                      ))}
                  </div>
                ) : (
                  <p className={styles.insightDescription}>
                    Adicione mais competencias e objetivo profissional para
                    gerar palavras-chave.
                  </p>
                )}

                <p className={styles.optimizationSectionLabel}>
                  Competencias em falta mais frequentes
                </p>
                {optimizationInsights.marketSkillGaps?.length ? (
                  <div className={styles.insightChipList}>
                    {optimizationInsights.marketSkillGaps
                      .slice(0, 6)
                      .map((gap) => (
                        <span
                          key={gap}
                          className={`${styles.insightChip} ${styles.insightChipWarning}`}
                        >
                          {gap}
                        </span>
                      ))}
                  </div>
                ) : (
                  <p className={styles.insightDescription}>
                    Ainda nao ha lacunas claras com base no mercado atual.
                  </p>
                )}

                {optimizationInsights.summarySuggestion && (
                  <div className={styles.summarySuggestionBox}>
                    <p className={styles.optimizationSectionLabel}>
                      Resumo sugerido
                    </p>
                    <p>{optimizationInsights.summarySuggestion}</p>
                  </div>
                )}

                {optimizationInsights.topMatches?.length > 0 && (
                  <div className={styles.topMatchList}>
                    {optimizationInsights.topMatches
                      .slice(0, 3)
                      .map((match) => (
                        <Link
                          key={match.id}
                          href={`/vaga/${match.id}`}
                          className={styles.topMatchItem}
                        >
                          <div>
                            <strong>{match.title}</strong>
                            <p>{match.company}</p>
                          </div>
                          <span>{match.matchPercent}%</span>
                        </Link>
                      ))}
                  </div>
                )}
              </section>
            </div>

            <div className={styles.gridTwoCols}>
              <div className={styles.chartCard}>
                <div className={styles.sectionTitle}>
                  <span>Fluxo de Candidaturas</span>
                  <small>Últimos 7 dias</small>
                </div>
                <div className={styles.chartWrapper}>
                  <CandidateApplicationsChart data={chartData} />
                </div>
              </div>
              <div className={styles.tipsCard}>
                <div className={styles.sectionTitle}>
                  <span>AI Career Tips</span>
                  <small>Baseado no seu perfil</small>
                </div>
                {loadingTips ? (
                  <div className={styles.tipsLoading}>Carregando dicas...</div>
                ) : (
                  <div className={styles.tipsList}>
                    {careerTips.map((tip, index) => (
                      <div key={index} className={styles.tipItem}>
                        <p className={styles.tipTitle}>{tip.title}</p>
                        <p className={styles.tipContent}>{tip.content}</p>
                      </div>
                    ))}
                    {!careerTips.length && (
                      <p className={styles.tipFallback}>
                        Ainda não há dicas personalizadas.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {upcomingInterviews.length > 0 && (
              <section className={styles.sectionBlock}>
                <div className={styles.sectionTitle}>
                  <span>Próximas entrevistas</span>
                  <small>{upcomingInterviews.length} agendada(s)</small>
                </div>
                <div className={styles.jobList}>
                  {upcomingInterviews.map((application) => (
                    <div key={application.id} className={styles.jobCard}>
                      <div>
                        <p className={styles.jobTitle}>
                          {application.jobTitle || "Vaga"}
                        </p>
                        <p className={styles.jobMeta}>
                          {application.company || "Empresa"} •{" "}
                          {formatInterviewDate(
                            application.interviewDetails?.scheduledAt,
                          )}
                        </p>
                        <p
                          className={styles.jobMeta}
                          style={{ marginTop: "0.35rem", color: "#2057d7" }}
                        >
                          <InterviewPlaceOrLink
                            interviewDetails={application.interviewDetails}
                          />
                        </p>
                        <div
                          style={{
                            display: "flex",
                            gap: "0.5rem",
                            flexWrap: "wrap",
                            marginTop: "0.75rem",
                          }}
                        >
                          <Link
                            href="/dashboard/candidato/candidaturas?filter=interview"
                            className={styles.secondaryButton}
                            style={{ padding: "0.45rem 0.75rem" }}
                          >
                            Ver detalhes
                          </Link>
                          <button
                            type="button"
                            onClick={() =>
                              downloadInterviewICS(application.id).catch(
                                (err) => console.error(err),
                              )
                            }
                            className={styles.secondaryButton}
                            style={{ padding: "0.45rem 0.75rem" }}
                          >
                            📆 Calendário
                          </button>
                        </div>
                      </div>
                      <div className={styles.jobBadge}>Entrevista</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className={styles.sectionBlock}>
              <div className={styles.sectionTitle}>
                <span>Candidaturas Recentes</span>
                <small>Gerencie seus envios</small>
              </div>
              <ApplicationTable applications={applications} />
            </section>

            <section className={styles.sectionBlock}>
              <div className={styles.sectionTitle}>
                <span>Vagas recomendadas</span>
                <small>
                  {recommendedJobs.length} sugestão(ões) baseada(s) no seu
                  perfil
                </small>
              </div>
              {activePlan.features?.canReceiveRecommendations ? (
                <div className={styles.jobList}>
                  {recommendedJobs.slice(0, 4).map((job) => (
                    <Link
                      key={job.id}
                      href={`/vaga/${job.id}`}
                      className={styles.jobCard}
                    >
                      <div>
                        <p className={styles.jobTitle}>
                          {job.titulo || job.title || "Título não disponível"}
                        </p>
                        <p className={styles.jobMeta}>
                          {job.empresa ||
                            job.empresaNome ||
                            job.company ||
                            "Empresa desconhecida"}{" "}
                          •{" "}
                          {job.localizacao ||
                            job.location ||
                            "Local não informado"}
                        </p>
                        <p
                          className={styles.jobMeta}
                          style={{ marginTop: "0.35rem", color: "#2057d7" }}
                        >
                          {job.reasons?.[0] ||
                            "Compatibilidade com o seu perfil"}
                        </p>
                        {job.missingSkills?.length > 0 && (
                          <p
                            className={styles.jobMeta}
                            style={{ marginTop: "0.35rem", color: "#fca5a5" }}
                          >
                            Falta reforcar:{" "}
                            {job.missingSkills.slice(0, 2).join(", ")}
                          </p>
                        )}
                      </div>
                      <div className={styles.jobBadge}>
                        {typeof job.score === "number"
                          ? `${job.score}% match`
                          : job.tipoContrato || job.contractType || "Contrato"}
                      </div>
                    </Link>
                  ))}
                  {!recommendedJobs.length && (
                    <div className={styles.tipFallback}>
                      Nenhuma sugestão disponível.
                    </div>
                  )}
                </div>
              ) : (
                <div className={styles.tipFallback}>
                  Recomendações personalizadas são um recurso dos planos
                  Profissional e Premium.
                </div>
              )}
            </section>
          </div>
        );

      case "profile":
        return (
          <div className={styles.contentArea}>
            <div className={styles.profileHeader}>
              <div
                className={`${styles.profileCover} ${styles.profileCoverEditable} ${!hasProfileCover ? styles.profileCoverEmpty : ""}`}
                style={
                  hasProfileCover
                    ? {
                        backgroundImage: `url(${profileCoverUrl})`,
                      }
                    : undefined
                }
              >
                <div
                  className={`${styles.coverOverlay} ${!hasProfileCover ? styles.coverOverlaySoft : ""}`}
                />
                {editingProfile && (
                  <label className={styles.editCoverBtn}>
                    {coverUploading ? "Enviando..." : "📷 Alterar Capa"}
                    <input
                      type="file"
                      className={styles.hiddenFileInput}
                      accept="image/*"
                      onChange={(e) => handlePhotoUpload(e, "cover")}
                    />
                  </label>
                )}
              </div>
              <div className={styles.profileInfo}>
                <div className={styles.avatarEditWrap}>
                  {hasProfileAvatar ? (
                    <img
                      src={profileAvatarUrl}
                      alt={profileDisplayName}
                      className={styles.profileAvatar}
                    />
                  ) : (
                    <div
                      className={`${styles.profileAvatar} ${styles.profileAvatarFallback}`}
                      aria-hidden="true"
                    >
                      {profileAvatarInitials}
                    </div>
                  )}
                  {editingProfile && (
                    <label className={styles.avatarEditBtn}>
                      <span className={styles.avatarEditIcon}>✏️</span>
                      <input
                        type="file"
                        className={styles.hiddenFileInput}
                        accept="image/*"
                        onChange={(e) => handlePhotoUpload(e, "avatar")}
                      />
                    </label>
                  )}
                </div>
                <div className={styles.profileHeaderContent}>
                  {editingProfile ? (
                    <>
                      <input
                        className={styles.profileInput}
                        value={profileForm.name}
                        onChange={(e) =>
                          handleProfileFieldChange("name", e.target.value)
                        }
                      />
                      <input
                        className={styles.profileInput}
                        value={profileForm.headline}
                        onChange={(e) =>
                          handleProfileFieldChange("headline", e.target.value)
                        }
                      />
                    </>
                  ) : (
                    <>
                      <h1>
                        {profile?.fullName || profile?.name || user?.name}
                      </h1>
                      <p>
                        {profile?.headline ||
                          profile?.profession ||
                          user?.headline}
                      </p>
                    </>
                  )}
                  <p className={styles.profileMeta}>
                    {profile?.city || profile?.location || user?.location} •{" "}
                    {profile?.email || user?.email}
                  </p>
                  <div className={styles.profileHeaderBadges}>
                    <span
                      className={`${styles.profileHeaderBadge} ${profileCompletion.isProfileComplete ? styles.profileHeaderBadgeComplete : styles.profileHeaderBadgeMuted}`}
                    >
                      {profileCompletion.isProfileComplete
                        ? "Perfil completo"
                        : `${profileCompletion.score}% completo`}
                    </span>
                    {(profileVisibility.verified ||
                      profile?.verificationStatus === "verified") && (
                      <span
                        className={`${styles.profileHeaderBadge} ${styles.profileHeaderBadgeVerified}`}
                      >
                        Verificado
                      </span>
                    )}
                    {profileVisibility.highlighted && (
                      <span
                        className={`${styles.profileHeaderBadge} ${styles.profileHeaderBadgeHighlight}`}
                      >
                        Em destaque
                      </span>
                    )}
                  </div>
                </div>
                <div className={styles.profileActions}>
                  {editingProfile ? (
                    <div className={styles.profileActionGroup}>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={handleCancelEdit}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className={styles.primaryButton}
                        disabled={profileSaving}
                        onClick={handleSaveProfile}
                      >
                        {profileSaving ? "Salvando..." : "Salvar"}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={styles.primaryButton}
                      onClick={handleStartEditing}
                    >
                      Editar Perfil
                    </button>
                  )}
                </div>
              </div>
              {profileFeedback && (
                <p
                  className={
                    profileFeedback.type === "error"
                      ? styles.profileError
                      : styles.profileSuccess
                  }
                >
                  {profileFeedback.message}
                </p>
              )}
            </div>
            <div className={styles.profileGrid}>
              {/* EDIT MODE: FULL FORM */}
              {editingProfile ? (
                <div
                  className={`${styles.profileCardWide} ${styles.profileCardWideFull}`}
                >
                  {/* Informações Pessoais */}
                  <div className={styles.formSection}>
                    <h3 className={styles.formSectionTitle}>
                      🧑‍💼 Informações Pessoais
                    </h3>
                    <div className={styles.formSectionGrid}>
                      <input
                        className={styles.profileInput}
                        placeholder="Nome Completo"
                        value={profileForm.name}
                        onChange={(e) =>
                          handleProfileFieldChange("name", e.target.value)
                        }
                      />
                      <input
                        className={styles.profileInput}
                        type="date"
                        placeholder="Data de Nascimento"
                        value={profileForm.birthDate}
                        onChange={(e) =>
                          handleProfileFieldChange("birthDate", e.target.value)
                        }
                      />
                      <input
                        className={styles.profileInput}
                        placeholder="Nacionalidade"
                        value={profileForm.nationality}
                        onChange={(e) =>
                          handleProfileFieldChange(
                            "nationality",
                            e.target.value,
                          )
                        }
                      />
                      <select
                        className={styles.profileInput}
                        value={profileForm.gender}
                        onChange={(e) =>
                          handleProfileFieldChange("gender", e.target.value)
                        }
                      >
                        <option value="">Gênero...</option>
                        <option value="Masculino">Masculino</option>
                        <option value="Feminino">Feminino</option>
                        <option value="Outro">Outro</option>
                      </select>
                      <input
                        className={styles.profileInput}
                        placeholder="Estado Civil"
                        value={profileForm.maritalStatus}
                        onChange={(e) =>
                          handleProfileFieldChange(
                            "maritalStatus",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                  </div>

                  {/* Contatos */}
                  <div className={styles.formSection}>
                    <h3 className={styles.formSectionTitle}>📞 Contatos</h3>
                    <div className={styles.formSectionGrid}>
                      <input
                        className={styles.profileInput}
                        placeholder="Telefone"
                        value={profileForm.phone}
                        onChange={(e) =>
                          handleProfileFieldChange("phone", e.target.value)
                        }
                      />
                      <input
                        className={styles.profileInput}
                        placeholder="Localização"
                        value={profileForm.location}
                        onChange={(e) =>
                          handleProfileFieldChange("location", e.target.value)
                        }
                      />
                      <div className={styles.inlineActionField}>
                        <input
                          className={styles.profileInput}
                          placeholder="LinkedIn URL"
                          value={profileForm.linkedin}
                          onChange={(e) =>
                            handleProfileFieldChange("linkedin", e.target.value)
                          }
                        />
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={handleImportLinkedIn}
                        >
                          Importar
                        </button>
                      </div>
                      <input
                        className={styles.profileInput}
                        placeholder="Website / Portfolio"
                        value={profileForm.website}
                        onChange={(e) =>
                          handleProfileFieldChange("website", e.target.value)
                        }
                      />
                    </div>
                  </div>

                  {/* Objetivo */}
                  <div className={styles.formSection}>
                    <h3 className={styles.formSectionTitle}>
                      🎯 Objetivo Profissional
                    </h3>
                    <div className={styles.formSectionGridTwo}>
                      <input
                        className={styles.profileInput}
                        placeholder="Área de Interesse"
                        value={profileForm.objectiveArea}
                        onChange={(e) =>
                          handleProfileFieldChange(
                            "objectiveArea",
                            e.target.value,
                          )
                        }
                      />
                      <input
                        className={styles.profileInput}
                        placeholder="Tipo (Integral, Remoto...)"
                        value={profileForm.objectiveType}
                        onChange={(e) =>
                          handleProfileFieldChange(
                            "objectiveType",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <textarea
                      className={styles.profileTextarea}
                      rows={3}
                      placeholder="Aspirações de carreira..."
                      value={profileForm.objectiveAspiration}
                      onChange={(e) =>
                        handleProfileFieldChange(
                          "objectiveAspiration",
                          e.target.value,
                        )
                      }
                    />
                  </div>

                  {/* Resumo */}
                  <div className={styles.formSection}>
                    <h3 className={styles.formSectionTitle}>📝 Resumo (Bio)</h3>
                    <textarea
                      className={styles.profileTextarea}
                      rows={4}
                      value={profileForm.bio}
                      onChange={(e) =>
                        handleProfileFieldChange("bio", e.target.value)
                      }
                    />
                  </div>

                  {/* Formação e Idiomas (TextAreas simples conforme Profile.js) */}
                  <div className={styles.formSection}>
                    <div className={styles.formSectionGridWide}>
                      <div>
                        <h3 className={styles.formSectionTitle}>
                          🎓 Formação Acadêmica
                        </h3>
                        <p className={styles.formSectionHint}>
                          Linha por linha: Curso; Instituição; Ano
                        </p>
                        <textarea
                          className={styles.profileTextarea}
                          rows={5}
                          value={profileForm.education}
                          onChange={(e) =>
                            handleProfileFieldChange(
                              "education",
                              e.target.value,
                            )
                          }
                        />
                      </div>
                      <div>
                        <h3 className={styles.formSectionTitle}>🗣️ Idiomas</h3>
                        <p className={styles.formSectionHint}>
                          Linha por linha: Idioma; Nível
                        </p>
                        <textarea
                          className={styles.profileTextarea}
                          rows={5}
                          value={profileForm.languages}
                          onChange={(e) =>
                            handleProfileFieldChange(
                              "languages",
                              e.target.value,
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* Habilidades */}
                  <div className={styles.formSection}>
                    <h3 className={styles.formSectionTitle}>💡 Habilidades</h3>
                    <div className={styles.stackFields}>
                      <div>
                        <label className={styles.fieldLabel}>
                          Hard Skills (separadas por vírgula)
                        </label>
                        <input
                          className={styles.profileInput}
                          value={profileForm.skills}
                          onChange={(e) =>
                            handleProfileFieldChange("skills", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <label className={styles.fieldLabel}>
                          Soft Skills (separadas por vírgula)
                        </label>
                        <input
                          className={styles.profileInput}
                          value={profileForm.skillsSoft}
                          onChange={(e) =>
                            handleProfileFieldChange(
                              "skillsSoft",
                              e.target.value,
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* Competências Digitais */}
                  <div className={styles.formSection}>
                    <h3 className={styles.formSectionTitle}>
                      💻 Competências Digitais
                    </h3>
                    <form
                      onSubmit={addDigitalSkill}
                      className={styles.digitalSkillForm}
                    >
                      <input
                        name="skill"
                        className={`${styles.profileInput} ${styles.digitalSkillInput}`}
                        placeholder="Adicionar ferramenta..."
                      />
                      <button type="submit" className={styles.secondaryButton}>
                        +
                      </button>
                    </form>
                    <div className={styles.digitalSkills}>
                      {profileForm.digitalSkills.map((s) => (
                        <span key={s} className={styles.digitalSkillTag}>
                          {s}{" "}
                          <button
                            type="button"
                            className={styles.digitalSkillRemove}
                            onClick={() => removeDigitalSkill(s)}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Experiência (Estruturada) */}
                  <div>
                    <div className={styles.profileCardWideHeader}>
                      <h3 className={styles.formSectionTitle}>
                        💼 Experiência Profissional
                      </h3>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={handleAddExperience}
                      >
                        + Adicionar
                      </button>
                    </div>
                    <div className={styles.timelineList}>
                      {profileForm.experiences.map((exp, index) => (
                        <div
                          key={index}
                          className={`${styles.experienceItem} ${styles.experienceItemExtended}`}
                        >
                          <div
                            className={`${styles.experienceFields} ${styles.experienceFieldsCompact}`}
                          >
                            <input
                              className={styles.profileInput}
                              value={exp.role}
                              placeholder="Cargo"
                              onChange={(e) =>
                                handleExperienceChange(
                                  index,
                                  "role",
                                  e.target.value,
                                )
                              }
                            />
                            <input
                              className={styles.profileInput}
                              value={exp.company}
                              placeholder="Empresa"
                              onChange={(e) =>
                                handleExperienceChange(
                                  index,
                                  "company",
                                  e.target.value,
                                )
                              }
                            />
                            <input
                              className={styles.profileInput}
                              value={exp.period}
                              placeholder="Período"
                              onChange={(e) =>
                                handleExperienceChange(
                                  index,
                                  "period",
                                  e.target.value,
                                )
                              }
                            />
                            <textarea
                              className={styles.profileTextarea}
                              rows={2}
                              value={exp.description}
                              placeholder="Descrição"
                              onChange={(e) =>
                                handleExperienceChange(
                                  index,
                                  "description",
                                  e.target.value,
                                )
                              }
                            />
                          </div>
                          <button
                            type="button"
                            className={styles.linkButton}
                            onClick={() => handleRemoveExperience(index)}
                          >
                            Remover
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Certificados Upload */}
                  <div className={styles.sectionDividerTop}>
                    <h3 className={styles.formSectionTitle}>📜 Certificados</h3>
                    <p className={styles.formSectionHint}>
                      Adicione comprovativos em PDF
                    </p>
                    {activePlan.features?.canUploadCertificates ? (
                      <label
                        className={`${styles.secondaryButton} ${styles.certificateUploadButton}`}
                      >
                        📤 Upload Certificados
                        <input
                          type="file"
                          multiple
                          accept=".pdf"
                          className={styles.hiddenFileInput}
                          onChange={handleCertUpload}
                        />
                      </label>
                    ) : (
                      <div className={styles.formSectionWarning}>
                        <p className={styles.warningText}>
                          Este recurso é exclusivo dos planos Profissional e
                          Premium.
                        </p>
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={() => setActiveTab("plans")}
                        >
                          Fazer upgrade
                        </button>
                      </div>
                    )}
                    {profileForm.certificateFiles.length > 0 && (
                      <ul className={styles.certificateList}>
                        {profileForm.certificateFiles.map((url, i) => (
                          <li key={i} className={styles.certificateListItem}>
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className={styles.certificateLink}
                            >
                              Certificado {i + 1}
                            </a>
                            <button
                              type="button"
                              className={styles.linkButton}
                              onClick={() => removeCertificate(i)}
                            >
                              Remover
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ) : (
                /* VIEW MODE: COMPACT CARDS + EXPANDED DETAILS */
                <>
                  <div className={styles.profileCard}>
                    <h3>Resumo</h3>
                    <p>{profile?.bio || user?.bio}</p>
                    {(profile?.objectiveArea || user?.objectiveArea) && (
                      <div className={styles.profileObjective}>
                        <p className={styles.profileObjectiveValue}>
                          🎯 Objetivo:{" "}
                          <span>
                            {profile?.objectiveArea || user?.objectiveArea}{" "}
                            {profile?.objectiveType || user?.objectiveType
                              ? `(${profile?.objectiveType || user?.objectiveType})`
                              : ""}
                          </span>
                        </p>
                        {(profile?.objectiveAspiration ||
                          user?.objectiveAspiration) && (
                          <p className={styles.profileObjectiveQuote}>
                            &quot;
                            {profile?.objectiveAspiration ||
                              user?.objectiveAspiration}
                            &quot;
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className={styles.profileCard}>
                    <h3>Competências</h3>
                    <div className={styles.skillsList}>
                      {profile?.skillsHard &&
                        profile.skillsHard.map((skill) => (
                          <span key={skill}>{skill}</span>
                        ))}
                      {profile?.digitalSkills &&
                        profile.digitalSkills.map((s) => (
                          <span key={s} className={styles.skillAccent}>
                            {s}
                          </span>
                        ))}
                    </div>
                  </div>

                  <div className={styles.profileCard}>
                    <h3>Contato</h3>
                    <p>📧 {profile?.email || user?.email}</p>
                    <p>📱 {profile?.phone || user?.phone}</p>
                    <p>
                      📍 {profile?.city || profile?.location || user?.location}
                    </p>
                    {profile?.linkedin && (
                      <p>
                        <a
                          href={profile.linkedin}
                          target="_blank"
                          rel="noreferrer"
                          className={styles.profileExternalLink}
                        >
                          LinkedIn
                        </a>
                      </p>
                    )}
                    {profile?.website && (
                      <p>
                        <a
                          href={profile.website}
                          target="_blank"
                          rel="noreferrer"
                          className={styles.profileExternalLink}
                        >
                          Website
                        </a>
                      </p>
                    )}

                    <div
                      className={`${styles.cvUploadSection} ${styles.cvUploadSectionStacked}`}
                    >
                      <p className={styles.cvLabel}>Currículo atual</p>
                      <p className={styles.cvName}>
                        {cvState.name || "Nenhum CV"}
                      </p>
                      {cvState.url && (
                        <a
                          href={cvState.url}
                          target="_blank"
                          rel="noreferrer"
                          className={styles.cvLink}
                        >
                          Ver CV
                        </a>
                      )}
                      <label className={styles.cvUploadButton}>
                        <input
                          type="file"
                          accept="application/pdf"
                          onChange={handleCvChange}
                        />
                        {cvState.uploading ? "Enviando..." : "Atualizar CV"}
                      </label>
                    </div>
                  </div>

                  <div className={styles.profileCardWide}>
                    <h3>Experiência</h3>
                    <div className={styles.timelineList}>
                      {(() => {
                        const experienceItems = Array.isArray(
                          profile?.experience,
                        )
                          ? profile.experience
                          : Array.isArray(user?.experience)
                            ? user.experience
                            : [];

                        if (!experienceItems.length) {
                          return (
                            <p className={styles.profileMeta}>
                              Nenhuma experiência adicionada.
                            </p>
                          );
                        }

                        return experienceItems.map((exp, index) => {
                          const role = exp?.role || exp?.title || "";
                          const company =
                            exp?.company ||
                            exp?.employer ||
                            exp?.organization ||
                            "";
                          const period = exp?.period || exp?.dateRange || "";
                          const description =
                            exp?.description || exp?.details || "";
                          return (
                            <article key={`${company || "exp"}-${index}`}>
                              <h4>{role || "Experiência profissional"}</h4>
                              {company || period ? (
                                <p className={styles.profileMeta}>
                                  {[company, period]
                                    .filter(Boolean)
                                    .join(" • ")}
                                </p>
                              ) : null}
                              {description ? <p>{description}</p> : null}
                            </article>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {/* Detalhes Adicionais em Modo Visualização */}
                  {(profile?.education ||
                    user?.education ||
                    profile?.languages ||
                    user?.languages ||
                    profile?.certifications ||
                    user?.certifications) && (
                    <div className={styles.profileCardWide}>
                      <div className={styles.detailGrid}>
                        {(profile?.education || user?.education) && (
                          <div>
                            <h3>Formação</h3>
                            <pre className={styles.preformattedText}>
                              {profile?.education || user?.education}
                            </pre>
                          </div>
                        )}
                        {(profile?.languages || user?.languages) && (
                          <div>
                            <h3>Idiomas</h3>
                            <pre className={styles.preformattedText}>
                              {profile?.languages || user?.languages}
                            </pre>
                          </div>
                        )}
                        {(profile?.certifications || user?.certifications) && (
                          <div>
                            <h3>Certificações</h3>
                            <pre className={styles.preformattedText}>
                              {profile?.certifications || user?.certifications}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {(profile?.certificateFiles || user?.certificateFiles) &&
                    (profile?.certificateFiles || user?.certificateFiles)
                      .length > 0 && (
                      <div className={styles.profileCardWide}>
                        <h3>Comprovativos / Certificados</h3>
                        <div className={styles.documentChips}>
                          {(
                            profile?.certificateFiles || user?.certificateFiles
                          ).map((url, i) => (
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className={styles.secondaryButton}
                            >
                              📄 Documento {i + 1}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                </>
              )}
            </div>
          </div>
        );

      case "messages":
        return (
          <div className={styles.messagesLayout}>
            <div className={styles.messagesList}>
              {conversations.length === 0 ? (
                <p
                  className={`${styles.messagePlaceholder} ${styles.messagePlaceholderPadded}`}
                >
                  Nenhuma conversa ainda.
                </p>
              ) : (
                conversations.map((conversation) => {
                  const initials = (conversation.participant.name || "U")
                    .charAt(0)
                    .toUpperCase();
                  const timeLabel = conversation.lastMessageAt
                    ? new Date(conversation.lastMessageAt).toLocaleDateString(
                        "pt-PT",
                        { day: "2-digit", month: "2-digit" },
                      )
                    : "";
                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      className={`${styles.messageItem} ${selectedConversation === conversation.id ? styles.selectedMessageItem : ""}`}
                      onClick={() => setSelectedConversation(conversation.id)}
                    >
                      <div className={styles.messageAvatarWrapper}>
                        {conversation.participant.avatar ? (
                          <img
                            src={conversation.participant.avatar}
                            alt={conversation.participant.name}
                          />
                        ) : (
                          <div className={styles.messageAvatarInitials}>
                            {initials}
                          </div>
                        )}
                        {conversation.unreadCount > 0 && (
                          <span className={styles.messageBadge}>
                            {conversation.unreadCount}
                          </span>
                        )}
                      </div>
                      <div className={styles.messageBody}>
                        <strong>{conversation.participant.name}</strong>
                        <p>{conversation.lastMessage || "Sem mensagens"}</p>
                      </div>
                      <span className={styles.messageTime}>{timeLabel}</span>
                    </button>
                  );
                })
              )}
            </div>
            <div className={styles.messageDetail}>
              {messagesContent ? (
                <>
                  <div className={styles.messageDetailHeader}>
                    <h3>{messagesContent.participant.name}</h3>
                    {messagesContent.participant.role && (
                      <p className={styles.profileMeta}>
                        {messagesContent.participant.role}
                      </p>
                    )}
                  </div>
                  <div className={styles.messageThread}>
                    {loadingMessages ? (
                      <p className={styles.messagePlaceholder}>
                        A carregar mensagens...
                      </p>
                    ) : messages.length === 0 ? (
                      <p className={styles.messagePlaceholder}>
                        Ainda não há mensagens. Seja o primeiro a escrever!
                      </p>
                    ) : (
                      messages.map((msg) => {
                        const isOwn = msg.senderId === user?.uid;
                        return (
                          <div
                            key={msg.id}
                            className={
                              isOwn
                                ? styles.messageBubbleOwn
                                : styles.messageBubble
                            }
                          >
                            <span>{msg.text}</span>
                            <time className={styles.messageBubbleTime}>
                              {msg.createdAt
                                ? new Date(msg.createdAt).toLocaleTimeString(
                                    "pt-PT",
                                    { hour: "2-digit", minute: "2-digit" },
                                  )
                                : ""}
                            </time>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                  <div className={styles.messageFooter}>
                    <input
                      type="text"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Escreva uma mensagem..."
                      className={styles.messageTextInput}
                      disabled={sendingMessage}
                      maxLength={2000}
                    />
                    <button
                      type="button"
                      className={styles.messageSendBtn}
                      onClick={handleSendMessage}
                      disabled={sendingMessage || !messageInput.trim()}
                    >
                      {sendingMessage ? (
                        "…"
                      ) : (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          width="18"
                          height="18"
                        >
                          <path d="M22 2L11 13" />
                          <path d="M22 2L15 22l-4-9-9-4 20-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <div className={styles.messageEmptyState}>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    width="48"
                    height="48"
                  >
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                  <p>Selecione uma conversa para começar.</p>
                </div>
              )}
            </div>
          </div>
        );

      case "notifications":
        return (
          <div className={styles.notificationsWrapper}>
            <div className={styles.notificationsHeader}>
              <h2
                className={`${styles.sectionTitle} ${styles.sectionTitleNoMargin}`}
              >
                Notificações
              </h2>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={markAllNotificationsAsRead}
                disabled={!unreadNotifications}
              >
                Marcar todas como lidas
              </button>
            </div>
            <div className={styles.notificationList}>
              {notifications.map((notif) => (
                <article
                  key={notif.id}
                  className={`${styles.notificationItem} ${notif.read ? styles.notificationRead : ""}`}
                  onClick={() => markNotificationAsRead(notif.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      markNotificationAsRead(notif.id);
                    }
                  }}
                >
                  <div>
                    <strong>{notif.title}</strong>
                    <p>{notif.message}</p>
                  </div>
                  <span className={styles.notificationTime}>
                    {notif.createdAt
                      ? new Date(notif.createdAt).toLocaleString("pt-PT")
                      : ""}
                  </span>
                </article>
              ))}
              {!notifications.length && (
                <p className={styles.tipFallback}>
                  Nenhuma notificação recente.
                </p>
              )}
            </div>
          </div>
        );

      case "plans":
        return (
          <div className={styles.contentArea}>
            <CandidatePremiumPlansExperience
              embedded
              onPlanApproved={async () => {
                await refreshPlanStatus();
              }}
            />
          </div>
        );

      case "applications":
        return (
          <div className={styles.contentArea}>
            <h2 className={styles.sectionTitle}>Minhas Candidaturas</h2>
            {upcomingInterviews.length > 0 && (
              <div className={`${styles.jobList} ${styles.jobListSpaced}`}>
                {upcomingInterviews.map((application) => (
                  <div key={application.id} className={styles.jobCard}>
                    <div>
                      <p className={styles.jobTitle}>
                        {application.jobTitle || "Vaga"}
                      </p>
                      <p className={styles.jobMeta}>
                        {application.company || "Empresa"} •{" "}
                        {formatInterviewDate(
                          application.interviewDetails?.scheduledAt,
                        )}
                      </p>
                      <p
                        className={`${styles.jobMeta} ${styles.jobMetaAccent}`}
                      >
                        <InterviewPlaceOrLink
                          interviewDetails={application.interviewDetails}
                        />
                      </p>
                    </div>
                    <div className={styles.jobBadge}>Entrevista</div>
                  </div>
                ))}
              </div>
            )}
            <ApplicationTable applications={applications} />
          </div>
        );

      case "saved":
        return (
          <div className={styles.contentArea}>
            <div className={styles.sectionTitle}>
              <span>Vagas Salvas</span>
              <small>
                {savedJobs.length} {savedJobs.length === 1 ? "vaga" : "vagas"}{" "}
                guardada(s)
              </small>
            </div>
            {savedJobs.length ? (
              <div className={styles.savedList}>
                {savedJobs.map((job) => (
                  <Link
                    key={job.id}
                    href={`/vaga/${job.id}`}
                    className={styles.savedCard}
                  >
                    <div>
                      <h3>{job.titulo || job.name || "Título indisponível"}</h3>
                      <p>
                        {job.empresa || job.company || "Empresa desconhecida"}
                      </p>
                    </div>
                    <span>
                      {job.localizacao || job.location || "Local não informado"}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className={styles.tipFallback}>
                Você ainda não salvou nenhuma vaga. Explore o painel e marque as
                favoritas.
              </p>
            )}
          </div>
        );

      case "verification":
        return (
          <div className={styles.contentArea}>
            <div className={styles.planGrid}>
              <div
                className={`${styles.planDetails} ${styles.planDetailsMain}`}
              >
                <h2>Verificação de Perfil</h2>
                <p className={styles.planMeta}>
                  Organize a sua revisao por blocos. A identidade controla o
                  selo publico, e os outros tipos reforcam confianca, qualidade
                  e ranking do perfil.
                </p>

                <div className={styles.verificationPanel}>
                  <div className={styles.verificationOverview}>
                    <div>
                      <span
                        className={`${styles.verificationStatusPill} ${styles[verificationOverallMeta.toneClass]}`}
                      >
                        {verificationOverallMeta.label}
                      </span>
                      <h3 className={styles.verificationOverviewTitle}>
                        Revisao modular de confianca
                      </h3>
                      <p className={styles.verificationOverviewText}>
                        {verificationOverallMeta.summary}
                      </p>
                      <p className={styles.verificationOverviewMeta}>
                        Ultimo envio:{" "}
                        {verificationSummary?.lastSubmittedAt
                          ? formatDate(verificationSummary.lastSubmittedAt)
                          : "Ainda nao submetido"}
                      </p>
                    </div>

                    <div className={styles.verificationOverviewStats}>
                      <div className={styles.verificationOverviewStat}>
                        <strong>
                          {verificationSummary?.requestedCount || 0}
                        </strong>
                        <span>Tipos pedidos</span>
                      </div>
                      <div className={styles.verificationOverviewStat}>
                        <strong>
                          {verificationSummary?.approvedCount || 0}
                        </strong>
                        <span>Aprovados</span>
                      </div>
                      <div className={styles.verificationOverviewStat}>
                        <strong>
                          {verificationSummary?.pendingCount || 0}
                        </strong>
                        <span>Em analise</span>
                      </div>
                      <div className={styles.verificationOverviewStat}>
                        <strong>
                          {verificationSummary?.progressPercent || 0}%
                        </strong>
                        <span>Progresso</span>
                      </div>
                    </div>
                  </div>

                  {verificationFetching ? (
                    <p className={styles.tipFallback}>
                      A carregar o estado da verificacao...
                    </p>
                  ) : (
                    <div className={styles.verificationTypeGrid}>
                      {verificationItems.map((item) => {
                        const itemStatusMeta = getVerificationStatusMeta(
                          item.status,
                        );
                        return (
                          <article
                            key={item.type}
                            className={styles.verificationTypeCard}
                          >
                            <div className={styles.verificationTypeHeader}>
                              <div>
                                <div className={styles.verificationTypeEyebrow}>
                                  {item.label}
                                </div>
                                <h4 className={styles.verificationTypeTitle}>
                                  {item.label}
                                </h4>
                                <p
                                  className={styles.verificationTypeDescription}
                                >
                                  {item.description}
                                </p>
                              </div>
                              <span
                                className={`${styles.verificationStatusPill} ${styles[itemStatusMeta.toneClass]}`}
                              >
                                {itemStatusMeta.label}
                              </span>
                            </div>

                            <div className={styles.verificationTypeMetaRow}>
                              <span>
                                {item.completedChecklistCount}/
                                {item.totalChecklistCount || 0} requisitos
                              </span>
                              <span>{item.evidenceCount || 0} evidencias</span>
                              <span>
                                {item.submittedAt
                                  ? `Atualizado em ${formatDate(item.submittedAt)}`
                                  : "Sem submissao"}
                              </span>
                            </div>

                            {item.reviewReason && (
                              <div className={styles.verificationReviewNote}>
                                <strong>Observacao da revisao:</strong>{" "}
                                {item.reviewReason}
                              </div>
                            )}

                            {item.checklist.length > 0 ? (
                              <ul
                                className={styles.verificationChecklistCompact}
                              >
                                {item.checklist.map((check) => (
                                  <li
                                    key={check.id}
                                    className={
                                      styles.verificationChecklistCompactItem
                                    }
                                  >
                                    <span
                                      className={`${styles.verificationMiniCheck} ${check.completed ? styles.verificationMiniCheckDone : styles.verificationMiniCheckPending}`}
                                    >
                                      {check.completed ? "OK" : "!"}
                                    </span>
                                    <span>{check.label}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className={styles.verificationTypeHint}>
                                Este bloco ainda nao recebeu detalhes
                                suficientes para revisao.
                              </p>
                            )}

                            {item.evidence.length > 0 && (
                              <div
                                className={styles.verificationEvidencePreview}
                              >
                                {item.evidence
                                  .slice(0, 3)
                                  .map((evidence, index) => (
                                    <span
                                      key={
                                        evidence.id || `${item.type}-${index}`
                                      }
                                      className={
                                        styles.verificationEvidenceChip
                                      }
                                    >
                                      {evidence.label ||
                                        evidence.fileName ||
                                        "Evidencia"}
                                    </span>
                                  ))}
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  )}

                  {verificationMessage && (
                    <p
                      className={`${styles.verificationBanner} ${verificationMessage.type === "success" ? styles.verificationBannerSuccess : styles.verificationBannerError}`}
                    >
                      {verificationMessage.text}
                    </p>
                  )}

                  {!canRequestVerification ? (
                    <div className={styles.verificationLocked}>
                      <div className={styles.verificationLockedIcon}>🔒</div>
                      <div>
                        <h3 className={styles.verificationLockedTitle}>
                          Verificacao premium
                        </h3>
                        <p className={styles.verificationLockedText}>
                          O envio de novos blocos de verificacao esta disponivel
                          nos planos Verificacao e Premium. O historico atual
                          continua visivel aqui.
                        </p>
                      </div>
                      <button
                        type="button"
                        className={styles.primaryButton}
                        onClick={() => setActiveTab("plans")}
                      >
                        Ver planos e fazer upgrade
                      </button>
                    </div>
                  ) : (
                    <div className={styles.verificationComposer}>
                      <div className={styles.verificationComposerHeader}>
                        <div>
                          <h3 className={styles.verificationComposerTitle}>
                            Enviar ou atualizar blocos
                          </h3>
                          <p className={styles.verificationComposerText}>
                            Selecione apenas os tipos que quer rever agora. Os
                            blocos ja aprovados ficam preservados.
                          </p>
                        </div>
                        <span className={styles.verificationComposerMeta}>
                          {selectedVerificationTypes.length}{" "}
                          {selectedVerificationTypes.length === 1
                            ? "tipo selecionado"
                            : "tipos selecionados"}
                        </span>
                      </div>

                      <div className={styles.verificationTypeSelector}>
                        {verificationItems.map((item) => {
                          const disabled = item.status === "approved";
                          const selected = selectedVerificationTypes.includes(
                            item.type,
                          );
                          const itemStatusMeta = getVerificationStatusMeta(
                            item.status,
                          );

                          return (
                            <button
                              key={`select-${item.type}`}
                              type="button"
                              className={`${styles.verificationTypeToggle} ${selected ? styles.verificationTypeToggleActive : ""} ${disabled ? styles.verificationTypeToggleDisabled : ""}`}
                              onClick={() =>
                                !disabled && toggleVerificationType(item.type)
                              }
                              disabled={disabled}
                            >
                              <strong>{item.label}</strong>
                              <span>
                                {disabled
                                  ? "Ja aprovado"
                                  : itemStatusMeta.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {selectedVerificationTypes.length === 0 ? (
                        <div className={styles.verificationEmptySelection}>
                          Todos os blocos editaveis ja estao aprovados. Se
                          quiser rever novos tipos, escolha um bloco ainda nao
                          aprovado.
                        </div>
                      ) : (
                        <div className={styles.verificationFormStack}>
                          {selectedVerificationTypes.includes("identity") && (
                            <section className={styles.verificationFormCard}>
                              <div
                                className={styles.verificationFormCardHeader}
                              >
                                <h4>Identidade</h4>
                                <p>
                                  Confirme os contactos base e envie documento +
                                  selfie.
                                </p>
                              </div>
                              <div className={styles.verificationFormGrid}>
                                <div>
                                  <label
                                    className={styles.verificationFieldLabel}
                                  >
                                    Email
                                  </label>
                                  <input
                                    className={styles.profileInput}
                                    value={verificationForm.contactEmail}
                                    onChange={(event) =>
                                      handleVerificationFieldChange(
                                        "contactEmail",
                                        event.target.value,
                                      )
                                    }
                                  />
                                </div>
                                <div>
                                  <label
                                    className={styles.verificationFieldLabel}
                                  >
                                    Telefone
                                  </label>
                                  <input
                                    className={styles.profileInput}
                                    value={verificationForm.contactPhone}
                                    onChange={(event) =>
                                      handleVerificationFieldChange(
                                        "contactPhone",
                                        event.target.value,
                                      )
                                    }
                                  />
                                </div>
                              </div>
                              <div className={styles.verificationUploadGrid}>
                                <label
                                  className={`${styles.cvUploadButton} ${styles.verificationUpload}`}
                                >
                                  <span
                                    className={styles.verificationUploadText}
                                  >
                                    {verificationForm.identityDocument
                                      ? verificationForm.identityDocument.name
                                      : "Documento de identidade"}
                                  </span>
                                  <input
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={(event) =>
                                      handleVerificationFileChange(
                                        "identityDocument",
                                        event.target.files,
                                      )
                                    }
                                  />
                                </label>
                                <label
                                  className={`${styles.cvUploadButton} ${styles.verificationUpload}`}
                                >
                                  <span
                                    className={styles.verificationUploadText}
                                  >
                                    {verificationForm.selfieDocument
                                      ? verificationForm.selfieDocument.name
                                      : "Selfie com documento"}
                                  </span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(event) =>
                                      handleVerificationFileChange(
                                        "selfieDocument",
                                        event.target.files,
                                      )
                                    }
                                  />
                                </label>
                              </div>
                            </section>
                          )}

                          {selectedVerificationTypes.includes(
                            "certificates",
                          ) && (
                            <section className={styles.verificationFormCard}>
                              <div
                                className={styles.verificationFormCardHeader}
                              >
                                <h4>Certificados</h4>
                                <p>
                                  Liste certificados relevantes e anexe
                                  comprovativos.
                                </p>
                              </div>
                              <label className={styles.verificationFieldLabel}>
                                Resumo dos certificados
                              </label>
                              <textarea
                                className={styles.profileTextarea}
                                rows={4}
                                value={verificationForm.certificationsText}
                                onChange={(event) =>
                                  handleVerificationFieldChange(
                                    "certificationsText",
                                    event.target.value,
                                  )
                                }
                                placeholder="Ex: Curso de Excel Avancado, Certificado de Seguranca, Formacao tecnica..."
                              />
                              <label
                                className={`${styles.cvUploadButton} ${styles.verificationUpload} ${styles.verificationUploadCompact}`}
                              >
                                <span className={styles.verificationUploadText}>
                                  {verificationForm.certificateDocuments.length
                                    ? `${verificationForm.certificateDocuments.length} ficheiro(s) selecionado(s)`
                                    : "Anexar certificados"}
                                </span>
                                <input
                                  type="file"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  multiple
                                  onChange={(event) =>
                                    handleVerificationFileChange(
                                      "certificateDocuments",
                                      event.target.files,
                                      { multiple: true },
                                    )
                                  }
                                />
                              </label>
                              {verificationForm.certificateDocuments.length >
                                0 && (
                                <div className={styles.verificationFileList}>
                                  {verificationForm.certificateDocuments.map(
                                    (file) => (
                                      <span
                                        key={file.name}
                                        className={styles.verificationFileChip}
                                      >
                                        {file.name}
                                      </span>
                                    ),
                                  )}
                                </div>
                              )}
                            </section>
                          )}

                          {selectedVerificationTypes.includes("academic") && (
                            <section className={styles.verificationFormCard}>
                              <div
                                className={styles.verificationFormCardHeader}
                              >
                                <h4>Formacao academica</h4>
                                <p>
                                  Resuma o percurso academico e anexe
                                  comprovativos se tiver.
                                </p>
                              </div>
                              <label className={styles.verificationFieldLabel}>
                                Resumo academico
                              </label>
                              <textarea
                                className={styles.profileTextarea}
                                rows={4}
                                value={verificationForm.educationSummary}
                                onChange={(event) =>
                                  handleVerificationFieldChange(
                                    "educationSummary",
                                    event.target.value,
                                  )
                                }
                                placeholder="Ex: Licenciatura em Gestao, Universidade..., 2021"
                              />
                              <label
                                className={`${styles.cvUploadButton} ${styles.verificationUpload} ${styles.verificationUploadCompact}`}
                              >
                                <span className={styles.verificationUploadText}>
                                  {verificationForm.academicDocument
                                    ? verificationForm.academicDocument.name
                                    : "Anexar diploma ou declaracao"}
                                </span>
                                <input
                                  type="file"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  onChange={(event) =>
                                    handleVerificationFileChange(
                                      "academicDocument",
                                      event.target.files,
                                    )
                                  }
                                />
                              </label>
                            </section>
                          )}

                          {selectedVerificationTypes.includes("experience") && (
                            <section className={styles.verificationFormCard}>
                              <div
                                className={styles.verificationFormCardHeader}
                              >
                                <h4>Experiencia profissional</h4>
                                <p>
                                  Use o seu historico do perfil, um resumo
                                  manual e comprovativos de trabalho.
                                </p>
                              </div>
                              <label className={styles.verificationFieldLabel}>
                                Resumo da experiencia
                              </label>
                              <textarea
                                className={styles.profileTextarea}
                                rows={4}
                                value={verificationForm.experienceSummary}
                                onChange={(event) =>
                                  handleVerificationFieldChange(
                                    "experienceSummary",
                                    event.target.value,
                                  )
                                }
                                placeholder="Descreva rapidamente as funcoes e empresas mais relevantes."
                              />

                              {profile?.cvUrl &&
                                !verificationForm.cvDocument && (
                                  <div
                                    className={styles.verificationExistingCv}
                                  >
                                    <span>📄</span>
                                    <span
                                      className={
                                        styles.verificationExistingCvName
                                      }
                                    >
                                      {profile?.cvName ||
                                        "CV atual guardado no perfil"}
                                    </span>
                                    <span
                                      className={
                                        styles.verificationExistingCvStatus
                                      }
                                    >
                                      Usar atual
                                    </span>
                                  </div>
                                )}

                              <div className={styles.verificationUploadGrid}>
                                <label
                                  className={`${styles.cvUploadButton} ${styles.verificationUpload} ${styles.verificationUploadCompact}`}
                                >
                                  <span
                                    className={styles.verificationUploadText}
                                  >
                                    {verificationForm.employmentProof
                                      ? verificationForm.employmentProof.name
                                      : "Comprovativo de experiencia"}
                                  </span>
                                  <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={(event) =>
                                      handleVerificationFileChange(
                                        "employmentProof",
                                        event.target.files,
                                      )
                                    }
                                  />
                                </label>
                                <label
                                  className={`${styles.cvUploadButton} ${styles.verificationUpload} ${styles.verificationUploadCompact}`}
                                >
                                  <span
                                    className={styles.verificationUploadText}
                                  >
                                    {verificationForm.cvDocument
                                      ? verificationForm.cvDocument.name
                                      : "Novo CV em PDF (opcional)"}
                                  </span>
                                  <input
                                    type="file"
                                    accept=".pdf"
                                    onChange={(event) =>
                                      handleVerificationFileChange(
                                        "cvDocument",
                                        event.target.files,
                                      )
                                    }
                                  />
                                </label>
                              </div>
                            </section>
                          )}

                          {selectedVerificationTypes.includes(
                            "competencies",
                          ) && (
                            <section className={styles.verificationFormCard}>
                              <div
                                className={styles.verificationFormCardHeader}
                              >
                                <h4>Competencias</h4>
                                <p>
                                  Refira skills, portfolio e links que ajudem a
                                  validar capacidade real.
                                </p>
                              </div>
                              <label className={styles.verificationFieldLabel}>
                                Notas sobre competencias
                              </label>
                              <textarea
                                className={styles.profileTextarea}
                                rows={4}
                                value={verificationForm.competencyNotes}
                                onChange={(event) =>
                                  handleVerificationFieldChange(
                                    "competencyNotes",
                                    event.target.value,
                                  )
                                }
                                placeholder="Ex: gestao de equipas, Excel avancado, manutencao industrial, vendas..."
                              />
                              <div className={styles.verificationFormGrid}>
                                <div>
                                  <label
                                    className={styles.verificationFieldLabel}
                                  >
                                    Portfolio / website
                                  </label>
                                  <input
                                    className={styles.profileInput}
                                    value={verificationForm.portfolioUrl}
                                    onChange={(event) =>
                                      handleVerificationFieldChange(
                                        "portfolioUrl",
                                        event.target.value,
                                      )
                                    }
                                    placeholder="https://..."
                                  />
                                </div>
                                <div>
                                  <label
                                    className={styles.verificationFieldLabel}
                                  >
                                    LinkedIn
                                  </label>
                                  <input
                                    className={styles.profileInput}
                                    value={verificationForm.linkedin}
                                    onChange={(event) =>
                                      handleVerificationFieldChange(
                                        "linkedin",
                                        event.target.value,
                                      )
                                    }
                                    placeholder="https://linkedin.com/in/..."
                                  />
                                </div>
                              </div>
                              <label
                                className={`${styles.cvUploadButton} ${styles.verificationUpload} ${styles.verificationUploadCompact}`}
                              >
                                <span className={styles.verificationUploadText}>
                                  {verificationForm.competencyDocument
                                    ? verificationForm.competencyDocument.name
                                    : "Comprovativo adicional de competencias"}
                                </span>
                                <input
                                  type="file"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  onChange={(event) =>
                                    handleVerificationFileChange(
                                      "competencyDocument",
                                      event.target.files,
                                    )
                                  }
                                />
                              </label>
                            </section>
                          )}
                        </div>
                      )}

                      <div className={styles.verificationActions}>
                        <button
                          className={`${styles.primaryButton} ${styles.fullWidthButton}`}
                          onClick={handleVerificationSubmit}
                          disabled={
                            verificationLoading ||
                            selectedVerificationTypes.length === 0
                          }
                        >
                          {verificationLoading
                            ? "A enviar..."
                            : "Enviar para revisao"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div
                className={`${styles.planResources} ${styles.planResourcesFixed}`}
              >
                <h3>Como funciona</h3>
                <ul className={styles.planFeatures}>
                  <li>
                    O selo publico depende da aprovacao do bloco de identidade.
                  </li>
                  <li>
                    Certificados, formacao, experiencia e competencias podem ser
                    enviados e revistos separadamente.
                  </li>
                  <li>
                    Blocos aprovados ficam preservados quando atualiza um novo
                    pedido.
                  </li>
                </ul>
                <h3 style={{ marginTop: "1.5rem" }}>Valor para o perfil</h3>
                <ul className={styles.planFeatures}>
                  <li>Mais confianca perante empresas e recrutadores.</li>
                  <li>Melhor leitura editorial da qualidade do perfil.</li>
                  <li>
                    Base para destaque e ranking mais forte no banco de
                    talentos.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const activeLabel =
    NAV_MENU.find((item) => item.id === activeTab)?.label || "Dashboard";

  const today = new Date();
  const formattedDate = today.toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <Head>
        <title>Dashboard Candidato | EmpregoSTP</title>
        <meta
          name="description"
          content="Gerencie suas candidaturas e perfil no EmpregoSTP"
        />
      </Head>
      <div className={styles.pageLayout}>
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          unreadMessages={unreadMessages}
          unreadNotifications={unreadNotifications}
          savedJobsCount={savedJobs.length}
          user={user}
          profile={profile}
          planName={activePlan.planName || "Gratuito"}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          onLogout={handleLogout}
        />
        <main className={styles.mainContent}>
          <header className={styles.topBar}>
            <button
              className={styles.mobileMenuButton}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className={styles.topBarLeft}>
              <h1 className={styles.pageTitle}>{activeLabel}</h1>
              <p className={styles.pageDate}>{formattedDate}</p>
            </div>
            <div className={styles.topBarRight}>
              <button type="button" className={styles.iconButton}>
                {icons.notifications}
                {unreadNotifications > 0 && (
                  <span className={styles.notificationDot}>
                    {unreadNotifications}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("profile")}
                className={styles.iconButton}
              >
                {icons.profile}
              </button>
            </div>
          </header>
          <div className={styles.contentArea}>{renderContent()}</div>
        </main>
        {mobileMenuOpen && (
          <div
            className={styles.mobileBackdrop}
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </div>
    </>
  );
};

export default CandidateDashboard;
