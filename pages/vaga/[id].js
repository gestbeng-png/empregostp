import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import { getAuth } from 'firebase/auth';
import { useAuth } from '../../context/AuthContext';
import PublicPageShell from '../../components/PublicPageShell';
import UpgradeModal from '../../components/UpgradeModal';
import styles from '../../styles/VagaDetailPage.module.css';
import {
  FiArrowLeft,
  FiArrowRight,
  FiBookmark,
  FiBriefcase,
  FiCalendar,
  FiCheck,
  FiClock,
  FiDollarSign,
  FiDownload,
  FiFileText,
  FiFlag,
  FiGlobe,
  FiMail,
  FiMapPin,
  FiPhone,
  FiShare2,
  FiShield,
  FiStar,
  FiUsers,
  FiX,
  FiZap,
} from 'react-icons/fi';
import {
  buildCoverLetterSuggestion,
  evaluateCandidateJobAccess,
  getCandidatePremiumApplicationAccess,
  getJobApplicationPremiumConfig,
  normalizeCoverLetter,
} from '../../lib/candidateApplicationPremium';
import { analyzeCandidateJobFit } from '../../lib/candidateOptimizationInsights';
import { normalizeExternalUrl } from '../../lib/externalUrl';
import { projectPublicJob } from '../../lib/publicJob';
import { getPublicSkillsAssessment } from '../../lib/skillsAssessment';

function formatMoneyValue(value) {
  if (!value && value !== 0) return '';
  const raw = String(value)
    .trim()
    .replace(/\s/g, '')
    .replace(/[^\d,.-]/g, '');
  if (!raw) return '';

  let normalized = raw;
  if (raw.includes('.') && raw.includes(',')) {
    normalized =
      raw.lastIndexOf(',') > raw.lastIndexOf('.')
        ? raw.replace(/\./g, '').replace(',', '.')
        : raw.replace(/,/g, '');
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(raw)) {
    normalized = raw.replace(/\./g, '');
  } else if (/^-?\d{1,3}(,\d{3})+$/.test(raw)) {
    normalized = raw.replace(/,/g, '');
  } else {
    normalized = raw.replace(',', '.');
  }

  const numericValue = Number(normalized);
  if (!Number.isFinite(numericValue)) return '';
  return numericValue.toLocaleString('pt-PT', {
    maximumFractionDigits: 0,
  });
}

function formatCurrency(value, currency = 'STD') {
  const formatted = formatMoneyValue(value);
  return formatted ? `${formatted} ${currency}` : '';
}

function humanizeRangeLabel(value) {
  return String(value || '')
    .replace(/(\d+)\s*-\s*(\d+)/g, '$1 a $2')
    .replace(/(\d+)\+\s*anos/gi, 'Mais de $1 anos');
}

function formatDate(value) {
  if (!value) return 'Não informado';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatRelativeDate(value, now = Date.now()) {
  if (!value) return 'Data de publicação não informada';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data de publicação não informada';

  const diffMs = now - date.getTime();
  const diffDays = Math.max(0, Math.floor(diffMs / 86400000));

  if (diffDays === 0) return 'Publicada hoje';
  if (diffDays === 1) return 'Publicada há 1 dia';
  if (diffDays < 30) return `Publicada há ${diffDays} dias`;

  return `Publicada em ${formatDate(value)}`;
}

function isRecentlyPublished(value, now = Date.now()) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return false;
  const age = now - timestamp;
  return age >= 0 && age <= 24 * 60 * 60 * 1000;
}

function getJobModalityLabel(job = {}) {
  const text = `${job.modalidade || ''} ${job.regime || ''}`.toLowerCase();
  if (text.includes('híbrido') || text.includes('hibrido')) return 'Híbrido';
  if (text.includes('remoto') || job.remoto === true) return 'Remoto';
  if (text.includes('presencial')) return 'Presencial';
  return 'Não informado';
}

function formatDateTime(value) {
  if (!value) return 'Não informado';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-PT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function parseList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(/\n|,|;/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function parseParagraphs(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function resolveUrl(value) {
  if (!value) return '';
  let raw = '';
  if (typeof value === 'string') raw = value;
  if (Array.isArray(value)) return resolveUrl(value[0]);
  if (typeof value === 'object') {
    const common =
      value.url ||
      value.downloadURL ||
      value.link ||
      value.href ||
      value.path ||
      value.fullPath;
    if (typeof common === 'string') raw = common;
    for (const key in value) {
      if (raw) break;
      if (
        typeof value[key] === 'string' &&
        (value[key].startsWith('http') || value[key].startsWith('/'))
      ) {
        raw = value[key];
      }
    }
  }

  const candidate = String(raw || '').trim();
  if (!candidate) return '';
  if (candidate.startsWith('/') && !candidate.startsWith('//')) {
    return candidate;
  }
  return normalizeExternalUrl(candidate);
}

function getContractTypeLabel(value) {
  const types = {
    'full-time': 'Tempo integral',
    'part-time': 'Meio período',
    contract: 'Contrato',
    internship: 'Estágio',
    freelance: 'Freelance',
    estagio: 'Estágio',
    contrato: 'Contrato',
  };
  return (
    types[String(value || '').toLowerCase()] || value || 'Não especificado'
  );
}

function getStatusLabel(status) {
  const normalized = String(status || '').toLowerCase();
  if (!normalized || normalized === 'active' || normalized === 'open')
    return 'Aberta';
  if (normalized === 'closed') return 'Fechada';
  if (normalized === 'disabled' || normalized === 'inactive')
    return 'Desativada';
  if (normalized === 'draft') return 'Rascunho';
  return status || 'Não informado';
}

function getCompanyInitials(companyLabel) {
  return (
    String(companyLabel || 'Empresa')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'EM'
  );
}

function serializeFirestoreValue(value) {
  if (value === undefined) return null;
  if (value === null) return null;

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value?.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime())
      ? date.toISOString()
      : null;
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeFirestoreValue(item));
  }

  if (typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    const isPlainObject = proto === Object.prototype || proto === null;

    if (!isPlainObject) {
      return null;
    }

    return Object.keys(value).reduce((acc, key) => {
      acc[key] = serializeFirestoreValue(value[key]);
      return acc;
    }, {});
  }

  return null;
}

function serializeJob(job) {
  return serializeFirestoreValue(job) || {};
}

const BENEFIT_ICONS = [FiDollarSign, FiBriefcase, FiShield, FiGlobe];

