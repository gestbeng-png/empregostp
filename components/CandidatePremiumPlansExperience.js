import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { getAuth } from 'firebase/auth';
import ManualPaymentProofCard from './ManualPaymentProofCard';
import { getCandidateMarketingPlans } from '../lib/candidateCatalog';
import styles from '../styles/CandidatePremiumPlansExperience.module.css';

// Planos de marketing usados apenas como fallback e para metadados de
// apresentação (ex.: destaque "popular") quando cruzados com os planos do admin.
const FALLBACK_CANDIDATE_PLANS = getCandidateMarketingPlans({
  includeBasic: false,
  includeVerification: true,
});

// Cruza os planos criados pelo admin (Firestore) com os metadados de
// apresentação, mantendo os valores do admin (nome, preço, recursos) como fonte
// da verdade.
function mergeAdminPlansWithPresentation(apiPlans) {
  const byTier = FALLBACK_CANDIDATE_PLANS.reduce((acc, plan) => {
    acc[plan.id] = plan;
    return acc;
  }, {});

  return apiPlans.map((plan) => {
    const tier = plan.planTierId || plan.id;
    const presentation = byTier[tier] || {};
    return {
      ...presentation,
      ...plan,
      id: plan.id,
      tierId: tier,
      popular: plan.popular ?? presentation.popular ?? false,
    };
  });
}

