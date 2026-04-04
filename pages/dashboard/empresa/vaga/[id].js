import { admin } from '../../../../lib/firebaseAdmin';
import nookies from 'nookies';
import Link from 'next/link';
import Head from 'next/head';
import { useState } from 'react';
import { useRouter } from 'next/router';

function safeTimestampToMillis(timestamp) {
  if (!timestamp) return null;
  if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
  if (typeof timestamp === 'number') return timestamp;
  if (typeof timestamp === 'string') return new Date(timestamp).getTime();
  return null;
}

export default function DetalheVaga({ vaga, candidaturas }) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);

  const getAuthToken = async () => {
    const { getAuth } = await import('firebase/auth');
    return getAuth().currentUser?.getIdToken();
  };

  const alterarStatus = async (novoStatus) => {
    try {
      setIsProcessing(true);
      const token = await getAuthToken();
      if (!token) throw new Error('Sessão expirada');

      const response = await fetch(`/api/jobs/${vaga.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: novoStatus })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao atualizar status');
      }

      router.reload();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert(error.message || 'Erro ao atualizar status. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  const eliminarVaga = async () => {
    if (!confirm('Tem certeza que deseja eliminar esta vaga? Esta ação é irreversível.')) return;
    try {
      setIsProcessing(true);
      const token = await getAuthToken();
      if (!token) throw new Error('Sessão expirada');

      const response = await fetch(`/api/jobs/${vaga.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao eliminar vaga');
      }

      router.push('/dashboard/empresa');
    } catch (error) {
      console.error('Erro ao eliminar vaga:', error);
      alert(error.message || 'Erro ao eliminar vaga. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  const alterarStatusCandidatura = async (candidaturaId, novoStatus) => {
    try {
      setIsProcessing(true);
      const token = await getAuthToken();
      if (!token) throw new Error('Sessão expirada');

      const response = await fetch(`/api/applications/${candidaturaId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status: novoStatus
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao atualizar status da candidatura');
      }

      router.reload();
    } catch (error) {
      console.error('Erro ao atualizar status da candidatura:', error);
      alert(error.message || 'Erro ao atualizar status. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!vaga) {
    return (
      <>
        <Head>
          <style>{`
            body {
              background: #0a0a0f;
              min-height: 100vh;
            }
          `}</style>
        </Head>
        <main style={{ maxWidth: 900, margin: '2.5rem auto', padding: '0 1.5rem', textAlign: 'center' }}>
          <h2 style={{ color: 'white' }}>Vaga não encontrada</h2>
          <Link href="/dashboard/empresa" style={{ color: '#6366f1' }}>Voltar ao Dashboard</Link>
        </main>
      </>
    );
  }

  const {
    titulo,
    descricao,
    requisitos,
    localizacao,
    tipoContrato,
    salarioDe,
    salarioAte,
    beneficios,
    dataAbertura,
    dataFecho,
    isPrivada,
    status,
    skillsAssessment,
  } = vaga;

  const formatCurrency = (value) => {
    if (!value) return 'Não informado';
    return Number(value).toLocaleString('pt-ST', { style: 'currency', currency: 'STN' });
  };

  const pendingCount = candidaturas.filter(c => c.status === 'pending' || !c.status).length;
  const approvedCount = candidaturas.filter(c => c.status === 'approved').length;
  const rejectedCount = candidaturas.filter(c => c.status === 'rejected').length;

  return (
    <>
      <Head>
        <title>{titulo} - EmpregoSTP</title>
        <style>{`
          body {
            background: #0a0a0f;
            min-height: 100vh;
          }
        `}</style>
      </Head>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem', minHeight: '100vh' }}>

        {/* Header */}
        <Link href="/dashboard/empresa" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          color: '#60a5fa',
          textDecoration: 'none',
          fontWeight: '600',
          marginBottom: '2rem'
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Voltar ao Dashboard
        </Link>

        {/* Detalhes da Vaga */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '2rem',
          marginBottom: '2rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '2rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
            <div style={{ flex: 1 }}>
              <h1 style={{ margin: '0 0 1rem 0', fontSize: '2rem', color: 'white', fontWeight: '900' }}>
                {titulo}
              </h1>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.95rem' }}>
                <span>{localizacao}</span>
                <span>•</span>
                <span>{tipoContrato}</span>
                {isPrivada && (
                  <>
                    <span>•</span>
                    <span>Privada</span>
                  </>
                )}
              </div>
            </div>

            <div style={{
              padding: '0.75rem 1.5rem',
              background: status === 'active' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(100, 116, 139, 0.2)',
              border: status === 'active' ? '2px solid rgba(16, 185, 129, 0.3)' : '2px solid rgba(100, 116, 139, 0.3)',
              borderRadius: '12px',
              color: status === 'active' ? '#34d399' : '#94a3b8',
              fontWeight: '700',
              whiteSpace: 'nowrap'
            }}>
              {status === 'active' ? 'Ativa' : status === 'closed' ? 'Fechada' : 'Desativada'}
            </div>
          </div>

          {/* Informações da Vaga */}
          <div style={{ display: 'grid', gap: '2rem' }}>

            <div>
              <h3 style={{ margin: '0 0 1rem 0', color: 'white', fontSize: '1.2rem', fontWeight: '700' }}>Descrição</h3>
              <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.7 }}>
                {descricao || 'Não informado'}
              </p>
            </div>

            {requisitos && (
              <div>
                <h3 style={{ margin: '0 0 1rem 0', color: 'white', fontSize: '1.2rem', fontWeight: '700' }}>Requisitos</h3>
                <ul style={{ paddingLeft: '1.5rem', color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.8 }}>
                  {requisitos.split(',').map((req, i) => (
                    <li key={i}>{req.trim()}</li>
                  ))}
                </ul>
              </div>
            )}

            {skillsAssessment?.enabled && skillsAssessment.questions?.length > 0 && (
              <div>
                <h3 style={{ margin: '0 0 1rem 0', color: 'white', fontSize: '1.2rem', fontWeight: '700' }}>Teste de Habilidades</h3>
                <div style={{
                  padding: '1.25rem',
                  background: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  borderRadius: '14px'
                }}>
                  <p style={{ margin: '0 0 1rem 0', color: '#c7d2fe', fontWeight: '600' }}>
                    {skillsAssessment.questions.length} pergunta(s) • Nota mínima: {skillsAssessment.passingScore || 70}%
                  </p>
                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    {skillsAssessment.questions.map((question, index) => (
                      <div key={question.id || index} style={{ color: 'rgba(255, 255, 255, 0.82)' }}>
                        <strong style={{ color: 'white' }}>{index + 1}. {question.prompt}</strong>
                        <div style={{ marginTop: '0.35rem', color: '#a5b4fc', fontSize: '0.9rem' }}>
                          {Array.isArray(question.options) ? question.options.length : 0} opções
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div>
              <h3 style={{ margin: '0 0 1rem 0', color: 'white', fontSize: '1.2rem', fontWeight: '700' }}>Salário</h3>
              <p style={{ margin: 0, color: '#34d399', fontSize: '1.1rem', fontWeight: '600' }}>
                {formatCurrency(salarioDe)} — {formatCurrency(salarioAte)}
              </p>
            </div>

            {beneficios && (
              <div>
                <h3 style={{ margin: '0 0 1rem 0', color: 'white', fontSize: '1.2rem', fontWeight: '700' }}>Benefícios</h3>
                <ul style={{ paddingLeft: '1.5rem', color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.8 }}>
                  {beneficios.split(',').map((b, i) => (
                    <li key={i}>{b.trim()}</li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <h3 style={{ margin: '0 0 1rem 0', color: 'white', fontSize: '1.2rem', fontWeight: '700' }}>Período de Candidatura</h3>
              <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.8)' }}>
                {dataAbertura || 'Não informado'} até {dataFecho || 'Não informado'}
              </p>
            </div>

          </div>

          {vaga.tdrUrl && (
            <div style={{ marginTop: '2.5rem', paddingTop: '2.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <h3 style={{ margin: '0 0 1rem 0', color: 'white', fontSize: '1.2rem', fontWeight: '700' }}>Documentação (TDR)</h3>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1.5rem',
                background: 'rgba(2, 6, 23, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    background: 'rgba(34, 211, 238, 0.1)',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#22d3ee'
                  }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ color: 'white', fontWeight: '600' }}>Termos de Referência</div>
                    <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.85rem' }}>Ficheiro PDF/Documento</div>
                  </div>
                </div>
                <a
                  href={vaga.tdrUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '0.6rem 1.25rem',
                    background: 'rgba(34, 211, 238, 0.1)',
                    border: '1px solid rgba(34, 211, 238, 0.3)',
                    borderRadius: '10px',
                    color: '#22d3ee',
                    textDecoration: 'none',
                    fontSize: '0.9rem',
                    fontWeight: '700',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Visualizar TDR
                </a>
              </div>
            </div>
          )}

          {/* Botões de Ação */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            marginTop: '2rem',
            paddingTop: '2rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            flexWrap: 'wrap'
          }}>
            {vaga.status === 'active' && (
              <button
                onClick={() => alterarStatus('closed')}
                disabled={isProcessing}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'rgba(245, 158, 11, 0.2)',
                  border: '2px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: '12px',
                  color: '#fbbf24',
                  fontWeight: '700',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  fontSize: '0.95rem'
                }}
              >
                {isProcessing ? 'Processando...' : 'Fechar Vaga'}
              </button>
            )}
            {vaga.status === 'closed' && (
              <button
                onClick={() => alterarStatus('active')}
                disabled={isProcessing}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'rgba(16, 185, 129, 0.2)',
                  border: '2px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '12px',
                  color: '#34d399',
                  fontWeight: '700',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  fontSize: '0.95rem'
                }}
              >
                {isProcessing ? 'Processando...' : 'Reabrir Vaga'}
              </button>
            )}
            <button
              onClick={() => router.push(`/dashboard/admin/jobs/${vaga.id}/edit`)}
              disabled={isProcessing}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'rgba(59, 130, 246, 0.2)',
                border: '2px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '12px',
                color: '#60a5fa',
                fontWeight: '700',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                fontSize: '0.95rem'
              }}
            >
              Editar Vaga
            </button>
            <button
              onClick={eliminarVaga}
              disabled={isProcessing}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'rgba(239, 68, 68, 0.2)',
                border: '2px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '12px',
                color: '#fca5a5',
                fontWeight: '700',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                fontSize: '0.95rem',
                marginLeft: 'auto'
              }}
            >
              {isProcessing ? 'Eliminando...' : 'Eliminar Vaga'}
            </button>
          </div>
        </div>

        {/* Estatísticas das Candidaturas */}
        {candidaturas.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem'
          }}>
            <StatCard
              title="Total"
              value={candidaturas.length}
              color="#3b82f6"
            />
            <StatCard
              title="Pendentes"
              value={pendingCount}
              color="#f59e0b"
            />
            <StatCard
              title="Aprovadas"
              value={approvedCount}
              color="#10b981"
            />
            <StatCard
              title="Rejeitadas"
              value={rejectedCount}
              color="#ef4444"
            />
          </div>
        )}

        {/* Lista de Candidaturas */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '2rem'
        }}>
          <h2 style={{ margin: '0 0 1.5rem 0', color: 'white', fontSize: '1.5rem', fontWeight: '800' }}>
            Candidaturas ({candidaturas.length})
          </h2>

          {candidaturas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', color: 'white', fontSize: '1.3rem' }}>
                Nenhuma candidatura ainda
              </h3>
              <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.7)' }}>
                As candidaturas aparecerão aqui quando candidatos se inscreverem
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {candidaturas.map((c) => (
                <div key={c.id} style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  transition: 'all 0.3s ease'
                }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1 }}>
                      <Link
                        href={`/dashboard/empresa/candidato/${c.candidateId}`}
                        style={{
                          color: '#60a5fa',
                          textDecoration: 'none',
                          fontSize: '1.2rem',
                          fontWeight: '700',
                          display: 'block',
                          marginBottom: '0.5rem'
                        }}
                      >
                        {c.candidateName || 'Candidato'}
                      </Link>
                      <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                        {c.candidateEmail || ''}
                      </div>
                      {c.createdAt && (
                        <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.85rem' }}>
                          Candidatou-se em: {new Date(c.createdAt).toLocaleDateString('pt-PT', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </div>
                      )}
                      {c.skillsAssessmentResult && (
                        <div style={{ marginTop: '0.75rem', display: 'inline-flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                          <span style={{
                            padding: '0.35rem 0.75rem',
                            borderRadius: '999px',
                            background: c.skillsAssessmentResult.passed ? 'rgba(16, 185, 129, 0.16)' : 'rgba(245, 158, 11, 0.16)',
                            color: c.skillsAssessmentResult.passed ? '#6ee7b7' : '#fbbf24',
                            border: c.skillsAssessmentResult.passed ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
                            fontSize: '0.82rem',
                            fontWeight: '700'
                          }}>
                            Teste: {c.skillsAssessmentResult.score}%
                          </span>
                          <span style={{ color: '#a1a1aa', fontSize: '0.85rem' }}>
                            {c.skillsAssessmentResult.correctAnswers}/{c.skillsAssessmentResult.totalQuestions} corretas
                          </span>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      {/* Status Badge */}
                      <div style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '12px',
                        fontWeight: '700',
                        fontSize: '0.9rem',
                        background: c.status === 'approved' ? 'rgba(16, 185, 129, 0.2)' :
                          c.status === 'rejected' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                        color: c.status === 'approved' ? '#34d399' :
                          c.status === 'rejected' ? '#fca5a5' : '#fbbf24',
                        border: `2px solid ${c.status === 'approved' ? 'rgba(16, 185, 129, 0.3)' :
                          c.status === 'rejected' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                      }}>
                        {c.status === 'pending' || !c.status ? 'Pendente' :
                          c.status === 'approved' ? 'Aprovada' :
                          c.status === 'analysis' ? 'Em análise' :
                          c.status === 'interview' ? 'Entrevista' :
                            c.status === 'rejected' ? 'Rejeitada' : c.status}
                      </div>

                      {/* Ações */}
                      {(c.status === 'pending' || !c.status) && (
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                          <button
                            onClick={() => alterarStatusCandidatura(c.id, 'approved')}
                            disabled={isProcessing}
                            style={{
                              padding: '0.6rem 1.25rem',
                              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '10px',
                              fontSize: '0.9rem',
                              cursor: isProcessing ? 'not-allowed' : 'pointer',
                              fontWeight: '600',
                              transition: 'all 0.3s ease'
                            }}
                            onMouseEnter={(e) => {
                              if (!isProcessing) e.currentTarget.style.transform = 'translateY(-2px)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'translateY(0)';
                            }}
                          >
                            Aprovar
                          </button>
                          <button
                            onClick={() => alterarStatusCandidatura(c.id, 'rejected')}
                            disabled={isProcessing}
                            style={{
                              padding: '0.6rem 1.25rem',
                              background: 'rgba(239, 68, 68, 0.2)',
                              color: '#fca5a5',
                              border: '2px solid rgba(239, 68, 68, 0.3)',
                              borderRadius: '10px',
                              fontSize: '0.9rem',
                              cursor: isProcessing ? 'not-allowed' : 'pointer',
                              fontWeight: '600',
                              transition: 'all 0.3s ease'
                            }}
                            onMouseEnter={(e) => {
                              if (!isProcessing) e.currentTarget.style.transform = 'translateY(-2px)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'translateY(0)';
                            }}
                          >
                            Rejeitar
                          </button>
                        </div>
                      )}

                      {c.status === 'approved' && (
                        <button
                          onClick={() => alterarStatusCandidatura(c.id, 'rejected')}
                          disabled={isProcessing}
                          style={{
                            padding: '0.5rem 1rem',
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#fca5a5',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            cursor: isProcessing ? 'not-allowed' : 'pointer',
                            fontWeight: '600'
                          }}
                        >
                          Reverter
                        </button>
                      )}

                      {c.status === 'rejected' && (
                        <button
                          onClick={() => alterarStatusCandidatura(c.id, 'approved')}
                          disabled={isProcessing}
                          style={{
                            padding: '0.5rem 1rem',
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#34d399',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            cursor: isProcessing ? 'not-allowed' : 'pointer',
                            fontWeight: '600'
                          }}
                        >
                          Reconsiderar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>
    </>
  );
}

function StatCard({ title, value, color }) {
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '12px',
      padding: '1.5rem',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '2.5rem', fontWeight: '900', color: color, marginBottom: '0.5rem' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.95rem', color: 'white', fontWeight: '600' }}>
        {title}
      </div>
    </div>
  );
}

export async function getServerSideProps(context) {
  try {
    const { id } = context.params;
    const cookies = nookies.get(context);

    if (!cookies.token) {
      return { redirect: { destination: '/login', permanent: false } };
    }

    const token = await admin.auth().verifyIdToken(cookies.token);
    const uid = token.uid;

    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    if (!userDoc.exists || userDoc.data().userType !== 'empresa') {
      return { redirect: { destination: '/login', permanent: false } };
    }

    const vagaDoc = await admin.firestore().collection('jobs').doc(id).get();
    if (!vagaDoc.exists) {
      return { notFound: true };
    }

    const vagaData = vagaDoc.data();

    // Verificar se a vaga pertence à empresa
    if (vagaData.companyId !== uid) {
      return { redirect: { destination: '/dashboard/empresa', permanent: false } };
    }

    const vaga = {
      id: vagaDoc.id,
      titulo: vagaData.titulo || '',
      descricao: vagaData.descricao || '',
      requisitos: vagaData.requisitos || '',
      localizacao: vagaData.localizacao || '',
      tipoContrato: vagaData.tipoContrato || '',
      salarioDe: vagaData.salarioDe || '',
      salarioAte: vagaData.salarioAte || '',
      beneficios: vagaData.beneficios || '',
      dataAbertura: vagaData.dataAbertura || '',
      dataFecho: vagaData.dataFecho || '',
      isPrivada: vagaData.isPrivada || false,
      status: vagaData.status || 'active',
      skillsAssessment: vagaData.skillsAssessment || null,
      companyId: vagaData.companyId || '',
      tdrUrl: vagaData.tdrUrl || vagaData.tdr || vagaData.tdrLink || vagaData.tdrPdf || '',
      createdAt: safeTimestampToMillis(vagaData.createdAt) ? new Date(safeTimestampToMillis(vagaData.createdAt)).toISOString() : null
    };

    // Buscar candidaturas
    const candidaturasSnap = await admin.firestore()
      .collection('applications')
      .where('jobId', '==', id)
      .get();

    const candidaturas = candidaturasSnap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        candidateId: data.candidateId || '',
        candidateName: data.candidateName || '',
        candidateEmail: data.candidateEmail || '',
        status: data.status || 'pending',
        skillsAssessmentResult: data.skillsAssessmentResult || null,
        createdAt: safeTimestampToMillis(data.createdAt) ? new Date(safeTimestampToMillis(data.createdAt)).toISOString() : null,
        updatedAt: safeTimestampToMillis(data.updatedAt) ? new Date(safeTimestampToMillis(data.updatedAt)).toISOString() : null
      };
    });

    // Ordenar por data
    candidaturas.sort((a, b) => {
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return {
      props: { vaga, candidaturas },
    };
  } catch (error) {
    console.error('Erro no getServerSideProps:', error);
    return { redirect: { destination: '/login', permanent: false } };
  }
} 
