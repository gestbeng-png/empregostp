import Head from 'next/head';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import PublicPageShell from '../components/PublicPageShell';
import { admin } from '../lib/firebaseAdmin';
import styles from '../styles/EmpresasPage.module.css';

function BuildingIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22V12h6v10" />
    </svg>
  );
}

function SearchIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function GridIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

function ListIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function StarIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function VerifiedIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
    </svg>
  );
}

function LocationIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function UsersIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="7" r="4" />
      <path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
    </svg>
  );
}

function ArrowRightIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

function EmptyBuildingIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22V12h6v10" />
      <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01" />
    </svg>
  );
}

function CompanyLogo({ company, variant = 'medium' }) {
  const className = variant === 'small' ? styles.logoSmall : variant === 'list' ? styles.logoList : styles.logoMedium;
  const wrapperClassName = [className, company.logo ? styles.logoWithImage : ''].filter(Boolean).join(' ');
  const initial = company.name?.charAt(0)?.toUpperCase() || 'E';

  return (
    <div className={wrapperClassName}>
      {company.logo ? (
        <img src={company.logo} alt={company.name} className={styles.logoImage} />
      ) : (
        <span className={styles.logoInitial}>{initial}</span>
      )}
    </div>
  );
}

function JobsPill({ count, className = styles.vacanciesPill, pluralLabel = 'aberta' }) {
  const isActive = count > 0;
  return (
    <span className={[className, isActive ? styles.pillActive : styles.pillInactive].join(' ')}>
      {count} vaga{count !== 1 ? 's' : ''} {pluralLabel}{count !== 1 ? 's' : ''}
    </span>
  );
}

function FeaturedCompanyCard({ company }) {
  return (
    <article className={styles.featuredCard}>
      <CompanyLogo company={company} variant="small" />
      <div className={styles.featuredMeta}>
        <div className={styles.nameRow}>
          <h3 className={styles.companyName}>{company.name}</h3>
          {company.verified ? <VerifiedIcon className={styles.verifiedIcon} /> : null}
        </div>
        <p className={styles.industryText}>{company.industry}</p>
      </div>
      <JobsPill count={company.jobCount} className={styles.jobPill} pluralLabel="vaga" />
    </article>
  );
}

function CompanyCard({ company }) {
  return (
    <article className={styles.companyCard}>
      <div className={styles.companyCardHeader}>
        <CompanyLogo company={company} variant="medium" />
        <div className={styles.companyMeta}>
          <div className={styles.nameRow}>
            <h3 className={styles.companyName}>{company.name}</h3>
            {company.verified ? <VerifiedIcon className={styles.verifiedIcon} /> : null}
          </div>
          <p className={styles.industryText}>{company.industry}</p>
        </div>
      </div>

      {company.description ? <p className={styles.companyDescription}>{company.description}</p> : null}

      <div className={styles.metaRow}>
        <span className={styles.metaItem}>
          <LocationIcon className={styles.metaIcon} />
          {company.location}
        </span>
        {company.employeeCount ? (
          <span className={styles.metaItem}>
            <UsersIcon className={styles.metaIcon} />
            {company.employeeCount}
          </span>
        ) : null}
      </div>

      <div className={styles.companyCardFooter}>
        <JobsPill count={company.jobCount} pluralLabel="aberta" />
        <Link href={`/vagas?empresa=${encodeURIComponent(company.id)}`} className={styles.companyLink}>
          Ver vagas
          <ArrowRightIcon className={styles.linkIcon} />
        </Link>
      </div>
    </article>
  );
}

function CompanyListItem({ company }) {
  return (
    <article className={styles.companyListItem}>
      <CompanyLogo company={company} variant="list" />
      <div className={styles.listMetaWrap}>
        <div className={styles.nameRow}>
          <h3 className={styles.companyName}>{company.name}</h3>
          {company.verified ? <VerifiedIcon className={styles.verifiedIcon} /> : null}
        </div>
        <div className={styles.listInfo}>
          <span>{company.industry}</span>
          <span>{company.location}</span>
          {company.employeeCount ? <span>{company.employeeCount}</span> : null}
        </div>
      </div>
      <JobsPill count={company.jobCount} className={styles.listPill} pluralLabel="vaga" />
      <Link href={`/vagas?empresa=${encodeURIComponent(company.id)}`} className={styles.listLink}>
        Ver vagas
      </Link>
    </article>
  );
}

