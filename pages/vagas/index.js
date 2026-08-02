import React, { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  FiArrowRight,
  FiBell,
  FiBookmark,
  FiBriefcase,
  FiCheckCircle,
  FiChevronDown,
  FiChevronUp,
  FiClock,
  FiDollarSign,
  FiHome,
  FiInfo,
  FiMapPin,
  FiSearch,
  FiSliders,
  FiUser,
  FiX,
} from 'react-icons/fi';
import PublicPageShell from '../../components/PublicPageShell';
import {
  filterPublicJobsByCompany,
  projectPublicJob,
} from '../../lib/publicJob';
import styles from '../../styles/VagasPage.module.css';

function normalizeSearchValue(value) {
  if (Array.isArray(value)) return value.join(' ');
  return String(value || '');
}

function getRouteQueryValue(value) {
  return typeof value === 'string' ? value : '';
}

function filterJobsByRouteQuery(jobs, query = {}) {
  let result = [...jobs];
  const search = getRouteQueryValue(query.search).toLowerCase().trim();
  const category = getRouteQueryValue(query.categoria).toLowerCase().trim();
  const company = getRouteQueryValue(query.empresa);

  if (search) {
    result = result.filter((job) => matchesSearch(job, search));
  }
  if (category) {
    result = result.filter(
      (job) =>
        String(job.categoria || '')
          .toLowerCase()
          .trim() === category,
    );
  }
  if (company) {
    result = filterPublicJobsByCompany(result, company);
  }

  return result;
}

