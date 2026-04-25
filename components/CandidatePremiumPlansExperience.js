import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { getAuth } from 'firebase/auth';
import ManualPaymentProofCard from './ManualPaymentProofCard';
import { getCandidateMarketingPlans } from '../lib/candidateCatalog';

function PaymentForm({ plan, paymentSettings, onConfirm, onCancel }) {
  if (!plan || Number(plan.price) === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '2rem'
    }}>
      <div style={{
        background: 'linear-gradient(180deg, #1a1f35 0%, #0a0e1a 100%)',
        border: '2px solid rgba(251, 191, 36, 0.3)',
        borderRadius: '20px',
        padding: '2.5rem',
        maxWidth: '600px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'white', margin: 0 }}>
            Confirmar Assinatura
          </h2>
          <button
            onClick={onCancel}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '1.25rem'
            }}
          >
            ×
          </button>
        </div>

        <div style={{
          background: 'rgba(251, 191, 36, 0.1)',
          border: '1px solid rgba(251, 191, 36, 0.3)',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Plano:</span>
            <span style={{ color: '#fbbf24', fontWeight: 700 }}>{plan.name}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Valor:</span>
            <span style={{ color: 'white', fontWeight: 700, fontSize: '1.25rem' }}>{plan.priceLabel}</span>
          </div>
        </div>

        {paymentSettings && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '1.5rem',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{ color: 'white', marginTop: 0, marginBottom: '1rem' }}>Dados para transferência</h3>
            {paymentSettings.accountNumber && <p style={{ color: 'white' }}><strong>Conta:</strong> {paymentSettings.accountNumber}</p>}
            {paymentSettings.accountName && <p style={{ color: 'white' }}><strong>Titular:</strong> {paymentSettings.accountName}</p>}
            {paymentSettings.bankName && <p style={{ color: 'white' }}><strong>Banco:</strong> {paymentSettings.bankName}</p>}
            {paymentSettings.email && <p style={{ color: 'white' }}><strong>Email:</strong> {paymentSettings.email}</p>}
            {paymentSettings.instructions && (
              <p style={{ color: 'rgba(255,255,255,0.85)', marginBottom: 0 }}>{paymentSettings.instructions}</p>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '1rem',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '2px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              color: 'white',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={!paymentSettings}
            style={{
              flex: 1,
              padding: '1rem',
              background: paymentSettings
                ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)'
                : 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              fontWeight: 700,
              cursor: paymentSettings ? 'pointer' : 'not-allowed',
              opacity: paymentSettings ? 1 : 0.6
            }}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CandidatePremiumPlansExperience({
  embedded = false,
  onPlanApproved
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentPlan, setCurrentPlan] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState(null);
  const [pendingPaymentRequest, setPendingPaymentRequest] = useState(null);

  const plans = useMemo(
    () => getCandidateMarketingPlans({ includeBasic: false, includeVerification: true }),
    []
  );

  useEffect(() => {
    async function bootstrap() {
      try {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) {
          if (!embedded) {
            router.push('/login?redirect=/premium/candidatos');
          }
          return;
        }

        const token = await user.getIdToken();
        const [profileRes, paymentRes, pendingRes] = await Promise.all([
          fetch('/api/profile', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/admin/payment-settings'),
          fetch('/api/subscription-requests/current', { headers: { Authorization: `Bearer ${token}` } })
        ]);

        if (profileRes.ok) {
          const profileJson = await profileRes.json();
          const userData = profileJson.profile?.data || {};
          setCurrentPlan(userData.currentPlan || 'basic_candidato');
        }

        if (paymentRes.ok) {
          const paymentJson = await paymentRes.json();
          setPaymentSettings(paymentJson || null);
        } else {
          setPaymentSettings({
            accountNumber: '',
            accountName: '',
            bankName: '',
            email: '',
            instructions: ''
          });
        }

        if (pendingRes.ok) {
          const pendingJson = await pendingRes.json();
          setPendingPaymentRequest(pendingJson.request || null);
        }
      } catch (fetchError) {
        setError('Erro ao carregar os planos.');
      }
    }

    bootstrap();
  }, [embedded, router]);

  const processSubscription = async (planId) => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      setShowPaymentForm(false);

      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      const token = await user.getIdToken();
      const res = await fetch('/api/subscribe-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ planId })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.code === 'OPEN_SUBSCRIPTION_REQUEST') {
          const pendingRes = await fetch('/api/subscription-requests/current', {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (pendingRes.ok) {
            const pendingData = await pendingRes.json();
            setPendingPaymentRequest(pendingData.request || null);
          }
        }
        throw new Error(data.message || data.error || 'Não foi possível processar a solicitação.');
      }

      if (data.status === 'approved') {
        setSuccess('Plano ativado com sucesso.');
        setCurrentPlan(planId);
        setPendingPaymentRequest(null);
        onPlanApproved?.(planId);
        if (!embedded) {
          setTimeout(() => router.push('/dashboard/candidato'), 1200);
        }
      } else if (data.status === 'awaiting_payment') {
        setSuccess('Solicitação criada. Faça a transferência e envie o comprovativo.');
        setPendingPaymentRequest({
          id: data.requestId,
          planId,
          planName: plans.find((p) => p.id === planId)?.name || planId,
          price: plans.find((p) => p.id === planId)?.price || 0,
          status: 'pending',
          paymentInstructions: data.paymentInstructions || null
        });
      } else {
        setSuccess(data.message || 'Solicitação enviada com sucesso.');
      }
    } catch (requestError) {
      setError(requestError.message || 'Erro ao assinar plano.');
    } finally {
      setLoading(false);
      setSelectedPlan(null);
    }
  };

  const handleSubscribe = async (planId) => {
    if (currentPlan === planId) {
      setError('Você já está neste plano.');
      return;
    }

    const plan = plans.find((item) => item.id === planId);
    if (plan && Number(plan.price) > 0) {
      setSelectedPlan(planId);
      setShowPaymentForm(true);
      return;
    }

    await processSubscription(planId);
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: embedded ? 0 : '2rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{
          fontSize: 'clamp(1.6rem, 3vw, 2.5rem)',
          fontWeight: 900,
          color: 'white',
          marginBottom: '0.75rem',
          background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Escolha Seu Plano
        </h1>
        <p style={{ fontSize: '1rem', color: 'rgba(255, 255, 255, 0.7)', maxWidth: '680px', margin: '0 auto' }}>
          Destaque seu currículo e aumente suas chances de conseguir emprego.
        </p>
      </div>

      {error && (
        <div style={{
          padding: '1rem 1.25rem',
          marginBottom: '1rem',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '2px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '12px',
          color: '#fca5a5'
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: '1rem 1.25rem',
          marginBottom: '1rem',
          background: 'rgba(16, 185, 129, 0.15)',
          border: '2px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '12px',
          color: '#34d399'
        }}>
          {success}
        </div>
      )}

      {pendingPaymentRequest?.id && (
        <div style={{ marginBottom: '1rem' }}>
          <ManualPaymentProofCard
            request={pendingPaymentRequest}
            title="Pagamento manual"
            description="Depois da transferência, envie o comprovativo para aprovação do administrador."
            onSubmitted={setPendingPaymentRequest}
          />
        </div>
      )}

      {showPaymentForm && selectedPlan && (
        <PaymentForm
          plan={plans.find((item) => item.id === selectedPlan)}
          paymentSettings={paymentSettings}
          onConfirm={() => processSubscription(selectedPlan)}
          onCancel={() => {
            setShowPaymentForm(false);
            setSelectedPlan(null);
          }}
        />
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.25rem',
        marginBottom: '1.25rem'
      }}>
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const isSelected = selectedPlan === plan.id && loading;
          const isPopular = Boolean(plan.popular);
          return (
            <div
              key={plan.id}
              style={{
                position: 'relative',
                background: isPopular
                  ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(245, 158, 11, 0.15) 100%)'
                  : 'rgba(255, 255, 255, 0.05)',
                border: isPopular
                  ? '2px solid rgba(251, 191, 36, 0.5)'
                  : isCurrent
                    ? '2px solid rgba(16, 185, 129, 0.5)'
                    : '2px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '20px',
                padding: '1.5rem',
                color: 'white'
              }}
            >
              {isPopular && (
                <div style={{
                  position: 'absolute',
                  top: '-10px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                  color: '#111827',
                  padding: '0.25rem 0.8rem',
                  borderRadius: '999px',
                  fontSize: '0.75rem',
                  fontWeight: 700
                }}>
                  Popular
                </div>
              )}

              <h3 style={{ marginTop: 0, marginBottom: '0.25rem', fontSize: '1.4rem' }}>{plan.name}</h3>
              <p style={{ marginTop: 0, marginBottom: '1rem', color: '#fbbf24', fontWeight: 800, fontSize: '1.6rem' }}>
                {plan.priceLabel}
              </p>
              <ul style={{ margin: 0, paddingLeft: '1rem', minHeight: 120 }}>
                {(plan.features || []).slice(0, 8).map((feature) => (
                  <li key={feature} style={{ marginBottom: '0.4rem', color: 'rgba(255,255,255,0.9)' }}>{feature}</li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(plan.id)}
                disabled={loading || isCurrent}
                style={{
                  width: '100%',
                  marginTop: '1rem',
                  padding: '0.9rem',
                  borderRadius: '12px',
                  border: 'none',
                  cursor: isCurrent ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                  color: 'white',
                  background: isCurrent
                    ? 'rgba(16, 185, 129, 0.2)'
                    : isPopular
                      ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)'
                      : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  opacity: loading && !isSelected ? 0.6 : 1
                }}
              >
                {isSelected ? 'Processando...' : isCurrent ? 'Plano Atual' : 'Assinar Plano'}
              </button>
            </div>
          );
        })}
      </div>

      {!embedded && (
        <div style={{ textAlign: 'center' }}>
          <Link
            href="/dashboard/candidato"
            style={{
              padding: '0.75rem 1.25rem',
              background: 'rgba(59, 130, 246, 0.2)',
              border: '2px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '12px',
              color: '#60a5fa',
              textDecoration: 'none',
              fontWeight: 700
            }}
          >
            Voltar ao Dashboard
          </Link>
        </div>
      )}
    </div>
  );
}
