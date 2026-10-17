import React, { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  FiArrowRight,
  FiBell,
  FiBriefcase,
  FiCheckCircle,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiMapPin,
  FiSearch,
  FiSliders,
  FiStar,
  FiX,
} from 'react-icons/fi';
import CoinsIcon from '../../components/icons/CoinsIcon';
import PublicPageShell from '../../components/PublicPageShell';
import {
  filterPublicJobsByCompany,
  projectPublicJob,
} from '../../lib/publicJob';
import useScrollReveal from '../../lib/useScrollReveal';
import styles from '../../styles/VagasPage.module.css';

function normalizeSearchValue(value) {
  if (Array.isArray(value)) return value.join(' ');
  return String(value || '');
}

function getRouteQueryValue(value) {
  return typeof value === 'string' ? value : '';
}

const SORT_OPTIONS = ['recentes', 'prazo', 'salario'];

// Patamares do filtro de salário mínimo; só aparecem os abaixo do maior
// salário publicado.
const HERO_WORDS = [
  'Encontre',
  'a',
  'vaga',
  'certa',
  'para',
  'o',
  'seu',
  { text: 'próximo', accent: true },
  { text: 'passo.', accent: true },
];

const SALARY_STEPS = [2000, 5000, 10000, 15000, 20000, 30000, 50000, 100000];

const EMPTY_FILTERS = {
  empresa: '',
  localizacao: '',
  tipoContrato: '',
  status: '',
  categoria: '',
  modalidade: '',
  experiencia: '',
  showFeatured: false,
};

// O estado dos filtros vive no URL: o botão "voltar" a partir de uma vaga
// devolve a mesma pesquisa, e um link filtrado pode ser partilhado.
function readStateFromQuery(query = {}) {
  const value = (key) => getRouteQueryValue(query[key]);
  const salary = Number.parseInt(value('salario'), 10);
  const sort = value('ordem');
  const page = Number(value('page'));

  return {
    searchTerm: value('search') || value('q'),
    filters: {
      ...EMPTY_FILTERS,
      empresa: value('empresa'),
      localizacao: value('local') || value('loc'),
      tipoContrato: value('contrato'),
      categoria: value('categoria') || value('cat'),
      modalidade: value('modalidade'),
      experiencia: value('experiencia'),
      showFeatured: value('destaque') === '1',
    },
    minSalary: Number.isFinite(salary) && salary > 0 ? salary : 0,
    sortBy: SORT_OPTIONS.includes(sort) ? sort : 'recentes',
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  };
}

function buildQueryFromState({
  searchTerm,
  filters,
  minSalary,
  sortBy,
  page = 1,
}) {
  const entries = {
    search: searchTerm.trim(),
    empresa: filters.empresa,
    categoria: filters.categoria,
    contrato: filters.tipoContrato,
    modalidade: filters.modalidade,
    experiencia: filters.experiencia,
    local: filters.localizacao.trim(),
    salario: minSalary > 0 ? String(minSalary) : '',
    destaque: filters.showFeatured ? '1' : '',
    ordem: sortBy !== 'recentes' ? sortBy : '',
    page: page > 1 ? String(page) : '',
  };
  return Object.fromEntries(Object.entries(entries).filter(([, v]) => v));
}