function matchesSearch(job, term) {
  const haystack = [
    job.titulo,
    job.descricao,
    job.localizacao,
    job.categoria,
    job.tipoContrato,
    job.empresaNome,
    job.companyName,
    ...(Array.isArray(job.palavrasChave) ? job.palavrasChave : []),
    normalizeSearchValue(job.requisitos),
    normalizeSearchValue(job.beneficios),
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(term);
}

function isClosedJob(job) {
  const status = String(job?.status || '')
    .trim()
    .toLowerCase();
  return [
    'closed',
    'fechada',
    'inactive',
    'inativa',
    'expired',
    'expirada',
  ].includes(status);
}

function compareRecentJobs(a, b) {
  const aIsClosed = isClosedJob(a);
  const bIsClosed = isClosedJob(b);
  if (aIsClosed !== bIsClosed) return aIsClosed ? 1 : -1;
  if (a.destaque && !b.destaque) return -1;
  if (!a.destaque && b.destaque) return 1;
  if (a.premiumOnly && !b.premiumOnly) return -1;
  if (!a.premiumOnly && b.premiumOnly) return 1;
  return (
    new Date(b.createdAt || b.publishedAt || 0) -
    new Date(a.createdAt || a.publishedAt || 0)
  );
}

function normalizeContractType(value = '') {
  const normalized = String(value || '').toLowerCase();
  const types = {
    'full-time': 'Tempo integral',
    'tempo integral': 'Tempo integral',
    'part-time': 'Meio período',
    'meio período': 'Meio período',
    'meio periodo': 'Meio período',
    contract: 'Contrato',
    contrato: 'Contrato',
    internship: 'Estágio',
    estagio: 'Estágio',
    estágio: 'Estágio',
    freelance: 'Freelance',
    temporário: 'Temporário',
    temporario: 'Temporário',
    voluntariado: 'Voluntariado',
  };

  return types[normalized] || value || 'Não informado';
}

function formatPublishedAgo(value, now = Date.now()) {
  if (!value) return 'agora';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'agora';

  const diffMs = now - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (days >= 1) return `há ${days} dia${days === 1 ? '' : 's'}`;
  if (hours >= 1) return `há ${hours}h`;
  if (minutes >= 1) return `há ${minutes}m`;
  return 'agora';
}

function parseMoney(value) {
  if (!value && value !== 0) return null;
  const raw = String(value)
    .trim()
    .replace(/\s/g, '')
    .replace(/[^\d,.-]/g, '');
  if (!raw) return null;

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

  const numeric = Number.parseFloat(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatCompactMoney(value) {
  const numeric = parseMoney(value);
  if (numeric === null) return '';
  return Math.round(numeric)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatSalary(fromValue, toValue) {
  const from = formatCompactMoney(fromValue);
  const to = formatCompactMoney(toValue);

  if (from && to && from !== to) return `${from} a ${to}`;
  if (from) return from;
  if (to) return to;
  return 'A combinar';
}

function isRemoteJob(job) {
  const text = `${job.modalidade || ''} ${job.regime || ''}`.toLowerCase();
  return Boolean(job.remoto) || text.includes('remoto');
}

function isHybridJob(job) {
  const text =
    `${job.modalidade || ''} ${job.regime || ''} ${job.localizacao || ''}`.toLowerCase();
  return text.includes('hibrido') || text.includes('híbrido');
}

function getModalityLabel(job) {
  if (isHybridJob(job)) return 'Híbrido';
  if (isRemoteJob(job)) return 'Remoto';
  const text =
    `${job.modalidade || ''} ${job.regime || ''} ${job.localizacao || ''}`.toLowerCase();
  if (job.remoto === false || text.includes('presencial')) return 'Presencial';
  return 'Modalidade não indicada';
}

function isOnSiteJob(job) {
  return getModalityLabel(job) === 'Presencial';
}

function getExperienceBucket(job) {
  const text =
    `${job.nivelExperiencia || ''} ${job.experiencia || ''}`.toLowerCase();

  if (
    text.includes('5+') ||
    text.includes('+5') ||
    text.includes('sénior') ||
    text.includes('senior')
  ) {
    return '5+';
  }
  if (text.includes('3-5') || text.includes('3 a 5')) return '3-5';
  if (
    text.includes('1-3') ||
    text.includes('1 a 3') ||
    text.includes('júnior') ||
    text.includes('junior')
  ) {
    return '1-3';
  }
  if (
    text.includes('sem') ||
    text.includes('entry') ||
    text.includes('0-2') ||
    text.includes('iniciante')
  ) {
    return 'sem';
  }
  return '';
}

function getExperienceLabel(bucket) {
  const labels = {
    sem: 'Sem experiência',
    '1-3': '1 a 3 anos',
    '3-5': '3 a 5 anos',
    '5+': 'Mais de 5 anos',
  };
  return labels[bucket] || bucket;
}

function countBy(items, predicate) {
  return items.reduce((total, item) => total + (predicate(item) ? 1 : 0), 0);
}

function getPaginationItems(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) items.push('start-ellipsis');
  for (let page = start; page <= end; page += 1) items.push(page);
  if (end < totalPages - 1) items.push('end-ellipsis');
  items.push(totalPages);

  return items;
}

const JOBS_PER_PAGE = 6;
const MOBILE_JOBS_BATCH = 3;

function getCompanyInitials(value = '') {
  return (
    String(value || 'Empresa')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'ES'
  );
}

function isNewJob(job, now = Date.now()) {
  const value = job.publicadoEm || job.publishedAt || job.createdAt;
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return false;
  const age = now - timestamp;
  return age >= 0 && age <= 24 * 60 * 60 * 1000;
}

function JobCard({ job, referenceNow }) {
  const companyName = job.empresaNome || job.companyName || 'Empresa';
  const salary = formatSalary(job.salarioDe, job.salarioAte);
  const currency = job.currency || 'STD';
  const salaryLabel =
    salary === 'A combinar' ? salary : `${salary} ${currency}`;
  const featured =
    job.destaque === true || job.featured === true || job.isFeatured === true;
  const closed = isClosedJob(job);
  const recentlyPublished = isNewJob(job, referenceNow);
  const publishedAt = job.publicadoEm || job.publishedAt || job.createdAt;
  const companyLogo = job.empresaLogo || job.companyLogo;
  const modality = getModalityLabel(job);
  const contract = normalizeContractType(job.tipoContrato);
  const cardClassName = [
    styles.jobCard,
    closed ? styles.jobCardClosed : '',
    featured ? styles.jobCardFeatured : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article className={cardClassName}>
      <div className={styles.jobCardIdentity}>
        <div className={styles.companyLogo}>
          {companyLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={companyLogo}
              alt={`Logótipo de ${companyName}`}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span>{getCompanyInitials(companyName)}</span>
          )}
        </div>
        {recentlyPublished || featured ? (
          <span className={styles.newBadge}>
            {recentlyPublished ? 'Novo' : 'Destaque'}
          </span>
        ) : null}
      </div>

      <div className={styles.jobCardContent}>
        <Link href={`/vaga/${job.id}`} className={styles.jobTitleLink}>
          <h3>{job.titulo}</h3>
        </Link>
        <p className={styles.companyName}>
          {companyName}
          {job.companyVerified ? (
            <span title="Empresa verificada" aria-label="Empresa verificada">
              <FiCheckCircle aria-hidden="true" />
            </span>
          ) : null}
        </p>

        <div className={styles.jobPrimaryMeta}>
          <span>
            <FiMapPin aria-hidden="true" />
            {job.localizacao || 'São Tomé e Príncipe'}
          </span>
          <span className={styles.statusMeta}>
            <FiInfo aria-hidden="true" />
            <span
              className={closed ? styles.statusBadgeClosed : styles.statusBadge}
            >
              {closed ? 'Encerrada' : 'Aberta'}
            </span>
          </span>
          <span>
            <FiClock aria-hidden="true" />
            Publicada {formatPublishedAgo(publishedAt, referenceNow)}
          </span>
        </div>

        <div className={styles.jobTags} aria-label="Características da vaga">
          <span className={styles.salaryTag}>
            <FiDollarSign aria-hidden="true" />
            {salaryLabel}
          </span>
          <span className={styles.contractTag}>
            <FiBriefcase aria-hidden="true" />
            {contract}
          </span>
          <span className={styles.modalityTag}>{modality}</span>
        </div>

        {job.descricao ? (
          <p className={styles.jobDescription}>{job.descricao}</p>
        ) : null}
      </div>

      <div className={styles.jobCardActions}>
        {closed ? (
          <span className={styles.closedAction}>Vaga encerrada</span>
        ) : (
          <Link
            href={`/vaga/${job.id}#candidatura`}
            className={styles.applyAction}
          >
            Candidatar
            <FiArrowRight aria-hidden="true" />
          </Link>
        )}
        <Link href={`/vaga/${job.id}`} className={styles.detailsAction}>
          Ver detalhes
        </Link>
      </div>
    </article>
  );
}

export default function VagasPage({ initialJobs = [], referenceNow = 0 }) {
  const router = useRouter();
  const jobs = initialJobs;
  const [filteredJobs, setFilteredJobs] = useState(() =>
    filterJobsByRouteQuery(initialJobs, router.query),
  );
  const [searchTerm, setSearchTerm] = useState(() =>
    getRouteQueryValue(router.query.search),
  );
  const [filters, setFilters] = useState({
    empresa: getRouteQueryValue(router.query.empresa),
    localizacao: '',
    tipoContrato: '',
    status: '',
    categoria: getRouteQueryValue(router.query.categoria),
    modalidade: '',
    experiencia: '',
    showFeatured: false,
  });
  const [minSalary, setMinSalary] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [sortBy, setSortBy] = useState('recentes');
  const [currentPage, setCurrentPage] = useState(1);
  const [mobileVisibleCount, setMobileVisibleCount] =
    useState(MOBILE_JOBS_BATCH);
  const [isMobileView, setIsMobileView] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [alertEmail, setAlertEmail] = useState('');
  const [alertState, setAlertState] = useState({ status: 'idle', message: '' });
  const [collapsedSections, setCollapsedSections] = useState({});
  const filtersPanelRef = useRef(null);

  const toggleSection = (key) =>
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const renderFilterHeader = (key, title) => (
    <button
      type="button"
      className={styles.filterSectionHeader}
      aria-expanded={!collapsedSections[key]}
      onClick={() => toggleSection(key)}
    >
      <h3>{title}</h3>
      {collapsedSections[key] ? (
        <FiChevronDown size={18} />
      ) : (
        <FiChevronUp size={18} />
      )}
    </button>
  );

  useEffect(() => {
    setSearchTerm(
      typeof router.query.search === 'string' ? router.query.search : '',
    );
    setFilters((prev) => ({
      ...prev,
      categoria:
        typeof router.query.categoria === 'string'
          ? router.query.categoria
          : '',
      empresa:
        typeof router.query.empresa === 'string' ? router.query.empresa : '',
    }));
  }, [router.query.search, router.query.categoria, router.query.empresa]);

  useEffect(() => {
    if (!filtersOpen || !isMobileView) return undefined;

    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const panel = filtersPanelRef.current;
    const focusableSelector =
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]';

    document.body.style.overflow = 'hidden';
    panel
      ?.querySelector('button[aria-label="Fechar filtros"]')
      ?.focus({ preventScroll: true });

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setFiltersOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !panel) return;

      const focusable = [...panel.querySelectorAll(focusableSelector)].filter(
        (element) => element.getClientRects().length > 0,
      );
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.({ preventScroll: true });
    };
  }, [filtersOpen, isMobileView]);

  useEffect(() => {
    setIsLoading(true);

    const timeoutId = setTimeout(() => {
      let result = [...jobs];
      const normalizedSearch = searchTerm.toLowerCase().trim();

      if (normalizedSearch) {
        result = result.filter((job) => matchesSearch(job, normalizedSearch));
      }

      if (filters.empresa) {
        result = filterPublicJobsByCompany(result, filters.empresa);
      }

      if (filters.localizacao) {
        const normalizedLocation = filters.localizacao.toLowerCase().trim();
        result = result.filter((job) =>
          String(job.localizacao || '')
            .toLowerCase()
            .includes(normalizedLocation),
        );
      }

      if (filters.tipoContrato) {
        result = result.filter(
          (job) => job.tipoContrato === filters.tipoContrato,
        );
      }

      if (filters.status) {
        result = result.filter((job) => job.status === filters.status);
      }

      if (filters.categoria) {
        result = result.filter(
          (job) =>
            String(job.categoria || '').toLowerCase() ===
            String(filters.categoria).toLowerCase(),
        );
      }

      if (filters.experiencia) {
        result = result.filter(
          (job) => getExperienceBucket(job) === filters.experiencia,
        );
      }

      if (filters.modalidade === 'remoto') {
        result = result.filter((job) => isRemoteJob(job));
      } else if (filters.modalidade === 'hibrido') {
        result = result.filter((job) => isHybridJob(job));
      } else if (filters.modalidade === 'presencial') {
        result = result.filter(isOnSiteJob);
      }

      if (filters.showFeatured) {
        result = result.filter(
          (job) =>
            job.destaque === true ||
            job.featured === true ||
            job.isFeatured === true,
        );
      }

      if (minSalary > 0) {
        result = result.filter((job) => {
          const salary =
            parseMoney(job.salarioAte) || parseMoney(job.salarioDe) || 0;
          return salary >= minSalary;
        });
      }

      if (sortBy === 'recentes') {
        result.sort(compareRecentJobs);
      } else if (sortBy === 'prazo') {
        result.sort((a, b) => {
          if (a.destaque && !b.destaque) return -1;
          if (!a.destaque && b.destaque) return 1;
          return (
            new Date(a.dataFecho || '9999-12-31') -
            new Date(b.dataFecho || '9999-12-31')
          );
        });
      } else if (sortBy === 'salario') {
        result.sort((a, b) => {
          if (a.destaque && !b.destaque) return -1;
          if (!a.destaque && b.destaque) return 1;
          return (
            (parseMoney(b.salarioDe) || 0) - (parseMoney(a.salarioDe) || 0)
          );
        });
      }

      setFilteredJobs(result);
      setIsLoading(false);
    }, 180);

    return () => clearTimeout(timeoutId);
  }, [filters, jobs, minSalary, searchTerm, sortBy]);

  useEffect(() => {
    setCurrentPage(1);
    setMobileVisibleCount(MOBILE_JOBS_BATCH);
  }, [filters, minSalary, searchTerm, sortBy]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 720px)');
    const syncViewport = () => setIsMobileView(media.matches);
    syncViewport();
    media.addEventListener('change', syncViewport);
    return () => media.removeEventListener('change', syncViewport);
  }, []);

  const localizacoes = useMemo(
    () => [...new Set(jobs.map((job) => job.localizacao).filter(Boolean))],
    [jobs],
  );
  const categorias = useMemo(
    () => [...new Set(jobs.map((job) => job.categoria).filter(Boolean))],
    [jobs],
  );
  const tiposContrato = useMemo(
    () => [...new Set(jobs.map((job) => job.tipoContrato).filter(Boolean))],
    [jobs],
  );
  const totalPages = Math.max(
    1,
    Math.ceil(filteredJobs.length / JOBS_PER_PAGE),
  );
  const visibleJobs = useMemo(() => {
    if (isMobileView) {
      return filteredJobs.slice(0, mobileVisibleCount);
    }
    const offset = (currentPage - 1) * JOBS_PER_PAGE;
    return filteredJobs.slice(offset, offset + JOBS_PER_PAGE);
  }, [currentPage, filteredJobs, isMobileView, mobileVisibleCount]);
  const paginationItems = useMemo(
    () => getPaginationItems(currentPage, totalPages),
    [currentPage, totalPages],
  );
  const maxSalary = useMemo(() => {
    const highest = jobs.reduce((max, job) => {
      const salary =
        parseMoney(job.salarioAte) || parseMoney(job.salarioDe) || 0;
      return Math.max(max, salary);
    }, 0);
    return Math.max(30000, Math.ceil(highest / 5000) * 5000 || 30000);
  }, [jobs]);
  const salaryCurrency = jobs[0]?.currency || 'STD';
  const experienceBuckets = ['sem', '1-3', '3-5', '5+'];
  const filteredCompanyName =
    jobs.find((job) => job.companyId === filters.empresa)?.empresaNome ||
    jobs.find((job) => job.companyId === filters.empresa)?.companyName ||
    '';
  const activeFilterChips = [
    searchTerm.trim() ? { key: 'search', label: searchTerm.trim() } : null,
    filters.empresa
      ? {
          key: 'empresa',
          label: filteredCompanyName
            ? `Empresa: ${filteredCompanyName}`
            : 'Empresa selecionada',
        }
      : null,
    filters.categoria ? { key: 'categoria', label: filters.categoria } : null,
    filters.tipoContrato
      ? {
          key: 'tipoContrato',
          label: normalizeContractType(filters.tipoContrato),
        }
      : null,
    filters.modalidade
      ? {
          key: 'modalidade',
          label:
            filters.modalidade === 'hibrido' ? 'Híbrido' : filters.modalidade,
        }
      : null,
    filters.experiencia
      ? { key: 'experiencia', label: getExperienceLabel(filters.experiencia) }
      : null,
    filters.localizacao
      ? { key: 'localizacao', label: filters.localizacao }
      : null,
    minSalary > 0
      ? {
          key: 'minSalary',
          label: `+${formatCompactMoney(minSalary)} ${salaryCurrency}`,
        }
      : null,
    filters.showFeatured ? { key: 'showFeatured', label: 'Destaque' } : null,
  ].filter(Boolean);

  const clearFilter = (key) => {
    if (key === 'search') {
      setSearchTerm('');
      return;
    }
    if (key === 'minSalary') {
      setMinSalary(0);
      return;
    }
    setFilters((prev) => ({
      ...prev,
      [key]: key === 'showFeatured' ? false : '',
    }));
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilters({
      empresa: '',
      localizacao: '',
      tipoContrato: '',
      status: '',
      categoria: '',
      modalidade: '',
      experiencia: '',
      showFeatured: false,
    });
    setMinSalary(0);
    setSortBy('recentes');
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
  };

  const handleActivateAlert = async () => {
    const email = alertEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setAlertState({ status: 'error', message: 'Introduza um email válido.' });
      return;
    }

    setAlertState({ status: 'loading', message: '' });

    try {
      const response = await fetch('/api/job-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          filters: {
            search: searchTerm,
            localizacao: filters.localizacao,
            tipoContrato: filters.tipoContrato,
            categoria: filters.categoria,
            modalidade: filters.modalidade,
            experiencia: filters.experiencia,
            minSalary,
          },
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setAlertState({
          status: 'error',
          message: data.error || 'Não foi possível ativar o alerta.',
        });
        return;
      }

      setAlertState({
        status: 'success',
        message: data.message || 'Alerta ativado. Vamos avisar-te por email.',
      });
    } catch (error) {
      setAlertState({
        status: 'error',
        message:
          'Não foi possível estabelecer a ligação. Tenta novamente dentro de momentos.',
      });
    }
  };

  return (
    <>
      <Head>
        <title>Vagas de emprego | EmpregoSTP</title>
        <meta
          name="description"
          content="Descubra vagas com filtros úteis, compatibilidade visual e candidaturas rápidas em São Tomé e Príncipe."
        />
      </Head>

      <PublicPageShell headerVariant="light" showFooter={!isMobileView}>
        <div className={styles.page}>
          <section className={styles.searchSection}>
            <div className={styles.heroCopy}>
              <span className={styles.heroEyebrow}>
                Oportunidades em destaque
              </span>
              <h1>Encontre a vaga certa para o seu próximo passo.</h1>
              <p>
                Explore oportunidades em São Tomé e Príncipe e candidate-se
                diretamente às vagas que combinam com o seu perfil.
              </p>
            </div>
            <form
              id="job-search"
              className={styles.searchBar}
              onSubmit={handleSearchSubmit}
            >
              <label className={styles.searchField}>
                <FiSearch size={22} aria-hidden="true" />
                <span className={styles.srOnly}>
                  Cargo, palavra-chave ou empresa
                </span>
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Cargo, palavra-chave ou empresa"
                />
              </label>

              <span className={styles.searchDivider} aria-hidden="true" />

              <label className={styles.searchField}>
                <FiMapPin size={22} aria-hidden="true" />
                <span className={styles.srOnly}>Localização</span>
                <input
                  type="search"
                  list="job-locations"
                  value={filters.localizacao}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      localizacao: event.target.value,
                    }))
                  }
                  placeholder="Localização (ex: São Tomé)"
                />
                <datalist id="job-locations">
                  {localizacoes.map((localizacao) => (
                    <option key={localizacao} value={localizacao} />
                  ))}
                </datalist>
              </label>

              <button type="submit" className={styles.searchSubmit}>
                <FiSearch size={18} aria-hidden="true" />
                Procurar vagas
              </button>
            </form>

            <div
              className={styles.mobileQuickFilters}
              aria-label="Filtros rápidos"
            >
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                aria-expanded={filtersOpen}
                aria-controls="job-filters-panel"
              >
                <span>{filters.categoria || 'Categoria'}</span>
                <FiChevronDown aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                aria-expanded={filtersOpen}
                aria-controls="job-filters-panel"
              >
                <span>
                  {filters.tipoContrato
                    ? normalizeContractType(filters.tipoContrato)
                    : 'Tipo de contrato'}
                </span>
                <FiChevronDown aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                aria-expanded={filtersOpen}
                aria-controls="job-filters-panel"
              >
                <span>
                  {minSalary
                    ? `+${formatCompactMoney(minSalary)} ${salaryCurrency}`
                    : 'Faixa salarial'}
                </span>
                <FiChevronDown aria-hidden="true" />
              </button>
              <button
                type="button"
                className={
                  filters.modalidade === 'remoto'
                    ? styles.quickFilterActive
                    : ''
                }
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    modalidade: current.modalidade === 'remoto' ? '' : 'remoto',
                  }))
                }
              >
                Remoto
              </button>
            </div>
          </section>

          <section className={styles.discoverySection}>
            <form
              ref={filtersPanelRef}
              id="job-filters-panel"
              className={`${styles.filtersPanel} ${
                filtersOpen ? styles.filtersPanelOpen : ''
              }`}
              onSubmit={handleSearchSubmit}
              role={filtersOpen && isMobileView ? 'dialog' : undefined}
              aria-modal={filtersOpen && isMobileView ? 'true' : undefined}
              aria-label="Filtros de vagas"
            >
              <div className={styles.filtersTop}>
                <h2>Filtros</h2>
                <div className={styles.filterActions}>
                  <button type="button" onClick={clearFilters}>
                    Limpar
                  </button>
                  <button
                    type="button"
                    className={styles.mobileFiltersClose}
                    onClick={() => setFiltersOpen(false)}
                    aria-label="Fechar filtros"
                  >
                    <FiX size={20} />
                  </button>
                </div>
              </div>

              {activeFilterChips.length > 0 ? (
                <div className={styles.activeFilters}>
                  {activeFilterChips.map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() => clearFilter(chip.key)}
                    >
                      {chip.label} <FiX size={16} />
                    </button>
                  ))}
                </div>
              ) : null}

              <div className={styles.filterSection}>
                {renderFilterHeader('categoria', 'Categoria')}
                {!collapsedSections.categoria &&
                  categorias.slice(0, 6).map((categoria) => (
                    <label key={categoria} className={styles.checkRow}>
                      <input
                        type="checkbox"
                        checked={filters.categoria === categoria}
                        onChange={() =>
                          setFilters((prev) => ({
                            ...prev,
                            categoria:
                              prev.categoria === categoria ? '' : categoria,
                          }))
                        }
                      />
                      <span>{categoria}</span>
                      <strong>
                        {countBy(jobs, (job) => job.categoria === categoria)}
                      </strong>
                    </label>
                  ))}
              </div>

              <div className={styles.filterSection}>
                {renderFilterHeader('tipoContrato', 'Tipo de contrato')}
                {!collapsedSections.tipoContrato &&
                  tiposContrato.slice(0, 6).map((tipo) => (
                    <label key={tipo} className={styles.checkRow}>
                      <input
                        type="checkbox"
                        checked={filters.tipoContrato === tipo}
                        onChange={() =>
                          setFilters((prev) => ({
                            ...prev,
                            tipoContrato:
                              prev.tipoContrato === tipo ? '' : tipo,
                          }))
                        }
                      />
                      <span>{normalizeContractType(tipo)}</span>
                      <strong>
                        {countBy(jobs, (job) => job.tipoContrato === tipo)}
                      </strong>
                    </label>
                  ))}
              </div>

              <div className={styles.filterSection}>
                {renderFilterHeader('modalidade', 'Modalidade')}
                {!collapsedSections.modalidade &&
                  [
                    ['presencial', 'Presencial', countBy(jobs, isOnSiteJob)],
                    ['hibrido', 'Híbrido', countBy(jobs, isHybridJob)],
                    ['remoto', 'Remoto', countBy(jobs, isRemoteJob)],
                  ].map(([value, label, count]) => (
                    <label key={value} className={styles.checkRow}>
                      <input
                        type="checkbox"
                        checked={filters.modalidade === value}
                        onChange={() =>
                          setFilters((prev) => ({
                            ...prev,
                            modalidade: prev.modalidade === value ? '' : value,
                          }))
                        }
                      />
                      <span>{label}</span>
                      <strong>{count}</strong>
                    </label>
                  ))}
              </div>

              <div className={styles.filterSection}>
                {renderFilterHeader('localizacao', 'Localização')}
                {!collapsedSections.localizacao &&
                  localizacoes.slice(0, 6).map((localizacao) => (
                    <label key={localizacao} className={styles.checkRow}>
                      <input
                        type="checkbox"
                        checked={filters.localizacao === localizacao}
                        onChange={() =>
                          setFilters((prev) => ({
                            ...prev,
                            localizacao:
                              prev.localizacao === localizacao
                                ? ''
                                : localizacao,
                          }))
                        }
                      />
                      <span>{localizacao}</span>
                      <strong>
                        {countBy(
                          jobs,
                          (job) => job.localizacao === localizacao,
                        )}
                      </strong>
                    </label>
                  ))}
              </div>

              <div className={styles.filterSection}>
                {renderFilterHeader('experiencia', 'Experiência')}
                {!collapsedSections.experiencia &&
                  experienceBuckets.map((bucket) => (
                    <label key={bucket} className={styles.checkRow}>
                      <input
                        type="checkbox"
                        checked={filters.experiencia === bucket}
                        onChange={() =>
                          setFilters((prev) => ({
                            ...prev,
                            experiencia:
                              prev.experiencia === bucket ? '' : bucket,
                          }))
                        }
                      />
                      <span>{getExperienceLabel(bucket)}</span>
                      <strong>
                        {countBy(
                          jobs,
                          (job) => getExperienceBucket(job) === bucket,
                        )}
                      </strong>
                    </label>
                  ))}
              </div>

              <div className={styles.filterSection}>
                <div className={styles.filterSectionHeader}>
                  <h3>Salário mínimo</h3>
                </div>
                <input
                  className={styles.salaryRange}
                  type="range"
                  min="0"
                  max={maxSalary}
                  step="1000"
                  value={minSalary}
                  onChange={(event) => setMinSalary(Number(event.target.value))}
                  aria-label="Salário mínimo"
                />
                <div className={styles.salaryRangeLabels}>
                  <span>0</span>
                  <strong>
                    {formatCompactMoney(minSalary || maxSalary)}{' '}
                    {salaryCurrency}
                  </strong>
                </div>
              </div>

              <div className={styles.alertCard}>
                <span className={styles.alertIcon}>
                  <FiBell size={26} />
                </span>
                <strong>Cria um alerta</strong>
                <p>
                  Recebe já por email as vagas publicadas com estes filtros.
                </p>
                <input
                  type="email"
                  className={styles.alertInput}
                  placeholder="o.teu@email.com"
                  value={alertEmail}
                  onChange={(event) => {
                    setAlertEmail(event.target.value);
                    if (alertState.status !== 'idle') {
                      setAlertState({ status: 'idle', message: '' });
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleActivateAlert();
                    }
                  }}
                  aria-label="Email para receber o alerta de vagas"
                  disabled={alertState.status === 'loading'}
                />
                <button
                  type="button"
                  onClick={handleActivateAlert}
                  disabled={alertState.status === 'loading'}
                >
                  {alertState.status === 'loading'
                    ? 'A ativar…'
                    : 'Ativar alerta'}
                </button>
                {alertState.message ? (
                  <p
                    className={`${styles.alertFeedback} ${
                      alertState.status === 'error'
                        ? styles.alertFeedbackError
                        : styles.alertFeedbackSuccess
                    }`}
                    role="status"
                    aria-live="polite"
                  >
                    {alertState.message}
                  </p>
                ) : null}
              </div>
            </form>

            <div className={styles.resultsPanel}>
              <div className={styles.resultsHeader}>
                <div className={styles.resultsSummary}>
                  <h2>
                    <span className={styles.desktopResultsLabel}>
                      A mostrar <strong>{filteredJobs.length}</strong>{' '}
                      {filteredJobs.length === 1 ? 'vaga' : 'vagas'}
                    </span>
                    <span className={styles.mobileResultsLabel}>
                      Vagas recentes <strong>({filteredJobs.length})</strong>
                    </span>
                  </h2>
                  <button
                    type="button"
                    className={styles.mobileFiltersButton}
                    onClick={() => setFiltersOpen(true)}
                    aria-expanded={filtersOpen}
                    aria-controls="job-filters-panel"
                  >
                    <FiSliders size={18} />
                    Filtros
                  </button>
                </div>
                <div className={styles.resultsTools}>
                  <span>Ordenar por:</span>
                  <select
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value)}
                    aria-label="Ordenar vagas"
                  >
                    <option value="recentes">Mais recentes</option>
                    <option value="prazo">Prazo</option>
                    <option value="salario">Maior salário</option>
                  </select>
                </div>
              </div>

              {isLoading ? (
                <div className={styles.loadingState}>
                  <div className={styles.loadingSpinner} />
                  <p>A atualizar resultados…</p>
                </div>
              ) : filteredJobs.length === 0 ? (
                <div className={styles.emptyState}>
                  <h3>Nenhuma vaga combina com os filtros atuais</h3>
                  <p>
                    Limpe os filtros ou experimente outra combinação para
                    ampliar os resultados.
                  </p>
                  <button type="button" onClick={clearFilters}>
                    Limpar filtros
                  </button>
                </div>
              ) : (
                <>
                  <div className={styles.jobsGrid}>
                    {visibleJobs.map((job) => (
                      <JobCard
                        key={job.id}
                        job={job}
                        referenceNow={referenceNow}
                      />
                    ))}
                  </div>

                  {totalPages > 1 ? (
                    <nav
                      className={styles.pagination}
                      aria-label="Paginação das vagas"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setCurrentPage((page) => Math.max(1, page - 1))
                        }
                        disabled={currentPage === 1}
                        aria-label="Página anterior"
                      >
                        ‹
                      </button>
                      {paginationItems.map((page) => {
                        if (typeof page !== 'number') {
                          return (
                            <span key={page} aria-hidden="true">
                              …
                            </span>
                          );
                        }

                        return (
                          <button
                            key={page}
                            type="button"
                            className={
                              currentPage === page ? styles.pageActive : ''
                            }
                            onClick={() => setCurrentPage(page)}
                            aria-current={
                              currentPage === page ? 'page' : undefined
                            }
                          >
                            {page}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() =>
                          setCurrentPage((page) =>
                            Math.min(totalPages, page + 1),
                          )
                        }
                        disabled={currentPage === totalPages}
                        aria-label="Página seguinte"
                      >
                        ›
                      </button>
                    </nav>
                  ) : null}

                  {mobileVisibleCount < filteredJobs.length ? (
                    <button
                      type="button"
                      className={styles.mobileLoadMore}
                      onClick={() =>
                        setMobileVisibleCount(
                          (count) => count + MOBILE_JOBS_BATCH,
                        )
                      }
                    >
                      Ver mais vagas
                      <FiChevronDown aria-hidden="true" />
                    </button>
                  ) : null}
                  <p className={styles.mobileResultsFoot}>
                    A mostrar{' '}
                    {Math.min(visibleJobs.length, filteredJobs.length)} de{' '}
                    {filteredJobs.length} vagas
                  </p>
                </>
              )}
            </div>
          </section>

          <a
            href="#job-search"
            className={styles.mobileSearchFab}
            aria-label="Voltar à pesquisa de vagas"
          >
            <FiSearch aria-hidden="true" />
          </a>

          <nav
            className={styles.mobileBottomNav}
            aria-label="Navegação móvel de vagas"
          >
            <Link href="/">
              <FiHome aria-hidden="true" />
              <span>Início</span>
            </Link>
            <Link href="/vagas" aria-current="page">
              <FiBriefcase aria-hidden="true" />
              <span>Vagas</span>
            </Link>
            <Link href="/dashboard/candidato?tab=saved">
              <FiBookmark aria-hidden="true" />
              <span>Guardadas</span>
            </Link>
            <Link href="/profile">
              <FiUser aria-hidden="true" />
              <span>Perfil</span>
            </Link>
          </nav>
        </div>
      </PublicPageShell>
    </>
  );
}

