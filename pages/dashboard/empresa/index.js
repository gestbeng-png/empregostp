import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { useAuth } from '../../../context/AuthContext';
import {
  FiPlusCircle,
  FiStar,
  FiBell,
  FiBriefcase,
  FiInbox,
  FiCalendar,
  FiEye,
  FiUsers,
  FiSend,
  FiCheckCircle,
  FiEdit2,
  FiTrash2,
  FiClock,
  FiVideo,
  FiCheck,
  FiTrendingUp,
  FiAward,
  FiMail,
  FiDownload,
  FiFilter,
  FiFileText,
  FiX,
  FiLock,
} from 'react-icons/fi';
import DashboardShell from '../../../components/dashboard/DashboardShell';
import AffiliateSection from '../../../components/affiliate/AffiliateSection';
import styles from '../../../styles/EmpresaDashboard.module.css';
import nookies from 'nookies';
import VerificationBadge from '../../../components/VerificationBadge';
import {
  getEmpresaPlanFeatures,
  normalizeEmpresaPlanId,
} from '../../../lib/empresaPlanFeatures';
import { fetchActiveEmpresaPlans } from '../../../lib/empresaPlansCatalog';
import {
  fetchVerifiedCandidates,
  summarizeVerifiedCandidates,
} from '../../../lib/publicCandidates';
import { resolveDashboardTab } from '../../../lib/dashboardNavigation';
import { buildLoginUrl, redirectToLogin } from '../../../lib/loginRedirect';
import { recruitmentNotificationPath } from '../../../lib/recruitmentNotificationNavigation';
import { isRecruitmentWorkspaceEnabled } from '../../../lib/recruitmentAvailability';

const EmpresaApplicationsChart = dynamic(
  () => import('../../../components/charts/EmpresaApplicationsChart'),
  {
    ssr: false,
    loading: () => (
      <div
        className={styles.chartWrapper}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-3)',
        }}
      >
        A carregar gráfico...
      </div>
    ),
  },
);

const EmpresaPlansCatalog = dynamic(
  () => import('../../../components/EmpresaPlansCatalog'),
  {
    ssr: false,
    loading: () => (
      <div className={styles.sectionBlock} style={{ color: 'var(--text-3)' }}>
        A carregar planos...
      </div>
    ),
  },
);

const MENU_ITEMS = [
  { id: 'dashboard', label: 'Visão geral', icon: 'dashboard' },
  { id: 'jobs', label: 'Minhas vagas', icon: 'briefcase' },
  { id: 'applications', label: 'Candidaturas', icon: 'inbox' },
  { id: 'candidates', label: 'Banco de talentos', icon: 'users' },
  { id: 'interviews', label: 'Entrevistas', icon: 'calendar' },
  { id: 'messages', label: 'Mensagens', icon: 'messages' },
  { id: 'analytics', label: 'Análise', icon: 'chart' },
  { id: 'hr-services', label: 'Serviço RH', icon: 'briefcase' },
  { id: 'company-profile', label: 'Perfil empresa', icon: 'building' },
  { id: 'plans', label: 'Planos', icon: 'crown' },
  { id: 'affiliate', label: 'Ser Afiliado', icon: 'star' },
];
const EMPRESA_TAB_IDS = new Set(MENU_ITEMS.map((item) => item.id));

const formatInterviewDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const HR_SERVICE_TYPES = [
  'Recrutamento e seleção',
  'Triagem de candidatos',
  'Avaliação curricular',
  'Entrevistas técnicas',
  'Consultoria RH',
  'Documentação laboral',
  'Outro serviço RH',
];

const HR_STATUS_META = {
  pending: { label: 'Em análise', className: 'badge-pending' },
  approved: { label: 'Aprovado, em andamento', className: 'badge-active' },
  completed: { label: 'Concluído', className: 'badge-success' },
  rejected: { label: 'Não aprovado', className: 'badge-closed' },
};

const emptyHrDocument = () => ({ label: '', url: '' });

const toDateTimeLocalValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60000);
  return localDate.toISOString().slice(0, 16);
};

const DASHBOARD_HIRING_TIPS = [
  {
    title: 'Taxa de resposta alta',
    content:
      'Responda às candidaturas em menos de 48h para melhorar a retenção.',
    category: 'PROCESSO',
  },
  {
    title: 'Descrições detalhadas',
    content:
      'Vagas com descrição completa recebem 2x mais candidatos qualificados.',
    category: 'QUALIDADE',
  },
];

const icons = {
  badge: (
    <svg
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
    >
      <path
        d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 3v18" strokeLinecap="round" />
    </svg>
  ),
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  briefcase: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="7" r="4" />
      <path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
      <circle cx="17" cy="7" r="3" />
      <path d="M21 21v-2a3 3 0 00-2-2.83" />
    </svg>
  ),
  inbox: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
    </svg>
  ),
  messages: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  building: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22V12h6v10" />
      <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01" />
    </svg>
  ),
  crown: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 17l2-11 5 5 3-7 3 7 5-5 2 11z" />
      <path d="M2 17h20" />
    </svg>
  ),
  bell: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  eye: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  trending: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
};

const normalizePlan = (plan) => {
  const normalizedPlanId = normalizeEmpresaPlanId(plan);
  return getEmpresaPlanFeatures(normalizedPlanId).name || 'Básico';
};

const EmptyState = ({ icon, title, message, action }) => (
  <div className={styles.emptyState}>
    <div className={styles.emptyIcon}>{icon || icons.inbox}</div>
    <h3>{title}</h3>
    <p>{message}</p>
    {action && <div className={styles.emptyAction}>{action}</div>}
  </div>
);

