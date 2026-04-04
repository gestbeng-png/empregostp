import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ResponsiveContainer, BarChart, Bar, XAxis, CartesianGrid, Tooltip, Cell, AreaChart, Area } from 'recharts';
import { useAuth } from '../../../context/AuthContext';
import EmpresaPlansCatalog from '../../../components/EmpresaPlansCatalog';
import styles from '../../../styles/EmpresaDashboard.module.css';
import nookies from 'nookies';
import { getEmpresaPlanFeatures, normalizeEmpresaPlanId } from '../../../lib/empresaPlanFeatures';
import { fetchActiveEmpresaPlans } from '../../../lib/empresaPlansCatalog';
import { getInterviewStatusLabelPt } from '../../../lib/interviewClient';

const MENU_ITEMS = [
  { id: 'dashboard', label: 'Visão Geral', icon: 'dashboard' },
  { id: 'jobs', label: 'Vagas', icon: 'briefcase' },
  { id: 'candidates', label: 'Banco Talentos', icon: 'users' },
  { id: 'applications', label: 'Candidaturas', icon: 'inbox' },
  { id: 'messages', label: 'Mensagens', icon: 'messages' },
  { id: 'analytics', label: 'Analytics', icon: 'chart' },
  { id: 'company-profile', label: 'Perfil Empresa', icon: 'building' },
  { id: 'plans', label: 'Planos', icon: 'crown' }
];

const formatInterviewDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const toDateTimeLocalValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60000);
  return localDate.toISOString().slice(0, 16);
};

const TIP_LIBRARY = {
  'Básico': [
    { title: 'Marca ativa, candidatos atentos', content: 'Amplie sua presença com conteúdos de bastidores e torne-se referência local.', category: 'BRANDING' },
    { title: 'Use testes de habilidades', content: 'Envie desafios curtos para separar candidatos engajados e reduzir entrevistas iniciais.', category: 'PROCESSO' },
    { title: 'Explore o banco limitado', content: 'Filtre talentos por localidades próximas e convide-os diretamente via mensagem.', category: 'TALENTOS' }
  ],
  'Profissional': [
    { title: 'Aposte em histórias reais', content: 'Compartilhe cases de sucesso no feed de vagas para despertar identificação.', category: 'MARCA' },
    { title: 'Automatize respostas', content: 'Use templates personalizados para informar candidatos sobre cada etapa.', category: 'PROCESSO' },
    { title: 'Monitore canais locais', content: 'Inclua critérios como língua e experiência com projetos do arquipélago.', category: 'TALENTOS' }
  ],
  PRO: [
    { title: 'Equipe em sincronia', content: 'Integre o painel com CRM e mantenha feedbacks dos líderes de negócio.', category: 'GESTÃO' },
    { title: 'Insights da IA', content: 'Analise os talentos que mais aplicam e direcione campanhas regionais.', category: 'INTELIGÊNCIA' },
    { title: 'Retenção de talentos', content: 'Ofereça trilhas rápidas de desenvolvimento para os contratados.', category: 'CULTURA' }
  ],
  default: [
    { title: 'Foque na experiência do candidato', content: 'Responda rápido e destaque benefícios claros para criar confiança.', category: 'CANDIDATO' }
  ]
};

const icons = {
  badge: (
    <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" fill="none">
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" strokeLinecap="round" strokeLinejoin="round" />
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
  )
};

const normalizePlan = (plan) => {
  const normalizedPlanId = normalizeEmpresaPlanId(plan);
  return getEmpresaPlanFeatures(normalizedPlanId).name || 'Básico';
};

const getHiringTips = (plan) => TIP_LIBRARY[plan] || TIP_LIBRARY.default;

const Sidebar = ({ activeTab, setActiveTab, currentPlan, profile, onLogout, pendingApplicationsCount = 0, unreadMessages = 0 }) => (
  <aside className={styles.sidebar}>
    <div className={styles.sidebarLogo}>
      <Link href="/" className={styles.sidebarLogoLink}>
        <img
          src="/assets/Emprego STP Logo (2) 1.png"
          alt="EmpregoSTP Logo"
          className={styles.sidebarLogoImg}
        />
      </Link>
    </div>


    <nav className={styles.sidebarNav}>
      <p className={styles.navSection}>Menu Principal</p>
      {MENU_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`${styles.navButton} ${activeTab === item.id ? styles.navActive : ''}`}
          onClick={() => setActiveTab(item.id)}
        >
          <span className={styles.navIcon}>{icons[item.icon]}</span>
          <span className={styles.navLabel}>{item.label}</span>
          {item.id === 'applications' && pendingApplicationsCount > 0 && (
            <span className={styles.navBadge}>{pendingApplicationsCount}</span>
          )}
          {item.id === 'messages' && unreadMessages > 0 && (
            <span className={styles.navBadge}>{unreadMessages}</span>
          )}
        </button>
      ))}
    </nav>

    <div className={styles.sidebarDivider} />

    <div className={styles.sidebarActions}>
      <Link href="/dashboard/empresa/vaga/criar-vaga" className={styles.createJobBtn}>
        <span className={styles.navIcon}>{icons.plus}</span>
        Criar Nova Vaga
      </Link>
      {onLogout && (
        <button 
          type="button" 
          className={`${styles.createJobBtn} ${styles.logoutBtn}`}
          onClick={onLogout}
        >
          <span className={styles.navIcon}>{icons.logout}</span>
          Sair
        </button>
      )}
    </div>

    <div className={styles.sidebarFooter}>
      <div className={styles.planCard}>
        <div className={styles.planCardHeader}>
          <span className={styles.planCardIcon}>{icons.crown}</span>
          <div>
            <p className={styles.planCardTitle}>Plano {currentPlan}</p>
            <p className={styles.planCardDesc}>
              {currentPlan === 'Básico' ? 'Recursos limitados' : currentPlan === 'Profissional' ? 'Mais alcance e automação' : 'Acesso completo'}
            </p>
          </div>
        </div>
        {currentPlan === 'Básico' && (
          <button type="button" className={styles.upgradeButton} onClick={() => setActiveTab('plans')}>
            Fazer Upgrade
          </button>
        )}
      </div>
    </div>
  </aside>
);