export async function getServerSideProps(context) {
  try {
    const { admin } = await import('../../lib/firebaseAdmin');
    const { getEmpresaPlanSummary } =
      await import('../../lib/empresaPlanFeatures');
    const {
      getEffectiveJobStatus,
      isJobPubliclyVisible,
      syncExpiredJobStatus,
    } = await import('../../lib/jobExpiration');

    context?.res?.setHeader?.(
      'Cache-Control',
      'public, s-maxage=30, stale-while-revalidate=120',
    );

    const serializeTimestamp = (timestamp) => {
      if (!timestamp) return null;
      if (timestamp.toDate) return timestamp.toDate().toISOString();
      if (timestamp.toMillis)
        return new Date(timestamp.toMillis()).toISOString();
      if (typeof timestamp === 'string') return timestamp;
      if (timestamp instanceof Date) return timestamp.toISOString();
      return null;
    };

    const serializeJob = (job) => ({
      id: job.id,
      ...Object.keys(job).reduce((acc, key) => {
        const value = job[key];
        if (value && (value.toDate || value.toMillis)) {
          acc[key] = serializeTimestamp(value);
        } else if (
          value &&
          typeof value === 'object' &&
          !Array.isArray(value) &&
          value.constructor === Object
        ) {
          acc[key] = Object.keys(value).reduce((nestedAcc, nestedKey) => {
            const nestedValue = value[nestedKey];
            nestedAcc[nestedKey] =
              nestedValue && (nestedValue.toDate || nestedValue.toMillis)
                ? serializeTimestamp(nestedValue)
                : nestedValue;
            return nestedAcc;
          }, {});
        } else {
          acc[key] = value;
        }
        return acc;
      }, {}),
    });

    const snapshot = await admin
      .firestore()
      .collection('jobs')
      .orderBy('createdAt', 'desc')
      .get();

    const normalizedDocs = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const synced = await syncExpiredJobStatus(doc.ref, doc.data(), admin);
        return {
          id: doc.id,
          ...synced.jobData,
          status: getEffectiveJobStatus(synced.jobData),
        };
      }),
    );

    const publicJobs = normalizedDocs.filter((job) =>
      isJobPubliclyVisible(job),
    );

    const companyIds = [
      ...new Set(publicJobs.map((job) => job.companyId).filter(Boolean)),
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
        name: companyData.name || companyData.fullName || 'Empresa',
        logo: planSummary.features?.logoOnJob
          ? companyData.logoUrl || companyData.logo || ''
          : '',
        verified: Boolean(planSummary.features?.companyVerified),
      });
    });

    const jobs = publicJobs
      .map((job) => {
        const company = companiesById.get(job.companyId) || {};
        return serializeJob(
          projectPublicJob({
            ...job,
            empresaNome:
              company.name || job.empresaNome || job.companyName || 'Empresa',
            companyName:
              company.name || job.companyName || job.empresaNome || 'Empresa',
            empresaLogo: company.logo || job.empresaLogo || '',
            companyVerified: company.verified || job.companyVerified || false,
          }),
        );
      })
      .sort(compareRecentJobs);

    return {
      props: { initialJobs: jobs, referenceNow: Date.now() },
    };
  } catch (error) {
    console.error('Erro ao buscar vagas:', error);
    return {
      props: { initialJobs: [], referenceNow: Date.now() },
    };
  }
}
