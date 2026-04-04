import { useState } from 'react';
import { getAuth } from 'firebase/auth';

/**
 * Modal para solicitar verificação de perfil
 */
export default function VerificationModal({ isOpen, onClose, onSuccess, title = 'Solicitar Verificação' }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fileSelected, setFileSelected] = useState(null);
  const [description, setDescription] = useState('');

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Ficheiro muito grande (máximo 5MB)');
        return;
      }
      setFileSelected(file);
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        throw new Error('Utilizador não autenticado');
      }

      const token = await user.getIdToken();

      // Send to API with document info
      console.log('Enviando pedido de verificação para', user.uid);
      const response = await fetch('/api/verifications', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uid: user.uid,
          documents: {
            description: description,
            fileName: fileSelected?.name || '',
            fileSize: fileSelected?.size || 0,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao solicitar verificação');
      }

      const data = await response.json();
      setSuccess('Verificação solicitada com sucesso! Aguarde a revisão.');
      setFileSelected(null);
      setDescription('');

      setTimeout(() => {
        onClose();
        onSuccess?.();
      }, 2000);
    } catch (err) {
      setError(err.message || 'Erro ao solicitar verificação');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const styles = {
    overlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)',
    },
    modal: {
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '12px',
      padding: '2.5rem',
      maxWidth: '500px',
      width: '90%',
      color: '#fff',
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
    },
    title: {
      fontSize: '1.5rem',
      fontWeight: 'bold',
      marginBottom: '1rem',
      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
      backgroundClip: 'text',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
    },
    description: {
      color: '#a0aec0',
      marginBottom: '1.5rem',
      fontSize: '0.95rem',
      lineHeight: '1.6',
    },
    formGroup: {
      marginBottom: '1.5rem',
    },
    label: {
      display: 'block',
      marginBottom: '0.6rem',
      fontWeight: '600',
      fontSize: '0.9rem',
      color: '#e2e8f0',
    },
    input: {
      width: '100%',
      padding: '0.75rem 1rem',
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(59, 130, 246, 0.3)',
      borderRadius: '8px',
      color: '#fff',
      fontSize: '0.95rem',
      boxSizing: 'border-box',
      transition: 'all 0.3s',
    },
    fileInput: {
      width: '100%',
      padding: '1rem',
      backgroundColor: 'rgba(255, 255, 255, 0.02)',
      border: '2px dashed rgba(59, 130, 246, 0.4)',
      borderRadius: '8px',
      color: '#a0aec0',
      cursor: 'pointer',
      fontSize: '0.9rem',
      boxSizing: 'border-box',
      transition: 'all 0.3s',
    },
    fileInputHover: {
      borderColor: 'rgba(59, 130, 246, 0.8)',
      backgroundColor: 'rgba(59, 130, 246, 0.05)',
    },
    button: {
      padding: '0.75rem 1.5rem',
      borderRadius: '8px',
      border: 'none',
      fontWeight: '600',
      cursor: 'pointer',
      fontSize: '0.95rem',
      transition: 'all 0.3s',
    },
    submitBtn: {
      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
      color: '#fff',
      flex: 1,
    },
    cancelBtn: {
      backgroundColor: 'transparent',
      color: '#a0aec0',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      flex: 1,
    },
    buttonGroup: {
      display: 'flex',
      gap: '1rem',
      marginTop: '2rem',
    },
    errorMsg: {
      color: '#f87171',
      fontSize: '0.9rem',
      marginTop: '0.5rem',
      padding: '0.75rem',
      backgroundColor: 'rgba(244, 63, 94, 0.1)',
      borderRadius: '6px',
      border: '1px solid rgba(244, 63, 94, 0.2)',
    },
    successMsg: {
      color: '#4ade80',
      fontSize: '0.9rem',
      marginTop: '0.5rem',
      padding: '0.75rem',
      backgroundColor: 'rgba(74, 222, 128, 0.1)',
      borderRadius: '6px',
      border: '1px solid rgba(74, 222, 128, 0.2)',
    },
    fileSelected: {
      color: '#60a5fa',
      fontSize: '0.85rem',
      marginTop: '0.5rem',
      padding: '0.5rem 0',
    },
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.title}>{title}</h2>
        <p style={styles.description}>
          Envie um documento de verificação (certificado, ID ou documento corporativo) para verificar o seu perfil e ganhar credibilidade junto à comunidade.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Documento</label>
            <input
              type="file"
              onChange={handleFileChange}
              style={styles.fileInput}
              accept=".pdf,.jpg,.jpeg,.png"
              disabled={loading}
              onDragOver={(e) => e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.8)'}
              onDragLeave={(e) => e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)'}
            />
            {fileSelected && (
              <div style={styles.fileSelected}>
                ✓ {fileSelected.name} ({(fileSelected.size / 1024).toFixed(2)} KB)
              </div>
            )}
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Descrição (opcional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Certificado de conclusão, ID corporativo, etc"
              style={styles.input}
              disabled={loading}
              onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.6)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)'}
            />
          </div>

          {error && <div style={styles.errorMsg}>{error}</div>}
          {success && <div style={styles.successMsg}>{success}</div>}

          <div style={styles.buttonGroup}>
            <button
              type="button"
              style={{ ...styles.button, ...styles.cancelBtn }}
              onClick={onClose}
              disabled={loading}
              onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              Cancelar
            </button>
            <button
              type="submit"
              style={{ ...styles.button, ...styles.submitBtn }}
              disabled={!fileSelected || loading}
              onMouseEnter={(e) => !loading && (e.currentTarget.style.boxShadow = '0 10px 25px rgba(59, 130, 246, 0.4)')}
              onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
            >
              {loading ? 'Enviando...' : 'Solicitar Verificação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