function RelatedJobsPanel({ jobs, className = '', headingLevel = 'h3' }) {
  if (!jobs.length) return null;
  const Heading = headingLevel;

  return (
    <section
      className={`${styles.sidebarCard} ${styles.relatedCard} ${className}`}
    >
      <Heading className={styles.sidebarTitle}>Vagas semelhantes</Heading>
      <div className={styles.relatedList}>
        {jobs.map((job) => {
          const relatedCompanyLabel =
            job.empresaNome || job.companyName || job.localizacao || 'Empresa';

          return (
            <Link
              key={job.id}
              href={`/vaga/${job.id}`}
              className={styles.relatedItem}
            >
              <span className={styles.relatedLogo}>
                {job.companyLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={job.companyLogo}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    width="36"
                    height="36"
                  />
                ) : (
                  getCompanyInitials(relatedCompanyLabel)
                )}
              </span>
              <span className={styles.relatedBody}>
                <strong className={styles.relatedTitle}>{job.titulo}</strong>
                <span className={styles.relatedCompany}>
                  {relatedCompanyLabel}
                </span>
                <small className={styles.relatedSalary}>
                  {job.salarioResumo || 'A combinar'}
                </small>
              </span>
              <FiArrowRight
                className={styles.relatedArrow}
                size={16}
                aria-hidden="true"
              />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default function VagaDetalhe({
  vaga,
  relatedJobs = [],
  referenceNow = 0,
}) {
  const { user } = useAuth();
  const [applyStatus, setApplyStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [userType, setUserType] = useState(null);
  const [candidateProfileData, setCandidateProfileData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(Boolean(user));
  const [isSaved, setIsSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [upgradeModal, setUpgradeModal] = useState({
    open: false,
    message: '',
  });
  const [assessmentAnswers, setAssessmentAnswers] = useState([]);
  const [coverLetter, setCoverLetter] = useState('');
  const [isGeneratingCoverLetter, setIsGeneratingCoverLetter] = useState(false);
  const assessmentQuestions = useMemo(
    () => vaga?.skillsAssessment?.questions || [],
    [vaga?.skillsAssessment?.questions],
  );

  useEffect(() => {
    setAssessmentAnswers(new Array(assessmentQuestions.length).fill(null));
  }, [assessmentQuestions.length, vaga?.id, assessmentQuestions]);

  useEffect(() => {
    setCoverLetter('');
  }, [vaga?.id]);

  useEffect(() => {
    async function trackView() {
      if (!vaga?.id) return;

      try {
        await fetch('/api/track-view', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jobId: vaga.id,
            userId: user?.uid || null,
            source: 'job-detail',
          }),
        });
      } catch (err) {
        console.error('Erro ao registrar visualização:', err);
      }
    }

    trackView();
  }, [vaga?.id, user?.uid]);

  useEffect(() => {
    let active = true;
    setApplyStatus('idle');
    setErrorMsg('');

    async function checkExisting() {
      if (!user || !vaga?.id) return;
      try {
        const auth = getAuth();
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;

        const response = await fetch(`/api/applications?jobId=${vaga.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          if (active && data.applications && data.applications.length > 0) {
            setApplyStatus('success');
          }
        }
      } catch (_) {
        // ignore
      }
    }

    checkExisting();
    return () => {
      active = false;
    };
  }, [user, vaga?.id]);

  useEffect(() => {
    let active = true;
    setUserType(null);
    setCandidateProfileData(null);
    setProfileLoading(Boolean(user));

    async function loadProfile() {
      if (!user) {
        setProfileLoading(false);
        return;
      }
      try {
        const auth = getAuth();
        const token = await auth.currentUser?.getIdToken();
        if (!token) {
          if (active) setUserType(null);
          return;
        }

        const response = await fetch('/api/profile', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          const profilePayload = data?.profile?.data || null;
          if (!active) return;
          setUserType(profilePayload?.userType || null);
          setCandidateProfileData(profilePayload);
        } else if (active) {
          setUserType(null);
          setCandidateProfileData(null);
        }
      } catch (_) {
        if (active) {
          setUserType(null);
          setCandidateProfileData(null);
        }
      } finally {
        if (active) setProfileLoading(false);
      }
    }

    loadProfile();
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    let active = true;
    setIsSaved(false);

    async function loadSavedJobs() {
      if (!user || !vaga?.id) return;
      try {
        const auth = getAuth();
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;

        const response = await fetch('/api/saved-jobs', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          const ids = data.savedJobs?.map((job) => job.id) || [];
          if (active) setIsSaved(ids.includes(vaga.id));
        }
      } catch (err) {
        console.error('Erro ao carregar vagas salvas:', err);
      }
    }

    loadSavedJobs();
    return () => {
      active = false;
    };
  }, [user, vaga?.id]);

  const salaryRange = useMemo(() => {
    if (!vaga) return 'A combinar';
    const { salarioDe, salarioAte } = vaga;
    if (!salarioDe && !salarioAte) return 'A combinar';
    const currency = vaga.currency || 'STD';
    const start = salarioDe ? formatMoneyValue(salarioDe) : '';
    const end = salarioAte ? formatMoneyValue(salarioAte) : '';
    if (start && end) return `${start} a ${end} ${currency}`;
    const singleValue = start || end;
    return singleValue ? `${singleValue} ${currency}` : 'A combinar';
  }, [vaga]);

  const postedAtLabel = useMemo(() => {
    if (!vaga) return 'Data de publicação não informada';
    const raw = vaga.publicadoEm || vaga.createdAt || vaga.dataAbertura;
    return formatRelativeDate(raw, referenceNow);
  }, [referenceNow, vaga]);

  const premiumConfig = useMemo(
    () => getJobApplicationPremiumConfig(vaga),
    [vaga],
  );
  const candidatePremiumAccess = useMemo(
    () => getCandidatePremiumApplicationAccess(candidateProfileData),
    [candidateProfileData],
  );
  const normalizedCoverLetter = useMemo(
    () => normalizeCoverLetter(coverLetter),
    [coverLetter],
  );
  const premiumApplyRestriction = useMemo(() => {
    if (!user || (userType && userType !== 'candidato')) return null;
    if (user && !candidateProfileData && userType === null) return null;
    const access = evaluateCandidateJobAccess(vaga, candidateProfileData);
    return access.allowed ? null : access;
  }, [vaga, candidateProfileData, user, userType]);

  const candidateJobInsights = useMemo(() => {
    if (!user || (userType && userType !== 'candidato')) return null;
    if (!candidateProfileData) return null;
    return analyzeCandidateJobFit(
      vaga,
      candidateProfileData,
      candidateProfileData,
    );
  }, [vaga, candidateProfileData, user, userType]);

  const requirementsList = parseList(vaga?.requisitos);
  const responsibilitiesParagraphs = parseParagraphs(vaga?.responsabilidades);
  const benefitsList = parseList(vaga?.beneficios);
  const overviewParagraphs = parseParagraphs(vaga?.descricao);
  const skillsTags = Array.from(
    new Set(
      [
        ...(Array.isArray(vaga?.palavrasChave) ? vaga.palavrasChave : []),
        vaga?.categoria,
        humanizeRangeLabel(vaga?.nivelExperiencia),
      ]
        .map((item) => String(item || '').trim())
        .filter(Boolean),
    ),
  ).slice(0, 8);

  const skillChecklist = useMemo(() => {
    const shorten = (value) => {
      const label = String(value || '').trim();
      if (label.length <= 34) return label;
      return `${label.slice(0, 31).trim()}…`;
    };

    if (candidateJobInsights) {
      const matched = (candidateJobInsights.matchedSkills || [])
        .slice(0, 4)
        .map((skill) => ({ label: shorten(skill), matched: true }));
      const missing = (candidateJobInsights.missingSkills || [])
        .slice(0, Math.max(0, 4 - matched.length))
        .map((skill) => ({ label: shorten(skill), matched: false }));
      const combined = [...matched, ...missing];
      if (combined.length) return combined;
    }

    const publicSkills = Array.from(
      new Set(
        [
          ...skillsTags,
          ...requirementsList.slice(0, 4),
          vaga?.categoria,
          vaga?.nivelExperiencia,
        ]
          .map((item) => shorten(humanizeRangeLabel(item)))
          .filter(Boolean),
      ),
    ).slice(0, 4);

    return publicSkills.map((skill) => ({
      label: skill,
      matched: null,
    }));
  }, [
    candidateJobInsights,
    requirementsList,
    skillsTags,
    vaga?.categoria,
    vaga?.nivelExperiencia,
  ]);

  const skillFitPercent = candidateJobInsights
    ? Math.min(100, Math.max(0, Number(candidateJobInsights.matchPercent) || 0))
    : null;

  if (!vaga) {
    return (
      <PublicPageShell headerVariant="light">
        <section className={styles.notFound}>
          <h2>Vaga não encontrada</h2>
          <Link href="/vagas" className={styles.notFoundLink}>
            Voltar para vagas
          </Link>
        </section>
      </PublicPageShell>
    );
  }

  const {
    titulo,
    descricao,
    requisitos,
    responsabilidades,
    localizacao,
    tipoContrato,
    beneficios,
    dataAbertura,
    dataFecho,
    status,
    destaque,
  } = vaga;

  const companyLabel =
    vaga.empresaNome || vaga.companyName || vaga.empresa || 'Empresa';
  const companyInitials = getCompanyInitials(companyLabel);
  const tdrUrl = resolveUrl(
    vaga.tdrUrl ||
      vaga.tdrURL ||
      vaga.tdr_url ||
      vaga.tdr ||
      vaga.termosReferenciaUrl ||
      vaga.termosReferencia ||
      vaga.tdrLink ||
      vaga.tdrPdf ||
      vaga.tdrFile ||
      vaga.tdrArquivo ||
      vaga.documentoTdr ||
      vaga.termosReferenciaArquivo ||
      vaga.ficheiroTdr,
  );
  const coverImageUrl = resolveUrl(
    vaga.coverImageUrl || vaga.coverImage || vaga.imagemCapa || vaga.bannerUrl,
  );

  const benefitsToShow = benefitsList;

  const publicAssessment = vaga?.skillsAssessment?.enabled
    ? vaga.skillsAssessment
    : null;
  const assessmentComplete =
    !publicAssessment ||
    (assessmentAnswers.length === publicAssessment.questions.length &&
      assessmentAnswers.every((answer) => Number.isInteger(answer)));

  const statusLabel = getStatusLabel(status);
  const remoteLabel = getJobModalityLabel(vaga);
  const isOpen = status === 'active' || status === 'open' || !status;
  const isApplying = applyStatus === 'loading';
  const isApplied = applyStatus === 'success';
  const isBlocked = Boolean(userType && userType !== 'candidato');
  const missingRequiredCoverLetter = Boolean(
    premiumConfig.requireCoverLetter &&
    user &&
    candidatePremiumAccess.canUseCoverLetter &&
    !normalizedCoverLetter,
  );
  const applyDisabled =
    !isOpen ||
    isApplying ||
    isApplied ||
    isBlocked ||
    profileLoading ||
    !assessmentComplete ||
    missingRequiredCoverLetter;
  const applicationButtonLabel = isApplying
    ? 'A enviar…'
    : profileLoading
      ? 'A validar perfil…'
      : isApplied
        ? 'Candidatura enviada'
        : !isOpen
          ? 'Vaga encerrada'
          : premiumApplyRestriction
            ? 'Desbloquear acesso'
            : !assessmentComplete
              ? 'Concluir teste'
              : missingRequiredCoverLetter
                ? 'Adicionar carta'
                : 'Candidatar agora';

  const applicationCount = Number(
    vaga.applicationsCount ||
      vaga.candidaturasCount ||
      vaga.totalApplications ||
      vaga.applicationCount ||
      0,
  );
  const rawPublishedAt =
    vaga.publicadoEm || vaga.createdAt || vaga.dataAbertura;
  const newListing = isRecentlyPublished(rawPublishedAt, referenceNow);
  const heroMetaItems = [
    {
      label: localizacao || 'Local não informado',
      Icon: FiMapPin,
    },
    {
      label: postedAtLabel,
      Icon: FiClock,
    },
    applicationCount > 0
      ? {
          label: `${applicationCount} candidatura${applicationCount === 1 ? '' : 's'}`,
          Icon: FiUsers,
        }
      : null,
  ].filter(Boolean);

  const secondaryDetails = [
    { label: 'Estado', value: statusLabel, Icon: FiShield },
    { label: 'Abertura', value: formatDate(dataAbertura), Icon: FiCalendar },
    { label: 'Encerramento', value: formatDate(dataFecho), Icon: FiClock },
    {
      label: 'Escolaridade',
      value: vaga.escolaridade || 'Não informado',
      Icon: FiFileText,
    },
  ];

  const generalInfoItems = [
    {
      label: 'Salário',
      value: salaryRange,
      Icon: FiDollarSign,
    },
    {
      label: 'Experiência',
      value: humanizeRangeLabel(
        vaga.nivelExperiencia || vaga.experiencia || 'Não informado',
      ),
      Icon: FiBriefcase,
    },
    {
      label: 'Prazo',
      value: formatDate(dataFecho),
      Icon: FiCalendar,
    },
    {
      label: 'Localização',
      value: localizacao || 'Não informado',
      Icon: FiMapPin,
    },
  ];

  const companyWebsiteUrl = normalizeExternalUrl(vaga.companyWebsite);
  const companyInfoItems = [
    vaga.companyLocation
      ? { label: 'Localização', value: vaga.companyLocation, Icon: FiMapPin }
      : null,
    vaga.companyPhone
      ? {
          label: 'Telefone',
          value: vaga.companyPhone,
          Icon: FiPhone,
          href: `tel:${vaga.companyPhone}`,
        }
      : null,
    vaga.companyEmail
      ? {
          label: 'Email',
          value: vaga.companyEmail,
          Icon: FiMail,
          href: `mailto:${vaga.companyEmail}`,
        }
      : null,
    companyWebsiteUrl
      ? {
          label: 'Site',
          value: vaga.companyWebsite,
          Icon: FiGlobe,
          href: companyWebsiteUrl,
        }
      : null,
  ].filter(Boolean);

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/vaga/${vaga.id}`
      : '';
  const shareText = `Conheça esta vaga: ${titulo}`;
  const metaDescription =
    descricao?.substring(0, 160) ||
    `Vaga de ${titulo} em ${localizacao || 'São Tomé e Príncipe'} com detalhes, requisitos e candidatura online.`;

  const handleShare = async () => {
    if (!shareUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: titulo,
          text: shareText,
          url: shareUrl,
        });
      } catch (shareError) {
        if (shareError?.name !== 'AbortError') {
          console.error('Erro ao compartilhar:', shareError);
        }
      }
      return;
    }

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard indisponível');
      }
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      alert('Link copiado! Cole onde quiser compartilhar.');
    } catch (_) {
      alert(
        `Não foi possível compartilhar automaticamente. Copie o link manualmente: ${shareUrl}`,
      );
    }
  };

  const handleReport = () => {
    const subject = encodeURIComponent(`Denúncia da vaga: ${titulo}`);
    const body = encodeURIComponent(
      [
        `Vaga: ${titulo}`,
        `Empresa: ${companyLabel}`,
        `Identificador: ${vaga.id}`,
        `Ligação: ${window.location.href}`,
        '',
        'Descreva abaixo o motivo da denúncia:',
      ].join('\n'),
    );
    window.location.href = `mailto:suporte@empregos.st?subject=${subject}&body=${body}`;
  };

  const handleToggleSave = async () => {
    if (saving) return;
    setSaving(true);
    setErrorMsg('');

    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;

      if (!currentUser) {
        window.location.href = `/login?redirect=/vaga/${vaga.id}`;
        return;
      }

      const token = await currentUser.getIdToken();
      const method = isSaved ? 'DELETE' : 'POST';

      const response = await fetch('/api/saved-jobs', {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ jobId: vaga.id }),
      });

      if (response.ok) {
        setIsSaved(!isSaved);
        return;
      }

      let errorData = {};
      try {
        errorData = await response.json();
      } catch (_) {
        // ignore parse errors
      }

      const shouldShowUpgrade =
        errorData.code === 'SAVED_JOBS_LIMIT_REACHED' ||
        errorData.code === 'FEATURE_PRO_ONLY' ||
        Boolean(errorData.upgradeMessage);

      if (shouldShowUpgrade) {
        setUpgradeModal({
          open: true,
          message:
            errorData.upgradeMessage ||
            errorData.error ||
            'Escolha um plano que permita guardar mais vagas.',
          userType: 'candidato',
        });
        return;
      }

      setErrorMsg(errorData.error || 'Não foi possível guardar a vaga.');
    } catch (err) {
      console.error('Erro ao salvar vaga:', err);
      setErrorMsg(
        'Não foi possível guardar a vaga. Tenta novamente dentro de momentos.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateCoverLetter = async () => {
    if (!user) {
      window.location.href = `/login?redirect=/vaga/${vaga.id}`;
      return;
    }

    if (userType && userType !== 'candidato') {
      setErrorMsg(
        'Inicie sessão com uma conta de candidato para usar este recurso.',
      );
      return;
    }

    if (!candidatePremiumAccess.canUseCoverLetter) {
      setUpgradeModal({
        open: true,
        message:
          'Cartas de apresentação personalizadas estão disponíveis apenas nos planos Profissional e Premium.',
        userType: 'candidato',
      });
      return;
    }

    setIsGeneratingCoverLetter(true);
    try {
      const suggestion = buildCoverLetterSuggestion({
        job: vaga,
        userData: candidateProfileData || {},
        profileData: candidateProfileData || {},
      });
      setCoverLetter(suggestion);
    } finally {
      setIsGeneratingCoverLetter(false);
    }
  };

  const handleApply = async () => {
    if (!user) {
      window.location.href = `/login?redirect=/vaga/${vaga.id}`;
      return;
    }
    if (userType && userType !== 'candidato') {
      setErrorMsg(
        'O seu perfil atual não pode candidatar a esta vaga. Entre com uma conta de candidato.',
      );
      setApplyStatus('error');
      return;
    }
    if (premiumApplyRestriction) {
      setUpgradeModal({
        open: true,
        message:
          premiumApplyRestriction.upgradeMessage ||
          premiumApplyRestriction.reason ||
          'Escolha um plano para continuar.',
        userType: 'candidato',
      });
      setApplyStatus('idle');
      return;
    }
    if (
      premiumConfig.requireCoverLetter &&
      candidatePremiumAccess.canUseCoverLetter &&
      !normalizedCoverLetter
    ) {
      setErrorMsg('Esta vaga exige carta de apresentação personalizada.');
      setApplyStatus('error');
      return;
    }
    try {
      setApplyStatus('loading');
      setErrorMsg('');

      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();

      if (!token) {
        window.location.href = `/login?redirect=/vaga/${vaga.id}`;
        return;
      }

      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          jobId: vaga.id,
          assessmentAnswers,
          coverLetter: normalizedCoverLetter,
        }),
      });

      if (response.status === 409) {
        setApplyStatus('success');
        return;
      }

      if (!response.ok) {
        let friendly = 'Não foi possível enviar a candidatura.';
        try {
          const data = await response.json();
          if (
            response.status === 403 &&
            (data.upgradeMessage ||
              data.code === 'APPLICATION_LIMIT_REACHED' ||
              data.code === 'FEATURED_JOB_RESTRICTED' ||
              data.code === 'PREMIUM_JOB_RESTRICTED' ||
              data.code === 'EARLY_ACCESS_RESTRICTED' ||
              data.code === 'PREMIUM_APPLICATION_TOOLS_ONLY')
          ) {
            setUpgradeModal({
              open: true,
              message:
                data.upgradeMessage ||
                data.error ||
                'Escolha um plano para continuar.',
            });
            setApplyStatus('idle');
            return;
          }
          friendly = data?.error || friendly;
        } catch (_) {
          // ignore
        }
        setErrorMsg(friendly);
        setApplyStatus('error');
        return;
      }

      setApplyStatus('success');
    } catch (err) {
      console.warn('Erro ao candidatar:', err?.message || err);
      setErrorMsg(err?.message || 'Não foi possível enviar a candidatura.');
      setApplyStatus('error');
    }
  };

  return (
    <>
      <UpgradeModal
        isOpen={upgradeModal.open}
        onClose={() => setUpgradeModal({ open: false, message: '' })}
        message={upgradeModal.message}
        upgradeUrl="/premium/candidatos"
        userType="candidato"
      />

      <Head>
        <title>{titulo} | EmpregoSTP</title>
        <meta name="description" content={metaDescription} />
      </Head>

      <PublicPageShell headerVariant="light">
        <div className={styles.page}>
          <div className={styles.toolbar}>
            <Link href="/vagas" className={styles.backButton}>
              <span className={styles.backIcon}>
                <FiArrowLeft size={17} />
              </span>
              Voltar para vagas
            </Link>
            <strong className={styles.toolbarTitle}>Empregos STP</strong>
            <div className={styles.toolbarActions}>
              <button
                type="button"
                onClick={handleShare}
                aria-label="Partilhar vaga"
              >
                <FiShare2 aria-hidden="true" />
              </button>
              {userType !== 'empresa' ? (
                <button
                  type="button"
                  onClick={handleToggleSave}
                  disabled={saving}
                  aria-label={
                    isSaved ? 'Remover dos guardados' : 'Guardar vaga'
                  }
                  className={isSaved ? styles.toolbarActionSaved : ''}
                >
                  <FiBookmark aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </div>

          <div className={styles.mainGrid}>
            <div className={styles.contentColumn}>
              <section className={styles.hero}>
                <div className={styles.heroMain}>
                  <span className={styles.companyMark}>
                    {vaga.companyLogo || vaga.empresaLogo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={vaga.companyLogo || vaga.empresaLogo}
                        alt={companyLabel}
                        className={styles.companyMarkLogo}
                        loading="eager"
                        decoding="async"
                        width="60"
                        height="60"
                      />
                    ) : (
                      companyInitials
                    )}
                  </span>

                  <div className={styles.heroCopy}>
                    <div className={styles.heroKicker}>
                      {newListing ? (
                        <span className={styles.newListingPill}>Nova vaga</span>
                      ) : null}
                      <span
                        className={`${styles.statusPill} ${styles.contractPill}`}
                      >
                        {getContractTypeLabel(tipoContrato)}
                      </span>
                      <span
                        className={`${styles.statusPill} ${styles.remotePill}`}
                      >
                        {remoteLabel}
                      </span>
                      {destaque && (
                        <span className={styles.featuredPill}>
                          <FiStar size={13} />
                          Destaque
                        </span>
                      )}
                      {!isOpen && (
                        <span className={styles.closedPill}>{statusLabel}</span>
                      )}
                      {premiumConfig.premiumOnly && (
                        <span className={styles.premiumPill}>
                          <FiShield size={13} />
                          Premium
                        </span>
                      )}
                    </div>

                    <h1 className={styles.title}>{titulo}</h1>

                    <div className={styles.heroMetaList}>
                      <span className={styles.heroMetaItem}>
                        <FiBriefcase size={16} />
                        {vaga.companyId ? (
                          <Link
                            href={`/empresas/${vaga.companyId}`}
                            className={styles.companyProfileLink}
                          >
                            {companyLabel}
                          </Link>
                        ) : (
                          <strong>{companyLabel}</strong>
                        )}
                        {vaga.companyVerified ? (
                          <span
                            className={styles.verifiedDot}
                            title="Empresa verificada"
                          >
                            <FiCheck size={10} strokeWidth={3} />
                          </span>
                        ) : null}
                      </span>
                      {heroMetaItems.map(({ label, Icon }, index) => (
                        <span
                          key={`meta-${index}`}
                          className={styles.heroMetaItem}
                        >
                          <Icon size={16} />
                          {label}
                        </span>
                      ))}
                    </div>

                    {skillsTags.length > 0 && (
                      <div className={styles.tagRow}>
                        {skillsTags.slice(0, 5).map((tag, index) => (
                          <span key={`tag-${index}`} className={styles.tag}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.heroActions}>
                  <button
                    type="button"
                    className={`${styles.headerApplyButton} ${
                      applyDisabled
                        ? styles.headerApplyButtonDisabled
                        : styles.headerApplyButtonEnabled
                    }`}
                    onClick={handleApply}
                    disabled={applyDisabled}
                  >
                    <span>{applicationButtonLabel}</span>
                    <FiArrowRight size={17} />
                  </button>

                  {userType !== 'empresa' && (
                    <button
                      type="button"
                      className={`${styles.headerSaveButton} ${
                        isSaved ? styles.headerSaveButtonSaved : ''
                      }`}
                      onClick={handleToggleSave}
                      disabled={saving}
                    >
                      <FiBookmark size={17} />
                      {isSaved ? 'Vaga guardada' : 'Guardar vaga'}
                    </button>
                  )}
                </div>

                {premiumConfig.hasPremiumFlow && (
                  <div className={styles.premiumCallout}>
                    <div className={styles.premiumCalloutTitle}>
                      Fluxo premium de candidatura
                    </div>
                    <p className={styles.premiumCalloutText}>
                      {premiumConfig.premiumOnly
                        ? 'Esta vaga está aberta apenas para candidatos Profissional e Premium.'
                        : 'Esta vaga usa recursos premium para elevar a qualidade da candidatura.'}
                      {premiumConfig.isEarlyAccessActive
                        ? ` Durante a janela antecipada, o acesso fica reservado até ${formatDateTime(premiumConfig.earlyAccessUntil)}.`
                        : ''}
                      {premiumConfig.requireCoverLetter
                        ? ' A carta de apresentação personalizada faz parte do envio.'
                        : ''}
                    </p>
                    {user && !isBlocked && premiumApplyRestriction && (
                      <p className={styles.premiumCalloutWarning}>
                        {premiumApplyRestriction.reason}
                      </p>
                    )}
                    {user &&
                      !isBlocked &&
                      !premiumApplyRestriction &&
                      candidatePremiumAccess.priorityApplied && (
                        <p className={styles.premiumCalloutPositive}>
                          O seu plano atual envia esta candidatura com
                          prioridade adicional na triagem.
                        </p>
                      )}
                  </div>
                )}
              </section>

              {coverImageUrl ? (
                <div className={styles.jobCover}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={coverImageUrl}
                    alt={`Imagem da vaga ${titulo}`}
                    loading="eager"
                    decoding="async"
                  />
                </div>
              ) : null}

              <div className={styles.editorialGroup}>
                <section className={styles.jobDescriptionCard}>
                  <h2 className={styles.sectionTitle}>Descrição da vaga</h2>

                  <div className={styles.richText}>
                    {(overviewParagraphs.length
                      ? overviewParagraphs
                      : ['Descrição não informada.']
                    ).map((paragraph, index) => (
                      <p key={`description-${index}`}>{paragraph}</p>
                    ))}
                  </div>
                </section>

                {responsibilitiesParagraphs.length > 0 && (
                  <section className={styles.sectionCard}>
                    <h2 className={styles.sectionTitle}>Responsabilidades</h2>
                    <div className={styles.richText}>
                      {responsibilitiesParagraphs.map((paragraph, index) => (
                        <p key={`responsibility-${index}`}>{paragraph}</p>
                      ))}
                    </div>
                  </section>
                )}

                <section className={styles.sectionCard}>
                  <h2 className={styles.sectionTitle}>Requisitos</h2>
                  <div className={styles.bulletList}>
                    {requirementsList.length ? (
                      requirementsList.map((item, index) => (
                        <div
                          key={`requirement-${index}`}
                          className={`${styles.bulletItem} ${styles.requirementItem}`}
                        >
                          <span className={styles.requirementIcon}>
                            <FiArrowRight size={15} />
                          </span>
                          <span>{item}</span>
                        </div>
                      ))
                    ) : (
                      <p className={styles.emptySectionCopy}>
                        A empresa não indicou requisitos específicos.
                      </p>
                    )}
                  </div>
                </section>

                {benefitsToShow.length > 0 ? (
                  <section className={styles.benefitsCard}>
                    <h2
                      className={`${styles.sectionTitle} ${styles.benefitsTitle}`}
                    >
                      Benefícios &amp; vantagens
                    </h2>
                    <div className={styles.benefitsGrid}>
                      {benefitsToShow.map((benefit, index) => {
                        const BenefitIcon =
                          BENEFIT_ICONS[index % BENEFIT_ICONS.length];
                        return (
                          <div
                            key={`benefit-${index}`}
                            className={styles.benefitItem}
                          >
                            <span className={styles.benefitIcon}>
                              <BenefitIcon size={18} />
                            </span>
                            <span className={styles.benefitCopy}>
                              <strong>{benefit}</strong>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ) : null}
              </div>

              <section className={styles.sectionCard}>
                <h2 className={styles.sectionTitle}>
                  Informações complementares
                </h2>
                <div className={styles.detailsGrid}>
                  {secondaryDetails.map((item) => (
                    <div key={item.label} className={styles.detailCard}>
                      <span className={styles.detailIcon}>
                        <item.Icon size={16} />
                      </span>
                      <div className={styles.detailBody}>
                        <span className={styles.detailLabel}>{item.label}</span>
                        <strong className={styles.detailValue}>
                          {item.value}
                        </strong>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {tdrUrl && (
                <section className={styles.sectionCard}>
                  <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>
                      Documentação da vaga
                    </h2>
                  </div>
                  <div className={styles.documentCard}>
                    <div className={styles.documentCopy}>
                      <span className={styles.documentIcon}>
                        <FiFileText size={18} />
                      </span>
                      <div>
                        <strong>Termos de Referência</strong>
                        <p>
                          Documento oficial com escopo técnico, critérios e
                          contexto adicional da posição.
                        </p>
                      </div>
                    </div>
                    <a
                      href={tdrUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.documentButton}
                    >
                      <FiDownload size={14} />
                      Descarregar
                    </a>
                  </div>
                </section>
              )}

              {publicAssessment && (
                <section className={styles.sectionCard}>
                  <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>
                      Teste de competências
                    </h2>
                  </div>
                  <p className={styles.sectionLead}>
                    Responda a {publicAssessment.questions.length}{' '}
                    {publicAssessment.questions.length === 1
                      ? 'pergunta'
                      : 'perguntas'}
                    . A nota mínima é {publicAssessment.passingScore || 70}%.
                  </p>
                  <div className={styles.assessmentList}>
                    {publicAssessment.questions.map(
                      (question, questionIndex) => (
                        <div
                          key={`${question.id || 'question'}-${questionIndex}`}
                          className={styles.assessmentCard}
                        >
                          <p className={styles.assessmentPrompt}>
                            {questionIndex + 1}. {question.prompt}
                          </p>
                          <div className={styles.assessmentOptions}>
                            {question.options.map((option, optionIndex) => {
                              const checked =
                                assessmentAnswers[questionIndex] ===
                                optionIndex;
                              return (
                                <label
                                  key={`${question.id || questionIndex}-${optionIndex}`}
                                  className={`${styles.assessmentOption} ${checked ? styles.assessmentOptionChecked : ''}`}
                                >
                                  <input
                                    type="radio"
                                    name={`assessment-${question.id || questionIndex}`}
                                    checked={checked}
                                    onChange={() =>
                                      setAssessmentAnswers((prev) =>
                                        prev.map((answer, index) =>
                                          index === questionIndex
                                            ? optionIndex
                                            : answer,
                                        ),
                                      )
                                    }
                                  />
                                  <span>{option}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </section>
              )}
            </div>

            <aside className={styles.sidebarColumn}>
              <div className={styles.sidebarStack}>
                <section
                  id="candidatura"
                  className={`${styles.sidebarCard} ${styles.generalInfoCard}`}
                >
                  <h3 className={styles.sidebarTitle}>Resumo da vaga</h3>

                  <dl className={styles.generalInfoList}>
                    {generalInfoItems.map((item) => (
                      <div key={item.label} className={styles.generalInfoRow}>
                        <span className={styles.generalInfoIcon}>
                          <item.Icon size={20} aria-hidden="true" />
                        </span>
                        <div>
                          <dt>{item.label}</dt>
                          <dd>{item.value}</dd>
                        </div>
                      </div>
                    ))}
                  </dl>

                  <div className={styles.processCallout}>
                    <strong>
                      <FiZap size={14} />
                      {destaque ? 'Processo em destaque' : 'Candidatura direta'}
                    </strong>
                    <p>
                      Envie o seu perfil e acompanhe a evolução da candidatura
                      no dashboard.
                    </p>
                  </div>

                  <button
                    type="button"
                    className={`${styles.applyButton} ${applyDisabled ? styles.applyButtonDisabled : styles.applyButtonEnabled}`}
                    onClick={handleApply}
                    disabled={applyDisabled}
                  >
                    {applicationButtonLabel}
                  </button>

                  {userType !== 'empresa' ? (
                    <button
                      type="button"
                      className={`${styles.sidebarSaveButton} ${
                        isSaved ? styles.sidebarSaveButtonSaved : ''
                      }`}
                      onClick={handleToggleSave}
                      disabled={saving}
                    >
                      <FiBookmark size={18} aria-hidden="true" />
                      {saving
                        ? 'A guardar…'
                        : isSaved
                          ? 'Vaga guardada'
                          : 'Guardar vaga'}
                    </button>
                  ) : null}

                  <div className={styles.decisionActions}>
                    <button
                      type="button"
                      className={styles.decisionAction}
                      onClick={handleShare}
                      aria-label="Partilhar vaga"
                    >
                      <FiShare2 size={17} aria-hidden="true" />
                      <span>Partilhar</span>
                    </button>
                    <button
                      type="button"
                      className={styles.decisionAction}
                      onClick={handleReport}
                      aria-label="Denunciar vaga"
                    >
                      <FiFlag size={17} aria-hidden="true" />
                      <span>Denunciar</span>
                    </button>
                  </div>

                  {isBlocked && (
                    <p className={styles.warningText}>
                      O seu perfil atual não pode candidatar a esta vaga.
                    </p>
                  )}
                  {errorMsg && <p className={styles.errorText}>{errorMsg}</p>}
                  {!assessmentComplete && publicAssessment && (
                    <p className={styles.warningText}>
                      Conclua o teste de competências para ativar a candidatura.
                    </p>
                  )}
                  {missingRequiredCoverLetter && (
                    <p className={styles.warningText}>
                      Adicione a carta de apresentação para concluir o envio.
                    </p>
                  )}
                </section>

                {skillChecklist.length > 0 ? (
                  <section
                    className={`${styles.sidebarCard} ${styles.skillsCard}`}
                  >
                    <h3 className={styles.sidebarTitle}>
                      {candidateJobInsights
                        ? `Compatibilidade: ${skillFitPercent}%`
                        : 'Competências principais'}
                    </h3>
                    {candidateJobInsights ? (
                      <div className={styles.skillProgressTrack}>
                        <span
                          className={styles.skillProgressFill}
                          style={{ width: `${skillFitPercent}%` }}
                        />
                      </div>
                    ) : null}
                    <div className={styles.skillList}>
                      {skillChecklist.map((skill, index) => (
                        <div key={`skill-${index}`} className={styles.skillRow}>
                          <span>{skill.label}</span>
                          <strong
                            className={
                              skill.matched === null
                                ? styles.skillNeutral
                                : skill.matched
                                  ? styles.skillCheck
                                  : styles.skillMiss
                            }
                          >
                            {skill.matched === null ? (
                              <FiBriefcase size={16} />
                            ) : skill.matched ? (
                              <FiCheck size={18} />
                            ) : (
                              <FiX size={18} />
                            )}
                          </strong>
                        </div>
                      ))}
                    </div>
                    {candidateJobInsights?.matchLabel && (
                      <p className={styles.sidebarMuted}>
                        {candidateJobInsights.matchLabel}
                      </p>
                    )}
                  </section>
                ) : null}

                {(premiumConfig.requireCoverLetter ||
                  candidatePremiumAccess.canUseCoverLetter ||
                  premiumApplyRestriction) &&
                  userType !== 'empresa' && (
                    <section
                      className={`${styles.sidebarCard} ${styles.coverLetterCard}`}
                    >
                      <div className={styles.coverLetterHeader}>
                        <div>
                          <span className={styles.sidebarEyebrow}>
                            Carta de apresentação
                          </span>
                          <h3 className={styles.sidebarTitle}>
                            Preparar envio personalizado
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={handleGenerateCoverLetter}
                          disabled={isGeneratingCoverLetter}
                          className={styles.generateButton}
                        >
                          {isGeneratingCoverLetter
                            ? 'A gerar…'
                            : 'Gerar sugestão'}
                        </button>
                      </div>

                      <p className={styles.sidebarText}>
                        {premiumConfig.requireCoverLetter
                          ? 'Esta vaga exige carta personalizada no envio.'
                          : 'Use uma carta assistida para reforçar o contexto da sua candidatura.'}
                      </p>

                      {candidatePremiumAccess.canUseCoverLetter ||
                      premiumConfig.requireCoverLetter ? (
                        <textarea
                          value={coverLetter}
                          onChange={(event) =>
                            setCoverLetter(event.target.value)
                          }
                          placeholder="Escreva ou gere uma carta de apresentação personalizada para esta vaga."
                          rows={7}
                          className={styles.coverLetterInput}
                        />
                      ) : (
                        <div className={styles.lockedBox}>
                          Escolha um plano para usar uma carta de apresentação
                          personalizada nesta candidatura.
                        </div>
                      )}

                      <div className={styles.coverLetterFooter}>
                        <span className={styles.sidebarMuted}>
                          {normalizedCoverLetter
                            ? `${normalizedCoverLetter.length} caracteres prontos para envio`
                            : 'A carta será anexada junto com a candidatura.'}
                        </span>
                        {candidatePremiumAccess.priorityApplied && (
                          <span className={styles.priorityPill}>
                            <FiZap size={12} />
                            Candidatura prioritária
                          </span>
                        )}
                      </div>
                    </section>
                  )}

                <section
                  className={`${styles.sidebarCard} ${styles.companyCard}`}
                >
                  <span className={styles.sidebarEyebrow}>Empresa</span>
                  <div className={styles.companySidebar}>
                    <div className={styles.companySidebarTop}>
                      <div className={styles.companySidebarMark}>
                        {vaga.companyLogo || vaga.empresaLogo ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={vaga.companyLogo || vaga.empresaLogo}
                              alt={companyLabel}
                              className={styles.companySidebarLogo}
                              loading="lazy"
                              decoding="async"
                              width="64"
                              height="64"
                            />
                          </>
                        ) : (
                          <span className={styles.companyInitials}>
                            {companyInitials}
                          </span>
                        )}
                      </div>
                      <div>
                        <h3 className={styles.sidebarTitle}>{companyLabel}</h3>
                        <p className={styles.sidebarMuted}>
                          {vaga.companyLocation ||
                            localizacao ||
                            'São Tomé e Príncipe'}
                        </p>
                      </div>
                    </div>

                    {vaga.companyDescription ? (
                      <p className={styles.sidebarText}>
                        {vaga.companyDescription}
                      </p>
                    ) : (
                      <p className={styles.sidebarText}>
                        Consulte a oportunidade e a informação disponível para
                        conhecer melhor o contexto desta empresa e o perfil
                        procurado.
                      </p>
                    )}

                    {companyInfoItems.length > 0 ? (
                      <div className={styles.companyInfoList}>
                        {companyInfoItems.map(
                          ({ label, value, Icon, href }, infoIndex) => {
                            const content = (
                              <>
                                <span className={styles.companyInfoLabel}>
                                  <Icon size={14} /> {label}
                                </span>
                                <strong>{value}</strong>
                              </>
                            );

                            return href ? (
                              <a
                                key={`company-info-${infoIndex}`}
                                href={href}
                                target={
                                  href.startsWith('http') ? '_blank' : undefined
                                }
                                rel={
                                  href.startsWith('http')
                                    ? 'noopener noreferrer'
                                    : undefined
                                }
                                className={styles.companyInfoRow}
                              >
                                {content}
                              </a>
                            ) : (
                              <div
                                key={`company-info-${infoIndex}`}
                                className={styles.companyInfoRow}
                              >
                                {content}
                              </div>
                            );
                          },
                        )}
                      </div>
                    ) : null}
                    {vaga.companyId ? (
                      <Link
                        href={`/empresas/${vaga.companyId}`}
                        className={styles.companyProfileAction}
                      >
                        Ver perfil e todas as vagas
                        <FiArrowRight size={15} aria-hidden="true" />
                      </Link>
                    ) : null}
                  </div>
                </section>

                {tdrUrl && (
                  <section
                    className={`${styles.sidebarCard} ${styles.tdrCard}`}
                  >
                    <span className={styles.sidebarEyebrow}>
                      Documento extra
                    </span>
                    <h3 className={styles.sidebarTitle}>TDR disponível</h3>
                    <p className={styles.sidebarText}>
                      A empresa publicou um documento adicional com mais
                      detalhes sobre escopo, requisitos e contexto técnico.
                    </p>
                    <a
                      href={tdrUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.documentButton}
                    >
                      <FiDownload size={14} />
                      Abrir TDR
                    </a>
                  </section>
                )}

                <RelatedJobsPanel
                  jobs={relatedJobs}
                  className={styles.relatedSidebarCard}
                />
              </div>
            </aside>
          </div>

          <RelatedJobsPanel
            jobs={relatedJobs}
            className={styles.relatedDesktopSection}
            headingLevel="h2"
          />

          <div className={styles.mobileApplyBar}>
            <div className={styles.mobileApplyMeta}>
              <span className={styles.mobileApplyLabel}>Candidatura</span>
              <strong className={styles.mobileApplyValue}>{salaryRange}</strong>
            </div>
            <button
              className={`${styles.applyButton} ${styles.mobileApplyButton} ${applyDisabled ? styles.applyButtonDisabled : styles.applyButtonEnabled}`}
              onClick={handleApply}
              disabled={applyDisabled}
            >
              {applicationButtonLabel}
            </button>
            {userType !== 'empresa' ? (
              <button
                type="button"
                className={`${styles.mobileSaveButton} ${
                  isSaved ? styles.mobileSaveButtonSaved : ''
                }`}
                onClick={handleToggleSave}
                disabled={saving}
                aria-label={isSaved ? 'Remover dos guardados' : 'Guardar vaga'}
              >
                <FiBookmark size={19} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      </PublicPageShell>
    </>
  );
}

export async function getServerSideProps({ params }) {
  const { id } = params;

  try {
    const { admin } = await import('../../lib/firebaseAdmin');
    const { getEmpresaPlanSummary } =
      await import('../../lib/empresaPlanFeatures');
    const {
      getEffectiveJobStatus,
      isJobPubliclyVisible,
      syncExpiredJobStatus,
    } = await import('../../lib/jobExpiration');
    const doc = await admin.firestore().collection('jobs').doc(id).get();

    if (!doc.exists) {
      return { notFound: true };
    }

    const synced = await syncExpiredJobStatus(doc.ref, doc.data(), admin);
    const currentJob = {
      id: doc.id,
      ...synced.jobData,
      status: getEffectiveJobStatus(synced.jobData),
    };

    if (!isJobPubliclyVisible(currentJob)) {
      return { notFound: true };
    }

    const relatedSnapshot = await admin
      .firestore()
      .collection('jobs')
      .orderBy('createdAt', 'desc')
      .limit(14)
      .get();

    const relatedRaw = await Promise.all(
      relatedSnapshot.docs.map(async (jobDoc) => {
        const syncedJob = await syncExpiredJobStatus(
          jobDoc.ref,
          jobDoc.data(),
          admin,
        );
        return {
          id: jobDoc.id,
          ...syncedJob.jobData,
          status: getEffectiveJobStatus(syncedJob.jobData),
        };
      }),
    );

    const companyIds = [
      ...new Set(
        [
          currentJob.companyId,
          ...relatedRaw.map((job) => job.companyId),
        ].filter(Boolean),
      ),
    ];

    const companyRefs = companyIds.map((companyId) =>
      admin.firestore().collection('users').doc(companyId),
    );
    const companyDocs = companyRefs.length
      ? await admin.firestore().getAll(...companyRefs)
      : [];
    const companiesById = new Map();

    companyDocs.forEach((companyDoc) => {
      if (!companyDoc.exists) return;
      const companyData = companyDoc.data() || {};
      const planSummary = getEmpresaPlanSummary(companyData);
      companiesById.set(companyDoc.id, {
        companyName: companyData.name || companyData.fullName || 'Empresa',
        companyLogo: companyData.logoUrl || companyData.logo || '',
        companyDescription: companyData.description || '',
        companyPhone: companyData.phone || '',
        companyWebsite: companyData.website || '',
        companyEmail: companyData.email || '',
        companyLocation:
          companyData.location || companyData.address?.district || '',
        companyVerified: Boolean(planSummary.features?.companyVerified),
      });
    });

    const companyInfo = companiesById.get(currentJob.companyId) || {};
    const jobData = {
      ...currentJob,
      ...companyInfo,
      empresaNome:
        companyInfo.companyName ||
        currentJob.empresaNome ||
        currentJob.companyName ||
        'Empresa',
      companyName:
        companyInfo.companyName ||
        currentJob.companyName ||
        currentJob.empresaNome ||
        'Empresa',
      skillsAssessment: getPublicSkillsAssessment(currentJob.skillsAssessment),
    };

    const relatedJobs = relatedRaw
      .filter((job) => job.id !== id && isJobPubliclyVisible(job))
      .map((job) => {
        const company = companiesById.get(job.companyId) || {};
        let score = 0;
        if (
          job.categoria &&
          currentJob.categoria &&
          String(job.categoria).toLowerCase() ===
            String(currentJob.categoria).toLowerCase()
        )
          score += 4;
        if (
          job.localizacao &&
          currentJob.localizacao &&
          String(job.localizacao).toLowerCase() ===
            String(currentJob.localizacao).toLowerCase()
        )
          score += 2;
        if (
          job.tipoContrato &&
          currentJob.tipoContrato &&
          String(job.tipoContrato).toLowerCase() ===
            String(currentJob.tipoContrato).toLowerCase()
        )
          score += 1;
        if (job.remoto && currentJob.remoto) score += 1;
        const relatedCurrency = job.currency || job.moeda || 'STD';

        const serialized = serializeJob(
          projectPublicJob({
            ...job,
            empresaNome:
              company.companyName ||
              job.empresaNome ||
              job.companyName ||
              'Empresa',
            companyName:
              company.companyName ||
              job.companyName ||
              job.empresaNome ||
              'Empresa',
            companyLogo: company.companyLogo || job.companyLogo || '',
            companyVerified: company.companyVerified || false,
          }),
        );
        return {
          ...serialized,
          salarioResumo:
            job.salarioDe && job.salarioAte
              ? `${formatMoneyValue(job.salarioDe)} a ${formatMoneyValue(job.salarioAte)} ${relatedCurrency}`
              : job.salarioDe
                ? formatCurrency(job.salarioDe, relatedCurrency)
                : job.salarioAte
                  ? formatCurrency(job.salarioAte, relatedCurrency)
                  : 'A combinar',
          _score: score,
        };
      })
      .sort((a, b) => {
        if (b._score !== a._score) return b._score - a._score;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      })
      .slice(0, 4)
      .map(({ _score, ...job }) => job);

    return {
      props: {
        vaga: serializeJob(projectPublicJob(jobData)),
        relatedJobs,
        referenceNow: Date.now(),
      },
    };
  } catch (error) {
    console.error('Erro ao buscar vaga:', error);
    return {
      props: { vaga: null, relatedJobs: [], referenceNow: Date.now() },
    };
  }
}
