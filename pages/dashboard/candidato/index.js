import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuth } from '../../../context/AuthContext';
import { getCareerAdvice } from '../../../lib/geminiService';
import { extractLinkedInProfileHints } from '../../../lib/linkedin';
import {
  downloadInterviewICS,
  isLikelyUrl,
} from '../../../lib/interviewClient';
import { VERIFICATION_TYPE_CONFIG } from '../../../lib/candidateVerification';
import { getFirebaseStorageErrorMessage } from '../../../lib/firebaseStorageError';
import { resolveDashboardTab } from '../../../lib/dashboardNavigation';
import {
  FiAlertCircle,
  FiArrowRight,
  FiAward,
  FiBell,
  FiBookOpen,
  FiBookmark,
  FiBriefcase,
  FiCamera,
  FiCalendar,
  FiCheckCircle,
  FiEdit2,
  FiFileText,
  FiGlobe,
  FiInbox,
  FiLock,
  FiMapPin,
  FiMessageCircle,
  FiPlus,
  FiPlusCircle,
  FiSearch,
  FiTarget,
  FiUploadCloud,
  FiUser,
  FiX,
  FiZap,
} from 'react-icons/fi';
import DashboardShell from '../../../components/dashboard/DashboardShell';
import CandidateDashboardOverview from '../../../components/dashboard/CandidateDashboardOverview';
import AffiliateSection from '../../../components/affiliate/AffiliateSection';
import AutoSaveStatus from '../../../components/forms/AutoSaveStatus';
import useAutoDraft from '../../../hooks/useAutoDraft';
import styles from '../../../styles/DashboardCandidato.module.css';
import ps from '../../../styles/CandidateProfileSettings.module.css';
import { createFormDraftKey } from '../../../lib/formDraft';
import { buildLoginUrl } from '../../../lib/loginRedirect';
import { requireSession } from '../../../lib/serverSession';

const CandidateApplicationsChart = dynamic(
  () => import('../../../components/charts/CandidateApplicationsChart'),
  {
    ssr: false,
    loading: () => (
      <div
        className={styles.chartWrapper}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-3, #94a3b8)',
        }}
      >
        Carregando gráfico...
      </div>
    ),
  },
);

const CandidatePremiumPlansExperience = dynamic(
  () => import('../../../components/CandidatePremiumPlansExperience'),
  {
    ssr: false,
    loading: () => (
      <div
        className={styles.planCard}
        style={{ padding: '1rem', color: 'var(--text-3, #94a3b8)' }}
      >
        Carregando planos...
      </div>
    ),
  },
);

const CandidateSettings = dynamic(
  () => import('../../../components/candidates/CandidateSettings'),
  {
    ssr: false,
    loading: () => <CandidateLoadingState />,
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
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <path d="M9 16l2 2 4-4" />
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
  pending: 'Pendente',
  analysis: 'Em Analise',
  interview: 'Entrevista',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
};

const getInitials = (value = '') =>
  String(value)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'U';

const AVATAR_PALETTE = [
  { background: 'rgba(32,87,215,0.14)', color: '#2057d7' },
  { background: 'rgba(30,43,77,0.12)', color: '#1e2b4d' },
  { background: 'rgba(139,92,246,0.14)', color: '#7c3aed' },
  { background: 'rgba(217,255,47,0.22)', color: '#7a9000' },
  { background: 'rgba(61,187,122,0.16)', color: '#15803d' },
];

const getAvatarColor = (seed = '') => {
  const str = String(seed || '');
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) % 997;
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
};

const getCompletionHeadline = (score) => {
  if (score >= 90) return 'Perfil completo!';
  if (score >= 65) return 'Bom progresso!';
  if (score >= 40) return 'A continuar bem!';
  return 'Vamos começar!';
};

const VERIFICATION_TYPE_ORDER = [
  'identity',
  'certificates',
  'academic',
  'experience',
  'competencies',
];

const VERIFICATION_STATUS_META = {
  draft: {
    label: 'Não iniciado',
    toneClass: 'verificationStatusMuted',
    summary: 'Ainda não existe um pedido completo para revisão.',
  },
  not_requested: {
    label: 'Disponivel',
    toneClass: 'verificationStatusMuted',
    summary: 'Este bloco ainda não foi solicitado.',
  },
  pending: {
    label: 'Em análise',
    toneClass: 'verificationStatusPending',
    summary: 'A equipa está a rever este bloco de verificação.',
  },
  approved: {
    label: 'Aprovado',
    toneClass: 'verificationStatusApproved',
    summary: 'Este bloco já foi validado com sucesso.',
  },
  verified: {
    label: 'Verificado',
    toneClass: 'verificationStatusApproved',
    summary: 'Este bloco já foi validado com sucesso.',
  },
  rejected: {
    label: 'Rejeitado',
    toneClass: 'verificationStatusRejected',
    summary: 'Faltam ajustes ou novos comprovativos para este bloco.',
  },
  partial: {
    label: 'Parcial',
    toneClass: 'verificationStatusMixed',
    summary: 'Há blocos aprovados e outros que exigem correção.',
  },
};

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('pt-PT');
};

const getVerificationStatusMeta = (status) => {
  if (!status) return VERIFICATION_STATUS_META.draft;
  return VERIFICATION_STATUS_META[status] || VERIFICATION_STATUS_META.draft;
};

const createVerificationForm = (profileData, userState) => ({
  contactEmail: profileData?.email || userState?.email || '',
  contactPhone: profileData?.phone || userState?.phone || '',
  certificationsText: profileData?.certifications || '',
  educationSummary: profileData?.education || '',
  experienceSummary: '',
  portfolioUrl: profileData?.website || '',
  linkedin: profileData?.linkedin || '',
  competencyNotes: '',
  identityDocument: null,
  selfieDocument: null,
  certificateDocuments: [],
  academicDocument: null,
  employmentProof: null,
  cvDocument: null,
  competencyDocument: null,
});

const formatInterviewDate = (value) => {
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

const formatRelativeTime = (value) => {
  if (!value) return '';
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days <= 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  if (days < 7) return `Há ${days} dias`;
  const weeks = Math.floor(days / 7);
  if (days < 30) return weeks === 1 ? 'Há 1 semana' : `Há ${weeks} semanas`;
  const months = Math.floor(days / 30);
  if (days < 365) return months === 1 ? 'Há 1 mês' : `Há ${months} meses`;
  const years = Math.floor(days / 365);
  return years === 1 ? 'Há 1 ano' : `Há ${years} anos`;
};

const formatJobSalary = (job) => {
  const raw =
    job?.salarioDe ?? job?.salario ?? job?.salary ?? job?.salarioMin ?? null;
  const num = Number(raw);
  if (raw === null || raw === '' || Number.isNaN(num) || num <= 0) {
    return 'A combinar';
  }
  return `${num.toLocaleString('pt-PT')} Db`;
};

const OVERVIEW_STATUS_CLASS = {
  analysis: 'statusAnalysis',
  interview: 'statusInterview',
  approved: 'statusApproved',
  rejected: 'statusRejected',
  pending: 'statusPending',
};

const NAV_MENU = [
  { id: 'dashboard', label: 'Visão geral', icon: 'dashboard' },
  { id: 'profile', label: 'Meu perfil', icon: 'profile' },
  { id: 'applications', label: 'Candidaturas', icon: 'applications' },
  { id: 'saved', label: 'Vagas guardadas', icon: 'saved' },
  { id: 'interviews', label: 'Entrevistas', icon: 'mic' },
  { id: 'messages', label: 'Mensagens', icon: 'messages' },
  { id: 'notifications', label: 'Notificações', icon: 'notifications' },
  { id: 'settings', label: 'Configurações', icon: 'settings' },
  { id: 'verification', label: 'Verificação', icon: 'verification' },
  { id: 'plans', label: 'Planos premium', icon: 'plans' },
  { id: 'affiliate', label: 'Ser Afiliado', icon: 'trophy' },
];
const CANDIDATE_TAB_IDS = new Set(NAV_MENU.map((item) => item.id));

const getPlanFeatureList = (features) => {
  if (Array.isArray(features)) {
    return features;
  }

  if (!features || typeof features !== 'object') {
    return ['Recursos padrão'];
  }

  const list = [];
  if (features.maxApplicationsPerMonth !== undefined) {
    if (features.maxApplicationsPerMonth === null) {
      list.push('Candidaturas ilimitadas');
    } else {
      list.push(`Até ${features.maxApplicationsPerMonth} candidaturas/mês`);
    }
  }
  if (features.canSaveJobs) {
    list.push('Salvar vagas favoritas');
  }
  if (features.canApplyToFeaturedJobs) {
    list.push('Candidaturas a vagas em destaque');
  }
  if (features.canUploadCertificates) {
    list.push('Upload seguro de certificados');
  }
  if (features.prioritySupport) {
    list.push('Suporte prioritário');
  }
  if (list.length === 0 && features.name) {
    list.push(features.name);
  }

  return list.length ? list : ['Recursos padrão'];
};

const emptyExperience = { company: '', role: '', period: '', description: '' };

const buildProfileForm = (profileData, userState) => {
  const skillsArray = profileData?.skillsHard || userState?.skills || [];
  const experiences = profileData?.experience || userState?.experience || [];

  const normalizedSkills = Array.isArray(skillsArray)
    ? skillsArray.join(', ')
    : typeof skillsArray === 'string'
      ? skillsArray
      : '';

  const sanitizedExperiences = experiences.length
    ? experiences.map((exp) => ({
        company: exp?.company || '',
        role: exp?.role || '',
        period: exp?.period || '',
        description: exp?.description || '',
      }))
    : [{ ...emptyExperience }];

  return {
    name: profileData?.fullName || userState?.name || '',
    headline:
      profileData?.headline ||
      profileData?.profession ||
      userState?.headline ||
      '',
    bio: profileData?.bio || userState?.bio || '',
    location: profileData?.city || userState?.location || '',
    phone: profileData?.phone || userState?.phone || '',
    skills: normalizedSkills,
    experiences: sanitizedExperiences,
    // Extended Form Fields
    birthDate: profileData?.birthDate || '',
    nationality: profileData?.nationality || '',
    gender: profileData?.gender || '',
    maritalStatus: profileData?.maritalStatus || '',
    linkedin: profileData?.linkedin || '',
    website: profileData?.website || '',
    objectiveArea: profileData?.objectiveArea || '',
    objectiveType: profileData?.objectiveType || '',
    objectiveAspiration: profileData?.objectiveAspiration || '',
    skillsSoft: profileData?.skillsSoft || '',
    digitalSkills: profileData?.digitalSkills || [],
    education: profileData?.education || '',
    languages: profileData?.languages || '',
    certifications: profileData?.certifications || '',
    certificateFiles: profileData?.certificateFiles || [],
  };
};

const normalizeDraftText = (value) =>
  typeof value === 'string' ? value : '';

const prepareCandidateProfileDraft = (value = {}) => {
  const experiences = Array.isArray(value.experiences)
    ? value.experiences.map((experience) => ({
        company: normalizeDraftText(experience?.company),
        role: normalizeDraftText(experience?.role),
        period: normalizeDraftText(experience?.period),
        description: normalizeDraftText(experience?.description),
      }))
    : [];

  return {
    name: normalizeDraftText(value.name),
    headline: normalizeDraftText(value.headline),
    bio: normalizeDraftText(value.bio),
    location: normalizeDraftText(value.location),
    phone: normalizeDraftText(value.phone),
    skills: normalizeDraftText(value.skills),
    experiences: experiences.length ? experiences : [{ ...emptyExperience }],
    birthDate: normalizeDraftText(value.birthDate),
    nationality: normalizeDraftText(value.nationality),
    gender: normalizeDraftText(value.gender),
    maritalStatus: normalizeDraftText(value.maritalStatus),
    linkedin: normalizeDraftText(value.linkedin),
    website: normalizeDraftText(value.website),
    objectiveArea: normalizeDraftText(value.objectiveArea),
    objectiveType: normalizeDraftText(value.objectiveType),
    objectiveAspiration: normalizeDraftText(value.objectiveAspiration),
    skillsSoft: normalizeDraftText(value.skillsSoft),
    digitalSkills: Array.isArray(value.digitalSkills)
      ? value.digitalSkills.filter((skill) => typeof skill === 'string')
      : [],
    education: normalizeDraftText(value.education),
    languages: normalizeDraftText(value.languages),
    certifications: normalizeDraftText(value.certifications),
    certificateFiles: Array.isArray(value.certificateFiles)
      ? value.certificateFiles.filter((url) => typeof url === 'string')
      : [],
  };
};

const SUBLABEL_TONE_STYLES = {
  positive: { background: 'rgba(34,197,94,0.14)', color: '#16a34a' },
  neutral: { background: 'rgba(95,184,245,0.12)', color: '#2057d7' },
  warning: { background: 'rgba(239,68,68,0.15)', color: '#f87171' },
};

const StatCard = ({
  label,
  value,
  change,
  trend,
  icon,
  color = '#2057d7',
  sublabel,
  sublabelWarning,
  sublabelTone,
}) => {
  const tone = sublabelWarning ? 'warning' : sublabelTone || 'neutral';
  const toneStyle = SUBLABEL_TONE_STYLES[tone] || SUBLABEL_TONE_STYLES.neutral;

  return (
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
            className={`${styles.statTrend} ${trend === 'up' ? styles.up : trend === 'down' ? styles.down : ''}`}
          >
            {trend === 'up' ? '+' : trend === 'down' ? '-' : ''}
            {change}%
          </span>
        )}
        {sublabel !== undefined && (
          <span
            style={{
              fontSize: '0.7rem',
              padding: '2px 7px',
              borderRadius: '6px',
              fontWeight: 600,
              background: toneStyle.background,
              color: toneStyle.color,
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
};

const ProgressRing = ({ value = 0, size = 92 }) => {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, Math.round(value) || 0));
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className="progress-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className="track" cx={size / 2} cy={size / 2} r={radius} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#2057d7"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 1s cubic-bezier(0.22,1,0.36,1)',
          }}
        />
      </svg>
      <div className="progress-ring-val">{clamped}%</div>
    </div>
  );
};

