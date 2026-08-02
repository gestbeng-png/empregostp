import { useState, useEffect, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
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

  const fetchVerificationStatus = useCallback(async () => {
    try {
      setLoading(true);
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      // Add timestamp to bust cache
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/verifications?uid=${userId}&t=${timestamp}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
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
  }, [userId]);

  useEffect(() => {
    if (isOwner && userId) {
      fetchVerificationStatus();

      // Poll status every 10 seconds while pending
      const interval = setInterval(() => {
        fetchVerificationStatus();
      }, 10000);

      return () => clearInterval(interval);
    }

    return undefined;
  }, [fetchVerificationStatus, userId, isOwner]);

  const getStatusColor = () => {
    switch (status) {
      case 'approved':
      case 'verified':
        return '#168a55';
      case 'rejected':
        return '#c23d4f';
      case 'pending':
        return '#a96612';
      case 'partial':
        return '#064bb5';
      default:
        return '#767f8c';
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
      case 'partial':
        return 'Parcial';
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
      case 'partial':
        return 'Alguns blocos foram aprovados, mas ainda existem itens por corrigir.';
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
          <span style={{ fontSize: '0.85rem', color: '#767f8c' }}>
            {getStatusLabel()}
          </span>
        )}
      </div>
    );
  }

  const styles = {
    container: {
      padding: '1.5rem',
      backgroundColor: '#ffffff',
      border: `1px solid ${getStatusColor()}40`,
      borderRadius: '8px',
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
      color: '#102441',
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
      color: '#383750',
      fontSize: '0.95rem',
      marginBottom: '1rem',
    },
    rejectionBox: {
      marginTop: '1rem',
      padding: '1rem',
      backgroundColor: '#fff1f2',
      borderRadius: '4px',
      border: '1px solid rgba(194, 61, 79, 0.25)',
      color: '#c23d4f',
      fontSize: '0.9rem',
    },
    button: {
      padding: '0.75rem 1.5rem',
      borderRadius: '4px',
      border: 'none',
      fontWeight: '600',
      cursor: 'pointer',
      fontSize: '0.9rem',
      transition: 'all 0.3s',
      background: '#064bb5',
      color: '#fff',
      marginTop: '1rem',
    },
    buttonAlt: {
      background: '#eef4f8',
      color: '#064bb5',
      border: '1px solid rgba(6, 75, 181, 0.3)',
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
              (e.currentTarget.style.backgroundColor =
                status === 'rejected' ? '#e4e5e8' : '#0a65cc')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor =
                status === 'rejected' ? '#eef4f8' : '#064bb5')
            }
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
