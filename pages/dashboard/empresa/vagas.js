import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';

export default function VagasManagement() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [vagas, setVagas] = useState([]);
  const [loadingVagas, setLoadingVagas] = useState(true);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login?type=empresa');
      return;
    }

    fetchVagas();
  }, [user, loading]);

  const fetchVagas = async () => {
    try {
      setLoadingVagas(true);
      const token = await user.getIdToken();
      const response = await fetch('/api/jobs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (response.status === 401) {
        router.push('/login?type=empresa');
        return;
      }
      if (response.status === 403) {
        setError(data.error || 'Sem permissão para aceder às vagas');
        setVagas([]);
        return;
      }
      if (!response.ok) throw new Error(data.error || 'Failed to fetch vagas');
      setVagas(data.vagas || []);
    } catch (err) {
      setError('Erro ao carregar vagas');
      console.error(err);
    } finally {
      setLoadingVagas(false);
    }
  };

  const toggleDestaque = async (vagaId, currentDestaque) => {
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/jobs/${vagaId}/destaque`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ destaque: !currentDestaque })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.reason || 'Failed to update destaque');

      // Update local state
      setVagas(vagas.map(v =>
        v.id === vagaId ? { ...v, destaque: !currentDestaque } : v
      ));
    } catch (err) {
      setError(err.message || 'Erro ao atualizar destaque da vaga');
      console.error(err);
    }
  };

  const deleteVaga = async (vagaId) => {
    if (!confirm('Tem certeza que deseja deletar esta vaga?')) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/jobs/${vagaId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete vaga');
      setVagas(vagas.filter(v => v.id !== vagaId));
    } catch (err) {
      setError(err.message || 'Erro ao deletar vaga');
      console.error(err);
    }
  };

  const filteredVagas = vagas.filter(v => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'destaque') return v.destaque === true;
    if (filterStatus === 'active') return v.status === 'active';
    if (filterStatus === 'closed') return v.status === 'closed';
    return true;
  }).sort((a, b) => {
    if (sortBy === 'recent') return new Date(b.createdAt) - new Date(a.createdAt);
    if (sortBy === 'destaque') return (b.destaque ? 1 : 0) - (a.destaque ? 1 : 0);
    return 0;
  });

  if (loading || loadingVagas) {
    return (
      <div style={{ background: '#09090b', color: 'white', minHeight: '100vh', padding: '2rem' }}>
        <div style={{ textAlign: 'center', marginTop: '4rem' }}>
          <div style={{ fontSize: '1.5rem' }}>Carregando...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Gerenciar Vagas - EmpregoSTP</title>
      </Head>
      <div style={{ background: '#09090b', color: 'white', minHeight: '100vh', padding: '2rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>Minhas Vagas</h1>
            <Link href="/dashboard/empresa/vaga/criar-vaga" style={{
              padding: '0.75rem 1.5rem',
              background: '#3b82f6',
              color: 'white',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '600'
            }}>
              + Nova Vaga
            </Link>
          </div>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#fca5a5',
              padding: '1rem',
              borderRadius: '8px',
              marginBottom: '1.5rem'
            }}>
              {error}
            </div>
          )}

          {/* Filters and Sort */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            marginBottom: '2rem',
            flexWrap: 'wrap'
          }}>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                padding: '0.75rem 1rem',
                background: '#1a1a23',
                color: 'white',
                border: '1px solid #3b82f6',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              <option value="all">Todas as Vagas</option>
              <option value="destaque">⭐ Em Destaque</option>
              <option value="active">Ativas</option>
              <option value="closed">Fechadas</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                padding: '0.75rem 1rem',
                background: '#1a1a23',
                color: 'white',
                border: '1px solid #3b82f6',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              <option value="recent">Mais Recentes</option>
              <option value="destaque">Destaques Primeiro</option>
            </select>
          </div>

          {/* Vagas List */}
          {filteredVagas.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '3rem 1rem',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.06)'
            }}>
              <p style={{ fontSize: '1.1rem', color: '#a1a1aa', margin: 0 }}>
                Nenhuma vaga encontrada
              </p>
              <Link href="/dashboard/empresa/vaga/criar-vaga" style={{
                display: 'inline-block',
                marginTop: '1rem',
                color: '#3b82f6',
                textDecoration: 'none',
                fontWeight: '600'
              }}>
                Crie sua primeira vaga
              </Link>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {filteredVagas.map((vaga) => (
                <div
                  key={vaga.id}
                  style={{
                    background: vaga.destaque ? 'linear-gradient(135deg, rgba(251, 146, 60, 0.1), rgba(59, 130, 246, 0.1))' : 'rgba(255,255,255,0.02)',
                    border: vaga.destaque ? '1px solid rgba(251,146,60,0.3)' : '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>
                        {vaga.title || 'Sem título'}
                      </h3>
                      {vaga.destaque && (
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          background: 'rgba(251,146,60,0.15)',
                          color: '#fb923c',
                          fontSize: '0.75rem',
                          borderRadius: '9999px',
                          fontWeight: '600'
                        }}>
                          ⭐ Destaque
                        </span>
                      )}
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        background: vaga.status === 'active'
                          ? 'rgba(16,185,129,0.15)'
                          : 'rgba(107,114,128,0.15)',
                        color: vaga.status === 'active' ? '#34d399' : '#9ca3af',
                        fontSize: '0.75rem',
                        borderRadius: '4px',
                        fontWeight: '600'
                      }}>
                        {vaga.status === 'active' ? '🟢 Ativa' : '⚫ Fechada'}
                      </span>
                    </div>

                    <p style={{
                      margin: '0.5rem 0 0',
                      color: '#a1a1aa',
                      fontSize: '0.9rem'
                    }}>
                      {vaga.candidaturas_count || 0} candidaturasnas
                    </p>
                  </div>

                  <div style={{
                    display: 'flex',
                    gap: '0.75rem',
                    alignItems: 'center'
                  }}>
                    <button
                      onClick={() => toggleDestaque(vaga.id, vaga.destaque)}
                      style={{
                        padding: '0.6rem 1rem',
                        background: vaga.destaque
                          ? 'rgba(251,146,60,0.2)'
                          : 'rgba(255,255,255,0.1)',
                        color: vaga.destaque ? '#fb923c' : '#e5e7eb',
                        border: `1px solid ${vaga.destaque ? 'rgba(251,146,60,0.3)' : 'rgba(255,255,255,0.2)'}`,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '0.875rem',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = vaga.destaque
                          ? 'rgba(251,146,60,0.3)'
                          : 'rgba(255,255,255,0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = vaga.destaque
                          ? 'rgba(251,146,60,0.2)'
                          : 'rgba(255,255,255,0.1)';
                      }}
                    >
                      {vaga.destaque ? '✓ Destaque' : '⭐ Destacar'}
                    </button>

                    <Link href={`/dashboard/empresa/vaga/${vaga.id}`} style={{
                      padding: '0.6rem 1rem',
                      background: 'rgba(59,130,246,0.2)',
                      color: '#60a5fa',
                      border: '1px solid rgba(59,130,246,0.3)',
                      borderRadius: '6px',
                      textDecoration: 'none',
                      fontWeight: '600',
                      fontSize: '0.875rem',
                      cursor: 'pointer'
                    }}>
                      Editar
                    </Link>

                    <button
                      onClick={() => deleteVaga(vaga.id)}
                      style={{
                        padding: '0.6rem 1rem',
                        background: 'rgba(239,68,68,0.2)',
                        color: '#fca5a5',
                        border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '0.875rem'
                      }}
                    >
                      🗑️ Deletar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Info Box */}
          <div style={{
            marginTop: '2rem',
            background: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.2)',
            borderRadius: '12px',
            padding: '1.5rem'
          }}>
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: '600', color: '#34d399' }}>
              💡 Dica: Use Destaques para Atrair Mais Candidatos
            </h3>
            <p style={{
              margin: 0,
              color: '#6ee7b7',
              fontSize: '0.9rem',
              lineHeight: '1.6'
            }}>
              As vagas em destaque aparecem no topo da plataforma e recebem muito mais visibilidade. 
              Destaque suas vagas mais importantes para atrair os melhores candidatos!
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
