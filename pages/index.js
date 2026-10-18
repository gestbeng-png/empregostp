import fs from 'fs';
import path from 'path';
import Head from 'next/head';
import Image from 'next/image';
import { Fragment, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FiArrowRight } from 'react-icons/fi';
import PublicPageShell from '../components/PublicPageShell';
import CompactJobCard from '../components/home/CompactJobCard';
import ProductAdsCarousel from '../components/home/ProductAdsCarousel';
import VerifiedCandidatesCarousel from '../components/home/VerifiedCandidatesCarousel';
import { admin } from '../lib/firebaseAdmin';
import { getEmpresaPlanSummary } from '../lib/empresaPlanFeatures';
import {
  safeText,
  safeTimestampToISOString,
  safeTimestampToMillis,
} from '../lib/firestoreNormalize';
import {
  isContentPublished,
  normalizeContentStatus,
} from '../lib/contentPublication';
import {
  fetchSpotlightCandidates,
  getInitials,
} from '../lib/spotlightCandidates';
import { isJobPubliclyVisible } from '../lib/jobExpiration';
import { countJobsByCategory } from '../lib/jobCategoryCounts';
import { fetchPublicProductAds } from '../lib/productAds';
import useScrollReveal from '../hooks/useScrollReveal';
import styles from '../styles/HomePage.module.css';

function serializeDateValue(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value?.toDate) return value.toDate().toISOString();

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function compareRecentJobs(a, b) {
  if (a.destaque && !b.destaque) return -1;
  if (!a.destaque && b.destaque) return 1;
  if (a.premiumOnly && !b.premiumOnly) return -1;
  if (!a.premiumOnly && b.premiumOnly) return 1;
  return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
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
    voluntariado: 'Voluntariado',
  };

  return types[normalized] || value || 'Não informado';
}

function formatSalaryRange(fromValue, toValue) {
  const normalizeMoney = (value) => {
    if (!value && value !== 0) return '';
    if (String(value).trim().toLowerCase() === 'a combinar') return '';

    const numeric = Number.parseFloat(
      String(value)
        .replace(/[^\d,.-]/g, '')
        .replace(',', '.'),
    );
    if (!Number.isFinite(numeric)) return '';

    return new Intl.NumberFormat('pt-PT', {
      maximumFractionDigits: 0,
    }).format(numeric);
  };

  const from = normalizeMoney(fromValue);
  const to = normalizeMoney(toValue);

  if (from && to && from !== to) return `${from} a ${to} STD`;
  if (from) return `${from} STD`;
  if (to) return `${to} STD`;
  return 'A combinar';
}

function formatPublishedAgo(value) {
  if (!value) return 'Agora';

  const publishedDate = new Date(value);
  if (Number.isNaN(publishedDate.getTime())) return 'Agora';

  const diffMs = Date.now() - publishedDate.getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (days >= 1) return `${days}d`;
  if (hours >= 1) return `${hours}h`;
  if (minutes >= 1) return `${minutes}m`;
  return 'Agora';
}

