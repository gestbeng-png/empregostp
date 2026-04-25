import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import styles from '../../../styles/EmpresaVagasManagement.module.css';

export default function VagasManagement() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [vagas, setVagas] = useState([]);
  const [loadingVagas, setLoadingVagas] = useState(true);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [filterStatus, setFilterStatus] = useState('all');

  const fetchVagas = useCallback(async () => {
    try {
      setLoadingVagas(true);
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

      setVagas(vagas.map((v) => (v.id === vagaId ? { ...v, destaque: !currentDestaque } : v)));
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
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete vaga');
      setVagas(vagas.filter((v) => v.id !== vagaId));
    } catch (err) {
      setError(err.message || 'Erro ao deletar vaga');
      console.error(err);
    }
  };

  const filteredVagas = vagas
    .filter((v) => {
      if (filterStatus === 'all') return true;
      if (filterStatus === 'destaque') return v.destaque === true;
      if (filterStatus === 'active') return v.status === 'active';
      if (filterStatus === 'closed') return v.status === 'closed';
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'recent') return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortBy === 'destaque') return (b.destaque ? 1 : 0) - (a.destaque ? 1 : 0);
      return 0;
    });

  const summary = {
    total: vagas.length,
    active: vagas.filter((v) => v.status === 'active').length,
    destaque: vagas.filter((v) => v.destaque).length,
    candidaturas: vagas.reduce((total, vaga) => total + Number(vaga.candidaturas_count || 0), 0)
  };

  if (loading || loadingVagas) {
    return (
      <main className={styles.loadingPage}>
        <div className={styles.loadingSpinner} aria-hidden="true" />
        <p className={styles.loadingText}>Carregando vagas...</p>
      </main>
    );
  }

  return (
    <>
      <Head>
        <title>Gerenciar Vagas - EmpregoSTP</title>
      </Head>

      <main className={styles.page}>
        <div className={styles.container}>
          <header className={styles.hero}>
            <div className={styles.heroCopy}>
              <Link href="/dashboard/empresa" className={styles.backLink}>
                Voltar ao dashboard
              </Link>
              <span className={styles.eyebrow}>Operação de recrutamento</span>
              <h1 className={styles.title}>Minhas Vagas</h1>
              <p className={styles.description}>Gerencie visibilidade, estado e edições das vagas ativas da sua empresa.</p>
            </div>

            <Link href="/dashboard/empresa/vaga/criar-vaga" className={styles.primaryCta}>
              + Nova Vaga
            </Link>
          </header>

          <section className={styles.summaryGrid}>
            <SummaryCard label="Total" value={summary.total} accent="blue" />
            <SummaryCard label="Ativas" value={summary.active} accent="green" />
            <SummaryCard label="Em destaque" value={summary.destaque} accent="gold" />
            <SummaryCard label="Candidaturas" value={summary.candidaturas} accent="violet" />
          </section>

          {error ? <div className={styles.errorBanner}>{error}</div> : null}

          <section className={styles.controlBar}>
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
                <option value="all">Todas as Vagas</option>
                <option value="destaque">Em Destaque</option>
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
                <option value="destaque">Destaques Primeiro</option>
              </select>
            </div>
          </section>

          {filteredVagas.length === 0 ? (
            <section className={styles.emptyState}>
              <h3 className={styles.emptyTitle}>Nenhuma vaga encontrada</h3>
              <p className={styles.emptyDescription}>Crie a primeira vaga ou ajuste os filtros para ver outros resultados.</p>
              <Link href="/dashboard/empresa/vaga/criar-vaga" className={styles.emptyAction}>
                Criar sua primeira vaga
              </Link>
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
                        <h3 className={styles.jobTitle}>{vaga.title || 'Sem título'}</h3>
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
                      className={`${styles.actionButton} ${vaga.destaque ? styles.actionFeatured : styles.actionNeutral}`}
                    >
                      {vaga.destaque ? '✓ Destaque' : '⭐ Destacar'}
                    </button>

                    <Link href={`/dashboard/empresa/vaga/${vaga.id}`} className={`${styles.actionButton} ${styles.actionEdit}`}>
                      Editar
                    </Link>

                    <button
                      type="button"
                      onClick={() => deleteVaga(vaga.id)}
                      className={`${styles.actionButton} ${styles.actionDelete}`}
                    >
                      Deletar
                    </button>
                  </div>
                </article>
              ))}
            </section>
          )}

          <section className={styles.tipBox}>
            <h3 className={styles.tipTitle}>Dica: use Destaques para atrair mais candidatos</h3>
            <p className={styles.tipText}>
              As vagas em destaque aparecem no topo da plataforma e recebem mais visibilidade. Destaque as vagas mais
              importantes para atrair os melhores candidatos.
            </p>
          </section>
        </div>
      </main>
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