const TopBar = ({
  profile,
  activeLabel,
  notificationsCount,
  notifications = [],
  notificationsOpen = false,
  notificationsLoading = false,
  notificationsError = '',
  onToggleNotifications,
  onNotificationClick,
  onMarkAllNotificationsRead
}) => {
  const today = new Date();
  const formattedDate = today.toLocaleDateString('pt-PT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <header className={styles.topBar}>
      <div className={styles.topBarLeft}>
        <h1 className={styles.pageTitle}>{activeLabel}</h1>
        <p className={styles.pageDate}>{formattedDate}</p>
      </div>
      <div className={styles.topBarRight}>
        <div className={styles.searchBox}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.searchIcon}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" placeholder="Pesquisar..." className={styles.searchInput} />
        </div>
        <button
          type="button"
          className={styles.iconButton}
          onClick={onToggleNotifications}
          aria-expanded={notificationsOpen}
          aria-label="Notificações"
        >
          {icons.bell}
          {notificationsCount > 0 && <span className={styles.notificationDot}>{notificationsCount}</span>}
        </button>
        {notificationsOpen && (
          <div className={styles.notificationsPopover} role="dialog" aria-label="Notificações">
            <div className={styles.notificationsHeader}>
              <span>Notificações</span>
              <button
                type="button"
                className={styles.notificationsMarkAll}
                onClick={onMarkAllNotificationsRead}
                disabled={notificationsLoading || notificationsCount === 0}
              >
                Marcar todas
              </button>
            </div>
            {notificationsError ? (
              <div className={styles.notificationsEmpty}>Erro: {notificationsError}</div>
            ) : notificationsLoading ? (
              <div className={styles.notificationsEmpty}>Carregando...</div>
            ) : notifications.length === 0 ? (
              <div className={styles.notificationsEmpty}>Nenhuma notificação recente.</div>
            ) : (
              <div className={styles.notificationsList}>
                {notifications.slice(0, 10).map((notif) => (
                  <button
                    key={notif.id}
                    type="button"
                    className={`${styles.notificationItem} ${notif.read ? '' : styles.notificationItemUnread}`}
                    onClick={() => onNotificationClick?.(notif)}
                    title={notif.message || notif.title || 'Notificação'}
                  >
                    <span className={styles.notificationIcon}>{notif.icon || '🔔'}</span>
                    <div className={styles.notificationBody}>
                      <div className={styles.notificationTitleRow}>
                        <strong className={styles.notificationTitle}>{notif.title || 'Notificação'}</strong>
                        {!notif.read && <span className={styles.notificationUnreadDot} />}
                      </div>
                      {notif.message && <p className={styles.notificationMessage}>{notif.message}</p>}
                      <span className={styles.notificationTime}>
                        {notif.createdAt ? new Date(notif.createdAt).toLocaleString('pt-PT') : ''}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <Link href="/dashboard/empresa/profile" className={styles.iconButton}>
          {icons.building}
        </Link>
      </div>
    </header>
  );
};

const StatisticCard = ({ label, value, trend, icon, color = '#6366f1' }) => (
  <div className={styles.statCard}>
    <div className={styles.statHeader}>
      <div
        className={`${styles.statIcon} ${styles.statIconAccent}`}
        style={{ '--accent-bg': `${color}15`, '--accent-color': color }}
      >
        {icon || icons.badge}
      </div>
      <span className={styles.statTrend}>{trend}</span>
    </div>
    <p className={styles.statValue}>{value}</p>
    <p className={styles.statLabel}>{label}</p>
  </div>
);

const JobCard = ({ job }) => {
  const isActive = job.status === 'active';
  const daysLeft = job.dataFecho ? Math.ceil((new Date(job.dataFecho) - new Date()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <article className={styles.jobCard}>
      <div className={styles.jobCardHeader}>
        <h3 className={styles.jobTitle}>{job.titulo}</h3>
        <span className={`${styles.jobStatus} ${isActive ? styles.jobStatusActive : styles.jobStatusClosed}`}>
          {isActive ? 'Ativa' : 'Fechada'}
        </span>
      </div>
      <div className={styles.jobDetails}>
        <span className={styles.jobMeta}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.jobMetaIcon}>
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          {job.localizacao || 'Local não informado'}
        </span>
        <span className={styles.jobMeta}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.jobMetaIcon}>
            <rect x="2" y="7" width="20" height="14" rx="2" />
            <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
          </svg>
          {job.tipoContrato || 'Tipo não informado'}
        </span>
        {job.remoto && (
          <span className={styles.jobBadge}>Remoto</span>
        )}
      </div>
      <div className={styles.jobStats}>
        <div className={styles.jobStat}>
          <span className={styles.jobStatValue}>{job.applicationCount || 0}</span>
          <span className={styles.jobStatLabel}>Candidaturas</span>
        </div>
        <div className={styles.jobStat}>
          <span className={styles.jobStatValue}>{job.views || 0}</span>
          <span className={styles.jobStatLabel}>Visualizações</span>
        </div>
        {daysLeft !== null && isActive && (
          <div className={styles.jobStat}>
            <span className={`${styles.jobStatValue} ${daysLeft <= 3 ? styles.jobStatUrgent : ''}`}>
              {daysLeft > 0 ? daysLeft : 0}
            </span>
            <span className={styles.jobStatLabel}>Dias restantes</span>
          </div>
        )}
      </div>
      <div className={styles.jobFooter}>
        <Link href={`/dashboard/empresa/vaga/${job.id}`} className={styles.jobActions}>
          Ver detalhes
        </Link>
      </div>
    </article>
  );
};

const ApplicationCard = ({ application, onStatusUpdate, onOpenInterviewScheduler }) => {
  const [updating, setUpdating] = useState(false);

  const statusColors = {
    pending: { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)' },
    analysis: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa', border: 'rgba(59, 130, 246, 0.3)' },
    interview: { bg: 'rgba(139, 92, 246, 0.15)', text: '#a78bfa', border: 'rgba(139, 92, 246, 0.3)' },
    approved: { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', border: 'rgba(16, 185, 129, 0.3)' },
    rejected: { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', border: 'rgba(239, 68, 68, 0.3)' }
  };

  const statusLabels = {
    pending: 'Pendente',
    analysis: 'Em Analise',
    interview: 'Entrevista',
    approved: 'Aprovado',
    rejected: 'Rejeitado'
  };

  const status = application.status || 'pending';
  const colors = statusColors[status] || statusColors.pending;
  const statusLabel = statusLabels[status] || 'Pendente';
  const interviewStatus = String(application.interviewDetails?.status || 'scheduled').toLowerCase();
  const interviewStatusLabel = getInterviewStatusLabelPt(interviewStatus);
  const showRescheduleReason =
    interviewStatus === 'reschedule_requested' && String(application.interviewDetails?.rescheduleReason || '').trim();

  const handleStatusUpdate = async (newStatus) => {
    if (updating) return;
    setUpdating(true);

    try {
      const { getAuth } = await import('firebase/auth');
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();

      if (!token) {
        alert('Sessao expirada. Por favor, faca login novamente.');
        return;
      }

      const response = await fetch(`/api/applications/${application.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      const data = await response.json();

      if (response.ok) {
        if (onStatusUpdate) {
          onStatusUpdate(application.id, data.application || { status: newStatus });
        }
      } else {
        alert(data.error || 'Erro ao atualizar status');
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert('Erro ao atualizar status. Tente novamente.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <article className={styles.applicationCard}>
      <div className={styles.applicationHeader}>
        <div className={styles.applicationInfo}>
          <Link href={`/dashboard/empresa/candidato/${application.candidateId}`} className={styles.applicationTitle}>
            {application.candidateName || 'Candidato'}
          </Link>
          <p className={styles.applicationMeta}>{application.jobTitle || 'Vaga desconhecida'}</p>
          <p className={styles.applicationMeta}>{application.candidateEmail || ''}</p>
        </div>
        <div className={styles.applicationRight}>
          <span
            className={`${styles.applicationStatus} ${styles.applicationStatusAccent}`}
            style={{
              '--status-bg': colors.bg,
              '--status-text': colors.text,
              '--status-border': colors.border
            }}
          >
            {updating ? 'Atualizando...' : statusLabel}
          </span>
          <span className={styles.applicationDate}>
            {new Date(application.appliedAt || application.createdAt || Date.now()).toLocaleDateString('pt-PT')}
          </span>
        </div>
      </div>

      {application.interviewDetails?.scheduledAt && (
        <div className={styles.interviewSummaryBox}>
          <strong>Entrevista agendada</strong>
          <p>{formatInterviewDateTime(application.interviewDetails.scheduledAt)}</p>
          <span>
            {application.interviewDetails.mode === 'presencial'
              ? application.interviewDetails.location || 'Local a confirmar'
              : application.interviewDetails.link || 'Link a confirmar'}
          </span>
          <p className={styles.interviewSummaryResponse}>
            Resposta do candidato: <strong className={styles.interviewStatusHighlight}>{interviewStatusLabel}</strong>
          </p>
          {showRescheduleReason && (
            <p className={styles.interviewReason}>
              Motivo: {String(application.interviewDetails.rescheduleReason || '').trim()}
            </p>
          )}
        </div>
      )}

      {/* Status Action Buttons */}
      <div className={styles.applicationStatusActions}>
        <span className={styles.statusActionsLabel}>Alterar status:</span>
        <div className={styles.statusButtonsGroup}>
          <button
            type="button"
            className={`${styles.statusBtn} ${styles.statusBtnAnalysis} ${status === 'analysis' ? styles.statusBtnActive : ''}`}
            onClick={() => handleStatusUpdate('analysis')}
            disabled={updating || status === 'analysis'}
            title="Enviar para analise"
          >
            {icons.eye}
            <span>Analise</span>
          </button>
          <button
            type="button"
            className={`${styles.statusBtn} ${styles.statusBtnInterview} ${status === 'interview' ? styles.statusBtnActive : ''}`}
            onClick={() => onOpenInterviewScheduler?.(application)}
            disabled={updating}
            title="Marcar entrevista"
          >
            {icons.users}
            <span>{status === 'interview' ? 'Reagendar' : 'Entrevista'}</span>
          </button>
          <button
            type="button"
            className={`${styles.statusBtn} ${styles.statusBtnApproved} ${status === 'approved' ? styles.statusBtnActive : ''}`}
            onClick={() => handleStatusUpdate('approved')}
            disabled={updating || status === 'approved'}
            title="Aceitar candidato"
          >
            {icons.check}
            <span>Aceitar</span>
          </button>
          <button
            type="button"
            className={`${styles.statusBtn} ${styles.statusBtnRejected} ${status === 'rejected' ? styles.statusBtnActive : ''}`}
            onClick={() => handleStatusUpdate('rejected')}
            disabled={updating || status === 'rejected'}
            title="Rejeitar candidato"
          >
            {icons.x}
            <span>Rejeitar</span>
          </button>
        </div>
      </div>

      <div className={styles.applicationActions}>
        <Link href={`/dashboard/empresa/candidato/${application.candidateId}`} className={styles.applicationBtn}>
          Ver Perfil Completo
        </Link>
        {application.candidateId && (
          <Link href={`/dashboard/empresa?tab=messages&candidate=${application.candidateId}`} className={styles.applicationBtnOutline}>
            Enviar mensagem
          </Link>
        )}
        {application.jobId && (
          <Link href={`/dashboard/empresa/vaga/${application.jobId}`} className={styles.applicationBtnOutline}>
            Ver Vaga
          </Link>
        )}
      </div>
    </article>
  );
};

const TalentCard = ({ talent, locked }) => {
  return (
    <article className={`${styles.talentCard} ${locked ? styles.talentLocked : ''}`}>
      <div className={styles.talentAvatar}>
        {talent.avatar ? (
          <img src={talent.avatar} alt={talent.name} />
        ) : (
          <div className={styles.talentAvatarFallback}>
            {(talent.name || '?').slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
      <div>
        <h4>{talent.name}</h4>
        <p className={styles.talentSubtitle}>{talent.headline}</p>
        <p className={styles.talentMeta}>{talent.location} • {talent.experience}</p>
        <div className={styles.talentSkills}>
          {talent.skills.map((skill) => (<span key={skill}>{skill}</span>))}
        </div>
      </div>
      {locked ? (
        <button type="button" className={styles.talentAction} disabled>
          Plano PRO necessário
        </button>
      ) : (
        <Link href={talent.profileUrl || '#'} className={styles.talentAction}>
          Ver perfil
        </Link>
      )}
    </article>
  );
};

const AnalyticsCard = ({ title, value, subtitle, color, icon, change }) => (
  <div className={styles.analyticsCard}>
    <div className={styles.analyticsCardHeader}>
      <div
        className={`${styles.analyticsCardIcon} ${styles.analyticsCardIconAccent}`}
        style={{ '--accent-bg': `${color}15`, '--accent-color': color }}
      >
        {icon}
      </div>
      {change !== undefined && (
        <span className={`${styles.analyticsChange} ${change >= 0 ? styles.analyticsChangeUp : styles.analyticsChangeDown}`}>
          {change >= 0 ? '+' : ''}{change}%
        </span>
      )}
    </div>
    <p className={styles.analyticsValue}>{value}</p>
    <p className={styles.analyticsTitle}>{title}</p>
    <p className={styles.analyticsSubtitle}>{subtitle}</p>
  </div>
);

const EmptyState = ({ icon, title, message, action }) => (
  <div className={styles.emptyState}>
    <div className={styles.emptyIcon}>{icon || icons.inbox}</div>
    <h3>{title}</h3>
    <p>{message}</p>
    {action && <div className={styles.emptyAction}>{action}</div>}
  </div>
);

export default function EmpresaDashboard({ profile, jobs, totalApplications, recentApplications, stats, plans = [] }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('dashboard');
  const normalizedCompanyPlanId = useMemo(
    () =>
      normalizeEmpresaPlanId(
        profile.planTierId || profile.currentPlan || profile.planId,
        profile.planName,
        profile
      ),
    [profile]
  );
  const [planState, setPlanState] = useState(normalizePlan(normalizedCompanyPlanId));
  const [hiringTips, setHiringTips] = useState(getHiringTips(planState));
  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [analyticsError, setAnalyticsError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [applicationFilter, setApplicationFilter] = useState('all');
  const [jobFilter, setJobFilter] = useState('all');
  const [applicationsData, setApplicationsData] = useState(recentApplications);
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
  const [interviewModal, setInterviewModal] = useState({ open: false, application: null });
  const [interviewForm, setInterviewForm] = useState({
    interviewDate: '',
    interviewMode: 'online',
    interviewLocation: '',
    interviewLink: '',
    interviewNotes: ''
  });
  const [interviewSubmitting, setInterviewSubmitting] = useState(false);
  const [interviewError, setInterviewError] = useState('');
  const messagesEndRef = useRef(null);
  const lastOpenedCandidateRef = useRef(null);
  const companyPlanFeatures = useMemo(
    () => getEmpresaPlanFeatures(normalizedCompanyPlanId, profile.planName, profile),
    [normalizedCompanyPlanId, profile]
  );
  const highlightedJobsCount = useMemo(
    () => jobs.filter((job) => job.destaque === true || job.featured === true || job.isFeatured === true).length,
    [jobs]
  );
  const unreadMessages = useMemo(
    () => conversations.reduce((sum, conversation) => sum + (conversation.unreadCount || 0), 0),
    [conversations]
  );
  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications]
  );

  const fetchPendingPaymentRequest = useCallback(async () => {
    if (!user) return;
    try {
      const { getAuth } = await import('firebase/auth');
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const response = await fetch('/api/subscription-requests/current', {
        headers: { Authorization: `Bearer ${token}` }
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
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Erro ao buscar notificações');
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
    } catch (error) {
      setNotificationsError(error?.message || 'Erro ao buscar notificações');
    } finally {
      setNotificationsLoading(false);
    }
  }, [user]);

  const markNotificationRead = useCallback(async (notificationId) => {
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
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ notificationId })
      });
      if (response.ok) {
        setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)));
      }
    } catch (error) {
      // best effort
    }
  }, [user]);

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
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ markAll: true })
      });
      if (response.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      }
    } catch (error) {
      // best effort
    }
  }, [user]);

  const handleNotificationClick = useCallback(async (notif) => {
    if (!notif) return;
    if (!notif.read && notif.id) {
      await markNotificationRead(notif.id);
    }
    // Bring the company back to applications list for interview-related notifications.
    if (notif.type === 'interview_response' || notif.type === 'application') {
      setActiveTab('applications');
    }
    setNotificationsOpen(false);
  }, [markNotificationRead]);

  useEffect(() => {
    fetchPendingPaymentRequest();
  }, [fetchPendingPaymentRequest]);

  useEffect(() => {
    if (!router.isReady) return;
    const requestedTab = typeof router.query.tab === 'string' ? router.query.tab : '';
    if (requestedTab && MENU_ITEMS.some((item) => item.id === requestedTab) && requestedTab !== activeTab) {
      setActiveTab(requestedTab);
    }
  }, [router.isReady, router.query.tab, activeTab]);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    const intervalId = setInterval(fetchNotifications, 30000);
    return () => clearInterval(intervalId);
  }, [user, fetchNotifications]);

  const handleApplicationStatusUpdate = (applicationId, updates) => {
    setApplicationsData(prev =>
      prev.map(app =>
        app.id === applicationId ? { ...app, ...(typeof updates === 'string' ? { status: updates } : updates) } : app
      )
    );
  };

  const openInterviewScheduler = (application) => {
    const currentInterview = application?.interviewDetails || {};
    setInterviewForm({
      interviewDate: toDateTimeLocalValue(currentInterview.scheduledAt),
      interviewMode: currentInterview.mode || 'online',
      interviewLocation: currentInterview.location || '',
      interviewLink: currentInterview.link || '',
      interviewNotes: currentInterview.notes || ''
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

      const response = await fetch(`/api/applications/${interviewModal.application.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status: 'interview',
          interviewDate: interviewForm.interviewDate,
          interviewMode: interviewForm.interviewMode,
          interviewLocation: interviewForm.interviewLocation,
          interviewLink: interviewForm.interviewLink,
          interviewNotes: interviewForm.interviewNotes
        })
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setInterviewError(data.upgradeMessage || data.error || 'Não foi possível agendar a entrevista.');
        return;
      }

      handleApplicationStatusUpdate(interviewModal.application.id, data.application || {
        status: 'interview',
        interviewDetails: {
          scheduledAt: interviewForm.interviewDate,
          mode: interviewForm.interviewMode,
          location: interviewForm.interviewLocation,
          link: interviewForm.interviewLink,
          notes: interviewForm.interviewNotes
        }
      });
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
        router.push('/login');
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
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessagesError(data.error || 'Não foi possível carregar as conversas.');
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
    return () => window.removeEventListener('app-notification-received', handleRealtimeEvent);
  }, [fetchNotifications, fetchConversations]);

  const createOrOpenConversation = useCallback(async (participantId) => {
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
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ participantId })
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        alert(data.upgradeMessage || data.error || 'Não foi possível abrir a conversa.');
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
  }, [router]);

  const activeJobs = useMemo(() => jobs.filter((job) => job.status === 'active'), [jobs]);

  useEffect(() => {
    setPlanState(normalizePlan(normalizedCompanyPlanId));
  }, [normalizedCompanyPlanId]);

  useEffect(() => {
    setHiringTips(getHiringTips(planState));
  }, [planState]);

  useEffect(() => {
    if (activeTab !== 'messages') return;
    fetchConversations();
  }, [activeTab, fetchConversations]);

  useEffect(() => {
    if (activeTab !== 'messages') return undefined;

    const intervalId = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      fetchConversations({ silent: true });
    }, 12000);

    return () => clearInterval(intervalId);
  }, [activeTab, fetchConversations]);

  useEffect(() => {
    if (activeTab !== 'messages' || !router.isReady) return;
    const candidateId = typeof router.query.candidate === 'string' ? router.query.candidate : '';
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
      router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true });
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
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          if (!silent) {
            setMessagesError(data.error || 'Não foi possível carregar as mensagens.');
          }
          return;
        }

        setMessages(data.messages || []);
        setConversations((prev) =>
          prev.map((conversation) =>
            conversation.id === selectedConversation
              ? { ...conversation, unreadCount: 0 }
              : conversation
          )
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
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      fetchMessages({ silent: true });
    }, 5000);

    return () => clearInterval(intervalId);
  }, [activeTab, selectedConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (activeTab !== 'analytics' || !user || !companyPlanFeatures.canAccessAnalytics) return;
      setLoadingAnalytics(true);
      setAnalyticsError('');
      try {
        const { getAuth } = await import('firebase/auth');
        const auth = getAuth();
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;
        const response = await fetch('/api/analytics', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok) {
          setAnalytics(null);
          setAnalyticsError(data.error || 'Não foi possível carregar analytics');
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
      if (activeTab !== 'candidates' || !user || !companyPlanFeatures.accessTalentPool) return;
      setLoadingTalentPool(true);
      setTalentPoolError('');
      try {
        const { getAuth } = await import('firebase/auth');
        const auth = getAuth();
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;

        const response = await fetch('/api/talent-pool?limit=30', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok) {
          setTalentPoolData([]);
          setTalentPoolError(data.error || 'Não foi possível carregar o banco de talentos');
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
          experience: candidate.availableForWork ? 'Disponível para trabalho' : 'Perfil ativo',
          location: candidate.location || 'São Tomé e Príncipe',
          avatar: candidate.photoUrl || '',
          profileUrl: `/dashboard/empresa/candidato/${candidate.id}`
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

  const statsList = useMemo(() => [
    { label: 'Vagas Ativas', value: activeJobs.length, trend: `+${jobs.length} total`, icon: icons.briefcase, color: '#6366f1' },
    { label: 'Candidaturas', value: totalApplications, trend: `${stats?.pendingApplications || 0} novas`, icon: icons.inbox, color: '#10b981' },
    {
      label: 'Vagas Destacadas',
      value: highlightedJobsCount,
      trend: !companyPlanFeatures.canHighlightJobs
        ? 'Upgrade para destacar vagas'
        : companyPlanFeatures.maxHighlightedJobs === null
          ? 'Plano com destaques ilimitados'
          : `${highlightedJobsCount}/${companyPlanFeatures.maxHighlightedJobs || 0} utilizadas`,
      icon: icons.crown,
      color: '#f59e0b'
    },
    { label: 'Taxa Conversão', value: `${totalApplications > 0 ? ((totalApplications / Math.max(jobs.reduce((sum, job) => sum + (job.views || 0), 0), 1)) * 100).toFixed(1) : 0}%`, trend: 'Apps/Views', icon: icons.trending, color: '#ec4899' }
  ], [activeJobs.length, jobs, totalApplications, stats, highlightedJobsCount, companyPlanFeatures.canHighlightJobs, companyPlanFeatures.maxHighlightedJobs]);

  const chartData = useMemo(() => {
    const dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const counts = {};
    recentApplications.forEach((app) => {
      const date = app.appliedAt ? new Date(app.appliedAt) : new Date();
      const key = date.getDay();
      counts[key] = (counts[key] || 0) + 1;
    });
    return dayLabels.map((day, index) => ({ name: day, value: counts[index] || 0 }));
  }, [recentApplications]);

  const fallbackTalentPool = useMemo(() => {
    const byCandidate = new Map();
    applicationsData.forEach((application) => {
      if (!application.candidateId || byCandidate.has(application.candidateId)) return;
      byCandidate.set(application.candidateId, {
        id: application.candidateId,
        name: application.candidateName || 'Candidato',
        headline: application.jobTitle ? `Interessado em ${application.jobTitle}` : 'Perfil disponível',
        skills: [],
        experience: application.status === 'interview' ? 'Em entrevista' : 'Perfil ativo',
        location: application.jobLocation || 'São Tomé e Príncipe',
        avatar: '',
        profileUrl: `/dashboard/empresa/candidato/${application.candidateId}`
      });
    });
    return Array.from(byCandidate.values());
  }, [applicationsData]);

  const talentPool = useMemo(() => {
    if (companyPlanFeatures.accessTalentPool) {
      return talentPoolData;
    }
    return fallbackTalentPool;
  }, [companyPlanFeatures.accessTalentPool, talentPoolData, fallbackTalentPool]);

  const filteredTalents = useMemo(() => talentPool.filter((talent) => {
    return talent.name.toLowerCase().includes(searchQuery.toLowerCase()) || talent.headline.toLowerCase().includes(searchQuery.toLowerCase());
  }), [searchQuery, talentPool]);

  const filteredApplications = useMemo(() => {
    return applicationsData.filter(app => {
      if (applicationFilter === 'all') return true;
      if (applicationFilter === 'pending') return !app.status || app.status === 'pending';
      return app.status === applicationFilter;
    });
  }, [applicationsData, applicationFilter]);

  const filteredJobs = useMemo(() => {
    if (jobFilter === 'all') return jobs;
    return jobs.filter(job => job.status === jobFilter);
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
        router.push('/login');
        return;
      }

      const response = await fetch('/api/subscribe-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ planId })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPlanError(data.message || data.error || 'Não foi possível processar o plano.');
        return;
      }

      if (data.status === 'approved') {
        router.replace(router.asPath);
        return;
      }

      if (data.status === 'awaiting_payment') {
        setPlanPaymentInstructions(data.paymentInstructions || null);
        setPendingPaymentRequest({
          id: data.requestId,
          planId,
          planName: plans.find((plan) => plan.id === planId)?.name || planId,
          price: plans.find((plan) => plan.id === planId)?.price || 0,
          status: 'pending',
          paymentInstructions: data.paymentInstructions || null
        });
      }
    } catch (error) {
      console.error('Erro ao assinar plano:', error);
      setPlanError('Não foi possível processar o plano.');
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
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        alert(errorData.upgradeMessage || errorData.error || 'Não foi possível exportar as candidaturas.');
        return;
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('content-disposition') || '';
      const match = contentDisposition.match(/filename="(.+)"/);
      const filename = match?.[1] || `candidaturas_${new Date().toISOString().slice(0, 10)}.csv`;

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
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ text })
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessageInput(text);
        alert(data.upgradeMessage || data.error || 'Não foi possível enviar a mensagem.');
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
          createdAt: new Date().toISOString()
        }
      ]);
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === selectedConversation
            ? {
              ...conversation,
              lastMessage: text.substring(0, 100),
              lastMessageAt: new Date().toISOString()
            }
            : conversation
        )
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
      case 'dashboard':
        return (
          <section className={styles.sectionBlock}>
            <div className={styles.statsGrid}>
              {statsList.map((stat) => (
                <StatisticCard key={stat.label} {...stat} />
              ))}
            </div>
            <div className={styles.dashboardGrid}>
              <div className={styles.chartCard}>
                <div className={styles.chartTitle}>
                  <span>Fluxo de Candidaturas</span>
                  <small>Ultimos 7 dias</small>
                </div>
                <div className={styles.chartWrapper}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" stroke="#52525b" axisLine={false} tickLine={false} fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#18181b',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '10px',
                          boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
                        }}
                        labelStyle={{ color: '#fff', fontWeight: 600 }}
                        itemStyle={{ color: '#a5b4fc' }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#6366f1"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorValue)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className={styles.tipsCard}>
                <div className={styles.tipsHeader}>
                  <span>Insights de Recrutamento</span>
                  <small>Baseado no seu plano</small>
                </div>
                <div className={styles.tipsList}>
                  {hiringTips.map((tip) => (
                    <div key={tip.title} className={styles.tipItem}>
                      <p className={styles.tipCategory}>{tip.category}</p>
                      <h4>{tip.title}</h4>
                      <p>{tip.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        );
      case 'jobs':
        return (
          <section className={styles.sectionBlock}>
            <div className={styles.sectionHeading}>
              <div>
                <h2>Vagas Publicadas</h2>
                <p>{activeJobs.length} ativas de {jobs.length} total</p>
              </div>
              <div className={styles.sectionActions}>
                <div className={styles.filterTabs}>
                  <button
                    type="button"
                    className={`${styles.filterTab} ${jobFilter === 'all' ? styles.filterTabActive : ''}`}
                    onClick={() => setJobFilter('all')}
                  >Todas</button>
                  <button
                    type="button"
                    className={`${styles.filterTab} ${jobFilter === 'active' ? styles.filterTabActive : ''}`}
                    onClick={() => setJobFilter('active')}
                  >Ativas</button>
                  <button
                    type="button"
                    className={`${styles.filterTab} ${jobFilter === 'closed' ? styles.filterTabActive : ''}`}
                    onClick={() => setJobFilter('closed')}
                  >Fechadas</button>
                </div>
                <Link href="/dashboard/empresa/vaga/criar-vaga" className={styles.createJobBtn}>
                  <span className={styles.navIcon}>{icons.plus}</span>
                  Nova Vaga
                </Link>
              </div>
            </div>
            <div className={styles.jobsGrid}>
              {filteredJobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
              {!filteredJobs.length && jobs.length > 0 && (
                <EmptyState
                  icon={icons.briefcase}
                  title="Nenhuma vaga encontrada"
                  message="Altere o filtro para ver outras vagas"
                />
              )}
              {!jobs.length && (
                <EmptyState
                  icon={icons.briefcase}
                  title="Nenhuma vaga criada"
                  message="Publique sua primeira vaga para comecar a receber candidaturas"
                  action={<Link href="/dashboard/empresa/vaga/criar-vaga" className={styles.actionLink}>Criar primeira vaga</Link>}
                />
              )}
            </div>
          </section>
        );
      case 'candidates':
        return (
          <section className={`${styles.sectionBlock} ${styles.candidatesSection}`}>
            <div className={styles.candidatesToolbar}>
              <input
                type="text"
                placeholder="Buscar talentos por nome ou habilidade"
                className={styles.searchInput}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              <span className={styles.searchHint}>{filteredTalents.length} talentos encontrados</span>
            </div>
            {!companyPlanFeatures.accessTalentPool && (
              <div className={`${styles.sectionNote} ${styles.sectionNoteWarning}`}>
                Plano Básico: visualização limitada aos candidatos que já se candidataram às suas vagas.
                {' '}
                <Link href="/premium/empresa" className={styles.actionLink}>Desbloquear banco completo</Link>
              </div>
            )}
            {companyPlanFeatures.accessTalentPool && loadingTalentPool && (
              <p className={styles.sectionNote}>A carregar banco de talentos...</p>
            )}
            {companyPlanFeatures.accessTalentPool && talentPoolError && (
              <p className={`${styles.sectionNote} ${styles.sectionNoteError}`}>{talentPoolError}</p>
            )}
            <div className={styles.talentsGrid}>
              {filteredTalents.map((talent, index) => (
                <TalentCard
                  key={talent.id}
                  talent={talent}
                  locked={!companyPlanFeatures.accessTalentPool && index >= 3}
                />
              ))}
            </div>
            {!filteredTalents.length && (
              <EmptyState
                icon={icons.users}
                title="Nenhum talento disponível"
                message="Os perfis de candidatos aparecerão aqui assim que receber candidaturas"
              />
            )}
          </section>
        );
      case 'applications':
        const pendingCount = applicationsData.filter(a => !a.status || a.status === 'pending').length;
        const analysisCount = applicationsData.filter(a => a.status === 'analysis').length;
        const interviewCount = applicationsData.filter(a => a.status === 'interview').length;
        const approvedCount = applicationsData.filter(a => a.status === 'approved').length;
        const rejectedCount = applicationsData.filter(a => a.status === 'rejected').length;

        return (
          <section className={styles.sectionBlock}>
            <div className={styles.sectionHeading}>
              <div>
                <h2>Gestao de Candidaturas</h2>
                <p>{applicationsData.length} total | {pendingCount} pendentes | {interviewCount} em entrevista</p>
              </div>
              <button
                type="button"
                onClick={handleExportApplications}
                disabled={exportingCsv}
                className={`${styles.applicationBtnOutline} ${styles.buttonWide}`}
              >
                {exportingCsv ? 'A exportar...' : 'Exportar CSV'}
              </button>
            </div>

            {/* Status Summary Cards */}
            <div className={styles.applicationSummary}>
              <button
                type="button"
                className={`${styles.summaryCard} ${applicationFilter === 'all' ? styles.summaryCardActive : ''}`}
                onClick={() => setApplicationFilter('all')}
              >
                <span className={styles.summaryValue}>{applicationsData.length}</span>
                <span className={styles.summaryLabel}>Todas</span>
              </button>
              <button
                type="button"
                className={`${styles.summaryCard} ${styles.summaryPending} ${applicationFilter === 'pending' ? styles.summaryCardActive : ''}`}
                onClick={() => setApplicationFilter('pending')}
              >
                <span className={styles.summaryValue}>{pendingCount}</span>
                <span className={styles.summaryLabel}>Pendentes</span>
              </button>
              <button
                type="button"
                className={`${styles.summaryCard} ${styles.summaryAnalysis} ${applicationFilter === 'analysis' ? styles.summaryCardActive : ''}`}
                onClick={() => setApplicationFilter('analysis')}
              >
                <span className={styles.summaryValue}>{analysisCount}</span>
                <span className={styles.summaryLabel}>Em Analise</span>
              </button>
              <button
                type="button"
                className={`${styles.summaryCard} ${styles.summaryInterview} ${applicationFilter === 'interview' ? styles.summaryCardActive : ''}`}
                onClick={() => setApplicationFilter('interview')}
              >
                <span className={styles.summaryValue}>{interviewCount}</span>
                <span className={styles.summaryLabel}>Entrevista</span>
              </button>
              <button
                type="button"
                className={`${styles.summaryCard} ${styles.summaryApproved} ${applicationFilter === 'approved' ? styles.summaryCardActive : ''}`}
                onClick={() => setApplicationFilter('approved')}
              >
                <span className={styles.summaryValue}>{approvedCount}</span>
                <span className={styles.summaryLabel}>Aprovados</span>
              </button>
              <button
                type="button"
                className={`${styles.summaryCard} ${styles.summaryRejected} ${applicationFilter === 'rejected' ? styles.summaryCardActive : ''}`}
                onClick={() => setApplicationFilter('rejected')}
              >
                <span className={styles.summaryValue}>{rejectedCount}</span>
                <span className={styles.summaryLabel}>Rejeitados</span>
              </button>
            </div>

            <div className={styles.applicationsList}>
              {filteredApplications.length > 0 ? (
                filteredApplications.map((application) => (
                  <ApplicationCard
                    key={application.id}
                    application={application}
                    onStatusUpdate={handleApplicationStatusUpdate}
                    onOpenInterviewScheduler={openInterviewScheduler}
                  />
                ))
              ) : applicationsData.length > 0 ? (
                <EmptyState
                  icon={icons.inbox}
                  title="Nenhuma candidatura neste filtro"
                  message="Altere o filtro para ver outras candidaturas"
                />
              ) : (
                <EmptyState
                  icon={icons.users}
                  title="Nenhuma candidatura registrada"
                  message="As candidaturas aparecerao conforme os talentos se inscreverem nas suas vagas"
                />
              )}
            </div>
          </section>
        );
      case 'messages':
        const activeConversation = conversations.find((conversation) => conversation.id === selectedConversation);

        return (
          <section className={styles.sectionBlock}>
            <div className={styles.sectionHeading}>
              <div>
                <h2>Mensagens</h2>
                <p>Converse diretamente com candidatos elegíveis ao seu plano</p>
              </div>
              {companyPlanFeatures.canSendDirectMessages ? (
                <span className={styles.filterTab}>
                  {unreadMessages > 0 ? `${unreadMessages} não lida(s)` : 'Caixa organizada'}
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
                action={<Link href="/premium/empresa" className={styles.actionLink}>Ver planos</Link>}
              />
            ) : (
              <div className={styles.messagesLayout}>
                <div className={styles.messagesList}>
                  {loadingConversations ? (
                    <p className={`${styles.messagePlaceholder} ${styles.messagePlaceholderPadded}`}>A carregar conversas...</p>
                  ) : messagesError ? (
                    <p className={`${styles.messagePlaceholder} ${styles.messagePlaceholderPadded}`}>{messagesError}</p>
                  ) : conversations.length === 0 ? (
                    <p className={`${styles.messagePlaceholder} ${styles.messagePlaceholderPadded}`}>Nenhuma conversa ainda. Abra um perfil de candidato para iniciar.</p>
                  ) : conversations.map((conversation) => {
                    const initials = (conversation.participant.name || 'U').charAt(0).toUpperCase();
                    const timeLabel = conversation.lastMessageAt
                      ? new Date(conversation.lastMessageAt).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })
                      : '';

                    return (
                      <button
                        key={conversation.id}
                        type="button"
                        className={`${styles.messageItem} ${selectedConversation === conversation.id ? styles.selectedMessageItem : ''}`}
                        onClick={() => setSelectedConversation(conversation.id)}
                      >
                        <div className={styles.messageAvatarWrapper}>
                          {conversation.participant.avatar ? (
                            <img src={conversation.participant.avatar} alt={conversation.participant.name} />
                          ) : (
                            <div className={styles.messageAvatarInitials}>{initials}</div>
                          )}
                          {conversation.unreadCount > 0 && (
                            <span className={styles.messageBadge}>{conversation.unreadCount}</span>
                          )}
                        </div>
                        <div className={styles.messageBody}>
                          <strong>{conversation.participant.name}</strong>
                          <p>{conversation.lastMessage || 'Sem mensagens'}</p>
                        </div>
                        <span className={styles.messageTime}>{timeLabel}</span>
                      </button>
                    );
                  })}
                </div>

                <div className={styles.messageDetail}>
                  {activeConversation ? (
                    <>
                      <div className={styles.messageDetailHeader}>
                        <h3>{activeConversation.participant.name}</h3>
                        {activeConversation.participant.role && (
                          <p className={styles.pageDate}>{activeConversation.participant.role}</p>
                        )}
                      </div>
                      <div className={styles.messageThread}>
                        {loadingMessages ? (
                          <p className={styles.messagePlaceholder}>A carregar mensagens...</p>
                        ) : messages.length === 0 ? (
                          <p className={styles.messagePlaceholder}>Ainda não há mensagens. Seja o primeiro a escrever.</p>
                        ) : messages.map((message) => {
                          const isOwn = message.senderId === user?.uid;
                          return (
                            <div key={message.id} className={isOwn ? styles.messageBubbleOwn : styles.messageBubble}>
                              <span>{message.text}</span>
                              <time className={styles.messageBubbleTime}>
                                {message.createdAt
                                  ? new Date(message.createdAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
                                  : ''}
                              </time>
                            </div>
                          );
                        })}
                        <div ref={messagesEndRef} />
                      </div>
                      <div className={styles.messageFooter}>
                        <input
                          type="text"
                          value={messageInput}
                          onChange={(event) => setMessageInput(event.target.value)}
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
      case 'analytics':
        if (!companyPlanFeatures.canAccessAnalytics) {
          return (
            <section className={styles.sectionBlock}>
              <EmptyState
                icon={icons.chart}
                title="Analytics disponível apenas no plano PRO"
                message="Faça upgrade para o plano PRO para desbloquear métricas completas, tendências e ranking de performance das vagas."
                action={<Link href="/premium/empresa" className={styles.actionLink}>Ver planos</Link>}
              />
            </section>
          );
        }

        const totalViews = analytics?.totalViews || jobs.reduce((sum, job) => sum + (job.views || 0), 0);
        const conversionRate = totalViews > 0 ? ((totalApplications / totalViews) * 100) : 0;
        const avgAppsPerJob = jobs.length > 0 ? Math.round(totalApplications / jobs.length) : 0;
        const avgViewsPerJob = jobs.length > 0 ? Math.round(totalViews / jobs.length) : 0;
        const lastSevenDays = Array.from({ length: 7 }, (_, index) => {
          const date = new Date();
          date.setDate(date.getDate() - (6 - index));
          return date;
        });

        const viewsByDate = {};
        (analytics?.viewsTimeline || []).forEach((entry) => {
          if (entry?.date) {
            viewsByDate[entry.date] = entry.count || 0;
          }
        });

        const appsByDate = {};
        applicationsData.forEach((application) => {
          const dateValue = application.appliedAt || application.createdAt;
          if (!dateValue) return;
          const key = new Date(dateValue).toISOString().slice(0, 10);
          appsByDate[key] = (appsByDate[key] || 0) + 1;
        });

        const weeklyData = lastSevenDays.map((date) => {
          const key = date.toISOString().slice(0, 10);
          return {
            name: date.toLocaleDateString('pt-PT', { weekday: 'short' }),
            views: viewsByDate[key] || 0,
            apps: appsByDate[key] || 0
          };
        });

        const statusBuckets = [
          { name: 'Pendentes', value: applicationsData.filter((app) => !app.status || app.status === 'pending').length, color: '#f59e0b' },
          { name: 'Em análise', value: applicationsData.filter((app) => app.status === 'analysis').length, color: '#6366f1' },
          { name: 'Entrevista', value: applicationsData.filter((app) => app.status === 'interview').length, color: '#8b5cf6' },
          { name: 'Aprovadas', value: applicationsData.filter((app) => app.status === 'approved').length, color: '#10b981' }
        ];
        const totalBucketValues = statusBuckets.reduce((sum, bucket) => sum + bucket.value, 0) || 1;
        const sourceData = statusBuckets.map((bucket) => ({
          ...bucket,
          value: Math.round((bucket.value / totalBucketValues) * 100)
        }));

        return (
          <section className={styles.sectionBlock}>
            <div className={styles.sectionHeading}>
              <div>
                <h2>Analytics</h2>
                <p>Performance e metricas das suas vagas</p>
              </div>
              <div className={styles.filterTabs}>
                <button type="button" className={`${styles.filterTab} ${styles.filterTabActive}`}>7 dias</button>
                <button type="button" className={styles.filterTab}>30 dias</button>
                <button type="button" className={styles.filterTab}>90 dias</button>
              </div>
            </div>

            {loadingAnalytics && <div className={styles.spinner}>Carregando metricas...</div>}
            {!loadingAnalytics && analyticsError && <div className={styles.emptyState}><p>{analyticsError}</p></div>}

            {!loadingAnalytics && !analyticsError && (
              <>
                {/* Main KPI Cards */}
                <div className={styles.analyticsKPIGrid}>
                  <AnalyticsCard
                    title="Visualizacoes Totais"
                    value={totalViews.toLocaleString('pt-PT')}
                    subtitle="Ultimos 30 dias"
                    color="#6366f1"
                    icon={icons.eye}
                    change={12}
                  />
                  <AnalyticsCard
                    title="Taxa de Conversao"
                    value={`${conversionRate.toFixed(1)}%`}
                    subtitle="Candidaturas / Views"
                    color="#10b981"
                    icon={icons.trending}
                    change={5}
                  />
                  <AnalyticsCard
                    title="Candidaturas"
                    value={totalApplications}
                    subtitle="Total recebidas"
                    color="#f59e0b"
                    icon={icons.inbox}
                    change={-3}
                  />
                  <AnalyticsCard
                    title="Vagas Ativas"
                    value={activeJobs.length}
                    subtitle={`de ${jobs.length} publicadas`}
                    color="#ec4899"
                    icon={icons.briefcase}
                  />
                </div>

                {/* Charts Row */}
                <div className={styles.analyticsChartsRow}>
                  {/* Views & Applications Chart */}
                  <div className={styles.analyticsChartCard}>
                    <div className={styles.analyticsChartHeader}>
                      <div>
                        <h3>Visualizacoes vs Candidaturas</h3>
                        <p>Tendencia semanal</p>
                      </div>
                      <div className={styles.analyticsLegend}>
                        <span><i className={styles.analyticsLegendDot} style={{ '--legend-color': '#6366f1' }}></i> Views</span>
                        <span><i className={styles.analyticsLegendDot} style={{ '--legend-color': '#10b981' }}></i> Apps</span>
                      </div>
                    </div>
                    <div className={styles.analyticsChartWrapper}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={weeklyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorApps" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" stroke="#52525b" axisLine={false} tickLine={false} fontSize={12} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#18181b',
                              border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: '10px',
                              boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
                            }}
                            labelStyle={{ color: '#fff', fontWeight: 600 }}
                          />
                          <Area type="monotone" dataKey="views" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorViews)" />
                          <Area type="monotone" dataKey="apps" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorApps)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Source Distribution */}
                  <div className={styles.analyticsChartCard}>
                    <div className={styles.analyticsChartHeader}>
                      <div>
                        <h3>Distribuição das Candidaturas</h3>
                        <p>Baseado no estado atual do funil</p>
                      </div>
                    </div>
                    <div className={styles.analyticsSourceList}>
                      {sourceData.map((source) => (
                        <div key={source.name} className={styles.analyticsSourceItem}>
                          <div className={styles.analyticsSourceInfo}>
                            <span
                              className={`${styles.analyticsSourceDot} ${styles.analyticsSourceAccent}`}
                              style={{ '--accent-color': source.color }}
                            ></span>
                            <span className={styles.analyticsSourceName}>{source.name}</span>
                          </div>
                          <div className={styles.analyticsSourceBar}>
                            <div
                              className={`${styles.analyticsSourceProgress} ${styles.analyticsSourceAccent}`}
                              style={{ width: `${source.value}%`, '--accent-color': source.color }}
                            ></div>
                          </div>
                          <span className={styles.analyticsSourceValue}>{source.value}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Performance by Job */}
                <div className={styles.analyticsTableCard}>
                  <div className={styles.analyticsTableHeader}>
                    <h3>Performance por Vaga</h3>
                    <p>Ranking das vagas mais visualizadas</p>
                  </div>
                  <div className={styles.analyticsTable}>
                    <div className={styles.analyticsTableHead}>
                      <span>Vaga</span>
                      <span>Views</span>
                      <span>Apps</span>
                      <span>Conversao</span>
                      <span>Status</span>
                    </div>
                    {(analytics?.topJobs || jobs.slice(0, 5)).map((job, index) => {
                      const jobViews = job.views || 0;
                      const jobApps = job.applications ?? job.applicationCount ?? 0;
                      const jobConversion = jobViews > 0 ? ((jobApps / jobViews) * 100).toFixed(1) : 0;

                      return (
                        <div key={job.id} className={styles.analyticsTableRow}>
                          <div className={styles.analyticsTableJob}>
                            <span className={styles.analyticsTableRank}>#{index + 1}</span>
                            <div>
                              <p className={styles.analyticsTableTitle}>{job.titulo}</p>
                              <p className={styles.analyticsTableMeta}>{job.localizacao || 'Local nao informado'}</p>
                            </div>
                          </div>
                          <span className={styles.analyticsTableValue}>{jobViews.toLocaleString('pt-PT')}</span>
                          <span className={styles.analyticsTableValue}>{jobApps}</span>
                          <span className={styles.analyticsTableValue}>{jobConversion}%</span>
                          <span className={`${styles.analyticsTableStatus} ${job.status === 'active' ? styles.statusActive : styles.statusInactive}`}>
                            {job.status === 'active' ? 'Ativa' : 'Inativa'}
                          </span>
                        </div>
                      );
                    })}
                    {jobs.length === 0 && (
                      <div className={styles.analyticsTableEmpty}>
                        Nenhuma vaga publicada ainda
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Stats Row */}
                <div className={styles.analyticsQuickStats}>
                  <div className={styles.analyticsQuickStat}>
                    <span className={styles.analyticsQuickIcon}>{icons.clock}</span>
                    <div>
                      <p className={styles.analyticsQuickValue}>{avgViewsPerJob}</p>
                      <p className={styles.analyticsQuickLabel}>Media views/vaga</p>
                    </div>
                  </div>
                  <div className={styles.analyticsQuickStat}>
                    <span className={styles.analyticsQuickIcon}>{icons.users}</span>
                    <div>
                      <p className={styles.analyticsQuickValue}>{avgAppsPerJob}</p>
                      <p className={styles.analyticsQuickLabel}>Media apps/vaga</p>
                    </div>
                  </div>
                  <div className={styles.analyticsQuickStat}>
                    <span className={styles.analyticsQuickIcon}>{icons.trending}</span>
                    <div>
                      <p className={styles.analyticsQuickValue}>{jobs.length > 0 ? Math.round((activeJobs.length / jobs.length) * 100) : 0}%</p>
                      <p className={styles.analyticsQuickLabel}>Vagas ativas</p>
                    </div>
                  </div>
                  <div className={styles.analyticsQuickStat}>
                    <span className={styles.analyticsQuickIcon}>{icons.bell}</span>
                    <div>
                      <p className={styles.analyticsQuickValue}>{recentApplications.filter(a => !a.status || a.status === 'pending').length}</p>
                      <p className={styles.analyticsQuickLabel}>Apps pendentes</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>
        );
      case 'company-profile':
        return (
          <section className={styles.sectionBlock}>
            <div className={styles.profileSection}>
              {profile.coverUrl || profile.cover ? (
                <div
                  className={styles.profileCover}
                  style={{ backgroundImage: `url(${profile.coverUrl || profile.cover})` }}
                />
              ) : null}
              <div className={styles.profileDetails}>
                <div className={styles.profileHeaderRow}>
                  <h2>{profile.name || profile.fullName || 'Sua empresa'}</h2>
                  <Link href="/dashboard/empresa/profile" className={styles.actionLink}>
                    Editar informações
                  </Link>
                </div>
                <div className={styles.profileSummary}>
                  <h3>Resumo da empresa</h3>
                  <p>{profile.description || 'Complete o perfil para ganhar destaque com um resumo claro da missão, cultura e principais serviços da empresa.'}</p>
                </div>
                <div className={styles.profileStatsGrid}>
                  <div className={styles.profileStat}>
                    <span>Localização</span>
                    <strong>{profile.location || 'São Tomé, STP'}</strong>
                  </div>
                  <div className={styles.profileStat}>
                    <span>Setor de atuação</span>
                    <strong>{profile.industry || profile.segment || profile.area || 'Não informado'}</strong>
                  </div>
                  <div className={styles.profileStat}>
                    <span>Contacto</span>
                    <strong>{profile.contact || profile.phone || profile.email || 'Não informado'}</strong>
                  </div>
                  <div className={styles.profileStat}>
                    <span>Plano atual</span>
                    <strong>{planState}</strong>
                  </div>
                  <div className={styles.profileStat}>
                    <span>Tamanho da empresa</span>
                    <strong>{profile.employees || profile.companySize || profile.size || 'Não informado'}</strong>
                  </div>
                  <div className={styles.profileStat}>
                    <span>Candidaturas totais</span>
                    <strong>{stats?.totalApplications || totalApplications}</strong>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      case 'plans':
        return (
          <section className={styles.sectionBlock}>
            <EmpresaPlansCatalog
              plans={plans}
              currentPlanId={normalizedCompanyPlanId}
              currentPlanName={planState}
              loadingPlanId={planLoadingId}
              error={planError}
              paymentInstructions={planPaymentInstructions}
              pendingPaymentRequest={pendingPaymentRequest}
              onPaymentProofSubmitted={setPendingPaymentRequest}
              onSubscribe={handleSubscribePlan}
            />
          </section>
        );
      default:
        return null;
    }
  };

  const activeLabel = MENU_ITEMS.find((item) => item.id === activeTab)?.label || activeTab;

  return (
    <>
      <Head>
        <title>Dashboard Empresa | EmpregoSTP</title>
        <meta name="description" content="Gerencie suas vagas e candidatos no painel empresarial do EmpregoSTP" />
      </Head>
      <div className={styles.pageLayout}>
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          currentPlan={planState}
          profile={profile}
          onLogout={handleLogout}
          pendingApplicationsCount={applicationsData.filter(a => a.status === 'pending').length}
          unreadMessages={unreadMessages}
	        />
	        <main className={styles.mainContent}>
	          <TopBar
              profile={profile}
              activeLabel={activeLabel}
              notificationsCount={unreadNotifications}
              notifications={notifications}
              notificationsOpen={notificationsOpen}
              notificationsLoading={notificationsLoading}
              notificationsError={notificationsError}
              onToggleNotifications={() => {
                setNotificationsOpen((prev) => {
                  const next = !prev;
                  if (!prev && next) fetchNotifications();
                  return next;
                });
              }}
              onNotificationClick={handleNotificationClick}
              onMarkAllNotificationsRead={markAllNotificationsRead}
            />
	          <div className={styles.contentArea}>{renderContent()}</div>
	        </main>
	      </div>
      {interviewModal.open && (
        <div className={styles.modalOverlay} onClick={closeInterviewScheduler}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3>Agendar entrevista</h3>
                <p>{interviewModal.application?.candidateName || 'Candidato'} • {interviewModal.application?.jobTitle || 'Vaga'}</p>
              </div>
              <button type="button" className={styles.modalCloseButton} onClick={closeInterviewScheduler}>Fechar</button>
            </div>

            <div className={styles.modalGrid}>
              <label className={styles.modalField}>
                <span>Data e hora</span>
                <input
                  type="datetime-local"
                  value={interviewForm.interviewDate}
                  onChange={(event) => handleInterviewFieldChange('interviewDate', event.target.value)}
                />
              </label>

              <label className={styles.modalField}>
                <span>Formato</span>
                <select
                  value={interviewForm.interviewMode}
                  onChange={(event) => handleInterviewFieldChange('interviewMode', event.target.value)}
                >
                  <option value="online">Online</option>
                  <option value="presencial">Presencial</option>
                </select>
              </label>

              {interviewForm.interviewMode === 'online' ? (
                <label className={`${styles.modalField} ${styles.modalFieldFull}`}>
                  <span>Link da entrevista</span>
                  <input
                    type="url"
                    placeholder="https://meet.google.com/..."
                    value={interviewForm.interviewLink}
                    onChange={(event) => handleInterviewFieldChange('interviewLink', event.target.value)}
                  />
                </label>
              ) : (
                <label className={`${styles.modalField} ${styles.modalFieldFull}`}>
                  <span>Local da entrevista</span>
                  <input
                    type="text"
                    placeholder="Endereço ou referência"
                    value={interviewForm.interviewLocation}
                    onChange={(event) => handleInterviewFieldChange('interviewLocation', event.target.value)}
                  />
                </label>
              )}

              <label className={`${styles.modalField} ${styles.modalFieldFull}`}>
                <span>Notas para o candidato</span>
                <textarea
                  rows="4"
                  placeholder="Ex.: leve documento de identificação e chegue 10 minutos antes."
                  value={interviewForm.interviewNotes}
                  onChange={(event) => handleInterviewFieldChange('interviewNotes', event.target.value)}
                />
              </label>
            </div>

            {interviewError && (
              <div className={styles.modalErrorBox}>
                <p>{interviewError}</p>
                {interviewError.toLowerCase().includes('upgrade') && (
                  <Link href="/premium/empresa" className={styles.actionLink}>Ver planos</Link>
                )}
              </div>
            )}

            <div className={styles.modalActions}>
              <button type="button" className={styles.applicationBtnOutline} onClick={closeInterviewScheduler}>
                Cancelar
              </button>
              <button type="button" className={styles.applicationBtn} onClick={handleScheduleInterview} disabled={interviewSubmitting}>
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
    publicadoEm: safeTimestampToMillis(job.publicadoEm)
  };
}

export async function getServerSideProps(context) {
  const { admin } = await import('../../../lib/firebaseAdmin');
  try {
    const cookies = nookies.get(context);
    if (!cookies.token) {
      return { redirect: { destination: '/login', permanent: false } };
    }
    const token = await admin.auth().verifyIdToken(cookies.token);
    const { uid } = token;

    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return { redirect: { destination: '/login', permanent: false } };
    }
    const userData = userDoc.data();
    if (userData.userType !== 'empresa') {
      return { redirect: { destination: '/dashboard', permanent: false } };
    }

    const profile = {
      ...userData,
      planEndDate: safeTimestampToMillis(userData.planEndDate),
      planStartDate: safeTimestampToMillis(userData.planStartDate),
      monthlyJobsResetDate: safeTimestampToMillis(userData.monthlyJobsResetDate),
      updatedAt: safeTimestampToMillis(userData.updatedAt),
      createdAt: safeTimestampToMillis(userData.createdAt)
    };

    const jobsSnapshot = await admin.firestore().collection('jobs').where('companyId', '==', uid).get();
    const jobs = jobsSnapshot.docs.map((doc) => {
      const data = sanitizeFirestoreValue(doc.data());
      const jobPayload = {
        id: doc.id,
        ...data
      };
      return normalizeJobDates(jobPayload);
    });

    const appsSnap = await admin.firestore().collection('applications').where('companyId', '==', uid).get();
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
              scheduledAt: safeTimestampToMillis(data.interviewDetails.scheduledAt)
                ? new Date(safeTimestampToMillis(data.interviewDetails.scheduledAt)).toISOString()
                : data.interviewDetails.scheduledAt || null,
              updatedAt: safeTimestampToMillis(data.interviewDetails.updatedAt)
                ? new Date(safeTimestampToMillis(data.interviewDetails.updatedAt)).toISOString()
                : data.interviewDetails.updatedAt || null
            }
          : null,
        statusNotes: data.statusNotes || null,
        jobLocation: data.jobLocation || null,
        jobType: data.jobType || null
      };
      const appliedAtValue = safeTimestampToMillis(data.appliedAt || data.createdAt);
      applicationData.appliedAt = appliedAtValue ? new Date(appliedAtValue).toISOString() : null;
      const createdAtValue = safeTimestampToMillis(data.createdAt);
      applicationData.createdAt = createdAtValue ? new Date(createdAtValue).toISOString() : null;
      const updatedAtValue = safeTimestampToMillis(data.updatedAt);
      applicationData.updatedAt = updatedAtValue ? new Date(updatedAtValue).toISOString() : null;
      recentApplications.push(applicationData);
    });

    recentApplications.sort((a, b) => {
      const dateA = a.appliedAt ? new Date(a.appliedAt).getTime() : 0;
      const dateB = b.appliedAt ? new Date(b.appliedAt).getTime() : 0;
      return dateB - dateA;
    });

    const jobsWithCounts = jobs.map((job) => ({ ...job, applicationCount: appCounts[job.id] || 0 }));

    const stats = {
      totalApplications: appsSnap.size,
      pendingApplications: recentApplications.filter((a) => a.status === 'pending' || !a.status).length,
      approvedApplications: recentApplications.filter((a) => a.status === 'approved').length
    };
    const plans = await fetchActiveEmpresaPlans(admin);

    return {
      props: {
        profile,
        jobs: jobsWithCounts,
        totalApplications: appsSnap.size,
        recentApplications: recentApplications.slice(0, 10),
        stats,
        plans
      }
    };
  } catch (error) {
    console.error('Erro no getServerSideProps:', error);
    return { redirect: { destination: '/login', permanent: false } };
  }
}
