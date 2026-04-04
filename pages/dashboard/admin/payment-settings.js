import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { getAuth } from 'firebase/auth';
import LandingHeader from '../../../components/LandingHeader';
import { requireAdminPageAuth } from '../../../lib/adminPageGuard';

export default function PaymentSettings() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [formData, setFormData] = useState({
    accountNumber: '',
    accountName: '',
    bankName: '',
    email: '',
    instructions: ''
  });

  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true);
        const auth = getAuth();
        const token = await auth.currentUser?.getIdToken();
        
        if (!token) {
          router.push('/login');
          return;
        }

        const res = await fetch('/api/admin/payment-settings', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (res.ok) {
          const data = await res.json();
          setFormData(data);
        }
      } catch (err) {
        console.error('Erro ao carregar configurações:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, [router]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      setMessage('');
      
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      
      if (!token) {
        router.push('/login');
        return;
      }

      const res = await fetch('/api/admin/payment-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        setMessage('Configurações salvas com sucesso!');
        setTimeout(() => setMessage(''), 3000);
      } else {
        const data = await res.json();
        setMessage(data.error || 'Erro ao salvar configurações');
      }
    } catch (err) {
      console.error('Erro ao salvar:', err);
      setMessage('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Head>
        <title>Configurações de Pagamento - Admin</title>
        <style>{`
          body {
            background: linear-gradient(180deg, #0a0e1a 0%, #1a1f35 100%);
            min-height: 100vh;
          }
        `}</style>
      </Head>
      <LandingHeader />
      
      <main style={{ 
        maxWidth: '900px', 
        margin: '0 auto', 
        padding: '2rem',
        minHeight: '100vh'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem'
        }}>
          <h1 style={{ 
            fontSize: '2rem', 
            fontWeight: '900', 
            color: 'white',
            margin: 0
          }}>
            Configurações de Pagamento
          </h1>
          <button
            onClick={() => router.push('/dashboard/admin')}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'rgba(59, 130, 246, 0.2)',
              border: '2px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '12px',
              color: '#60a5fa',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Voltar
          </button>
        </div>

        {message && (
          <div style={{
            padding: '1rem 1.5rem',
            marginBottom: '2rem',
            background: message.includes('sucesso') 
              ? 'rgba(16, 185, 129, 0.15)'
              : 'rgba(239, 68, 68, 0.15)',
            border: `2px solid ${message.includes('sucesso') 
              ? 'rgba(16, 185, 129, 0.3)'
              : 'rgba(239, 68, 68, 0.3)'}`,
            borderRadius: '12px',
            color: message.includes('sucesso') ? '#34d399' : '#fca5a5',
            fontSize: '0.95rem'
          }}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '20px',
          padding: '2rem'
        }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              color: 'white',
              fontWeight: '600',
              fontSize: '0.95rem'
            }}>
              Número da Conta *
            </label>
            <input
              type="text"
              name="accountNumber"
              value={formData.accountNumber}
              onChange={handleChange}
              required
              placeholder="Ex: 89606091001"
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '12px',
                border: '2px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'white',
                fontSize: '1rem'
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              color: 'white',
              fontWeight: '600',
              fontSize: '0.95rem'
            }}>
              Nome da Conta
            </label>
            <input
              type="text"
              name="accountName"
              value={formData.accountName}
              onChange={handleChange}
              placeholder="Ex: EmpregoSTP"
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '12px',
                border: '2px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'white',
                fontSize: '1rem'
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              color: 'white',
              fontWeight: '600',
              fontSize: '0.95rem'
            }}>
              Nome do Banco
            </label>
            <input
              type="text"
              name="bankName"
              value={formData.bankName}
              onChange={handleChange}
              placeholder="Ex: Banco Internacional"
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '12px',
                border: '2px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'white',
                fontSize: '1rem'
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              color: 'white',
              fontWeight: '600',
              fontSize: '0.95rem'
            }}>
              Email para Comprovativos
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Ex: empregoSTP@gmail.com"
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '12px',
                border: '2px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'white',
                fontSize: '1rem'
              }}
            />
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              color: 'white',
              fontWeight: '600',
              fontSize: '0.95rem'
            }}>
              Instruções de Pagamento
            </label>
            <textarea
              name="instructions"
              value={formData.instructions}
              onChange={handleChange}
              rows={4}
              placeholder="Instruções que aparecerão para o candidato ao assinar um plano..."
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '12px',
                border: '2px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'white',
                fontSize: '1rem',
                resize: 'vertical'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={saving || loading}
            style={{
              width: '100%',
              padding: '1rem',
              background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '1rem',
              fontWeight: '700',
              cursor: saving || loading ? 'not-allowed' : 'pointer',
              opacity: saving || loading ? 0.7 : 1,
              boxShadow: '0 4px 15px rgba(251, 191, 36, 0.4)'
            }}
          >
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </form>
      </main>
    </>
  );
}

export async function getServerSideProps(context) {
  const authResult = await requireAdminPageAuth(context);
  if (!authResult.ok) {
    return authResult.redirect;
  }

  return { props: {} };
}