function EmptyState({ onClear }) {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIconBox}>
        <EmptyBuildingIcon className={styles.emptyIcon} />
      </div>
      <h3 className={styles.emptyTitle}>Nenhuma empresa encontrada</h3>
      <p className={styles.emptyText}>Tente ajustar os filtros de pesquisa.</p>
      <button type="button" onClick={onClear} className={styles.emptyButton}>
        Limpar filtros
      </button>
    </div>
  );
}

export async function getServerSideProps() {
  try {
    const companiesSnapshot = await admin.firestore().collection('users').where('userType', 'in', ['company', 'empresa']).get();

    const companies = companiesSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || data.fullName || 'Empresa',
        logo: data.logo || data.logoUrl || data.photoURL || null,
        industry: data.industry || data.setor || data.industrySectors?.[0] || 'Nao especificado',
        industrySectors: data.industrySectors || [],
        location: data.location || data.localizacao || 'Sao Tome',
        description: data.description || data.about || '',
        website: data.website || '',
        employeeCount: data.employeeCount || data.funcionarios || data.companySize || '',
        foundedYear: data.foundedYear || data.anoFundacao || '',
        verified: data.verified || false,
        jobCount: 0,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      };
    });

    const jobsSnapshot = await admin.firestore().collection('jobs').where('status', '==', 'active').get();

    const jobCounts = {};
    jobsSnapshot.docs.forEach((doc) => {
      const companyId = doc.data().companyId;
      if (companyId) {
        jobCounts[companyId] = (jobCounts[companyId] || 0) + 1;
      }
    });

    companies.forEach((company) => {
      company.jobCount = jobCounts[company.id] || 0;
    });

    companies.sort((a, b) => {
      if (a.verified !== b.verified) return b.verified ? 1 : -1;
      return b.jobCount - a.jobCount;
    });

    const industries = [...new Set(companies.flatMap((company) => (company.industrySectors?.length ? company.industrySectors : [company.industry])).filter(Boolean))];

    return {
      props: {
        companies: JSON.parse(JSON.stringify(companies)),
        industries,
        totalJobs: jobsSnapshot.size,
      },
    };
  } catch (error) {
    console.error('Erro ao buscar empresas:', error);
    return {
      props: {
        companies: [],
        industries: [],
        totalJobs: 0,
      },
    };
  }
}

