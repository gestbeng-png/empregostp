import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { getAuth } from 'firebase/auth';
import LandingHeader from '../../../components/LandingHeader';
import { requireAdminPageAuth } from '../../../lib/adminPageGuard';
import styles from '../../../styles/AdminPanel.module.css';

const getMessageTone = (message) => {
  const normalized = String(message || '').toLowerCase();
  return normalized.includes('sucesso') ? styles.alertSuccess : styles.alertError;
};

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
            Authorization: `Bearer ${token}`
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

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

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
          Authorization: `Bearer ${token}`
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
      </Head>
      <LandingHeader />

      <main className={`${styles.page} ${styles.pageNarrow}`}>
        <div className={styles.headerCard}>
          <div className={styles.headerCopy}>
            <Link
              href="/dashboard/admin"
              className={`${styles.linkButton} ${styles.buttonAccent} ${styles.buttonSmall}`}
              style={{ '--button-bg': 'rgba(59, 130, 246, 0.2)', '--button-border': 'rgba(59, 130, 246, 0.3)', '--button-color': '#60a5fa' }}
            >
              ← Voltar
            </Link>
            <h1 className={`${styles.headerTitle} ${styles.headerTitleSmall}`}>Configurações de Pagamento</h1>
            <p className={styles.headerSubtitle}>Defina os dados bancários e as instruções exibidas no fluxo de pagamento manual.</p>
          </div>
        </div>

        {message ? (
          <div className={`${styles.alert} ${getMessageTone(message)}`}>
            {message}
          </div>
        ) : null}

        {loading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner} />
            <p className={styles.loadingText}>Carregando configurações...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={`${styles.surface} ${styles.panel}`}>
            <div className={styles.formGrid}>
              <div className={styles.formField}>
                <label htmlFor="account-number" className={styles.formLabel}>Número da Conta *</label>
                <input
                  id="account-number"
                  type="text"
                  name="accountNumber"
                  value={formData.accountNumber}
                  onChange={handleChange}
                  required
                  placeholder="Ex: 89606091001"
                  className={styles.inputControl}
                />
              </div>

              <div className={styles.formField}>
                <label htmlFor="account-name" className={styles.formLabel}>Nome da Conta</label>
                <input
                  id="account-name"
                  type="text"
                  name="accountName"
                  value={formData.accountName}
                  onChange={handleChange}
                  placeholder="Ex: EmpregoSTP"
                  className={styles.inputControl}
                />
              </div>

              <div className={styles.formField}>
                <label htmlFor="bank-name" className={styles.formLabel}>Nome do Banco</label>
                <input
                  id="bank-name"
                  type="text"
                  name="bankName"
                  value={formData.bankName}
                  onChange={handleChange}
                  placeholder="Ex: Banco Internacional"
                  className={styles.inputControl}
                />
              </div>

              <div className={styles.formField}>
                <label htmlFor="payment-email" className={styles.formLabel}>Email para Comprovativos</label>
                <input
                  id="payment-email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Ex: empregoSTP@gmail.com"
                  className={styles.inputControl}
                />
              </div>

              <div className={`${styles.formField} ${styles.formFieldFull}`}>
                <label htmlFor="payment-instructions" className={styles.formLabel}>Instruções de Pagamento</label>
                <textarea
                  id="payment-instructions"
                  name="instructions"
                  value={formData.instructions}
                  onChange={handleChange}
                  rows={5}
                  placeholder="Instruções que aparecerão para o candidato ao assinar um plano..."
                  className={styles.textareaControl}
                />
              </div>
            </div>

            <div className={styles.buttonGroupEnd}>
              <button
                type="submit"
                disabled={saving || loading}
                className={`${styles.buttonBase} ${styles.buttonAccent}`}
                style={{ '--button-bg': 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)', '--button-border': 'transparent', '--button-color': '#fff' }}
              >
                {saving ? 'Salvando...' : 'Salvar Configurações'}
              </button>
            </div>
          </form>
        )}
      </main>
    </>
  );
}

export async function getServerSideProps(context) {
  const authResult = await requireAdminPageAuth(context);
  if (!authResult.ok) {
    return { redirect: authResult.redirect };
  }

  return { props: {} };
}