const ApplicationTable = ({ applications }) => (
  <div className={styles.tableContainer}>
    <table className={styles.applicationTable}>
      <caption className={styles.srOnly}>
        Lista das candidaturas enviadas
      </caption>
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
            <td data-label="Cargo">{app.jobTitle || 'Vaga'}</td>
            <td data-label="Empresa">
              {app.company || 'Empresa não indicada'}
            </td>
            <td data-label="Estado">
              <span
                className={`${styles.statusPill} ${styles[app.status?.toLowerCase()] || ''}`}
              >
                {STATUS_LABELS[app.status?.toLowerCase()] || 'Pendente'}
              </span>
            </td>
            <td data-label="Data">
              {formatDate(app.appliedAt || app.appliedDate || app.createdAt)}
            </td>
            <td data-label="Ação">
              {app.interviewDetails?.scheduledAt ? (
                <Link
                  className={styles.secondaryLink}
                  href="/dashboard/candidato/candidaturas?filter=interview"
                >
                  Entrevista
                </Link>
              ) : app.jobId ? (
                <Link
                  className={styles.secondaryLink}
                  href={`/vaga/${app.jobId}`}
                >
                  Ver vaga
                </Link>
              ) : (
                <span className={styles.unavailableLabel}>Indisponível</span>
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
  if (mode === 'presencial') {
    return <span>{interviewDetails?.location || 'Local a confirmar'}</span>;
  }
  const value = interviewDetails?.link || '';
  if (!value) return <span>Link a confirmar</span>;
  return isLikelyUrl(value) ? (
    <a
      href={value}
      target="_blank"
      rel="noreferrer noopener"
      style={{
        color: 'var(--blue, #2057d7)',
        textDecoration: 'underline',
        wordBreak: 'break-word',
      }}
    >
      {value}
    </a>
  ) : (
    <span>{value}</span>
  );
}

function CandidateSectionHeader({
  eyebrow,
  title,
  description,
  count,
  action,
}) {
  return (
    <header className={styles.candidateSectionHeader}>
      <div className={styles.candidateSectionCopy}>
        {eyebrow ? (
          <span className={styles.candidateSectionEyebrow}>{eyebrow}</span>
        ) : null}
        {/*
          Cada separador é, para o utilizador, uma página: candidaturas, vagas
          guardadas, entrevistas, verificação, mensagens e notificações. Como
          um `h2`, nenhuma delas tinha cabeçalho de nível 1 e quem usa leitor
          de ecrã ficava sem o principal mecanismo de orientação. Os restantes
          separadores (visão geral, planos e definições) trazem o seu próprio
          `h1` e não passam por aqui, por isso não há duplicação.
        */}
        <div className={styles.candidateSectionTitleRow}>
          <h1>{title}</h1>
          {count !== undefined ? (
            <span className={styles.candidateSectionCount}>{count}</span>
          ) : null}
        </div>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? (
        <div className={styles.candidateSectionAction}>{action}</div>
      ) : null}
    </header>
  );
}

function CandidateEmptyState({
  icon: Icon = FiInbox,
  title,
  description,
  actionHref,
  actionLabel,
  onAction,
}) {
  const actionContent = (
    <>
      <span>{actionLabel}</span>
      <FiArrowRight aria-hidden="true" />
    </>
  );

  return (
    <div className={styles.candidateEmptyState} role="status">
      <span className={styles.candidateEmptyIcon} aria-hidden="true">
        <Icon />
      </span>
      <div className={styles.candidateEmptyCopy}>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {actionHref ? (
        <Link href={actionHref} className={styles.candidateEmptyAction}>
          {actionContent}
        </Link>
      ) : onAction ? (
        <button
          type="button"
          className={styles.candidateEmptyAction}
          onClick={onAction}
        >
          {actionContent}
        </button>
      ) : null}
    </div>
  );
}

function CandidateLoadingState() {
  return (
    <div className={styles.candidateLoadingState} aria-live="polite">
      <div className={styles.candidateLoadingHeader}>
        <span />
        <span />
      </div>
      <div className={styles.candidateLoadingGrid} aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <span key={index} />
        ))}
      </div>
      <span className={styles.srOnly}>A carregar dados do dashboard.</span>
    </div>
  );
}

