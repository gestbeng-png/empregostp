// pages/vaga/[id].js
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { useState, useEffect, useMemo } from 'react';
import { getAuth } from 'firebase/auth';
import { useRouter } from 'next/router';
import {
  FiArrowLeft,
  FiMapPin,
  FiClock,
  FiBriefcase,
  FiDollarSign,
  FiCheckCircle,
  FiCalendar,
  FiShield,
  FiZap,
  FiChevronRight,
  FiShare2,
  FiBookmark,
  FiFileText,
  FiDownload
} from 'react-icons/fi';
import { HiOutlineBuildingOffice2 } from 'react-icons/hi2';
import Badge from '../../components/Badge';
import UpgradeModal from '../../components/UpgradeModal';
import { getPublicSkillsAssessment } from '../../lib/skillsAssessment';

export default function VagaDetalhe({ vaga }) {
  const router = useRouter();
  const { user } = useAuth();
  const [applyStatus, setApplyStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [userType, setUserType] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [upgradeModal, setUpgradeModal] = useState({ open: false, message: '' });
  const [assessmentAnswers, setAssessmentAnswers] = useState([]);
  const assessmentQuestions = useMemo(() => vaga?.skillsAssessment?.questions || [], [vaga?.skillsAssessment?.questions]);
  const assessmentQuestionCount = assessmentQuestions.length;

  useEffect(() => {
    setAssessmentAnswers(new Array(assessmentQuestions.length).fill(null));
  }, [vaga?.id, assessmentQuestionCount, assessmentQuestions]);

  useEffect(() => {
    async function trackView() {
      if (!vaga?.id) return;

      try {
        await fetch('/api/track-view', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            jobId: vaga.id,
            userId: user?.uid || null,
            source: 'job-detail'
          })
        });
      } catch (err) {
        console.error('Erro ao registrar visualização:', err);
      }
    }

    trackView();
  }, [vaga?.id, user?.uid]);

  useEffect(() => {
    async function checkExisting() {
      if (!user) return;
      try {
        const auth = getAuth();
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;
        const res = await fetch(`/api/applications?jobId=${vaga.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.applications && data.applications.length > 0) {
            setApplyStatus('success');
          }
        }
      } catch (e) {
        // ignore
      }
    }
    checkExisting();
  }, [user, vaga?.id]);

  useEffect(() => {
    async function loadProfile() {
      if (!user) {
        setUserType(null);
        return;
      }
      try {
        const auth = getAuth();
        const token = await auth.currentUser?.getIdToken();
        if (!token) {
          setUserType(null);
          return;
        }

        const res = await fetch('/api/profile', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setUserType(data?.profile?.data?.userType || null);
        } else {
          setUserType(null);
        }
      } catch (e) {
        setUserType(null);
      }
    }
    loadProfile();
  }, [user]);

  useEffect(() => {
    async function loadSavedJobs() {
      if (!user) return;
      try {
        const auth = getAuth();
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;
        const response = await fetch('/api/saved-jobs', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          const ids = data.savedJobs?.map((job) => job.id) || [];
          setIsSaved(ids.includes(vaga.id));
        }
      } catch (err) {
        console.error('Erro ao carregar vagas salvas:', err);
      }
    }
    loadSavedJobs();
  }, [user, vaga?.id]);

  // Define helper functions first (can be called in any render)
  const formatCurrency = (value) => {
    if (!value) return '';
    return Number(value).toLocaleString('pt-ST', { style: 'currency', currency: 'STN' });
  };

  const formatDate = (value) => {
    if (!value) return 'Não informado';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Initialize Hooks early, before any conditional renders
  const salaryRange = useMemo(() => {
    if (!vaga) return 'A combinar';
    const { salarioDe, salarioAte } = vaga;
    if (!salarioDe && !salarioAte) return 'A combinar';
    const start = salarioDe ? formatCurrency(salarioDe) : '';
    const end = salarioAte ? formatCurrency(salarioAte) : '';
    if (start && end) return `${start} - ${end}`;
    return start || end || 'A combinar';
  }, [vaga]);

  const postedAtLabel = useMemo(() => {
    if (!vaga) return 'Publicado recentemente';
    const { publicadoEm, createdAt, dataAbertura, dataFecho } = vaga;
    const raw = publicadoEm || createdAt || dataAbertura || dataFecho;
    if (!raw) return 'Publicado recentemente';
    return formatDate(raw);
  }, [vaga]);

  if (!vaga) {
    return (
      <main style={{ maxWidth: 800, margin: '2rem auto', padding: '0 1.5rem' }}>
        <h2>Vaga não encontrada</h2>
        <Link href="/">Voltar</Link>
      </main>
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
    status,
    publicadoEm,
    createdAt,
    destaque
  } = vaga;

  const companyLabel = vaga.empresaNome || vaga.companyName || vaga.empresa || 'Empresa';
  const resolveUrl = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
      return resolveUrl(value[0]);
    }
    if (typeof value === 'object') {
      // Try common fields first
      const common = value.url || value.downloadURL || value.link || value.href || value.path || value.fullPath;
      if (typeof common === 'string') return common;

      // Scan for any string that looks like a URL/Path
      for (const k in value) {
        if (typeof value[k] === 'string' && (value[k].startsWith('http') || value[k].startsWith('/'))) {
          return value[k];
        }
      }
    }
    return '';
  };

  const tdrUrl = resolveUrl(
    vaga.tdrUrl ||
    vaga.tdrURL ||
    vaga.tdr_url ||
    vaga.tdr ||
    vaga.termosReferenciaUrl ||
    vaga.termosReferencia ||
    vaga.tdrLink ||
    vaga.tdrPdf ||
    vaga.tdrFile ||
    vaga.tdrArquivo ||
    vaga.documentoTdr ||
    vaga.termosReferenciaArquivo ||
    vaga.ficheiroTdr
  );

  const salaryMain = salaryRange.split(' - ')[0] || salaryRange;

  const getContractTypeLabel = () => {
    const types = {
      'full-time': 'Tempo Integral',
      'part-time': 'Meio Período',
      contract: 'Contrato',
      internship: 'Estágio',
      freelance: 'Freelance',
      estagio: 'Estágio',
      contrato: 'Contrato'
    };
    return types[tipoContrato?.toLowerCase()] || tipoContrato || 'Não especificado';
  };

  const parseList = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === 'string') {
      return value
        .split(/\n|,|;/g)
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [];
  };

  const requirementsList = parseList(requisitos);
  const benefitsList = parseList(beneficios);

  const fallbackRequirements = [
    'Experiência mínima de 3-5 anos na função específica.',
    'Conhecimento profundo de materiais e ferramentas locais.',
    'Capacidade de interpretar plantas e desenhos técnicos.',
    'Forte ética de trabalho e compromisso com prazos.',
    'Residência em São Tomé ou disponibilidade para deslocação.'
  ];

  const benefitsToShow = benefitsList.length
    ? benefitsList.map((benefit) => ({
      title: benefit,
      desc: 'Benefício oferecido pela empresa.',
      icon: <FiZap size={18} />
    }))
    : [
      {
        title: 'Salário Competitivo',
        desc: 'Pagamentos acima da média de mercado.',
        icon: <FiDollarSign size={18} />
      },
      {
        title: 'Bónus por Performance',
        desc: 'Prêmios por metas atingidas.',
        icon: <FiZap size={18} />
      }
    ];

  const publicAssessment = vaga?.skillsAssessment?.enabled ? vaga.skillsAssessment : null;
  const assessmentComplete = !publicAssessment || assessmentAnswers.length === publicAssessment.questions.length && assessmentAnswers.every((answer) => Number.isInteger(answer));

  const statusLabel = (() => {
    const normalized = (status || '').toLowerCase();
    if (!normalized || normalized === 'active' || normalized === 'open') return 'Aberta';
    if (normalized === 'closed') return 'Fechada';
    if (normalized === 'disabled' || normalized === 'inactive') return 'Desativada';
    if (normalized === 'draft') return 'Rascunho';
    return status;
  })();

  const remoteLabel = typeof vaga.remoto === 'boolean' ? (vaga.remoto ? 'Remoto' : 'Presencial') : 'Não informado';

  const details = [
    { label: 'Empresa', value: companyLabel },
    { label: 'Localização', value: localizacao || 'Não informado' },
    { label: 'Tipo de Contrato', value: getContractTypeLabel() },
    { label: 'Regime', value: remoteLabel },
    { label: 'Jornada', value: vaga.jornada || vaga.jornadaTrabalho || 'Full-time' },
    { label: 'Status', value: statusLabel },
    { label: 'Publicado em', value: formatDate(publicadoEm || createdAt) },
    { label: 'Abertura', value: formatDate(dataAbertura) },
    { label: 'Encerramento', value: formatDate(dataFecho) },
    { label: 'Vagas disponíveis', value: vaga.numeroVagas || vaga.qtdVagas || vaga.quantidadeVagas || 'Não informado' },
    { label: 'Área/Setor', value: vaga.categoria || vaga.area || vaga.setor || vaga.department || 'Não informado' },
    { label: 'Nível de experiência', value: vaga.nivelExperiencia || vaga.experiencia || 'Não informado' },
    { label: 'Escolaridade', value: vaga.escolaridade || 'Não informado' }
  ];

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/vaga/${vaga.id}` : '';
  const shareText = `Confira esta vaga: ${titulo}`;

  const handleShare = () => {
    if (!shareUrl) return;
    if (navigator.share) {
      navigator
        .share({
          title: titulo,
          text: shareText,
          url: shareUrl
        })
        .catch((shareError) => {
          if (shareError?.name === 'AbortError') return;
          console.error('Erro ao compartilhar:', shareError);
        });
      return;
    }

    try {
      navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      alert('Link copiado! Cole onde quiser compartilhar.');
    } catch (clipboardError) {
      alert(`Não foi possível compartilhar automaticamente. Copie o link manualmente: ${shareUrl}`);
    }
  };

  const handleToggleSave = async () => {
    if (saving) return;
    setSaving(true);

    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;

      if (!currentUser) {
        window.location.href = `/login?redirect=/vaga/${vaga.id}`;
        return;
      }

      const token = await currentUser.getIdToken();
      const method = isSaved ? 'DELETE' : 'POST';

      const response = await fetch('/api/saved-jobs', {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ jobId: vaga.id })
      });

      if (response.ok) {
        setIsSaved(!isSaved);
        return;
      }

      let errorData = {};
      try {
        errorData = await response.json();
      } catch (_) {
        // ignore parse errors
      }

      const shouldShowUpgrade =
        errorData.code === 'SAVED_JOBS_LIMIT_REACHED' ||
        errorData.code === 'FEATURE_PRO_ONLY' ||
        Boolean(errorData.upgradeMessage);

      if (shouldShowUpgrade) {
        setUpgradeModal({
          open: true,
          message: errorData.upgradeMessage || errorData.error || 'Faça upgrade para salvar mais vagas.',
          userType: 'candidato'
        });
        return;
      }

      alert(errorData.error || 'Erro ao salvar vaga');
    } catch (err) {
      console.error('Erro ao salvar vaga:', err);
      alert('Erro ao salvar vaga. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleApply = async () => {
    if (!user) {
      window.location.href = `/login?redirect=/vaga/${vaga.id}`;
      return;
    }
    if (userType && userType !== 'candidato') {
      setErrorMsg('O seu perfil atual não pode candidatar a esta vaga. Entre com uma conta de candidato.');
      setApplyStatus('error');
      return;
    }
    try {
      setApplyStatus('loading');
      setErrorMsg('');

      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();

      if (!token) {
        window.location.href = `/login?redirect=/vaga/${vaga.id}`;
        return;
      }

      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ jobId: vaga.id, assessmentAnswers })
      });

      if (res.status === 409) {
        setApplyStatus('success');
        return;
      }

      if (!res.ok) {
        let friendly = 'Erro ao enviar candidatura';
        try {
          const data = await res.json();
          if (res.status === 403 && (data.code === 'APPLICATION_LIMIT_REACHED' || data.code === 'FEATURED_JOB_RESTRICTED')) {
            setUpgradeModal({
              open: true,
              message: data.upgradeMessage || data.error || 'Faça upgrade para continuar!'
            });
            setApplyStatus('idle');
            return;
          }
          friendly = data?.error || friendly;
        } catch (_) { }
        setErrorMsg(friendly);
        setApplyStatus('error');
        return;
      }

      setApplyStatus('success');
    } catch (err) {
      console.warn('Erro ao candidatar:', err?.message || err);
      setErrorMsg(err?.message || 'Erro ao candidatar-se.');
      setApplyStatus('error');
    }
  };

  const isOpen = status === 'active' || status === 'open' || !status;
  const isApplying = applyStatus === 'loading';
  const isApplied = applyStatus === 'success';
  const isBlocked = Boolean(userType && userType !== 'candidato');
  const applyDisabled = !isOpen || isApplying || isApplied || isBlocked || !assessmentComplete;
  const badgeStatus = destaque ? 'urgent' : status;

  return (
    <>
      <UpgradeModal
        isOpen={upgradeModal.open}
        onClose={() => setUpgradeModal({ open: false, message: '' })}
        message={upgradeModal.message}
        upgradeUrl="/premium/candidatos"
        userType="candidato"
      />
      <Head>
        <title>{titulo} - EmpregoSTP</title>
        <meta name="description" content={`${descricao?.substring(0, 160) || `Vaga de ${titulo} em ${localizacao}`}...`} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={shareUrl} />
        <meta property="og:title" content={`${titulo} - EmpregoSTP`} />
        <meta property="og:description" content={`${descricao?.substring(0, 200) || `Vaga de ${titulo} em ${localizacao}. ${tipoContrato}. Candidate-se agora!`}`} />
        <meta property="og:image" content={`${typeof window !== 'undefined' ? window.location.origin : ''}/assets/Emprego STP Logo (2) 1.png`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="EmpregoSTP" />
        <meta property="og:locale" content="pt_PT" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content={shareUrl} />
        <meta name="twitter:title" content={`${titulo} - EmpregoSTP`} />
        <meta name="twitter:description" content={`${descricao?.substring(0, 200) || `Vaga de ${titulo} em ${localizacao}`}`} />
        <meta name="twitter:image" content={`${typeof window !== 'undefined' ? window.location.origin : ''}/assets/Emprego STP Logo (2) 1.png`} />
        <style>{`
          body {
            background: #020617;
            min-height: 100vh;
          }
        `}</style>
      </Head>

      <style jsx>{`
        .job-details {
          min-height: 100vh;
          background: #020617;
          color: #e2e8f0;
          animation: fadeIn 0.5s ease;
        }
        .sticky-header {
          position: sticky;
          top: 0;
          z-index: 40;
          background: rgba(2, 6, 23, 0.85);
          border-bottom: 1px solid rgba(51, 65, 85, 0.6);
          backdrop-filter: blur(12px);
        }
        .header-inner {
          max-width: 1080px;
          margin: 0 auto;
          padding: 1rem 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .back-button {
          display: inline-flex;
          align-items: center;
          gap: 0.75rem;
          color: rgba(148, 163, 184, 0.9);
          font-weight: 700;
          font-size: 0.9rem;
          transition: color 0.3s ease;
        }
        .back-button:hover {
          color: #fff;
        }
        .back-icon {
          width: 40px;
          height: 40px;
          border-radius: 14px;
          background: rgba(15, 23, 42, 0.9);
          border: 1px solid rgba(30, 41, 59, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .header-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .header-btn {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          border: 1px solid rgba(30, 41, 59, 0.8);
          background: rgba(15, 23, 42, 0.8);
          color: rgba(148, 163, 184, 0.9);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
        }
        .header-btn:hover {
          color: #60a5fa;
          border-color: rgba(59, 130, 246, 0.4);
        }
        .header-btn.is-saved {
          color: #fbbf24;
          border-color: rgba(251, 191, 36, 0.4);
        }
        .main-content {
          max-width: 1080px;
          margin: 0 auto;
          padding: 3rem 1.5rem 4rem;
        }
        .grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 3rem;
        }
        .card {
          background: rgba(15, 23, 42, 0.45);
          border: 1px solid rgba(30, 41, 59, 0.6);
          border-radius: 28px;
          padding: 2rem;
        }
        .details-card {
          background: rgba(15, 23, 42, 0.55);
          border: 1px solid rgba(30, 41, 59, 0.7);
          border-radius: 28px;
          padding: 2rem;
        }
        .details-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1rem;
        }
        .detail-item {
          padding: 0.9rem 1rem;
          border-radius: 18px;
          background: rgba(2, 6, 23, 0.55);
          border: 1px solid rgba(30, 41, 59, 0.55);
        }
        .detail-label {
          margin: 0 0 0.35rem;
          font-size: 0.65rem;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(148, 163, 184, 0.7);
          font-weight: 800;
        }
        .detail-value {
          margin: 0;
          font-size: 0.9rem;
          color: rgba(226, 232, 240, 0.95);
          font-weight: 700;
          word-break: break-word;
        }
        .tag {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.6rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          padding: 0.35rem 0.75rem;
          border-radius: 10px;
          background: rgba(59, 130, 246, 0.15);
          border: 1px solid rgba(59, 130, 246, 0.25);
          color: #60a5fa;
        }
        .title {
          font-size: clamp(2rem, 4vw, 3rem);
          font-weight: 900;
          color: #f8fafc;
          margin: 1.25rem 0 1rem;
        }
        .meta-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
        }
        .meta-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.6rem 0.9rem;
          background: rgba(15, 23, 42, 0.7);
          border: 1px solid rgba(30, 41, 59, 0.6);
          border-radius: 16px;
          font-size: 0.85rem;
          color: rgba(226, 232, 240, 0.9);
        }
        .section-title {
          font-size: 1.2rem;
          font-weight: 800;
          color: #f8fafc;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1.5rem;
        }
        .section-title span {
          width: 6px;
          height: 24px;
          border-radius: 999px;
          background: #3b82f6;
        }
        .section-text {
          color: rgba(148, 163, 184, 0.9);
          font-size: 1rem;
          line-height: 1.8;
        }
        .list {
          display: flex;
          flex-direction: column;
          gap: 0.9rem;
          color: rgba(148, 163, 184, 0.9);
        }
        .list-item {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
        }
        .list-icon {
          width: 24px;
          height: 24px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(59, 130, 246, 0.12);
          border: 1px solid rgba(59, 130, 246, 0.25);
          color: #60a5fa;
        }
        .benefits-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1rem;
        }
        .benefit-card {
          padding: 1.25rem;
          border-radius: 18px;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(30, 41, 59, 0.6);
        }
        .benefit-card h4 {
          margin: 0.4rem 0 0.4rem;
          color: #f8fafc;
          font-size: 1rem;
        }
        .benefit-card p {
          margin: 0;
          font-size: 0.8rem;
          color: rgba(148, 163, 184, 0.9);
        }
        .tdr-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1.5rem;
          padding: 1.75rem 2rem;
          border-radius: 24px;
          background: rgba(2, 6, 23, 0.65);
          border: 1px solid rgba(30, 41, 59, 0.7);
          box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.35);
        }
        .tdr-left {
          display: flex;
          align-items: center;
          gap: 1.25rem;
        }
        .tdr-icon {
          width: 54px;
          height: 54px;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(34, 211, 238, 0.12);
          border: 1px solid rgba(34, 211, 238, 0.28);
          color: #22d3ee;
        }
        .tdr-title {
          margin: 0 0 0.35rem;
          font-size: 1rem;
          color: #f8fafc;
          font-weight: 800;
        }
        .tdr-desc {
          margin: 0;
          font-size: 0.8rem;
          color: rgba(148, 163, 184, 0.85);
          line-height: 1.5;
        }
        .tdr-button {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.8rem 1.3rem;
          border-radius: 16px;
          font-size: 0.7rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.18em;
          color: #22d3ee;
          border: 1px solid rgba(34, 211, 238, 0.35);
          background: rgba(34, 211, 238, 0.08);
          transition: all 0.3s ease;
          text-decoration: none;
        }
        .tdr-button:hover {
          background: rgba(34, 211, 238, 0.18);
          color: #e0f2fe;
          transform: translateY(-1px);
        }
        .sticky-panel {
          position: sticky;
          top: 6.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .salary-panel {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(30, 41, 59, 0.6);
          border-radius: 30px;
          padding: 2rem;
          box-shadow: 0 20px 40px rgba(2, 6, 23, 0.5);
        }
        .salary-label {
          font-size: 0.6rem;
          letter-spacing: 0.2em;
          font-weight: 800;
          color: rgba(148, 163, 184, 0.7);
          text-transform: uppercase;
          margin-bottom: 1rem;
        }
        .salary-value {
          font-size: 2rem;
          font-weight: 900;
          color: #f8fafc;
        }
        .detail-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 0;
          border-bottom: 1px solid rgba(30, 41, 59, 0.6);
          font-size: 0.85rem;
          color: rgba(148, 163, 184, 0.9);
        }
        .detail-row span {
          color: #e2e8f0;
          font-weight: 700;
        }
        .apply-btn {
          width: 100%;
          padding: 1.1rem;
          border-radius: 22px;
          font-weight: 900;
          font-size: 1rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.6rem;
          transition: all 0.3s ease;
        }
        .apply-btn.enabled {
          background: #2563eb;
          color: white;
          box-shadow: 0 20px 40px rgba(30, 64, 175, 0.35);
        }
        .apply-btn.enabled:hover {
          background: #3b82f6;
          transform: translateY(-3px);
        }
        .apply-btn.disabled {
          background: rgba(30, 41, 59, 0.7);
          color: rgba(148, 163, 184, 0.7);
          cursor: not-allowed;
        }
        .id-label {
          text-align: center;
          font-size: 0.6rem;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          color: rgba(148, 163, 184, 0.6);
          margin-top: 1.2rem;
        }
        .info-box {
          padding: 1rem;
          border-radius: 18px;
          border: 1px solid rgba(14, 116, 144, 0.2);
          background: rgba(14, 116, 144, 0.08);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          color: rgba(148, 163, 184, 0.9);
          font-size: 0.8rem;
        }
        .info-left {
          display: flex;
          align-items: center;
          gap: 0.8rem;
        }
        .info-download {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.5rem 0.8rem;
          border-radius: 12px;
          font-size: 0.6rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.18em;
          color: #22d3ee;
          border: 1px solid rgba(34, 211, 238, 0.35);
          background: rgba(34, 211, 238, 0.08);
          text-decoration: none;
          transition: all 0.3s ease;
        }
        .info-download:hover {
          background: rgba(34, 211, 238, 0.18);
          color: #e0f2fe;
          transform: translateY(-1px);
        }
        .pro-tip {
          padding: 1.5rem;
          border-radius: 22px;
          border: 1px solid rgba(59, 130, 246, 0.25);
          background: rgba(59, 130, 246, 0.12);
          text-align: center;
        }
        .pro-tip h4 {
          margin: 0 0 0.5rem;
          color: #60a5fa;
        }
        .pro-tip p {
          margin: 0;
          font-size: 0.8rem;
          color: rgba(148, 163, 184, 0.9);
          line-height: 1.6;
        }
        @media (max-width: 960px) {
          .grid {
            grid-template-columns: 1fr;
          }
          .sticky-panel {
            position: static;
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div className="job-details">
        <div className="sticky-header">
          <div className="header-inner">
            <button className="back-button" onClick={() => router.back()}>
              <span className="back-icon"><FiArrowLeft size={18} /></span>
              <span style={{ display: 'inline-flex' }}>Voltar para Vagas</span>
            </button>

            <div className="header-actions">
              <button className="header-btn" onClick={handleShare} title="Partilhar">
                <FiShare2 size={18} />
              </button>
              {userType !== 'empresa' && (
                <button
                  className={`header-btn ${isSaved ? 'is-saved' : ''}`}
                  onClick={handleToggleSave}
                  disabled={saving}
                  title={isSaved ? 'Remover dos salvos' : 'Salvar vaga'}
                >
                  <FiBookmark size={18} />
                </button>
              )}
            </div>
          </div>
        </div>

        <main className="main-content">
          <div className="grid">
            <div>
              <div style={{ marginBottom: '2.5rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                  <Badge status={badgeStatus} />
                </div>

                <h1 className="title">{titulo}</h1>

                <div className="meta-row">
                  <div className="meta-chip">
                    <HiOutlineBuildingOffice2 size={16} color="#60a5fa" />
                    <span>{companyLabel}</span>
                  </div>
                  <div className="meta-chip">
                    <FiCalendar size={16} color="#60a5fa" />
                    <span>Publicado: {postedAtLabel}</span>
                  </div>
                  <div className="meta-chip">
                    <FiClock size={16} color="#60a5fa" />
                    <span>Encerra: {formatDate(dataFecho)}</span>
                  </div>
                  <div className="meta-chip">
                    <FiDollarSign size={16} color="#60a5fa" />
                    <span>{salaryRange}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                <section className="details-card">
                  <h3 className="section-title">
                    <span />
                    Detalhes da Vaga
                  </h3>
                  <div className="details-grid">
                    {details.map((item) => (
                      <div key={item.label} className="detail-item">
                        <p className="detail-label">{item.label}</p>
                        <p className="detail-value">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="card">
                  <h3 className="section-title">
                    <span />
                    Sobre a Oportunidade
                  </h3>
                  <p className="section-text">{descricao || 'Descrição não informada.'}</p>
                </section>

                {tdrUrl && (
                  <section>
                    <h3 className="section-title">
                      <span style={{ background: '#22d3ee' }} />
                      Documentação (TDR)
                    </h3>
                    <div className="tdr-card">
                      <div className="tdr-left">
                        <div className="tdr-icon">
                          <FiFileText size={24} />
                        </div>
                        <div>
                          <h4 className="tdr-title">Termos de Referência</h4>
                          <p className="tdr-desc">Documento oficial com detalhes técnicos da vaga (.PDF)</p>
                        </div>
                      </div>
                      <a
                        href={tdrUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="tdr-button"
                      >
                        <FiDownload size={14} />
                        Descarregar
                      </a>
                    </div>
                  </section>
                )}

                <section>
                  <h3 className="section-title">
                    <span />
                    O que procuramos
                  </h3>
                  <div className="list">
                    {(requirementsList.length ? requirementsList : fallbackRequirements).map((req, i) => (
                      <div key={i} className="list-item">
                        <div className="list-icon">
                          <FiCheckCircle size={12} />
                        </div>
                        <span>{req}</span>
                      </div>
                    ))}
                  </div>
                </section>

                {publicAssessment && (
                  <section>
                    <h3 className="section-title">
                      <span />
                      Teste de habilidades
                    </h3>
                    <div className="details-card" style={{ padding: '1.5rem' }}>
                      <p className="section-text" style={{ marginTop: 0 }}>
                        Responda {publicAssessment.questions.length} pergunta(s). Nota mínima exigida: {publicAssessment.passingScore || 70}%.
                      </p>
                      <div style={{ display: 'grid', gap: '1rem' }}>
                        {publicAssessment.questions.map((question, questionIndex) => (
                          <div key={question.id || questionIndex} style={{ padding: '1rem', borderRadius: '18px', background: 'rgba(2, 6, 23, 0.5)', border: '1px solid rgba(30, 41, 59, 0.55)' }}>
                            <p style={{ margin: '0 0 0.9rem', color: '#f8fafc', fontWeight: 700 }}>
                              {questionIndex + 1}. {question.prompt}
                            </p>
                            <div style={{ display: 'grid', gap: '0.75rem' }}>
                              {question.options.map((option, optionIndex) => {
                                const checked = assessmentAnswers[questionIndex] === optionIndex;
                                return (
                                  <label
                                    key={`${question.id || questionIndex}-${optionIndex}`}
                                    style={{
                                      display: 'flex',
                                      gap: '0.75rem',
                                      alignItems: 'flex-start',
                                      padding: '0.85rem 1rem',
                                      borderRadius: '14px',
                                      cursor: 'pointer',
                                      border: checked ? '1px solid rgba(59, 130, 246, 0.45)' : '1px solid rgba(30, 41, 59, 0.6)',
                                      background: checked ? 'rgba(59, 130, 246, 0.12)' : 'rgba(15, 23, 42, 0.55)'
                                    }}
                                  >
                                    <input
                                      type="radio"
                                      name={`assessment-${question.id || questionIndex}`}
                                      checked={checked}
                                      onChange={() =>
                                        setAssessmentAnswers((prev) =>
                                          prev.map((answer, index) => (index === questionIndex ? optionIndex : answer))
                                        )
                                      }
                                    />
                                    <span style={{ color: '#e2e8f0' }}>{option}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                )}

                <section>
                  <h3 className="section-title">
                    <span />
                    Benefícios EmpregoSTP
                  </h3>
                  <div className="benefits-grid">
                    {benefitsToShow.map((benefit, i) => (
                      <div key={i} className="benefit-card">
                        <div style={{ color: '#60a5fa' }}>{benefit.icon}</div>
                        <h4>{benefit.title}</h4>
                        <p>{benefit.desc}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>

            <aside>
              <div className="sticky-panel">
                <div className="salary-panel">
                  <p className="salary-label">Pacote Salarial</p>
                  <div className="salary-value">{salaryMain}</div>
                  <p style={{ margin: '0.25rem 0 1.5rem', fontSize: '0.85rem', color: 'rgba(148, 163, 184, 0.7)' }}>
                    Estimativa mensal em STN
                  </p>

                  <div className="detail-row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FiMapPin size={14} />
                      Localização
                    </div>
                    <span>{localizacao || '—'}</span>
                  </div>
                  <div className="detail-row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FiBriefcase size={14} />
                      Contrato
                    </div>
                    <span>{getContractTypeLabel()}</span>
                  </div>
                  <div className="detail-row" style={{ borderBottom: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FiClock size={14} />
                      Jornada
                    </div>
                    <span>{vaga.jornada || vaga.jornadaTrabalho || 'Full-time'}</span>
                  </div>

                  <button
                    className={`apply-btn ${applyDisabled ? 'disabled' : 'enabled'}`}
                    onClick={handleApply}
                    disabled={applyDisabled}
                  >
                    {isApplying ? (
                      <>
                        <span style={{
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          border: '2px solid rgba(148, 163, 184, 0.5)',
                          borderTopColor: '#fff',
                          display: 'inline-block',
                          animation: 'spin 1s linear infinite'
                        }} />
                        Enviando...
                      </>
                    ) : isApplied ? (
                      <>
                        Candidatado
                        <FiChevronRight size={18} />
                      </>
                    ) : !isOpen ? (
                      'Vaga encerrada'
                    ) : (
                      <>
                        Candidatar-se
                        <FiChevronRight size={18} />
                      </>
                    )}
                  </button>

                  {isBlocked && (
                    <p style={{ marginTop: 16, color: '#fca5a5', fontSize: '0.85rem' }}>
                      O seu perfil atual não pode candidatar a esta vaga. Entre com uma conta de candidato.
                    </p>
                  )}
                  {errorMsg && (
                    <p style={{ marginTop: 12, color: '#fca5a5', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{errorMsg}</p>
                  )}
                  {!assessmentComplete && publicAssessment && (
                    <p style={{ marginTop: 12, color: '#fbbf24', fontSize: '0.85rem' }}>
                      Responda o teste de habilidades para liberar a candidatura.
                    </p>
                  )}

                </div>

                {tdrUrl && (
                  <div className="info-box">
                    <div className="info-left">
                      <FiFileText size={18} color="#22d3ee" />
                      <div>
                        <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#22d3ee' }}>
                          Documento TDR
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'rgba(148, 163, 184, 0.8)' }}>Termos disponíveis</div>
                      </div>
                    </div>
                    <a
                      href={tdrUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="info-download"
                    >
                      <FiDownload size={12} />
                      Descarregar
                    </a>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </main>
      </div>
    </>
  );
}

const serializeTimestamp = (timestamp) => {
  if (timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toISOString();
  }
  return timestamp;
};

const serializeJob = (job) => {
  const serialized = { ...job };
  for (const key in serialized) {
    if (serialized[key] && typeof serialized[key] === 'object' && typeof serialized[key].toDate === 'function') {
      serialized[key] = serializeTimestamp(serialized[key]);
    } else if (serialized[key] && typeof serialized[key] === 'object' && !Array.isArray(serialized[key])) {
      serialized[key] = serializeJob(serialized[key]);
    }
  }
  return serialized;
};

export async function getServerSideProps({ params }) {
  const { id } = params;

  try {
    const { admin } = await import('../../lib/firebaseAdmin');
    const doc = await admin.firestore().collection('jobs').doc(id).get();

    if (!doc.exists) {
      return { notFound: true };
    }

    const jobData = { id: doc.id, ...doc.data() };
    const serializedJob = serializeJob(jobData);
    serializedJob.skillsAssessment = getPublicSkillsAssessment(serializedJob.skillsAssessment);

    return {
      props: { vaga: serializedJob }
    };
  } catch (error) {
    console.error('Erro ao buscar vaga:', error);
    return {
      props: { vaga: null }
    };
  }
}
