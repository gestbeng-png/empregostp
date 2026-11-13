import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { getAuth } from 'firebase/auth';
import ManualPaymentProofCard from './ManualPaymentProofCard';
import StripeReturnNotice from './payments/StripeReturnNotice';
import PaymentMethodPicker from './payments/PaymentMethodPicker';
import useOnlinePaymentConfig from './payments/useOnlinePaymentConfig';
import { canChargeOnline } from '../lib/payments/currency';
import {
  getPlanSummary,
  hasActivePremiumVerification,
} from '../lib/candidatePlanFeatures';
import {
  getCandidateMarketingPlans,
  getCandidatePlanBenefits,
} from '../lib/candidateCatalog';
import styles from '../styles/CandidatePremiumPlansExperience.module.css';
import presentation from '../styles/PlansPresentation.module.css';

// Planos de marketing usados apenas como fallback e para metadados de
// apresentação (ex.: destaque "popular") quando cruzados com os planos do admin.
const FALLBACK_CANDIDATE_PLANS = getCandidateMarketingPlans({
  includeBasic: false,
  includeVerification: false,
});

function getProfileVerificationState(profile) {
  return {
    active: Boolean(
      profile.paidVerified ||
      profile.qualifiedVerified ||
      hasActivePremiumVerification(profile) ||
      profile.verificationStatus === 'verified',
    ),
    pending: profile.verificationStatus === 'pending',
  };
}

// Cruza os planos criados pelo admin (Firestore) com os metadados de
// apresentação, preservando os valores do admin e a verificação fixa do Premium.
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
      features: getCandidatePlanBenefits(
        tier,
        plan.features || presentation.features,
      ),
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
  method,
  onMethodChange,
}) {
  const { loading: methodsLoading, onlineEnabled } = useOnlinePaymentConfig();
  if (!plan || Number(plan.price) === 0) return null;

  return (
    <Modal
      title="Como quer pagar?"
      subtitle="Escolha a forma de pagamento para continuar com este plano."
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

      <PaymentMethodPicker
        name={`candidate-plan-method-${plan.id}`}
        value={method}
        onChange={onMethodChange}
        onlineAvailable={onlineEnabled && canChargeOnline(plan.price)}
        loading={methodsLoading}
        disabled={loading}
      />

      <div className={styles.modalActions}>
        <button type="button" className={styles.btnGhost} onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={onConfirm}
          disabled={
            !method || (method === 'transfer' && !paymentSettings) || loading
          }
        >
          {loading ? 'A processar...' : 'Confirmar'}
        </button>
      </div>
    </Modal>
  );
}

/**
 * @param {object} props
 * @param {boolean} [props.embedded]
 * @param {Function} [props.onPlanApproved]
 * @param {boolean} [props.verificationActive]
 * @param {boolean} [props.verificationPending]
 * @param {boolean} [props.verificationIncluded]
 * @param {Function} [props.onOpenVerification]
 */