const CandidateDashboard = () => {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState('');
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
  const [messageInput, setMessageInput] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageSendError, setMessageSendError] = useState('');
  const messagesEndRef = useRef(null);
  const [cvState, setCvState] = useState({
    url: '',
    name: '',
    uploading: false,
    message: '',
    type: 'success',
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
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [settingsSearchQuery, setSettingsSearchQuery] = useState('');
  const [dashboardSearchQuery, setDashboardSearchQuery] = useState('');
  const profileDraftRestoredOwnerRef = useRef('');
  const profileDraftInteractionOwnerRef = useRef('');
  const profileDraftClearAfterRenderRef = useRef(false);

  const profileDraftStorageKey = useMemo(
    () =>
      createFormDraftKey({
        scope: 'candidate-profile',
        ownerId: user?.uid || '',
        resourceId: 'default',
      }),
    [user?.uid],
  );

  const markProfileEditing = useCallback(() => {
    const ownerId = user?.uid || '';
    if (ownerId) profileDraftInteractionOwnerRef.current = ownerId;
    setEditingProfile(true);
  }, [user?.uid]);

  const getProfileDraftToken = useCallback(
    async () => user?.getIdToken?.() || '',
    [user],
  );

  const handleRestoreProfileDraft = useCallback(
    (draft) => {
      const ownerId = user?.uid || '';
      if (
        !ownerId ||
        profileDraftInteractionOwnerRef.current === ownerId
      ) {
        return;
      }

      profileDraftRestoredOwnerRef.current = ownerId;
      const restoredDraft = prepareCandidateProfileDraft(draft);
      setProfileForm((currentForm) => ({
        ...currentForm,
        ...restoredDraft,
      }));
      setEditingProfile(true);
      setActiveTab('profile');
    },
    [user?.uid],
  );

  const {
    status: profileDraftStatus,
    lastSavedAt: profileDraftLastSavedAt,
    isOnline: profileDraftIsOnline,
    hasDraft: hasProfileDraft,
    clearDraft: clearProfileDraft,
  } = useAutoDraft({
    storageKey: profileDraftStorageKey,
    scope: 'candidate-profile',
    resourceId: 'default',
    value: profileForm,
    onRestore: handleRestoreProfileDraft,
    getToken: getProfileDraftToken,
    ready: Boolean(!loading && user?.uid),
    baseUpdatedAt: profile?.updatedAt || '',
    prepareLocal: prepareCandidateProfileDraft,
    prepareRemote: prepareCandidateProfileDraft,
  });

  useEffect(() => {
    if (!profileDraftClearAfterRenderRef.current) return;
    profileDraftClearAfterRenderRef.current = false;
    void clearProfileDraft();
  }, [clearProfileDraft, profileForm]);

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

  useEffect(() => {
    if (!router.isReady) return;
    const requestedTab = resolveDashboardTab(
      router.query.tab,
      CANDIDATE_TAB_IDS,
    );
    setActiveTab((currentTab) =>
      currentTab === requestedTab ? currentTab : requestedTab,
    );
  }, [router.isReady, router.query.tab]);

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
      user?.email?.split('@')[0] ||
      'Candidato',
    [profile, user],
  );
  const profileCoverUrl = String(profile?.coverUrl || user?.cover || '').trim();
  const hasProfileCover = profileCoverUrl.length > 0;
  const profileAvatarUrl = String(
    profile?.photoUrl || user?.avatar || '',
  ).trim();
  const hasProfileAvatar = profileAvatarUrl.length > 0;
  const profileAvatarInitials = useMemo(
    () => getInitials(profileDisplayName),
    [profileDisplayName],
  );
  const firstName = useMemo(
    () =>
      String(profileDisplayName || 'Candidato')
        .trim()
        .split(/\s+/)[0] || 'Candidato',
    [profileDisplayName],
  );
  const allInterviews = useMemo(
    () =>
      applications
        .filter((application) =>
          Boolean(application.interviewDetails?.scheduledAt),
        )
        .sort(
          (a, b) =>
            new Date(a.interviewDetails.scheduledAt).getTime() -
            new Date(b.interviewDetails.scheduledAt).getTime(),
        ),
    [applications],
  );
  const upcomingInterviews = useMemo(
    () => allInterviews.slice(0, 3),
    [allInterviews],
  );
  const recentApplications = useMemo(
    () =>
      [...applications]
        .sort((a, b) => {
          const rawA = a.appliedAt || a.appliedDate || a.createdAt;
          const rawB = b.appliedAt || b.appliedDate || b.createdAt;
          const timeA = rawA?.toDate
            ? rawA.toDate().getTime()
            : new Date(rawA || 0).getTime();
          const timeB = rawB?.toDate
            ? rawB.toDate().getTime()
            : new Date(rawB || 0).getTime();
          return (
            (Number.isNaN(timeB) ? 0 : timeB) -
            (Number.isNaN(timeA) ? 0 : timeA)
          );
        })
        .slice(0, 5),
    [applications],
  );

  const fetchRecommended = useCallback(async (token) => {
    if (!token) return;
    try {
      const response = await fetch('/api/recommendations', {
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
      console.error('Erro ao buscar vagas recomendadas:', err);
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
          throw new Error(data.error || 'Erro ao carregar verificacao');
        }

        const latestVerification = data.verifications?.[0] || null;
        setVerificationRecord(latestVerification);
        return latestVerification;
      } catch (error) {
        console.error('Erro ao carregar verificacao tipada:', error);
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
      const { getAuth } = await import('firebase/auth');
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const response = await fetch('/api/notifications', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) return;

      const data = await response.json();
      setNotifications(data.notifications || []);
    } catch (error) {
      console.error('Erro ao buscar notificações:', error);
    }
  }, []);

  const fetchConversationsRealtime = useCallback(async () => {
    try {
      const { getAuth } = await import('firebase/auth');
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/messages', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;

      const data = await response.json();
      setConversations(data.conversations || []);
    } catch (error) {
      console.error('Erro ao buscar conversas:', error);
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
        const { getAuth } = await import('firebase/auth');
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
        console.error('Erro ao buscar mensagens:', error);
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
      const payloadType = event?.detail?.payload?.data?.type || '';
      if (payloadType === 'message' || payloadType === 'direct_message') {
        fetchConversationsRealtime();
        if (selectedConversation) {
          fetchConversationMessagesRealtime(selectedConversation, {
            silent: true,
          });
        }
      }
    };

    window.addEventListener('app-notification-received', handleRealtimeEvent);
    return () =>
      window.removeEventListener(
        'app-notification-received',
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
        setDashboardError('');
        const { getAuth } = await import('firebase/auth');
        const auth = getAuth();
        const userInstance = auth.currentUser;
        if (!userInstance) {
          router.push(buildLoginUrl(router.asPath));
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
          router.push(buildLoginUrl(router.asPath));
          return;
        }
        if (!profileRes.ok) {
          throw new Error('Não foi possível obter os dados do perfil.');
        }
        const profileJson = await profileRes.json();
        if (!isMounted) return;

        const profileData = profileJson.profile?.data || {};
        setProfile(profileData);
        if (profileDraftInteractionOwnerRef.current !== uid) {
          setProfileForm(buildProfileForm(profileData, user));
        }
        setApplications(profileJson.applications || []);

        const headlineFallback =
          profileData.headline ||
          profileData.profession ||
          user?.headline ||
          '';
        const planPromise = fetchPlanStatus(token);
        const independentDataPromise = Promise.all([
          fetchVerificationRecord(token, uid),
          fetchSavedJobs(token),
          fetchCareerTips(headlineFallback, token),
        ]);
        const planData = await planPromise;
        await Promise.all([
          independentDataPromise,
          planData?.plan?.features?.canReceiveRecommendations
            ? fetchRecommended(token)
            : Promise.resolve(setRecommendedJobs([])),
        ]);
      } catch (err) {
        console.error('Erro ao carregar dashboard do candidato:', err);
        setProfile(null);
        setDashboardError(
          err?.message ||
            'Não foi possível carregar o dashboard. Verifique a ligação e tente novamente.',
        );
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    const fetchSavedJobs = async (token) => {
      if (!token) return;
      try {
        const response = await fetch('/api/saved-jobs', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setSavedJobs(data.savedJobs || []);
        }
      } catch (err) {
        console.error('Erro ao buscar vagas salvas:', err);
      }
    };

    const fetchPlanStatus = async (token) => {
      if (!token) return;
      try {
        const response = await fetch('/api/candidate/plan-status', {
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
        console.error('Erro ao buscar status do plano:', err);
      }
      return null;
    };

    const fetchCareerTips = async (headline, token) => {
      setLoadingTips(true);
      try {
        const tips = await getCareerAdvice(headline, token);
        if (isMounted) setCareerTips(tips);
      } catch (err) {
        console.error('Erro ao buscar dicas de carreira:', err);
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
      const { getAuth } = await import('firebase/auth');
      const auth = getAuth();
      const currentUser = auth.currentUser;
      const token = await currentUser?.getIdToken();
      if (!token) return;
      const response = await fetch('/api/candidate/plan-status', {
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
      contactEmail: prev.contactEmail || profile?.email || user?.email || '',
      contactPhone: prev.contactPhone || profile?.phone || user?.phone || '',
      certificationsText:
        prev.certificationsText || profile?.certifications || '',
      educationSummary: prev.educationSummary || profile?.education || '',
      portfolioUrl: prev.portfolioUrl || profile?.website || '',
      linkedin: prev.linkedin || profile?.linkedin || '',
    }));
  }, [profile, user]);

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

  useEffect(() => {
    const ownerId = user?.uid || '';
    if (
      !editingProfile &&
      profileDraftInteractionOwnerRef.current !== ownerId &&
      profileDraftRestoredOwnerRef.current !== ownerId
    ) {
      setProfileForm(buildProfileForm(profile, user));
    }
  }, [profile, user, editingProfile]);

  useEffect(() => {
    setCvState((prev) => ({
      ...prev,
      url: profile?.cvUrl || '',
      name: profile?.cvName || '',
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
    if (activeTab !== 'messages') return;
    fetchConversationsRealtime();
  }, [activeTab, fetchConversationsRealtime]);

  useEffect(() => {
    if (activeTab !== 'messages') return undefined;

    const intervalId = setInterval(() => {
      if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'hidden'
      )
        return;
      fetchConversationsRealtime();
    }, 12000);

    return () => clearInterval(intervalId);
  }, [activeTab, fetchConversationsRealtime]);

  // Fetch messages when a conversation is selected
  useEffect(() => {
    if (activeTab !== 'messages') return undefined;
    setMessageSendError('');
    if (!selectedConversation) {
      setMessages([]);
      return;
    }
    fetchConversationMessagesRealtime(selectedConversation);

    const intervalId = setInterval(() => {
      if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'hidden'
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
        typeof document !== 'undefined' &&
        document.visibilityState === 'hidden'
      )
        return;
      fetchNotificationsRealtime();
    }, 20000);

    return () => clearInterval(intervalId);
  }, [user, fetchNotificationsRealtime]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedConversation || sendingMessage) return;
    const text = messageInput.trim();
    setMessageSendError('');
    setMessageInput('');
    setSendingMessage(true);
    try {
      const { getAuth } = await import('firebase/auth');
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setMessageInput(text);
        setMessageSendError(
          'A sessão terminou. Inicie sessão novamente para enviar a mensagem.',
        );
        return;
      }
      const token = await currentUser.getIdToken();
      const res = await fetch(`/api/messages/${selectedConversation}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
        const data = await res.json().catch(() => ({}));
        setMessageInput(text);
        setMessageSendError(
          (typeof data.error === 'string' && data.error.trim()) ||
            'Não foi possível enviar a mensagem. O texto foi mantido para tentar novamente.',
        );
      }
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
      setMessageInput(text);
      setMessageSendError(
        'Não foi possível enviar a mensagem. Verifique a ligação e tente novamente.',
      );
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

      if (!response.ok) {
        throw new Error('Falha ao marcar notificação como lida');
      }
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
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

      if (!response.ok) {
        throw new Error('Falha ao marcar todas as notificações');
      }
    } catch (error) {
      console.error('Erro ao marcar todas as notificações:', error);
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
    const dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
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

  // Enquanto `planStatus` não chega, não sabemos qual é o plano. O fallback
  // anterior afirmava "Básico", pelo que um cliente Premium via o plano errado
  // no topo do painel até a API responder — e ficava assim indefinidamente se
  // ela falhasse. `planName: null` deixa a interface mostrar um estado neutro.
  const planStatusLoaded = Boolean(planStatus?.plan);
  const activePlan = planStatus?.plan || {
    planId: 'basic_candidato',
    planName: null,
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

  const planHeading = !planStatusLoaded
    ? 'A carregar plano…'
    : activePlan.price === 0
      ? 'Plano Grátis'
      : activePlan.planName || 'Plano EmpregoSTP';
  const planFeatureList = getPlanFeatureList(activePlan.features);
  const profileViewers = useMemo(
    () => planStatus?.profileViewers || [],
    [planStatus?.profileViewers],
  );
  const profileCompletion = planStatus?.profileCompletion || {
    score: 0,
    label: 'Perfil inicial',
    isProfileComplete: false,
    checklist: [],
    nextSteps: [],
    completedCount: 0,
    totalItems: 0,
    missingCount: 0,
  };
  const profileVisibility = planStatus?.visibility || {
    highlighted: false,
    verified: profile?.verificationStatus === 'verified',
    completionScore: profileCompletion.score,
    isProfileComplete: profileCompletion.isProfileComplete,
    priorityInSearch: false,
  };
  const profileViewsSummary = useMemo(
    () =>
      planStatus?.profileViewsSummary || {
        total: planResources?.profileViews?.current || 0,
        uniqueCompanies: profileViewers.length,
        canSeeDetailedViewers: false,
      },
    [
      planStatus?.profileViewsSummary,
      planResources?.profileViews,
      profileViewers.length,
    ],
  );
  const optimizationInsights = planStatus?.optimizationInsights || {
    employabilityScore: 0,
    employabilityLabel: 'Perfil inicial',
    averageTopMatch: 0,
    bestMatchScore: 0,
    summarySuggestion: '',
    strengths: [],
    improvementActions: [],
    marketSkillGaps: [],
    searchKeywords: [],
    topMatches: [],
    activeJobsAnalyzed: 0,
  };

  const stats = useMemo(() => {
    const now = new Date();
    const activeApplications = applications.filter(
      (application) =>
        !['rejected', 'withdrawn'].includes(
          String(application?.status || '').toLowerCase(),
        ),
    ).length;
    const appliedThisMonth = applications.filter((app) => {
      const raw = app.appliedAt || app.appliedDate || app.createdAt;
      if (!raw) return false;
      const date = raw?.toDate ? raw.toDate() : new Date(raw);
      return (
        !Number.isNaN(date.getTime()) &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()
      );
    }).length;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const viewsThisWeek = profileViewers.filter((viewer) => {
      if (!viewer.viewedAt) return false;
      const date = new Date(viewer.viewedAt);
      return !Number.isNaN(date.getTime()) && date >= sevenDaysAgo;
    }).length;

    const totalViews =
      profileViewsSummary?.total ?? planStatus?.plan?.views ?? 0;

    return [
      {
        label: 'Candidaturas activas',
        value: activeApplications,
        icon: icons.applications,
        color: '#2057d7',
        sublabel:
          appliedThisMonth > 0
            ? `+${appliedThisMonth} este mês`
            : 'Sem novas este mês',
        sublabelTone: appliedThisMonth > 0 ? 'positive' : 'neutral',
      },
      {
        label: 'Vagas guardadas',
        value: savedJobs.length,
        icon: icons.saved,
        color: '#5fb8f5',
        sublabel: 'Sem alteração',
        sublabelTone: 'neutral',
      },
      {
        label: 'Entrevistas agendadas',
        value: allInterviews.length,
        icon: icons.calendar,
        color: '#eab308',
        sublabel: 'Esta semana',
        sublabelTone: 'neutral',
      },
      {
        label: 'Vistas ao perfil',
        value: totalViews,
        icon: icons.eye,
        color: '#16a34a',
        sublabel:
          viewsThisWeek > 0 ? `+${viewsThisWeek} esta semana` : 'Esta semana',
        sublabelTone: viewsThisWeek > 0 ? 'positive' : 'neutral',
      },
    ];
  }, [
    applications,
    savedJobs,
    allInterviews,
    profileViewers,
    profileViewsSummary,
    planStatus,
  ]);

  const profileCategoryBreakdown = useMemo(() => {
    const checklist = profileCompletion.checklist || [];
    const groups = [
      {
        id: 'basic',
        label: 'Informações básicas',
        ids: ['name', 'headline', 'location', 'contact', 'photo', 'bio'],
      },
      {
        id: 'experience',
        label: 'Experiência profissional',
        ids: ['objective', 'experience', 'cv'],
      },
      { id: 'skills', label: 'Competências', ids: ['skills'] },
    ];

    return groups.map((group) => {
      const items = checklist.filter((item) => group.ids.includes(item.id));
      const totalWeight = items.reduce(
        (sum, item) => sum + (item.weight || 0),
        0,
      );
      const completedWeight = items.reduce(
        (sum, item) => sum + (item.completed ? item.weight || 0 : 0),
        0,
      );
      const percent =
        totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
      return { id: group.id, label: group.label, percent };
    });
  }, [profileCompletion.checklist]);

  const completionHintText = useMemo(() => {
    const missing = profileCompletion.nextSteps || [];
    if (!missing.length) {
      return 'O seu perfil está completo. Continue a mantê-lo atualizado.';
    }
    const labels = missing
      .slice(0, 2)
      .map((item) =>
        String(item.label || '').replace(/^./, (c) => c.toLowerCase()),
      );
    return `Adicione ${labels.join(' e ')}.`;
  }, [profileCompletion.nextSteps]);

  const verificationSummary = useMemo(
    () =>
      verificationRecord?.summary ||
      profile?.verificationSummary || {
        status:
          profile?.verificationStatus === 'verified'
            ? 'approved'
            : profile?.verificationStatus === 'pending'
              ? 'pending'
              : profile?.verificationStatus === 'rejected'
                ? 'rejected'
                : 'draft',
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
          description: config?.description || '',
          requested:
            detailedItem?.requested ?? fallbackSummary?.requested ?? false,
          status:
            detailedItem?.status || fallbackSummary?.status || 'not_requested',
          checklist: detailedItem?.checklist || [],
          evidence: detailedItem?.evidence || [],
          reviewReason: detailedItem?.reviewReason || '',
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
    verificationRecord?.status || verificationSummary?.status || 'draft';
  const verificationOverallMeta = getVerificationStatusMeta(
    verificationOverallStatus,
  );

  useEffect(() => {
    const availableTypes = verificationItems
      .filter((item) => item.status !== 'approved')
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
        type: 'error',
        text: 'A verificacao de perfil esta disponivel nos planos Verificacao e Premium.',
      });
      return;
    }

    if (!selectedVerificationTypes.length) {
      setVerificationMessage({
        type: 'error',
        text: 'Selecione pelo menos um bloco de verificacao para enviar.',
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

    if (selectedTypesSet.has('identity')) {
      if (!verificationForm.contactEmail || !verificationForm.contactPhone) {
        validationMessages.push(
          'Preencha email e telefone para enviar Identidade.',
        );
      }
      if (!verificationForm.identityDocument) {
        validationMessages.push(
          'Anexe o documento de identidade para enviar Identidade.',
        );
      }
      if (!verificationForm.selfieDocument) {
        validationMessages.push(
          'Anexe a selfie com documento para enviar Identidade.',
        );
      }
    }

    if (selectedTypesSet.has('certificates')) {
      const hasCertificatesContext =
        verificationForm.certificateDocuments.length > 0 ||
        Boolean(String(verificationForm.certificationsText || '').trim()) ||
        Boolean(profile?.certificateFiles?.length) ||
        Boolean(String(profile?.certifications || '').trim());

      if (!hasCertificatesContext) {
        validationMessages.push(
          'Adicione certificados ou um resumo antes de enviar Certificados.',
        );
      }
    }

    if (selectedTypesSet.has('academic')) {
      const hasAcademicContext =
        Boolean(String(verificationForm.educationSummary || '').trim()) ||
        Boolean(verificationForm.academicDocument) ||
        Boolean(String(profile?.education || '').trim());

      if (!hasAcademicContext) {
        validationMessages.push(
          'Informe a formação ou anexe um comprovativo antes de enviar Académica.',
        );
      }
    }

    if (selectedTypesSet.has('experience')) {
      const hasExperienceContext =
        Boolean(String(verificationForm.experienceSummary || '').trim()) ||
        Boolean(profile?.experience?.length);
      const hasExperienceProof =
        Boolean(verificationForm.employmentProof) ||
        Boolean(verificationForm.cvDocument) ||
        Boolean(profile?.cvUrl);

      if (!hasExperienceContext || !hasExperienceProof) {
        validationMessages.push(
          'Para Experiência, informe histórico profissional e anexe CV ou comprovativo.',
        );
      }
    }

    if (selectedTypesSet.has('competencies')) {
      const hasCompetencyContext =
        Boolean(String(verificationForm.competencyNotes || '').trim()) ||
        Boolean(String(verificationForm.portfolioUrl || '').trim()) ||
        Boolean(String(verificationForm.linkedin || '').trim()) ||
        Boolean(verificationForm.competencyDocument) ||
        profileSkillsCount >= 3;

      if (!hasCompetencyContext) {
        validationMessages.push(
          'Adicione competências, links ou comprovativo antes de enviar Competências.',
        );
      }
    }

    if (validationMessages.length > 0) {
      setVerificationMessage({
        type: 'error',
        text: validationMessages[0],
      });
      return;
    }

    setVerificationLoading(true);
    setVerificationMessage(null);

    try {
      const { getAuth } = await import('firebase/auth');
      const { ref, uploadBytesResumable, getDownloadURL } =
        await import('firebase/storage');
      const { storage } = await import('../../../lib/firebase');

      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Utilizador nao autenticado.');
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
            uploadTask.on('state_changed', null, reject, resolve);
          });
        } catch (error) {
          throw new Error(
            getFirebaseStorageErrorMessage(
              error,
              'Erro ao enviar ficheiro de verificacao.',
            ),
          );
        }

        const url = await getDownloadURL(storageRef);
        return {
          label: file.name,
          url,
          fileName: file.name,
          type: 'file',
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
        selectedVerificationTypes.includes('identity')
          ? uploadSingleFile(
              verificationForm.identityDocument,
              'verification/identity',
            )
          : Promise.resolve(null),
        selectedVerificationTypes.includes('identity')
          ? uploadSingleFile(
              verificationForm.selfieDocument,
              'verification/selfie',
            )
          : Promise.resolve(null),
        selectedVerificationTypes.includes('certificates')
          ? uploadMultipleFiles(
              verificationForm.certificateDocuments,
              'verification/certificates',
            )
          : Promise.resolve([]),
        selectedVerificationTypes.includes('academic')
          ? uploadSingleFile(
              verificationForm.academicDocument,
              'verification/academic',
            )
          : Promise.resolve(null),
        selectedVerificationTypes.includes('experience')
          ? uploadSingleFile(
              verificationForm.employmentProof,
              'verification/experience',
            )
          : Promise.resolve(null),
        selectedVerificationTypes.includes('experience')
          ? uploadSingleFile(verificationForm.cvDocument, 'verification/cv')
          : Promise.resolve(null),
        selectedVerificationTypes.includes('competencies')
          ? uploadSingleFile(
              verificationForm.competencyDocument,
              'verification/competencies',
            )
          : Promise.resolve(null),
      ]);

      const token = await currentUser.getIdToken();
      const response = await fetch('/api/verifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
                    label: profile?.cvName || 'CV atual',
                    url: profile.cvUrl,
                    fileName: profile?.cvName || '',
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
          type: 'error',
          text: data.error || 'Erro ao solicitar verificacao',
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
        ? 'verified'
        : nextSummary?.pendingCount > 0
          ? 'pending'
          : nextSummary?.rejectedCount > 0
            ? 'rejected'
            : 'unverified';

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
        type: 'success',
        text: data.message || 'Pedido de verificacao enviado com sucesso.',
      });
    } catch (err) {
      console.error('Erro na verificacao:', err);
      setVerificationMessage({
        type: 'error',
        text:
          getFirebaseStorageErrorMessage(
            err,
            'Erro ao enviar verificacao. Tente novamente.',
          ) || 'Erro ao enviar verificacao. Tente novamente.',
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
    setCvState((prev) => ({ ...prev, uploading: true, message: '' }));

    try {
      const { getAuth } = await import('firebase/auth');
      const { ref, uploadBytesResumable, getDownloadURL } =
        await import('firebase/storage');
      const { storage } = await import('../../../lib/firebase');
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Usuário não autenticado.');

      const storageRef = ref(
        storage,
        `cvUrl/${currentUser.uid}/${Date.now()}_${file.name}`,
      );
      await new Promise((resolve, reject) => {
        const uploadTask = uploadBytesResumable(storageRef, file);
        uploadTask.on('state_changed', null, reject, resolve);
      });
      const downloadUrl = await getDownloadURL(storageRef);
      const token = await currentUser.getIdToken();

      const response = await fetch('/api/profile/upload-cv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          cvUrl: downloadUrl,
          cvName: file.name,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Falha ao atualizar CV');
      }

      setProfile(data.profile);
      await refreshPlanStatus();
      await fetchRecommended(token);
      setCvState({
        url: downloadUrl,
        name: file.name,
        uploading: false,
        message: 'CV enviado com sucesso!',
      });
    } catch (err) {
      console.error('Erro ao enviar CV:', err);
      setCvState((prev) => ({
        ...prev,
        uploading: false,
        message: getFirebaseStorageErrorMessage(err, 'Erro ao enviar CV'),
      }));
    }
  };

  const handlePhotoUpload = async (event, type) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const setLoading =
      type === 'avatar' ? setAvatarUploading : setCoverUploading;
    setLoading(true);

    try {
      const { getAuth } = await import('firebase/auth');
      const { ref, uploadBytesResumable, getDownloadURL } =
        await import('firebase/storage');
      const { storage } = await import('../../../lib/firebase');

      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Usuário não autenticado.');

      const path = type === 'avatar' ? 'photoUrl' : 'company-covers'; // Using existing paths logic or generic 'covers'
      const timestamp = Date.now();
      const storageRef = ref(
        storage,
        `${path}/${currentUser.uid}/${timestamp}_${file.name}`,
      );

      await uploadBytesResumable(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);
      const token = await currentUser.getIdToken();
      const updateData =
        type === 'avatar'
          ? { photoUrl: downloadUrl }
          : { coverUrl: downloadUrl };
      const response = await fetch('/api/profile/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao atualizar imagem');
      }

      setProfile(data.profile);
      await refreshPlanStatus();
      setProfileForm((prev) => ({
        ...prev,
        ...(type === 'avatar'
          ? { photoUrl: downloadUrl }
          : { coverUrl: downloadUrl }),
      }));

      setProfileFeedback({
        type: 'success',
        message: `${type === 'avatar' ? 'Foto de perfil' : 'Capa'} atualizada com sucesso!`,
      });
    } catch (err) {
      console.error(`Erro ao atualizar ${type}:`, err);
      setProfileFeedback({
        type: 'error',
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
    markProfileEditing();
    setProfileForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleExperienceChange = (index, field, value) => {
    markProfileEditing();
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
    markProfileEditing();
    setProfileForm((prev) => ({
      ...prev,
      experiences: [...prev.experiences, { ...emptyExperience }],
    }));
  };

  const handleRemoveExperience = (index) => {
    markProfileEditing();
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
    const ownerId = user?.uid || '';
    if (ownerId) profileDraftInteractionOwnerRef.current = ownerId;
    profileDraftClearAfterRenderRef.current = true;
    setProfileForm(buildProfileForm(profile, user));
    setEditingProfile(false);
    setProfileFeedback(null);
  };

  const handleStartEditing = () => {
    setProfileForm(buildProfileForm(profile, user));
    setProfileFeedback(null);
    markProfileEditing();
  };

  // Helper functions for extended profile
  const addDigitalSkill = (e) => {
    e.preventDefault();
    const val = e.target.elements.skill.value.trim();
    if (val && !profileForm.digitalSkills.includes(val)) {
      markProfileEditing();
      setProfileForm((prev) => ({
        ...prev,
        digitalSkills: [...prev.digitalSkills, val],
      }));
    }
    e.target.reset();
  };

  const removeDigitalSkill = (skill) => {
    markProfileEditing();
    setProfileForm((prev) => ({
      ...prev,
      digitalSkills: prev.digitalSkills.filter((s) => s !== skill),
    }));
  };

  const handleCertUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    // Upload de certificados nunca é exclusivo de plano — só a quantidade é
    // limitada. `allowed` só é falso ao atingir o limite (ou enquanto os
    // dados do plano ainda não carregaram); nesse caso a mensagem certa é o
    // upgradeMessage da quota, nunca uma mensagem de exclusividade.
    if (!planResources.certificates?.allowed) {
      setProfileFeedback({
        type: 'error',
        message:
          planResources.certificates?.upgradeMessage ||
          'Não foi possível confirmar o limite de certificados. Tente novamente.',
      });
      return;
    }

    if (
      planResources.certificates?.limit !== null &&
      (planResources.certificates?.current || 0) + files.length >
        (planResources.certificates?.limit || 0)
    ) {
      setProfileFeedback({
        type: 'error',
        message: `O seu plano permite no máximo ${planResources.certificates.limit} certificado(s).`,
      });
      return;
    }

    setProfileSaving(true); // Reuse saving state or add new loading state
    try {
      const { getAuth } = await import('firebase/auth');
      const { ref, uploadBytesResumable, getDownloadURL } =
        await import('firebase/storage');
      const { storage } = await import('../../../lib/firebase');

      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Usuário não autenticado');

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

      markProfileEditing();
      setProfileForm((prev) => ({
        ...prev,
        certificateFiles: [...prev.certificateFiles, ...uploadedUrls],
      }));
      setProfileFeedback({
        type: 'success',
        message: 'Certificados adicionados!',
      });
    } catch (err) {
      console.error(err);
      setProfileFeedback({
        type: 'error',
        message: getFirebaseStorageErrorMessage(
          err,
          'Erro ao enviar certificados.',
        ),
      });
    } finally {
      setProfileSaving(false);
    }
  };

  const removeCertificate = (index) => {
    markProfileEditing();
    setProfileForm((prev) => ({
      ...prev,
      certificateFiles: prev.certificateFiles.filter((_, i) => i !== index),
    }));
  };

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    setProfileFeedback(null);
    try {
      const { getAuth } = await import('firebase/auth');
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Usuário não autenticado.');
      }
      const token = await currentUser.getIdToken();
      const skillsArray = (profileForm.skills || '')
        .split(',')
        .map((skill) => skill.trim())
        .filter(Boolean);
      const sanitizedExperiences = (profileForm.experiences || [])
        .map((item) => ({
          company: (item.company || '').trim(),
          role: (item.role || '').trim(),
          period: (item.period || '').trim(),
          description: (item.description || '').trim(),
        }))
        .filter(
          (item) =>
            item.company || item.role || item.period || item.description,
        );

      const response = await fetch('/api/profile/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
        throw new Error(data.error || 'Falha ao salvar o perfil.');
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

      profileDraftClearAfterRenderRef.current = true;
      setProfile(data.profile);
      setProfileForm(buildProfileForm(data.profile, updatedUser));
      await refreshPlanStatus();
      await fetchRecommended(token);
      setProfileFeedback({
        type: 'success',
        message: data.message || 'Perfil atualizado com sucesso.',
      });
      setEditingProfile(false);
    } catch (err) {
      console.error('Erro ao salvar perfil:', err);
      setProfileFeedback({
        type: 'error',
        message: err.message || 'Não foi possível salvar o perfil.',
      });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleImportLinkedIn = () => {
    const hints = extractLinkedInProfileHints(profileForm.linkedin);
    if (!hints.normalizedUrl || !hints.normalizedUrl.includes('linkedin.com')) {
      setProfileFeedback({
        type: 'error',
        message:
          'Informe uma URL válida do LinkedIn para importar os dados básicos.',
      });
      return;
    }

    markProfileEditing();
    setProfileForm((prev) => ({
      ...prev,
      linkedin: hints.normalizedUrl,
      name: prev.name || hints.inferredName || prev.name,
    }));
    setProfileFeedback({
      type: 'success',
      message: hints.inferredName
        ? `URL do LinkedIn normalizada. Nome sugerido: ${hints.inferredName}.`
        : 'URL do LinkedIn normalizada com sucesso.',
    });
  };

  const renderContent = () => {
    if (loading) {
      return <CandidateLoadingState />;
    }

    if (dashboardError && !hasProfileDraft) {
      return (
        <div className={styles.contentArea}>
          <CandidateEmptyState
            icon={FiAlertCircle}
            title="Não foi possível abrir o dashboard"
            description={dashboardError}
            actionLabel="Tentar novamente"
            onAction={() => router.reload()}
          />
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return (
          <CandidateDashboardOverview
            firstName={firstName}
            applications={applications}
            savedJobs={savedJobs}
            interviews={allInterviews}
            profileViews={stats[3]?.value || 0}
            recentApplications={recentApplications}
            recommendedJobs={recommendedJobs}
            profileCompletion={profileCompletion}
            profileCategoryBreakdown={profileCategoryBreakdown}
            completionHintText={completionHintText}
            searchQuery={dashboardSearchQuery}
            onOpenApplications={() => openTab('applications')}
            onOpenProfile={() => openTab('profile')}
          />
        );

      case '__legacy_dashboard':
        return (
          <div className={styles.contentArea}>
            <div className={styles.overviewHero}>
              <div className={styles.overviewHeroCopy}>
                <h1 className={styles.overviewHeroTitle}>
                  Olá, {firstName}! <span aria-hidden="true">👋</span>
                </h1>
                <p className={styles.overviewHeroSub}>
                  Bem-vindo(a) de volta. Aqui está o que está a acontecer com a
                  sua carreira.
                </p>
              </div>
              <div className={styles.overviewHeroActions}>
                <button
                  type="button"
                  className={styles.overviewHeroGhost}
                  onClick={() => openTab('profile')}
                >
                  <FiEdit2 aria-hidden="true" /> Editar Perfil
                </button>
                <Link href="/vagas" className={styles.overviewHeroPrimary}>
                  <FiSearch aria-hidden="true" /> Procurar Vagas
                </Link>
              </div>
            </div>

            <div className={styles.overviewStatsGrid}>
              {[
                {
                  key: 'apps',
                  label: 'Candidaturas Enviadas',
                  value: applications.length,
                  icon: icons.applications,
                  tone: 'blue',
                  sublabel: stats[0]?.sublabel,
                  trend: stats[0]?.sublabelTone,
                },
                {
                  key: 'saved',
                  label: 'Vagas Salvas',
                  value: savedJobs.length,
                  icon: icons.saved,
                  tone: 'amber',
                  sublabel: 'Sem alterações',
                  trend: 'neutral',
                },
                {
                  key: 'views',
                  label: 'Visualizações de Perfil',
                  value: stats[3]?.value ?? 0,
                  icon: icons.eye,
                  tone: 'violet',
                  sublabel: stats[3]?.sublabel,
                  trend: stats[3]?.sublabelTone,
                },
              ].map((card) => (
                <div key={card.key} className={styles.overviewStatCard}>
                  <div className={styles.overviewStatTop}>
                    <span
                      className={`${styles.overviewStatIcon} ${styles[`statIcon_${card.tone}`]}`}
                    >
                      {card.icon}
                    </span>
                    {card.sublabel ? (
                      <span
                        className={`${styles.overviewStatTrend} ${card.trend === 'positive' ? styles.trendPositive : card.trend === 'warning' ? styles.trendWarning : styles.trendNeutral}`}
                      >
                        {card.sublabel}
                      </span>
                    ) : null}
                  </div>
                  <p className={styles.overviewStatValue}>
                    {String(card.value ?? 0).padStart(2, '0')}
                  </p>
                  <p className={styles.overviewStatLabel}>{card.label}</p>
                </div>
              ))}
            </div>

            <div className={styles.overviewMainGrid}>
              <div className={styles.overviewColMain}>
                <section className={styles.overviewCard}>
                  <div className={styles.overviewCardHead}>
                    <h2 className={styles.overviewCardTitle}>
                      Candidaturas Recentes
                    </h2>
                    <button
                      type="button"
                      className={styles.overviewSeeAll}
                      onClick={() => openTab('applications')}
                    >
                      Ver todas
                    </button>
                  </div>
                  {recentApplications.length ? (
                    <div className={styles.overviewAppList}>
                      {recentApplications.slice(0, 4).map((app) => {
                        const statusKey = app.status?.toLowerCase();
                        const avatarColor = getAvatarColor(
                          app.company || app.jobTitle,
                        );
                        const appliedRaw =
                          app.appliedAt || app.appliedDate || app.createdAt;
                        const appliedLabel = formatRelativeTime(appliedRaw);
                        return (
                          <div key={app.id} className={styles.overviewAppRow}>
                            <span
                              className={styles.overviewAppAvatar}
                              style={{
                                background: avatarColor.background,
                                color: avatarColor.color,
                              }}
                            >
                              {getInitials(app.company || app.jobTitle)}
                            </span>
                            <div className={styles.overviewAppInfo}>
                              <strong>{app.jobTitle || 'Vaga'}</strong>
                              <span>
                                {app.company || 'Empresa'}
                                {appliedLabel ? ` • ${appliedLabel}` : ''}
                              </span>
                            </div>
                            <span
                              className={`${styles.overviewStatusPill} ${styles[OVERVIEW_STATUS_CLASS[statusKey]] || styles.statusPending}`}
                            >
                              {STATUS_LABELS[statusKey] || 'Pendente'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className={styles.overviewMutedText}>
                      Ainda não enviou nenhuma candidatura.
                    </p>
                  )}
                </section>

                <div>
                  <h2 className={styles.overviewSectionHeading}>
                    Vagas Recomendadas
                  </h2>
                  {activePlan.features?.canReceiveRecommendations &&
                  recommendedJobs.length ? (
                    <div className={styles.overviewJobGrid}>
                      {recommendedJobs.slice(0, 2).map((job) => {
                        const jobTags = (
                          Array.isArray(job.skills)
                            ? job.skills
                            : Array.isArray(job.requisitos)
                              ? job.requisitos
                              : []
                        )
                          .filter(Boolean)
                          .slice(0, 2);
                        const jobType =
                          job.tipoContrato || job.contractType || 'Vaga';
                        return (
                          <Link
                            key={job.id}
                            href={`/vaga/${job.id}`}
                            className={styles.overviewJobCard}
                          >
                            <div className={styles.overviewJobTop}>
                              <span className={styles.overviewJobIcon}>
                                <FiBriefcase aria-hidden="true" />
                              </span>
                              <span className={styles.overviewJobType}>
                                {jobType}
                              </span>
                            </div>
                            <h3 className={styles.overviewJobTitle}>
                              {job.titulo || job.title || 'Vaga'}
                            </h3>
                            <p className={styles.overviewJobMeta}>
                              {job.empresa ||
                                job.empresaNome ||
                                job.company ||
                                'Empresa'}{' '}
                              • {job.localizacao || job.location || 'Local'}
                            </p>
                            {jobTags.length > 0 && (
                              <div className={styles.overviewJobTags}>
                                {jobTags.map((tag) => (
                                  <span
                                    key={tag}
                                    className={styles.overviewJobTag}
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className={styles.overviewJobFoot}>
                              <strong className={styles.overviewJobPrice}>
                                {formatJobSalary(job)}
                              </strong>
                              <span className={styles.overviewJobApply}>
                                Candidatar-se
                              </span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={styles.overviewCard}>
                      <p className={styles.overviewMutedText}>
                        {activePlan.features?.canReceiveRecommendations
                          ? 'Ainda não há vagas recomendadas. Complete o seu perfil para receber sugestões.'
                          : 'Recomendações personalizadas são um recurso dos planos Profissional e Premium.'}
                      </p>
                      <Link href="/vagas" className={styles.overviewJobApply}>
                        Explorar todas as vagas →
                      </Link>
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.overviewColSide}>
                <section className={styles.overviewCard}>
                  <h2 className={styles.overviewCardTitle}>Perfil Completo</h2>
                  <div className={styles.overviewProfileTopRow}>
                    <span className={styles.overviewProfilePct}>
                      {profileCompletion.score}%
                    </span>
                    <span className={styles.overviewProfileTag}>
                      {getCompletionHeadline(profileCompletion.score)}
                    </span>
                  </div>
                  <div className={styles.overviewProfileBar}>
                    <span
                      style={{
                        width: `${Math.max(6, profileCompletion.score)}%`,
                      }}
                    />
                  </div>
                  <p className={styles.overviewProfileText}>
                    {completionHintText}
                  </p>
                  <button
                    type="button"
                    className={styles.overviewOutlineBtn}
                    onClick={() => openTab('profile')}
                  >
                    Completar Perfil
                  </button>
                </section>

                <section className={styles.overviewPromoCard}>
                  <h2 className={styles.overviewPromoTitle}>Destaque-se</h2>
                  <p className={styles.overviewPromoText}>
                    Empresas estão à procura de talentos com o seu perfil.
                    Mantenha o seu currículo atualizado.
                  </p>
                  <button
                    type="button"
                    className={styles.overviewPromoBtn}
                    onClick={() => openTab('profile')}
                  >
                    Atualizar Agora
                  </button>
                </section>

                <section
                  className={`${styles.overviewCard} ${styles.overviewHelpCard}`}
                >
                  <span className={styles.overviewHelpIcon}>
                    <FiMessageCircle aria-hidden="true" />
                  </span>
                  <h3 className={styles.overviewHelpTitle}>
                    Precisa de ajuda?
                  </h3>
                  <p className={styles.overviewHelpText}>
                    Consulte a nossa central de suporte ou fale connosco.
                  </p>
                  <button
                    type="button"
                    className={styles.overviewHelpLink}
                    onClick={() => openTab('messages')}
                  >
                    Central de Ajuda
                  </button>
                </section>
              </div>
            </div>
          </div>
        );

      case 'profile': {
        const strengthScore = Math.max(
          0,
          Math.min(100, Math.round(profileCompletion?.score ?? 0)),
        );
        const strengthLabel =
          strengthScore >= 90
            ? 'Muito Forte'
            : strengthScore >= 70
              ? 'Forte'
              : strengthScore >= 40
                ? 'Em progresso'
                : 'Inicial';
        const hardSkillChips = (profileForm.skills || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const softSkillChips = (profileForm.skillsSoft || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const profileEmail = profile?.email || user?.email || '';

        if (activeTab === 'profile') {
          return (
            <div className={styles.contentArea}>
              <div className={ps.page}>
                <div className={ps.head}>
                  <div>
                    <h1 className={ps.title}>Configurações de Perfil</h1>
                    <p className={ps.sub}>
                      Gerencie sua identidade profissional e informações de
                      carreira.
                    </p>
                  </div>
                  <div className={ps.headActions}>
                    <AutoSaveStatus
                      status={profileDraftStatus}
                      lastSavedAt={profileDraftLastSavedAt}
                      isOnline={profileDraftIsOnline}
                    />
                    <button
                      type="button"
                      className={`${ps.actionBtn} ${ps.btnGhost}`}
                      onClick={handleCancelEdit}
                      disabled={profileSaving}
                    >
                      Descartar
                    </button>
                    <button
                      type="button"
                      className={`${ps.actionBtn} ${ps.btnPrimary}`}
                      onClick={handleSaveProfile}
                      disabled={profileSaving}
                    >
                      {profileSaving ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                  </div>
                </div>

                {profileFeedback && (
                  <div
                    className={`${ps.feedback} ${
                      profileFeedback.type === 'error'
                        ? ps.feedbackError
                        : ps.feedbackSuccess
                    }`}
                    role="status"
                  >
                    {profileFeedback.message}
                  </div>
                )}

                <div className={ps.grid}>
                  {/* LEFT COLUMN */}
                  <div className={ps.col}>
                    {/* Identity */}
                    <section className={`${ps.card} ${ps.idCard}`}>
                      <div className={ps.avatarWrap}>
                        {hasProfileAvatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={profileAvatarUrl}
                            alt={profileDisplayName}
                            className={ps.avatar}
                          />
                        ) : (
                          <span className={ps.avatar}>
                            {profileAvatarInitials}
                          </span>
                        )}
                        <label className={ps.cam} aria-label="Alterar foto">
                          <FiCamera aria-hidden="true" />
                          <input
                            type="file"
                            accept="image/*"
                            className={ps.hiddenFile}
                            onChange={(e) => handlePhotoUpload(e, 'avatar')}
                          />
                        </label>
                      </div>
                      <div className={ps.idBody}>
                        <input
                          className={ps.idNameInput}
                          value={profileForm.name}
                          placeholder="Nome completo"
                          aria-label="Nome completo"
                          onChange={(e) =>
                            handleProfileFieldChange('name', e.target.value)
                          }
                        />
                        <input
                          className={ps.idHeadlineInput}
                          value={profileForm.headline}
                          placeholder="Título profissional (ex.: Senior Fullstack Developer)"
                          aria-label="Título profissional"
                          onChange={(e) =>
                            handleProfileFieldChange('headline', e.target.value)
                          }
                        />
                        <div className={ps.idBadges}>
                          <span className={`${ps.pill} ${ps.pillBlue}`}>
                            {profileCompletion.isProfileComplete
                              ? 'Perfil completo'
                              : `${strengthScore}% completo`}
                          </span>
                          {(profileVisibility.verified ||
                            profile?.verificationStatus === 'verified') && (
                            <span className={`${ps.pill} ${ps.pillGreen}`}>
                              Verificado
                            </span>
                          )}
                          {profileVisibility.highlighted && (
                            <span className={`${ps.pill} ${ps.pillViolet}`}>
                              Em destaque
                            </span>
                          )}
                        </div>
                      </div>
                    </section>

                    {/* Informações Pessoais */}
                    <section className={ps.card}>
                      <div className={ps.cardHead}>
                        <span className={ps.cardTitle}>
                          <span className={ps.cardIcon}>
                            <FiUser />
                          </span>
                          Informações Pessoais
                        </span>
                      </div>
                      <div className={ps.formGrid}>
                        <label className={ps.field}>
                          <span className={ps.label}>Nome Completo</span>
                          <input
                            className={ps.input}
                            value={profileForm.name}
                            onChange={(e) =>
                              handleProfileFieldChange('name', e.target.value)
                            }
                          />
                        </label>
                        <label className={ps.field}>
                          <span className={ps.label}>E-mail Profissional</span>
                          <input
                            className={ps.input}
                            value={profileEmail}
                            readOnly
                          />
                        </label>
                        <label className={ps.field}>
                          <span className={ps.label}>Telemóvel</span>
                          <input
                            className={ps.input}
                            value={profileForm.phone}
                            onChange={(e) =>
                              handleProfileFieldChange('phone', e.target.value)
                            }
                          />
                        </label>
                        <label className={ps.field}>
                          <span className={ps.label}>Localização</span>
                          <span className={ps.inputWrap}>
                            <FiMapPin
                              className={ps.inputIcon}
                              aria-hidden="true"
                            />
                            <input
                              className={ps.input}
                              value={profileForm.location}
                              onChange={(e) =>
                                handleProfileFieldChange(
                                  'location',
                                  e.target.value,
                                )
                              }
                            />
                          </span>
                        </label>
                        <label className={ps.field}>
                          <span className={ps.label}>Data de Nascimento</span>
                          <input
                            className={ps.input}
                            type="date"
                            value={profileForm.birthDate}
                            onChange={(e) =>
                              handleProfileFieldChange(
                                'birthDate',
                                e.target.value,
                              )
                            }
                          />
                        </label>
                        <label className={ps.field}>
                          <span className={ps.label}>Nacionalidade</span>
                          <input
                            className={ps.input}
                            value={profileForm.nationality}
                            onChange={(e) =>
                              handleProfileFieldChange(
                                'nationality',
                                e.target.value,
                              )
                            }
                          />
                        </label>
                        <label className={ps.field}>
                          <span className={ps.label}>Género</span>
                          <select
                            className={ps.select}
                            value={profileForm.gender}
                            onChange={(e) =>
                              handleProfileFieldChange('gender', e.target.value)
                            }
                          >
                            <option value="">Selecionar...</option>
                            <option value="Masculino">Masculino</option>
                            <option value="Feminino">Feminino</option>
                            <option value="Outro">Outro</option>
                          </select>
                        </label>
                        <label className={ps.field}>
                          <span className={ps.label}>Estado Civil</span>
                          <input
                            className={ps.input}
                            value={profileForm.maritalStatus}
                            onChange={(e) =>
                              handleProfileFieldChange(
                                'maritalStatus',
                                e.target.value,
                              )
                            }
                          />
                        </label>
                        <label className={`${ps.field} ${ps.fieldWide}`}>
                          <span className={ps.label}>LinkedIn</span>
                          <span className={ps.importRow}>
                            <input
                              className={ps.input}
                              placeholder="https://linkedin.com/in/…"
                              value={profileForm.linkedin}
                              onChange={(e) =>
                                handleProfileFieldChange(
                                  'linkedin',
                                  e.target.value,
                                )
                              }
                            />
                            <button
                              type="button"
                              className={ps.importBtn}
                              onClick={handleImportLinkedIn}
                            >
                              Importar
                            </button>
                          </span>
                        </label>
                        <label className={`${ps.field} ${ps.fieldWide}`}>
                          <span className={ps.label}>Website / Portfólio</span>
                          <input
                            className={ps.input}
                            value={profileForm.website}
                            onChange={(e) =>
                              handleProfileFieldChange(
                                'website',
                                e.target.value,
                              )
                            }
                          />
                        </label>
                      </div>
                    </section>

                    {/* Objetivo Profissional */}
                    <section className={ps.card}>
                      <div className={ps.cardHead}>
                        <span className={ps.cardTitle}>
                          <span className={ps.cardIcon}>
                            <FiTarget />
                          </span>
                          Objetivo Profissional
                        </span>
                      </div>
                      <div className={ps.formGridTwo}>
                        <label className={ps.field}>
                          <span className={ps.label}>Área de Interesse</span>
                          <input
                            className={ps.input}
                            value={profileForm.objectiveArea}
                            onChange={(e) =>
                              handleProfileFieldChange(
                                'objectiveArea',
                                e.target.value,
                              )
                            }
                          />
                        </label>
                        <label className={ps.field}>
                          <span className={ps.label}>
                            Tipo (Integral, Remoto…)
                          </span>
                          <input
                            className={ps.input}
                            value={profileForm.objectiveType}
                            onChange={(e) =>
                              handleProfileFieldChange(
                                'objectiveType',
                                e.target.value,
                              )
                            }
                          />
                        </label>
                      </div>
                      <label className={ps.field}>
                        <span className={ps.label}>Aspirações de carreira</span>
                        <textarea
                          className={ps.textarea}
                          value={profileForm.objectiveAspiration}
                          onChange={(e) =>
                            handleProfileFieldChange(
                              'objectiveAspiration',
                              e.target.value,
                            )
                          }
                        />
                      </label>
                    </section>

                    {/* Resumo Profissional */}
                    <section className={ps.card}>
                      <div className={ps.cardHead}>
                        <span className={ps.cardTitle}>
                          <span className={ps.cardIcon}>
                            <FiFileText />
                          </span>
                          Resumo Profissional
                        </span>
                      </div>
                      {/* O título está no cabeçalho do cartão, não num
                          <label>, pelo que o campo ficava sem nome acessível. */}
                      <textarea
                        aria-label="Resumo profissional"
                        className={ps.textarea}
                        value={profileForm.bio}
                        onChange={(e) =>
                          handleProfileFieldChange('bio', e.target.value)
                        }
                      />
                    </section>

                    {/* Experiência Profissional */}
                    <section className={ps.card}>
                      <div className={ps.cardHead}>
                        <span className={ps.cardTitle}>
                          <span className={ps.cardIcon}>
                            <FiBriefcase />
                          </span>
                          Experiência Profissional
                        </span>
                        <button
                          type="button"
                          className={ps.addLink}
                          onClick={handleAddExperience}
                        >
                          <FiPlusCircle /> Adicionar
                        </button>
                      </div>
                      <div className={ps.expList}>
                        {profileForm.experiences.map((exp, index) => (
                          <div className={ps.expItem} key={index}>
                            <div className={ps.expGrid}>
                              <input
                                className={ps.input}
                                placeholder="Cargo"
                                value={exp.role}
                                onChange={(e) =>
                                  handleExperienceChange(
                                    index,
                                    'role',
                                    e.target.value,
                                  )
                                }
                              />
                              <input
                                className={ps.input}
                                placeholder="Empresa"
                                value={exp.company}
                                onChange={(e) =>
                                  handleExperienceChange(
                                    index,
                                    'company',
                                    e.target.value,
                                  )
                                }
                              />
                              <input
                                className={ps.input}
                                placeholder="Período (ex.: 2022 - Atual)"
                                value={exp.period}
                                onChange={(e) =>
                                  handleExperienceChange(
                                    index,
                                    'period',
                                    e.target.value,
                                  )
                                }
                              />
                              <textarea
                                className={ps.textarea}
                                placeholder="Descrição"
                                value={exp.description}
                                onChange={(e) =>
                                  handleExperienceChange(
                                    index,
                                    'description',
                                    e.target.value,
                                  )
                                }
                              />
                            </div>
                            <button
                              type="button"
                              className={ps.removeLink}
                              onClick={() => handleRemoveExperience(index)}
                            >
                              Remover
                            </button>
                          </div>
                        ))}
                      </div>
                    </section>

                    {/* Certificados & Comprovativos */}
                    <section className={ps.card}>
                      <div className={ps.cardHead}>
                        <span className={ps.cardTitle}>
                          <span className={ps.cardIcon}>
                            <FiAward />
                          </span>
                          Certificados & Comprovativos
                        </span>
                      </div>
                      <label className={ps.field}>
                        <span className={ps.label}>
                          Certificações (texto livre)
                        </span>
                        <textarea
                          className={ps.textarea}
                          value={profileForm.certifications}
                          onChange={(e) =>
                            handleProfileFieldChange(
                              'certifications',
                              e.target.value,
                            )
                          }
                        />
                      </label>
                      <p className={ps.hint} style={{ marginTop: '14px' }}>
                        Anexe comprovativos em PDF
                      </p>
                      {/* Upload de certificados nunca é exclusivo de
                          plano — só a quantidade tem limite, aplicado em
                          handleCertUpload. */}
                      <label className={ps.certUploadBtn}>
                        <FiUploadCloud aria-hidden="true" /> Enviar
                        certificados
                        <input
                          type="file"
                          multiple
                          accept=".pdf"
                          className={ps.hiddenFile}
                          onChange={handleCertUpload}
                        />
                      </label>
                      {profileForm.certificateFiles.length > 0 && (
                        <ul className={ps.certList}>
                          {profileForm.certificateFiles.map((url, i) => (
                            <li className={ps.certItem} key={i}>
                              <a
                                className={ps.certLink}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <FiFileText aria-hidden="true" /> Documento{' '}
                                {i + 1}
                              </a>
                              <button
                                type="button"
                                className={ps.removeLink}
                                onClick={() => removeCertificate(i)}
                              >
                                Remover
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  </div>

                  {/* RIGHT COLUMN */}
                  <div className={ps.col}>
                    {/* Competências */}
                    <section className={ps.card}>
                      <div className={ps.cardHead}>
                        <span className={ps.cardTitle}>Competências</span>
                      </div>
                      <div className={ps.skillsGroup}>
                        <div className={ps.field}>
                          <span className={ps.label}>
                            Hard skills (separadas por vírgula)
                          </span>
                          <input
                            aria-label="Hard skills, separadas por vírgula"
                            className={ps.input}
                            value={profileForm.skills}
                            onChange={(e) =>
                              handleProfileFieldChange('skills', e.target.value)
                            }
                          />
                          {hardSkillChips.length > 0 && (
                            <div className={ps.chipsPreview}>
                              {hardSkillChips.map((s) => (
                                <span className={ps.chip} key={s}>
                                  {s}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className={ps.field}>
                          <span className={ps.label}>
                            Soft skills (separadas por vírgula)
                          </span>
                          <input
                            aria-label="Soft skills, separadas por vírgula"
                            className={ps.input}
                            value={profileForm.skillsSoft}
                            onChange={(e) =>
                              handleProfileFieldChange(
                                'skillsSoft',
                                e.target.value,
                              )
                            }
                          />
                          {softSkillChips.length > 0 && (
                            <div className={ps.chipsPreview}>
                              {softSkillChips.map((s) => (
                                <span
                                  className={`${ps.chip} ${ps.chipLime}`}
                                  key={s}
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className={ps.field}>
                          <span className={ps.label}>
                            Competências digitais
                          </span>
                          <form
                            onSubmit={addDigitalSkill}
                            className={ps.digitalForm}
                          >
                            <input
                              name="skill"
                              className={ps.input}
                              placeholder="Adicionar ferramenta…"
                            />
                            <button
                              type="submit"
                              className={ps.addBtn}
                              aria-label="Adicionar competência digital"
                            >
                              <FiPlus />
                            </button>
                          </form>
                          {profileForm.digitalSkills.length > 0 && (
                            <div className={ps.chipsPreview}>
                              {profileForm.digitalSkills.map((s) => (
                                <span className={ps.chip} key={s}>
                                  {s}
                                  <button
                                    type="button"
                                    className={ps.chipX}
                                    onClick={() => removeDigitalSkill(s)}
                                    aria-label={`Remover ${s}`}
                                  >
                                    <FiX />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </section>

                    {/* Educação */}
                    <section className={ps.card}>
                      <div className={ps.cardHead}>
                        <span className={ps.cardTitle}>
                          <span className={ps.cardIcon}>
                            <FiBookOpen />
                          </span>
                          Educação
                        </span>
                      </div>
                      <p className={ps.hint}>
                        Linha por linha: Curso; Instituição; Ano
                      </p>
                      <textarea
                        aria-label="Educação"
                        className={ps.textarea}
                        value={profileForm.education}
                        onChange={(e) =>
                          handleProfileFieldChange('education', e.target.value)
                        }
                      />
                    </section>

                    {/* Idiomas */}
                    <section className={ps.card}>
                      <div className={ps.cardHead}>
                        <span className={ps.cardTitle}>
                          <span className={ps.cardIcon}>
                            <FiGlobe />
                          </span>
                          Idiomas
                        </span>
                      </div>
                      <p className={ps.hint}>Linha por linha: Idioma; Nível</p>
                      <textarea
                        aria-label="Idiomas"
                        className={ps.textarea}
                        value={profileForm.languages}
                        onChange={(e) =>
                          handleProfileFieldChange('languages', e.target.value)
                        }
                      />
                    </section>

                    {/* Currículo */}
                    <section className={ps.card}>
                      <div className={ps.cardHead}>
                        <span className={ps.cardTitle}>
                          <span className={ps.cardIcon}>
                            <FiFileText />
                          </span>
                          Currículo
                        </span>
                      </div>
                      <div className={ps.cvBox}>
                        <span className={ps.cvName}>
                          {cvState.name || 'Nenhum CV'}
                        </span>
                        {cvState.url && (
                          <a
                            className={ps.cvLink}
                            href={cvState.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Ver CV
                          </a>
                        )}
                        <label className={ps.cvBtn}>
                          <FiUploadCloud aria-hidden="true" />
                          {cvState.uploading ? 'Enviando...' : 'Atualizar CV'}
                          <input
                            type="file"
                            accept="application/pdf"
                            className={ps.hiddenFile}
                            onChange={handleCvChange}
                          />
                        </label>
                      </div>
                    </section>

                    {/* Força do Perfil */}
                    <section className={ps.strengthCard}>
                      <h3 className={ps.strengthTitle}>
                        <FiZap aria-hidden="true" /> Força do Perfil
                      </h3>
                      <div className={ps.strengthRow}>
                        <span className={ps.strengthLabel}>
                          {strengthLabel}
                        </span>
                        <span className={ps.strengthPct}>{strengthScore}%</span>
                      </div>
                      <div className={ps.strengthTrack}>
                        <div
                          className={ps.strengthFill}
                          style={{ width: `${strengthScore}%` }}
                        />
                      </div>
                      <p className={ps.strengthText}>
                        Complete o seu perfil e faça a verificação para atrair
                        mais recrutadores.
                      </p>
                      <button
                        type="button"
                        className={ps.strengthBtn}
                        onClick={() => openTab('verification')}
                      >
                        <FiZap aria-hidden="true" /> Melhorar Perfil
                      </button>
                    </section>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className={styles.contentArea}>
            <div className={styles.profileHeader}>
              <div
                className={`${styles.profileCover} ${styles.profileCoverEditable} ${!hasProfileCover ? styles.profileCoverEmpty : ''}`}
                style={
                  hasProfileCover
                    ? {
                        backgroundImage: `url(${profileCoverUrl})`,
                      }
                    : undefined
                }
              >
                <div
                  className={`${styles.coverOverlay} ${!hasProfileCover ? styles.coverOverlaySoft : ''}`}
                />
                {editingProfile && (
                  <label className={styles.editCoverBtn}>
                    {coverUploading ? 'Enviando...' : '📷 Alterar Capa'}
                    <input
                      type="file"
                      className={styles.hiddenFileInput}
                      accept="image/*"
                      onChange={(e) => handlePhotoUpload(e, 'cover')}
                    />
                  </label>
                )}
              </div>
              <div className={styles.profileInfo}>
                <div className={styles.avatarEditWrap}>
                  {hasProfileAvatar ? (
                    <Image
                      src={profileAvatarUrl}
                      alt={profileDisplayName}
                      className={styles.profileAvatar}
                      width={144}
                      height={144}
                      unoptimized
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
                        onChange={(e) => handlePhotoUpload(e, 'avatar')}
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
                          handleProfileFieldChange('name', e.target.value)
                        }
                      />
                      <input
                        className={styles.profileInput}
                        value={profileForm.headline}
                        onChange={(e) =>
                          handleProfileFieldChange('headline', e.target.value)
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
                    {profile?.city || profile?.location || user?.location} •{' '}
                    {profile?.email || user?.email}
                  </p>
                  <div className={styles.profileHeaderBadges}>
                    <span
                      className={`${styles.profileHeaderBadge} ${profileCompletion.isProfileComplete ? styles.profileHeaderBadgeComplete : styles.profileHeaderBadgeMuted}`}
                    >
                      {profileCompletion.isProfileComplete
                        ? 'Perfil completo'
                        : `${profileCompletion.score}% completo`}
                    </span>
                    {(profileVisibility.verified ||
                      profile?.verificationStatus === 'verified') && (
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
                        {profileSaving ? 'Salvando...' : 'Salvar'}
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
                    profileFeedback.type === 'error'
                      ? styles.profileError
                      : styles.profileSuccess
                  }
                >
                  {profileFeedback.message}
                </p>
              )}
            </div>
            <div className={styles.profileGrid}>
              <>
                <div className={styles.profileCard}>
                  <h3>Resumo</h3>
                  <p>{profile?.bio || user?.bio}</p>
                  {(profile?.objectiveArea || user?.objectiveArea) && (
                    <div className={styles.profileObjective}>
                      <p className={styles.profileObjectiveValue}>
                        🎯 Objetivo:{' '}
                        <span>
                          {profile?.objectiveArea || user?.objectiveArea}{' '}
                          {profile?.objectiveType || user?.objectiveType
                            ? `(${profile?.objectiveType || user?.objectiveType})`
                            : ''}
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
                      {cvState.name || 'Nenhum CV'}
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
                      {cvState.uploading ? 'Enviando...' : 'Atualizar CV'}
                    </label>
                  </div>
                </div>

                <div className={styles.profileCardWide}>
                  <h3>Experiência</h3>
                  <div className={styles.timelineList}>
                    {(() => {
                      const experienceItems = Array.isArray(profile?.experience)
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
                        const role = exp?.role || exp?.title || '';
                        const company =
                          exp?.company ||
                          exp?.employer ||
                          exp?.organization ||
                          '';
                        const period = exp?.period || exp?.dateRange || '';
                        const description =
                          exp?.description || exp?.details || '';
                        return (
                          <article key={`${company || 'exp'}-${index}`}>
                            <h4>{role || 'Experiência profissional'}</h4>
                            {company || period ? (
                              <p className={styles.profileMeta}>
                                {[company, period].filter(Boolean).join(' • ')}
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
                  (profile?.certificateFiles || user?.certificateFiles).length >
                    0 && (
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
            </div>
          </div>
        );
      }

      case 'messages':
        return (
          <div className={styles.contentArea}>
            <CandidateSectionHeader
              eyebrow="Conversas"
              title="Mensagens"
              description="Mantenha as conversas com empresas organizadas num só lugar."
              count={unreadMessages ? `${unreadMessages} por ler` : 'Em dia'}
            />
            <div className={styles.messagesLayout}>
              <div className={styles.messagesList}>
                {conversations.length === 0 ? (
                  <div className={styles.messagesListEmpty}>
                    <FiMessageCircle aria-hidden="true" />
                    <strong>Sem conversas</strong>
                    <span>As mensagens das empresas aparecerão aqui.</span>
                  </div>
                ) : (
                  conversations.map((conversation) => {
                    const initials = (conversation.participant.name || 'U')
                      .charAt(0)
                      .toUpperCase();
                    const timeLabel = conversation.lastMessageAt
                      ? new Date(conversation.lastMessageAt).toLocaleDateString(
                          'pt-PT',
                          { day: '2-digit', month: '2-digit' },
                        )
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
                            <Image
                              src={conversation.participant.avatar}
                              alt={conversation.participant.name}
                              width={44}
                              height={44}
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
                                      'pt-PT',
                                      { hour: '2-digit', minute: '2-digit' },
                                    )
                                  : ''}
                              </time>
                            </div>
                          );
                        })
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                    {messageSendError ? (
                      <p
                        id="candidate-message-send-error"
                        className={styles.messageSendError}
                        role="alert"
                      >
                        {messageSendError}
                      </p>
                    ) : null}
                    <div className={styles.messageFooter}>
                      <input
                        type="text"
                        value={messageInput}
                        onChange={(e) => {
                          setMessageInput(e.target.value);
                          if (messageSendError) setMessageSendError('');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        placeholder="Escreva uma mensagem..."
                        aria-label="Mensagem para a empresa"
                        aria-describedby={
                          messageSendError
                            ? 'candidate-message-send-error'
                            : undefined
                        }
                        className={styles.messageTextInput}
                        disabled={sendingMessage}
                        maxLength={2000}
                      />
                      <button
                        type="button"
                        className={styles.messageSendBtn}
                        onClick={handleSendMessage}
                        disabled={sendingMessage || !messageInput.trim()}
                        aria-label={
                          sendingMessage
                            ? 'A enviar mensagem'
                            : 'Enviar mensagem'
                        }
                      >
                        {sendingMessage ? (
                          '…'
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
                    <FiMessageCircle aria-hidden="true" />
                    <strong>Selecione uma conversa</strong>
                    <p>
                      Escolha uma empresa na lista para consultar o histórico.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className={styles.contentArea}>
            <CandidateSectionHeader
              eyebrow="Atualizações"
              title="Notificações"
              description="Acompanhe respostas, entrevistas e alterações importantes."
              count={
                unreadNotifications
                  ? `${unreadNotifications} por ler`
                  : 'Em dia'
              }
              action={
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={markAllNotificationsAsRead}
                  disabled={!unreadNotifications}
                >
                  Marcar todas como lidas
                </button>
              }
            />
            <div className={styles.notificationsWrapper}>
              <div className={styles.notificationsHeader}>
                <span>Mais recentes primeiro</span>
              </div>
              <div className={styles.notificationList}>
                {notifications.map((notif) => (
                  <button
                    type="button"
                    key={notif.id}
                    className={`${styles.notificationItem} ${notif.read ? styles.notificationRead : ''}`}
                    onClick={() => markNotificationAsRead(notif.id)}
                  >
                    <span
                      className={styles.notificationIndicator}
                      aria-hidden="true"
                    />
                    <div>
                      <strong>{notif.title || 'Notificação'}</strong>
                      <p>
                        {notif.message ||
                          'Existe uma nova atualização na sua conta.'}
                      </p>
                    </div>
                    <span className={styles.notificationTime}>
                      {notif.createdAt
                        ? new Date(notif.createdAt).toLocaleString('pt-PT')
                        : ''}
                    </span>
                  </button>
                ))}
                {!notifications.length && (
                  <CandidateEmptyState
                    icon={FiBell}
                    title="Está tudo em dia"
                    description="As novas atualizações sobre candidaturas e entrevistas aparecerão aqui."
                  />
                )}
              </div>
            </div>
          </div>
        );

      case 'plans':
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

      case 'applications':
        return (
          <div className={styles.contentArea}>
            <CandidateSectionHeader
              eyebrow="Acompanhamento"
              title="Minhas candidaturas"
              description="Consulte o estado de cada processo e prepare os próximos passos."
              count={applications.length}
              action={
                <Link
                  href="/dashboard/candidato/candidaturas"
                  className={styles.secondaryButton}
                >
                  Ver histórico detalhado
                </Link>
              }
            />
            {upcomingInterviews.length > 0 && (
              <section className={styles.candidateSubsection}>
                <div className={styles.candidateSubsectionHeader}>
                  <span className={styles.candidateSubsectionIcon}>
                    <FiCalendar aria-hidden="true" />
                  </span>
                  <div>
                    <h3>Próximas entrevistas</h3>
                    <p>Datas que exigem a sua atenção.</p>
                  </div>
                </div>
                <div className={`${styles.jobList} ${styles.jobListSpaced}`}>
                  {upcomingInterviews.map((application) => (
                    <div key={application.id} className={styles.jobCard}>
                      <div>
                        <p className={styles.jobTitle}>
                          {application.jobTitle || 'Vaga'}
                        </p>
                        <p className={styles.jobMeta}>
                          {application.company || 'Empresa'} •{' '}
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
              </section>
            )}
            {applications.length ? (
              <ApplicationTable applications={applications} />
            ) : (
              <CandidateEmptyState
                icon={FiBriefcase}
                title="Ainda não enviou candidaturas"
                description="Explore as vagas disponíveis e candidate-se às oportunidades alinhadas com o seu perfil."
                actionHref="/vagas"
                actionLabel="Procurar vagas"
              />
            )}
          </div>
        );

      case 'interviews':
        return (
          <div className={styles.contentArea}>
            <CandidateSectionHeader
              eyebrow="Agenda"
              title="Entrevistas"
              description="Consulte horários, locais e links antes de cada conversa."
              count={allInterviews.length}
              action={
                allInterviews.length ? (
                  <Link
                    href="/dashboard/candidato/candidaturas?filter=interview"
                    className={styles.secondaryButton}
                  >
                    Abrir agenda detalhada
                  </Link>
                ) : null
              }
            />
            {allInterviews.length ? (
              <div className={`${styles.jobList} ${styles.jobListSpaced}`}>
                {allInterviews.map((application) => (
                  <div key={application.id} className={styles.jobCard}>
                    <div>
                      <p className={styles.jobTitle}>
                        {application.jobTitle || 'Vaga'}
                      </p>
                      <p className={styles.jobMeta}>
                        {application.company || 'Empresa'} •{' '}
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
                      <div
                        style={{
                          display: 'flex',
                          gap: '0.5rem',
                          flexWrap: 'wrap',
                          marginTop: '0.75rem',
                        }}
                      >
                        <Link
                          href="/dashboard/candidato/candidaturas?filter=interview"
                          className={styles.secondaryButton}
                          style={{ padding: '0.45rem 0.75rem' }}
                        >
                          Ver detalhes
                        </Link>
                        <button
                          type="button"
                          onClick={() =>
                            downloadInterviewICS(application.id).catch((err) =>
                              console.error(err),
                            )
                          }
                          className={styles.secondaryButton}
                          style={{ padding: '0.45rem 0.75rem' }}
                        >
                          <FiCalendar aria-hidden="true" /> Calendário
                        </button>
                      </div>
                    </div>
                    <div className={styles.jobBadge}>Entrevista</div>
                  </div>
                ))}
              </div>
            ) : (
              <CandidateEmptyState
                icon={FiCalendar}
                title="Sem entrevistas agendadas"
                description="Quando uma empresa marcar uma entrevista, os detalhes e ações aparecerão aqui."
                actionHref="/dashboard/candidato?tab=applications"
                actionLabel="Ver candidaturas"
              />
            )}
          </div>
        );

      case 'saved':
        return (
          <div className={styles.contentArea}>
            <CandidateSectionHeader
              eyebrow="A sua seleção"
              title="Vagas guardadas"
              description="Compare oportunidades e retome a candidatura quando estiver preparado."
              count={savedJobs.length}
              action={
                <Link href="/vagas" className={styles.secondaryButton}>
                  Encontrar mais vagas
                </Link>
              }
            />
            {savedJobs.length ? (
              <div className={styles.savedList}>
                {savedJobs.map((job) => {
                  const jobId = job.jobId || job.vagaId || job.id;
                  const company =
                    job.empresa || job.company || 'Empresa não indicada';
                  const location =
                    job.localizacao || job.location || 'Local a confirmar';
                  const contract =
                    job.tipoContrato || job.contractType || job.jobType || '';

                  return (
                    <Link
                      key={jobId}
                      href={`/vaga/${jobId}`}
                      className={styles.savedCard}
                    >
                      <div className={styles.savedCardTop}>
                        <span
                          className={styles.savedCardIcon}
                          aria-hidden="true"
                        >
                          <FiBookmark />
                        </span>
                        <span className={styles.savedCardState}>Guardada</span>
                      </div>
                      <div className={styles.savedCardCopy}>
                        <h3>
                          {job.titulo || job.name || 'Título indisponível'}
                        </h3>
                        <p>{company}</p>
                      </div>
                      <div className={styles.savedCardMeta}>
                        <span>
                          <FiMapPin aria-hidden="true" /> {location}
                        </span>
                        {contract ? (
                          <span>
                            <FiBriefcase aria-hidden="true" /> {contract}
                          </span>
                        ) : null}
                      </div>
                      <span className={styles.savedCardAction}>
                        Ver detalhes <FiArrowRight aria-hidden="true" />
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <CandidateEmptyState
                icon={FiBookmark}
                title="Ainda não guardou vagas"
                description="Use o ícone de marcador nas vagas para criar uma lista curta e voltar mais tarde."
                actionHref="/vagas"
                actionLabel="Explorar vagas"
              />
            )}
          </div>
        );

      case 'verification':
        return (
          <div className={styles.contentArea}>
            <CandidateSectionHeader
              eyebrow="Confiança profissional"
              title="Verificação de perfil"
              description="Envie apenas os blocos que pretende validar. Os blocos aprovados permanecem preservados."
              count={`${verificationSummary?.progressPercent || 0}%`}
            />
            <div className={styles.verificationLayout}>
              <section className={styles.verificationWorkspace}>
                <div className={styles.verificationPanel}>
                  <div className={styles.verificationOverview}>
                    <div>
                      <span
                        className={`${styles.verificationStatusPill} ${styles[verificationOverallMeta.toneClass]}`}
                      >
                        {verificationOverallMeta.label}
                      </span>
                      <h3 className={styles.verificationOverviewTitle}>
                        Revisão modular de confiança
                      </h3>
                      <p className={styles.verificationOverviewText}>
                        {verificationOverallMeta.summary}
                      </p>
                      <p className={styles.verificationOverviewMeta}>
                        Último envio:{' '}
                        {verificationSummary?.lastSubmittedAt
                          ? formatDate(verificationSummary.lastSubmittedAt)
                          : 'Ainda não submetido'}
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
                        <span>Em análise</span>
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
                      A carregar o estado da verificação...
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
                              <span>{item.evidenceCount || 0} evidências</span>
                              <span>
                                {item.submittedAt
                                  ? `Atualizado em ${formatDate(item.submittedAt)}`
                                  : 'Sem submissao'}
                              </span>
                            </div>

                            {item.reviewReason && (
                              <div className={styles.verificationReviewNote}>
                                <strong>Observação da revisão:</strong>{' '}
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
                                      {check.completed ? 'OK' : '!'}
                                    </span>
                                    <span>{check.label}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className={styles.verificationTypeHint}>
                                Este bloco ainda não recebeu detalhes
                                suficientes para revisão.
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
                                        'Evidencia'}
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
                      className={`${styles.verificationBanner} ${verificationMessage.type === 'success' ? styles.verificationBannerSuccess : styles.verificationBannerError}`}
                    >
                      {verificationMessage.text}
                    </p>
                  )}

                  {!canRequestVerification ? (
                    <div className={styles.verificationLocked}>
                      <div className={styles.verificationLockedIcon}>
                        <FiLock aria-hidden="true" />
                      </div>
                      <div>
                        <h3 className={styles.verificationLockedTitle}>
                          Verificacao premium
                        </h3>
                        <p className={styles.verificationLockedText}>
                          O envio de novos blocos de verificação está disponível
                          nos planos Verificação e Premium. O histórico atual
                          continua visivel aqui.
                        </p>
                      </div>
                      <button
                        type="button"
                        className={styles.primaryButton}
                        onClick={() => openTab('plans')}
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
                            blocos já aprovados ficam preservados.
                          </p>
                        </div>
                        <span className={styles.verificationComposerMeta}>
                          {selectedVerificationTypes.length}{' '}
                          {selectedVerificationTypes.length === 1
                            ? 'tipo selecionado'
                            : 'tipos selecionados'}
                        </span>
                      </div>

                      <div className={styles.verificationTypeSelector}>
                        {verificationItems.map((item) => {
                          const disabled = item.status === 'approved';
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
                              className={`${styles.verificationTypeToggle} ${selected ? styles.verificationTypeToggleActive : ''} ${disabled ? styles.verificationTypeToggleDisabled : ''}`}
                              onClick={() =>
                                !disabled && toggleVerificationType(item.type)
                              }
                              disabled={disabled}
                            >
                              <strong>{item.label}</strong>
                              <span>
                                {disabled
                                  ? 'Já aprovado'
                                  : itemStatusMeta.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {selectedVerificationTypes.length === 0 ? (
                        <div className={styles.verificationEmptySelection}>
                          Todos os blocos editáveis já estão aprovados. Se
                          quiser rever novos tipos, escolha um bloco ainda não
                          aprovado.
                        </div>
                      ) : (
                        <div className={styles.verificationFormStack}>
                          {selectedVerificationTypes.includes('identity') && (
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
                                        'contactEmail',
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
                                        'contactPhone',
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
                                      : 'Documento de identidade'}
                                  </span>
                                  <input
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={(event) =>
                                      handleVerificationFileChange(
                                        'identityDocument',
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
                                      : 'Selfie com documento'}
                                  </span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(event) =>
                                      handleVerificationFileChange(
                                        'selfieDocument',
                                        event.target.files,
                                      )
                                    }
                                  />
                                </label>
                              </div>
                            </section>
                          )}

                          {selectedVerificationTypes.includes(
                            'certificates',
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
                                    'certificationsText',
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
                                    : 'Anexar certificados'}
                                </span>
                                <input
                                  type="file"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  multiple
                                  onChange={(event) =>
                                    handleVerificationFileChange(
                                      'certificateDocuments',
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

                          {selectedVerificationTypes.includes('academic') && (
                            <section className={styles.verificationFormCard}>
                              <div
                                className={styles.verificationFormCardHeader}
                              >
                                <h4>Formação académica</h4>
                                <p>
                                  Resuma o percurso académico e anexe
                                  comprovativos se tiver.
                                </p>
                              </div>
                              <label className={styles.verificationFieldLabel}>
                                Resumo académico
                              </label>
                              <textarea
                                className={styles.profileTextarea}
                                rows={4}
                                value={verificationForm.educationSummary}
                                onChange={(event) =>
                                  handleVerificationFieldChange(
                                    'educationSummary',
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
                                    : 'Anexar diploma ou declaracao'}
                                </span>
                                <input
                                  type="file"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  onChange={(event) =>
                                    handleVerificationFileChange(
                                      'academicDocument',
                                      event.target.files,
                                    )
                                  }
                                />
                              </label>
                            </section>
                          )}

                          {selectedVerificationTypes.includes('experience') && (
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
                                Resumo da experiência
                              </label>
                              <textarea
                                className={styles.profileTextarea}
                                rows={4}
                                value={verificationForm.experienceSummary}
                                onChange={(event) =>
                                  handleVerificationFieldChange(
                                    'experienceSummary',
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
                                    <span>
                                      <FiFileText aria-hidden="true" />
                                    </span>
                                    <span
                                      className={
                                        styles.verificationExistingCvName
                                      }
                                    >
                                      {profile?.cvName ||
                                        'CV atual guardado no perfil'}
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
                                      : 'Comprovativo de experiência'}
                                  </span>
                                  <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={(event) =>
                                      handleVerificationFileChange(
                                        'employmentProof',
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
                                      : 'Novo CV em PDF (opcional)'}
                                  </span>
                                  <input
                                    type="file"
                                    accept=".pdf"
                                    onChange={(event) =>
                                      handleVerificationFileChange(
                                        'cvDocument',
                                        event.target.files,
                                      )
                                    }
                                  />
                                </label>
                              </div>
                            </section>
                          )}

                          {selectedVerificationTypes.includes(
                            'competencies',
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
                                Notas sobre competências
                              </label>
                              <textarea
                                className={styles.profileTextarea}
                                rows={4}
                                value={verificationForm.competencyNotes}
                                onChange={(event) =>
                                  handleVerificationFieldChange(
                                    'competencyNotes',
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
                                        'portfolioUrl',
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
                                        'linkedin',
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
                                    : 'Comprovativo adicional de competências'}
                                </span>
                                <input
                                  type="file"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  onChange={(event) =>
                                    handleVerificationFileChange(
                                      'competencyDocument',
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
                            ? 'A enviar...'
                            : 'Enviar para revisão'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <aside className={styles.verificationGuide}>
                <span
                  className={styles.verificationGuideIcon}
                  aria-hidden="true"
                >
                  <FiCheckCircle />
                </span>
                <h3>Como funciona</h3>
                <ul className={styles.planFeatures}>
                  <li>
                    O selo público depende da aprovação do bloco de identidade.
                  </li>
                  <li>
                    Certificados, formação, experiência e competências podem ser
                    enviados e revistos separadamente.
                  </li>
                  <li>
                    Blocos aprovados ficam preservados quando atualiza um novo
                    pedido.
                  </li>
                </ul>
                <h3>Valor para o perfil</h3>
                <ul className={styles.planFeatures}>
                  <li>Mais confiança perante empresas e recrutadores.</li>
                  <li>Melhor leitura editorial da qualidade do perfil.</li>
                  <li>
                    Base para destaque e ranking mais forte no banco de
                    talentos.
                  </li>
                </ul>
              </aside>
            </div>
          </div>
        );

      case 'affiliate':
        return (
          <div className={styles.contentArea}>
            <AffiliateSection
              role="candidato"
              user={user}
              defaults={{
                fullName:
                  profile?.fullName || profile?.name || user?.name || '',
                email: profile?.email || user?.email || '',
                phone: profile?.phone || '',
                location: profile?.city || '',
                occupation: profile?.headline || profile?.profession || '',
              }}
            />
          </div>
        );

      case 'settings':
        return (
          <div className={styles.contentArea}>
            <CandidateSettings
              profile={profile}
              user={user}
              searchQuery={settingsSearchQuery}
              onSettingsSaved={(nextSettings) =>
                setProfile((current) => ({
                  ...(current || {}),
                  settings: nextSettings,
                }))
              }
              onOpenSupport={() => openTab('messages')}
            />
          </div>
        );

      default:
        return null;
    }
  };

  const activeLabel =
    NAV_MENU.find((item) => item.id === activeTab)?.label || 'Dashboard';

  const today = new Date();
  const formattedDate = today.toLocaleDateString('pt-PT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const topbarSubtitle =
    activeTab === 'dashboard'
      ? `Bem-vindo de volta, ${firstName}`
      : formattedDate;

  const planName = planStatusLoaded
    ? activePlan.planName || 'Gratuito'
    : null;
  const candidatoNav = [
    {
      label: 'Menu principal',
      items: [
        {
          key: 'dashboard',
          label: 'Visão geral',
          icon: 'home',
          onClick: () => openTab('dashboard'),
        },
        {
          key: 'applications',
          label: 'Candidaturas',
          icon: 'send',
          onClick: () => openTab('applications'),
          badge: applications.length || undefined,
        },
        {
          key: 'saved',
          label: 'Vagas guardadas',
          icon: 'bookmark',
          onClick: () => openTab('saved'),
          badge: savedJobs.length || undefined,
        },
        {
          key: 'interviews',
          label: 'Entrevistas',
          icon: 'calendar',
          onClick: () => openTab('interviews'),
          badge: allInterviews.length || undefined,
          badgeStyle: 'lime',
        },
      ],
    },
    {
      label: 'Ferramentas',
      items: [
        {
          key: 'cv-generator',
          label: 'Gerador de CV',
          icon: 'fileText',
          href: '/recursos/gerador-cv',
        },
        {
          key: 'verification',
          label: 'Verificação',
          icon: 'verification',
          onClick: () => openTab('verification'),
        },
        {
          key: 'plans',
          label: 'Planos premium',
          icon: 'star',
          onClick: () => openTab('plans'),
        },
      ],
    },
    {
      label: 'Mais',
      items: [
        {
          key: 'messages',
          label: 'Mensagens',
          icon: 'messages',
          onClick: () => openTab('messages'),
          badge: unreadMessages || undefined,
        },
        {
          key: 'notifications',
          label: 'Notificações',
          icon: 'bell',
          onClick: () => openTab('notifications'),
          badge: unreadNotifications || undefined,
        },
        {
          key: 'settings',
          label: 'Configurações',
          icon: 'settings',
          onClick: () => openTab('settings'),
        },
        {
          key: 'affiliate',
          label: 'Ser afiliado',
          icon: 'dollar',
          onClick: () => openTab('affiliate'),
        },
      ],
    },
  ];

  return (
    <>
      <Head>
        <title>Dashboard Candidato | EmpregoSTP</title>
        <meta
          name="description"
          content="Gerencie suas candidaturas e perfil no EmpregoSTP"
        />
      </Head>
      <DashboardShell
        role="candidato"
        active={activeTab}
        title={activeTab === 'dashboard' ? 'Visão geral' : activeLabel}
        subtitle={topbarSubtitle}
        nav={candidatoNav}
        onLogout={handleLogout}
        searchPlaceholder={
          activeTab === 'dashboard'
            ? 'Pesquisar vagas...'
            : activeTab === 'settings'
              ? 'Pesquisar configurações...'
              : undefined
        }
        searchValue={
          activeTab === 'dashboard' ? dashboardSearchQuery : settingsSearchQuery
        }
        onSearchChange={
          activeTab === 'dashboard'
            ? setDashboardSearchQuery
            : activeTab === 'settings'
              ? setSettingsSearchQuery
              : undefined
        }
        onProfileClick={() => openTab('profile')}
        profileInTopbar
        topbarActions={
          <div className="dash-notif-wrap">
            <button
              type="button"
              className="dash-icon-btn"
              onClick={() => {
                setNotificationsOpen((prev) => {
                  const next = !prev;
                  if (!prev && next) fetchNotificationsRealtime();
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
                    onClick={markAllNotificationsAsRead}
                    disabled={!unreadNotifications}
                  >
                    Marcar todas
                  </button>
                </div>
                <div className="dash-notif-list">
                  {notifications.length === 0 ? (
                    <div className="dash-notif-empty">
                      Nenhuma notificação recente.
                    </div>
                  ) : (
                    notifications.slice(0, 8).map((notif) => (
                      <button
                        key={notif.id}
                        type="button"
                        className={`dash-notif-row${notif.read ? '' : ' unread'}`}
                        onClick={() => {
                          markNotificationAsRead(notif.id);
                          setNotificationsOpen(false);
                        }}
                        title={notif.message || notif.title || 'Notificação'}
                      >
                        <span className="dash-notif-ic">🔔</span>
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
                <div className="dash-notif-footer">
                  <button
                    type="button"
                    className="dash-notif-view-all"
                    onClick={() => {
                      setNotificationsOpen(false);
                      openTab('notifications');
                    }}
                  >
                    Ver todas as notificações
                    <FiArrowRight aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </div>
        }
        profile={{
          name: profileDisplayName,
          role: 'Candidato',
          // `undefined` enquanto carrega: mais honesto do que anunciar um
          // plano que ainda não sabemos qual é.
          plan: planName ? (planName === 'Gratuito' ? 'Free' : planName) : undefined,
          avatarUrl: profile?.photoUrl || user?.avatar || undefined,
        }}
      >
        {renderContent()}
      </DashboardShell>
    </>
  );
};

export default CandidateDashboard;

// Alinha esta rota com os dashboards de empresa e admin, que já bloqueavam no
// servidor: sem sessão, o utilizador deixa de ver a shell antes de ser
// redirecionado, e o destino pretendido é preservado.
export async function getServerSideProps(context) {
  const guard = await requireSession(context);
  if (guard) return guard;
  return { props: {} };
}
