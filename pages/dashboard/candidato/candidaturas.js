import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import LandingHeader from '../../../components/LandingHeader';
import { downloadInterviewICS, formatMaybeDateTimePt, getInterviewStatusLabelPt, isLikelyUrl } from '../../../lib/interviewClient';

export default function CandidaturasPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState([]);
  const [filter, setFilter] = useState('all'); // all, pending, approved, rejected

  const setFilterAndSyncUrl = (nextFilter) => {
    setFilter(nextFilter);
    if (!router.isReady) return;
    const query = { ...router.query };
    if (nextFilter && nextFilter !== 'all') query.filter = nextFilter;
    else delete query.filter;
    router.replace({ pathname: router.pathname, query }, undefined, { shallow: true });
  };

  useEffect(() => {
    if (!router.isReady) return;
    const q = router.query.filter;
    if (typeof q !== 'string') return;
    const allowed = ['all', 'pending', 'interview', 'approved', 'rejected'];
    if (allowed.includes(q)) {
      setFilter(q);
    }
  }, [router.isReady, router.query.filter]);

  useEffect(() => {
    async function fetchApplications() {
      try {
        const { getAuth } = await import('firebase/auth');
        const auth = getAuth();
        const currentUser = auth.currentUser;
        const uid = currentUser?.uid;
        
        if (!uid) {
          router.push('/login');
          return;
        }
        
        const token = await currentUser.getIdToken();
        const res = await fetch(`/api/profile?uid=${uid}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        
        const json = await res.json();
        setApplications(json.applications || []);
        setLoading(false);
      } catch (err) {
        console.error('Erro ao carregar candidaturas:', err);
        setLoading(false);
      }
    }
    fetchApplications();
  }, [router]);

  const hasValidScheduledInterview = (app) => {
    const scheduledAt = app?.interviewDetails?.scheduledAt;
    if (!scheduledAt) return false;
    const t = new Date(scheduledAt).getTime();
    return !Number.isNaN(t);
  };

  const sortedApplications = [...applications].sort((a, b) => {
    const ta = a?.appliedAt ? new Date(a.appliedAt).getTime() : (a?.createdAt ? new Date(a.createdAt).getTime() : 0);
    const tb = b?.appliedAt ? new Date(b.appliedAt).getTime() : (b?.createdAt ? new Date(b.createdAt).getTime() : 0);
    return tb - ta;
  });

  const filteredApplications = sortedApplications.filter((app) => {
    if (filter === 'all') return true;
    if (filter === 'interview') return hasValidScheduledInterview(app);
    if (filter === 'pending') return app.status === 'pending' || !app.status;
    return app.status === filter;
  });

  const stats = {
    total: applications.length,
    pending: applications.filter(a => a.status === 'pending' || !a.status).length,
    interview: applications.filter((a) => hasValidScheduledInterview(a)).length,
    approved: applications.filter(a => a.status === 'approved').length,
    rejected: applications.filter(a => a.status === 'rejected').length
  };

  if (loading) {
	  return (
	    <>
        <Head>
          <title>Minhas Candidaturas - EmpregoSTP</title>
          <style>{`
            body {
              background: linear-gradient(180deg, #0a0e1a 0%, #1a1f35 100%);
              min-height: 100vh;
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
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
          <p style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '1.1rem' }}>Carregando candidaturas...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Minhas Candidaturas - EmpregoSTP</title>
        <style>{`
          body {
            background: linear-gradient(180deg, #0a0e1a 0%, #1a1f35 100%);
            min-height: 100vh;
          }
        `}</style>
      </Head>
	      <LandingHeader />

	      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem', minHeight: '100vh' }}>
	        {/*
	          Special-case: when user opens `?filter=interview`, treat it as a dedicated
	          "interviews view" (hide other status summary cards).
	        */}
	        {(() => {
	          const isInterviewView = filter === 'interview';
	          return (
	            <>
	        
	        {/* Header */}
	        <div style={{ marginBottom: '2rem' }}>
	          <Link href="/dashboard/candidato" style={{
	            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: '#60a5fa',
            textDecoration: 'none',
            fontWeight: '600',
            marginBottom: '1rem'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
	            </svg>
	            Voltar ao Dashboard
	          </Link>
	          <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2.5rem', color: 'white', fontWeight: '900' }}>
	            {isInterviewView ? 'Minhas Entrevistas' : 'Minhas Candidaturas'}
	          </h1>
	          <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.7)', fontSize: '1.05rem' }}>
	            {isInterviewView
	              ? 'Veja data, local e link das entrevistas agendadas.'
	              : 'Acompanhe todas as suas inscrições e status'}
	          </p>
	        </div>

	        {!isInterviewView ? (
	          <div style={{
	            display: 'grid',
	            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
	            gap: '1.5rem',
	            marginBottom: '2rem'
	          }}>
	            <StatCard
	              value={stats.total}
	              label="Total"
	              color="#3b82f6"
	              active={filter === 'all'}
	              onClick={() => setFilterAndSyncUrl('all')}
	            />
	            <StatCard
	              value={stats.pending}
	              label="Pendentes"
	              color="#f59e0b"
	              active={filter === 'pending'}
	              onClick={() => setFilterAndSyncUrl('pending')}
	            />
	            <StatCard
	              value={stats.interview}
	              label="Entrevistas"
	              color="#8b5cf6"
	              active={filter === 'interview'}
	              onClick={() => setFilterAndSyncUrl('interview')}
	            />
	            <StatCard
	              value={stats.approved}
	              label="Aprovadas"
	              color="#10b981"
	              active={filter === 'approved'}
	              onClick={() => setFilterAndSyncUrl('approved')}
	            />
	            <StatCard
	              value={stats.rejected}
	              label="Rejeitadas"
	              color="#ef4444"
	              active={filter === 'rejected'}
	              onClick={() => setFilterAndSyncUrl('rejected')}
	            />
	          </div>
	        ) : (
	          <div style={{
	            display: 'flex',
	            alignItems: 'center',
	            justifyContent: 'space-between',
	            flexWrap: 'wrap',
	            gap: '1rem',
	            marginBottom: '2rem',
	            padding: '1rem 1.25rem',
	            background: 'rgba(255, 255, 255, 0.05)',
	            border: '1px solid rgba(255, 255, 255, 0.10)',
	            borderRadius: '16px'
	          }}>
	            <div style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 800 }}>
	              Entrevistas agendadas: <span style={{ color: '#a78bfa' }}>{stats.interview}</span>
	            </div>
	            <Link href="/dashboard/candidato/candidaturas" style={{
	              padding: '0.65rem 0.95rem',
	              borderRadius: '12px',
	              border: '1px solid rgba(196, 181, 253, 0.25)',
	              background: 'rgba(196, 181, 253, 0.10)',
	              color: '#ddd6fe',
	              textDecoration: 'none',
	              fontWeight: 800
	            }}>
	              Ver todas as candidaturas
	            </Link>
	          </div>
	        )}

	        {/* Lista de Candidaturas */}
	        {filteredApplications.length > 0 ? (
	          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
	            {filteredApplications.map((application, index) => (
	              <ApplicationDetailCard key={application.id || index} application={application} />
	            ))}
	          </div>
	        ) : (
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '20px',
            padding: '4rem 2rem',
            textAlign: 'center'
          }}>
            <h3 style={{ margin: '0 0 0.75rem 0', color: 'white', fontSize: '1.5rem', fontWeight: '700' }}>
              {filter === 'all'
                ? 'Nenhuma candidatura ainda'
                : `Nenhuma candidatura ${
                    filter === 'pending'
                      ? 'pendente'
                      : filter === 'interview'
                        ? 'com entrevista'
                        : filter === 'approved'
                          ? 'aprovada'
                          : filter === 'rejected'
                            ? 'rejeitada'
                            : ''
                  }`}
            </h3>
            <p style={{ margin: '0 0 2rem 0', color: 'rgba(255, 255, 255, 0.7)', fontSize: '1rem' }}>
              {filter === 'all' 
                ? 'Comece a se candidatar para vagas que combinam com você' 
                : 'Tente mudar o filtro para ver outras candidaturas'}
            </p>
            {filter === 'all' && (
              <Link href="/vagas" style={{
                display: 'inline-block',
                padding: '1rem 2rem',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '12px',
                fontWeight: '700',
                boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)'
              }}>
                Buscar Vagas
              </Link>
            )}
          </div>
	        )}

	            </>
	          );
	        })()}
	      </div>
	    </>
	  );
	}