function serializeQuery(query) {
  return new URLSearchParams(
    Object.entries(query).sort(([a], [b]) => a.localeCompare(b)),
  ).toString();
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
    'full-time': 'Tempo inteiro',
    'tempo inteiro': 'Tempo inteiro',
    'tempo integral': 'Tempo inteiro',
    'part-time': 'Tempo parcial',
    'tempo parcial': 'Tempo parcial',
    'meio período': 'Tempo parcial',
    'meio periodo': 'Tempo parcial',
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

function isFeaturedJob(job) {
  return (
    job.destaque === true || job.featured === true || job.isFeatured === true
  );
}

const MODALITY_PREDICATES = {
  presencial: isOnSiteJob,
  hibrido: isHybridJob,
  remoto: isRemoteJob,
};

// `skip` ignora um grupo de filtros: assim cada grupo conta as vagas que
// ficariam visíveis se a opção fosse escolhida, em vez do total global.
function applyJobFilters(jobs, { searchTerm, filters, minSalary }, skip = '') {
  let result = jobs;
  const search = searchTerm.toLowerCase().trim();

  if (search) {
    result = result.filter((job) => matchesSearch(job, search));
  }
  if (filters.empresa) {
    result = filterPublicJobsByCompany(result, filters.empresa);
  }
  if (filters.localizacao && skip !== 'localizacao') {
    const location = filters.localizacao.toLowerCase().trim();
    result = result.filter((job) =>
      String(job.localizacao || '')
        .toLowerCase()
        .includes(location),
    );
  }
  if (filters.tipoContrato && skip !== 'tipoContrato') {
    result = result.filter((job) => job.tipoContrato === filters.tipoContrato);
  }
  if (filters.status) {
    result = result.filter((job) => job.status === filters.status);
  }
  if (filters.categoria && skip !== 'categoria') {
    const category = String(filters.categoria).toLowerCase();
    result = result.filter(
      (job) => String(job.categoria || '').toLowerCase() === category,
    );
  }
  if (filters.experiencia && skip !== 'experiencia') {
    result = result.filter(
      (job) => getExperienceBucket(job) === filters.experiencia,
    );
  }
  const modalityPredicate = MODALITY_PREDICATES[filters.modalidade];
  if (modalityPredicate && skip !== 'modalidade') {
    result = result.filter(modalityPredicate);
  }
  if (filters.showFeatured) {
    result = result.filter(isFeaturedJob);
  }
  if (minSalary > 0) {
    result = result.filter((job) => {
      const salary =
        parseMoney(job.salarioAte) || parseMoney(job.salarioDe) || 0;
      return salary >= minSalary;
    });
  }

  return result;
}

function featuredFirst(a, b) {
  if (a.destaque && !b.destaque) return -1;
  if (!a.destaque && b.destaque) return 1;
  return 0;
}

function sortJobs(jobs, sortBy) {
  const sorted = [...jobs];
  if (sortBy === 'prazo') {
    return sorted.sort(
      (a, b) =>
        featuredFirst(a, b) ||
        new Date(a.dataFecho || '9999-12-31') -
          new Date(b.dataFecho || '9999-12-31'),
    );
  }
  if (sortBy === 'salario') {
    return sorted.sort(
      (a, b) =>
        featuredFirst(a, b) ||
        (parseMoney(b.salarioDe) || 0) - (parseMoney(a.salarioDe) || 0),
    );
  }
  return sorted.sort(compareRecentJobs);
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

function JobCard({ job, referenceNow, sponsored = false }) {
  const companyName =
    job.empresaNome || job.companyName || 'Empresa não indicada';
  const salary = formatSalary(job.salarioDe, job.salarioAte);
  const currency = job.currency || 'STD';
  const salaryLabel =
    salary === 'A combinar' ? salary : `${salary} ${currency}`;
  const featured = isFeaturedJob(job);
  const closed = isClosedJob(job);
  const publishedAt = job.publicadoEm || job.publishedAt || job.createdAt;
  const companyLogo = job.empresaLogo || job.companyLogo;
  const modality = getModalityLabel(job);
  const contract = normalizeContractType(job.tipoContrato);
  const cardClassName = [
    styles.jobCard,
    closed ? styles.jobCardClosed : '',
    featured ? styles.jobCardFeatured : '',
    sponsored ? styles.jobCardSponsored : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article className={cardClassName}>
      {sponsored ? (
        <span className={styles.sponsoredGlow} aria-hidden="true" />
      ) : null}
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
      </div>

      <div className={styles.jobCardContent}>
        {/* Linha de cima: selo e empresa; depois o título; depois todos os
            dados da vaga numa só fila de pílulas, com o salário no fim. */}
        <div className={styles.jobCardTop}>
          {featured ? (
            <span className={styles.featuredBadge}>
              <FiStar aria-hidden="true" />
              {sponsored ? 'Patrocinada' : 'Em destaque'}
            </span>
          ) : null}
          <p className={styles.companyName}>
            {companyName}
            {/* `role="img"` é obrigatório: um <span> sem role não pode ter
                `aria-label`, e os leitores de ecrã ignoravam o selo. */}
            {job.companyVerified ? (
              <span
                role="img"
                title="Empresa verificada"
                aria-label="Empresa verificada"
              >
                <FiCheckCircle aria-hidden="true" />
              </span>
            ) : null}
          </p>
        </div>
        <Link href={`/vaga/${job.id}`} className={styles.jobTitleLink}>
          <h3>{job.titulo}</h3>
        </Link>

        <div className={styles.jobTags} aria-label="Características da vaga">
          <span className={styles.metaTag}>
            <FiMapPin aria-hidden="true" />
            {job.localizacao || 'Localização não indicada'}
          </span>
          <span
            className={closed ? styles.statusBadgeClosed : styles.statusBadge}
          >
            {closed ? 'Encerrada' : 'Aberta'}
          </span>
          <span className={styles.metaTag}>
            <FiClock aria-hidden="true" />
            Publicada {formatPublishedAgo(publishedAt, referenceNow)}
          </span>
          <span className={styles.contractTag}>
            <FiBriefcase aria-hidden="true" />
            {contract}
          </span>
          <span className={styles.modalityTag}>{modality}</span>
          <span className={styles.salaryTag}>
            <CoinsIcon aria-hidden="true" />
            {salaryLabel}
          </span>
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

const SPONSORED_LIMIT = 6;

const SPONSORED_AUTOPLAY_MS = 6000;

// Vagas patrocinadas (as marcadas como destaque) no mesmo formato de lista das
// restantes; com mais de uma, passam em carrossel. O avanço automático pára
// com o rato ou o foco por cima e com movimento reduzido.
function SponsoredJobsCarousel({ jobs, referenceNow }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = jobs.length;
  const isCarousel = count > 1;

  useEffect(() => {
    setActive((current) => (current >= count ? 0 : current));
  }, [count]);

  useEffect(() => {
    if (
      !isCarousel ||
      paused ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return undefined;
    const timer = window.setInterval(
      () => setActive((current) => (current + 1) % count),
      SPONSORED_AUTOPLAY_MS,
    );
    return () => window.clearInterval(timer);
  }, [count, isCarousel, paused]);

  const goTo = (index) => setActive(((index % count) + count) % count);

  if (!isCarousel) {
    return <JobCard job={jobs[0]} referenceNow={referenceNow} sponsored />;
  }

  return (
    <div
      className={styles.sponsoredCarousel}
      role="region"
      aria-roledescription="carrossel"
      aria-label="Vagas patrocinadas"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setPaused(false);
        }
      }}
    >
      <div className={styles.sponsoredViewport}>
        <div
          className={styles.sponsoredTrack}
          style={{ transform: `translateX(-${active * 100}%)` }}
        >
          {jobs.map((job, index) => (
            <div
              key={job.id}
              className={styles.sponsoredSlide}
              role="group"
              aria-roledescription="vaga"
              aria-label={`${index + 1} de ${count}`}
              aria-hidden={index !== active}
              inert={index !== active}
            >
              <JobCard job={job} referenceNow={referenceNow} sponsored />
            </div>
          ))}
        </div>
      </div>

      <div className={styles.sponsoredControls}>
        <button
          type="button"
          className={styles.sponsoredArrow}
          onClick={() => goTo(active - 1)}
          aria-label="Vaga patrocinada anterior"
        >
          <FiChevronLeft aria-hidden="true" />
        </button>
        <div
          className={styles.sponsoredDots}
          role="group"
          aria-label="Escolher vaga patrocinada"
        >
          {jobs.map((job, index) => (
            <button
              key={job.id}
              type="button"
              className={`${styles.sponsoredDot} ${
                index === active ? styles.sponsoredDotActive : ''
              }`}
              onClick={() => goTo(index)}
              aria-label={`Ver vaga patrocinada ${index + 1}`}
              aria-current={index === active ? 'true' : undefined}
            />
          ))}
        </div>
        <button
          type="button"
          className={styles.sponsoredArrow}
          onClick={() => goTo(active + 1)}
          aria-label="Vaga patrocinada seguinte"
        >
          <FiChevronRight aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default function VagasPage({
  initialJobs = [],
  referenceNow = 0,
  loadFailed = false,
}) {
  const router = useRouter();
  const jobs = initialJobs;
  const [searchState, setSearchState] = useState(() =>
    readStateFromQuery(router.query),
  );
  const { searchTerm, filters, minSalary, sortBy } = searchState;
  // Filtros e página mudam juntos: voltar pelo histórico não deve repor a
  // página 1 num efeito posterior à leitura do URL.
  const setSearchField = (key, value) =>
    setSearchState((current) => ({
      ...current,
      [key]: typeof value === 'function' ? value(current[key]) : value,
      page: 1,
    }));
  const setSearchTerm = (value) => setSearchField('searchTerm', value);
  const setFilters = (value) => setSearchField('filters', value);
  const setMinSalary = (value) => setSearchField('minSalary', value);
  const setSortBy = (value) => setSearchField('sortBy', value);
  const setCurrentPage = (page) =>
    setSearchState((current) => ({ ...current, page }));
  const sponsoredJobs = useMemo(
    () =>
      jobs
        .filter((job) => isFeaturedJob(job) && !isClosedJob(job))
        .sort(compareRecentJobs)
        .slice(0, SPONSORED_LIMIT),
    [jobs],
  );

  const filteredJobs = useMemo(
    () =>
      sortJobs(
        applyJobFilters(jobs, { searchTerm, filters, minSalary }),
        sortBy,
      ),
    [filters, jobs, minSalary, searchTerm, sortBy],
  );
  const totalPages = Math.max(
    1,
    Math.ceil(filteredJobs.length / JOBS_PER_PAGE),
  );
  const currentPage = Math.min(searchState.page, totalPages);
  const [mobileVisibleCount, setMobileVisibleCount] =
    useState(MOBILE_JOBS_BATCH);
  const [isMobileView, setIsMobileView] = useState(false);
  const [alertEmail, setAlertEmail] = useState('');
  const [alertState, setAlertState] = useState({ status: 'idle', message: '' });
  const resultsRef = useRef(null);
  const pageRef = useRef(null);
  const syncedQueryRef = useRef(
    serializeQuery(buildQueryFromState(searchState)),
  );

  const setFilterValue = (key, value) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const scrollToResults = () => {
    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    resultsRef.current?.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  };

  // URL -> estado, só quando a mudança não foi escrita por esta página
  // (links da home, histórico). Sem esta guarda, a escrita atrasada do URL
  // apagaria o que a pessoa continuou a escrever na pesquisa.
  useEffect(() => {
    if (router.isReady === false) return;
    const next = readStateFromQuery(router.query);
    const key = serializeQuery(buildQueryFromState(next));
    if (key === syncedQueryRef.current) return;
    syncedQueryRef.current = key;
    setSearchState(next);
  }, [router.isReady, router.query]);

  // Estado -> URL, com atraso para não reescrever o histórico a cada tecla.
  useEffect(() => {
    if (router.isReady === false) return undefined;
    const timeoutId = setTimeout(() => {
      const query = buildQueryFromState({
        searchTerm,
        filters,
        minSalary,
        sortBy,
        page: currentPage,
      });
      const key = serializeQuery(query);
      if (key === syncedQueryRef.current) return;
      syncedQueryRef.current = key;
      router.replace({ pathname: router.pathname, query }, undefined, {
        shallow: true,
        scroll: false,
      });
    }, 350);
    return () => clearTimeout(timeoutId);
  }, [currentPage, filters, minSalary, router, searchTerm, sortBy]);

  useEffect(() => {
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
  const visibleJobs = useMemo(() => {
    if (isMobileView) {
      return filteredJobs.slice(0, mobileVisibleCount);
    }
    const offset = (currentPage - 1) * JOBS_PER_PAGE;
    return filteredJobs.slice(offset, offset + JOBS_PER_PAGE);
  }, [currentPage, filteredJobs, isMobileView, mobileVisibleCount]);
  useScrollReveal(pageRef, [visibleJobs, sponsoredJobs.length, loadFailed]);
  const paginationItems = useMemo(
    () => getPaginationItems(currentPage, totalPages),
    [currentPage, totalPages],
  );
  const salaryCurrency = jobs[0]?.currency || 'STD';
  const highestSalary = useMemo(
    () =>
      jobs.reduce(
        (max, job) =>
          Math.max(
            max,
            parseMoney(job.salarioAte) || parseMoney(job.salarioDe) || 0,
          ),
        0,
      ),
    [jobs],
  );
  const salarySteps = SALARY_STEPS.filter(
    (value) => value < highestSalary || value === minSalary,
  );
  const experienceBuckets = ['sem', '1-3', '3-5', '5+'];
  const facetPools = useMemo(() => {
    const state = { searchTerm, filters, minSalary };
    return Object.fromEntries(
      [
        'categoria',
        'tipoContrato',
        'modalidade',
        'localizacao',
        'experiencia',
      ].map((key) => [key, applyJobFilters(jobs, state, key)]),
    );
  }, [filters, jobs, minSalary, searchTerm]);
  // Opções que levariam a zero resultados ficam escondidas (salvo se já
  // estiverem escolhidas), para não convidar a cliques sem saída.
  const filterGroups = [
    {
      key: 'categoria',
      title: 'Categoria',
      options: categorias.map((value) => ({
        value,
        label: value,
        count: countBy(facetPools.categoria, (job) => job.categoria === value),
      })),
    },
    {
      key: 'tipoContrato',
      title: 'Tipo de contrato',
      options: tiposContrato.map((value) => ({
        value,
        label: normalizeContractType(value),
        count: countBy(
          facetPools.tipoContrato,
          (job) => job.tipoContrato === value,
        ),
      })),
    },
    {
      key: 'modalidade',
      title: 'Modalidade',
      options: [
        ['presencial', 'Presencial'],
        ['hibrido', 'Híbrido'],
        ['remoto', 'Remoto'],
      ].map(([value, label]) => ({
        value,
        label,
        count: countBy(facetPools.modalidade, MODALITY_PREDICATES[value]),
      })),
    },
    {
      key: 'localizacao',
      title: 'Localização',
      options: localizacoes.map((value) => ({
        value,
        label: value,
        count: countBy(
          facetPools.localizacao,
          (job) => job.localizacao === value,
        ),
      })),
    },
    {
      key: 'experiencia',
      title: 'Experiência',
      options: experienceBuckets.map((value) => ({
        value,
        label: getExperienceLabel(value),
        count: countBy(
          facetPools.experiencia,
          (job) => getExperienceBucket(job) === value,
        ),
      })),
    },
  ]
    .map((group) => ({
      ...group,
      options: group.options
        .filter(
          (option) => option.count > 0 || filters[group.key] === option.value,
        )
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
    }))
    .filter((group) => group.options.length > 0);
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
            { presencial: 'Presencial', hibrido: 'Híbrido', remoto: 'Remoto' }[
              filters.modalidade
            ] || filters.modalidade,
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

  const clearFilters = () => {
    setSearchTerm('');
    setFilters(EMPTY_FILTERS);
    setMinSalary(0);
    setSortBy('recentes');
  };

  // A lista já filtra enquanto se escreve; o botão leva aos resultados e
  // fecha o teclado no telemóvel.
  const handleSearchSubmit = (event) => {
    event.preventDefault();
    document.activeElement?.blur?.();
    scrollToResults();
  };

  const goToPage = (page) => {
    setCurrentPage(page);
    scrollToResults();
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
        <div className={styles.page} ref={pageRef}>
          <section className={styles.searchSection}>
            <div className={styles.heroGlow} aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className={styles.heroCopy}>
              <span className={styles.heroEyebrow}>
                <span className={styles.heroPulse} aria-hidden="true" />
                Oportunidades de trabalho
              </span>
              <h1>
                {HERO_WORDS.map((word, index) => {
                  const text = typeof word === 'string' ? word : word.text;
                  return (
                    <Fragment key={text}>
                      <span
                        className={`${styles.heroWord} ${
                          word.accent ? styles.heroWordAccent : ''
                        }`}
                        style={{ '--i': index }}
                      >
                        {text}
                      </span>{' '}
                    </Fragment>
                  );
                })}
              </h1>
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
                Procurar vagas
                <FiArrowRight size={18} aria-hidden="true" />
              </button>
            </form>
          </section>

          {sponsoredJobs.length ? (
            <section
              className={styles.sponsoredSection}
              aria-labelledby="sponsored-title"
            >
              <header className={styles.sponsoredHeader} data-reveal>
                <h2 id="sponsored-title">Vagas patrocinadas</h2>
                <p>
                  Oportunidades destacadas pelas empresas que as publicaram.
                </p>
              </header>
              <SponsoredJobsCarousel
                jobs={sponsoredJobs}
                referenceNow={referenceNow}
              />
            </section>
          ) : null}

          <section
            className={`${styles.discoverySection} ${styles.discoverySectionFull}`}
          >
            <div ref={resultsRef} className={styles.resultsPanel}>
              <div
                className={styles.filterBar}
                data-reveal
                role="group"
                aria-label="Filtros de vagas"
              >
                <span className={styles.filterBarLabel}>
                  <FiSliders aria-hidden="true" />
                  Filtrar
                </span>
                {filterGroups.map((group) => (
                  <label
                    key={group.key}
                    className={`${styles.filterPill} ${
                      filters[group.key] ? styles.filterPillActive : ''
                    }`}
                  >
                    <span className={styles.srOnly}>{group.title}</span>
                    <select
                      value={filters[group.key] || ''}
                      onChange={(event) =>
                        setFilterValue(group.key, event.target.value)
                      }
                    >
                      <option value="">{group.title}</option>
                      {group.options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label} ({option.count})
                        </option>
                      ))}
                    </select>
                    <FiChevronDown aria-hidden="true" />
                  </label>
                ))}
                {salarySteps.length ? (
                  <label
                    className={`${styles.filterPill} ${
                      minSalary > 0 ? styles.filterPillActive : ''
                    }`}
                  >
                    <span className={styles.srOnly}>Salário mínimo</span>
                    <select
                      value={minSalary}
                      onChange={(event) =>
                        setMinSalary(Number(event.target.value))
                      }
                    >
                      <option value={0}>Salário</option>
                      {salarySteps.map((value) => (
                        <option key={value} value={value}>
                          +{formatCompactMoney(value)} {salaryCurrency}
                        </option>
                      ))}
                    </select>
                    <FiChevronDown aria-hidden="true" />
                  </label>
                ) : null}
                {activeFilterChips.length > 0 ? (
                  <button
                    type="button"
                    className={styles.filterClear}
                    onClick={clearFilters}
                  >
                    <FiX aria-hidden="true" />
                    Limpar
                  </button>
                ) : null}
              </div>

              <form
                className={styles.alertStrip}
                data-reveal
                style={{ '--delay': '80ms' }}
                onSubmit={(event) => {
                  event.preventDefault();
                  handleActivateAlert();
                }}
              >
                <span className={styles.alertStripIcon} aria-hidden="true">
                  <FiBell />
                </span>
                <p className={styles.alertStripText}>
                  <strong>Alerta de vagas</strong>
                  <span>
                    {activeFilterChips.length > 0
                      ? 'Receba por email as novas vagas com estes filtros.'
                      : 'Receba por email as novas vagas publicadas.'}
                  </span>
                </p>
                <div className={styles.alertStripField}>
                  <input
                    type="email"
                    placeholder="o.seu@email.com"
                    value={alertEmail}
                    onChange={(event) => {
                      setAlertEmail(event.target.value);
                      if (alertState.status !== 'idle') {
                        setAlertState({ status: 'idle', message: '' });
                      }
                    }}
                    aria-label="Email para receber o alerta de vagas"
                    autoComplete="email"
                    disabled={alertState.status === 'loading'}
                  />
                  <button
                    type="submit"
                    disabled={alertState.status === 'loading'}
                  >
                    {alertState.status === 'loading'
                      ? 'A ativar…'
                      : 'Ativar alerta'}
                  </button>
                </div>
                {alertState.message ? (
                  <p
                    className={`${styles.alertStripFeedback} ${
                      alertState.status === 'error'
                        ? styles.alertStripError
                        : styles.alertStripSuccess
                    }`}
                    role="status"
                    aria-live="polite"
                  >
                    {alertState.message}
                  </p>
                ) : null}
              </form>

              <div className={styles.resultsHeader}>
                <div className={styles.resultsSummary}>
                  <h2>
                    <span className={styles.desktopResultsLabel}>
                      <strong>{filteredJobs.length}</strong>{' '}
                      {filteredJobs.length === 1
                        ? 'vaga encontrada'
                        : 'vagas encontradas'}
                    </span>
                    <span className={styles.mobileResultsLabel}>
                      Vagas <strong>({filteredJobs.length})</strong>
                    </span>
                  </h2>
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

              {loadFailed ? (
                <div className={styles.emptyState} role="alert">
                  <h3>Não foi possível carregar as vagas.</h3>
                  <p>Verifique a ligação e tente novamente.</p>
                  <button type="button" onClick={() => router.reload()}>
                    Tentar novamente
                  </button>
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
                    {visibleJobs.map((job, index) => (
                      <div
                        key={job.id}
                        className={styles.jobReveal}
                        data-reveal
                        style={{ '--delay': `${Math.min(index, 5) * 70}ms` }}
                      >
                        <JobCard job={job} referenceNow={referenceNow} />
                      </div>
                    ))}
                  </div>

                  {totalPages > 1 ? (
                    <nav
                      className={styles.pagination}
                      aria-label="Paginação das vagas"
                    >
                      <button
                        type="button"
                        onClick={() => goToPage(Math.max(1, currentPage - 1))}
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
                            onClick={() => goToPage(page)}
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
                          goToPage(Math.min(totalPages, currentPage + 1))
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
    if (context?.res) {
      context.res.statusCode = 503;
      context.res.setHeader('Cache-Control', 'no-store');
    }
    return {
      props: { initialJobs: [], referenceNow: Date.now(), loadFailed: true },
    };
  }
}
