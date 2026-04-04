import { useState, useEffect } from 'react';
import VerificationModal from './VerificationModal';
import VerificationBadge from './VerificationBadge';

/**
 * Componente que exibe status de verificação e permite solicitar verificação
 */
export default function VerificationStatus({ 
  userId, 
  isOwner = false, 
  onStatusChange,
  compact = false 
}) {
  const [status, setStatus] = useState('unverified');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    if (isOwner && userId) {
      fetchVerificationStatus();
      
      // Poll status every 10 seconds while pending
      const interval = setInterval(() => {
        fetchVerificationStatus();
      }, 10000);
      
      return () => clearInterval(interval);
    }
  }, [userId, isOwner]);

  const fetchVerificationStatus = async () => {
    try {
      setLoading(true);
      // Add timestamp to bust cache
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/verifications?uid=${userId}&t=${timestamp}`);
      if (response.ok) {
        const data = await response.json();
        const verification = data.verifications?.[0];
        if (verification) {
          console.log('Verification status:', verification.status);
          setStatus(verification.status);
          if (verification.reviewReason) {
            setRejectionReason(verification.reviewReason);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao carregar status de verificação:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'approved':
      case 'verified':
        return '#10b981';
      case 'rejected':
        return '#ef4444';
      case 'pending':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case 'approved':
      case 'verified':
        return 'Verificado';
      case 'rejected':
        return 'Rejeitado';
      case 'pending':
        return 'Pendente';
      default:
        return 'Não verificado';
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'approved':
      case 'verified':
        return 'Parabéns! O seu perfil foi verificado com sucesso.';
      case 'rejected':
        return 'O seu pedido de verificação foi rejeitado. Pode tentar novamente.';
      case 'pending':
        return 'O seu pedido está em análise. Aguarde a decisão do admin.';
      default:
        return 'Solicite a verificação para ganhar credibilidade.';
    }
  };

  if (compact) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
        {status === 'approved' || status === 'verified' ? (
          <VerificationBadge verified={true} size="sm" />
        ) : (
          <span style={{ fontSize: '0.85rem', color: '#a0aec0' }}>
            {getStatusLabel()}
          </span>
        )}
      </div>
    );
  }

  const styles = {
    container: {
      padding: '1.5rem',
      backgroundColor: 'rgba(255, 255, 255, 0.02)',
      border: `1px solid ${getStatusColor()}40`,
      borderRadius: '12px',
      marginBottom: '2rem',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '1rem',
    },
    title: {
      fontSize: '1.1rem',
      fontWeight: 'bold',
      color: '#fff',
    },
    badge: {
      padding: '0.4rem 1rem',
      borderRadius: '20px',
      fontSize: '0.85rem',
      fontWeight: '600',
      backgroundColor: `${getStatusColor()}20`,
      color: getStatusColor(),
      border: `1px solid ${getStatusColor()}40`,
    },
    message: {
      color: '#a0aec0',
      fontSize: '0.95rem',
      marginBottom: '1rem',
    },
    rejectionBox: {
      marginTop: '1rem',
      padding: '1rem',
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      borderRadius: '8px',
      border: '1px solid rgba(239, 68, 68, 0.2)',
      color: '#fca5a5',
      fontSize: '0.9rem',
    },
    button: {
      padding: '0.75rem 1.5rem',
      borderRadius: '8px',
      border: 'none',
      fontWeight: '600',
      cursor: 'pointer',
      fontSize: '0.9rem',
      transition: 'all 0.3s',
      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
      color: '#fff',
      marginTop: '1rem',
    },
    buttonAlt: {
      background: 'rgba(59, 130, 246, 0.1)',
      color: '#3b82f6',
      border: '1px solid rgba(59, 130, 246, 0.3)',
    },
  };

  return (
    <>
      <div style={styles.container}>
        <div style={styles.header}>
          <h3 style={styles.title}>Status de Verificação</h3>
          <span style={styles.badge}>{getStatusLabel()}</span>
        </div>

        <p style={styles.message}>{getStatusMessage()}</p>

        {status === 'rejected' && rejectionReason && (
          <div style={styles.rejectionBox}>
            <strong>Motivo da rejeição:</strong> {rejectionReason}
          </div>
        )}

        {isOwner && (status === 'unverified' || status === 'rejected') && (
          <button
            style={{
              ...styles.button,
              ...(status === 'rejected' ? styles.buttonAlt : {}),
            }}
            onClick={() => setIsModalOpen(true)}
            disabled={loading}
            onMouseEnter={(e) =>
              !loading &&
              (e.currentTarget.style.boxShadow = '0 10px 25px rgba(59, 130, 246, 0.4)')
            }
            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
          >
            {status === 'rejected' ? 'Tentar Novamente' : 'Solicitar Verificação'}
          </button>
        )}
      </div>

      <VerificationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          fetchVerificationStatus();
          onStatusChange?.();
        }}
        title={status === 'rejected' ? 'Novo Pedido de Verificação' : 'Solicitar Verificação'}
      />
    </>
  );
}