function Modal({ title, subtitle, onClose, children, wide = false }) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={`${styles.modal} ${wide ? styles.modalWide : ''}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>{title}</h2>
            {subtitle && <p className={styles.modalSubtitle}>{subtitle}</p>}
          </div>
          <button
            type="button"
            className={styles.modalClose}
            onClick={onClose}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
        <div className={styles.modalBody}>{children}</div>
      </div>
    </div>
  );
}

function ConfirmPaymentModal({
  plan,
  paymentSettings,
  onConfirm,
  onCancel,
  loading,
}) {
  if (!plan || Number(plan.price) === 0) return null;

  const bankRows = [
    ['Conta', paymentSettings?.accountNumber],
    ['Titular', paymentSettings?.accountName],
    ['Banco', paymentSettings?.bankName],
    ['Email', paymentSettings?.email],
  ].filter(([, value]) => Boolean(value));

  return (
    <Modal
      title="Confirmar assinatura"
      subtitle="Reveja os dados, faça a transferência e confirme para gerar o pedido."
      onClose={onCancel}
    >
      <div className={styles.summaryBox}>
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>Plano</span>
          <span className={styles.summaryValue}>{plan.name}</span>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>Valor</span>
          <span className={styles.summaryPrice}>{plan.priceLabel}</span>
        </div>
      </div>

      {(bankRows.length > 0 || paymentSettings?.instructions) && (
        <div className={styles.bankBox}>
          <p className={styles.bankTitle}>Dados para transferência</p>
          {bankRows.map(([label, value]) => (
            <div key={label} className={styles.bankRow}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
          {paymentSettings?.instructions && (
            <p className={styles.bankNote}>{paymentSettings.instructions}</p>
          )}
        </div>
      )}

      <div className={styles.modalActions}>
        <button type="button" className={styles.btnGhost} onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={onConfirm}
          disabled={!paymentSettings || loading}
        >
          {loading ? 'A processar...' : 'Confirmar'}
        </button>
      </div>
    </Modal>
  );
}

export default function CandidatePremiumPlansExperience({
  embedded = false,
  onPlanApproved,
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentPlan, setCurrentPlan] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showProofModal, setShowProofModal] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState(null);
  const [pendingPaymentRequest, setPendingPaymentRequest] = useState(null);

  const [plans, setPlans] = useState(FALLBACK_CANDIDATE_PLANS);

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
        const [profileRes, paymentRes, pendingRes, plansRes] =
          await Promise.all([
            fetch('/api/profile', {
              headers: { Authorization: `Bearer ${token}` },
            }),
            fetch('/api/admin/payment-settings'),
            fetch('/api/subscription-requests/current', {
              headers: { Authorization: `Bearer ${token}` },
            }),
            fetch('/api/candidate/plans', {
              headers: { Authorization: `Bearer ${token}` },
            }),
          ]);

        if (plansRes.ok) {
          const plansJson = await plansRes.json();
          const apiPlans = Array.isArray(plansJson.plans)
            ? plansJson.plans
            : [];
          if (apiPlans.length) {
            setPlans(mergeAdminPlansWithPresentation(apiPlans));
          }
        }

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
            instructions: '',
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
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.code === 'OPEN_SUBSCRIPTION_REQUEST') {
          const pendingRes = await fetch('/api/subscription-requests/current', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (pendingRes.ok) {
            const pendingData = await pendingRes.json();
            setPendingPaymentRequest(pendingData.request || null);
          }
        }
        throw new Error(
          data.message ||
            data.error ||
            'Não foi possível processar a solicitação.',
        );
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
        setSuccess(
          'Solicitação criada. Faça a transferência e envie o comprovativo.',
        );
        setPendingPaymentRequest({
          id: data.requestId,
          planId,
          planName: plans.find((p) => p.id === planId)?.name || planId,
          price: plans.find((p) => p.id === planId)?.price || 0,
          status: 'pending',
          paymentInstructions: data.paymentInstructions || null,
        });
        setShowProofModal(true);
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
    const plan = plans.find((item) => item.id === planId);
    const tier = plan?.tierId || planId;
    if (currentPlan === planId || currentPlan === tier) {
      setError('Você já está neste plano.');
      return;
    }

    if (plan && Number(plan.price) > 0) {
      setSelectedPlan(planId);
      setShowPaymentForm(true);
      return;
    }

    await processSubscription(planId);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h1 className={styles.title}>Escolha o seu plano</h1>
        <p className={styles.subtitle}>
          Destaque o seu currículo e aumente as suas chances de conseguir
          emprego.
        </p>
      </div>

      {error && (
        <div className={`${styles.alert} ${styles.alertError}`}>{error}</div>
      )}
      {success && (
        <div className={`${styles.alert} ${styles.alertSuccess}`}>
          {success}
        </div>
      )}

      {pendingPaymentRequest?.id && (
        <div className={styles.pendingBanner}>
          <div className={styles.pendingInfo}>
            <span className={styles.pendingIcon} aria-hidden="true">
              🧾
            </span>
            <div className={styles.pendingTexts}>
              <strong>
                Pagamento pendente
                {pendingPaymentRequest.planName
                  ? ` — ${pendingPaymentRequest.planName}`
                  : ''}
              </strong>
              <span>
                Depois da transferência, envie o comprovativo para aprovação.
              </span>
            </div>
          </div>
          <button
            type="button"
            className={styles.pendingBtn}
            onClick={() => setShowProofModal(true)}
          >
            Enviar comprovativo
          </button>
        </div>
      )}

      {showPaymentForm && selectedPlan && (
        <ConfirmPaymentModal
          plan={plans.find((item) => item.id === selectedPlan)}
          paymentSettings={paymentSettings}
          loading={loading}
          onConfirm={() => processSubscription(selectedPlan)}
          onCancel={() => {
            setShowPaymentForm(false);
            setSelectedPlan(null);
          }}
        />
      )}

      {showProofModal && pendingPaymentRequest?.id && (
        <Modal
          title="Enviar comprovativo"
          subtitle="Faça a transferência e envie aqui o comprovativo para revisão do administrador."
          onClose={() => setShowProofModal(false)}
          wide
        >
          <ManualPaymentProofCard
            request={pendingPaymentRequest}
            title="Comprovativo de pagamento"
            description="Anexe o comprovativo da transferência (PDF, JPG ou PNG)."
            onSubmitted={(updated) => setPendingPaymentRequest(updated)}
            onCancelled={() => {
              setPendingPaymentRequest(null);
              setShowProofModal(false);
            }}
          />
        </Modal>
      )}

      <div className={styles.grid}>
        {plans.map((plan) => {
          const isCurrent =
            currentPlan === plan.id || currentPlan === plan.tierId;
          const isSelected = selectedPlan === plan.id && loading;
          const isPopular = Boolean(plan.popular);
          return (
            <div
              key={plan.id}
              className={`${styles.card} ${isPopular ? styles.cardPopular : ''} ${isCurrent ? styles.cardCurrent : ''}`}
            >
              {isPopular && <div className={styles.popularBadge}>Popular</div>}

              <h3 className={styles.planName}>{plan.name}</h3>
              <div className={styles.priceRow}>
                <span className={styles.price}>{plan.priceLabel}</span>
                {Number(plan.price) > 0 && (
                  <span className={styles.pricePeriod}>/ mês</span>
                )}
              </div>
              {plan.summary && <p className={styles.summary}>{plan.summary}</p>}

              <div className={styles.divider} />

              <ul className={styles.features}>
                {(plan.features || []).slice(0, 8).map((feature) => (
                  <li key={feature} className={styles.feature}>
                    <span className={styles.checkIcon} aria-hidden="true">
                      ✓
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => handleSubscribe(plan.id)}
                disabled={loading || isCurrent}
                className={`${styles.subscribeBtn} ${isPopular ? styles.subscribeBtnPopular : ''} ${isCurrent ? styles.subscribeBtnCurrent : ''}`}
              >
                {isSelected
                  ? 'A processar...'
                  : isCurrent
                    ? 'Plano atual'
                    : 'Assinar plano'}
              </button>
            </div>
          );
        })}
      </div>

      {!embedded && (
        <div className={styles.footer}>
          <Link href="/dashboard/candidato" className={styles.backLink}>
            Voltar ao Dashboard
          </Link>
        </div>
      )}
    </div>
  );
}