export default function CandidatePremiumPlansExperience({
  embedded = false,
  onPlanApproved,
  verificationActive: suppliedVerificationActive,
  verificationPending: suppliedVerificationPending,
  verificationIncluded = false,
  onOpenVerification,
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentPlan, setCurrentPlan] = useState(null);
  const [profileVerification, setProfileVerification] = useState({
    active: false,
    pending: false,
  });
  const verificationActive =
    suppliedVerificationActive ?? profileVerification.active;
  const verificationPending =
    !verificationActive &&
    (suppliedVerificationPending ?? profileVerification.pending);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showProofModal, setShowProofModal] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState(null);
  const [pendingPaymentRequest, setPendingPaymentRequest] = useState(null);

  const [plans, setPlans] = useState(FALLBACK_CANDIDATE_PLANS);

  // Um pedido em análise continua aberto, mas já não precisa de pagamento
  // nem de um segundo comprovativo. A condição também cobre registos legados
  // cujo estado ainda seja "pending", mas que já tenham o ficheiro guardado.
  const requestNeedsPayment = Boolean(
    pendingPaymentRequest?.id &&
    pendingPaymentRequest.status === 'pending' &&
    !pendingPaymentRequest.paymentProof?.url &&
    !pendingPaymentRequest.paymentProof?.submittedAt &&
    !['proof_submitted', 'approved', 'paid', 'not_required'].includes(
      pendingPaymentRequest.paymentStatus,
    ),
  );
  const isOnlinePayment = pendingPaymentRequest?.paymentMethod === 'stripe';
  const needsManualPaymentProof = requestNeedsPayment && !isOnlinePayment;
  const canResumeOnlinePaymentFor = (plan) => {
    const tier = plan?.tierId || plan?.id;
    return (
      requestNeedsPayment &&
      isOnlinePayment &&
      Boolean(plan) &&
      (pendingPaymentRequest.planId === plan.id ||
        pendingPaymentRequest.planId === tier ||
        pendingPaymentRequest.planTierId === tier)
    );
  };

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
            fetch('/api/admin/payment-settings', {
              headers: { Authorization: `Bearer ${token}` },
            }),
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
          setCurrentPlan(getPlanSummary(userData).planId);
          setProfileVerification(getProfileVerificationState(userData));
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
    const plan = plans.find((item) => item.id === planId);
    if (
      (plan?.tierId || planId) === 'verification_candidato' &&
      (verificationActive || verificationPending)
    )
      return;
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
        const activatedTier = plan?.tierId || planId;
        setCurrentPlan(activatedTier);
        if (activatedTier === 'unlimited_candidato') {
          setProfileVerification({ active: true, pending: false });
        }
        setPendingPaymentRequest(null);
        onPlanApproved?.(planId);
        if (!embedded) {
          setTimeout(() => router.push('/dashboard/candidato'), 1200);
        }
      } else if (data.status === 'awaiting_payment') {
        setSuccess('Pedido criado. Conclua o pagamento para ativar o plano.');
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

  // Pagamento online confirmado no regresso do Stripe: o pedido deixou de
  // estar em aberto e o plano novo já está no perfil.
  const handleOnlinePaymentApproved = async () => {
    setPendingPaymentRequest(null);
    setShowProofModal(false);
    try {
      const token = await getAuth().currentUser?.getIdToken();
      if (token) {
        const profileRes = await fetch('/api/profile', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (profileRes.ok) {
          const profileJson = await profileRes.json();
          const userData = profileJson.profile?.data || {};
          setCurrentPlan(getPlanSummary(userData).planId);
          setProfileVerification(getProfileVerificationState(userData));
        }
      }
    } catch {
      // O painel volta a ler o plano ao recarregar.
    }
    onPlanApproved?.();
  };

  const handleSubscribe = async (planId) => {
    const plan = plans.find((item) => item.id === planId);
    const tier = plan?.tierId || planId;
    if (
      tier === 'verification_candidato' &&
      (verificationActive || verificationPending)
    )
      return;
    if (
      tier === 'verification_candidato' &&
      verificationIncluded &&
      onOpenVerification
    ) {
      onOpenVerification();
      return;
    }
    if (canResumeOnlinePaymentFor(plan)) {
      setError('');
      setPaymentMethod('online');
      setShowProofModal(true);
      return;
    }
    if (currentPlan === planId || currentPlan === tier) {
      setError('Você já está neste plano.');
      return;
    }

    if (plan && Number(plan.price) > 0) {
      setSelectedPlan(planId);
      setPaymentMethod(null);
      setShowPaymentForm(true);
      return;
    }

    await processSubscription(planId);
  };

  return (
    <div className={`${styles.wrap} ${presentation.theme}`}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>Planos para candidatos</span>
        <h1 className={styles.title}>Escolha o seu plano</h1>
        <p className={styles.subtitle}>
          Compare as ferramentas e os serviços incluídos em cada plano.
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
      <StripeReturnNotice onApproved={handleOnlinePaymentApproved} />

      {needsManualPaymentProof && (
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
              <span>Conclua o pagamento para ativar o plano.</span>
            </div>
          </div>
          <button
            type="button"
            className={styles.pendingBtn}
            onClick={() => {
              setPaymentMethod(null);
              setShowProofModal(true);
            }}
          >
            Concluir pagamento
          </button>
        </div>
      )}

      {showPaymentForm && selectedPlan && (
        <ConfirmPaymentModal
          plan={plans.find((item) => item.id === selectedPlan)}
          paymentSettings={paymentSettings}
          method={paymentMethod}
          onMethodChange={setPaymentMethod}
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
          title="Pagamento do plano"
          subtitle="Conclua o pagamento para ativar o plano."
          onClose={() => setShowProofModal(false)}
          wide
        >
          <ManualPaymentProofCard
            key={pendingPaymentRequest.id}
            request={pendingPaymentRequest}
            initialMethod={paymentMethod}
            title="Comprovativo de pagamento"
            description="Anexe o comprovativo da transferência (PDF, JPG ou PNG)."
            onSubmitted={(updated) => {
              setPendingPaymentRequest(updated);
              setShowProofModal(false);
              setError('');
              setSuccess(
                'Comprovativo enviado. Aguarde a análise do administrador.',
              );
            }}
            onCancelled={() => {
              setPendingPaymentRequest(null);
              setShowProofModal(false);
            }}
          />
        </Modal>
      )}

      <section className={presentation.grid} aria-label="Planos disponíveis">
        {plans.map((plan) => {
          const isVerification =
            (plan.tierId || plan.id) === 'verification_candidato';
          const verificationBlocked =
            isVerification && (verificationActive || verificationPending);
          const canSubmitVerification =
            isVerification &&
            verificationIncluded &&
            Boolean(onOpenVerification);
          const isCurrent =
            currentPlan === plan.id || currentPlan === plan.tierId;
          const isSelected = selectedPlan === plan.id && loading;
          const canResumeOnlinePayment = canResumeOnlinePaymentFor(plan);
          const isPopular = Boolean(plan.popular);
          const priceLabel = String(plan.priceLabel || '');
          const priceParts = priceLabel.match(/^([\d\s.,]+)\s+(.+)$/);
          return (
            <article
              key={plan.id}
              className={`${presentation.card} ${isPopular ? presentation.cardPopular : ''} ${isCurrent ? presentation.cardCurrent : ''}`}
              aria-label={plan.name}
            >
              <div className={presentation.planIntro}>
                <div className={presentation.planTopline}>
                  <h2 className={presentation.planName}>{plan.name}</h2>
                  {isPopular && (
                    <span className={presentation.popularBadge}>Popular</span>
                  )}
                </div>
                {plan.summary && (
                  <p className={presentation.summary}>{plan.summary}</p>
                )}
                <div className={presentation.priceRow}>
                  <span className={presentation.price}>
                    {priceParts ? (
                      <>
                        {priceParts[1].trim()}{' '}
                        <span className={presentation.priceCurrency}>
                          {priceParts[2]}
                        </span>
                      </>
                    ) : (
                      priceLabel
                    )}
                  </span>
                  {Number(plan.price) > 0 && (
                    <span className={presentation.pricePeriod}>/ mês</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={
                    loading ||
                    (isCurrent &&
                      !canSubmitVerification &&
                      !canResumeOnlinePayment) ||
                    verificationBlocked
                  }
                  className={`${presentation.subscribeBtn} ${isPopular ? presentation.subscribeBtnPopular : ''} ${isCurrent ? presentation.subscribeBtnCurrent : ''}`}
                >
                  {isVerification && verificationActive
                    ? 'Verificado'
                    : isVerification && verificationPending
                      ? 'Verificação em análise'
                      : canSubmitVerification
                        ? 'Enviar documentos'
                        : canResumeOnlinePayment
                          ? 'Continuar pagamento'
                          : isSelected
                            ? 'A processar...'
                            : isCurrent
                              ? 'Plano atual'
                              : 'Assinar plano'}
                </button>
              </div>

              <div className={presentation.planDetails}>
                <h3 className={presentation.featuresTitle}>
                  O que está incluído
                </h3>
                <ul className={presentation.features}>
                  {(plan.features || []).slice(0, 8).map((feature) => (
                    <li key={feature} className={presentation.feature}>
                      <span
                        className={presentation.checkIcon}
                        aria-hidden="true"
                      >
                        <svg viewBox="0 0 16 16" fill="none" focusable="false">
                          <path
                            d="m4 8 2.5 2.5L12 5"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                {isCurrent && (
                  <p className={presentation.currentNote}>
                    <span aria-hidden="true">✓</span> O seu plano atual
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </section>

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