function getPostDateLabel(post) {
  const source = post?.createdAt || post?.updatedAt;
  if (!source) return 'Agora';

  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return 'Agora';

  return date.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function truncateText(value = '', maxLength = 112) {
  const normalized = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}

// As três categorias da home; a contagem vem das vagas ativas (servidor).
const HOME_CATEGORIES = [
  { name: 'Marketing Digital', icon: 'fa-bullhorn', color: '#2563eb' },
  { name: 'Programação', icon: 'fa-code', color: '#10b981' },
  { name: 'Design', icon: 'fa-palette', color: '#0ea5e9' },
];

const CATEGORY_CONFIGS = {
  Marketing: { icon: 'fa-bullhorn', color: '#2563eb' },
  'Marketing Digital': { icon: 'fa-bullhorn', color: '#2563eb' },
  Programação: { icon: 'fa-code', color: '#10b981' },
  Desenvolvimento: { icon: 'fa-code', color: '#10b981' },
  Design: { icon: 'fa-palette', color: '#0ea5e9' },
  Administração: { icon: 'fa-briefcase', color: '#4f46e5' },
  Gestão: { icon: 'fa-briefcase', color: '#4f46e5' },
  'Gestão e Administração': { icon: 'fa-briefcase', color: '#4f46e5' },
  Vendas: { icon: 'fa-chart-line', color: '#f97316' },
  Educação: { icon: 'fa-graduation-cap', color: '#7c3aed' },
  Saúde: { icon: 'fa-heartbeat', color: '#ec4899' },
  Engenharia: { icon: 'fa-wrench', color: '#06b6d4' },
  Finanças: { icon: 'fa-dollar-sign', color: '#14b8a6' },
  'Recursos Humanos': { icon: 'fa-users', color: '#0f766e' },
  RH: { icon: 'fa-users', color: '#0f766e' },
};

// Título da hero, por linhas; cada palavra entra com o mesmo efeito das
// outras rotas.
const HERO_TITLE_LINES = [['Conectando'], ['Talentos'], ['ao', 'Sucesso']];

const HOW_IT_WORKS_STEPS = [
  {
    number: '01',
    title: 'Crie a sua conta',
    desc: 'Registe-se gratuitamente e aceda ao ecossistema da plataforma.',
    icon: 'fa-user-plus',
  },
  {
    number: '02',
    title: 'Carregue o seu CV',
    desc: 'Organize o seu perfil, currículo e informações principais numa única conta.',
    icon: 'fa-file-arrow-up',
  },
  {
    number: '03',
    title: 'Explore as oportunidades',
    desc: 'Descubra novas vagas, guarde oportunidades e acompanhe prazos com maior facilidade.',
    icon: 'fa-magnifying-glass',
  },
  {
    number: '04',
    title: 'Candidate-se',
    desc: 'Submeta a sua candidatura e acompanhe o processo com mais clareza e confiança.',
    icon: 'fa-paper-plane',
  },
];

function resolveCategoryConfig(category) {
  return (
    CATEGORY_CONFIGS[category?.name] || {
      icon: category?.icon || 'fa-folder',
      color: category?.color || '#2563eb',
    }
  );
}

async function fetchCollectionWithFallback(collectionName) {
  const collectionRef = admin.firestore().collection(collectionName);
  try {
    return await collectionRef.orderBy('createdAt', 'desc').get();
  } catch (error) {
    console.warn(
      `[home] fallback sem orderBy em ${collectionName}:`,
      error?.message || error,
    );
    return collectionRef.get();
  }
}

// A página só mostra estes campos (cartões e pesquisa local); o resto da vaga,
// como a descrição completa, não precisa de seguir no HTML.
function toHomeJobCard(job) {
  return {
    id: job.id,
    titulo: job.titulo,
    localizacao: job.localizacao,
    tipoContrato: job.tipoContrato,
    salarioDe: job.salarioDe,
    salarioAte: job.salarioAte,
    empresaLogo: job.empresaLogo,
    empresaNome: job.empresaNome,
    status: job.status,
    categoria: job.categoria,
    publicadoEm: job.publicadoEm,
    createdAt: job.createdAt,
  };
}

export async function getServerSideProps(context) {
  const previewCreativePath = '/assets/product-ads/carro-preview.png';
  const previewCreativeSrc =
    process.env.NODE_ENV === 'development' &&
    fs.existsSync(path.join(process.cwd(), 'public', previewCreativePath))
      ? previewCreativePath
      : '';

  try {
    context?.res?.setHeader?.(
      'Cache-Control',
      'public, s-maxage=60, stale-while-revalidate=300',
    );

    // Os totais de empresas e candidatos usam agregação `count()`: devolvem
    // o mesmo número sem transferir os documentos (dados pessoais) de todos
    // os utilizadores. Os destaques não dependem das vagas e vão em paralelo.
    const [
      activeJobsSnapshot,
      companiesCountSnapshot,
      candidatesCountSnapshot,
      postsSnapshot,
      testimonialsSnapshot,
      productAds,
      spotlightCandidates,
    ] = await Promise.all([
      admin
        .firestore()
        .collection('jobs')
        .where('status', '==', 'active')
        .get(),
      admin
        .firestore()
        .collection('users')
        .where('userType', '==', 'empresa')
        .count()
        .get(),
      admin
        .firestore()
        .collection('users')
        .where('userType', '==', 'candidato')
        .count()
        .get(),
      fetchCollectionWithFallback('posts'),
      admin
        .firestore()
        .collection('testimonials')
        .where('status', '==', 'approved')
        .get(),
      fetchPublicProductAds(admin.firestore()),
      fetchSpotlightCandidates(admin),
    ]);

    // Mesma contagem que `/api/jobs/categories`, feita com as vagas já lidas.
    const jobCategories = countJobsByCategory(
      activeJobsSnapshot.docs.map((doc) => doc.data()),
    );
    const activeJobsData = activeJobsSnapshot.docs
      .map((doc) => ({
        ...doc.data(),
        id: doc.id,
      }))
      .filter((job) => isJobPubliclyVisible(job));
    const companyIds = [
      ...new Set(activeJobsData.map((job) => job.companyId).filter(Boolean)),
    ];
    const companyRefs = companyIds.map((companyId) =>
      admin.firestore().collection('users').doc(companyId),
    );
    const companyDocs = companyRefs.length
      ? await admin.firestore().getAll(...companyRefs)
      : [];
    const companiesMap = new Map();

    companyDocs.forEach((doc) => {
      if (!doc.exists) return;
      const companyData = doc.data() || {};
      companiesMap.set(doc.id, {
        raw: companyData,
        planSummary: getEmpresaPlanSummary(companyData),
      });
    });

    const jobs = activeJobsData
      .map((jobData) => {
        const companyEntry = companiesMap.get(jobData.companyId) || {};
        const companyData = companyEntry.raw || {};
        const planSummary = companyEntry.planSummary || null;

        return {
          id: jobData.id,
          titulo: jobData.titulo || jobData.title || 'Sem título',
          localizacao:
            jobData.localizacao ||
            jobData.location ||
            jobData.cidade ||
            'Local não especificado',
          tipoContrato:
            jobData.tipoContrato ||
            jobData.contractType ||
            jobData.tipo ||
            'Não informado',
          salarioDe:
            jobData.salarioDe || jobData.salario || jobData.salaryMin || '',
          salarioAte: jobData.salarioAte || jobData.salaryMax || '',
          empresaLogo: planSummary?.features?.logoOnJob
            ? companyData.logoUrl ||
              companyData.logo ||
              jobData.logoUrl ||
              jobData.logo ||
              ''
            : '',
          empresaNome:
            companyData.name ||
            companyData.fullName ||
            jobData.empresa ||
            'Empresa Confidencial',
          companyName:
            companyData.name ||
            companyData.fullName ||
            jobData.empresa ||
            'Empresa Confidencial',
          companyVerified: Boolean(planSummary?.features?.companyVerified),
          descricao: jobData.descricao || jobData.description || '',
          experiencia: jobData.experiencia || jobData.experience || '',
          prazo: jobData.prazo || jobData.deadline || jobData.dataLimite || '',
          dataFecho: serializeDateValue(
            jobData.dataFecho ||
              jobData.expiresAt ||
              jobData.deadline ||
              jobData.prazo ||
              jobData.dataLimite,
          ),
          status: jobData.status || 'active',
          remoto: jobData.remoto || jobData.remote || false,
          destaque: jobData.destaque || jobData.featured || false,
          premiumOnly: Boolean(jobData.premiumOnly || jobData.isPremiumOnly),
          categoria: jobData.categoria || jobData.category || '',
          palavrasChave: Array.isArray(jobData.palavrasChave)
            ? jobData.palavrasChave
            : Array.isArray(jobData.keywords)
              ? jobData.keywords
              : [],
          companyId: jobData.companyId || '',
          publicadoEm: serializeDateValue(
            jobData.publicadoEm || jobData.publishedAt || jobData.createdAt,
          ),
          createdAt:
            serializeDateValue(jobData.createdAt) || new Date().toISOString(),
          updatedAt:
            serializeDateValue(jobData.updatedAt) || new Date().toISOString(),
        };
      })
      .sort(compareRecentJobs);

    const approvedTestimonials = testimonialsSnapshot.docs
      .map((doc) => {
        const data = doc.data() || {};
        const name = String(data.name || '').trim();
        const createdAtRaw = data.approvedAt || data.createdAt || null;
        const createdAt = createdAtRaw?.toDate?.()?.toISOString?.() || null;
        return {
          id: doc.id,
          name,
          initials: getInitials(name),
          createdAt,
        };
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime(),
      );

    const latestPosts = postsSnapshot.docs
      .map((doc) => {
        const data = doc.data() || {};
        return {
          id: doc.id,
          title: safeText(data.title, 'Sem título'),
          excerpt: safeText(data.excerpt, ''),
          category: safeText(data.category, 'Blog'),
          image: safeText(data.image, ''),
          readTime: safeText(data.readTime, '5 min'),
          status: normalizeContentStatus(data.status),
          createdAt: safeTimestampToISOString(data.createdAt),
          updatedAt: safeTimestampToISOString(data.updatedAt),
          createdAtMs: safeTimestampToMillis(data.createdAt),
          updatedAtMs: safeTimestampToMillis(data.updatedAt),
        };
      })
      .filter((post) => isContentPublished(post.status))
      .sort(
        (a, b) =>
          (b.createdAtMs || b.updatedAtMs || 0) -
          (a.createdAtMs || a.updatedAtMs || 0),
      )
      .slice(0, 2)
      .map(({ createdAtMs, updatedAtMs, ...post }) => post);

    const stats = {
      activeJobs: jobs.length,
      activeCandidates: candidatesCountSnapshot.data().count,
      activeCompanies: companiesCountSnapshot.data().count,
      recentJobsLast14Days: jobs.filter((job) => {
        if (!job.createdAt) return false;
        const createdAt = new Date(job.createdAt);
        if (Number.isNaN(createdAt.getTime())) return false;
        const ageInDays =
          (new Date().getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
        return ageInDays <= 14;
      }).length,
    };

    return {
      props: {
        jobs: JSON.parse(JSON.stringify(jobs.map(toHomeJobCard))),
        stats,
        spotlightCandidates: JSON.parse(JSON.stringify(spotlightCandidates)),
        latestPosts: JSON.parse(JSON.stringify(latestPosts)),
        testimonials: JSON.parse(JSON.stringify(approvedTestimonials)),
        productAds,
        jobCategories,
        previewCreativeSrc,
      },
    };
  } catch (error) {
    console.error('Erro fatal ao buscar dados da home:', error);
    return {
      props: {
        jobs: [],
        stats: {
          activeJobs: 0,
          activeCandidates: 0,
          activeCompanies: 0,
          recentJobsLast14Days: 0,
        },
        spotlightCandidates: [],
        latestPosts: [],
        testimonials: [],
        productAds: [],
        jobCategories: [],
        previewCreativeSrc,
      },
    };
  }
}

export default function HomePage({
  jobs: initialJobs = [],
  stats = {
    activeJobs: 0,
    activeCandidates: 0,
    activeCompanies: 0,
    recentJobsLast14Days: 0,
  },
  spotlightCandidates = [],
  latestPosts = [],
  testimonials = [],
  productAds = [],
  jobCategories = [],
  previewCreativeSrc = '',
}) {
  const router = useRouter();
  const pageRef = useRef(null);
  useScrollReveal(pageRef);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredJobs, setFilteredJobs] = useState(initialJobs);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterState, setNewsletterState] = useState({
    status: 'idle',
    message: '',
  });

  useEffect(() => {
    setFilteredJobs(initialJobs);
  }, [initialJobs]);

  const handleSearch = (event) => {
    const term = event.target.value.toLowerCase();
    setSearchTerm(term);

    if (!term) {
      setFilteredJobs(initialJobs);
      return;
    }

    const filtered = initialJobs.filter(
      (job) =>
        (job.titulo?.toLowerCase() || '').includes(term) ||
        (job.empresaNome?.toLowerCase() || '').includes(term) ||
        (job.localizacao?.toLowerCase() || '').includes(term) ||
        (job.tipoContrato?.toLowerCase() || '').includes(term) ||
        (job.categoria?.toLowerCase() || '').includes(term),
    );

    setFilteredJobs(filtered);
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const query = searchTerm.trim();
    router.push(
      query ? `/vagas?search=${encodeURIComponent(query)}` : '/vagas',
    );
  };

  const handleNewsletterSubmit = async (event) => {
    event.preventDefault();
    const email = newsletterEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setNewsletterState({
        status: 'error',
        message: 'Introduza um email válido.',
      });
      return;
    }

    setNewsletterState({ status: 'loading', message: '' });

    try {
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'home' }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setNewsletterState({
          status: 'error',
          message:
            data.error || 'Não foi possível subscrever. Tente novamente.',
        });
        return;
      }

      setNewsletterState({
        status: 'success',
        message: data.message || 'Subscrição confirmada! Obrigado.',
      });
      setNewsletterEmail('');
    } catch (error) {
      setNewsletterState({
        status: 'error',
        message: 'Erro de ligação. Tente novamente dentro de momentos.',
      });
    }
  };

  const displayedCategories = HOME_CATEGORIES.map((category) => ({
    ...category,
    count:
      jobCategories.find((entry) => entry.name === category.name)?.count ?? 0,
  }));
  const heroJobs = filteredJobs.slice(0, 4);
  const jobsPreview = filteredJobs.slice(0, 9);
  const verifiedCandidates = spotlightCandidates;
  const testimonialAvatars = testimonials.slice(0, 3);
  const newsPosts =
    latestPosts.length > 0
      ? latestPosts.slice(0, 2)
      : [
          {
            id: 'blog',
            title: 'Explore conteúdos e dicas para melhorar a sua carreira',
            excerpt:
              'Veja artigos, recursos e atualizações do mercado de trabalho na plataforma.',
            category: 'Blog',
            image: '',
            readTime: '5 min',
          },
          {
            id: 'recursos',
            title:
              'Descubra recursos práticos para CV, candidatura e preparação',
            excerpt:
              'Use ferramentas e conteúdos do Emprego STP para dar mais força ao seu perfil.',
            category: 'Recursos',
            image: '',
            readTime: '4 min',
          },
        ];

  // F9.2: só números calculados, sem «+» (que sugeria mais do que existe).
  // `activeCompanies` conta todas as contas de empresa, não só as ativas.
  const metrics = [
    { label: 'Vagas ativas', value: String(stats.activeJobs) },
    { label: 'Empresas registadas', value: String(stats.activeCompanies) },
    { label: 'Talentos registados', value: String(stats.activeCandidates) },
  ];
  const candidateFeatures = [
    'Criar perfil profissional',
    'Guardar vagas favoritas',
    'Gerir candidaturas com mais clareza',
  ];

  const companyFeatures = [
    'Publicar vagas com mais visibilidade',
    'Receber candidaturas organizadas',
    'Aceder ao banco de talentos',
  ];

  return (
    <>
      <Head>
        <title>Empregos STP - Conectando Talentos ao Sucesso</title>
        {/* Pesos da Instrument Sans usados no topo da home. */}
        <link
          rel="preload"
          href="/fonts/instrument-sans-600.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/instrument-sans-700.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <meta
          name="description"
          content="A melhor plataforma de empregos em São Tomé e Príncipe. Conectando talentos às melhores oportunidades."
        />
      </Head>

      <PublicPageShell headerVariant="light">
        <div className={styles.page} ref={pageRef}>
          <section className={styles.hero}>
            <div className={styles.sectionContainer}>
              <div className={styles.heroCanvas}>
                <span
                  className={`${styles.heroSpark} ${styles.heroSparkBlueLeft}`}
                  aria-hidden="true"
                />
                <span
                  className={`${styles.heroSpark} ${styles.heroSparkBlueRight}`}
                  aria-hidden="true"
                />
                <span
                  className={`${styles.heroSpark} ${styles.heroSparkLime}`}
                  aria-hidden="true"
                />

                <div className={styles.heroRingOuter} aria-hidden="true" />
                <div className={styles.heroRingInner}>
                  <p className={styles.heroEyebrow}>
                    Empregos em São Tomé e Príncipe
                  </p>
                  {/* Os espaços explícitos são para o texto lido: sem eles o
                      JSX cola as linhas e o título anuncia-se como
                      «ConectandoTalentosao Sucesso». Colapsam visualmente
                      por estarem junto às quebras de linha. */}
                  <h1 className={styles.heroTitle}>
                    {HERO_TITLE_LINES.map((line, lineIndex) => (
                      <Fragment key={line.join(' ')}>
                        {lineIndex ? <br /> : null}
                        {line.map((word, wordIndex) => (
                          <Fragment key={word}>
                            {wordIndex ? ' ' : null}
                            <span
                              className={`${styles.heroWord} ${
                                word === 'Talentos'
                                  ? styles.heroTitleAccent
                                  : ''
                              }`}
                              style={{
                                '--i':
                                  HERO_TITLE_LINES.slice(0, lineIndex).flat()
                                    .length + wordIndex,
                              }}
                            >
                              {word}
                            </span>
                          </Fragment>
                        ))}
                      </Fragment>
                    ))}
                  </h1>
                  <p className={styles.heroDescription}>
                    Somos a plataforma que aproxima candidatos e empresas com
                    uma experiência mais clara, rápida e acessível.
                  </p>

                  <form
                    className={styles.searchForm}
                    onSubmit={handleSearchSubmit}
                  >
                    <div className={styles.searchField}>
                      <i className="fas fa-search" aria-hidden="true" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={handleSearch}
                        className={styles.searchInput}
                        placeholder="Título da vaga"
                        aria-label="Pesquisar vagas na homepage"
                      />
                    </div>
                    <button type="submit" className={styles.searchButton}>
                      Pesquisar
                    </button>
                  </form>
                </div>

                {heroJobs.map((job, index) => (
                  <Link
                    key={job.id}
                    href={`/vaga/${job.id}`}
                    className={`${styles.heroFloatingCard} ${styles[`floatingCard${index + 1}`]}`}
                  >
                    <div className={styles.heroFloatingIcon}>
                      {job.empresaLogo ? (
                        <Image
                          src={job.empresaLogo}
                          alt={job.empresaNome}
                          className={styles.heroFloatingLogo}
                          width={42}
                          height={42}
                          unoptimized
                        />
                      ) : (
                        <span>{getInitials(job.empresaNome)}</span>
                      )}
                    </div>
                    <div className={styles.heroFloatingBody}>
                      <strong>{truncateText(job.titulo, 34)}</strong>
                      <span>{job.empresaNome}</span>
                      <div className={styles.heroFloatingMeta}>
                        <small>
                          <i className="fas fa-briefcase" aria-hidden="true" />
                          {normalizeContractType(job.tipoContrato)}
                        </small>
                        <em className={styles.heroFloatingTag}>Aberta</em>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <section className={styles.jobsSection}>
            <div className={styles.sectionContainer}>
              <div className={styles.sectionHeaderDark} data-reveal>
                <h2 className={styles.sectionTitleDark}>
                  Veja vagas disponíveis
                </h2>
                <Link href="/vagas" className={styles.sectionLinkDark}>
                  Ver todas
                </Link>
              </div>

              <div className={styles.compactJobsGrid} data-reveal>
                {jobsPreview.map((job) => (
                  <CompactJobCard
                    key={job.id}
                    href={`/vaga/${job.id}`}
                    title={job.titulo}
                    badgeLabel={normalizeContractType(job.tipoContrato)}
                    status={job.status}
                    variant="dark"
                    salary={formatSalaryRange(job.salarioDe, job.salarioAte)}
                    companyName={job.empresaNome}
                    companyLogo={job.empresaLogo}
                    imageAlt={job.empresaNome}
                    metaItems={[
                      {
                        icon: 'fas fa-location-dot',
                        text: job.localizacao,
                      },
                      {
                        icon: 'fas fa-clock',
                        text: formatPublishedAgo(
                          job.publicadoEm || job.createdAt,
                        ),
                      },
                    ]}
                  />
                ))}
              </div>
            </div>
          </section>

          <section className={styles.categoriesSection}>
            <div className={styles.sectionContainer}>
              <div className={styles.sectionHeaderLight} data-reveal>
                <h2 className={styles.sectionTitleLight}>
                  Categorias populares
                </h2>
                <Link href="/vagas" className={styles.sectionLinkLight}>
                  Ver todas
                </Link>
              </div>

              <div className={styles.categoriesGrid}>
                {displayedCategories.map((category, index) => {
                  const config = resolveCategoryConfig(category);
                  const countLabel =
                    typeof category.count === 'number'
                      ? `${category.count} vaga${category.count !== 1 ? 's' : ''}`
                      : category.count;

                  return (
                    <Link
                      key={category.name}
                      href={`/vagas?categoria=${encodeURIComponent(category.name.toLowerCase())}`}
                      className={styles.categoryCard}
                      data-reveal
                      style={{
                        '--category-tone': config.color,
                        '--delay': `${index * 90}ms`,
                      }}
                    >
                      <span className={styles.categoryIcon}>
                        <i
                          className={`fas ${config.icon}`}
                          aria-hidden="true"
                        />
                      </span>
                      <div>
                        <h3 className={styles.categoryName}>{category.name}</h3>
                        <p className={styles.categoryCount}>{countLabel}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>

          <section id="testemunhos" className={styles.signalsSection}>
            <div className={styles.sectionContainer}>
              <div className={styles.signalsGrid}>
                <article className={styles.metricsCard} data-reveal>
                  <div className={styles.metricsGrid}>
                    {metrics.map((item) => (
                      <div key={item.label} className={styles.metricItem}>
                        <strong className={styles.metricValue}>
                          {item.value}
                        </strong>
                        <span className={styles.metricLabel}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </article>

                <Link
                  href="/sobre-nos#testemunhos"
                  className={styles.testimonialCard}
                  data-reveal
                  style={{ '--delay': '120ms' }}
                  aria-label="Ver testemunhos na página Sobre nós"
                >
                  <h2 className={styles.testimonialTitle}>Testemunhos</h2>
                  <div className={styles.testimonialTopRow}>
                    <div className={styles.testimonialAvatarStack}>
                      {/* F9.2: sem testemunhos aprovados não se mostram
                          iniciais de pessoas que não existem. */}
                      {testimonialAvatars.map((testimonial) => (
                        <span
                          key={testimonial.id}
                          className={styles.testimonialAvatarPill}
                        >
                          {testimonial.initials}
                        </span>
                      ))}
                    </div>
                    <span className={styles.testimonialViewAll}>
                      Veja todos
                      <FiArrowRight aria-hidden="true" />
                    </span>
                  </div>
                  <p className={styles.testimonialText}>
                    Empresas e talentos estão a usar a plataforma para encontrar
                    oportunidades com mais rapidez e clareza.
                  </p>
                </Link>
              </div>
            </div>
          </section>

          <section className={styles.aboutSection}>
            <div className={styles.sectionContainer}>
              <div className={styles.aboutGrid}>
                <div className={styles.aboutContent} data-reveal>
                  <p className={styles.aboutEyebrow}>Vitrine de empresas</p>
                  <h2 className={styles.aboutTitle}>
                    Anúncios de empresas em destaque
                  </h2>
                  <p className={styles.aboutText}>
                    Apresente os seus produtos e serviços a candidatos
                    <br className={styles.aboutTextBreak} />e empresas que já
                    fazem parte da comunidade Empregos STP.
                  </p>
                  <div className={styles.aboutActions}>
                    <Link href="/contacto" className={styles.aboutPrimary}>
                      Anunciar um produto
                    </Link>
                  </div>
                </div>

                <ProductAdsCarousel
                  ads={productAds}
                  previewCreativeSrc={previewCreativeSrc}
                />
              </div>
            </div>
          </section>

          <section className={styles.processSection}>
            <div className={styles.sectionContainer}>
              <div className={styles.processPanel} data-reveal>
                <h2 className={styles.processTitle}>
                  Como funciona a plataforma
                </h2>
                <p className={styles.processText}>
                  Um percurso simples e estruturado para encontrar
                  oportunidades, preparar o seu perfil e candidatar-se com mais
                  confiança.
                </p>

                <div className={styles.processGrid}>
                  {HOW_IT_WORKS_STEPS.map((step, index) => (
                    <article
                      key={step.number}
                      className={styles.processStep}
                      data-reveal
                      style={{ '--delay': `${index * 90}ms` }}
                    >
                      <span className={styles.processStepIcon}>
                        <i className={`fas ${step.icon}`} aria-hidden="true" />
                      </span>
                      <h3 className={styles.processStepTitle}>{step.title}</h3>
                      <p className={styles.processStepText}>{step.desc}</p>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section
            id="candidatos-verificados"
            className={styles.talentsSection}
            aria-labelledby="featured-talents-title"
          >
            <div className={styles.sectionContainer}>
              <div className={styles.talentsGrid}>
                <div className={styles.talentsContent} data-reveal>
                  <p className={styles.srOnly}>Talentos em destaque</p>
                  <h2
                    id="featured-talents-title"
                    className={styles.talentsTitle}
                  >
                    Encontre <span>Candidatos</span> Qualificados
                  </h2>
                  <p className={styles.talentsText}>
                    Liberte o potencial da sua equipa com facilidade,
                    encontrando o candidato certo através da nossa plataforma de
                    procura de emprego.
                  </p>
                  <Link href="/verificados" className={styles.talentsLink}>
                    <span>Explorar</span>
                    <FiArrowRight aria-hidden="true" />
                  </Link>
                </div>

                <div className={styles.candidatesPanel} data-reveal>
                  <VerifiedCandidatesCarousel candidates={verifiedCandidates} />
                </div>
              </div>
            </div>
          </section>

          <section className={styles.newsSection}>
            <div className={styles.sectionContainer}>
              <div className={styles.sectionHeaderLight} data-reveal>
                <h2 className={styles.sectionTitleLight}>
                  Novidades sobre mercado de trabalho
                </h2>
                <Link href="/blog" className={styles.sectionLinkLight}>
                  Explorar artigos
                </Link>
              </div>

              <div className={styles.newsGrid}>
                <article className={styles.newsletterCard} data-reveal>
                  <h3 className={styles.newsletterTitle}>
                    Subscreva a nossa newsletter
                  </h3>
                  <p className={styles.newsletterText}>
                    Receba novidades, dicas e conteúdos do mercado de trabalho
                    diretamente no seu email.
                  </p>
                  <form
                    className={styles.newsletterForm}
                    onSubmit={handleNewsletterSubmit}
                  >
                    <input
                      type="email"
                      value={newsletterEmail}
                      onChange={(event) => {
                        setNewsletterEmail(event.target.value);
                        if (newsletterState.status !== 'idle') {
                          setNewsletterState({ status: 'idle', message: '' });
                        }
                      }}
                      className={styles.newsletterInput}
                      placeholder="O seu email"
                      aria-label="Email para subscrever a newsletter"
                      disabled={newsletterState.status === 'loading'}
                    />
                    <button
                      type="submit"
                      className={styles.newsletterButton}
                      disabled={newsletterState.status === 'loading'}
                    >
                      {newsletterState.status === 'loading'
                        ? 'A subscrever…'
                        : 'Subscrever'}
                    </button>
                  </form>
                  {newsletterState.message ? (
                    <p
                      className={`${styles.newsletterFeedback} ${
                        newsletterState.status === 'error'
                          ? styles.newsletterFeedbackError
                          : styles.newsletterFeedbackSuccess
                      }`}
                      role="status"
                      aria-live="polite"
                    >
                      {newsletterState.message}
                    </p>
                  ) : null}
                </article>

                {newsPosts.map((post, index) => (
                  <Link
                    key={post.id}
                    href={
                      post.id === 'recursos' ? '/recursos' : `/blog/${post.id}`
                    }
                    className={styles.postCard}
                    data-reveal
                    style={{ '--delay': `${(index + 1) * 90}ms` }}
                  >
                    <div className={styles.postImageWrap}>
                      {post.image ? (
                        <Image
                          src={post.image}
                          alt={post.title}
                          className={styles.postImage}
                          width={640}
                          height={440}
                          sizes="(max-width: 1180px) 50vw, 33vw"
                          unoptimized
                        />
                      ) : (
                        <div className={styles.postImagePlaceholder}>
                          {getInitials(post.title)}
                        </div>
                      )}
                    </div>

                    <div className={styles.postBody}>
                      <span className={styles.postCategory}>
                        {post.category}
                      </span>
                      <h3 className={styles.postTitle}>{post.title}</h3>
                      <p className={styles.postExcerpt}>
                        {truncateText(post.excerpt, 120)}
                      </p>
                      <div className={styles.postMeta}>
                        <span>{getPostDateLabel(post)}</span>
                        <span>{post.readTime || '5 min'}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <section className={styles.dualSection}>
            <div className={styles.sectionContainer}>
              <div className={styles.dualGrid}>
                <article
                  className={`${styles.dualCard} ${styles.dualCardCandidate}`}
                  data-reveal
                >
                  <div className={styles.dualCardHeader}>
                    <span className={styles.dualBadge}>Candidato</span>
                  </div>
                  <h2 className={styles.dualTitle}>
                    Organize o seu perfil e encontre melhores oportunidades
                  </h2>
                  <p className={styles.dualText}>
                    Crie um perfil profissional, guarde vagas favoritas e
                    acompanhe as suas candidaturas com mais clareza.
                  </p>
                  <Link
                    href="/register?type=candidato"
                    className={styles.dualLink}
                    aria-label="Criar conta como candidato"
                  >
                    Criar conta
                  </Link>
                </article>

                <article
                  className={`${styles.dualCard} ${styles.dualCardEmployer}`}
                  data-reveal
                  style={{ '--delay': '120ms' }}
                >
                  <div className={styles.dualCardHeader}>
                    <span className={styles.dualBadge}>Empregador</span>
                  </div>
                  <h2 className={styles.dualTitle}>
                    Publique vagas e encontre talentos com mais eficiência
                  </h2>
                  <p className={styles.dualText}>
                    Publique vagas com visibilidade, receba candidaturas
                    organizadas e aceda ao banco de talentos.
                  </p>
                  <Link
                    href="/register?type=empresa"
                    className={styles.dualLink}
                    aria-label="Criar conta como empregador"
                  >
                    Criar conta de empresa
                  </Link>
                </article>
              </div>
            </div>
          </section>
        </div>
      </PublicPageShell>
    </>
  );
}
