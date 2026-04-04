import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import PublicPageShell from '../components/PublicPageShell';
import JobList from '../components/home/JobList';
import Link from 'next/link';
import { admin } from '../lib/firebaseAdmin';
import styles from '../styles/HomePage.module.css';

export async function getServerSideProps() {
  try {
    console.log('Iniciando busca de dados do servidor...');

    // Buscar todas as vagas ativas
    const jobsRef = admin.firestore().collection('jobs');
    const activeJobsSnapshot = await jobsRef.where('status', '==', 'active').get();
    const activeJobsData = activeJobsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Coletar IDs de empresa das vagas
    const companyIds = [...new Set(
      activeJobsData
        .map(job => job.companyId)
        .filter(id => id)
    )];

    // Buscar dados das empresas
    let companiesMap = new Map();
    if (companyIds.length > 0) {
      const companiesSnapshot = await admin.firestore()
        .collection('users')
        .where(admin.firestore.FieldPath.documentId(), 'in', companyIds)
        .get();

      companiesSnapshot.docs.forEach(doc => {
        companiesMap.set(doc.id, doc.data());
      });
    }

    // Combinar dados das vagas com empresas
    const jobs = activeJobsData.map(jobData => {
      const companyData = companiesMap.get(jobData.companyId) || {};

      return {
        id: jobData.id,
        titulo: jobData.titulo || jobData.title || 'Sem título',
        localizacao: jobData.localizacao || jobData.location || jobData.cidade || 'Local não especificado',
        tipoContrato: jobData.tipoContrato || jobData.contractType || jobData.tipo || 'Não informado',
        salarioDe: jobData.salarioDe || jobData.salario || jobData.salaryMin || '',
        salarioAte: jobData.salarioAte || jobData.salaryMax || '',
        empresaLogo: companyData.logo || jobData.logo || '/assets/default-logo.png',
        empresaNome: companyData.name || companyData.fullName || jobData.empresa || 'Empresa Confidencial',
        descricao: jobData.descricao || jobData.description || '',
        requisitos: jobData.requisitos || jobData.requirements || [],
        experiencia: jobData.experiencia || jobData.experience || '',
        prazo: jobData.prazo || jobData.deadline || jobData.dataLimite || '',
        status: jobData.status || 'active',
        remoto: jobData.remoto || jobData.remote || false,
        destaque: jobData.destaque || jobData.featured || false,
        companyId: jobData.companyId || '',
        publicadoEm: jobData.publicadoEm || jobData.publishedAt || jobData.createdAt,
        createdAt: jobData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: jobData.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()
      };
    });

    jobs.sort((a, b) => {
      // Vagas em destaque vêm primeiro, depois ordenar por data
      if (a.destaque && !b.destaque) return -1;
      if (!a.destaque && b.destaque) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    // Buscar estatísticas
    const companiesSnapshot = await admin.firestore().collection('users').where('userType', '==', 'empresa').get();
    const candidatesSnapshot = await admin.firestore().collection('users').where('userType', '==', 'candidato').get();

    // Perfis para vitrine da home: verificados e priorizando destacados.
    const [verifiedFlagSnap, verifiedLegacySnap, verifiedLegacy2Snap, verifiedStatusSnap, approvedStatusSnap] = await Promise.all([
      admin.firestore()
        .collection('users')
        .where('userType', '==', 'candidato')
        .where('verified', '==', true)
        .limit(60)
        .get(),
      admin.firestore()
        .collection('users')
        .where('userType', '==', 'candidato')
        .where('verificado', '==', true)
        .limit(60)
        .get(),
      admin.firestore()
        .collection('users')
        .where('userType', '==', 'candidato')
        .where('isVerified', '==', true)
        .limit(60)
        .get(),
      admin.firestore()
        .collection('users')
        .where('userType', '==', 'candidato')
        .where('verificationStatus', '==', 'verified')
        .limit(60)
        .get(),
      admin.firestore()
        .collection('users')
        .where('userType', '==', 'candidato')
        .where('verificationStatus', '==', 'approved')
        .limit(60)
        .get()
    ]);

    const verifiedUsersMap = new Map();
    for (const doc of verifiedFlagSnap.docs) verifiedUsersMap.set(doc.id, doc);
    for (const doc of verifiedLegacySnap.docs) verifiedUsersMap.set(doc.id, doc);
    for (const doc of verifiedLegacy2Snap.docs) verifiedUsersMap.set(doc.id, doc);
    for (const doc of verifiedStatusSnap.docs) verifiedUsersMap.set(doc.id, doc);
    for (const doc of approvedStatusSnap.docs) verifiedUsersMap.set(doc.id, doc);

    const verifiedUserDocs = Array.from(verifiedUsersMap.values());
    const verifiedUserIds = verifiedUserDocs.map((doc) => doc.id);

    const profileDocs = verifiedUserIds.length
      ? await admin.firestore().getAll(...verifiedUserIds.map((uid) => admin.firestore().collection('profiles').doc(uid)))
      : [];

    const profileMap = new Map();
    profileDocs.forEach((profileDoc) => {
      if (profileDoc.exists) profileMap.set(profileDoc.id, profileDoc.data() || {});
    });

    const spotlightCandidates = verifiedUserDocs
      .map((doc) => {
        const userData = doc.data() || {};
        const profileData = profileMap.get(doc.id) || {};
        const fullName =
          userData.fullName ||
          userData.name ||
          profileData.fullName ||
          profileData.name ||
          'Candidato verificado';

        const headline =
          userData.headline ||
          userData.profession ||
          profileData.headline ||
          profileData.profession ||
          profileData.objectiveArea ||
          'Profissional';

        const destaque = Boolean(
          userData.destaque ||
          userData.curriculoDestacado ||
          profileData.destaque ||
          profileData.curriculoDestacado
        );

        const createdAtRaw = userData.createdAt || profileData.createdAt || null;
        const createdAt = createdAtRaw?.toDate?.()?.toISOString?.() || null;
        const initials = String(fullName)
          .split(' ')
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part.charAt(0).toUpperCase())
          .join('') || 'CV';

        return {
          id: doc.id,
          fullName,
          headline,
          initials,
          verified: true,
          destaque,
          createdAt
        };
      })
      .sort((a, b) => {
        if (a.destaque !== b.destaque) return b.destaque ? 1 : -1;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });

    const stats = {
      activeJobs: jobs.length,
      activeCandidates: candidatesSnapshot.size,
      activeCompanies: companiesSnapshot.size,
      recentJobsLast14Days: jobs.filter((job) => {
        if (!job.createdAt) return false;
        const createdAt = new Date(job.createdAt);
        if (Number.isNaN(createdAt.getTime())) return false;
        const ageInDays = (new Date().getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
        return ageInDays <= 14;
      }).length
    };

    return {
      props: {
        jobs: JSON.parse(JSON.stringify(jobs)),
        stats: stats,
        spotlightCandidates: JSON.parse(JSON.stringify(spotlightCandidates))
      }
    };
  } catch (error) {
    console.error('Erro fatal ao buscar dados da home:', error);
    return {
      props: {
        jobs: [],
        stats: {
          activeJobs: 0,
          activeCandidates: 0,
          activeCompanies: 0
        },
        spotlightCandidates: []
      }
    };
  }
}


const FALLBACK_CATEGORIES = [
  { name: 'Marketing Digital', icon: 'fa-bullhorn', color: '#3b82f6', count: '...' },
  { name: 'Programação', icon: 'fa-code', color: '#10b981', count: '...' },
  { name: 'Design', icon: 'fa-palette', color: '#f59e0b', count: '...' },
  { name: 'Administração', icon: 'fa-briefcase', color: '#8b5cf6', count: '...' },
  { name: 'Vendas', icon: 'fa-chart-line', color: '#ef4444', count: '...' },
  { name: 'Educação', icon: 'fa-graduation-cap', color: '#06b6d4', count: '...' }
];

const CATEGORY_CONFIGS = {
  Marketing: { icon: 'fa-bullhorn', color: '#3b82f6' },
  'Marketing Digital': { icon: 'fa-bullhorn', color: '#3b82f6' },
  Programação: { icon: 'fa-code', color: '#10b981' },
  Desenvolvimento: { icon: 'fa-code', color: '#10b981' },
  Design: { icon: 'fa-palette', color: '#f59e0b' },
  Administração: { icon: 'fa-briefcase', color: '#8b5cf6' },
  Gestão: { icon: 'fa-briefcase', color: '#8b5cf6' },
  'Gestão e Administração': { icon: 'fa-briefcase', color: '#8b5cf6' },
  Vendas: { icon: 'fa-chart-line', color: '#ef4444' },
  Educação: { icon: 'fa-graduation-cap', color: '#06b6d4' },
  Saúde: { icon: 'fa-heartbeat', color: '#ec4899' },
  Engenharia: { icon: 'fa-wrench', color: '#14b8a6' },
  Finanças: { icon: 'fa-dollar-sign', color: '#f59e0b' },
  'Recursos Humanos': { icon: 'fa-users', color: '#6366f1' },
  RH: { icon: 'fa-users', color: '#6366f1' },
  Jurídico: { icon: 'fa-balance-scale', color: '#8b5cf6' },
  Atendimento: { icon: 'fa-headset', color: '#10b981' }
};

const HOW_IT_WORKS_STEPS = [
  { number: '1', title: 'Crie sua Conta', desc: 'Registre-se gratuitamente em menos de 2 minutos', icon: 'fa-user-plus', color: '#3b82f6' },
  { number: '2', title: 'Complete seu Perfil', desc: 'Adicione suas experiências e habilidades', icon: 'fa-file-alt', color: '#10b981' },
  { number: '3', title: 'Explore Vagas', desc: 'Navegue por milhares de oportunidades', icon: 'fa-search', color: '#f59e0b' },
  { number: '4', title: 'Candidate-se', desc: 'Aplique com um clique para as vagas desejadas', icon: 'fa-paper-plane', color: '#8b5cf6' }
];

const normalizeHexColor = (color) => {
  if (typeof color !== 'string') return null;
  const trimmed = color.trim();
  if (!trimmed.startsWith('#')) return null;

  let hex = trimmed.slice(1);
  if (hex.length === 3) {
    hex = hex.split('').map((char) => `${char}${char}`).join('');
  }

  return hex.length === 6 ? `#${hex}` : null;
};

const hexToRgbChannels = (color) => {
  const normalized = normalizeHexColor(color);
  if (!normalized) return null;

  const hex = normalized.slice(1);
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  return `${red}, ${green}, ${blue}`;
};

const buildAccentVars = (color, fallback = '#64748b') => {
  const accentColor = normalizeHexColor(color) || fallback;
  const rgb = hexToRgbChannels(accentColor) || hexToRgbChannels(fallback);

  return {
    '--accent-color': accentColor,
    '--accent-soft': `rgba(${rgb}, 0.14)`,
    '--accent-border': `rgba(${rgb}, 0.34)`,
    '--accent-strong': `rgba(${rgb}, 0.5)`,
    '--accent-glow': `rgba(${rgb}, 0.28)`
  };
};

const resolveCategoryConfig = (category) => {
  const mappedConfig = CATEGORY_CONFIGS[category.name];
  if (mappedConfig) return mappedConfig;

  if (category.icon || category.color) {
    return {
      icon: category.icon || 'fa-folder',
      color: category.color || '#64748b'
    };
  }

  return { icon: 'fa-folder', color: '#64748b' };
};

export default function HomePage({
  jobs: initialJobs = [],
  stats = { activeJobs: 0, activeCandidates: 0, activeCompanies: 0, recentJobsLast14Days: 0 },
  spotlightCandidates = []
}) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredJobs, setFilteredJobs] = useState(initialJobs);
  const [categories, setCategories] = useState([]);
  const [spotlightOffset, setSpotlightOffset] = useState(0);

  useEffect(() => {
    setFilteredJobs(initialJobs);

    fetch('/api/jobs/categories')
      .then(res => res.json())
      .then(data => {
        const predefinedCategories = [
          { name: 'Marketing Digital', icon: 'fa-bullhorn', color: '#3b82f6' },
          { name: 'Programação', icon: 'fa-code', color: '#10b981' },
          { name: 'Design', icon: 'fa-palette', color: '#f59e0b' },
          { name: 'Gestão e Administração', icon: 'fa-briefcase', color: '#8b5cf6' },
          { name: 'Vendas', icon: 'fa-chart-line', color: '#ef4444' },
          { name: 'Educação', icon: 'fa-graduation-cap', color: '#06b6d4' }
        ];

        const categoriesWithCounts = predefinedCategories.map(predef => {
          const realCategory = data.categories?.find(c => c.name === predef.name);
          return {
            ...predef,
            count: realCategory ? realCategory.count : 0
          };
        });

        setCategories(categoriesWithCounts);
      })
      .catch(err => {
        console.error('Erro ao buscar categorias:', err);
        setCategories(FALLBACK_CATEGORIES.map((category) => ({ ...category, count: 0 })));
      });
  }, [initialJobs]);

  useEffect(() => {
    setSpotlightOffset(0);
  }, [spotlightCandidates.length]);

  useEffect(() => {
    if (spotlightCandidates.length <= 2) return undefined;

    const intervalId = setInterval(() => {
      setSpotlightOffset((currentOffset) => (currentOffset + 1) % spotlightCandidates.length);
    }, 6000);

    return () => clearInterval(intervalId);
  }, [spotlightCandidates.length]);

  const visibleSpotlightCandidates = (() => {
    if (spotlightCandidates.length <= 2) return spotlightCandidates;

    const firstCandidate = spotlightCandidates[spotlightOffset % spotlightCandidates.length];
    const secondCandidate = spotlightCandidates[(spotlightOffset + 1) % spotlightCandidates.length];

    return [firstCandidate, secondCandidate];
  })();

  const handleSearch = (e) => {
    const term = e.target.value.toLowerCase();
    setSearchTerm(term);

    if (!term) {
      setFilteredJobs(initialJobs);
      return;
    }

    const filtered = initialJobs.filter(job =>
      (job.titulo?.toLowerCase() || '').includes(term) ||
      (job.empresaNome?.toLowerCase() || '').includes(term) ||
      (job.localizacao?.toLowerCase() || '').includes(term) ||
      (job.tipoContrato?.toLowerCase() || '').includes(term)
    );

    setFilteredJobs(filtered);
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const query = searchTerm.trim();
    router.push(query ? `/vagas?search=${encodeURIComponent(query)}` : '/vagas');
  };

  const displayedCategories = categories.length === 0 ? FALLBACK_CATEGORIES : categories.slice(0, 6);
  const featuredJobs = filteredJobs.filter((job) => job.destaque).slice(0, 3);
  const highlightedJobsCount = initialJobs.filter((job) => job.destaque).length;
  const statsCards = [
    { label: 'Vagas Ativas', value: `${stats.activeJobs}+`, description: 'Oportunidades abertas agora', color: '#60a5fa' },
    { label: 'Empresas', value: `${stats.activeCompanies}+`, description: 'Organizações a recrutar', color: '#34d399' },
    { label: 'Talentos', value: `${stats.activeCandidates}+`, description: 'Perfis já registados', color: '#818cf8' },
    { label: 'Perfis em Vitrine', value: `${spotlightCandidates.length}+`, description: 'Candidatos verificados em destaque', color: '#f59e0b' }
  ];

  return (
    <>
      <Head>
        <title>Empregos STP - Connecting Devs with Employers</title>
        <meta name="description" content="A melhor plataforma de empregos em São Tomé e Príncipe. Conectando talentos às melhores oportunidades." />
        <link rel="icon" href="/favicon.ico" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" />
      </Head>

      <PublicPageShell>
        <div className={styles.page}>
          <section className={styles.hero}>
            <div className={styles.heroGlowPrimary}></div>
            <div className={styles.heroGlowSecondary}></div>
            <div className={styles.heroLinePrimary}></div>
            <div className={styles.heroLineSecondary}></div>

            <div className={styles.heroContainer}>
              <div className={styles.heroGrid}>
                <div className={styles.heroContent}>
                  <div className={styles.heroEyebrow}>
                    Plataforma nacional de recrutamento para São Tomé e Príncipe
                  </div>

                  <h1 className={styles.heroTitle}>
                    Conectando <span className={styles.heroAccentBlue}>Talentos</span>
                    <br />
                    às Melhores <span className={styles.heroAccentGreen}>Oportunidades</span>
                  </h1>

                  <p className={styles.heroDescription}>
                    Descubra milhares de vagas em São Tomé e Príncipe. Encontre o emprego ideal que corresponde às suas habilidades e ambições profissionais.
                  </p>

                  <form className={styles.searchForm} onSubmit={handleSearchSubmit}>
                    <div className={styles.searchField}>
                      <i className={`fas fa-search ${styles.searchIcon}`}></i>
                      <input
                        type="text"
                        placeholder="Digite o cargo, empresa ou palavra-chave..."
                        value={searchTerm}
                        onChange={handleSearch}
                        className={styles.searchInput}
                      />
                    </div>
                    <button type="submit" className={styles.primaryAction}>
                      Buscar Vagas
                    </button>
                  </form>

                  <div className={styles.ratingRow}>
                    <div className={styles.ratingStars}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <i key={star} className="fas fa-star"></i>
                      ))}
                    </div>
                    <span className={styles.ratingText}>Empresas e talentos a recrutar com mais clareza em STP</span>
                  </div>
                </div>

                <div className={styles.heroVisual}>
                  <div className={styles.heroShowcase}>
                    <div className={styles.heroCandidatesStack}>
                      {visibleSpotlightCandidates.length === 0 ? (
                        <article className={styles.heroCandidatesEmpty}>
                          <strong>Perfis em atualização</strong>
                          <p>A vitrine de talentos será preenchida assim que existirem candidatos verificados disponíveis.</p>
                        </article>
                      ) : visibleSpotlightCandidates.map((candidate, index) => {
                        const isFirst = index === 0;
                        const avatarGradient = candidate.destaque
                          ? 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)'
                          : isFirst
                            ? 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)'
                            : 'linear-gradient(135deg, #10b981 0%, #34d399 100%)';
                        const avatarShadow = candidate.destaque
                          ? 'rgba(245, 158, 11, 0.45)'
                          : isFirst
                            ? 'rgba(59, 130, 246, 0.45)'
                            : 'rgba(16, 185, 129, 0.45)';

                        return (
                          <article
                            key={candidate.id}
                            className={styles.heroCandidateCard}
                            style={{
                              '--candidate-avatar-gradient': avatarGradient,
                              '--candidate-avatar-shadow': avatarShadow,
                              '--candidate-delay': isFirst ? '0s' : '1.5s'
                            }}
                          >
                            <div className={styles.candidateAvatar}>{candidate.initials}</div>
                            <div className={styles.candidateMeta}>
                              <div className={styles.heroCandidateTop}>
                                <h3 className={styles.candidateName}>{candidate.fullName}</h3>
                                {candidate.destaque ? <span className={styles.candidateFeaturedTag}>Destaque</span> : null}
                              </div>
                              <p className={styles.candidateHeadline}>{candidate.headline}</p>
                              <div className={styles.candidateTags}>
                                <span className={styles.candidateTag}>Verificado</span>
                                <span className={styles.heroCandidateMetaText}>Perfil em vitrine</span>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>

                    <div className={styles.heroShowcaseFooter}>
                      <div>
                        <span className={styles.heroShowcaseFooterLabel}>Acesso rápido</span>
                        <strong className={styles.heroShowcaseFooterValue}>
                          {spotlightCandidates.length > 0
                            ? `${spotlightCandidates.length} perfis em vitrine neste momento`
                            : 'Novos perfis serão destacados assim que forem verificados'}
                        </strong>
                      </div>
                      <Link href="/candidatos" className={styles.heroShowcaseLink}>
                        Ver perfis
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className={styles.statsSection}>
            <div className={styles.statsGlow}></div>
            <div className={styles.sectionContainer}>
              <div className={`${styles.sectionIntro} ${styles.sectionIntroCompact}`}>
                <div className={`${styles.sectionBadge} ${styles.badgeIndigo}`}>
                  <span>Números Reais</span>
                </div>
                <h2 className={styles.sectionHeading}>
                  Indicadores que mostram a <span className={styles.sectionAccentIndigo}>força da plataforma</span>
                </h2>
              </div>

              <div className={styles.statsGrid}>
                {statsCards.map((item) => (
                  <article key={item.label} className={styles.statCard} style={buildAccentVars(item.color)}>
                    <p className={styles.statValue}>{item.value}</p>
                    <p className={styles.statLabel}>{item.label}</p>
                    <p className={styles.statMeta}>{item.description}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className={styles.jobsSection}>
            <div className={styles.jobsGlowLeft}></div>
            <div className={styles.jobsGlowRight}></div>
            <div className={styles.sectionContainer}>
              <div className={styles.jobsSectionHead}>
                <div className={styles.jobsLead}>
                  <div className={`${styles.sectionBadge} ${styles.badgeBlue}`}>
                    <span>Vagas em Destaque</span>
                  </div>
                  <h2 className={styles.sectionHeading}>
                    Encontre Sua <span className={styles.sectionAccentBlue}>Próxima Oportunidade</span>
                  </h2>
                  <p className={styles.sectionDescription}>
                    Uma seleção objetiva das vagas com melhor visibilidade, seguida das oportunidades mais recentes publicadas na plataforma.
                  </p>
                </div>
              </div>

              {featuredJobs.length > 0 ? (
                <div className={styles.featuredPanel}>
                  <div className={styles.featuredPanelHeader}>
                    <h3 className={styles.featuredPanelTitle}>Seleção Editorial</h3>
                    <p className={styles.featuredPanelText}>As vagas com maior prioridade visual e melhor exposição nesta semana</p>
                  </div>
                  <JobList jobs={featuredJobs} />
                </div>
              ) : null}

              <div className={styles.jobsListIntro}>
                <h3 className={styles.jobsListTitle}>Últimas oportunidades abertas</h3>
                <p className={styles.jobsListText}>Atualizadas diretamente das empresas que estão a contratar agora.</p>
              </div>

              <JobList jobs={filteredJobs.slice(0, 6)} />

              {filteredJobs.length > 6 ? (
                <div className={styles.viewAllWrap}>
                  <Link href="/vagas" className={styles.linkAction}>
                    Ver Todas as Vagas
                    <i className="fas fa-arrow-right"></i>
                  </Link>
                </div>
              ) : null}
            </div>
          </section>

          <section className={styles.categoriesSection}>
            <div className={styles.sectionContainer}>
              <div className={styles.sectionIntro}>
                <div className={`${styles.sectionBadge} ${styles.badgeGreen}`}>
                  <span>Categorias</span>
                </div>
                <h2 className={styles.sectionHeading}>
                  Explore por <span className={styles.sectionAccentGreen}>Categoria</span>
                </h2>
                <p className={styles.sectionDescription}>
                  Encontre as melhores oportunidades na sua área de interesse.
                </p>
              </div>

              <div className={styles.categoryGrid}>
                {displayedCategories.map((category) => {
                  const config = resolveCategoryConfig(category);
                  const accentVars = buildAccentVars(config.color);
                  const countLabel = typeof category.count === 'number'
                    ? `${category.count} vaga${category.count !== 1 ? 's' : ''} disponível${category.count !== 1 ? 'is' : ''}`
                    : category.count;

                  return (
                    <Link
                      key={category.name}
                      href={`/vagas?categoria=${encodeURIComponent(category.name.toLowerCase())}`}
                      className={styles.categoryLink}
                      style={accentVars}
                    >
                      <article className={styles.categoryCard}>
                        <div className={styles.categoryCardIconWrap}>
                          <i className={`fas ${config.icon} ${styles.categoryCardIcon}`}></i>
                        </div>
                        <h3 className={styles.categoryName}>{category.name}</h3>
                        <p className={styles.categoryCount}>{countLabel}</p>
                      </article>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>

          <section className={styles.stepsSection}>
            <div className={styles.sectionContainer}>
              <div className={styles.sectionIntro}>
                <div className={`${styles.sectionBadge} ${styles.badgeIndigo}`}>
                  <span>Processo</span>
                </div>
                <h2 className={styles.sectionHeading}>
                  Como <span className={styles.sectionAccentIndigo}>Funciona</span>
                </h2>
                <p className={styles.sectionDescription}>
                  Comece sua jornada profissional em apenas 4 passos simples.
                </p>
              </div>

              <div className={styles.stepsGrid}>
                {HOW_IT_WORKS_STEPS.map((step) => (
                  <article key={step.number} className={styles.stepCard} style={buildAccentVars(step.color)}>
                    <div className={styles.stepIconWrap}>
                      <i className={`fas ${step.icon}`}></i>
                      <span className={styles.stepNumber}>{step.number}</span>
                    </div>
                    <h3 className={styles.stepTitle}>{step.title}</h3>
                    <p className={styles.stepDescription}>{step.desc}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className={styles.ctaSection}>
            <div className={styles.ctaGlowPrimary}></div>
            <div className={styles.ctaGlowSecondary}></div>

            <div className={styles.sectionContainer}>
              <div className={styles.ctaGrid}>
                <article className={`${styles.ctaCard} ${styles.ctaCardGreen}`}>
                  <div className={styles.ctaIconWrap}>
                    <i className="fas fa-user-tie"></i>
                  </div>
                  <h3 className={styles.ctaCardTitle}>Para Candidatos</h3>
                  <p className={styles.ctaCardText}>
                    Encontre as melhores oportunidades e dê o próximo passo na sua carreira.
                  </p>
                  <Link href="/register?type=candidato" className={styles.secondaryAction}>
                    Começar Agora
                    <i className="fas fa-arrow-right"></i>
                  </Link>
                </article>

                <article className={`${styles.ctaCard} ${styles.ctaCardBlue}`}>
                  <div className={styles.ctaIconWrap}>
                    <i className="fas fa-building"></i>
                  </div>
                  <h3 className={styles.ctaCardTitle}>Para Empresas</h3>
                  <p className={styles.ctaCardText}>
                    Encontre os melhores talentos para impulsionar seu negócio.
                  </p>
                  <Link href="/register?type=empresa" className={styles.primaryAction}>
                    Publicar Vaga
                    <i className="fas fa-arrow-right"></i>
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
