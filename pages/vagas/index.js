import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import PublicPageShell from '../../components/PublicPageShell';
import JobCard from '../../components/JobCard';
import { useAuth } from '../../context/AuthContext';
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

  const formatCurrency = (value) => {
    if (!value) return '—';
    return Number(value).toLocaleString('pt-ST', { style: 'currency', currency: 'STN' });
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

      <style jsx>{`
        .jobs-page {
          max-width: 1300px;
          margin: 2.5rem auto 4rem;
          padding: 0 2rem;
          min-height: 100vh;
        }
        .hero {
          position: relative;
          overflow: hidden;
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.18) 0%, rgba(16, 185, 129, 0.12) 100%);
          border: 1px solid rgba(59, 130, 246, 0.18);
          color: white;
          padding: 3.2rem 2.5rem;
          border-radius: 24px;
          margin-bottom: 2rem;
          text-align: center;
          box-shadow: 0 20px 50px rgba(2, 6, 23, 0.45);
        }
        .hero::after {
          content: '';
          position: absolute;
          top: -120px;
          right: -120px;
          width: 240px;
          height: 240px;
          background: rgba(59, 130, 246, 0.12);
          border-radius: 999px;
          filter: blur(40px);
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.25rem;
          margin-bottom: 2.5rem;
        }
        .stat-card {
          padding: 1.25rem 1.5rem;
          border-radius: 18px;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(30, 41, 59, 0.7);
          box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.4);
        }
        .stat-label {
          margin: 0 0 0.5rem;
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          color: rgba(148, 163, 184, 0.7);
          font-weight: 800;
        }
        .stat-value {
          margin: 0;
          font-size: 1.7rem;
          font-weight: 900;
          color: #f8fafc;
        }
        .filters-panel {
          margin-bottom: 2.5rem;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(30, 41, 59, 0.7);
          padding: 2rem;
          border-radius: 22px;
          box-shadow: 0 18px 45px rgba(2, 6, 23, 0.45);
        }
        .results-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          padding: 0 0.5rem;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .active-filters {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-top: 1.5rem;
        }
        .filter-chip {
          padding: 0.35rem 0.75rem;
          border-radius: 999px;
          background: rgba(59, 130, 246, 0.15);
          border: 1px solid rgba(59, 130, 246, 0.25);
          color: #93c5fd;
          font-size: 0.65rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.14em;
        }
        @media (max-width: 900px) {
          .jobs-page {
            padding: 0 1.25rem;
          }
          .hero {
            padding: 2.6rem 1.8rem;
            text-align: left;
          }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      <main className="jobs-page">
        <div className="hero">
          <h1 style={{ 
            marginTop: 0, 
            fontSize: 'clamp(2rem, 4vw, 3rem)', 
            fontWeight: 900,
            letterSpacing: '-0.03em',
            marginBottom: '1rem'
          }}>
            Encontre sua próxima{' '}
            <span style={{
              background: 'linear-gradient(135deg, #60a5fa 0%, #34d399 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              Oportunidade
            </span>
          </h1>
          <p style={{ 
            fontSize: '1.1rem', 
            maxWidth: '700px', 
            margin: '0 auto',
            color: 'rgba(255, 255, 255, 0.8)',
            lineHeight: 1.6
          }}>
            Explore as melhores vagas de emprego em São Tomé e Príncipe
          </p>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <p className="stat-label">Total de vagas</p>
            <p className="stat-value">{totalJobs}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Vagas abertas</p>
            <p className="stat-value">{openJobs}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Em destaque</p>
            <p className="stat-value">{featuredJobs}</p>
          </div>
        </div>
        
        {/* Barra de pesquisa */}
        <div className="filters-panel">
          <form onSubmit={handleSearchSubmit}>
            <div style={{ marginBottom: '1.5rem', position: 'relative' }}>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Buscar vagas por título, descrição, requisitos ou localização..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  style={{
                    width: '100%',
                    padding: '1rem 1rem 1rem 2.5rem',
                    borderRadius: '12px',
                    border: '2px solid rgba(255, 255, 255, 0.1)',
                    fontSize: '1rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'white',
                    transition: 'all 0.3s ease'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#60a5fa';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }}
                />
                <svg 
                  style={{ 
                    position: 'absolute', 
                    left: '0.75rem', 
                    top: '50%', 
                    transform: 'translateY(-50%)',
                    width: '20px',
                    height: '20px',
                    color: '#718096'
                  }} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
              </div>
            </div>
            
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: '1rem', 
              alignItems: 'flex-end',
              justifyContent: 'space-between'
            }}>
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: '1rem', 
                alignItems: 'flex-end',
                flex: '1'
              }}>
                {/* Filtro de localização */}
                <div style={{ flex: '1', minWidth: '180px' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.9)' }}>
                    Localização
                  </label>
                  <select
                    name="localizacao"
                    value={filters.localizacao}
                    onChange={handleFilterChange}
                    style={{ 
                      width: '100%', 
                      padding: '0.75rem', 
                      borderRadius: '12px', 
                      border: '2px solid rgba(255, 255, 255, 0.1)',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: 'white',
                      fontSize: '0.95rem',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="" style={{ background: '#1e293b' }}>Todas</option>
                    {localizacoes.map(loc => (
                      <option key={loc} value={loc} style={{ background: '#1e293b' }}>{loc}</option>
                    ))}
                  </select>
                </div>
                
                {/* Filtro de tipo de contrato */}
                <div style={{ flex: '1', minWidth: '180px' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.9)' }}>
                    Tipo de Contrato
                  </label>
                  <select
                    name="tipoContrato"
                    value={filters.tipoContrato}
                    onChange={handleFilterChange}
                    style={{ 
                      width: '100%', 
                      padding: '0.75rem', 
                      borderRadius: '12px', 
                      border: '2px solid rgba(255, 255, 255, 0.1)',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: 'white',
                      fontSize: '0.95rem',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="" style={{ background: '#1e293b' }}>Todos</option>
                    {tiposContrato.map(tipo => (
                      <option key={tipo} value={tipo} style={{ background: '#1e293b' }}>{tipo}</option>
                    ))}
                  </select>
                </div>
                
                {/* Filtro de status */}
                <div style={{ flex: '1', minWidth: '180px' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.9)' }}>
                    Status
                  </label>
                  <select
                    name="status"
                    value={filters.status}
                    onChange={handleFilterChange}
                    style={{ 
                      width: '100%', 
                      padding: '0.75rem', 
                      borderRadius: '12px', 
                      border: '2px solid rgba(255, 255, 255, 0.1)',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: 'white',
                      fontSize: '0.95rem',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="" style={{ background: '#1e293b' }}>Todos</option>
                    <option value="active" style={{ background: '#1e293b' }}>Aberta</option>
                    <option value="closed" style={{ background: '#1e293b' }}>Fechada</option>
                    <option value="disabled" style={{ background: '#1e293b' }}>Desativada</option>
                  </select>
                </div>
              </div>

              {/* Filtro de vagas em destaque */}
              <div style={{ 
                display: 'flex', 
                gap: '1rem',
                alignItems: 'flex-end',
                marginTop: '1rem'
              }}>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '12px',
                  border: '2px solid rgba(255, 255, 255, 0.1)',
                  background: filters.showFeatured ? 'rgba(251, 146, 60, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  fontWeight: '600',
                  fontSize: '0.95rem',
                  color: filters.showFeatured ? '#fb923c' : 'rgba(255, 255, 255, 0.9)',
                  borderColor: filters.showFeatured ? 'rgba(251, 146, 60, 0.4)' : 'rgba(255, 255, 255, 0.1)',
                  whiteSpace: 'nowrap'
                }}>
                  <input
                    type="checkbox"
                    name="showFeatured"
                    checked={filters.showFeatured}
                    onChange={(e) => {
                      setFilters(prev => ({
                        ...prev,
                        showFeatured: e.target.checked
                      }));
                    }}
                    style={{
                      cursor: 'pointer',
                      width: '18px',
                      height: '18px',
                      accentColor: '#fb923c'
                    }}
                  />
                  <span>⭐ Apenas Destaques</span>
                </label>
              </div>
              
              <div style={{ 
                display: 'flex', 
                gap: '1rem',
                alignItems: 'flex-end',
                marginTop: '1rem'
              }}>
                {/* Ordenação */}
                <div style={{ minWidth: '180px' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.9)' }}>
                    Ordenar por
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    style={{ 
                      width: '100%', 
                      padding: '0.75rem', 
                      borderRadius: '12px', 
                      border: '2px solid rgba(255, 255, 255, 0.1)',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: 'white',
                      fontSize: '0.95rem',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="recentes" style={{ background: '#1e293b' }}>Mais recentes</option>
                    <option value="prazo" style={{ background: '#1e293b' }}>Prazo de candidatura</option>
                    <option value="salario" style={{ background: '#1e293b' }}>Maior salário</option>
                  </select>
                </div>
                
                {/* Botão de limpar filtros */}
                <button
                  type="button"
                  onClick={clearFilters}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '2px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: '#ef4444',
                    fontWeight: '600',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
                    e.currentTarget.style.borderColor = '#ef4444';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                  }}
                >
                  <svg 
                    width="16" 
                    height="16" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24" 
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                  Limpar Filtros
                </button>
              </div>
            </div>

            {activeFilterChips.length > 0 && (
              <div className="active-filters">
                {activeFilterChips.map((chip) => (
                  <span key={chip} className="filter-chip">
                    {chip}
                  </span>
                ))}
              </div>
            )}
          </form>
        </div>
        
        {/* Resultados */}
        <div>
          <div className="results-header">
            <p style={{ 
              margin: 0, 
              fontWeight: '700', 
              fontSize: '1.1rem',
              color: 'white'
            }}>
              {filteredJobs.length} {filteredJobs.length === 1 ? 'vaga encontrada' : 'vagas encontradas'}
            </p>
            <p style={{ margin: 0, color: 'rgba(148, 163, 184, 0.85)', fontSize: '0.9rem' }}>
              Ordenação: {sortLabel}
            </p>
          </div>
          
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '4rem 0' }}>
              <div style={{ 
                width: '50px', 
                height: '50px', 
                margin: '0 auto', 
                border: '4px solid rgba(255, 255, 255, 0.1)',
                borderTop: '4px solid #60a5fa',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              <p style={{ marginTop: '1.5rem', color: 'rgba(255, 255, 255, 0.7)', fontSize: '1.05rem' }}>Carregando resultados...</p>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '4rem 2rem',
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(10px)',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)'
            }}>
              <svg 
                width="80" 
                height="80" 
                fill="none" 
                stroke="rgba(255, 255, 255, 0.3)" 
                viewBox="0 0 24 24" 
                xmlns="http://www.w3.org/2000/svg"
                style={{ margin: '0 auto', display: 'block' }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <h3 style={{ color: 'white', marginTop: '1.5rem', fontSize: '1.5rem', fontWeight: '700' }}>Nenhuma vaga encontrada</h3>
              <p style={{ color: 'rgba(255, 255, 255, 0.7)', maxWidth: '500px', margin: '1rem auto 2rem', lineHeight: 1.6 }}>
                Tente ajustar seus filtros ou usar termos diferentes na busca
              </p>
              <button
                onClick={clearFilters}
                style={{
                  padding: '1rem 2rem',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontWeight: '700',
                  fontSize: '1rem',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 20px rgba(59, 130, 246, 0.4)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 30px rgba(59, 130, 246, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(59, 130, 246, 0.4)';
                }}
              >
                Limpar Filtros e Busca
              </button>
            </div>
          ) : (
            <div className="jobs-list" style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', 
              gap: '2rem' 
            }}>
              {filteredJobs.map((vaga) => (
                <JobCard 
                  key={vaga.id} 
                  vaga={vaga} 
                  isSaved={savedJobIds.includes(vaga.id)}
                  onToggleSave={(jobId) => {
                    if (savedJobIds.includes(jobId)) {
                      setSavedJobIds(savedJobIds.filter(id => id !== jobId));
                    } else {
                      setSavedJobIds([...savedJobIds, jobId]);
                    }
                  }}
                />
              ))}
              
              {/* Anúncio no final da lista */}
              {/* {filteredJobs.length > 0 && (
                <div style={{ 
                  gridColumn: '1 / -1',
                  margin: '2rem 0'
                }}>
                  <InContentAdWrapper />
                </div>
              )} Temporariamente removido */}
            </div>
          )}
        </div>
      </main>
      
      {/* <FooterAd /> Temporariamente removido */}
      </PublicPageShell>
    </>
  );
}

export async function getServerSideProps() {
  try {
    const { admin } = await import('../../lib/firebaseAdmin');
    
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