function StatCard({ value, label, color, active, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: active ? `${color}20` : 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(10px)',
        border: active ? `2px solid ${color}` : '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        padding: '1.5rem',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.3s ease'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = `0 10px 30px ${color}40`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ fontSize: '2rem', fontWeight: '900', color: color, marginBottom: '0.25rem' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.9rem', color: 'white', fontWeight: '600' }}>
        {label}
      </div>
    </div>
  );
}

function ApplicationDetailCard({ application }) {
  const getStatusInfo = (status) => {
    switch (status) {
      case 'approved':
        return { 
          bg: 'rgba(16, 185, 129, 0.15)', 
          border: 'rgba(16, 185, 129, 0.3)',
          color: '#10b981', 
          text: 'Aprovada'
        };
      case 'analysis':
        return {
          bg: 'rgba(59, 130, 246, 0.15)',
          border: 'rgba(59, 130, 246, 0.3)',
          color: '#60a5fa',
          text: 'Em análise'
        };
      case 'interview':
        return {
          bg: 'rgba(139, 92, 246, 0.15)',
          border: 'rgba(139, 92, 246, 0.3)',
          color: '#a78bfa',
          text: 'Entrevista'
        };
      case 'rejected':
        return { 
          bg: 'rgba(239, 68, 68, 0.15)', 
          border: 'rgba(239, 68, 68, 0.3)',
          color: '#ef4444', 
          text: 'Rejeitada'
        };
      default:
        return { 
          bg: 'rgba(245, 158, 11, 0.15)', 
          border: 'rgba(245, 158, 11, 0.3)',
          color: '#f59e0b', 
          text: 'Pendente'
        };
    }
  };

  const statusInfo = getStatusInfo(application.status);
  const assessment = application.skillsAssessmentResult;
  const [interviewActionLoading, setInterviewActionLoading] = useState(false);
  const [interviewError, setInterviewError] = useState('');
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [localInterview, setLocalInterview] = useState(application.interviewDetails || null);

  useEffect(() => {
    setLocalInterview(application.interviewDetails || null);
  }, [application.interviewDetails]);

  const interviewStatus = String(localInterview?.status || 'scheduled').toLowerCase();
  const hasInterview = Boolean(localInterview?.scheduledAt);

  const interviewStatusLabel = getInterviewStatusLabelPt(interviewStatus);

  const handleConfirmInterview = async () => {
    if (!application.id || !hasInterview || interviewActionLoading) return;
    setInterviewError('');
    setInterviewActionLoading(true);
    try {
      const { getAuth } = await import('firebase/auth');
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Não autenticado');

      const res = await fetch(`/api/applications/${application.id}/interview-response`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'confirm' })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Não foi possível confirmar.');
      setLocalInterview(data.interviewDetails || localInterview);
    } catch (err) {
      setInterviewError(err.message || 'Erro ao confirmar.');
    } finally {
      setInterviewActionLoading(false);
    }
  };

  const handleRequestReschedule = async () => {
    if (!application.id || !hasInterview || interviewActionLoading) return;
    const trimmed = String(rescheduleReason || '').trim();
    if (trimmed.length < 5) {
      setInterviewError('Informe um motivo curto (mín. 5 caracteres).');
      return;
    }
    setInterviewError('');
    setInterviewActionLoading(true);
    try {
      const { getAuth } = await import('firebase/auth');
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Não autenticado');

      const res = await fetch(`/api/applications/${application.id}/interview-response`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'request_reschedule', reason: trimmed })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Não foi possível solicitar reagendamento.');
      setLocalInterview(data.interviewDetails || localInterview);
      setRescheduleOpen(false);
      setRescheduleReason('');
    } catch (err) {
      setInterviewError(err.message || 'Erro ao solicitar.');
    } finally {
      setInterviewActionLoading(false);
    }
  };

  const handleDownloadICS = async () => {
    if (!application.id || !hasInterview) return;
    setInterviewError('');
    try {
      await downloadInterviewICS(application.id);
    } catch (err) {
      setInterviewError(err.message || 'Erro ao baixar calendário.');
    }
  };

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '16px',
      padding: '2rem',
      transition: 'all 0.3s ease'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.borderColor = statusInfo.color;
      e.currentTarget.style.boxShadow = `0 10px 30px ${statusInfo.color}30`;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
      e.currentTarget.style.boxShadow = 'none';
    }}>
      
      {/* Header da Candidatura */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem', color: 'white', fontWeight: '800' }}>
            {application.jobTitle}
          </h3>
          {application.company && (
            <p style={{ margin: '0', color: 'rgba(255, 255, 255, 0.8)', fontSize: '1rem' }}>
              {application.company}
            </p>
          )}
        </div>
        <div style={{
          padding: '0.75rem 1.5rem',
          background: statusInfo.bg,
          border: `2px solid ${statusInfo.border}`,
          borderRadius: '12px',
          color: statusInfo.color,
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          whiteSpace: 'nowrap'
        }}>
          <span>{statusInfo.text}</span>
        </div>
      </div>

      {/* Informações da Candidatura */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '1.5rem',
        marginBottom: '1.5rem'
      }}>
        {application.appliedAt && (
          <InfoItem 
            label="Data de Candidatura"
            value={new Date(application.appliedAt).toLocaleDateString('pt-PT', {
              day: '2-digit',
              month: 'long',
              year: 'numeric'
            })}
          />
        )}
        {application.jobLocation && (
          <InfoItem 
            label="Localização"
            value={application.jobLocation}
          />
        )}
        {application.jobType && (
          <InfoItem 
            label="Tipo de Contrato"
            value={application.jobType}
          />
        )}
      </div>

      {assessment && typeof assessment.score === 'number' && (
        <div style={{
          marginBottom: '1.5rem',
          padding: '1rem 1.25rem',
          background: 'rgba(59, 130, 246, 0.10)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          borderRadius: '14px'
        }}>
          <h4 style={{ margin: '0 0 1rem 0', color: '#bfdbfe', fontSize: '1rem', fontWeight: '700' }}>
            Teste de habilidades
          </h4>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem'
          }}>
            <InfoItem
              label="Pontuação"
              value={`${assessment.score}%`}
            />
            <InfoItem
              label="Resultado"
              value={`${assessment.correctAnswers ?? 0}/${assessment.totalQuestions ?? 0} ${assessment.passed ? '(Aprovado)' : '(Não aprovado)'}`}
            />
          </div>
        </div>
      )}

      {hasInterview && (
        <div style={{
          marginBottom: '1.5rem',
          padding: '1rem 1.25rem',
          background: 'rgba(139, 92, 246, 0.12)',
          border: '1px solid rgba(139, 92, 246, 0.28)',
          borderRadius: '14px'
        }}>
          <h4 style={{ margin: '0 0 1rem 0', color: '#e9d5ff', fontSize: '1rem', fontWeight: '700' }}>
            Detalhes da entrevista
          </h4>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '999px',
              border: '1px solid rgba(233, 213, 255, 0.25)',
              background: 'rgba(233, 213, 255, 0.10)',
              color: '#e9d5ff',
              fontSize: '0.85rem',
              fontWeight: 700
            }}>
              {interviewStatusLabel}
            </span>
            <button
              type="button"
              onClick={handleDownloadICS}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '10px',
                border: '1px solid rgba(196, 181, 253, 0.35)',
                background: 'rgba(196, 181, 253, 0.12)',
                color: '#ddd6fe',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.85rem'
              }}
            >
              Adicionar ao calendário
            </button>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem'
          }}>
            <InfoItem
              label="Data e hora"
              value={formatMaybeDateTimePt(localInterview.scheduledAt)}
            />
            <InfoItem
              label={localInterview.mode === 'presencial' ? 'Local' : 'Link'}
              value={
                localInterview.mode === 'presencial'
                  ? localInterview.location || 'Local a confirmar'
                  : localInterview.link
                    ? (isLikelyUrl(localInterview.link)
                        ? (
                            <a
                              href={localInterview.link}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: '#c4b5fd', textDecoration: 'underline' }}
                            >
                              {localInterview.link}
                            </a>
                          )
                        : localInterview.link)
                    : 'Link a confirmar'
              }
            />
          </div>
          {localInterview.notes && (
            <div style={{
              marginTop: '1rem',
              color: 'rgba(255, 255, 255, 0.82)',
              fontSize: '0.95rem',
              lineHeight: 1.6
            }}>
              {localInterview.notes}
            </div>
          )}

          {interviewError && (
            <div style={{ marginTop: '1rem', color: '#fecaca', fontWeight: 700, fontSize: '0.9rem' }}>
              {interviewError}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={handleConfirmInterview}
              disabled={interviewActionLoading || interviewStatus === 'confirmed'}
              style={{
                padding: '0.7rem 1rem',
                borderRadius: '12px',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                background: interviewStatus === 'confirmed' ? 'rgba(148, 163, 184, 0.18)' : 'rgba(16, 185, 129, 0.12)',
                color: interviewStatus === 'confirmed' ? '#cbd5e1' : '#6ee7b7',
                cursor: interviewStatus === 'confirmed' ? 'not-allowed' : 'pointer',
                fontWeight: 800
              }}
            >
              {interviewActionLoading ? 'A processar...' : interviewStatus === 'confirmed' ? 'Presença confirmada' : 'Confirmar presença'}
            </button>
            <button
              type="button"
              onClick={() => setRescheduleOpen((v) => !v)}
              disabled={interviewActionLoading}
              style={{
                padding: '0.7rem 1rem',
                borderRadius: '12px',
                border: '1px solid rgba(251, 191, 36, 0.35)',
                background: 'rgba(251, 191, 36, 0.10)',
                color: '#fde68a',
                cursor: 'pointer',
                fontWeight: 800
              }}
            >
              Pedir reagendamento
            </button>
          </div>

          {rescheduleOpen && (
            <div style={{ marginTop: '1rem' }}>
              <textarea
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
                placeholder="Explique o motivo e sugira horários alternativos (opcional)."
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.9rem',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.06)',
                  color: 'white',
                  resize: 'vertical'
                }}
              />
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleRequestReschedule}
                  disabled={interviewActionLoading}
                  style={{
                    padding: '0.7rem 1rem',
                    borderRadius: '12px',
                    border: '1px solid rgba(139, 92, 246, 0.35)',
                    background: 'rgba(139, 92, 246, 0.16)',
                    color: '#ddd6fe',
                    cursor: 'pointer',
                    fontWeight: 800
                  }}
                >
                  {interviewActionLoading ? 'A enviar...' : 'Enviar pedido'}
                </button>
                <button
                  type="button"
                  onClick={() => { setRescheduleOpen(false); setRescheduleReason(''); setInterviewError(''); }}
                  disabled={interviewActionLoading}
                  style={{
                    padding: '0.7rem 1rem',
                    borderRadius: '12px',
                    border: '1px solid rgba(148,163,184,0.25)',
                    background: 'rgba(148,163,184,0.10)',
                    color: '#cbd5e1',
                    cursor: 'pointer',
                    fontWeight: 800
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
      {application.timeline && application.timeline.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ margin: '0 0 1rem 0', color: 'white', fontSize: '1.1rem', fontWeight: '700' }}>
            Histórico
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {application.timeline.map((event, index) => (
              <div key={index} style={{
                display: 'flex',
                gap: '1rem',
                padding: '1rem',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '10px',
                borderLeft: `3px solid ${statusInfo.color}`
              }}>
                <div style={{ width: '10px', marginTop: '0.3rem' }}>
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '999px', background: statusInfo.color, opacity: 0.9 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'white', fontWeight: '600', marginBottom: '0.25rem' }}>
                    {event.title}
                  </div>
                  <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.9rem' }}>
                    {event.description}
                  </div>
                  <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                    {new Date(event.date).toLocaleString('pt-PT')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ações */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', paddingTop: '1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
        {application.jobId && (
          <Link href={`/vaga/${application.jobId}`} style={{
            padding: '0.75rem 1.5rem',
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            border: 'none',
            borderRadius: '12px',
            color: 'white',
            textDecoration: 'none',
            fontWeight: '700',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)'
          }}>
            Ver Vaga
          </Link>
        )}
      </div>
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div>
      <div style={{ 
        color: 'rgba(255, 255, 255, 0.6)', 
        fontSize: '0.85rem', 
        marginBottom: '0.25rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <span>{label}</span>
      </div>
      <div style={{ color: 'white', fontSize: '1rem', fontWeight: '600' }}>
        {value}
      </div>
    </div>
  );
}
