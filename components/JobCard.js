import Link from 'next/link';
import { useState, useEffect } from 'react';
import { FiMapPin, FiBriefcase, FiClock, FiShare2, FiBookmark, FiChevronRight, FiDollarSign, FiEye } from 'react-icons/fi';
import { HiOutlineBuildingOffice2 } from 'react-icons/hi2';
import { useAuth } from '../context/AuthContext';
import Badge from './Badge';
import styles from '../styles/JobCard.module.css';

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
    <div className={`${styles.jobCard} ${destaque ? styles.jobCardFeatured : ''}`}>
      <div className={styles.jobGlow} />

      {destaque && (
        <div className={styles.featuredBadge}>
          <span>⭐</span>
          <span>Em Destaque</span>
        </div>
      )}

      <div className={styles.jobTop}>
        <Badge status={badgeStatus} />
        {userType !== 'empresa' && (
          <button
            type="button"
            className={`${styles.bookmark} ${isSaved ? styles.bookmarkSaved : ''}`}
            onClick={handleToggleSave}
            disabled={saving}
            title={isSaved ? 'Remover dos salvos' : 'Salvar vaga'}
          >
            <FiBookmark size={18} />
          </button>
        )}
      </div>

      <div className={styles.content}>
        <div className={styles.companyLabel}>
          <HiOutlineBuildingOffice2 size={14} />
          <span>{companyLabel}</span>
        </div>
        <h3 className={styles.jobTitle}>{titulo}</h3>

        <div className={styles.metaGrid}>
          <div className={styles.metaPill}>
            <FiMapPin size={14} className={styles.metaIcon} />
            <span>{locationLabel}</span>
          </div>
          <div className={styles.metaPill}>
            <FiBriefcase size={14} className={styles.metaIcon} />
            <span>{getContractTypeLabel()}</span>
          </div>
          <div className={styles.metaPill}>
            <FiClock size={14} className={styles.metaIcon} />
            <span>{formatPublishedAgo()}</span>
          </div>
          <div className={styles.metaPill}>
            <FiEye size={14} className={styles.metaIcon} />
            <span>{viewsCount} visualizações</span>
          </div>
        </div>

        <div className={styles.salaryCard}>
          <div className={styles.salaryIcon}>
            <FiDollarSign size={20} />
          </div>
          <div className={styles.salaryMeta}>
            <span className={styles.salaryLabel}>Faixa Salarial</span>
            <p className={styles.salaryValue}>{salaryRange}</p>
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <Link href={`/vaga/${id}`} className={styles.actionPrimary}>
          Ver Detalhes
          <FiChevronRight size={16} />
        </Link>
        <button type="button" className={styles.actionSecondary} onClick={handleShare} title="Partilhar">
          <FiShare2 size={18} />
        </button>
      </div>

      {/* Tempo de publicação removido por solicitação */}
    </div>
  );
};

export default JobCard;