export default function EmpresaDashboard({
  profile,
  jobs,
  totalApplications,
  recentApplications,
  stats,
  plans = [],
  publicCandidates = [],
  publicCandidateSummary,
  verifiedCandidateIds = [],
  weeklyApplications = [],
}) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('dashboard');
  const openTab = useCallback(
    (tab) => {
      setActiveTab(tab);
      if (!router.isReady) return;

      const query = { ...router.query };
      if (tab === 'dashboard') delete query.tab;
      else query.tab = tab;
      void router.push({ pathname: router.pathname, query }, undefined, {
        shallow: true,
      });
    },
    [router],
  );
  const normalizedCompanyPlanId = useMemo(
    () =>
      normalizeEmpresaPlanId(
        profile.planTierId || profile.currentPlan || profile.planId,
        profile.planName,
        profile,
      ),
    [profile],
  );
  const [planState, setPlanState] = useState(
    normalizePlan(normalizedCompanyPlanId),
  );
  const hiringTips = DASHBOARD_HIRING_TIPS;
  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [analyticsError, setAnalyticsError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [talentAreaFilter, setTalentAreaFilter] = useState('all');
  const [applicationFilter, setApplicationFilter] = useState('all');
  const [jobFilter, setJobFilter] = useState('all');
  const [applicationsData, setApplicationsData] = useState(recentApplications);
  const [updatingApplicationId, setUpdatingApplicationId] = useState(null);
  const [talentPoolData, setTalentPoolData] = useState([]);
  const [loadingTalentPool, setLoadingTalentPool] = useState(false);
  const [talentPoolError, setTalentPoolError] = useState('');
  const [exportingCsv, setExportingCsv] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState('');
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messagesError, setMessagesError] = useState('');
  const [planLoadingId, setPlanLoadingId] = useState('');
  const [planError, setPlanError] = useState('');
  const [planPaymentInstructions, setPlanPaymentInstructions] = useState(null);
  const [pendingPaymentRequest, setPendingPaymentRequest] = useState(null);
  const [interviewModal, setInterviewModal] = useState({
    open: false,
    application: null,
  });
  const [interviewForm, setInterviewForm] = useState({
    interviewDate: '',
    interviewMode: 'online',
    interviewLocation: '',
    interviewLink: '',
    interviewNotes: '',
  });
  const [interviewSubmitting, setInterviewSubmitting] = useState(false);
  const [interviewError, setInterviewError] = useState('');
  const [hrRequests, setHrRequests] = useState([]);
  const [hrLoading, setHrLoading] = useState(false);
  const [hrSubmitting, setHrSubmitting] = useState(false);
  const [hrFeedback, setHrFeedback] = useState(null);
  const [hrForm, setHrForm] = useState({
    serviceType: HR_SERVICE_TYPES[0],
    title: '',
    description: '',
    documents: [emptyHrDocument()],
  });
  const messagesEndRef = useRef(null);
  const lastOpenedCandidateRef = useRef(null);
  const companyPlanFeatures = useMemo(
    () =>
      getEmpresaPlanFeatures(
        normalizedCompanyPlanId,
        profile.planName,
        profile,
      ),
    [normalizedCompanyPlanId, profile],
  );
  const highlightedJobsCount = useMemo(
    () =>
      jobs.filter(
        (job) =>
          job.destaque === true ||
          job.featured === true ||
          job.isFeatured === true,
      ).length,
    [jobs],
  );
  const unreadMessages = useMemo(
    () =>
      conversations.reduce(
        (sum, conversation) => sum + (conversation.unreadCount || 0),
        0,
      ),
    [conversations],
  );
  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );
  const verifiedCandidateIdSet = useMemo(
    () =>
      new Set(Array.isArray(verifiedCandidateIds) ? verifiedCandidateIds : []),
    [verifiedCandidateIds],
  );

  const fetchPendingPaymentRequest = useCallback(async () => {
    if (!user) return;
    try {
      const { getAuth } = await import('firebase/auth');
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const response = await fetch('/api/subscription-requests/current', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return;
      setPendingPaymentRequest(data.request || null);
      setPlanPaymentInstructions(data.request?.paymentInstructions || null);
    } catch (error) {
      // best effort
    }
  }, [user]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setNotificationsLoading(true);
    setNotificationsError('');
    try {
      const { getAuth } = await import('firebase/auth');
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Sessão expirada');

      const response = await fetch('/api/notifications', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || 'Erro ao carregar notificações');
      setNotifications(
        Array.isArray(data.notifications) ? data.notifications : [],
      );
    } catch (error) {
      setNotificationsError(error?.message || 'Erro ao carregar notificações');
    } finally {
      setNotificationsLoading(false);
    }
  }, [user]);

  const markNotificationRead = useCallback(
    async (notificationId) => {
      if (!notificationId || !user) return;
      try {
        const { getAuth } = await import('firebase/auth');
        const auth = getAuth();
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;

        const response = await fetch('/api/notifications', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ notificationId }),
        });
        if (response.ok) {
          setNotifications((prev) =>
            prev.map((n) =>
              n.id === notificationId ? { ...n, read: true } : n,
            ),
          );
        }
      } catch (error) {
        // best effort
      }
    },
    [user],
  );

  const markAllNotificationsRead = useCallback(async () => {
    if (!user) return;
    try {
      const { getAuth } = await import('firebase/auth');
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ markAll: true }),
      });
      if (response.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      }
    } catch (error) {
      // best effort
    }
  }, [user]);

  const handleNotificationClick = useCallback(
    async (notif) => {
      if (!notif) return;
      if (!notif.read && notif.id) {
        await markNotificationRead(notif.id);
      }
      const recruitmentPath = recruitmentNotificationPath(notif);
      if (recruitmentPath) {
        setNotificationsOpen(false);
        await router.push(recruitmentPath);
        return;
      }
      // Bring the company back to applications list for interview-related notifications.
      if (notif.type === 'interview_response' || notif.type === 'application') {
        openTab('applications');
      }
      if (String(notif.type || '').startsWith('HR_SERVICE_')) {
        openTab('hr-services');
      }
      setNotificationsOpen(false);
    },
    [markNotificationRead, openTab, router],
  );

  useEffect(() => {
    fetchPendingPaymentRequest();
  }, [fetchPendingPaymentRequest]);

  useEffect(() => {
    if (!router.isReady) return;
    const requestedTab = resolveDashboardTab(router.query.tab, EMPRESA_TAB_IDS);
    setActiveTab((currentTab) =>
      currentTab === requestedTab ? currentTab : requestedTab,
    );
  }, [router.isReady, router.query.tab]);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    const intervalId = setInterval(() => {
      if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'hidden'
      )
        return;
      fetchNotifications();
    }, 30000);
    return () => clearInterval(intervalId);
  }, [user, fetchNotifications]);

  const handleApplicationStatusUpdate = (applicationId, updates) => {
    setApplicationsData((prev) =>
      prev.map((app) =>
        app.id === applicationId
          ? {
              ...app,
              ...(typeof updates === 'string' ? { status: updates } : updates),
            }
          : app,
      ),
    );
  };

  // Aceitar/rejeitar/analisar candidaturas diretamente da lista. A entrevista
  // usa o modal dedicado (openInterviewScheduler) e o backend valida o plano.
  const handleApplicationStatusChange = async (applicationId, newStatus) => {
    if (updatingApplicationId) return;
    setUpdatingApplicationId(applicationId);
    try {
      const { getAuth } = await import('firebase/auth');
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        alert('A sessão expirou. Inicie sessão novamente.');
        return;
      }
      const response = await fetch(
        `/api/applications/${applicationId}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: newStatus }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        handleApplicationStatusUpdate(
          applicationId,
          data.application || { status: newStatus },
        );
      } else {
        alert(data.error || 'Não foi possível atualizar a candidatura.');
      }
    } catch (error) {
      console.error('Erro ao atualizar candidatura:', error);
      alert('Erro ao atualizar candidatura. Tente novamente.');
    } finally {
      setUpdatingApplicationId(null);
    }
  };

  const openInterviewScheduler = (application) => {
    const currentInterview = application?.interviewDetails || {};
    setInterviewForm({
      interviewDate: toDateTimeLocalValue(currentInterview.scheduledAt),
      interviewMode: currentInterview.mode || 'online',
      interviewLocation: currentInterview.location || '',
      interviewLink: currentInterview.link || '',
      interviewNotes: currentInterview.notes || '',
    });
    setInterviewError('');
    setInterviewModal({ open: true, application });
  };

  const closeInterviewScheduler = () => {
    if (interviewSubmitting) return;
    setInterviewModal({ open: false, application: null });
    setInterviewError('');
  };

  const handleInterviewFieldChange = (field, value) => {
    setInterviewForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleScheduleInterview = async () => {
    if (!interviewModal.application || interviewSubmitting) return;

    setInterviewSubmitting(true);
    setInterviewError('');

    try {
      const { getAuth } = await import('firebase/auth');
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();

      if (!token) {
        setInterviewError('Sessão expirada. Faça login novamente.');
        return;
      }

      const response = await fetch(
        `/api/applications/${interviewModal.application.id}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status: 'interview',
            interviewDate: interviewForm.interviewDate,
            interviewMode: interviewForm.interviewMode,
            interviewLocation: interviewForm.interviewLocation,
            interviewLink: interviewForm.interviewLink,
            interviewNotes: interviewForm.interviewNotes,
          }),
        },
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setInterviewError(
          data.upgradeMessage ||
            data.error ||
            'Não foi possível agendar a entrevista.',
        );
        return;
      }

      handleApplicationStatusUpdate(
        interviewModal.application.id,
        data.application || {
          status: 'interview',
          interviewDetails: {
            scheduledAt: interviewForm.interviewDate,
            mode: interviewForm.interviewMode,
            location: interviewForm.interviewLocation,
            link: interviewForm.interviewLink,
            notes: interviewForm.interviewNotes,
          },
        },
      );
      setInterviewModal({ open: false, application: null });
      setInterviewError('');
    } catch (error) {
      console.error('Erro ao agendar entrevista:', error);
      setInterviewError('Não foi possível agendar a entrevista.');
    } finally {
      setInterviewSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      const result = await logout();
      if (result.success) {
        router.push(buildLoginUrl(router.asPath));
      } else {
        alert('Erro ao fazer logout. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      alert('Erro ao fazer logout.');
    }
  };

  const fetchConversations = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoadingConversations(true);
      setMessagesError('');
    }
    try {
      const { getAuth } = await import('firebase/auth');
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const response = await fetch('/api/messages', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessagesError(
          data.error || 'Não foi possível carregar as conversas.',
        );
        return;
      }

      setConversations(data.conversations || []);
    } catch (error) {
      console.error('Erro ao buscar conversas:', error);
      if (!silent) {
        setMessagesError('Não foi possível carregar as conversas.');
      }
    } finally {
      if (!silent) {
        setLoadingConversations(false);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleRealtimeEvent = async (event) => {
      fetchNotifications();
      const payloadType = event?.detail?.payload?.data?.type || '';
      if (payloadType === 'message' || payloadType === 'direct_message') {
        fetchConversations({ silent: true });
      }
    };

    window.addEventListener('app-notification-received', handleRealtimeEvent);
    return () =>
      window.removeEventListener(
        'app-notification-received',
        handleRealtimeEvent,
      );
  }, [fetchNotifications, fetchConversations]);

  const createOrOpenConversation = useCallback(
    async (participantId) => {
      if (!participantId) return null;
      try {
        const { getAuth } = await import('firebase/auth');
        const auth = getAuth();
        const token = await auth.currentUser?.getIdToken();
        if (!token) return null;

        const response = await fetch('/api/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ participantId }),
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          alert(
            data.upgradeMessage ||
              data.error ||
              'Não foi possível abrir a conversa.',
          );
          if (data.upgradeUrl) {
            router.push(data.upgradeUrl);
          }
          return null;
        }

        if (data.conversationId) {
          setSelectedConversation(data.conversationId);
          return data.conversationId;
        }
      } catch (error) {
        console.error('Erro ao abrir conversa:', error);
        alert('Não foi possível abrir a conversa.');
      }
      return null;
    },
    [router],
  );

  const fetchHrRequests = useCallback(
    async ({ silent = false } = {}) => {
      if (!user) return;
      if (!silent) {
        setHrLoading(true);
        setHrFeedback(null);
      }
      try {
        const { getAuth } = await import('firebase/auth');
        const auth = getAuth();
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;

        const response = await fetch('/api/hr-services', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            data.error || 'Não foi possível carregar os serviços RH.',
          );
        }
        setHrRequests(Array.isArray(data.requests) ? data.requests : []);
      } catch (error) {
        console.error('Erro ao carregar serviços RH:', error);
        if (!silent) {
          setHrFeedback({
            type: 'error',
            text: error?.message || 'Não foi possível carregar os serviços RH.',
          });
        }
      } finally {
        if (!silent) setHrLoading(false);
      }
    },
    [user],
  );

  const updateHrForm = (field, value) => {
    setHrForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateHrDocument = (index, field, value) => {
    setHrForm((prev) => ({
      ...prev,
      documents: prev.documents.map((doc, i) =>
        i === index ? { ...doc, [field]: value } : doc,
      ),
    }));
  };

  const addHrDocument = () => {
    setHrForm((prev) => ({
      ...prev,
      documents:
        prev.documents.length >= 10
          ? prev.documents
          : [...prev.documents, emptyHrDocument()],
    }));
  };

  const removeHrDocument = (index) => {
    setHrForm((prev) => {
      const nextDocuments = prev.documents.filter((_, i) => i !== index);
      return {
        ...prev,
        documents: nextDocuments.length ? nextDocuments : [emptyHrDocument()],
      };
    });
  };

  const submitHrRequest = async (event) => {
    event.preventDefault();
    if (!user || hrSubmitting) return;

    setHrSubmitting(true);
    setHrFeedback(null);
    try {
      const { getAuth } = await import('firebase/auth');
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Sessão expirada. Faça login novamente.');

      const documents = hrForm.documents
        .map((doc) => ({
          label: (doc.label || '').trim(),
          url: (doc.url || '').trim(),
        }))
        .filter((doc) => doc.url);

      const response = await fetch('/api/hr-services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          serviceType: hrForm.serviceType,
          title: hrForm.title,
          description: hrForm.description,
          documents,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível enviar o pedido.');
      }

      setHrForm({
        serviceType: HR_SERVICE_TYPES[0],
        title: '',
        description: '',
        documents: [emptyHrDocument()],
      });
      setHrFeedback({
        type: 'success',
        text:
          data.message || 'Pedido enviado para análise da equipa EmpregoSTP.',
      });
      await fetchHrRequests({ silent: true });
    } catch (error) {
      setHrFeedback({
        type: 'error',
        text: error?.message || 'Não foi possível enviar o pedido.',
      });
    } finally {
      setHrSubmitting(false);
    }
  };

  const activeJobs = useMemo(
    () => jobs.filter((job) => job.status === 'active'),
    [jobs],
  );

  useEffect(() => {
    setPlanState(normalizePlan(normalizedCompanyPlanId));
  }, [normalizedCompanyPlanId]);

  useEffect(() => {
    if (activeTab !== 'messages') return;
    fetchConversations();
  }, [activeTab, fetchConversations]);

  useEffect(() => {
    if (activeTab !== 'hr-services') return;
    fetchHrRequests();
  }, [activeTab, fetchHrRequests]);

  useEffect(() => {
    if (activeTab !== 'messages') return undefined;

    const intervalId = setInterval(() => {
      if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'hidden'
      )
        return;
      fetchConversations({ silent: true });
    }, 12000);

    return () => clearInterval(intervalId);
  }, [activeTab, fetchConversations]);

  useEffect(() => {
    if (activeTab !== 'messages' || !router.isReady) return;
    const candidateId =
      typeof router.query.candidate === 'string' ? router.query.candidate : '';
    if (!candidateId || lastOpenedCandidateRef.current === candidateId) return;

    lastOpenedCandidateRef.current = candidateId;

    const openFromQuery = async () => {
      const conversationId = await createOrOpenConversation(candidateId);
      await fetchConversations();
      if (conversationId) {
        setSelectedConversation(conversationId);
      }
      const nextQuery = { ...router.query };
      delete nextQuery.candidate;
      lastOpenedCandidateRef.current = null;
      router.replace(
        { pathname: router.pathname, query: nextQuery },
        undefined,
        { shallow: true },
      );
    };

    openFromQuery();
  }, [activeTab, router, createOrOpenConversation, fetchConversations]);

  useEffect(() => {
    if (activeTab !== 'messages') return undefined;
    if (!selectedConversation) {
      setMessages([]);
      return;
    }

    const fetchMessages = async ({ silent = false } = {}) => {
      if (!silent) {
        setLoadingMessages(true);
        setMessagesError('');
      }
      try {
        const { getAuth } = await import('firebase/auth');
        const auth = getAuth();
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;

        const response = await fetch(`/api/messages/${selectedConversation}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          if (!silent) {
            setMessagesError(
              data.error || 'Não foi possível carregar as mensagens.',
            );
          }
          return;
        }

        setMessages(data.messages || []);
        setConversations((prev) =>
          prev.map((conversation) =>
            conversation.id === selectedConversation
              ? { ...conversation, unreadCount: 0 }
              : conversation,
          ),
        );
      } catch (error) {
        console.error('Erro ao buscar mensagens:', error);
        if (!silent) {
          setMessagesError('Não foi possível carregar as mensagens.');
        }
      } finally {
        if (!silent) {
          setLoadingMessages(false);
        }
      }
    };

    fetchMessages();

    const intervalId = setInterval(() => {
      if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'hidden'
      )
        return;
      fetchMessages({ silent: true });
    }, 5000);

    return () => clearInterval(intervalId);
  }, [activeTab, selectedConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (
        activeTab !== 'analytics' ||
        !user ||
        !companyPlanFeatures.canAccessAnalytics
      )
        return;
      setLoadingAnalytics(true);
      setAnalyticsError('');
      try {
        const { getAuth } = await import('firebase/auth');
        const auth = getAuth();
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;
        const response = await fetch('/api/analytics', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok) {
          setAnalytics(null);
          setAnalyticsError(
            data.error || 'Não foi possível carregar analytics',
          );
          return;
        }
        setAnalytics(data);
      } catch (error) {
        console.error('Erro ao buscar analytics:', error);
        setAnalyticsError('Não foi possível carregar analytics');
      } finally {
        setLoadingAnalytics(false);
      }
    };
    fetchAnalytics();
  }, [activeTab, user, companyPlanFeatures.canAccessAnalytics]);

  useEffect(() => {
    const fetchTalentPool = async () => {
      if (
        activeTab !== 'candidates' ||
        !user ||
        !companyPlanFeatures.accessTalentPool
      )
        return;
      setLoadingTalentPool(true);
      setTalentPoolError('');
      try {
        const { getAuth } = await import('firebase/auth');
        const auth = getAuth();
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;

        const response = await fetch('/api/talent-pool?limit=30', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok) {
          setTalentPoolData([]);
          setTalentPoolError(
            data.error || 'Não foi possível carregar o banco de talentos',
          );
          return;
        }

        const mappedTalents = (data.candidates || []).map((candidate) => ({
          id: candidate.id,
          name: candidate.fullName || 'Candidato',
          headline: candidate.headline || 'Perfil disponível',
          skills: String(candidate.skillsHard || '')
            .split(',')
            .map((skill) => skill.trim())
            .filter(Boolean)
            .slice(0, 4),
          experience: candidate.availableForWork
            ? 'Disponível para trabalho'
            : 'Perfil ativo',
          location: candidate.location || 'São Tomé e Príncipe',
          avatar: candidate.photoUrl || '',
          profileUrl: `/dashboard/empresa/candidato/${candidate.id}`,
          verified: Boolean(candidate.verified),
          highlighted: Boolean(candidate.highlighted),
          profileComplete: Boolean(candidate.profileComplete),
          completionScore: Number(candidate.completionScore) || 0,
        }));

        setTalentPoolData(mappedTalents);
      } catch (error) {
        console.error('Erro ao buscar banco de talentos:', error);
        setTalentPoolError('Não foi possível carregar o banco de talentos');
      } finally {
        setLoadingTalentPool(false);
      }
    };

    fetchTalentPool();
  }, [activeTab, user, companyPlanFeatures.accessTalentPool]);

  const chartData = useMemo(() => {
    if (weeklyApplications.length === 6) {
      return weeklyApplications;
    }

    const now = new Date();
    return Array.from({ length: 6 }, (_, index) => {
      const weeksAgo = 5 - index;
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - weeksAgo * 7 - start.getDay());
      const end = new Date(start);
      end.setDate(end.getDate() + 7);

      const value = applicationsData.filter((application) => {
        const rawDate =
          application.appliedAt ||
          application.appliedDate ||
          application.createdAt;
        if (!rawDate) return false;
        const appliedAt = new Date(rawDate);
        return (
          !Number.isNaN(appliedAt.getTime()) &&
          appliedAt >= start &&
          appliedAt < end
        );
      }).length;

      return {
        name: `S${index + 1}`,
        value,
      };
    });
  }, [applicationsData, weeklyApplications]);

  const fallbackTalentPool = useMemo(() => {
    const byCandidate = new Map();
    applicationsData.forEach((application) => {
      if (!application.candidateId || byCandidate.has(application.candidateId))
        return;
      byCandidate.set(application.candidateId, {
        id: application.candidateId,
        name: application.candidateName || 'Candidato',
        headline: application.jobTitle
          ? `Interessado em ${application.jobTitle}`
          : 'Perfil disponível',
        skills: [],
        experience:
          application.status === 'interview' ? 'Em entrevista' : 'Perfil ativo',
        location: application.jobLocation || 'São Tomé e Príncipe',
        avatar: '',
        profileUrl: `/dashboard/empresa/candidato/${application.candidateId}`,
        verified: verifiedCandidateIdSet.has(application.candidateId),
        highlighted: false,
        profileComplete: false,
        completionScore: 0,
      });
    });
    return Array.from(byCandidate.values());
  }, [applicationsData, verifiedCandidateIdSet]);

  const talentPool = useMemo(() => {
    if (companyPlanFeatures.accessTalentPool) {
      return talentPoolData;
    }
    return fallbackTalentPool;
  }, [
    companyPlanFeatures.accessTalentPool,
    talentPoolData,
    fallbackTalentPool,
  ]);

  const talentAreaOptions = useMemo(() => {
    const areas = new Set(
      talentPool
        .map((talent) =>
          String(
            talent.area ||
              talent.category ||
              talent.profession ||
              talent.headline ||
              '',
          ).trim(),
        )
        .filter(Boolean),
    );

    return Array.from(areas).sort((left, right) =>
      left.localeCompare(right, 'pt-PT'),
    );
  }, [talentPool]);

  const filteredTalents = useMemo(
    () =>
      talentPool.filter((talent) => {
        const query = searchQuery.trim().toLocaleLowerCase('pt-PT');
        const area = String(
          talent.area ||
            talent.category ||
            talent.profession ||
            talent.headline ||
            '',
        ).trim();
        const searchableContent = [
          talent.name,
          talent.headline,
          talent.location,
          ...(talent.skills || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase('pt-PT');

        const matchesQuery = !query || searchableContent.includes(query);
        const matchesArea =
          talentAreaFilter === 'all' || area === talentAreaFilter;

        return matchesQuery && matchesArea;
      }),
    [searchQuery, talentAreaFilter, talentPool],
  );

  const filteredApplications = useMemo(() => {
    return applicationsData
      .filter((app) => {
        if (applicationFilter === 'all') return true;
        if (applicationFilter === 'pending')
          return !app.status || app.status === 'pending';
        return app.status === applicationFilter;
      })
      .sort((a, b) => {
        // F2.1/K1: nenhuma candidatura passa à frente por plano pago.
        const dateA = a.appliedAt
          ? new Date(a.appliedAt).getTime()
          : a.createdAt
            ? new Date(a.createdAt).getTime()
            : 0;
        const dateB = b.appliedAt
          ? new Date(b.appliedAt).getTime()
          : b.createdAt
            ? new Date(b.createdAt).getTime()
            : 0;
        return dateB - dateA;
      });
  }, [applicationsData, applicationFilter]);

  const filteredJobs = useMemo(() => {
    if (jobFilter === 'all') return jobs;
    return jobs.filter((job) => job.status === jobFilter);
  }, [jobs, jobFilter]);

  const handleSubscribePlan = async (planId) => {
    try {
      setPlanLoadingId(planId);
      setPlanError('');
      setPlanPaymentInstructions(null);

      const { getAuth } = await import('firebase/auth');
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        router.push(buildLoginUrl(router.asPath));
        return { ok: false, status: 'unauthenticated' };
      }

      const response = await fetch('/api/subscribe-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ planId }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPlanError(
          data.message || data.error || 'Não foi possível processar o plano.',
        );
        return { ok: false, status: 'error' };
      }

      if (data.status === 'approved') {
        router.replace(router.asPath);
        return { ok: true, status: 'approved' };
      }

      if (data.status === 'awaiting_payment') {
        setPlanPaymentInstructions(data.paymentInstructions || null);
        setPendingPaymentRequest({
          id: data.requestId,
          planId,
          planName: plans.find((plan) => plan.id === planId)?.name || planId,
          price: plans.find((plan) => plan.id === planId)?.price || 0,
          status: 'pending',
          paymentInstructions: data.paymentInstructions || null,
        });
        return { ok: true, status: 'awaiting_payment' };
      }
      return { ok: true, status: data.status || 'pending' };
    } catch (error) {
      console.error('Erro ao assinar plano:', error);
      setPlanError('Não foi possível processar o plano.');
      return { ok: false, status: 'error' };
    } finally {
      setPlanLoadingId('');
    }
  };

  const handleExportApplications = async () => {
    if (exportingCsv) return;
    setExportingCsv(true);
    try {
      const { getAuth } = await import('firebase/auth');
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        alert('Sessão expirada. Faça login novamente.');
        return;
      }

      const response = await fetch('/api/export/applications', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        alert(
          errorData.upgradeMessage ||
            errorData.error ||
            'Não foi possível exportar as candidaturas.',
        );
        return;
      }

      const blob = await response.blob();
      const contentDisposition =
        response.headers.get('content-disposition') || '';
      const match = contentDisposition.match(/filename="(.+)"/);
      const filename =
        match?.[1] ||
        `candidaturas_${new Date().toISOString().slice(0, 10)}.csv`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao exportar candidaturas:', error);
      alert('Erro ao exportar candidaturas.');
    } finally {
      setExportingCsv(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedConversation || sendingMessage) return;

    const text = messageInput.trim();
    setMessageInput('');
    setSendingMessage(true);

    try {
      const { getAuth } = await import('firebase/auth');
      const auth = getAuth();
      const currentUser = auth.currentUser;
      const token = await currentUser?.getIdToken();
      if (!token || !currentUser) return;

      const response = await fetch(`/api/messages/${selectedConversation}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessageInput(text);
        alert(
          data.upgradeMessage ||
            data.error ||
            'Não foi possível enviar a mensagem.',
        );
        if (data.upgradeUrl) {
          router.push(data.upgradeUrl);
        }
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: data.messageId || `temp-${Date.now()}`,
          senderId: currentUser.uid,
          text,
          createdAt: new Date().toISOString(),
        },
      ]);
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === selectedConversation
            ? {
                ...conversation,
                lastMessage: text.substring(0, 100),
                lastMessageAt: new Date().toISOString(),
              }
            : conversation,
        ),
      );
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      setMessageInput(text);
      alert('Não foi possível enviar a mensagem.');
    } finally {
      setSendingMessage(false);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': {
        const companyName =
          profile?.companyName || profile?.name || user?.name || 'Empresa';
        const pendingCount = applicationsData.filter(
          (a) => a.status === 'pending',
        ).length;
        const interviewsCount = applicationsData.filter(
          (a) =>
            a.status === 'interview' || a.interviewDate || a.interviewStatus,
        ).length;
        const totalViews = jobs.reduce((sum, job) => sum + (job.views || 0), 0);
        const recentApps = [...applicationsData]
          .sort(
            (a, b) =>
              new Date(b.createdAt || 0).getTime() -
              new Date(a.createdAt || 0).getTime(),
          )
          .slice(0, 5);
        const topJobs = (activeJobs.length ? activeJobs : jobs).slice(0, 3);
        const appStatusBadge = (status) => {
          switch (status) {
            case 'approved':
            case 'accepted':
              return { label: 'Aprovado', cls: 'badge-success' };
            case 'interview':
              return { label: 'Entrevista', cls: 'badge-pending' };
            case 'rejected':
              return { label: 'Rejeitado', cls: 'badge-closed' };
            case 'withdrawn':
              return { label: 'Retirada', cls: 'badge-closed' };
            default:
              return { label: 'Pendente', cls: 'badge-active' };
          }
        };
        const initialsOf = (name) =>
          (name || '?')
            .split(' ')
            .map((w) => w[0])
            .filter(Boolean)
            .slice(0, 2)
            .join('')
            .toUpperCase();

        return (
          <>
            <div className="header-card">
              <div>
                <div className="header-eyebrow">Empresa · Dashboard</div>
                <h1 className="header-title">
                  Olá, {companyName}! <span aria-hidden="true">👋</span>
                </h1>
                <p className="header-sub">
                  Tens{' '}
                  <strong>
                    {activeJobs.length} vaga{activeJobs.length !== 1 ? 's' : ''}{' '}
                    activa
                    {activeJobs.length !== 1 ? 's' : ''}
                  </strong>{' '}
                  e{' '}
                  <strong>
                    {totalApplications} candidatura
                    {totalApplications !== 1 ? 's' : ''}
                  </strong>{' '}
                  para rever.
                </p>
              </div>
              <div className="header-actions">
                <Link
                  href="/dashboard/empresa/vaga/criar-vaga"
                  className="btn btn-lime"
                >
                  <FiPlusCircle /> Nova vaga
                </Link>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => openTab('candidates')}
                >
                  <FiUsers /> Ver talentos
                </button>
              </div>
            </div>

            <div className="stats-grid">
              <div
                className="stat-card"
                style={{
                  '--accent': 'rgba(32,87,215,0.85)',
                  '--accent-shadow': 'rgba(32,87,215,0.28)',
                }}
              >
                <div
                  className="stat-icon"
                  style={{
                    background: 'linear-gradient(135deg,#2057d7,#4f8ef7)',
                  }}
                >
                  <FiBriefcase />
                </div>
                <div className="stat-value">{activeJobs.length}</div>
                <div className="stat-label">Vagas activas</div>
                <div className="stat-delta up">↑ {jobs.length} no total</div>
              </div>
              <div
                className="stat-card"
                style={{
                  '--accent': 'rgba(186,230,39,0.9)',
                  '--accent-shadow': 'rgba(186,230,39,0.28)',
                }}
              >
                <div
                  className="stat-icon"
                  style={{
                    background: 'linear-gradient(135deg,#d9ff2f,#bae619)',
                    color: '#162a55',
                  }}
                >
                  <FiInbox />
                </div>
                <div className="stat-value">{totalApplications}</div>
                <div className="stat-label">Candidaturas recebidas</div>
                <div className="stat-delta warn">↑ {pendingCount} novas</div>
              </div>
              <div
                className="stat-card"
                style={{
                  '--accent': 'rgba(95,184,245,0.9)',
                  '--accent-shadow': 'rgba(95,184,245,0.28)',
                }}
              >
                <div
                  className="stat-icon"
                  style={{
                    background: 'linear-gradient(135deg,#5fb8f5,#7dceff)',
                  }}
                >
                  <FiCalendar />
                </div>
                <div className="stat-value">{interviewsCount}</div>
                <div className="stat-label">Entrevistas agendadas</div>
                <div className="stat-delta up">Esta semana</div>
              </div>
              <div
                className="stat-card"
                style={{
                  '--accent': 'rgba(61,187,122,0.9)',
                  '--accent-shadow': 'rgba(61,187,122,0.28)',
                }}
              >
                <div
                  className="stat-icon"
                  style={{
                    background: 'linear-gradient(135deg,#3dbb7a,#22c55e)',
                  }}
                >
                  <FiEye />
                </div>
                <div className="stat-value">{totalViews}</div>
                <div className="stat-label">Vistas às vagas</div>
                <div className="stat-delta up">Esta semana</div>
              </div>
            </div>

            <div className="grid-2">
              <div className="panel">
                <div className="panel-title">
                  Candidaturas recentes
                  <span className="panel-badge">{totalApplications}</span>
                </div>
                <div className="item-list">
                  {recentApps.length === 0 ? (
                    <div className="dash-muted" style={{ padding: '12px 0' }}>
                      Ainda sem candidaturas.
                    </div>
                  ) : (
                    recentApps.map((app, i) => {
                      const badge = appStatusBadge(app.status);
                      return (
                        <div key={app.id || i} className="list-item">
                          <div className="list-item-icon">
                            {initialsOf(app.candidateName)}
                          </div>
                          <div className="list-item-body">
                            <div className="list-item-title">
                              {app.candidateName || 'Candidato'}
                            </div>
                            <div className="list-item-meta">
                              {app.jobTitle || 'Vaga'}
                            </div>
                          </div>
                          <span className={`badge ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ width: '100%', marginTop: 12 }}
                  onClick={() => openTab('applications')}
                >
                  Ver todas as candidaturas
                </button>
              </div>

              <div className="panel">
                <div className="panel-title">
                  Candidaturas por semana
                  <span className="panel-badge">6 semanas</span>
                </div>
                <div style={{ minHeight: 240 }}>
                  <EmpresaApplicationsChart data={chartData} />
                </div>
              </div>
            </div>

            <div className="grid-2">
              <div className="panel">
                <div className="panel-title">
                  Vagas activas
                  <span className="panel-badge">{activeJobs.length}</span>
                </div>
                <div className="item-list">
                  {topJobs.length === 0 ? (
                    <div className="dash-muted" style={{ padding: '12px 0' }}>
                      Sem vagas publicadas.
                    </div>
                  ) : (
                    topJobs.map((job, i) => {
                      const featured = job.featured || job.destaque;
                      return (
                        <Link
                          key={job.id || i}
                          href={
                            job.id
                              ? `/dashboard/empresa/vaga/${encodeURIComponent(job.id)}`
                              : '/dashboard/empresa?tab=jobs'
                          }
                          className="list-item"
                          style={{ display: 'block', textDecoration: 'none' }}
                        >
                          <div className="dash-flex-between">
                            <div className="list-item-title">
                              {job.titulo || 'Vaga'}
                            </div>
                            <span
                              className={`badge ${featured ? 'badge-empresa' : 'badge-active'}`}
                            >
                              {featured ? 'DESTAQUE' : 'ACTIVA'}
                            </span>
                          </div>
                          <div
                            className="list-item-meta"
                            style={{ marginTop: 8, display: 'flex', gap: 16 }}
                          >
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                              }}
                            >
                              <FiSend /> {job.applications || 0} candidaturas
                            </span>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                              }}
                            >
                              <FiEye /> {job.views || 0} vistas
                            </span>
                          </div>
                        </Link>
                      );
                    })
                  )}
                </div>
                <Link
                  href="/dashboard/empresa/vaga/criar-vaga"
                  className="btn btn-lime"
                  style={{ width: '100%', marginTop: 12 }}
                >
                  <FiPlusCircle /> Publicar nova vaga
                </Link>
              </div>
              <div className="panel">
                <div className="panel-title">
                  Insights de recrutamento
                  <span className="panel-badge">IA</span>
                </div>
                {hiringTips.map((tip) => (
                  <div key={tip.title} className="advisor-item">
                    <div className="advisor-cat">{tip.category}</div>
                    <div className="advisor-title">{tip.title}</div>
                    <div className="advisor-text">{tip.content}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        );
      }
      case 'jobs': {
        const jobsViews = jobs.reduce((sum, job) => sum + (job.views || 0), 0);
        const deleteJob = async (jobId) => {
          if (
            !window.confirm(
              'Eliminar esta vaga? Esta ação não pode ser revertida.',
            )
          )
            return;
          try {
            const { getAuth } = await import('firebase/auth');
            const token = await getAuth().currentUser?.getIdToken();
            const res = await fetch(`/api/jobs/${jobId}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              router.reload();
            } else {
              const data = await res.json().catch(() => ({}));
              alert(data.error || 'Erro ao eliminar vaga');
            }
          } catch (error) {
            alert('Erro ao eliminar vaga');
          }
        };

        return (
          <>
            <div className="header-card">
              <div>
                <div className="header-eyebrow">Empresa · Vagas</div>
                <h1 className="header-title">Minhas vagas</h1>
                <p className="header-sub">
                  {activeJobs.length} vaga{activeJobs.length !== 1 ? 's' : ''}{' '}
                  ativa
                  {activeJobs.length !== 1 ? 's' : ''} publicada
                  {activeJobs.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="header-actions">
                <Link
                  href="/dashboard/empresa/vaga/criar-vaga"
                  className="btn btn-lime"
                >
                  <FiPlusCircle /> Nova vaga
                </Link>
              </div>
            </div>

            <div className="stats-grid">
              <div
                className="stat-card"
                style={{
                  '--accent': 'rgba(61,187,122,0.9)',
                  '--accent-shadow': 'rgba(61,187,122,0.28)',
                }}
              >
                <div
                  className="stat-icon"
                  style={{
                    background: 'linear-gradient(135deg,#3dbb7a,#22c55e)',
                  }}
                >
                  <FiCheckCircle />
                </div>
                <div className="stat-value">{activeJobs.length}</div>
                <div className="stat-label">Ativas</div>
              </div>
              <div
                className="stat-card"
                style={{
                  '--accent': 'rgba(32,87,215,0.85)',
                  '--accent-shadow': 'rgba(32,87,215,0.28)',
                }}
              >
                <div
                  className="stat-icon"
                  style={{
                    background: 'linear-gradient(135deg,#2057d7,#4f8ef7)',
                  }}
                >
                  <FiInbox />
                </div>
                <div className="stat-value">{totalApplications}</div>
                <div className="stat-label">Candidaturas</div>
              </div>
              <div
                className="stat-card"
                style={{
                  '--accent': 'rgba(95,184,245,0.9)',
                  '--accent-shadow': 'rgba(95,184,245,0.28)',
                }}
              >
                <div
                  className="stat-icon"
                  style={{
                    background: 'linear-gradient(135deg,#5fb8f5,#7dceff)',
                  }}
                >
                  <FiEye />
                </div>
                <div className="stat-value">{jobsViews}</div>
                <div className="stat-label">Vistas totais</div>
              </div>
              <div
                className="stat-card"
                style={{
                  '--accent': 'rgba(186,230,39,0.9)',
                  '--accent-shadow': 'rgba(186,230,39,0.28)',
                }}
              >
                <div
                  className="stat-icon"
                  style={{
                    background: 'linear-gradient(135deg,#d9ff2f,#bae619)',
                    color: '#162a55',
                  }}
                >
                  <FiStar />
                </div>
                <div className="stat-value">{highlightedJobsCount}</div>
                <div className="stat-label">Destaque</div>
              </div>
            </div>

            <div className="tabs">
              <button
                type="button"
                className={`tab${jobFilter === 'all' ? ' active' : ''}`}
                onClick={() => setJobFilter('all')}
              >
                Todas
              </button>
              <button
                type="button"
                className={`tab${jobFilter === 'active' ? ' active' : ''}`}
                onClick={() => setJobFilter('active')}
              >
                Ativas
              </button>
              <button
                type="button"
                className={`tab${jobFilter === 'closed' ? ' active' : ''}`}
                onClick={() => setJobFilter('closed')}
              >
                Fechadas
              </button>
            </div>

            {filteredJobs.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <p>
                  {jobs.length === 0
                    ? 'Ainda não publicou nenhuma vaga.'
                    : 'Nenhuma vaga corresponde ao filtro.'}
                </p>
                {jobs.length === 0 && (
                  <div style={{ marginTop: 16 }}>
                    <Link
                      href="/dashboard/empresa/vaga/criar-vaga"
                      className="btn btn-primary"
                    >
                      <FiPlusCircle /> Criar primeira vaga
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="table-shell">
                <div
                  className="table-scroll"
                  role="region"
                  aria-label="Vagas publicadas pela empresa"
                  tabIndex={0}
                >
                  <table>
                    <thead>
                      <tr>
                        <th>Vaga</th>
                        <th>Categoria</th>
                        <th>Candidaturas</th>
                        <th>Vistas</th>
                        <th>Estado</th>
                        <th className="td-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredJobs.map((job) => {
                        const isActive = job.status === 'active';
                        const featured = job.featured || job.destaque;
                        return (
                          <tr key={job.id}>
                            <td className="td-strong">
                              <div>{job.titulo || 'Vaga'}</div>
                              {featured && (
                                <div
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    marginTop: 4,
                                    fontSize: '0.72rem',
                                    fontWeight: 800,
                                    color: 'var(--dash-company-text, #7a9000)',
                                  }}
                                >
                                  <FiStar
                                    style={{ color: 'var(--lime, #bae619)' }}
                                  />{' '}
                                  Destaque
                                </div>
                              )}
                            </td>
                            <td className="td-muted">{job.categoria || '—'}</td>
                            <td className="td-strong">
                              {job.applicationCount || 0}
                            </td>
                            <td className="td-muted">{job.views || 0}</td>
                            <td>
                              <span
                                className={`badge ${isActive ? 'badge-active' : 'badge-closed'}`}
                              >
                                <span className="badge-dot" />
                                {isActive ? 'Ativa' : 'Fechada'}
                              </span>
                            </td>
                            <td className="td-right">
                              <div
                                style={{
                                  display: 'inline-flex',
                                  gap: 6,
                                  justifyContent: 'flex-end',
                                }}
                              >
                                <Link
                                  href={`/dashboard/empresa/vaga/${job.id}`}
                                  className="btn btn-ghost btn-sm"
                                  title="Ver candidaturas"
                                  aria-label="Ver candidaturas"
                                >
                                  <FiInbox />
                                </Link>
                                <Link
                                  href={`/dashboard/empresa/vaga/${job.id}`}
                                  className="btn btn-ghost btn-sm"
                                  title="Editar"
                                  aria-label="Editar"
                                >
                                  <FiEdit2 />
                                </Link>
                                <button
                                  type="button"
                                  className="btn btn-danger-ghost btn-sm"
                                  title="Eliminar"
                                  aria-label="Eliminar"
                                  onClick={() => deleteJob(job.id)}
                                >
                                  <FiTrash2 />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        );
      }
      case 'candidates': {
        const initialsOf = (name) =>
          (name || '?')
            .split(' ')
            .map((w) => w[0])
            .filter(Boolean)
            .slice(0, 2)
            .join('')
            .toUpperCase();
        return (
          <>
            <div className="header-card">
              <div>
                <div className="header-eyebrow">Empresa · Talentos</div>
                <h1 className="header-title">Banco de talentos</h1>
                <p className="header-sub">
                  Candidatos verificados disponíveis para contacto.
                </p>
              </div>
            </div>

            <div className="panel">
              <div className="dash-toolbar">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Pesquisar por nome ou competência..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
                <select
                  className="form-select"
                  style={{ maxWidth: 200 }}
                  aria-label="Área profissional"
                  value={talentAreaFilter}
                  onChange={(event) => setTalentAreaFilter(event.target.value)}
                >
                  <option value="all">Todas as áreas</option>
                  {talentAreaOptions.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-lime"
                  onClick={() => {
                    setSearchQuery('');
                    setTalentAreaFilter('all');
                  }}
                  disabled={!searchQuery && talentAreaFilter === 'all'}
                >
                  {searchQuery || talentAreaFilter !== 'all' ? (
                    <FiX />
                  ) : (
                    <FiFilter />
                  )}
                  Limpar filtros
                </button>
              </div>

              {!companyPlanFeatures.accessTalentPool && (
                <div
                  className="dash-muted"
                  style={{ marginBottom: 14, fontSize: '0.84rem' }}
                >
                  Plano Básico: visualização limitada aos candidatos que já se
                  candidataram.{' '}
                  <Link
                    href="/premium/empresa"
                    style={{ color: 'var(--blue)', fontWeight: 700 }}
                  >
                    Desbloquear banco completo
                  </Link>
                </div>
              )}
              {companyPlanFeatures.accessTalentPool && loadingTalentPool && (
                <p className="dash-muted">A carregar banco de talentos…</p>
              )}
              {companyPlanFeatures.accessTalentPool && talentPoolError && (
                <p className="dash-muted" style={{ color: 'var(--danger)' }}>
                  {talentPoolError}
                </p>
              )}

              {filteredTalents.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">👥</div>
                  <p>
                    Os perfis de candidatos aparecerão aqui assim que receber
                    candidaturas.
                  </p>
                </div>
              ) : (
                <div className="dash-grid-3">
                  {filteredTalents.map((talent, index) => {
                    const locked =
                      !companyPlanFeatures.accessTalentPool && index >= 3;
                    return (
                      <div key={talent.id} className="dash-talent-card">
                        <div className="dash-talent-head">
                          <div className="dash-avatar">
                            {talent.avatar ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={talent.avatar} alt={talent.name} />
                            ) : (
                              initialsOf(talent.name)
                            )}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div
                              className="list-item-title"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              {talent.name}
                              {talent.verified && (
                                <VerificationBadge verified size="sm" />
                              )}
                            </div>
                            <div className="list-item-meta">
                              {[talent.headline, talent.location]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          </div>
                        </div>
                        <div className="dash-chips">
                          {(talent.skills || []).slice(0, 3).map((skill) => (
                            <span key={skill} className="dash-chip">
                              {skill}
                            </span>
                          ))}
                          {(!talent.skills || talent.skills.length === 0) && (
                            <span
                              className="dash-chip"
                              style={{
                                background: 'var(--surface-3)',
                                color: 'var(--text-3)',
                              }}
                            >
                              Perfil pronto
                            </span>
                          )}
                        </div>
                        {locked ? (
                          <Link
                            href="/premium/empresa"
                            className="btn btn-ghost"
                            style={{ width: '100%' }}
                          >
                            <FiStar /> Desbloquear perfil
                          </Link>
                        ) : (
                          <Link
                            href={
                              talent.profileUrl ||
                              `/dashboard/empresa/candidato/${talent.id}`
                            }
                            className="btn btn-ghost"
                            style={{ width: '100%' }}
                          >
                            <FiMail /> Contactar
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        );
      }
      case 'applications': {
        const pendingCount = applicationsData.filter(
          (a) => !a.status || a.status === 'pending',
        ).length;
        const analysisCount = applicationsData.filter(
          (a) => a.status === 'analysis',
        ).length;
        const interviewCount = applicationsData.filter(
          (a) => a.status === 'interview',
        ).length;
        const approvedCount = applicationsData.filter(
          (a) => a.status === 'approved',
        ).length;
        const appTabs = [
          { key: 'all', label: 'Todas', count: applicationsData.length },
          { key: 'pending', label: 'Novas', count: pendingCount },
          { key: 'interview', label: 'Entrevistas', count: interviewCount },
          { key: 'approved', label: 'Aprovadas', count: approvedCount },
        ];
        const appMeta = (status) => {
          switch (status) {
            case 'analysis':
              return { label: 'Em análise', cls: 'badge-pending' };
            case 'interview':
              return { label: 'Entrevista', cls: 'badge-pending' };
            case 'approved':
            case 'accepted':
              return { label: 'Aprovado', cls: 'badge-success' };
            case 'rejected':
              return { label: 'Rejeitado', cls: 'badge-closed' };
            default:
              return { label: 'Nova', cls: 'badge-warn' };
          }
        };
        const initialsOf = (name) =>
          (name || '?')
            .split(' ')
            .map((w) => w[0])
            .filter(Boolean)
            .slice(0, 2)
            .join('')
            .toUpperCase();

        return (
          <>
            <div className="header-card">
              <div>
                <div className="header-eyebrow">Empresa · Candidaturas</div>
                <h1 className="header-title">Candidaturas recebidas</h1>
                <p className="header-sub">
                  {applicationsData.length} candidatura
                  {applicationsData.length !== 1 ? 's' : ''} no total
                </p>
              </div>
              <div className="header-actions">
                {isRecruitmentWorkspaceEnabled() ? (
                  <Link
                    href="/dashboard/recrutamento"
                    className="btn btn-primary"
                  >
                    Abrir recrutamento e equipa
                  </Link>
                ) : null}
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleExportApplications}
                  disabled={exportingCsv}
                >
                  <FiDownload /> {exportingCsv ? 'A exportar…' : 'Exportar CSV'}
                </button>
              </div>
            </div>

            <div className="stats-grid">
              <div
                className="stat-card"
                style={{
                  '--accent': 'rgba(32,87,215,0.85)',
                  '--accent-shadow': 'rgba(32,87,215,0.28)',
                }}
              >
                <div
                  className="stat-icon"
                  style={{
                    background: 'linear-gradient(135deg,#2057d7,#4f8ef7)',
                  }}
                >
                  <FiInbox />
                </div>
                <div className="stat-value">{pendingCount}</div>
                <div className="stat-label">Novas</div>
              </div>
              <div
                className="stat-card"
                style={{
                  '--accent': 'rgba(217,106,61,0.9)',
                  '--accent-shadow': 'rgba(217,106,61,0.28)',
                }}
              >
                <div
                  className="stat-icon"
                  style={{
                    background: 'linear-gradient(135deg,#f59e0b,#d9773d)',
                  }}
                >
                  <FiClock />
                </div>
                <div className="stat-value">{analysisCount}</div>
                <div className="stat-label">Em análise</div>
              </div>
              <div
                className="stat-card"
                style={{
                  '--accent': 'rgba(95,184,245,0.9)',
                  '--accent-shadow': 'rgba(95,184,245,0.28)',
                }}
              >
                <div
                  className="stat-icon"
                  style={{
                    background: 'linear-gradient(135deg,#5fb8f5,#7dceff)',
                  }}
                >
                  <FiVideo />
                </div>
                <div className="stat-value">{interviewCount}</div>
                <div className="stat-label">Entrevistas</div>
              </div>
              <div
                className="stat-card"
                style={{
                  '--accent': 'rgba(61,187,122,0.9)',
                  '--accent-shadow': 'rgba(61,187,122,0.28)',
                }}
              >
                <div
                  className="stat-icon"
                  style={{
                    background: 'linear-gradient(135deg,#3dbb7a,#22c55e)',
                  }}
                >
                  <FiCheckCircle />
                </div>
                <div className="stat-value">{approvedCount}</div>
                <div className="stat-label">Aprovadas</div>
              </div>
            </div>

            <div className="tabs">
              {appTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`tab${applicationFilter === tab.key ? ' active' : ''}`}
                  onClick={() => setApplicationFilter(tab.key)}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>

            {filteredApplications.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📨</div>
                <p>
                  {applicationsData.length === 0
                    ? 'As candidaturas aparecerão à medida que os talentos se inscreverem.'
                    : 'Nenhuma candidatura neste filtro.'}
                </p>
              </div>
            ) : (
              <div className="item-list">
                {filteredApplications.map((application) => {
                  const meta = appMeta(application.status);
                  const score = application.compatibilityScore;
                  const hasScore = typeof score === 'number';
                  const appStatus = application.status || 'pending';
                  const isUpdating = updatingApplicationId === application.id;
                  return (
                    <div
                      key={application.id}
                      className={`list-item ${styles.applicationListItem}`}
                    >
                      <div className="list-item-icon">
                        {initialsOf(application.candidateName)}
                      </div>
                      <div className="list-item-body">
                        <div className="list-item-title">
                          {application.candidateName || 'Candidato'}
                        </div>
                        <div className="list-item-meta">
                          {application.jobTitle || 'Vaga'}
                        </div>
                      </div>
                      <div
                        className={styles.applicationListControls}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                        }}
                      >
                        {hasScore && (
                          <span
                            style={{
                              fontWeight: 800,
                              fontSize: '0.84rem',
                              color:
                                score >= 90
                                  ? 'var(--dash-success-text, #3dbb7a)'
                                  : 'var(--dash-info-text, #2057d7)',
                            }}
                          >
                            {score}% match
                          </span>
                        )}
                        <span className={`badge ${meta.cls}`}>
                          {meta.label}
                        </span>
                        <div
                          className={styles.applicationListActions}
                          style={{
                            display: 'inline-flex',
                            gap: 6,
                            flexWrap: 'wrap',
                            justifyContent: 'flex-end',
                          }}
                        >
                          <Link
                            href={`/dashboard/empresa/candidato/${application.candidateId}`}
                            className="btn btn-ghost btn-sm"
                            title="Ver perfil"
                            aria-label="Ver perfil"
                          >
                            <FiEye />
                          </Link>
                          {appStatus !== 'withdrawn' ? (
                            <>
                              <button
                                type="button"
                                className="btn btn-lime btn-sm"
                                title="Aceitar candidatura"
                                aria-label="Aceitar candidatura"
                                disabled={
                                  isUpdating || appStatus === 'approved'
                                }
                                onClick={() =>
                                  handleApplicationStatusChange(
                                    application.id,
                                    'approved',
                                  )
                                }
                              >
                                <FiCheck />
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                title="Rejeitar candidatura"
                                aria-label="Rejeitar candidatura"
                                disabled={
                                  isUpdating || appStatus === 'rejected'
                                }
                                onClick={() =>
                                  handleApplicationStatusChange(
                                    application.id,
                                    'rejected',
                                  )
                                }
                              >
                                <FiX />
                              </button>
                              {companyPlanFeatures.canScheduleInterviews ? (
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  title="Agendar entrevista"
                                  aria-label="Agendar entrevista"
                                  onClick={() =>
                                    openInterviewScheduler?.(application)
                                  }
                                >
                                  <FiCalendar />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  title="Agendar entrevista está disponível nos planos Profissional e PRO"
                                  aria-label="Agendar entrevista (requer plano Profissional ou PRO)"
                                  onClick={() => openTab('plans')}
                                >
                                  <FiCalendar />
                                  <FiLock />
                                </button>
                              )}
                              {companyPlanFeatures.canSendDirectMessages ? (
                                <Link
                                  href={`/dashboard/empresa?tab=messages&candidate=${application.candidateId}`}
                                  className="btn btn-ghost btn-sm"
                                  title="Enviar mensagem"
                                  aria-label="Enviar mensagem"
                                >
                                  <FiMail />
                                </Link>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  title="Enviar mensagem direta está disponível no plano PRO"
                                  aria-label="Enviar mensagem (requer plano PRO)"
                                  onClick={() => openTab('plans')}
                                >
                                  <FiMail />
                                  <FiLock />
                                </button>
                              )}
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        );
      }
      case 'interviews': {
        const scheduled = applicationsData.filter(
          (a) => a.interviewDetails?.scheduledAt || a.status === 'interview',
        );
        const initialsOf = (name) =>
          (name || '?')
            .split(' ')
            .map((w) => w[0])
            .filter(Boolean)
            .slice(0, 2)
            .join('')
            .toUpperCase();
        const guide = [
          {
            title: 'Prepare as perguntas',
            text: 'Prepare 8–10 perguntas relevantes para cada posição.',
          },
          {
            title: 'Avalie com critérios',
            text: 'Use uma escala de 1–5 para competências técnicas e soft skills.',
          },
          {
            title: 'Feedback rápido',
            text: 'Dê feedback em 48h para manter a reputação da empresa.',
          },
          {
            title: 'Painel diversificado',
            text: 'Inclua pelo menos 2 avaliadores por entrevista.',
          },
        ];
        return (
          <>
            <div className="header-card">
              <div>
                <div className="header-eyebrow">Empresa · Entrevistas</div>
                <h1 className="header-title">Entrevistas agendadas</h1>
                <p className="header-sub">
                  {scheduled.length} entrevista
                  {scheduled.length !== 1 ? 's' : ''} agendada
                  {scheduled.length !== 1 ? 's' : ''} esta semana.
                </p>
              </div>
              <div className="header-actions">
                <button
                  type="button"
                  className="btn btn-lime"
                  onClick={() => openTab('applications')}
                >
                  <FiCalendar /> Agendar
                </button>
              </div>
            </div>

            <div className="grid-2">
              <div className="panel">
                <div className="panel-title">
                  Esta semana
                  <span className="panel-badge">{scheduled.length}</span>
                </div>
                {scheduled.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">📅</div>
                    <p>
                      Nenhuma entrevista agendada. Marque uma a partir de uma
                      candidatura.
                    </p>
                  </div>
                ) : (
                  <div className="item-list">
                    {scheduled.map((app) => {
                      const details = app.interviewDetails || {};
                      const when = details.scheduledAt
                        ? formatInterviewDateTime(details.scheduledAt)
                        : 'Data a confirmar';
                      const isPresential = details.mode === 'presencial';
                      const modeLabel = isPresential
                        ? `Presencial · ${details.location || 'Escritório'}`
                        : `Online${details.provider ? ` · ${details.provider}` : ''}`;
                      return (
                        <div
                          key={app.id}
                          className="list-item"
                          style={{ display: 'block' }}
                        >
                          <div
                            className="dash-flex"
                            style={{ marginBottom: 8 }}
                          >
                            <div className="list-item-icon">
                              {initialsOf(app.candidateName)}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div className="list-item-title">
                                {app.candidateName || 'Candidato'}
                              </div>
                              <div className="list-item-meta">
                                {app.jobTitle || 'Vaga'}
                              </div>
                            </div>
                          </div>
                          <div
                            style={{
                              color: 'var(--blue)',
                              fontWeight: 700,
                              fontSize: '0.82rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <FiCalendar /> {when}
                          </div>
                          <div
                            className="list-item-meta"
                            style={{ marginTop: 2 }}
                          >
                            {modeLabel}
                          </div>
                          <div
                            style={{ display: 'flex', gap: 8, marginTop: 12 }}
                          >
                            {!isPresential && details.link ? (
                              <a
                                href={details.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-primary btn-sm"
                              >
                                <FiVideo /> Entrar
                              </a>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                disabled
                              >
                                <FiVideo /> Entrar
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => openInterviewScheduler?.(app)}
                            >
                              <FiClock /> Reagendar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="panel">
                <div className="panel-title">Guia de entrevistas</div>
                {guide.map((tip) => (
                  <div key={tip.title} className="advisor-item">
                    <div className="advisor-title">{tip.title}</div>
                    <div className="advisor-text">{tip.text}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        );
      }
      case 'messages':
        const activeConversation = conversations.find(
          (conversation) => conversation.id === selectedConversation,
        );

        return (
          <section className={styles.sectionBlock}>
            <div className={styles.sectionHeading}>
              <div>
                <h2>Mensagens</h2>
                <p>
                  Converse diretamente com candidatos elegíveis ao seu plano
                </p>
              </div>
              {companyPlanFeatures.canSendDirectMessages ? (
                <span className={styles.filterTab}>
                  {unreadMessages > 0
                    ? `${unreadMessages} não lida(s)`
                    : 'Caixa organizada'}
                </span>
              ) : (
                <Link href="/premium/empresa" className={styles.actionLink}>
                  Fazer upgrade
                </Link>
              )}
            </div>

            {!companyPlanFeatures.canSendDirectMessages ? (
              <EmptyState
                icon={icons.messages}
                title="Mensagens diretas disponíveis apenas no plano PRO"
                message="Faça upgrade para o plano PRO para iniciar conversas com candidatos e acelerar o processo de recrutamento."
                action={
                  <Link href="/premium/empresa" className={styles.actionLink}>
                    Ver planos
                  </Link>
                }
              />
            ) : (
              <div className={styles.messagesLayout}>
                <div className={styles.messagesList}>
                  {loadingConversations ? (
                    <p
                      className={`${styles.messagePlaceholder} ${styles.messagePlaceholderPadded}`}
                    >
                      A carregar conversas...
                    </p>
                  ) : messagesError ? (
                    <p
                      className={`${styles.messagePlaceholder} ${styles.messagePlaceholderPadded}`}
                    >
                      {messagesError}
                    </p>
                  ) : conversations.length === 0 ? (
                    <p
                      className={`${styles.messagePlaceholder} ${styles.messagePlaceholderPadded}`}
                    >
                      Nenhuma conversa ainda. Abra um perfil de candidato para
                      iniciar.
                    </p>
                  ) : (
                    conversations.map((conversation) => {
                      const initials = (conversation.participant.name || 'U')
                        .charAt(0)
                        .toUpperCase();
                      const timeLabel = conversation.lastMessageAt
                        ? new Date(
                            conversation.lastMessageAt,
                          ).toLocaleDateString('pt-PT', {
                            day: '2-digit',
                            month: '2-digit',
                          })
                        : '';

                      return (
                        <button
                          key={conversation.id}
                          type="button"
                          className={`${styles.messageItem} ${selectedConversation === conversation.id ? styles.selectedMessageItem : ''}`}
                          onClick={() =>
                            setSelectedConversation(conversation.id)
                          }
                        >
                          <div className={styles.messageAvatarWrapper}>
                            {conversation.participant.avatar ? (
                              <Image
                                src={conversation.participant.avatar}
                                alt={conversation.participant.name}
                                width={40}
                                height={40}
                                sizes="40px"
                                unoptimized
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
                            <p>{conversation.lastMessage || 'Sem mensagens'}</p>
                          </div>
                          <span className={styles.messageTime}>
                            {timeLabel}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>

                <div className={styles.messageDetail}>
                  {activeConversation ? (
                    <>
                      <div className={styles.messageDetailHeader}>
                        <h3>{activeConversation.participant.name}</h3>
                        {activeConversation.participant.role && (
                          <p className={styles.pageDate}>
                            {activeConversation.participant.role}
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
                            Ainda não há mensagens. Seja o primeiro a escrever.
                          </p>
                        ) : (
                          messages.map((message) => {
                            const isOwn = message.senderId === user?.uid;
                            return (
                              <div
                                key={message.id}
                                className={
                                  isOwn
                                    ? styles.messageBubbleOwn
                                    : styles.messageBubble
                                }
                              >
                                <span>{message.text}</span>
                                <time className={styles.messageBubbleTime}>
                                  {message.createdAt
                                    ? new Date(
                                        message.createdAt,
                                      ).toLocaleTimeString('pt-PT', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })
                                    : ''}
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
                          onChange={(event) =>
                            setMessageInput(event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                              event.preventDefault();
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
                          {sendingMessage ? '…' : 'Enviar'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className={styles.messageEmptyState}>
                      {icons.messages}
                      <p>Selecione uma conversa para começar.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        );
      case 'analytics': {
        if (!companyPlanFeatures.canAccessAnalytics) {
          return (
            <>
              <div className="header-card">
                <div>
                  <div className="header-eyebrow">Empresa · Analytics</div>
                  <h1 className="header-title">Desempenho das vagas</h1>
                  <p className="header-sub">
                    Análise detalhada das suas publicações.
                  </p>
                </div>
              </div>
              <div className="empty-state">
                <div className="empty-state-icon">📊</div>
                <p>Analytics disponível apenas no plano PRO.</p>
                <div style={{ marginTop: 16 }}>
                  <Link href="/premium/empresa" className="btn btn-primary">
                    Ver planos
                  </Link>
                </div>
              </div>
            </>
          );
        }

        const totalViews =
          analytics?.totalViews ||
          jobs.reduce((sum, job) => sum + (job.views || 0), 0);
        const conversionRate =
          totalViews > 0 ? (totalApplications / totalViews) * 100 : 0;
        const avgAppsPerJob =
          jobs.length > 0 ? Math.round(totalApplications / jobs.length) : 0;
        const qualityScore = jobs.length
          ? Math.min(
              10,
              Math.min(conversionRate / 4, 1) * 5 +
                (activeJobs.length / Math.max(jobs.length, 1)) * 5,
            )
          : 0;
        const timeToHire = analytics?.avgTimeToHire;
        const statusBuckets = [
          {
            name: 'Pendentes',
            value: applicationsData.filter(
              (app) => !app.status || app.status === 'pending',
            ).length,
            color: 'var(--dash-info-text, #2057d7)',
          },
          {
            name: 'Em análise',
            value: applicationsData.filter((app) => app.status === 'analysis')
              .length,
            color: 'var(--sky, #5fb8f5)',
          },
          {
            name: 'Entrevista',
            value: applicationsData.filter((app) => app.status === 'interview')
              .length,
            color: 'var(--lime, #d9ff2f)',
          },
          {
            name: 'Aprovadas',
            value: applicationsData.filter((app) => app.status === 'approved')
              .length,
            color: 'var(--success, #3dbb7a)',
          },
        ];
        const totalBucketValues =
          statusBuckets.reduce((sum, bucket) => sum + bucket.value, 0) || 1;
        const sourceData = statusBuckets.map((bucket) => ({
          ...bucket,
          value: Math.round((bucket.value / totalBucketValues) * 100),
        }));
        const topViewJobs = [...jobs]
          .sort((a, b) => (b.views || 0) - (a.views || 0))
          .slice(0, 5);
        const maxViews = Math.max(...topViewJobs.map((j) => j.views || 0), 1);
        const shortName = (title) => (title || 'Vaga').split(' ')[0];

        return (
          <>
            <div className="header-card">
              <div>
                <div className="header-eyebrow">Empresa · Analytics</div>
                <h1 className="header-title">Desempenho das vagas</h1>
                <p className="header-sub">
                  Análise detalhada das suas publicações.
                </p>
              </div>
              <div className="header-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleExportApplications}
                  disabled={exportingCsv}
                >
                  <FiDownload /> {exportingCsv ? 'A exportar…' : 'Exportar'}
                </button>
              </div>
            </div>

            {loadingAnalytics ? (
              <div className="loading-state">
                <div className="spinner" />
                <p>A carregar métricas…</p>
              </div>
            ) : analyticsError ? (
              <div className="empty-state">
                <div className="empty-state-icon">⚠️</div>
                <p>{analyticsError}</p>
              </div>
            ) : (
              <>
                <div className="stats-grid">
                  <div
                    className="stat-card"
                    style={{
                      '--accent': 'rgba(186,230,39,0.9)',
                      '--accent-shadow': 'rgba(186,230,39,0.28)',
                    }}
                  >
                    <div
                      className="stat-icon"
                      style={{
                        background: 'linear-gradient(135deg,#d9ff2f,#bae619)',
                        color: '#162a55',
                      }}
                    >
                      <FiTrendingUp />
                    </div>
                    <div className="stat-value">
                      {conversionRate.toFixed(1)}%
                    </div>
                    <div className="stat-label">Taxa de conversão</div>
                  </div>
                  <div
                    className="stat-card"
                    style={{
                      '--accent': 'rgba(32,87,215,0.85)',
                      '--accent-shadow': 'rgba(32,87,215,0.28)',
                    }}
                  >
                    <div
                      className="stat-icon"
                      style={{
                        background: 'linear-gradient(135deg,#2057d7,#4f8ef7)',
                      }}
                    >
                      <FiClock />
                    </div>
                    <div className="stat-value">
                      {timeToHire ? `${timeToHire}d` : '—'}
                    </div>
                    <div className="stat-label">Tempo médio p/ contratar</div>
                  </div>
                  <div
                    className="stat-card"
                    style={{
                      '--accent': 'rgba(95,184,245,0.9)',
                      '--accent-shadow': 'rgba(95,184,245,0.28)',
                    }}
                  >
                    <div
                      className="stat-icon"
                      style={{
                        background: 'linear-gradient(135deg,#5fb8f5,#7dceff)',
                      }}
                    >
                      <FiUsers />
                    </div>
                    <div className="stat-value">{avgAppsPerJob}</div>
                    <div className="stat-label">Candidatos por vaga</div>
                  </div>
                  <div
                    className="stat-card"
                    style={{
                      '--accent': 'rgba(61,187,122,0.9)',
                      '--accent-shadow': 'rgba(61,187,122,0.28)',
                    }}
                  >
                    <div
                      className="stat-icon"
                      style={{
                        background: 'linear-gradient(135deg,#3dbb7a,#22c55e)',
                      }}
                    >
                      <FiAward />
                    </div>
                    <div className="stat-value">
                      {qualityScore.toFixed(1)}/10
                    </div>
                    <div className="stat-label">Índice de qualidade</div>
                  </div>
                </div>

                <div className="grid-2">
                  <div className="panel">
                    <div className="panel-title">Vistas por vaga</div>
                    {topViewJobs.length === 0 ? (
                      <div className="dash-muted" style={{ padding: '12px 0' }}>
                        Sem dados de visualizações.
                      </div>
                    ) : (
                      <div className="chart-bars">
                        {topViewJobs.map((job, i) => {
                          const height = Math.max(
                            ((job.views || 0) / maxViews) * 100,
                            6,
                          );
                          return (
                            <div className="chart-bar-wrap" key={job.id}>
                              <div className="chart-bar-val">
                                {job.views || 0}
                              </div>
                              <div
                                className={`chart-bar${i % 2 ? ' lime' : ''}`}
                                style={{ height: `${height}%` }}
                              />
                              <div className="chart-bar-label">
                                {shortName(job.titulo)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="panel">
                    <div className="panel-title">
                      Distribuição das candidaturas
                    </div>
                    <div className="metric-list">
                      {sourceData.map((source) => (
                        <div className="metric-row" key={source.name}>
                          <div className="metric-label">{source.name}</div>
                          <div className="metric-track">
                            <div
                              className="metric-fill"
                              style={{
                                width: `${source.value}%`,
                                background: source.color,
                              }}
                            />
                          </div>
                          <div className="metric-val">{source.value}%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        );
      }
      case 'company-profile':
        return (
          <section className={styles.sectionBlock}>
            <div className={styles.profileSection}>
              {profile.coverUrl || profile.cover ? (
                <div
                  className={styles.profileCover}
                  style={{
                    backgroundImage: `url(${profile.coverUrl || profile.cover})`,
                  }}
                />
              ) : null}
              <div className={styles.profileDetails}>
                <div className={styles.profileHeaderRow}>
                  <h2>{profile.name || profile.fullName || 'Sua empresa'}</h2>
                  <Link
                    href="/dashboard/empresa/profile"
                    className={styles.actionLink}
                  >
                    Editar informações
                  </Link>
                </div>
                <div className={styles.profileSummary}>
                  <h3>Resumo da empresa</h3>
                  <p>
                    {profile.description ||
                      'Complete o perfil para ganhar destaque com um resumo claro da missão, cultura e principais serviços da empresa.'}
                  </p>
                </div>
                <div className={styles.profileStatsGrid}>
                  <div className={styles.profileStat}>
                    <span>Localização</span>
                    <strong>{profile.location || 'São Tomé, STP'}</strong>
                  </div>
                  <div className={styles.profileStat}>
                    <span>Setor de atuação</span>
                    <strong>
                      {profile.industry ||
                        profile.segment ||
                        profile.area ||
                        'Não informado'}
                    </strong>
                  </div>
                  <div className={styles.profileStat}>
                    <span>Contacto</span>
                    <strong>
                      {profile.contact ||
                        profile.phone ||
                        profile.email ||
                        'Não informado'}
                    </strong>
                  </div>
                  <div className={styles.profileStat}>
                    <span>Plano atual</span>
                    <strong>{planState}</strong>
                  </div>
                  <div className={styles.profileStat}>
                    <span>Tamanho da empresa</span>
                    <strong>
                      {profile.employees ||
                        profile.companySize ||
                        profile.size ||
                        'Não informado'}
                    </strong>
                  </div>
                  <div className={styles.profileStat}>
                    <span>Candidaturas totais</span>
                    <strong>
                      {stats?.totalApplications || totalApplications}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      case 'hr-services': {
        const pendingHr = hrRequests.filter(
          (request) => request.status === 'pending',
        ).length;
        const completedHr = hrRequests.filter(
          (request) => request.status === 'completed',
        ).length;
        const formatHrDate = (value) => {
          if (!value) return 'Data não disponível';
          const date = new Date(value);
          if (Number.isNaN(date.getTime())) return 'Data não disponível';
          return date.toLocaleDateString('pt-PT', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });
        };

        return (
          <section className={styles.sectionBlock}>
            <div className="header-card">
              <div>
                <div className="header-eyebrow">Empresa · Serviço RH</div>
                <h1 className="header-title">Solicitar apoio da equipa RH</h1>
                <p className="header-sub">
                  Indique o serviço pretendido, detalhe a necessidade, anexe os
                  documentos e acompanhe a resposta da equipa EmpregoSTP.
                </p>
              </div>
              <div className="header-actions">
                <span className="badge badge-active">
                  {pendingHr} em análise
                </span>
                <span className="badge badge-success">
                  {completedHr} concluído{completedHr === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            {hrFeedback ? (
              <div
                className={`${styles.hrFeedback} ${
                  hrFeedback.type === 'success'
                    ? styles.hrFeedbackSuccess
                    : styles.hrFeedbackError
                }`}
                role={hrFeedback.type === 'success' ? 'status' : 'alert'}
              >
                {hrFeedback.text}
              </div>
            ) : null}

            <div className={styles.hrGrid}>
              <form
                className={`panel ${styles.hrPanel}`}
                onSubmit={submitHrRequest}
              >
                <div className="panel-title">
                  Novo pedido
                  <span className="panel-badge">Análise administrativa</span>
                </div>

                <div className="form-group">
                  <label htmlFor="hr-service-type">Serviço pretendido</label>
                  <select
                    id="hr-service-type"
                    className="form-input"
                    value={hrForm.serviceType}
                    onChange={(event) =>
                      updateHrForm('serviceType', event.target.value)
                    }
                    required
                  >
                    {HR_SERVICE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="hr-request-title">Assunto</label>
                  <input
                    id="hr-request-title"
                    className="form-input"
                    value={hrForm.title}
                    onChange={(event) =>
                      updateHrForm('title', event.target.value)
                    }
                    minLength={4}
                    maxLength={120}
                    placeholder="Ex.: Triagem para vaga de contabilista"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="hr-request-description">
                    Informações e detalhes
                  </label>
                  <textarea
                    id="hr-request-description"
                    className="form-input"
                    value={hrForm.description}
                    onChange={(event) =>
                      updateHrForm('description', event.target.value)
                    }
                    minLength={15}
                    maxLength={3000}
                    rows={7}
                    placeholder="Descreva o contexto, prazos, perfil pretendido e instruções relevantes."
                    required
                  />
                </div>

                <fieldset className={styles.hrDocumentsFieldset}>
                  <legend>Links dos documentos</legend>
                  <p className={styles.hrFieldHint}>
                    Adicione apenas ligações que a equipa possa consultar.
                  </p>
                  <div className={styles.hrDocumentsList}>
                    {hrForm.documents.map((doc, index) => (
                      <div key={index} className={styles.hrDocumentRow}>
                        <input
                          className="form-input"
                          value={doc.label}
                          onChange={(event) =>
                            updateHrDocument(index, 'label', event.target.value)
                          }
                          placeholder="Nome do documento"
                          maxLength={120}
                          aria-label={`Nome do documento ${index + 1}`}
                        />
                        <input
                          className="form-input"
                          value={doc.url}
                          onChange={(event) =>
                            updateHrDocument(index, 'url', event.target.value)
                          }
                          placeholder="https://..."
                          type="url"
                          aria-label={`Link do documento ${index + 1}`}
                        />
                        <button
                          type="button"
                          className="dash-icon-btn"
                          onClick={() => removeHrDocument(index)}
                          aria-label="Remover documento"
                        >
                          <FiX />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={addHrDocument}
                    disabled={hrForm.documents.length >= 10}
                  >
                    <FiFileText /> Adicionar documento
                  </button>
                </fieldset>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={hrSubmitting}
                >
                  <FiSend />{' '}
                  {hrSubmitting ? 'A enviar...' : 'Enviar para análise'}
                </button>
              </form>

              <div className={`panel ${styles.hrPanel}`}>
                <div className="panel-title">
                  Pedidos enviados
                  <span className="panel-badge">{hrRequests.length}</span>
                </div>
                {hrLoading ? (
                  <div className={styles.hrLoading} role="status">
                    A carregar pedidos
                  </div>
                ) : hrRequests.length === 0 ? (
                  <EmptyState
                    icon={<FiFileText />}
                    title="Sem pedidos RH"
                    message="Quando enviar um pedido, o estado e a resposta da equipa aparecem aqui."
                  />
                ) : (
                  <div className="item-list">
                    {hrRequests.map((request) => {
                      const meta =
                        HR_STATUS_META[request.status] ||
                        HR_STATUS_META.pending;
                      return (
                        <article
                          key={request.id}
                          className={`list-item ${styles.hrRequest}`}
                        >
                          <div className={styles.hrRequestHeader}>
                            <div>
                              <div className="advisor-cat">
                                {request.serviceType}
                              </div>
                              <div className="list-item-title">
                                {request.title}
                              </div>
                              <div className="list-item-meta">
                                Enviado em {formatHrDate(request.createdAt)}
                              </div>
                            </div>
                            <span className={`badge ${meta.className}`}>
                              {meta.label}
                            </span>
                          </div>
                          <p className={styles.hrRequestDescription}>
                            {request.description}
                          </p>

                          {request.documents?.length > 0 ? (
                            <div className={styles.hrDocumentLinks}>
                              {request.documents.map((doc, index) => (
                                <a
                                  key={index}
                                  href={doc.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn-ghost btn-sm"
                                >
                                  <FiFileText /> {doc.label || 'Documento'}
                                </a>
                              ))}
                            </div>
                          ) : null}

                          {request.adminResponse ? (
                            <div className={styles.hrResponse}>
                              <div className="advisor-cat">
                                {request.status === 'completed'
                                  ? 'Resposta final'
                                  : 'Resposta da equipa'}
                              </div>
                              <p className={styles.hrResponseText}>
                                {request.adminResponse}
                              </p>
                              {request.resultDocuments?.length > 0 ? (
                                <div className={styles.hrDocumentLinks}>
                                  {request.resultDocuments.map((doc, index) => (
                                    <a
                                      key={index}
                                      href={doc.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="btn btn-lime btn-sm"
                                    >
                                      <FiDownload /> {doc.label || 'Resultado'}
                                    </a>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>
        );
      }
      case 'plans':
        return (
          <section className={styles.sectionBlock}>
            <EmpresaPlansCatalog
              plans={plans}
              currentPlanId={
                profile?.planId ||
                profile?.currentPlan ||
                normalizedCompanyPlanId
              }
              currentPlanName={profile?.planName || planState}
              loadingPlanId={planLoadingId}
              error={planError}
              paymentInstructions={planPaymentInstructions}
              pendingPaymentRequest={pendingPaymentRequest}
              onPaymentProofSubmitted={setPendingPaymentRequest}
              onSubscribe={handleSubscribePlan}
            />
          </section>
        );
      case 'affiliate':
        return (
          <section className={styles.sectionBlock}>
            <AffiliateSection
              role="empresa"
              user={user}
              defaults={{
                fullName:
                  profile?.companyName || profile?.name || user?.name || '',
                email: profile?.email || user?.email || '',
                phone: profile?.phone || profile?.contact || '',
                location: profile?.location || '',
                occupation:
                  profile?.industry || profile?.segment || profile?.area || '',
              }}
            />
          </section>
        );
      default:
        return null;
    }
  };

  const activeLabel =
    MENU_ITEMS.find((item) => item.id === activeTab)?.label || activeTab;
  const empresaPlanLabel =
    typeof planState === 'string'
      ? planState
      : planState?.planName || 'Gratuito';
  const companyName =
    profile?.companyName || profile?.name || user?.name || 'Empresa';
  const scheduledInterviewsCount = applicationsData.filter(
    (a) => a.interviewDetails?.scheduledAt || a.status === 'interview',
  ).length;
  const topbarSubMap = {
    dashboard: `${companyName} · Plano ${empresaPlanLabel}`,
    jobs: 'Gestão de publicações',
    applications: `${applicationsData.length} candidaturas recebidas`,
    candidates: 'Candidatos verificados disponíveis',
    interviews: `${scheduledInterviewsCount} entrevistas agendadas`,
    analytics: 'Análise do desempenho das suas vagas',
    'hr-services': 'Pedidos de serviço RH e respostas da equipa',
    messages: 'Conversas com candidatos',
    'company-profile': 'Perfil público da empresa',
    plans: 'Gestão do seu plano',
    affiliate: 'Programa de afiliados EmpregoSTP',
  };
  // Ordem do wireframe (07_COMPANY, E01–E20) e igual à barra do shell em
  // components/dashboard/dashboardNav.js, para a lateral não mudar entre páginas.
  const empresaNav = [
    {
      label: 'Menu Principal',
      items: [
        {
          key: 'dashboard',
          label: 'Visão geral',
          icon: 'home',
          onClick: () => openTab('dashboard'),
        },
        {
          key: 'jobs',
          label: 'Minhas vagas',
          icon: 'briefcase',
          onClick: () => openTab('jobs'),
          badge: activeJobs.length || undefined,
        },
        {
          key: 'applications',
          label: 'Candidaturas',
          icon: 'inbox',
          onClick: () => openTab('applications'),
          badge: totalApplications || undefined,
        },
        // ADR-019: só com «Recrutamento e equipa» ativo.
        ...(isRecruitmentWorkspaceEnabled()
          ? [
              {
                key: 'recruitment',
                label: 'Recrutamento e equipa',
                icon: 'users',
                href: '/dashboard/recrutamento',
              },
            ]
          : []),
        {
          key: 'candidates',
          label: 'Banco de talentos',
          icon: 'users',
          onClick: () => openTab('candidates'),
        },
        {
          key: 'interviews',
          label: 'Entrevistas',
          icon: 'calendar',
          onClick: () => openTab('interviews'),
          badge: scheduledInterviewsCount || undefined,
          badgeStyle: 'lime',
        },
        {
          key: 'messages',
          label: 'Mensagens',
          icon: 'messages',
          onClick: () => openTab('messages'),
          badge: unreadMessages || undefined,
        },
      ],
    },
    {
      label: 'Análise',
      items: [
        {
          key: 'analytics',
          label: 'Análise',
          icon: 'chart',
          onClick: () => openTab('analytics'),
        },
        {
          key: 'hr-services',
          label: 'Serviço RH',
          icon: 'briefcase',
          onClick: () => openTab('hr-services'),
        },
      ],
    },
    {
      label: 'Conta',
      items: [
        {
          key: 'plans',
          label: 'Planos',
          icon: 'star',
          onClick: () => openTab('plans'),
        },
        {
          key: 'affiliate',
          label: 'Ser afiliado',
          icon: 'star',
          badgeStyle: 'lime',
          onClick: () => openTab('affiliate'),
        },
      ],
    },
  ];

  return (
    <>
      <Head>
        <title>Painel da empresa | EmpregoSTP</title>
        <meta
          name="description"
          content="Gira vagas e candidatos no painel empresarial do EmpregoSTP"
        />
      </Head>
      <DashboardShell
        role="empresa"
        active={activeTab}
        title={activeLabel}
        subtitle={
          topbarSubMap[activeTab] || `${companyName}, plano ${empresaPlanLabel}`
        }
        searchPlaceholder={
          activeTab === 'candidates'
            ? 'Pesquisar no banco de talentos...'
            : undefined
        }
        searchValue={activeTab === 'candidates' ? searchQuery : ''}
        onSearchChange={activeTab === 'candidates' ? setSearchQuery : undefined}
        nav={empresaNav}
        onLogout={handleLogout}
        topbarActions={
          <div className="dash-notif-wrap">
            <button
              type="button"
              className="dash-icon-btn"
              onClick={() => {
                setNotificationsOpen((prev) => {
                  const next = !prev;
                  if (!prev && next) fetchNotifications();
                  return next;
                });
              }}
              aria-expanded={notificationsOpen}
              aria-label="Notificações"
            >
              <FiBell />
              {unreadNotifications > 0 && <span className="dash-notif-dot" />}
            </button>
            {notificationsOpen && (
              <div
                className="dash-notif-panel"
                role="dialog"
                aria-label="Notificações"
              >
                <div className="dash-notif-head">
                  <strong>Notificações</strong>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={markAllNotificationsRead}
                    disabled={notificationsLoading || unreadNotifications === 0}
                  >
                    Marcar todas
                  </button>
                </div>
                <div className="dash-notif-list">
                  {notificationsError ? (
                    <div className="dash-notif-empty">
                      Erro: {notificationsError}
                    </div>
                  ) : notificationsLoading ? (
                    <div className="dash-notif-empty">A carregar…</div>
                  ) : notifications.length === 0 ? (
                    <div className="dash-notif-empty">
                      Nenhuma notificação recente.
                    </div>
                  ) : (
                    notifications.slice(0, 10).map((notif) => (
                      <button
                        key={notif.id}
                        type="button"
                        className={`dash-notif-row${notif.read ? '' : ' unread'}`}
                        onClick={() => handleNotificationClick?.(notif)}
                        title={notif.message || notif.title || 'Notificação'}
                      >
                        <span className="dash-notif-ic" aria-hidden="true">
                          <FiBell />
                        </span>
                        <div className="dash-notif-txt">
                          <div className="dash-notif-row-title">
                            {notif.title || 'Notificação'}
                          </div>
                          {notif.message && (
                            <p className="dash-notif-row-msg">
                              {notif.message}
                            </p>
                          )}
                          <span className="dash-notif-time">
                            {notif.createdAt
                              ? new Date(notif.createdAt).toLocaleString(
                                  'pt-PT',
                                )
                              : ''}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        }
        profile={{
          name:
            profile?.companyName || profile?.name || user?.name || 'Empresa',
          role: 'Empresa',
          plan:
            empresaPlanLabel && empresaPlanLabel.toLowerCase() !== 'gratuito'
              ? empresaPlanLabel
              : undefined,
          avatarUrl: profile?.logoUrl || profile?.photoUrl || undefined,
        }}
      >
        <div className={styles.dashboardThemeScope}>{renderContent()}</div>
      </DashboardShell>
      {interviewModal.open && (
        <div className={styles.modalOverlay} onClick={closeInterviewScheduler}>
          <div
            className={styles.modalCard}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <h3>Agendar entrevista</h3>
                <p>
                  {interviewModal.application?.candidateName || 'Candidato'},{' '}
                  {interviewModal.application?.jobTitle || 'Vaga'}
                </p>
              </div>
              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={closeInterviewScheduler}
                aria-label="Fechar janela de agendamento"
              >
                Fechar
              </button>
            </div>

            <div className={styles.modalGrid}>
              <label className={styles.modalField}>
                <span>Data e hora</span>
                <input
                  type="datetime-local"
                  value={interviewForm.interviewDate}
                  onChange={(event) =>
                    handleInterviewFieldChange(
                      'interviewDate',
                      event.target.value,
                    )
                  }
                />
              </label>

              <label className={styles.modalField}>
                <span>Formato</span>
                <select
                  value={interviewForm.interviewMode}
                  onChange={(event) =>
                    handleInterviewFieldChange(
                      'interviewMode',
                      event.target.value,
                    )
                  }
                >
                  <option value="online">Online</option>
                  <option value="presencial">Presencial</option>
                </select>
              </label>

              {interviewForm.interviewMode === 'online' ? (
                <label
                  className={`${styles.modalField} ${styles.modalFieldFull}`}
                >
                  <span>Link da entrevista</span>
                  <input
                    type="url"
                    placeholder="https://meet.google.com/..."
                    value={interviewForm.interviewLink}
                    onChange={(event) =>
                      handleInterviewFieldChange(
                        'interviewLink',
                        event.target.value,
                      )
                    }
                  />
                </label>
              ) : (
                <label
                  className={`${styles.modalField} ${styles.modalFieldFull}`}
                >
                  <span>Local da entrevista</span>
                  <input
                    type="text"
                    placeholder="Endereço ou referência"
                    value={interviewForm.interviewLocation}
                    onChange={(event) =>
                      handleInterviewFieldChange(
                        'interviewLocation',
                        event.target.value,
                      )
                    }
                  />
                </label>
              )}

              <label
                className={`${styles.modalField} ${styles.modalFieldFull}`}
              >
                <span>Notas para o candidato</span>
                <textarea
                  rows="4"
                  placeholder="Ex.: leve documento de identificação e chegue 10 minutos antes."
                  value={interviewForm.interviewNotes}
                  onChange={(event) =>
                    handleInterviewFieldChange(
                      'interviewNotes',
                      event.target.value,
                    )
                  }
                />
              </label>
            </div>

            {interviewError && (
              <div className={styles.modalErrorBox}>
                <p>{interviewError}</p>
                {interviewError.toLowerCase().includes('upgrade') && (
                  <Link href="/premium/empresa" className={styles.actionLink}>
                    Ver planos
                  </Link>
                )}
              </div>
            )}

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.applicationBtnOutline}
                onClick={closeInterviewScheduler}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.applicationBtn}
                onClick={handleScheduleInterview}
                disabled={interviewSubmitting}
              >
                {interviewSubmitting ? 'A guardar...' : 'Confirmar entrevista'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function safeTimestampToMillis(timestamp) {
  if (!timestamp) return null;
  if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
  if (typeof timestamp === 'number') return timestamp;
  if (typeof timestamp === 'string') return new Date(timestamp).getTime();
  return null;
}

function sanitizeFirestoreValue(value) {
  if (!value) return value;
  if (typeof value.toMillis === 'function') {
    return value.toMillis();
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeFirestoreValue(item));
  }
  if (value && typeof value === 'object') {
    const sanitized = {};
    Object.keys(value).forEach((key) => {
      sanitized[key] = sanitizeFirestoreValue(value[key]);
    });
    return sanitized;
  }
  return value;
}

function normalizeJobDates(job) {
  return {
    ...job,
    createdAt: safeTimestampToMillis(job.createdAt),
    updatedAt: safeTimestampToMillis(job.updatedAt),
    deadline: safeTimestampToMillis(job.deadline),
    lastViewedAt: safeTimestampToMillis(job.lastViewedAt),
    publicadoEm: safeTimestampToMillis(job.publicadoEm),
  };
}

export async function getServerSideProps(context) {
  const { admin } = await import('../../../lib/firebaseAdmin');
  try {
    const cookies = nookies.get(context);
    if (!cookies.token) {
      return redirectToLogin(context);
    }
    const token = await admin.auth().verifyIdToken(cookies.token);
    const { uid } = token;

    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return redirectToLogin(context);
    }
    const userData = userDoc.data();
    if (userData.userType !== 'empresa') {
      return { redirect: { destination: '/dashboard', permanent: false } };
    }

    const profile = {
      ...sanitizeFirestoreValue(userData),
      planEndDate: safeTimestampToMillis(userData.planEndDate),
      planStartDate: safeTimestampToMillis(userData.planStartDate),
      monthlyJobsResetDate: safeTimestampToMillis(
        userData.monthlyJobsResetDate,
      ),
      updatedAt: safeTimestampToMillis(userData.updatedAt),
      createdAt: safeTimestampToMillis(userData.createdAt),
    };
    const companyPlanFeatures = getEmpresaPlanFeatures(
      normalizeEmpresaPlanId(
        userData.planTierId || userData.currentPlan || userData.planId,
        userData.planName,
        userData,
      ),
      userData.planName,
      userData,
    );
    const publicViewerAccess = {
      canViewDetailedInfo: Boolean(companyPlanFeatures.accessTalentPool),
      canContactCandidate: Boolean(
        companyPlanFeatures.canViewCandidateContact ||
        companyPlanFeatures.canSendDirectMessages,
      ),
    };

    const [jobsSnapshot, appsSnap, plans, publicCandidatesData] =
      await Promise.all([
        admin
          .firestore()
          .collection('jobs')
          .where('companyId', '==', uid)
          .get(),
        admin
          .firestore()
          .collection('applications')
          .where('companyId', '==', uid)
          .get(),
        fetchActiveEmpresaPlans(admin),
        fetchVerifiedCandidates(admin, publicViewerAccess),
      ]);
    const jobs = jobsSnapshot.docs.map((doc) => {
      const data = sanitizeFirestoreValue(doc.data());
      const jobPayload = {
        id: doc.id,
        ...data,
      };
      return normalizeJobDates(jobPayload);
    });
    const appCounts = {};
    const recentApplications = [];

    appsSnap.forEach((doc) => {
      const data = doc.data();
      const jId = data.jobId;
      if (jId) {
        appCounts[jId] = (appCounts[jId] || 0) + 1;
      }
      const applicationData = {
        id: doc.id,
        jobId: data.jobId || null,
        companyId: data.companyId || null,
        candidateId: data.candidateId || null,
        candidateName: data.candidateName || null,
        candidateEmail: data.candidateEmail || null,
        jobTitle: data.jobTitle || null,
        company: data.company || null,
        status: data.status || 'pending',
        interviewDetails: data.interviewDetails
          ? {
              ...sanitizeFirestoreValue(data.interviewDetails),
              scheduledAt: safeTimestampToMillis(
                data.interviewDetails.scheduledAt,
              )
                ? new Date(
                    safeTimestampToMillis(data.interviewDetails.scheduledAt),
                  ).toISOString()
                : data.interviewDetails.scheduledAt || null,
              updatedAt: safeTimestampToMillis(data.interviewDetails.updatedAt)
                ? new Date(
                    safeTimestampToMillis(data.interviewDetails.updatedAt),
                  ).toISOString()
                : data.interviewDetails.updatedAt || null,
            }
          : null,
        statusNotes: data.statusNotes || null,
        jobLocation: data.jobLocation || null,
        jobType: data.jobType || null,
        coverLetter: data.coverLetter || '',
        priorityApplied: Boolean(data.priorityApplied),
        applicationHighlighted: Boolean(data.applicationHighlighted),
        priorityLevel: Number(data.priorityLevel) || 0,
        premiumOnlyJob: Boolean(data.premiumOnlyJob),
        accessedDuringEarlyWindow: Boolean(data.accessedDuringEarlyWindow),
        earlyAccessUntil: data.earlyAccessUntil || null,
        requireCoverLetter: Boolean(data.requireCoverLetter),
        compatibilityScore: Number.isFinite(Number(data.compatibilityScore))
          ? Number(data.compatibilityScore)
          : null,
        compatibilityReasons: Array.isArray(data.compatibilityReasons)
          ? data.compatibilityReasons
          : [],
        candidatePlanId: data.candidatePlanId || null,
        candidatePlanName: data.candidatePlanName || null,
        skillsAssessmentResult: data.skillsAssessmentResult || null,
      };
      const appliedAtValue = safeTimestampToMillis(
        data.appliedAt || data.createdAt,
      );
      applicationData.appliedAt = appliedAtValue
        ? new Date(appliedAtValue).toISOString()
        : null;
      const createdAtValue = safeTimestampToMillis(data.createdAt);
      applicationData.createdAt = createdAtValue
        ? new Date(createdAtValue).toISOString()
        : null;
      const updatedAtValue = safeTimestampToMillis(data.updatedAt);
      applicationData.updatedAt = updatedAtValue
        ? new Date(updatedAtValue).toISOString()
        : null;
      recentApplications.push(applicationData);
    });

    recentApplications.sort((a, b) => {
      const dateA = a.appliedAt ? new Date(a.appliedAt).getTime() : 0;
      const dateB = b.appliedAt ? new Date(b.appliedAt).getTime() : 0;
      return dateB - dateA;
    });

    const weeklyApplications = Array.from({ length: 6 }, (_, index) => {
      const now = new Date();
      const weeksAgo = 5 - index;
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - weeksAgo * 7 - start.getDay());
      const end = new Date(start);
      end.setDate(end.getDate() + 7);

      return {
        name: `S${index + 1}`,
        value: recentApplications.filter((application) => {
          if (!application.appliedAt) return false;
          const appliedAt = new Date(application.appliedAt);
          return (
            !Number.isNaN(appliedAt.getTime()) &&
            appliedAt >= start &&
            appliedAt < end
          );
        }).length,
      };
    });

    const jobsWithCounts = jobs.map((job) => ({
      ...job,
      applicationCount: appCounts[job.id] || 0,
    }));

    const stats = {
      totalApplications: appsSnap.size,
      pendingApplications: recentApplications.filter(
        (a) => a.status === 'pending' || !a.status,
      ).length,
      approvedApplications: recentApplications.filter(
        (a) => a.status === 'approved',
      ).length,
    };
    const publicCandidateSummary =
      summarizeVerifiedCandidates(publicCandidatesData);

    return {
      props: {
        profile,
        jobs: jobsWithCounts,
        totalApplications: appsSnap.size,
        recentApplications: recentApplications.slice(0, 10),
        stats,
        weeklyApplications,
        plans,
        publicCandidates: publicCandidatesData.slice(0, 6),
        publicCandidateSummary,
        verifiedCandidateIds: publicCandidatesData.map(
          (candidate) => candidate.id,
        ),
      },
    };
  } catch (error) {
    console.error('Erro no getServerSideProps:', error);
    return redirectToLogin(context);
  }
}
