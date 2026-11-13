import Head from 'next/head';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import PublicPageShell from '../../components/PublicPageShell';
import AutoSaveStatus from '../../components/forms/AutoSaveStatus';
import useAutoDraft from '../../hooks/useAutoDraft';
import {
  createEmptyApplicationForm,
  normalizeApplicationForm,
} from '../../lib/applicationForm';
import {
  normalizeRequiredDocuments,
  resolveDocumentRequirements,
} from '../../lib/applicationDocuments';
import useScrollReveal from '../../hooks/useScrollReveal';
import styles from '../../styles/VagaDetailPage.module.css';
import {
  FiArrowLeft,
  FiArrowRight,
  FiAward,
  FiBookmark,
  FiBriefcase,
  FiCalendar,
  FiCheck,
  FiCheckSquare,
  FiClock,
  FiDownload,
  FiFileText,
  FiFlag,
  FiGift,
  FiGlobe,
  FiInfo,
  FiMail,
  FiMapPin,
  FiPaperclip,
  FiPhone,
  FiShare2,
  FiShield,
  FiStar,
  FiUsers,
  FiZap,
} from 'react-icons/fi';
import CoinsIcon from '../../components/icons/CoinsIcon';
import {
  buildCoverLetterSuggestion,
  getJobApplicationPolicy,
  normalizeCoverLetter,
} from '../../lib/applicationPolicy';
import { analyzeCandidateJobFit } from '../../lib/candidateOptimizationInsights';
import { normalizeExternalUrl } from '../../lib/externalUrl';
import { createFormDraftKey } from '../../lib/formDraft';
import { formatStpDate } from '../../domain/jobs/deadlines';
import { deduplicateRelatedJobs, projectPublicJob } from '../../lib/publicJob';
import { getPublicSkillsAssessment } from '../../lib/skillsAssessment';
import { shareWithClipboardFallback } from '../../lib/shareWithFallback';

// F1.8/E9: painel de denúncia, carregado só quando é aberto.
const JobReportPanel = dynamic(
  () => import('../../components/jobs/JobReportPanel'),
);

const ApplicationModal = dynamic(
  () => import('../../components/ApplicationModal'),
);
const UpgradeModal = dynamic(() => import('../../components/UpgradeModal'));

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
  // Pontos de milhar como na listagem (3.500), também para 4 algarismos.
  return Math.round(numericValue)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Dias até ao fim das candidaturas, contados a partir da hora do servidor
