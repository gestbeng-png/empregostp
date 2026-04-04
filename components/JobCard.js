import Link from 'next/link';
import { useState, useEffect } from 'react';
import { FiMapPin, FiBriefcase, FiClock, FiShare2, FiBookmark, FiChevronRight, FiDollarSign, FiEye } from 'react-icons/fi';
import { HiOutlineBuildingOffice2 } from 'react-icons/hi2';
import { useAuth } from '../context/AuthContext';
import Badge from './Badge';

const JobCard = ({ vaga, onToggleSave, isSaved: initialIsSaved = false }) => {
  const { user } = useAuth();
  const [isSaved, setIsSaved] = useState(initialIsSaved);
  const [saving, setSaving] = useState(false);
  const [userType, setUserType] = useState(null);

  useEffect(() => {
    async function checkUserType() {
      if (!user) {
        setUserType(null);
        return;
      }

      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('../lib/firebase');
        const userDoc = await getDoc(doc(db, 'users', user.uid));

        if (userDoc.exists()) {
          setUserType(userDoc.data().userType);
        }
      } catch (err) {
        console.error('Erro ao verificar tipo de usuário:', err);
      }
    }

    checkUserType();
  }, [user]);

  const {
    titulo,
    empresaNome,
    localizacao,
    salarioDe,
    salarioAte,
    tipoContrato,
    id,
    destaque,
    publicadoEm,
    status
  } = vaga;

  const companyLabel = empresaNome || vaga.companyName || vaga.empresa || 'Empresa';
  const locationLabel = localizacao || vaga.location || 'Não especificado';
  const viewsCount = vaga.views ?? vaga.visualizacoes ?? vaga.viewCount ?? vaga.visualizations ?? 0;

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

  const formatSalary = () => {
    if (!salarioDe || salarioDe === 'A combinar') return '';

    const formatValue = (value) => {
      if (!value) return '';
      const numValue = parseFloat(value.toString().replace(/[^\d,.-]/g, ''));
      return new Intl.NumberFormat('pt-PT', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(numValue);
    };

    const salarioDeFormatted = formatValue(salarioDe);
    const salarioAteFormatted = salarioAte ? formatValue(salarioAte) : null;

    if (salarioAteFormatted && salarioDeFormatted !== salarioAteFormatted) {
      return `${salarioDeFormatted} Db - ${salarioAteFormatted} Db`;
    }

    return `${salarioDeFormatted} Db`;
  };

  const formatPublishedAgo = () => {
    if (!publicadoEm) return 'Publicado há pouco';

    const publishedDate = new Date(publicadoEm);
    if (Number.isNaN(publishedDate.getTime())) {
      return 'Publicado há pouco';
    }

    const now = new Date();
    const diffMs = now - publishedDate;
    const minutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (years >= 1) return `Publicado há ${years} ano${years > 1 ? 's' : ''}`;
    if (months >= 1) return `Publicado há ${months} mês${months > 1 ? 'es' : ''}`;
    if (days >= 1) return `Publicado há ${days} dia${days > 1 ? 's' : ''}`;
    if (hours >= 1) return `Publicado há ${hours} hora${hours > 1 ? 's' : ''}`;
    if (minutes >= 1) return `Publicado há ${minutes} minuto${minutes > 1 ? 's' : ''}`;

    return 'Publicado há poucos segundos';
  };

  const handleToggleSave = async () => {
    if (saving) return;
    setSaving(true);

    try {
      const { getAuth } = await import('firebase/auth');
      const auth = getAuth();
      const currentUser = auth.currentUser;

      if (!currentUser) {
        window.location.href = `/login?redirect=/vaga/${id}`;
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
        body: JSON.stringify({ jobId: id })
      });

      if (response.ok) {
        setIsSaved(!isSaved);
        if (onToggleSave) onToggleSave(id);
      } else {
        const errorData = await response.json();
        if (errorData.code === 'FEATURE_PRO_ONLY' || errorData.code === 'SAVED_JOBS_LIMIT_REACHED') {
          alert(`${errorData.error}\n\n${errorData.upgradeMessage || 'Faça upgrade para acessar este recurso!'}`);
          if (errorData.upgradeUrl) {
            window.location.href = errorData.upgradeUrl;
          }
        } else {
          alert(errorData.error || 'Erro ao salvar vaga');
        }
      }
    } catch (err) {
      console.error('Erro ao salvar vaga:', err);
      alert('Erro ao salvar vaga. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleShare = (event) => {
    event.stopPropagation();
    if (!id) return;

    const url = `${window.location.origin}/vaga/${id}`;
    const text = `Confira esta vaga: ${titulo} em ${companyLabel}`;

    if (navigator.share) {
      navigator.share({
        title: titulo,
        text,
        url
      }).catch((shareError) => {
        if (shareError?.name === 'AbortError') return;
        console.error('Erro ao compartilhar:', shareError);
      });
      return;
    }

    try {
      navigator.clipboard.writeText(`${text} ${url}`);
      alert('Link copiado! Cole onde quiser compartilhar.');
    } catch (clipboardError) {
      alert(`Não foi possível compartilhar automaticamente. Copie o link manualmente: ${url}`);
    }
  };

  const salaryRange = formatSalary() || 'A combinar';
  const badgeStatus = destaque ? 'urgent' : status;

  return (
    <>
      <style jsx>{`
        .job-card {
          position: relative;
          background: linear-gradient(160deg, rgba(15, 23, 42, 0.78) 0%, rgba(2, 6, 23, 0.92) 100%);
          border: 1px solid rgba(51, 65, 85, 0.6);
          border-radius: 26px;
          padding: 1.4rem;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          gap: 1.1rem;
          transition: all 0.4s ease;
        }
        .job-card.featured {
          background: linear-gradient(135deg, rgba(251, 146, 60, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%);
          border: 2px solid rgba(251, 146, 60, 0.4);
          box-shadow: 0 0 30px rgba(251, 146, 60, 0.15);
        }
        .job-card::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          border: 1px solid transparent;
          background: linear-gradient(120deg, rgba(59, 130, 246, 0.18), rgba(99, 102, 241, 0)) border-box;
          -webkit-mask: linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.4s ease;
        }
        .job-card.featured::before {
          background: linear-gradient(120deg, rgba(251, 146, 60, 0.25), rgba(251, 146, 60, 0)) border-box;
          opacity: 1;
        }
        .job-card:hover {
          border-color: rgba(59, 130, 246, 0.3);
          background: linear-gradient(160deg, rgba(15, 23, 42, 0.9) 0%, rgba(2, 6, 23, 0.98) 100%);
          transform: translateY(-6px);
          box-shadow: 0 26px 60px rgba(8, 112, 184, 0.16);
        }
        .job-card.featured:hover {
          border-color: rgba(251, 146, 60, 0.6);
          background: linear-gradient(135deg, rgba(251, 146, 60, 0.12) 0%, rgba(59, 130, 246, 0.12) 100%);
          transform: translateY(-8px);
          box-shadow: 0 30px 70px rgba(251, 146, 60, 0.2);
        }
        .job-card:hover::before {
          opacity: 1;
        }
        .job-glow {
          position: absolute;
          right: -80px;
          top: -80px;
          width: 160px;
          height: 160px;
          border-radius: 999px;
          background: rgba(37, 99, 235, 0.12);
          filter: blur(48px);
          opacity: 0;
          transition: opacity 0.4s ease;
        }
        .job-card.featured .job-glow {
          background: rgba(251, 146, 60, 0.2);
          opacity: 0.5;
        }
        .job-card:hover .job-glow {
          opacity: 1;
        }
        .featured-badge {
          position: absolute;
          top: -1px;
          right: -1px;
          background: linear-gradient(135deg, #fb923c 0%, #f97316 100%);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 0 26px 0 16px;
          font-weight: 700;
          font-size: 0.75rem;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          z-index: 2;
          box-shadow: 0 4px 12px rgba(251, 146, 60, 0.3);
        }
        .job-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: relative;
          z-index: 1;
        }
        .bookmark {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          border-radius: 12px;
          border: 1px solid rgba(51, 65, 85, 0.6);
          color: #94a3b8;
          background: rgba(15, 23, 42, 0.6);
          transition: all 0.3s ease;
        }
        .bookmark:hover {
          color: #60a5fa;
          border-color: rgba(59, 130, 246, 0.35);
          background: rgba(15, 23, 42, 0.9);
        }
        .bookmark.is-saved {
          color: #fbbf24;
          border-color: rgba(251, 191, 36, 0.35);
          background: rgba(30, 41, 59, 0.7);
        }
        .company-label {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          color: #7dd3fc;
          font-size: 0.6rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          margin-bottom: 0.6rem;
          padding: 0.3rem 0.7rem;
          border-radius: 999px;
          background: rgba(30, 58, 138, 0.25);
          border: 1px solid rgba(59, 130, 246, 0.25);
        }
        .job-title {
          font-size: 1.28rem;
          font-weight: 900;
          color: #f8fafc;
          line-height: 1.3;
          margin: 0 0 0.9rem;
        }
        .job-card:hover .job-title {
          color: #60a5fa;
        }
        .meta-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.6rem;
          color: rgba(148, 163, 184, 0.9);
          font-size: 0.8rem;
        }
        .meta-pill {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(2, 6, 23, 0.65);
          padding: 0.55rem 0.8rem;
          border-radius: 16px;
          border: 1px solid rgba(30, 41, 59, 0.7);
        }
        .salary-card {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.9rem 1rem;
          background: rgba(2, 6, 23, 0.75);
          border-radius: 20px;
          border: 1px solid rgba(51, 65, 85, 0.5);
        }
        .salary-icon {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);
          color: white;
          box-shadow: 0 10px 20px rgba(30, 64, 175, 0.35);
        }
        .salary-label {
          font-size: 0.55rem;
          font-weight: 800;
          color: rgba(148, 163, 184, 0.8);
          text-transform: uppercase;
          letter-spacing: 0.18em;
        }
        .salary-value {
          font-size: 0.98rem;
          font-weight: 900;
          color: #f8fafc;
        }
        .actions {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.9fr);
          gap: 0.75rem;
          align-items: stretch;
        }
        .action-primary {
          flex: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.85rem 0.9rem;
          min-height: 48px;
          border-radius: 18px;
          background: rgba(30, 41, 59, 0.9);
          border: 1px solid rgba(71, 85, 105, 0.7);
          color: #f8fafc;
          font-weight: 800;
          font-size: 0.9rem;
          letter-spacing: 0.01em;
          transition: all 0.3s ease;
          text-decoration: none;
          box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.5);
        }
        .action-primary:hover {
          background: rgba(51, 65, 85, 0.95);
          border-color: rgba(100, 116, 139, 0.8);
          transform: translateY(-1px);
          box-shadow: 0 10px 22px rgba(15, 23, 42, 0.35);
        }
        .action-primary:active {
          transform: translateY(0);
          box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.6);
        }
        .action-secondary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 48px;
          padding: 0.8rem 1.1rem;
          border-radius: 18px;
          background: rgba(15, 23, 42, 0.9);
          border: 1px solid rgba(51, 65, 85, 0.7);
          color: rgba(226, 232, 240, 0.9);
          font-weight: 800;
          font-size: 0.8rem;
          transition: all 0.3s ease;
          box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.5);
        }
        .action-secondary:hover {
          background: rgba(30, 41, 59, 0.95);
          border-color: rgba(100, 116, 139, 0.8);
          color: #f8fafc;
          transform: translateY(-1px);
          box-shadow: 0 10px 20px rgba(15, 23, 42, 0.3);
        }
        .footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px solid rgba(30, 41, 59, 0.6);
          padding-top: 0.85rem;
          font-size: 0.75rem;
          color: rgba(148, 163, 184, 0.8);
          font-weight: 600;
        }
        .footer span {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
        }
        .job-id {
          background: rgba(30, 41, 59, 0.8);
          padding: 0.2rem 0.5rem;
          border-radius: 6px;
          color: rgba(148, 163, 184, 0.9);
        }
        @media (max-width: 768px) {
          .job-card {
            padding: 1.2rem;
          }
          .meta-grid {
            grid-template-columns: 1fr;
          }
          .actions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className={`job-card ${destaque ? 'featured' : ''}`}>
        <div className="job-glow" />

        {destaque && (
          <div className="featured-badge">
            <span>⭐</span>
            <span>Em Destaque</span>
          </div>
        )}

        <div className="job-top">
          <Badge status={badgeStatus} />
          {userType !== 'empresa' && (
            <button
              className={`bookmark ${isSaved ? 'is-saved' : ''}`}
              onClick={handleToggleSave}
              disabled={saving}
              title={isSaved ? 'Remover dos salvos' : 'Salvar vaga'}
            >
              <FiBookmark size={18} />
            </button>
          )}
        </div>

        <div>
          <div className="company-label">
            <HiOutlineBuildingOffice2 size={14} />
            <span>{companyLabel}</span>
          </div>
          <h3 className="job-title">{titulo}</h3>

        <div className="meta-grid">
          <div className="meta-pill">
            <FiMapPin size={14} color="rgba(96, 165, 250, 0.8)" />
            <span>{locationLabel}</span>
          </div>
          <div className="meta-pill">
            <FiBriefcase size={14} color="rgba(96, 165, 250, 0.8)" />
            <span>{getContractTypeLabel()}</span>
          </div>
          <div className="meta-pill">
            <FiClock size={14} color="rgba(96, 165, 250, 0.8)" />
            <span>{formatPublishedAgo()}</span>
          </div>
          <div className="meta-pill">
            <FiEye size={14} color="rgba(96, 165, 250, 0.8)" />
            <span>{viewsCount} visualizações</span>
          </div>
        </div>
        </div>

        <div className="salary-card">
          <div className="salary-icon">
            <FiDollarSign size={20} />
          </div>
          <div>
            <p className="salary-label">Faixa Salarial</p>
            <p className="salary-value">{salaryRange}</p>
          </div>
        </div>

        <div className="actions">
          <Link href={`/vaga/${id}`} className="action-primary">
            Ver Detalhes
            <FiChevronRight size={16} />
          </Link>
          <button className="action-secondary" onClick={handleShare} title="Partilhar">
            <FiShare2 size={18} />
          </button>
        </div>

        {/* Tempo de publicação removido por solicitação */}
      </div>
    </>
  );
};

export default JobCard;