export default function EmpresasPage({ companies = [], industries = [], totalJobs = 0 }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState('');
  const [sortBy, setSortBy] = useState('jobs');
  const [viewMode, setViewMode] = useState('grid');

  const filteredCompanies = useMemo(() => {
    const normalizedSearch = searchTerm.toLowerCase();

    let result = companies.filter((company) => {
      const matchesSearch =
        !searchTerm ||
        company.name.toLowerCase().includes(normalizedSearch) ||
        company.industry.toLowerCase().includes(normalizedSearch) ||
        company.location.toLowerCase().includes(normalizedSearch) ||
        company.description?.toLowerCase().includes(normalizedSearch);

      const matchesIndustry =
        !selectedIndustry || company.industry === selectedIndustry || company.industrySectors?.includes(selectedIndustry);

      return matchesSearch && matchesIndustry;
    });

    if (sortBy === 'jobs') {
      result.sort((a, b) => b.jobCount - a.jobCount);
    } else if (sortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'recent') {
      result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    return result;
  }, [companies, searchTerm, selectedIndustry, sortBy]);

  const featuredCompanies = useMemo(() => companies.filter((company) => company.verified || company.jobCount > 0).slice(0, 4), [companies]);

  function resetFilters() {
    setSearchTerm('');
    setSelectedIndustry('');
  }

  return (
    <>
      <Head>
        <title>Empresas que Contratam | EmpregoSTP</title>
        <meta name="description" content="Descubra as melhores empresas em Sao Tome e Principe. Encontre empregadores verificados com vagas abertas." />
      </Head>

      <PublicPageShell>
        <div className={styles.page}>
          <section className={styles.hero}>
            <div className={styles.heroGlowPrimary} />
            <div className={styles.heroGlowSecondary} />

            <div className={styles.container}>
              <div className={styles.heroContent}>
                <div className={styles.heroBadge}>
                  <BuildingIcon className={styles.heroBadgeIcon} />
                  <span>{companies.length} Empresas Registradas</span>
                </div>

                <h1 className={styles.heroTitle}>
                  Empresas que <span className={styles.heroTitleHighlight}>Contratam</span>
                </h1>
                <p className={styles.heroText}>
                  Conheça as empresas parceiras do EmpregoSTP e descubra oportunidades de carreira em São Tomé e Príncipe.
                </p>

                <div className={styles.statsGrid}>
                  {[
                    { value: companies.length, label: 'Empresas', color: '#818cf8' },
                    { value: totalJobs, label: 'Vagas Abertas', color: '#34d399' },
                    { value: industries.length, label: 'Setores', color: '#fbbf24' },
                  ].map((stat) => (
                    <div key={stat.label} className={styles.statCard} style={{ '--stat-color': stat.color }}>
                      <div className={styles.statValue}>{stat.value}</div>
                      <div className={styles.statLabel}>{stat.label}</div>
                    </div>
                  ))}
                </div>

                <div className={styles.filtersPanel}>
                  <div className={styles.filtersRow}>
                    <div className={styles.searchField}>
                      <SearchIcon className={styles.searchIcon} />
                      <input
                        type="text"
                        placeholder="Pesquisar empresas..."
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        className={styles.control}
                      />
                    </div>

                    <select
                      value={selectedIndustry}
                      onChange={(event) => setSelectedIndustry(event.target.value)}
                      className={styles.selectControl}
                    >
                      <option value="">Todos os setores</option>
                      {industries.map((industry) => (
                        <option key={industry} value={industry}>
                          {industry}
                        </option>
                      ))}
                    </select>

                    <select
                      value={sortBy}
                      onChange={(event) => setSortBy(event.target.value)}
                      className={styles.selectControl}
                    >
                      <option value="jobs">Mais vagas</option>
                      <option value="name">Nome A-Z</option>
                      <option value="recent">Mais recentes</option>
                    </select>

                    <div className={styles.viewToggle}>
                      <button
                        type="button"
                        onClick={() => setViewMode('grid')}
                        className={[styles.viewToggleButton, viewMode === 'grid' ? styles.viewToggleButtonActive : ''].filter(Boolean).join(' ')}
                        aria-label="Visualização em grelha"
                      >
                        <GridIcon className={styles.viewToggleIcon} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('list')}
                        className={[styles.viewToggleButton, viewMode === 'list' ? styles.viewToggleButtonActive : ''].filter(Boolean).join(' ')}
                        aria-label="Visualização em lista"
                      >
                        <ListIcon className={styles.viewToggleIcon} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {featuredCompanies.length > 0 && !searchTerm && !selectedIndustry ? (
            <section className={styles.section}>
              <div className={styles.container}>
                <div className={styles.sectionTitleRow}>
                  <StarIcon className={styles.sectionIcon} />
                  <h2 className={styles.sectionTitle}>Empresas em Destaque</h2>
                </div>
                <div className={styles.featuredGrid}>
                  {featuredCompanies.map((company) => (
                    <FeaturedCompanyCard key={company.id} company={company} />
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          <section className={styles.resultsSection}>
            <div className={styles.container}>
              <div className={styles.resultsHeader}>
                <p className={styles.resultsCount}>
                  {filteredCompanies.length} empresa{filteredCompanies.length !== 1 ? 's' : ''} encontrada{filteredCompanies.length !== 1 ? 's' : ''}
                </p>
                {searchTerm || selectedIndustry ? (
                  <button type="button" onClick={resetFilters} className={styles.clearFiltersButton}>
                    Limpar filtros
                  </button>
                ) : null}
              </div>

              {filteredCompanies.length > 0 ? (
                viewMode === 'grid' ? (
                  <div className={styles.companyGrid}>
                    {filteredCompanies.map((company) => (
                      <CompanyCard key={company.id} company={company} />
                    ))}
                  </div>
                ) : (
                  <div className={styles.companyList}>
                    {filteredCompanies.map((company) => (
                      <CompanyListItem key={company.id} company={company} />
                    ))}
                  </div>
                )
              ) : (
                <EmptyState onClear={resetFilters} />
              )}
            </div>
          </section>

          <section className={styles.ctaSection}>
            <div className={`${styles.container} ${styles.ctaInner}`}>
              <h2 className={styles.ctaTitle}>Sua empresa também pode estar aqui</h2>
              <p className={styles.ctaText}>
                Cadastre sua empresa gratuitamente e comece a encontrar os melhores talentos.
              </p>
              <Link href="/register?type=company" className={styles.ctaButton}>
                Cadastrar Empresa
                <ArrowRightIcon className={styles.linkIcon} />
              </Link>
            </div>
          </section>
        </div>
      </PublicPageShell>
    </>
  );
}
