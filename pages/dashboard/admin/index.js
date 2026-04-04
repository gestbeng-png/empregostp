import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { admin } from '../../../lib/firebaseAdmin';
import nookies from 'nookies';
import { auth } from '../../../lib/firebase';
import LandingHeader from '../../../components/LandingHeader';
import { ResponsiveContainer, BarChart, Bar, XAxis, CartesianGrid, Tooltip } from 'recharts';

export default function AdminDashboard({ initialStats = null, lastJobs = [] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(!initialStats);
  const [stats, setStats] = useState(initialStats || {});
  const [error, setError] = useState(null);
  const [hiringTips, setHiringTips] = useState([]);
  const [loadingTips, setLoadingTips] = useState(true);
  const [verifications, setVerifications] = useState([]);
  const [loadingVerifications, setLoadingVerifications] = useState(true);
  const [selectedVerification, setSelectedVerification] = useState(null);
  const [processingAction, setProcessingAction] = useState(false);

  const chartData = useMemo(() => ([
    { name: 'Usuários', value: Number(stats.totalUsers) || 0 },
    { name: 'Empresas', value: Number(stats.totalEmpresas) || 0 },
    { name: 'Candidatos', value: Number(stats.totalCandidatos) || 0 },
    { name: 'Vagas', value: Number(stats.totalJobs) || 0 },
    { name: 'Candidaturas', value: Number(stats.totalApplications) || 0 }
  ]), [stats]);



  useEffect(() => {
    let active = true;
    async function loadTips() {
      setLoadingTips(true);
      const tips = [
        {
          title: 'Qualidade das vagas',
          content: 'Revise descrições e requisitos para reduzir candidaturas desalinhadas.',
          category: 'GESTÃO'
        },
        {
          title: 'Aumente o engajamento',
          content: 'Destaque vagas estratégicas para acelerar o volume de candidatos.',
          category: 'CRESCIMENTO'
        },
        {
          title: 'Tempo de resposta',
          content: 'Mantenha feedback rápido para melhorar a reputação da plataforma.',
          category: 'EXPERIÊNCIA'
        }
      ];
      if (active) {
        setHiringTips(tips);
        setLoadingTips(false);
      }
    }
    loadTips();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    fetchVerifications();
  }, []);

  const fetchVerifications = async () => {
    setLoadingVerifications(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        console.error('No authenticated user');
        return;
      }
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/verifications', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setVerifications(data.verifications || []);
      } else {
        console.error('Failed to fetch verifications:', await response.text());
      }
    } catch (error) {
      console.error('Error fetching verifications:', error);
    } finally {
      setLoadingVerifications(false);
    }
  };

  const handleVerificationAction = async (verificationId, uid, action) => {
    setProcessingAction(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        alert('Não autenticado');
        return;
      }
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/verify-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ verificationId, uid, action })
      });
      if (response.ok) {
        alert(`Verificação ${action === 'approve' ? 'aprovada' : 'rejeitada'} com sucesso!`);
        setSelectedVerification(null);
        fetchVerifications(); // Reload list
      } else {
        const errorData = await response.json();
        alert(`Erro: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error processing verification:', error);
      alert('Erro ao processar verificação');
    } finally {
      setProcessingAction(false);
    }
  };

  if (loading) {
    return (
      <>
        <Head>
          <title>Dashboard Admin - EmpregoSTP</title>
          <style>{`
            body {
              background: linear-gradient(180deg, #0a0e1a 0%, #1a1f35 100%);
              min-height: 100vh;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </Head>
        <LandingHeader />
        <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
          <div style={{
            width: '50px',
            height: '50px',
            margin: '0 auto 1.5rem',
            border: '4px solid rgba(255, 255, 255, 0.1)',
            borderTop: '4px solid #60a5fa',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <p style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '1.1rem' }}>Carregando dashboard...</p>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Head>
          <title>Erro - EmpregoSTP</title>
          <style>{`
            body {
              background: linear-gradient(180deg, #0a0e1a 0%, #1a1f35 100%);
              min-height: 100vh;
            }
          `}</style>
        </Head>
        <LandingHeader />
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: 'calc(100vh - 80px)',
          padding: '0 1rem',
          textAlign: 'center'
        }}>
          <h2 style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '2rem' }}>Erro</h2>
          <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '1.05rem' }}>{error}</p>
          <Link href="/login" style={{
            marginTop: '1.5rem',
            padding: '1rem 2rem',
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            color: 'white',
            borderRadius: '12px',
            textDecoration: 'none',
            fontWeight: '700',
            boxShadow: '0 4px 20px rgba(59, 130, 246, 0.4)'
          }}>
            Voltar para o Login
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Dashboard Admin - EmpregoSTP</title>
        <style>{`
          body {
            background: linear-gradient(180deg, #0a0e1a 0%, #1a1f35 100%);
            min-height: 100vh;
          }
        `}</style>
      </Head>
      <LandingHeader />

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem', minHeight: '100vh' }}>

        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '20px',
          padding: '2rem',
          marginBottom: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2.5rem', color: 'white', fontWeight: '900' }}>
              Dashboard Administrativo
            </h1>
            <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.7)', fontSize: '1.05rem' }}>
              Visão geral do sistema EmpregoSTP
            </p>
          </div>
          <button
            onClick={() => router.reload()}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'rgba(59, 130, 246, 0.2)',
              border: '2px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '12px',
              color: '#60a5fa',
              cursor: 'pointer',
              fontWeight: '700',
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
            }}
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Atualizar
          </button>
        </div>

        {/* Estatísticas Gerais */}
        <section style={{ marginBottom: '3rem' }}>
          <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.75rem', color: 'white', fontWeight: '800' }}>
            Visão Geral do Sistema
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
            <StatCard title="Usuários Totais" value={stats.totalUsers || 0} color="#3b82f6" />
            <StatCard title="Candidatos" value={stats.totalCandidatos || 0} color="#10b981" />
            <StatCard title="Empresas" value={stats.totalEmpresas || 0} color="#f59e0b" />
            <StatCard title="Vagas Totais" value={stats.totalJobs || 0} color="#8b5cf6" />
            <StatCard title="Artigos no Blog" value={stats.totalPosts || 0} color="#ec4899" />
            <StatCard title="Templates/Recursos" value={stats.totalResources || 0} color="#14b8a6" />
            <StatCard title="Notícias" value={stats.totalNews || 0} color="#8b5cf6" />
          </div>
        </section>

        {/* Estatísticas de Vagas */}
        <section style={{ marginBottom: '3rem' }}>
          <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.75rem', color: 'white', fontWeight: '800' }}>
            Estatísticas de Vagas
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
            <StatCard title="Vagas Ativas" value={stats.activeJobs || 0} color="#10b981" />
            <StatCard title="Vagas Fechadas" value={stats.closedJobs || 0} color="#ef4444" />
            <StatCard title="Vagas Desativadas" value={stats.disabledJobs || 0} color="#64748b" />
            <StatCard title="Candidaturas" value={stats.totalApplications || 0} color="#3b82f6" />
          </div>
        </section>

        {/* Insights e IA */}
        <section style={{ marginBottom: '3rem' }}>
          <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.75rem', color: 'white', fontWeight: '800' }}>
            Insights Inteligentes
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '20px',
              padding: '1.75rem'
            }}>
              <h3 style={{ margin: '0 0 1rem 0', color: 'white', fontSize: '1.2rem', fontWeight: '800' }}>
                Fluxo do Sistema
              </h3>
              <div style={{ height: '260px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" vertical={false} />
                    <XAxis dataKey="name" stroke="rgba(255, 255, 255, 0.6)" fontSize={12} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: 'white' }} />
                    <Bar dataKey="value" fill="#6366f1" radius={[10, 10, 0, 0]} barSize={34} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={{
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              borderRadius: '20px',
              padding: '1.75rem',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  background: '#6366f1',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '800'
                }}>✨</div>
                <h3 style={{ margin: 0, color: '#a5b4fc', fontSize: '1.1rem', fontWeight: '800' }}>
                  IA Hiring Advisor
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', flex: 1 }}>
                {loadingTips ? (
                  <div style={{ height: '80px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '14px' }} />
                ) : (
                  hiringTips.map((tip, idx) => (
                    <div key={idx} style={{
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '16px',
                      padding: '0.9rem'
                    }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: '800', letterSpacing: '0.15em', color: '#818cf8' }}>
                        {tip.category}
                      </div>
                      <div style={{ color: 'white', fontWeight: '700', fontSize: '0.95rem', marginTop: '0.35rem' }}>
                        {tip.title}
                      </div>
                      <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.85rem', marginTop: '0.35rem' }}>
                        {tip.content}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <button
                onClick={() => router.push('/dashboard/admin/plans')}
                style={{
                  marginTop: '1.25rem',
                  padding: '0.75rem 1rem',
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  color: 'white',
                  borderRadius: '12px',
                  fontWeight: '800',
                  fontSize: '0.85rem'
                }}
              >
                Gerenciar Planos e Insights
              </button>
            </div>
          </div>
        </section>


        {/* Verificações Pendentes */}
        <section style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.75rem', color: 'white', fontWeight: '800' }}>
              Verificações Pendentes
              <span style={{
                marginLeft: '1rem',
                fontSize: '1rem',
                color: '#60a5fa',
                background: 'rgba(59, 130, 246, 0.2)',
                padding: '0.25rem 0.75rem',
                borderRadius: '20px'
              }}>
                {verifications.length} pedido{verifications.length !== 1 ? 's' : ''}
              </span>
            </h2>
            <Link href="/dashboard/admin/verificacoes" style={{
              padding: '0.5rem 1rem', borderRadius: '8px',
              background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)',
              color: '#fbbf24', textDecoration: 'none', fontWeight: '600', fontSize: '0.85rem',
            }}>
              Ver todas →
            </Link>
          </div>

          {loadingVerifications ? (
            <p style={{ color: 'rgba(255, 255, 255, 0.6)' }}>Carregando verificações...</p>
          ) : verifications.length === 0 ? (
            <div style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '20px',
              padding: '2rem',
              textAlign: 'center'
            }}>
              <p style={{ color: 'rgba(255, 255, 255, 0.7)', margin: 0 }}>
                Nenhuma verificação pendente no momento.
              </p>
            </div>
          ) : (
            <div style={{
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '20px',
              overflow: 'hidden'
            }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255, 255, 255, 0.08)' }}>
                      <th style={{ padding: '1rem', textAlign: 'left', color: 'rgba(255, 255, 255, 0.9)', fontWeight: '700', whiteSpace: 'nowrap' }}>Candidato</th>
                      <th style={{ padding: '1rem', textAlign: 'left', color: 'rgba(255, 255, 255, 0.9)', fontWeight: '700', whiteSpace: 'nowrap' }}>Email</th>
                      <th style={{ padding: '1rem', textAlign: 'left', color: 'rgba(255, 255, 255, 0.9)', fontWeight: '700', whiteSpace: 'nowrap' }}>Data</th>
                      <th style={{ padding: '1rem', textAlign: 'center', color: 'rgba(255, 255, 255, 0.9)', fontWeight: '700', whiteSpace: 'nowrap' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verifications.map((ver) => (
                      <tr key={ver.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <td style={{ padding: '1rem', color: 'white', whiteSpace: 'nowrap' }}>{ver.candidateName}</td>
                        <td style={{ padding: '1rem', color: 'rgba(255, 255, 255, 0.7)', whiteSpace: 'nowrap' }}>{ver.candidateEmail}</td>
                        <td style={{ padding: '1rem', color: 'rgba(255, 255, 255, 0.6)', whiteSpace: 'nowrap' }}>
                          {ver.submittedAt ? new Date(ver.submittedAt).toLocaleDateString('pt-BR') : 'N/A'}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          <button
                            onClick={() => setSelectedVerification(ver)}
                            style={{
                              padding: '0.5rem 1rem',
                              background: 'rgba(59, 130, 246, 0.2)',
                              border: '1px solid rgba(59, 130, 246, 0.3)',
                              borderRadius: '8px',
                              color: '#60a5fa',
                              cursor: 'pointer',
                              fontWeight: '600',
                              fontSize: '0.85rem',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            Ver Detalhes
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* Ações Administrativas */}
        <section style={{ marginBottom: '3rem' }}>
          <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.75rem', color: 'white', fontWeight: '800' }}>
            Gerenciamento
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <AdminActionButton href="/dashboard/admin/users" label="Gerenciar Usuários" color="#3b82f6" />
            <AdminActionButton href="/dashboard/admin/blog" label="Gerenciar Blog" color="#ec4899" />
            <AdminActionButton href="/dashboard/admin/news" label="Gerenciar Notícias" color="#8b5cf6" />
            <AdminActionButton href="/dashboard/admin/resources" label="Gerenciar Recursos" color="#14b8a6" />
            <AdminActionButton href="/dashboard/admin/jobs" label="Gerenciar Vagas" color="#10b981" />
            <AdminActionButton href="/dashboard/admin/services" label="Gerenciar Serviços" color="#8b5cf6" />
            <AdminActionButton href="/dashboard/admin/plans" label="Gerenciar Planos" color="#f59e0b" />
            <AdminActionButton href="/dashboard/admin/payment-settings" label="Config. Pagamento" color="#fbbf24" />
            <AdminActionButton href="/dashboard/admin/subscription-requests" label="Solicitações" color="#06b6d4" />
            <AdminActionButton href="/dashboard/admin/reports" label="Relatórios" color="#6366f1" />
            <AdminActionButton href="/dashboard/admin/verificacoes" label="Verificações" color="#f59e0b" />
            <AdminActionButton href="/dashboard/admin/auditoria" label="Auditoria" color="#64748b" />
          </div>
        </section>

        {/* Últimas Vagas */}
        <section>
          <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.75rem', color: 'white', fontWeight: '800' }}>
            Últimas Vagas Criadas
          </h2>

          {lastJobs.length === 0 ? (
            <div style={{
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              padding: '3rem 2rem',
              textAlign: 'center'
            }}>
              <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.7)', fontSize: '1.05rem' }}>
                Nenhuma vaga encontrada
              </p>
            </div>
          ) : (
            <div style={{
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              overflow: 'hidden'
            }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255, 255, 255, 0.05)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                      <th style={{ padding: '1rem', textAlign: 'left', color: 'white', fontWeight: '700' }}>Título</th>
                      <th style={{ padding: '1rem', textAlign: 'left', color: 'white', fontWeight: '700' }}>Empresa</th>
                      <th style={{ padding: '1rem', textAlign: 'left', color: 'white', fontWeight: '700' }}>Status</th>
                      <th style={{ padding: '1rem', textAlign: 'left', color: 'white', fontWeight: '700' }}>Data</th>
                      <th style={{ padding: '1rem', textAlign: 'right', color: 'white', fontWeight: '700' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lastJobs.map((job) => (
                      <tr key={job.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <td style={{ padding: '1rem', color: 'white', fontWeight: '600' }}>{job.titulo}</td>
                        <td style={{ padding: '1rem', color: 'rgba(255, 255, 255, 0.8)' }}>{job.companyName || 'N/A'}</td>
                        <td style={{ padding: '1rem' }}>
                          <StatusBadge status={job.status} />
                        </td>
                        <td style={{ padding: '1rem', color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.9rem' }}>
                          {job.createdAt ? new Date(job.createdAt).toLocaleDateString('pt-PT', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          }) : 'N/A'}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                          <Link href={`/dashboard/admin/jobs/${job.id}`} style={{
                            padding: '0.5rem 1rem',
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            color: 'white',
                            textDecoration: 'none',
                            borderRadius: '8px',
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            display: 'inline-block'
                          }}>
                            Ver Detalhes
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Modal de Revisão de Verificação */}
      {selectedVerification && (
        <div
          onClick={() => !processingAction && setSelectedVerification(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '2rem'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#0f172a',
              borderRadius: '24px',
              maxWidth: '900px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              padding: '2rem',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}
          >
            <div style={{ marginBottom: '2rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '1rem' }}>
              <h2 style={{ margin: '0 0 0.5rem 0', color: 'white', fontSize: '1.75rem', fontWeight: '800' }}>
                Revisão de Verificação
              </h2>
              <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.95rem' }}>
                Candidato: <strong style={{ color: 'white' }}>{selectedVerification.candidateName}</strong>
              </p>
            </div>

            <div style={{ display: 'grid', gap: '1.5rem', marginBottom: '2rem' }}>
              {/* Informações de Contato */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', padding: '1.25rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', color: 'white', fontSize: '1.1rem', fontWeight: '700' }}>
                  📧 Informações de Contato
                </h3>
                <p style={{ margin: '0.5rem 0', color: 'rgba(255, 255, 255, 0.8)' }}>
                  <strong>Email:</strong> {selectedVerification.documents?.contact?.email || 'Não informado'}
                </p>
                <p style={{ margin: '0.5rem 0', color: 'rgba(255, 255, 255, 0.8)' }}>
                  <strong>Telefone:</strong> {selectedVerification.documents?.contact?.phone || 'Não informado'}
                </p>
              </div>

              {/* Documento de Identidade */}
              {selectedVerification.documents?.idDocument?.url && (
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', padding: '1.25rem' }}>
                  <h3 style={{ margin: '0 0 1rem 0', color: 'white', fontSize: '1.1rem', fontWeight: '700' }}>
                    🪪 Documento de Identidade
                  </h3>
                  <p style={{ margin: '0.5rem 0 1rem 0', color: 'rgba(255, 255, 255, 0.7)' }}>
                    <strong>Tipo:</strong> {selectedVerification.documents.idDocument.type || 'Não especificado'}
                  </p>
                  <a
                    href={selectedVerification.documents.idDocument.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-block',
                      padding: '0.5rem 1rem',
                      background: 'rgba(59, 130, 246, 0.2)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      borderRadius: '8px',
                      color: '#60a5fa',
                      textDecoration: 'none',
                      fontWeight: '600'
                    }}
                  >
                    Ver Documento
                  </a>
                </div>
              )}

              {/* Selfie */}
              {selectedVerification.documents?.selfieDocument?.url && (
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', padding: '1.25rem' }}>
                  <h3 style={{ margin: '0 0 1rem 0', color: 'white', fontSize: '1.1rem', fontWeight: '700' }}>
                    🤳 Selfie de Verificação
                  </h3>
                  <a
                    href={selectedVerification.documents.selfieDocument.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-block',
                      padding: '0.5rem 1rem',
                      background: 'rgba(59, 130, 246, 0.2)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      borderRadius: '8px',
                      color: '#60a5fa',
                      textDecoration: 'none',
                      fontWeight: '600'
                    }}
                  >
                    Ver Selfie
                  </a>
                </div>
              )}

              {/* CV */}
              {selectedVerification.documents?.cvDocument?.url && (
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', padding: '1.25rem' }}>
                  <h3 style={{ margin: '0 0 1rem 0', color: 'white', fontSize: '1.1rem', fontWeight: '700' }}>
                    📄 Currículo
                  </h3>
                  <a
                    href={selectedVerification.documents.cvDocument.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-block',
                      padding: '0.5rem 1rem',
                      background: 'rgba(59, 130, 246, 0.2)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      borderRadius: '8px',
                      color: '#60a5fa',
                      textDecoration: 'none',
                      fontWeight: '600'
                    }}
                  >
                    Ver Currículo
                  </a>
                </div>
              )}
            </div>

            {/* Botões de Ação */}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <button
                onClick={() => setSelectedVerification(null)}
                disabled={processingAction}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '12px',
                  color: 'rgba(255, 255, 255, 0.8)',
                  cursor: processingAction ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  opacity: processingAction ? 0.5 : 1
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleVerificationAction(selectedVerification.id, selectedVerification.uid, 'reject')}
                disabled={processingAction}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '2px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: '12px',
                  color: '#f87171',
                  cursor: processingAction ? 'not-allowed' : 'pointer',
                  fontWeight: '700',
                  opacity: processingAction ? 0.5 : 1
                }}
              >
                ❌ Rejeitar
              </button>
              <button
                onClick={() => handleVerificationAction(selectedVerification.id, selectedVerification.uid, 'approve')}
                disabled={processingAction}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: '2px solid rgba(16, 185, 129, 0.4)',
                  borderRadius: '12px',
                  color: 'white',
                  cursor: processingAction ? 'not-allowed' : 'pointer',
                  fontWeight: '700',
                  opacity: processingAction ? 0.5 : 1
                }}
              >
                {processingAction ? 'Processando...' : '✅ Aprovar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StatCard({ title, value, color }) {
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '16px',
      padding: '1.5rem',
      transition: 'all 0.3s ease',
      cursor: 'pointer'
    }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.borderColor = color;
        e.currentTarget.style.boxShadow = `0 10px 30px ${color}40`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        e.currentTarget.style.boxShadow = 'none';
      }}>
      <div style={{ fontSize: '2.5rem', fontWeight: '900', color: color, marginBottom: '0.5rem' }}>
        {value}
      </div>
      <div style={{ fontSize: '1rem', color: 'white', fontWeight: '700' }}>
        {title}
      </div>
    </div>
  );
}

function AdminActionButton({ href, label, color }) {
  return (
    <Link href={href} style={{
      padding: '1rem 1.5rem',
      background: `${color}20`,
      border: `2px solid ${color}40`,
      borderRadius: '12px',
      color: color,
      textDecoration: 'none',
      fontWeight: '700',
      textAlign: 'center',
      fontSize: '0.95rem',
      display: 'block',
      transition: 'all 0.3s ease'
    }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = `${color}30`;
        e.currentTarget.style.borderColor = color;
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = `0 8px 25px ${color}40`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = `${color}20`;
        e.currentTarget.style.borderColor = `${color}40`;
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}>
      {label}
    </Link>
  );
}

function StatusBadge({ status }) {
  let color, bgColor, borderColor, label;

  if (status === 'active') {
    color = '#34d399';
    bgColor = 'rgba(16, 185, 129, 0.2)';
    borderColor = 'rgba(16, 185, 129, 0.3)';
    label = 'Ativa';
  } else if (status === 'closed') {
    color = '#fca5a5';
    bgColor = 'rgba(239, 68, 68, 0.2)';
    borderColor = 'rgba(239, 68, 68, 0.3)';
    label = 'Fechada';
  } else if (status === 'disabled') {
    color = '#94a3b8';
    bgColor = 'rgba(100, 116, 139, 0.2)';
    borderColor = 'rgba(100, 116, 139, 0.3)';
    label = 'Desativada';
  } else {
    color = '#cbd5e1';
    bgColor = 'rgba(203, 213, 225, 0.2)';
    borderColor = 'rgba(203, 213, 225, 0.3)';
    label = 'Desconhecido';
  }

  return (
    <span style={{
      display: 'inline-block',
      padding: '0.4rem 0.9rem',
      borderRadius: '12px',
      fontSize: '0.85rem',
      fontWeight: '700',
      backgroundColor: bgColor,
      color: color,
      border: `1px solid ${borderColor}`
    }}>
      {label}
    </span>
  );
}

export async function getServerSideProps(context) {
  try {
    const cookies = nookies.get(context);

    if (!cookies.token) {
      return { redirect: { destination: '/login', permanent: false } };
    }

    const token = await admin.auth().verifyIdToken(cookies.token);
    const { uid } = token;

    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return { redirect: { destination: '/login', permanent: false } };
    }

    const userData = userDoc.data();

    if (userData.userType !== 'admin') {
      return { redirect: { destination: '/dashboard', permanent: false } };
    }

    // Buscar estatísticas
    const [
      usersSnapshot,
      candidatosSnapshot,
      empresasSnapshot,
      jobsSnapshot,
      applicationsSnapshot,
      postsSnapshot,
      resourcesSnapshot,
      newsSnapshot
    ] = await Promise.all([
      admin.firestore().collection('users').get(),
      admin.firestore().collection('users').where('userType', '==', 'candidato').get(),
      admin.firestore().collection('users').where('userType', '==', 'empresa').get(),
      admin.firestore().collection('jobs').get(),
      admin.firestore().collection('applications').get(),
      admin.firestore().collection('posts').get(),
      admin.firestore().collection('resources_templates').get(),
      admin.firestore().collection('news').get()
    ]);

    // Função auxiliar para converter Timestamps para valores serializáveis
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
        titulo: job.titulo || '',
        status: job.status || '',
        companyId: job.companyId || null,
        createdAt: serializeTimestamp(job.createdAt),
        lastViewedAt: serializeTimestamp(job.lastViewedAt),
        updatedAt: serializeTimestamp(job.updatedAt),
        // Incluir outros campos necessários
        ...Object.keys(job).reduce((acc, key) => {
          if (key !== 'id' && key !== 'createdAt' && key !== 'lastViewedAt' && key !== 'updatedAt') {
            const value = job[key];
            // Se for um Timestamp, serializar
            if (value && (value.toDate || value.toMillis)) {
              acc[key] = serializeTimestamp(value);
            } else {
              acc[key] = value;
            }
          }
          return acc;
        }, {})
      };
      return serialized;
    };

    const jobsData = jobsSnapshot.docs.map(doc => serializeJob({ id: doc.id, ...doc.data() }));
    const activeJobs = jobsData.filter(job => job.status === 'active').length;
    const closedJobs = jobsData.filter(job => job.status === 'closed').length;
    const disabledJobs = jobsData.filter(job => job.status === 'disabled').length;

    // Últimas 5 vagas
    const sortedJobs = [...jobsData].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    const lastJobs = sortedJobs.slice(0, 5);

    // Adicionar nome da empresa
    const jobsWithCompanyNames = await Promise.all(lastJobs.map(async (job) => {
      if (job.companyId) {
        const companyDoc = await admin.firestore().collection('users').doc(job.companyId).get();
        if (companyDoc.exists) {
          const companyData = companyDoc.data();
          return {
            ...job,
            companyName: companyData.name || companyData.fullName || 'Empresa'
          };
        }
      }
      return {
        ...job,
        companyName: null
      };
    }));

    return {
      props: {
        initialStats: {
          totalUsers: usersSnapshot.size,
          totalCandidatos: candidatosSnapshot.size,
          totalEmpresas: empresasSnapshot.size,
          totalJobs: jobsSnapshot.size,
          activeJobs,
          closedJobs,
          disabledJobs,
          totalApplications: applicationsSnapshot.size,
          totalPosts: postsSnapshot.size,
          totalResources: resourcesSnapshot.size,
          totalNews: newsSnapshot.size
        },
        lastJobs: jobsWithCompanyNames
      }
    };
  } catch (error) {
    console.error('Erro no getServerSideProps:', error);
    return { redirect: { destination: '/login', permanent: false } };
  }
}