// (`referenceNow`) para o texto ser igual no servidor e no browser.
function getDeadlineHint(value, referenceNow) {
  if (!value || !referenceNow) return null;
  const end =
    typeof value?.toDate === 'function'
      ? value.toDate()
      : value?.seconds
        ? new Date(value.seconds * 1000)
        : new Date(value);
  if (Number.isNaN(end.getTime())) return null;
  const days = Math.ceil((end.getTime() - referenceNow) / 86400000);
  if (days < 0) return { text: 'Prazo terminado', urgent: true };
  if (days === 0) return { text: 'Termina hoje', urgent: true };
  if (days === 1) return { text: 'Falta 1 dia', urgent: true };
  return { text: `Faltam ${days} dias`, urgent: days <= 7 };
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

const ENDS_WITH_PUNCTUATION = /[.!?:;…]$/;

function wordCount(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

// Junta os itens de um grupo em texto corrido: frases ficam frases; listas
// curtas sem pontuação (ex.: ferramentas) viram uma enumeração com "e".
function joinAsProse(items) {
  if (!items.length) return '';
  const punctuated = items.filter((item) => ENDS_WITH_PUNCTUATION.test(item));
  const averageWords =
    items.reduce((total, item) => total + wordCount(item), 0) / items.length;
  const looksLikeSentences =
    punctuated.length * 2 >= items.length || averageWords > 6;

  if (looksLikeSentences) {
    return items
      .map((item) => (ENDS_WITH_PUNCTUATION.test(item) ? item : `${item}.`))
      .join(' ');
  }

  const bare = items.map((item) => item.replace(/[.;,]+$/, ''));
  if (bare.length === 1) return `${bare[0]}.`;
  const last = bare[bare.length - 1];
  const head = bare.slice(0, -1).join(', ');
  const connector = /\s(ou|e)\s/i.test(last) ? ', ' : ' e ';
  return `${head}${connector}${last}.`;
}

/**
 * Requisitos e responsabilidades em texto corrido, agrupados pelos subtítulos que a empresa
 * escreveu (ex.: "Formação Académica"). Um subtítulo é uma linha curta, sem
 * pontuação final, que abre o texto ou vem depois de uma linha terminada em
 * pontuação. Só se parte por linhas: as vírgulas ficam dentro das frases.
 */
function parseProseGroups(value) {
  if (!value) return [];
  const lines = (
    Array.isArray(value) ? value.map(String) : String(value).split(/\n+/)
  )
    .map((line) => line.trim().replace(/^[-•*·]\s*/, ''))
    .filter(Boolean);

  const groups = [];
  let current = { heading: '', items: [] };
  lines.forEach((line, index) => {
    const previous = lines[index - 1];
    const isHeading =
      index < lines.length - 1 &&
      !ENDS_WITH_PUNCTUATION.test(line) &&
      wordCount(line) <= 4 &&
      (index === 0 || ENDS_WITH_PUNCTUATION.test(previous));
    if (isHeading) {
      if (current.heading || current.items.length) groups.push(current);
      current = { heading: line, items: [] };
    } else {
      current.items.push(line);
    }
  });
  if (current.heading || current.items.length) groups.push(current);

  // Um bloco longo de frases sem subtítulo divide-se em parágrafos
  // equilibrados de ~4 frases, para respirar sem deixar frases órfãs.
  return groups
    .flatMap((group) => {
      const { items } = group;
      const sentences = items.filter((item) =>
        ENDS_WITH_PUNCTUATION.test(item),
      );
      if (
        group.heading ||
        items.length <= 5 ||
        sentences.length * 2 < items.length
      ) {
        return [{ heading: group.heading, text: joinAsProse(items) }];
      }
      const chunks = Math.ceil(items.length / 4);
      return Array.from({ length: chunks }, (_, index) => ({
        heading: '',
        text: joinAsProse(
          items.slice(
            Math.round((index * items.length) / chunks),
            Math.round(((index + 1) * items.length) / chunks),
          ),
        ),
      }));
    })
    .filter((group) => group.text);
}

function parseParagraphs(value) {
  if (!value) return [];
  if (Array.isArray(value))
    return value.map((item) => String(item).trim()).filter(Boolean);
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
    'full-time': 'Tempo inteiro',
    'tempo integral': 'Tempo inteiro',
    'part-time': 'Tempo parcial',
    'meio período': 'Tempo parcial',
    'meio periodo': 'Tempo parcial',
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

const BENEFIT_ICONS = [CoinsIcon, FiBriefcase, FiShield, FiGlobe];

function RelatedJobsPanel({ jobs, className = '', headingLevel = 'h3' }) {
  if (!jobs.length) return null;
  const Heading = headingLevel;

  return (
    <section
      className={`${styles.sidebarCard} ${styles.relatedCard} ${className}`}
      data-reveal
    >
      <div className={styles.relatedHeader}>
        <Heading className={styles.sidebarTitle}>Vagas semelhantes</Heading>
        <Link href="/vagas" className={styles.relatedAll}>
          Ver todas
          <FiArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
      <ul className={styles.relatedList}>
        {jobs.map((job) => {
          const relatedCompanyLabel =
            job.empresaNome || job.companyName || 'Empresa';

          return (
            <li key={job.id} className={styles.relatedListItem}>
              <Link href={`/vaga/${job.id}`} className={styles.relatedItem}>
                <span className={styles.relatedLogo} aria-hidden="true">
                  {job.companyLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={job.companyLogo}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      width="40"
                      height="40"
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
                  <span className={styles.relatedMeta}>
                    <span className={styles.relatedLocation}>
                      <FiMapPin size={13} aria-hidden="true" />
                      {job.localizacao || 'São Tomé e Príncipe'}
                    </span>
                    <small className={styles.relatedSalary}>
                      {job.salarioResumo || 'A combinar'}
                    </small>
                  </span>
                </span>
                <FiArrowRight
                  className={styles.relatedArrow}
                  size={16}
                  aria-hidden="true"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export default function VagaDetalhe({
  vaga,
  relatedJobs = [],
  referenceNow = 0,
  publicPage = null,
  jsonLd = '',
  gone = false,
}) {
  const { user, loading: authLoading } = useAuth();
  const [applyStatus, setApplyStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [userType, setUserType] = useState(null);
  const [candidateProfileData, setCandidateProfileData] = useState(null);
  // Começa a carregar: a página renderiza antes de a sessão estar resolvida, e
  // o botão de candidatura não pode mandar para o login quem já tem sessão.
  const [profileLoading, setProfileLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shareFeedback, setShareFeedback] = useState(null);
  const [upgradeModal, setUpgradeModal] = useState({
    open: false,
    message: '',
  });
  const [assessmentAnswers, setAssessmentAnswers] = useState(() =>
    new Array(vaga?.skillsAssessment?.questions?.length || 0).fill(null),
  );
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  // D8: uma chave por intenção de candidatura. Repetições (duplo clique,
  // rede instável) reutilizam-na e o servidor devolve a mesma resposta.
  const applicationIntentKey = useRef(null);
  // Barra fixa com "Candidatar" que desce quando o topo da vaga sai do ecrã
  // (só desktop; no telemóvel já existe a barra fixa em baixo).
  const heroRef = useRef(null);
  const [showStickyApply, setShowStickyApply] = useState(false);
  // Entradas suaves das secções, na mesma linha de /carreira e /sobre-nos.
  const pageRef = useRef(null);
  useScrollReveal(pageRef, [vaga?.id]);
  const [reportSignal, setReportSignal] = useState(0);
  const [applicationForm, setApplicationForm] = useState(() =>
    createEmptyApplicationForm(),
  );
  const [isGeneratingCoverLetter, setIsGeneratingCoverLetter] = useState(false);
  const jobId = vaga?.id || '';
  const assessmentQuestions = useMemo(
    () => vaga?.skillsAssessment?.questions || [],
    [vaga?.skillsAssessment?.questions],
  );
  const [appliedJobId, setAppliedJobId] = useState(jobId);

  useEffect(() => {
    setAssessmentAnswers(new Array(assessmentQuestions.length).fill(null));
    setApplicationForm(createEmptyApplicationForm());
    setAppliedJobId(jobId);
    setApplyModalOpen(false);
  }, [assessmentQuestions, jobId, user?.uid]);

  // Pré-preenche o formulário com o que o perfil já sabe. Só toca em campos
  // ainda vazios: um rascunho restaurado ou o que a pessoa escreveu ganham
  // sempre ao perfil.
  useEffect(() => {
    if (!candidateProfileData) return;

    const linhasDe = (valor, maximo) =>
      String(valor || '')
        .split('\n')
        .map((linha) => linha.trim())
        .filter(Boolean)
        .slice(0, maximo);

    setApplicationForm((anterior) => {
      const seguinte = { ...anterior };
      const preencher = (campo, valor) => {
        if (!seguinte[campo] && valor) seguinte[campo] = valor;
      };

      preencher(
        'fullName',
        candidateProfileData.fullName || candidateProfileData.name,
      );
      preencher('email', candidateProfileData.email);
      preencher('phone', candidateProfileData.phone);
      preencher(
        'location',
        candidateProfileData.city || candidateProfileData.location,
      );
      preencher('nationality', candidateProfileData.nationality);
      preencher('birthDate', candidateProfileData.birthDate);

      const formacoes = linhasDe(candidateProfileData.education, 5);
      const semFormacao = seguinte.education.every(
        (item) => !item.degree && !item.institution && !item.year,
      );
      if (formacoes.length && semFormacao) {
        seguinte.education = formacoes.map((linha) => ({
          degree: linha,
          institution: '',
          year: '',
        }));
      }

      const idiomas = linhasDe(candidateProfileData.languages, 6);
      const semIdiomas = seguinte.languages.every((item) => !item.language);
      if (idiomas.length && semIdiomas) {
        seguinte.languages = idiomas.map((linha) => ({
          language: linha,
          level: '',
        }));
      }

      return seguinte;
    });
  }, [candidateProfileData]);

  // O que esta vaga exige, já descontado do que o perfil tem. Recalcula
  // quando o perfil chega: até lá não dá para saber se o CV serve.
  const documentRequirements = useMemo(
    () =>
      resolveDocumentRequirements({
        job: vaga,
        profile: candidateProfileData || {},
      }),
    [vaga, candidateProfileData],
  );

  const handleUploadDocument = async (documentId, file) => {
    if (!user?.uid) throw new Error('Inicie sessão para enviar documentos.');
    if (file.size > MAX_DOCUMENT_BYTES) {
      throw new Error('O ficheiro tem mais de 10 MB. Envie um mais pequeno.');
    }

    // Nome higienizado: o original vai parar a um caminho do Storage e a um
    // cabeçalho de download.
    const nomeSeguro = file.name.replace(/[^\w.\-]+/g, '_').slice(-80);
    const caminho = `candidaturas/${user.uid}/${jobId}/${documentId}-${Date.now()}-${nomeSeguro}`;

    // Import dinâmico: o SDK do Storage só é carregado quando alguém anexa
    // mesmo um ficheiro, e assim não pesa no bundle de quem só lê a vaga.
    const [{ ref, uploadBytes, getDownloadURL }, { storage }] =
      await Promise.all([
        import('firebase/storage'),
        import('../../lib/firebase'),
      ]);

    const destino = ref(storage, caminho);
    await uploadBytes(destino, file);
    const url = await getDownloadURL(destino);
    return { url, name: file.name.slice(0, 160) };
  };

  const applicationDraftReady = Boolean(
    !authLoading &&
    !profileLoading &&
    userType === 'candidato' &&
    user?.uid &&
    jobId &&
    appliedJobId === jobId,
  );

  const applicationDraftValue = useMemo(
    () => ({ assessmentAnswers, applicationForm }),
    [assessmentAnswers, applicationForm],
  );
  const applicationDraftKey = createFormDraftKey({
    scope: 'job-application',
    ownerId: user?.uid,
    resourceId: jobId,
  });
  const {
    status: applicationDraftStatus,
    lastSavedAt: applicationDraftLastSavedAt,
    isOnline: applicationDraftIsOnline,
    hasDraft: hasApplicationDraft,
    clearDraft: clearApplicationDraft,
  } = useAutoDraft({
    storageKey: applicationDraftKey,
    scope: 'job-application',
    resourceId: jobId || 'default',
    value: applicationDraftValue,
    enabled: Boolean(
      user?.uid &&
      jobId &&
      userType === 'candidato' &&
      !profileLoading &&
      !authLoading,
    ),
    ready: applicationDraftReady,
    getToken: () => user?.getIdToken?.(),
    onRestore: (draft) => {
      const restoredAnswers = Array.isArray(draft?.assessmentAnswers)
        ? new Array(assessmentQuestions.length)
            .fill(null)
            .map((_, index) =>
              Number.isInteger(draft.assessmentAnswers[index])
                ? draft.assessmentAnswers[index]
                : null,
            )
        : new Array(assessmentQuestions.length).fill(null);

      setAssessmentAnswers(restoredAnswers);
      // `draft.coverLetter` à solta é o formato dos rascunhos gravados antes
      // do formulário completo: recupera-se para dentro do campo novo.
      setApplicationForm({
        ...createEmptyApplicationForm(),
        ...(draft?.applicationForm || {}),
        ...(typeof draft?.coverLetter === 'string' && draft.coverLetter
          ? { coverLetter: draft.coverLetter }
          : {}),
      });
    },
  });

  useEffect(() => {
    if (
      applicationDraftReady &&
      applyStatus === 'success' &&
      hasApplicationDraft
    ) {
      void clearApplicationDraft();
    }
  }, [
    applicationDraftReady,
    applyStatus,
    clearApplicationDraft,
    hasApplicationDraft,
  ]);

  useEffect(() => {
    async function trackView() {
      // Espera pela sessão para registar uma única visualização, já com o
      // utilizador certo.
      if (!vaga?.id || authLoading) return;

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
  }, [vaga?.id, user?.uid, authLoading]);

  useEffect(() => {
    let active = true;
    setApplyStatus('idle');
    setErrorMsg('');

    async function checkExisting() {
      if (!user || profileLoading || userType !== 'candidato' || !vaga?.id)
        return;
      try {
        const { auth } = await import('../../lib/firebaseAuth');
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
  }, [user, vaga?.id, profileLoading, userType]);

  useEffect(() => {
    let active = true;
    setUserType(null);
    setCandidateProfileData(null);
    setProfileLoading(authLoading || Boolean(user));

    async function loadProfile() {
      if (!user) {
        if (!authLoading) setProfileLoading(false);
        return;
      }
      try {
        const { auth } = await import('../../lib/firebaseAuth');
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
  }, [user, authLoading]);

  useEffect(() => {
    let active = true;
    setIsSaved(false);

    async function loadSavedJobs() {
      if (!user || profileLoading || userType !== 'candidato' || !vaga?.id)
        return;
      try {
        const { auth } = await import('../../lib/firebaseAuth');
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
  }, [user, vaga?.id, profileLoading, userType]);

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

  const applicationConfig = useMemo(
    // `vaga` é null quando a vaga não existe ou foi retirada: o valor por
    // omissão do parâmetro só cobre `undefined`.
    () => getJobApplicationPolicy(vaga || {}),
    [vaga],
  );

  const candidateJobInsights = useMemo(() => {
    if (!user || userType !== 'candidato') return null;
    if (!candidateProfileData) return null;
    return analyzeCandidateJobFit(
      vaga,
      candidateProfileData,
      candidateProfileData,
    );
  }, [vaga, candidateProfileData, user, userType]);

  // A lista alimenta as competências da barra lateral; o texto corrido é o
  // que se lê na secção Requisitos.
  const requirementsList = parseList(vaga?.requisitos);
  const requirementsProse = parseProseGroups(vaga?.requisitos);
  const responsibilitiesProse = parseProseGroups(vaga?.responsabilidades);
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
    // Chips curtos: frases longas ficam na secção Requisitos, não são cortadas.
    const isChip = (label) => label.length > 0 && label.length <= 40;

    if (candidateJobInsights) {
      const matched = (candidateJobInsights.matchedSkills || [])
        .map((skill) => String(skill || '').trim())
        .filter(isChip)
        .slice(0, 6)
        .map((label) => ({ label, matched: true }));
      const missing = (candidateJobInsights.missingSkills || [])
        .map((skill) => String(skill || '').trim())
        .filter(isChip)
        .slice(0, Math.max(0, 6 - matched.length))
        .map((label) => ({ label, matched: false }));
      const combined = [...matched, ...missing];
      if (combined.length) return combined;
    }

    const publicSkills = Array.from(
      new Set(
        [...skillsTags, ...requirementsList]
          .map((item) => humanizeRangeLabel(item).trim())
          .filter(isChip),
      ),
    ).slice(0, 6);

    return publicSkills.map((skill) => ({
      label: skill,
      matched: null,
    }));
  }, [candidateJobInsights, requirementsList, skillsTags]);

  const skillFitPercent = candidateJobInsights
    ? Math.min(100, Math.max(0, Number(candidateJobInsights.matchPercent) || 0))
    : null;

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero || !('IntersectionObserver' in window)) return undefined;
    const headerHeight =
      document.querySelector('header')?.getBoundingClientRect().height || 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowStickyApply(
          !entry.isIntersecting && entry.boundingClientRect.top < 0,
        );
      },
      { rootMargin: `-${Math.round(headerHeight)}px 0px 0px 0px` },
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, [vaga?.id]);

  if (!vaga) {
    return (
      <>
        {gone ? (
          <Head>
            <title>Vaga retirada | EmpregoSTP</title>
            <meta name="robots" content="noindex, nofollow" />
          </Head>
        ) : null}
        <PublicPageShell headerVariant="light">
          <section className={styles.notFound}>
            <h2>{gone ? 'Esta vaga foi retirada' : 'Vaga não encontrada'}</h2>
            {gone ? (
              <p>Esta oferta já não está disponível no EmpregoSTP.</p>
            ) : null}
            <Link href="/vagas" className={styles.notFoundLink}>
              Voltar para vagas
            </Link>
          </section>
        </PublicPageShell>
      </>
    );
  }

  // F8.6 — vaga que já não aceita candidaturas.
  const closure =
    publicPage && publicPage.kind !== 'OPEN'
      ? {
          title:
            publicPage.kind === 'CLOSED'
              ? publicPage.closedAt
                ? `Esta vaga encerrou em ${formatStpDate(new Date(publicPage.closedAt))}`
                : 'Esta vaga encerrou'
              : publicPage.kind === 'PAUSED'
                ? 'Esta vaga não está a receber candidaturas de momento'
                : 'Esta vaga foi arquivada',
          similarHref: vaga.categoria
            ? `/vagas?categoria=${encodeURIComponent(vaga.categoria)}`
            : '/vagas',
        }
      : null;

  const {
    titulo,
    descricao,
    localizacao,
    tipoContrato,
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
  const isBlocked = Boolean(user && userType !== 'candidato');
  const showCandidateActions =
    !authLoading && !profileLoading && (!user || userType === 'candidato');
  // A carta deixou de bloquear o botão: vive dentro do modal, que a valida
  // antes do envio. Desativar o botão aqui deixava a pessoa sem forma de a
  // escrever.
  const applyDisabled =
    !isOpen ||
    isApplying ||
    isApplied ||
    isBlocked ||
    authLoading ||
    profileLoading ||
    !assessmentComplete;
  const applicationButtonLabel = isApplying
    ? 'A enviar…'
    : authLoading || profileLoading
      ? 'A validar perfil…'
      : isApplied
        ? 'Candidatura enviada'
        : !isOpen
          ? 'Vaga encerrada'
          : isBlocked
            ? 'Conta de candidato necessária'
            : !assessmentComplete
              ? 'Concluir teste'
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
      Icon: CoinsIcon,
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
      hint: isOpen ? getDeadlineHint(dataFecho, referenceNow) : null,
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
    setShareFeedback(null);
    const result = await shareWithClipboardFallback({
      title: titulo,
      text: shareText,
      url: shareUrl,
    });

    if (result.status === 'shared') {
      setShareFeedback({ type: 'success', message: 'Vaga partilhada.' });
    } else if (result.status === 'copied') {
      setShareFeedback({
        type: 'success',
        message: result.nativeFailed
          ? 'A partilha nativa falhou, mas o link foi copiado.'
          : 'Link copiado. Cole-o onde quiser partilhar.',
      });
    } else if (result.status === 'failed') {
      setShareFeedback({
        type: 'error',
        message: `Não foi possível partilhar automaticamente. Copie o link: ${shareUrl}`,
      });
    }
  };

  const handleReport = () => {
    setReportSignal((value) => value + 1);
  };

  const requireCandidateAction = () => {
    if (authLoading || profileLoading) {
      setErrorMsg('Aguarde enquanto validamos o seu perfil.');
      return false;
    }
    if (!user) {
      window.location.href = `/login?redirect=/vaga/${vaga.id}`;
      return false;
    }
    if (userType !== 'candidato') {
      setErrorMsg(
        userType
          ? 'Esta ação é exclusiva de contas de candidato. A sua sessão atual não foi alterada.'
          : 'Não foi possível validar o seu perfil. Recarregue a página antes de tentar novamente.',
      );
      return false;
    }
    return true;
  };

  const handleToggleSave = async () => {
    if (saving || !requireCandidateAction()) return;
    setSaving(true);
    setErrorMsg('');

    try {
      const { auth } = await import('../../lib/firebaseAuth');
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
    if (!requireCandidateAction()) return;

    setIsGeneratingCoverLetter(true);
    try {
      const suggestion = buildCoverLetterSuggestion({
        job: vaga,
        userData: candidateProfileData || {},
        profileData: candidateProfileData || {},
      });
      setApplicationForm((anterior) => ({
        ...anterior,
        coverLetter: suggestion,
      }));
    } finally {
      setIsGeneratingCoverLetter(false);
    }
  };

  const handleApply = () => {
    if (!requireCandidateAction()) return;
    // A partir daqui é o modal que recolhe e valida a candidatura.
    setErrorMsg('');
    setApplyModalOpen(true);
  };

  const handleSubmitApplication = async (formulario) => {
    if (!requireCandidateAction()) return;
    try {
      setApplyStatus('loading');
      setErrorMsg('');

      const { auth } = await import('../../lib/firebaseAuth');
      const token = await auth.currentUser?.getIdToken();

      if (!token) {
        window.location.href = `/login?redirect=/vaga/${vaga.id}`;
        return;
      }

      if (!applicationIntentKey.current) {
        applicationIntentKey.current =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
      }
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'Idempotency-Key': applicationIntentKey.current,
        },
        body: JSON.stringify({
          jobId: vaga.id,
          assessmentAnswers,
          coverLetter: normalizeCoverLetter(formulario.coverLetter),
          applicationForm: normalizeApplicationForm(formulario),
        }),
      });

      if (response.status === 409) {
        applicationIntentKey.current = null;
        await clearApplicationDraft();
        setApplyModalOpen(false);
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
            setApplyModalOpen(false);
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
          // Formato antigo (texto) e formato único D16 ({ code, message }).
          friendly =
            (typeof data?.error === 'string'
              ? data.error
              : data?.error?.message) || friendly;
        } catch (_) {
          // ignore
        }
        setErrorMsg(friendly);
        setApplyStatus('error');
        return;
      }

      applicationIntentKey.current = null;
      await clearApplicationDraft();
      setApplyModalOpen(false);
      setApplyStatus('success');
    } catch (err) {
      console.warn('Erro ao candidatar:', err?.message || err);
      setErrorMsg(err?.message || 'Não foi possível enviar a candidatura.');
      setApplyStatus('error');
    }
  };

  return (
    <>
      {applyModalOpen ? (
        <ApplicationModal
          isOpen={applyModalOpen}
          onClose={() => setApplyModalOpen(false)}
          job={vaga}
          form={applicationForm}
          onChange={setApplicationForm}
          onSubmit={handleSubmitApplication}
          submitting={isApplying}
          errorMessage={errorMsg}
          onGenerateCoverLetter={handleGenerateCoverLetter}
          generatingCoverLetter={isGeneratingCoverLetter}
          documentRequirements={documentRequirements}
          onUploadDocument={handleUploadDocument}
          coverLetterEnabled
          draftStatus={
            <AutoSaveStatus
              status={applicationDraftStatus}
              lastSavedAt={applicationDraftLastSavedAt}
              isOnline={applicationDraftIsOnline}
            />
          }
        />
      ) : null}

      {upgradeModal.open ? (
        <UpgradeModal
          isOpen={upgradeModal.open}
          onClose={() => setUpgradeModal({ open: false, message: '' })}
          message={upgradeModal.message}
          upgradeUrl="/premium/candidatos"
          userType="candidato"
        />
      ) : null}

      <Head>
        <title>{titulo} | EmpregoSTP</title>
        <meta name="description" content={metaDescription} />
        {publicPage && !publicPage.indexable ? (
          <meta name="robots" content="noindex, follow" />
        ) : null}
        {jsonLd ? (
          <script
            type="application/ld+json"
            // Serializado por serializeJsonLd: não fecha o <script>.
            dangerouslySetInnerHTML={{ __html: jsonLd }}
          />
        ) : null}
      </Head>

      <PublicPageShell headerVariant="light">
        <div className={styles.page} ref={pageRef}>
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
              {showCandidateActions ? (
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

          {shareFeedback ? (
            <p
              className={`${styles.shareFeedback} ${
                shareFeedback.type === 'error'
                  ? styles.shareFeedbackError
                  : styles.shareFeedbackSuccess
              }`}
              role={shareFeedback.type === 'error' ? 'alert' : 'status'}
            >
              {shareFeedback.message}
            </p>
          ) : null}

          {closure ? (
            <div className={styles.closureNotice} role="status">
              <strong>{closure.title}</strong>
              <span>
                Pode ver outras oportunidades parecidas e criar um alerta para
                receber as próximas.
              </span>
              <Link href={closure.similarHref}>
                Ver vagas semelhantes e criar alerta
              </Link>
            </div>
          ) : null}

          <div
            className={`${styles.stickyApply} ${
              showStickyApply ? styles.stickyApplyVisible : ''
            }`}
            aria-hidden={!showStickyApply}
            inert={!showStickyApply}
          >
            <div className={styles.stickyApplyInner}>
              <span className={styles.stickyApplyMark} aria-hidden="true">
                {vaga.companyLogo || vaga.empresaLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={vaga.companyLogo || vaga.empresaLogo}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    width="40"
                    height="40"
                  />
                ) : (
                  companyInitials
                )}
              </span>
              <div className={styles.stickyApplyCopy}>
                <strong>{titulo}</strong>
                <span>
                  {companyLabel}
                  {localizacao ? ` · ${localizacao}` : ''}
                </span>
              </div>
              <span className={`${styles.statusPill} ${styles.contractPill}`}>
                {getContractTypeLabel(tipoContrato)}
              </span>
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
            </div>
          </div>

          <div
            className={`${styles.mainGrid} ${closure ? styles.mainGridClosed : ''}`}
          >
            <section ref={heroRef} className={styles.hero}>
              <div className={styles.heroGlow} aria-hidden="true">
                <span />
                <span />
              </div>
              <div className={styles.heroMain}>
                <span className={styles.companyMark}>
                  {vaga.companyLogo || vaga.empresaLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={vaga.companyLogo || vaga.empresaLogo}
                      alt=""
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
                    {remoteLabel !== 'Não informado' && (
                      <span
                        className={`${styles.statusPill} ${styles.remotePill}`}
                      >
                        {remoteLabel}
                      </span>
                    )}
                    {destaque && (
                      <span className={styles.featuredPill}>
                        <FiStar size={13} />
                        Destaque
                      </span>
                    )}
                    {!isOpen && (
                      <span className={styles.closedPill}>{statusLabel}</span>
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

                {showCandidateActions && (
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

              {applicationConfig.requireCoverLetter && (
                <div className={styles.applicationNotice}>
                  <div className={styles.applicationNoticeTitle}>
                    Carta de apresentação obrigatória
                  </div>
                  <p className={styles.applicationNoticeText}>
                    Inclua uma carta de apresentação no envio. A candidatura e a
                    carta escrita por si são gratuitas.
                  </p>
                </div>
              )}
            </section>

            <div className={styles.contentColumn}>
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

              <nav className={styles.sectionNav} aria-label="Secções da vaga">
                <span className={styles.sectionNavLabel}>Nesta vaga</span>
                {[
                  ['descricao', 'Descrição', true],
                  [
                    'responsabilidades',
                    'Responsabilidades',
                    responsibilitiesProse.length > 0,
                  ],
                  ['requisitos', 'Requisitos', true],
                  ['beneficios', 'Benefícios', benefitsToShow.length > 0],
                  ['informacoes', 'Informações', true],
                  ['documentacao', 'Documentos', Boolean(tdrUrl)],
                ]
                  .filter(([, , visible]) => visible)
                  .map(([id, label]) => (
                    <a key={id} href={`#${id}`}>
                      {label}
                    </a>
                  ))}
              </nav>

              <div className={styles.editorialGroup}>
                <section
                  id="descricao"
                  className={styles.jobDescriptionCard}
                  data-reveal
                >
                  <h2 className={styles.sectionTitle}>
                    <span className={styles.sectionIcon} aria-hidden="true">
                      <FiFileText />
                    </span>
                    Descrição da vaga
                  </h2>

                  <div className={styles.richText}>
                    {(overviewParagraphs.length
                      ? overviewParagraphs
                      : ['Descrição não informada.']
                    ).map((paragraph, index) => (
                      <p key={`description-${index}`}>{paragraph}</p>
                    ))}
                  </div>
                </section>

                {responsibilitiesProse.length > 0 && (
                  <section
                    id="responsabilidades"
                    className={styles.sectionCard}
                    data-reveal
                  >
                    <h2 className={styles.sectionTitle}>
                      <span className={styles.sectionIcon} aria-hidden="true">
                        <FiCheckSquare />
                      </span>
                      Responsabilidades
                    </h2>
                    <div className={styles.richText}>
                      {responsibilitiesProse.map((group, index) => (
                        <p key={`responsibility-${index}`}>
                          {group.heading ? (
                            <strong className={styles.proseLead}>
                              {group.heading}:{' '}
                            </strong>
                          ) : null}
                          {group.text}
                        </p>
                      ))}
                    </div>
                  </section>
                )}

                <section
                  id="requisitos"
                  className={styles.sectionCard}
                  data-reveal
                >
                  <h2 className={styles.sectionTitle}>
                    <span className={styles.sectionIcon} aria-hidden="true">
                      <FiAward />
                    </span>
                    Requisitos
                  </h2>
                  {requirementsProse.length ? (
                    <div className={styles.richText}>
                      {requirementsProse.map((group, index) => (
                        <p key={`requirement-${index}`}>
                          {group.heading ? (
                            <strong className={styles.proseLead}>
                              {group.heading}:{' '}
                            </strong>
                          ) : null}
                          {group.text}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.emptySectionCopy}>
                      A empresa não indicou requisitos específicos.
                    </p>
                  )}
                </section>

                {benefitsToShow.length > 0 ? (
                  <section
                    id="beneficios"
                    className={styles.benefitsCard}
                    data-reveal
                  >
                    <h2
                      className={`${styles.sectionTitle} ${styles.benefitsTitle}`}
                    >
                      <span className={styles.sectionIcon} aria-hidden="true">
                        <FiGift />
                      </span>
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

              <section
                id="informacoes"
                className={styles.sectionCard}
                data-reveal
              >
                <h2 className={styles.sectionTitle}>
                  <span className={styles.sectionIcon} aria-hidden="true">
                    <FiInfo />
                  </span>
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
                <section
                  id="documentacao"
                  className={styles.sectionCard}
                  data-reveal
                >
                  <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>
                      <span className={styles.sectionIcon} aria-hidden="true">
                        <FiPaperclip />
                      </span>
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
                <section className={styles.sectionCard} data-reveal>
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
                  data-reveal
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
                          <dd>
                            {item.value}
                            {item.hint ? (
                              <span
                                className={`${styles.deadlineHint} ${
                                  item.hint.urgent
                                    ? styles.deadlineHintUrgent
                                    : ''
                                }`}
                              >
                                {item.hint.text}
                              </span>
                            ) : null}
                          </dd>
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

                  {showCandidateActions ? (
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

                  <JobReportPanel
                    jobId={vaga.id}
                    openSignal={reportSignal}
                    loginHref={`/login?redirect=/vaga/${vaga.id}`}
                  />

                  {isBlocked && !profileLoading && (
                    <p className={styles.warningText}>
                      {userType
                        ? 'Esta ação é exclusiva de contas de candidato.'
                        : 'Não foi possível validar o seu perfil. Recarregue a página para tentar novamente.'}{' '}
                      <Link href="/dashboard">Ir para o meu painel</Link>
                    </p>
                  )}
                  {errorMsg && <p className={styles.errorText}>{errorMsg}</p>}
                  {!assessmentComplete && publicAssessment && (
                    <p className={styles.warningText}>
                      Conclua o teste de competências para ativar a candidatura.
                    </p>
                  )}
                  {user && userType === 'candidato' ? (
                    <AutoSaveStatus
                      status={applicationDraftStatus}
                      lastSavedAt={applicationDraftLastSavedAt}
                      isOnline={applicationDraftIsOnline}
                      className={styles.applicationDraftStatus}
                    />
                  ) : null}
                </section>

                {skillChecklist.length > 0 ? (
                  <section
                    className={`${styles.sidebarCard} ${styles.skillsCard}`}
                    data-reveal
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
                    <p className={styles.skillLead}>
                      Habilidades técnicas requeridas para a função:
                    </p>
                    <ul className={styles.skillChips}>
                      {skillChecklist.map((skill, index) => (
                        <li
                          key={`skill-${index}`}
                          className={`${styles.skillChip} ${
                            skill.matched === false ? styles.skillChipMiss : ''
                          }`}
                        >
                          {skill.matched === true ? (
                            <FiCheck size={14} aria-label="Tem" />
                          ) : null}
                          {skill.label}
                        </li>
                      ))}
                    </ul>
                    {candidateJobInsights?.matchLabel && (
                      <p className={styles.sidebarMuted}>
                        {candidateJobInsights.matchLabel}
                      </p>
                    )}
                  </section>
                ) : null}

                <section
                  className={`${styles.sidebarCard} ${styles.companyCard}`}
                  data-reveal
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
                              alt=""
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
              </div>
            </aside>
          </div>

          <RelatedJobsPanel
            jobs={relatedJobs}
            className={styles.relatedEndSection}
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
            {showCandidateActions ? (
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

function toDateValue(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function getServerSideProps(context) {
  const { params } = context;
  const { id } = params;

  try {
    const { admin } = await import('../../lib/firebaseAdmin');
    const { getEmpresaPlanSummary } =
      await import('../../lib/empresaPlanFeatures');
    const {
      getEffectiveJobStatus,
      isJobPubliclyVisible,
      parseJobCloseDate,
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

    const { resolvePublicJobPage } =
      await import('../../domain/jobs/publicPage');
    const closingDate = parseJobCloseDate(
      synced.jobData.dataFecho ||
        synced.jobData.expiresAt ||
        synced.jobData.dataEncerramento,
    );
    const closedAt =
      toDateValue(synced.jobData.closedAt) ||
      toDateValue(synced.jobData.expiredAt) ||
      (closingDate && closingDate.getTime() < Date.now() ? closingDate : null);
    const page = resolvePublicJobPage({
      v2Status: synced.jobData.v2Status,
      legacyStatus: currentJob.status,
      closedAt,
      now: new Date(),
    });
    if (page.kind === 'NOT_FOUND') return { notFound: true };
    if (page.kind === 'GONE') {
      context.res.statusCode = 410;
      return {
        props: {
          vaga: null,
          gone: true,
          relatedJobs: [],
          referenceNow: Date.now(),
        },
      };
    }
    const publicPage = {
      ...page,
      closedAt: closedAt ? closedAt.toISOString() : null,
    };

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
      // Normalizado aqui para vagas antigas, criadas antes de existirem
      // documentos exigidos, chegarem à página com o CV e os certificados.
      requiredDocuments: normalizeRequiredDocuments(
        currentJob.requiredDocuments || {},
      ),
    };

    const rankedRelatedJobs = relatedRaw
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
      });
    const relatedJobs = deduplicateRelatedJobs(rankedRelatedJobs)
      // F8.6: até 6 semelhantes quando a vaga já não aceita candidaturas.
      .slice(0, publicPage && publicPage.kind !== 'OPEN' ? 6 : 4)
      .map(({ _score, ...job }) => job);

    let jsonLd = '';
    if (publicPage?.jsonLd) {
      const { buildJobPostingJsonLd, serializeJsonLd } =
        await import('../../domain/jobs/publicPage');
      const website = String(jobData.companyWebsite || '');
      const modality = `${jobData.modalidade || ''} ${jobData.regime || ''}`;
      jsonLd = serializeJsonLd(
        buildJobPostingJsonLd({
          id,
          title: jobData.titulo || jobData.title || '',
          descriptionHtml: jobData.descricao || jobData.description || '',
          publishedAt: toDateValue(
            jobData.publicadoEm || jobData.publishedAt || jobData.createdAt,
          ),
          validThrough: parseJobCloseDate(
            jobData.dataFecho || jobData.expiresAt || jobData.dataEncerramento,
          ),
          employmentType: jobData.tipoContrato,
          companyName: jobData.companyName,
          companyWebsite: /^https?:\/\//i.test(website) ? website : '',
          companyLogo: jobData.companyLogo || '',
          location: jobData.localizacao || '',
          remote: jobData.remoto === true || /remoto|remote/i.test(modality),
          salaryFrom: jobData.salarioDe,
          salaryTo: jobData.salarioAte,
          // O modelo legado não guarda o período: sem ele, o salário fica de
          // fora do JobPosting em vez de se presumir "por mês".
          salaryPeriod: jobData.salaryPeriod || null,
          createdAt: toDateValue(jobData.createdAt),
          url: `https://empregostp.com/vaga/${encodeURIComponent(id)}`,
        }),
      );
    }

    return {
      props: {
        vaga: serializeJob(projectPublicJob(jobData)),
        relatedJobs,
        referenceNow: Date.now(),
        publicPage,
        ...(jsonLd ? { jsonLd } : {}),
      },
    };
  } catch (error) {
    console.error('Erro ao buscar vaga:', error);
    return {
      props: { vaga: null, relatedJobs: [], referenceNow: Date.now() },
    };
  }
}
