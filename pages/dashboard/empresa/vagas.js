import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import styles from '../../../styles/EmpresaVagasManagement.module.css';
import { requireCompanySession } from '../../../lib/serverSession';

export default function VagasManagement() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [vagas, setVagas] = useState([]);
  const [loadingVagas, setLoadingVagas] = useState(true);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [processingId, setProcessingId] = useState('');

  const fetchVagas = useCallback(async () => {
    try {
      setLoadingVagas(true);
      setError('');
      const token = await user.getIdToken();
      const response = await fetch('/api/jobs', {
        headers: { Authorization: `Bearer ${token}` }
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
  }, [router, user]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login?type=empresa');
      return;
    }

    fetchVagas();
  }, [fetchVagas, loading, router, user]);

  const toggleDestaque = async (vagaId, currentDestaque) => {
    try {
      setProcessingId(vagaId);
      setError('');
      const token = await user.getIdToken();
      const response = await fetch(`/api/jobs/${vagaId}/destaque`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ destaque: !currentDestaque })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.reason || 'Failed to update destaque');

      setVagas((current) => current.map((v) => (v.id === vagaId ? { ...v, destaque: !currentDestaque } : v)));
    } catch (err) {
      setError(err.message || 'Erro ao atualizar destaque da vaga');
      console.error(err);
    } finally {
      setProcessingId('');
    }
  };

  const deleteVaga = async (vagaId) => {
    if (!confirm('Eliminar esta vaga? Esta ação não pode ser anulada.')) return;

    try {
      setProcessingId(vagaId);
      setError('');
      const token = await user.getIdToken();
      const response = await fetch(`/api/jobs/${vagaId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível eliminar a vaga');
      setVagas((current) => current.filter((v) => v.id !== vagaId));
    } catch (err) {
      setError(err.message || 'Erro ao eliminar vaga');
      console.error(err);
    } finally {
      setProcessingId('');
    }
  };

  const filteredVagas = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase('pt-PT');
    return vagas
      .filter((vaga) => {
        if (filterStatus === 'destaque' && !vaga.destaque) return false;
        if (filterStatus === 'active' && vaga.status !== 'active') return false;
        if (filterStatus === 'closed' && vaga.status !== 'closed') return false;
        if (!normalizedSearch) return true;
        return [vaga.title, vaga.titulo, vaga.categoria, vaga.localizacao]
          .filter(Boolean)
          .some((value) => String(value).toLocaleLowerCase('pt-PT').includes(normalizedSearch));
      })
      .sort((a, b) => {
        if (sortBy === 'recent') return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        if (sortBy === 'destaque') return Number(Boolean(b.destaque)) - Number(Boolean(a.destaque));
        return 0;
      });
  }, [filterStatus, searchTerm, sortBy, vagas]);

  const summary = useMemo(() => ({
    total: vagas.length,
    active: vagas.filter((v) => v.status === 'active').length,
    destaque: vagas.filter((v) => v.destaque).length,
    candidaturas: vagas.reduce((total, vaga) => total + Number(vaga.candidaturas_count || 0), 0)
  }), [vagas]);

  if (loading || loadingVagas) {
    return (
      <div className={styles.loadingPage} aria-busy="true">
        <div className={styles.loadingSpinner} aria-hidden="true" />
        <p className={styles.loadingText} role="status">A carregar vagas...</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Gerir vagas - EmpregoSTP</title>
      </Head>

      <div className={styles.page}>
        <div className={styles.container}>
          <header className={styles.hero}>
            <div className={styles.heroCopy}>
              <Link href="/dashboard/empresa" className={styles.backLink}>
                Voltar ao dashboard
              </Link>
              <span className={styles.eyebrow}>Operação de recrutamento</span>
              <h1 className={styles.title}>Minhas vagas</h1>
              <p className={styles.description}>Encontre rapidamente cada publicação, acompanhe o interesse e mantenha o estado atualizado.</p>
            </div>

            <Link href="/dashboard/empresa/vaga/criar-vaga" className={styles.primaryCta}>
              Nova vaga
            </Link>
          </header>

          <section className={styles.summaryGrid}>
            <SummaryCard label="Total" value={summary.total} accent="blue" />
            <SummaryCard label="Ativas" value={summary.active} accent="green" />
            <SummaryCard label="Em destaque" value={summary.destaque} accent="gold" />
            <SummaryCard label="Candidaturas" value={summary.candidaturas} accent="violet" />
          </section>

          {error ? <div className={styles.errorBanner} role="alert">{error}</div> : null}

          <section className={styles.controlBar} aria-label="Filtrar e ordenar vagas">
            <div className={`${styles.controlGroup} ${styles.searchGroup}`}>
              <label htmlFor="vaga-search" className={styles.controlLabel}>
                Pesquisar
              </label>
              <input
                id="vaga-search"
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className={styles.searchInput}
                placeholder="Título, categoria ou local"
              />
            </div>
            <div className={styles.controlGroup}>
              <label htmlFor="vaga-filter" className={styles.controlLabel}>
                Filtrar
              </label>
              <select
                id="vaga-filter"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className={styles.select}
              >
                <option value="all">Todas as vagas</option>
                <option value="destaque">Em destaque</option>
                <option value="active">Ativas</option>
                <option value="closed">Fechadas</option>
              </select>
            </div>

            <div className={styles.controlGroup}>
              <label htmlFor="vaga-sort" className={styles.controlLabel}>
                Ordenar
              </label>
              <select
                id="vaga-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className={styles.select}
              >
                <option value="recent">Mais Recentes</option>
                <option value="destaque">Destaques primeiro</option>
              </select>
            </div>
            <p className={styles.resultCount} aria-live="polite">
              {filteredVagas.length} {filteredVagas.length === 1 ? 'resultado' : 'resultados'}
            </p>
          </section>

          {filteredVagas.length === 0 ? (
            <section className={styles.emptyState}>
              <h2 className={styles.emptyTitle}>{vagas.length === 0 ? 'Publique a primeira vaga' : 'Nenhuma vaga corresponde à pesquisa'}</h2>
              <p className={styles.emptyDescription}>{vagas.length === 0 ? 'Comece por descrever a oportunidade. Pode rever tudo antes de publicar.' : 'Altere a pesquisa ou os filtros para voltar a ver as suas vagas.'}</p>
              {vagas.length === 0 ? (
                <Link href="/dashboard/empresa/vaga/criar-vaga" className={styles.emptyAction}>
                  Criar vaga
                </Link>
              ) : (
                <button type="button" className={styles.emptyAction} onClick={() => { setSearchTerm(''); setFilterStatus('all'); }}>
                  Limpar filtros
                </button>
              )}
            </section>
          ) : (
            <section className={styles.list}>
              {filteredVagas.map((vaga) => (
                <article
                  key={vaga.id}
                  className={`${styles.jobCard} ${vaga.destaque ? styles.jobCardFeatured : ''}`}
                >
                  <div className={styles.jobContent}>
                    <div className={styles.jobHeader}>
                      <div className={styles.jobTitleWrap}>
                        <h2 className={styles.jobTitle}>
                          <Link href={`/dashboard/empresa/vaga/${vaga.id}`}>{vaga.title || vaga.titulo || 'Sem título'}</Link>
                        </h2>
                        <div className={styles.badges}>
                          {vaga.destaque ? <span className={`${styles.badge} ${styles.badgeFeatured}`}>Destaque</span> : null}
                          <span className={`${styles.badge} ${vaga.status === 'active' ? styles.badgeActive : styles.badgeClosed}`}>
                            {vaga.status === 'active' ? 'Ativa' : 'Fechada'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className={styles.metaRow}>
                      <span className={styles.metaItem}>
                        {vaga.candidaturas_count || 0} candidaturas
                      </span>
                      {vaga.createdAt ? (
                        <span className={styles.metaItem}>
                          Publicada em {new Date(vaga.createdAt).toLocaleDateString('pt-PT')}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className={styles.actions}>
                    <button
                      type="button"
                      onClick={() => toggleDestaque(vaga.id, vaga.destaque)}
                      disabled={processingId === vaga.id}
                      className={`${styles.actionButton} ${vaga.destaque ? styles.actionFeatured : styles.actionNeutral}`}
                    >
                      {processingId === vaga.id ? 'A atualizar…' : vaga.destaque ? 'Em destaque' : 'Destacar'}
                    </button>

                    <Link href={`/dashboard/empresa/vaga/${vaga.id}`} className={`${styles.actionButton} ${styles.actionEdit}`}>
                      Ver detalhes
                    </Link>

                    <button
                      type="button"
                      onClick={() => deleteVaga(vaga.id)}
                      disabled={processingId === vaga.id}
                      className={`${styles.actionButton} ${styles.actionDelete}`}
                    >
                      Eliminar
                    </button>
                  </div>
                </article>
              ))}
            </section>
          )}

          <section className={styles.tipBox}>
            <h2 className={styles.tipTitle}>Use o destaque nas vagas prioritárias</h2>
            <p className={styles.tipText}>
              As publicações destacadas ganham maior visibilidade. Reserve este recurso para oportunidades com contratação urgente.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}

function SummaryCard({ label, value, accent }) {
  return (
    <article className={`${styles.summaryCard} ${styles[`summary${accent[0].toUpperCase()}${accent.slice(1)}`]}`}>
      <span className={styles.summaryLabel}>{label}</span>
      <strong className={styles.summaryValue}>{value}</strong>
    </article>
  );
}


// Painel da empresa: o guard corre no servidor para ninguém sem sessão de
// empresa chegar a ver a página.
export async function getServerSideProps(context) {
  const guard = await requireCompanySession(context);
  if (guard) return guard;

  return { props: {} };
}
