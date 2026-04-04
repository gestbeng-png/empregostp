import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import PublicPageShell from '../../components/PublicPageShell';
import JobCard from '../../components/JobCard';
import { useAuth } from '../../context/AuthContext';
import styles from '../../styles/VagasPage.module.css';
// import { HeaderAd, InContentAdWrapper, FooterAd, BetweenJobsAd } from '../../components/ads'; // Temporariamente removido

export default function VagasPage({ initialJobs = [] }) {
  const router = useRouter();
  const { user } = useAuth();
  const [jobs, setJobs] = useState(initialJobs);
  const [filteredJobs, setFilteredJobs] = useState(initialJobs);
  const [searchTerm, setSearchTerm] = useState('');
  const [savedJobIds, setSavedJobIds] = useState([]);
  const [filters, setFilters] = useState({
    localizacao: '',
    tipoContrato: '',
    status: '',
    showFeatured: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [sortBy, setSortBy] = useState('recentes');

  // Aplicar termo de busca da URL quando a página carregar
  useEffect(() => {
    if (router.query.search) {
      setSearchTerm(router.query.search);
    }
  }, [router.query.search]);

  // Carregar vagas salvas do usuário
  useEffect(() => {
    async function loadSavedJobs() {
      if (!user) return;
      
      try {
        const { getAuth } = await import('firebase/auth');
        const auth = getAuth();
        const token = await auth.currentUser?.getIdToken();
        
        if (!token) return;
        
        const response = await fetch('/api/saved-jobs', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          const ids = data.savedJobs?.map(job => job.id) || [];
          setSavedJobIds(ids);
        }
      } catch (err) {
        console.error('Erro ao carregar vagas salvas:', err);
      }
    }
    
    loadSavedJobs();
  }, [user]);
  
  // Lista de localizações e tipos de contrato únicos para os filtros
  const [localizacoes, setLocalizacoes] = useState([]);
  const [tiposContrato, setTiposContrato] = useState([]);

  // Extrair opções de filtro dos dados
  useEffect(() => {
    if (jobs.length > 0) {
      const uniqueLocalizacoes = [...new Set(jobs.map(job => job.localizacao).filter(Boolean))];
      const uniqueTiposContrato = [...new Set(jobs.map(job => job.tipoContrato).filter(Boolean))];
      
      setLocalizacoes(uniqueLocalizacoes);
      setTiposContrato(uniqueTiposContrato);
    }
  }, [jobs]);

  // Aplicar filtros e busca
  useEffect(() => {
    setIsLoading(true);
    
    // Simulando um pequeno delay para mostrar o loading
    const timeoutId = setTimeout(() => {
      let result = [...jobs];
      
      // Aplicar termo de busca
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        result = result.filter(job => 
          (job.titulo?.toLowerCase().includes(term)) || 
          (job.descricao?.toLowerCase().includes(term)) ||
          (job.requisitos?.toLowerCase().includes(term)) ||
          (job.localizacao?.toLowerCase().includes(term))
        );
      }
      
      // Aplicar filtros
      if (filters.localizacao) {
        result = result.filter(job => job.localizacao === filters.localizacao);
      }
      
      if (filters.tipoContrato) {
        result = result.filter(job => job.tipoContrato === filters.tipoContrato);
      }
      
      if (filters.status) {
        result = result.filter(job => job.status === filters.status);
      }

      // Aplicar filtro de vagas em destaque
      if (filters.showFeatured) {
        result = result.filter(job => job.destaque === true || job.featured === true || job.isFeatured === true);
      }
      
      // Aplicar ordenação
      if (sortBy === 'recentes') {
        result.sort((a, b) => {
          // Vagas em destaque vêm primeiro
          if (a.destaque && !b.destaque) return -1;
          if (!a.destaque && b.destaque) return 1;
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });
      } else if (sortBy === 'prazo') {
        result.sort((a, b) => {
          if (a.destaque && !b.destaque) return -1;
          if (!a.destaque && b.destaque) return 1;
          return new Date(a.dataFecho || '9999-12-31') - new Date(b.dataFecho || '9999-12-31');
        });
      } else if (sortBy === 'salario') {
        result.sort((a, b) => {
          if (a.destaque && !b.destaque) return -1;
          if (!a.destaque && b.destaque) return 1;
          return (Number(b.salarioDe) || 0) - (Number(a.salarioDe) || 0);
        });
      }
      
      setFilteredJobs(result);
      setIsLoading(false);
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [searchTerm, filters, jobs, sortBy]);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    // A busca já é aplicada pelo useEffect quando searchTerm muda
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilters({
      localizacao: '',
      tipoContrato: '',
      status: '',
      showFeatured: false,
    });
    setSortBy('recentes');
  };

  const totalJobs = jobs.length;
  const openJobs = jobs.filter(job => {
    const normalized = String(job.status || 'active').toLowerCase();
    return normalized === 'active' || normalized === 'open' || normalized === 'aberta';
  }).length;
  const featuredJobs = jobs.filter(job => job.destaque || job.featured || job.isFeatured).length;

  const sortLabel = {
    recentes: 'Mais recentes',
    prazo: 'Prazo de candidatura',
    salario: 'Maior salário'
  }[sortBy] || 'Mais recentes';

  const activeFilterChips = [
    searchTerm.trim() ? `Busca: ${searchTerm.trim()}` : null,
    filters.localizacao ? `Localização: ${filters.localizacao}` : null,
    filters.tipoContrato ? `Contrato: ${filters.tipoContrato}` : null,
    filters.status ? `Status: ${filters.status}` : null,
    filters.showFeatured ? '⭐ Apenas Destaques' : null,
    sortLabel ? `Ordenação: ${sortLabel}` : null
  ].filter(Boolean);

  return (
    <>
      <Head>
        <title>Vagas de Emprego - EmpregoSTP</title>
        <meta name="description" content="Encontre as melhores vagas de emprego em São Tomé e Príncipe" />
      </Head>

      <PublicPageShell>
      {/* <HeaderAd /> Temporariamente removido */}
      <main className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <div className={styles.heroBadge}>Mercado de trabalho ativo em STP</div>
            <h1 className={styles.heroTitle}>
              Encontre sua próxima <span className={styles.heroAccent}>Oportunidade</span>
            </h1>
            <p className={styles.heroText}>
              Explore vagas com melhor organização visual, filtros claros e prioridade para as oportunidades em destaque.
            </p>

            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <p className={styles.statLabel}>Total de vagas</p>
                <p className={styles.statValue}>{totalJobs}</p>
              </div>
              <div className={styles.statCard}>
                <p className={styles.statLabel}>Vagas abertas</p>
                <p className={styles.statValue}>{openJobs}</p>
              </div>
              <div className={styles.statCard}>
                <p className={styles.statLabel}>Em destaque</p>
                <p className={styles.statValue}>{featuredJobs}</p>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.filtersPanel}>
          <form onSubmit={handleSearchSubmit}>
            <div className={styles.searchGroup}>
              <div className={styles.searchField}>
                <svg
                  className={styles.searchIcon}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar vagas por título, descrição, requisitos ou localização..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className={styles.searchInput}
                />
              </div>
            </div>

            <div className={styles.filtersRow}>
              <div className={styles.filterCluster}>
                <div className={styles.filterGroup}>
                  <label className={styles.filterLabel}>Localização</label>
                  <select
                    name="localizacao"
                    value={filters.localizacao}
                    onChange={handleFilterChange}
                    className={styles.filterControl}
                  >
                    <option value="">Todas</option>
                    {localizacoes.map((loc) => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>

                <div className={styles.filterGroup}>
                  <label className={styles.filterLabel}>Tipo de Contrato</label>
                  <select
                    name="tipoContrato"
                    value={filters.tipoContrato}
                    onChange={handleFilterChange}
                    className={styles.filterControl}
                  >
                    <option value="">Todos</option>
                    {tiposContrato.map((tipo) => (
                      <option key={tipo} value={tipo}>{tipo}</option>
                    ))}
                  </select>
                </div>

                <div className={styles.filterGroup}>
                  <label className={styles.filterLabel}>Status</label>
                  <select
                    name="status"
                    value={filters.status}
                    onChange={handleFilterChange}
                    className={styles.filterControl}
                  >
                    <option value="">Todos</option>
                    <option value="active">Aberta</option>
                    <option value="closed">Fechada</option>
                    <option value="disabled">Desativada</option>
                  </select>
                </div>

                <div className={styles.filterGroup}>
                  <label className={styles.filterLabel}>Ordenar por</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className={styles.filterControl}
                  >
                    <option value="recentes">Mais recentes</option>
                    <option value="prazo">Prazo de candidatura</option>
                    <option value="salario">Maior salário</option>
                  </select>
                </div>
              </div>

              <div className={styles.actionsRow}>
                <label className={`${styles.featuredToggle} ${filters.showFeatured ? styles.featuredToggleActive : ''}`}>
                  <input
                    type="checkbox"
                    name="showFeatured"
                    checked={filters.showFeatured}
                    onChange={(e) => {
                      setFilters((prev) => ({
                        ...prev,
                        showFeatured: e.target.checked
                      }));
                    }}
                    className={styles.featuredToggleInput}
                  />
                  <span>Apenas Destaques</span>
                </label>

                <button type="button" onClick={clearFilters} className={styles.clearButton}>
                  <svg className={styles.clearIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Limpar Filtros
                </button>
              </div>
            </div>

            {activeFilterChips.length > 0 ? (
              <div className={styles.activeFilters}>
                {activeFilterChips.map((chip) => (
                  <span key={chip} className={styles.filterChip}>
                    {chip}
                  </span>
                ))}
              </div>
            ) : null}
          </form>
        </section>

        <section className={styles.resultsSection}>
          <div className={styles.resultsHeader}>
            <p className={styles.resultsCount}>
              {filteredJobs.length} {filteredJobs.length === 1 ? 'vaga encontrada' : 'vagas encontradas'}
            </p>
            <p className={styles.resultsMeta}>Ordenação: {sortLabel}</p>
          </div>

          {isLoading ? (
            <div className={styles.loadingState}>
              <div className={styles.loadingSpinner}></div>
              <p className={styles.loadingText}>Carregando resultados...</p>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className={styles.emptyState}>
              <svg className={styles.emptyIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className={styles.emptyTitle}>Nenhuma vaga encontrada</h3>
              <p className={styles.emptyText}>
                Tente ajustar seus filtros ou usar termos diferentes na busca.
              </p>
              <button onClick={clearFilters} className={styles.emptyButton}>
                Limpar Filtros e Busca
              </button>
            </div>
          ) : (
            <div className={styles.jobsList}>
              {filteredJobs.map((vaga) => (
                <JobCard
                  key={vaga.id}
                  vaga={vaga}
                  isSaved={savedJobIds.includes(vaga.id)}
                  onToggleSave={(jobId) => {
                    if (savedJobIds.includes(jobId)) {
                      setSavedJobIds(savedJobIds.filter((id) => id !== jobId));
                    } else {
                      setSavedJobIds([...savedJobIds, jobId]);
                    }
                  }}
                />
              ))}
            </div>
          )}
        </section>
      </main>
      
      {/* <FooterAd /> Temporariamente removido */}
      </PublicPageShell>
    </>
  );
}

export async function getServerSideProps(context) {
  try {
    const { admin } = await import('../../lib/firebaseAdmin');
    // Cache público no edge para reduzir latência de listagem de vagas.
    // A lista não depende de autenticação (salvos são carregados no cliente).
    context?.res?.setHeader?.('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');
    
    // Função auxiliar para serializar Timestamps
    const serializeTimestamp = (timestamp) => {
      if (!timestamp) return null;
      if (timestamp.toDate) {
        return timestamp.toDate().toISOString();
      }
      if (timestamp.toMillis) {
        return new Date(timestamp.toMillis()).toISOString();
      }
      if (typeof timestamp === 'string') {
        return timestamp;
      }
      if (timestamp instanceof Date) {
        return timestamp.toISOString();
      }
      return null;
    };

    // Função auxiliar para serializar um objeto job
    const serializeJob = (job) => {
      const serialized = {
        id: job.id,
        ...Object.keys(job).reduce((acc, key) => {
          const value = job[key];
          // Se for um Timestamp, serializar
          if (value && (value.toDate || value.toMillis)) {
            acc[key] = serializeTimestamp(value);
          } else if (value && typeof value === 'object' && !Array.isArray(value) && value.constructor === Object) {
            // Se for um objeto aninhado, serializar recursivamente
            acc[key] = Object.keys(value).reduce((nestedAcc, nestedKey) => {
              const nestedValue = value[nestedKey];
              if (nestedValue && (nestedValue.toDate || nestedValue.toMillis)) {
                nestedAcc[nestedKey] = serializeTimestamp(nestedValue);
              } else {
                nestedAcc[nestedKey] = nestedValue;
              }
              return nestedAcc;
            }, {});
          } else {
            acc[key] = value;
          }
          return acc;
        }, {})
      };
      return serialized;
    };
    
    // Buscar todas as vagas
    const snapshot = await admin.firestore()
      .collection('jobs')
      .orderBy('createdAt', 'desc')
      .get();
    
    const jobs = snapshot.docs.map(doc => serializeJob({ id: doc.id, ...doc.data() }));
    
    return {
      props: { initialJobs: jobs }
    };
  } catch (error) {
    console.error('Erro ao buscar vagas:', error);
    return {
      props: { initialJobs: [] }
    };
  }
}
