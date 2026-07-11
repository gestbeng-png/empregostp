import { useState } from 'react';
import styles from '../styles/EmpresaPlansCatalog.module.css';
import { getEmpresaPlanCatalog } from '../lib/empresaPlansCatalog';
import { normalizeEmpresaPlanId } from '../lib/empresaPlanFeatures';
import ManualPaymentProofCard from './ManualPaymentProofCard';

export default function EmpresaPlansCatalog({
  plans = [],
  currentPlanId,
  currentPlanName,
  loadingPlanId = '',
  error = '',
  paymentInstructions = null,
  pendingPaymentRequest = null,
  onPaymentProofSubmitted,
  onSubscribe
}) {
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [proofModalOpen, setProofModalOpen] = useState(false);
  const catalog = getEmpresaPlanCatalog(plans);
  const normalizedCurrentPlanId = normalizeEmpresaPlanId(currentPlanId, currentPlanName);
  const hasExactCurrentPlan = catalog.some(
    (plan) => plan.id === currentPlanId || (currentPlanName && plan.name === currentPlanName)
  );
  const isBusy = Boolean(loadingPlanId);

  const startSubscription = (plan) => {
    if (!plan || isBusy) return;
    setSelectedPlan(plan);
  };

  const confirmSubscription = async () => {
    if (!selectedPlan) return;
    await onSubscribe?.(selectedPlan.id);
    setSelectedPlan(null);
  };

  const handleProofSubmitted = (updatedRequest) => {
    onPaymentProofSubmitted?.(updatedRequest);
    setProofModalOpen(false);
  };

  return (
    <section className={styles.wrap}>
      <div className={styles.header}>
        <div className={styles.headerCopy}>
          <h1 className={styles.title}>Escolha o plano da empresa</h1>
          <p>Escolha o plano que conecta mais talentos ao seu time</p>
        </div>
        {currentPlanName && (
          <div className={styles.currentPlanBox}>
            <span>Plano atual</span>
            <strong>{currentPlanName}</strong>
          </div>
        )}
      </div>

      {error && <div className={`${styles.alert} ${styles.alertError}`}>{error}</div>}

      {pendingPaymentRequest && (
        <div className={styles.pendingBanner}>
          <div className={styles.pendingInfo}>
            <span className={styles.pendingIcon} aria-hidden="true">✓</span>
            <div className={styles.pendingTexts}>
              <strong>
                Pagamento pendente
                {pendingPaymentRequest.planName ? ` — ${pendingPaymentRequest.planName}` : ''}
              </strong>
              <span>Faça a transferência e envie o comprovativo para validação manual.</span>
            </div>
          </div>
          <button type="button" className={styles.pendingAction} onClick={() => setProofModalOpen(true)}>
            Enviar comprovativo
          </button>
        </div>
      )}

      <div className={styles.grid}>
        {catalog.map((plan) => {
          const isCurrent = hasExactCurrentPlan
            ? plan.id === currentPlanId || (currentPlanName && plan.name === currentPlanName)
            : normalizedCurrentPlanId === plan.normalizedId || normalizedCurrentPlanId === plan.id;
          const isLoading = loadingPlanId === plan.id;

          return (
            <article
              key={plan.id}
              className={`${styles.card} ${plan.popular ? styles.cardPopular : ''} ${isCurrent ? styles.cardCurrent : ''}`}
            >
              {plan.popular && <span className={styles.popularBadge}>Popular</span>}
              <h3 className={styles.planName}>{plan.name}</h3>
              <div className={styles.priceRow}>
                <span className={styles.price}>{plan.priceLabel}</span>
                {Number(plan.price) > 0 && <span className={styles.pricePeriod}>/ mês</span>}
              </div>
              <p className={styles.summary}>{plan.description}</p>

              <div className={styles.divider} />

              <ul className={styles.features}>
                {(plan.features || []).slice(0, 8).map((feature) => (
                  <li key={feature} className={styles.feature}>
                    <span className={styles.checkIcon} aria-hidden="true">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={`${styles.subscribeBtn} ${plan.popular ? styles.subscribeBtnPopular : ''} ${isCurrent ? styles.subscribeBtnCurrent : ''}`}
                onClick={() => startSubscription(plan)}
                disabled={!onSubscribe || isCurrent || isBusy}
              >
                {isLoading
                  ? 'Processando...'
                  : isCurrent
                    ? 'Plano atual'
                    : Number(plan.price) === 0
                      ? 'Começar grátis'
                      : 'Assinar plano'}
              </button>
            </article>
          );
        })}
      </div>

      {selectedPlan && (
        <div className={styles.overlay} onClick={() => !isBusy && setSelectedPlan(null)}>
          <div className={styles.modal} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className={styles.modalHeader}>
              <div>
                <h2>Confirmar assinatura</h2>
                <p>Reveja o plano antes de criar o pedido.</p>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setSelectedPlan(null)}
                disabled={isBusy}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <div className={styles.planSummary}>
              <div>
                <span>Plano</span>
                <strong>{selectedPlan.name}</strong>
              </div>
              <div>
                <span>Valor</span>
                <strong>{selectedPlan.priceLabel}</strong>
              </div>
            </div>

            <p className={styles.modalNote}>
              {Number(selectedPlan.price) > 0
                ? 'Depois de confirmar, será criado um pedido de pagamento manual. Em seguida, envie o comprovativo num modal separado.'
                : 'Este plano será ativado sem comprovativo de pagamento.'}
            </p>

            <div className={styles.modalActions}>
              <button type="button" className={styles.btnGhost} onClick={() => setSelectedPlan(null)} disabled={isBusy}>
                Cancelar
              </button>
              <button type="button" className={styles.btnPrimary} onClick={confirmSubscription} disabled={isBusy}>
                {loadingPlanId === selectedPlan.id ? 'A processar...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {proofModalOpen && pendingPaymentRequest && (
        <div className={styles.overlay} onClick={() => setProofModalOpen(false)}>
          <div className={`${styles.modal} ${styles.modalWide}`} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className={styles.modalHeader}>
              <div>
                <h2>Enviar comprovativo</h2>
                <p>Dados do pagamento e upload do ficheiro num só lugar.</p>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setProofModalOpen(false)}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            {paymentInstructions && (
              <div className={styles.paymentHint}>
                <div><span>Valor</span><strong>{paymentInstructions.amount} {paymentInstructions.currency}</strong></div>
                <div><span>Suporte</span><strong>{paymentInstructions.email || 'Não configurado'}</strong></div>
              </div>
            )}

            <div className={styles.modalBody}>
              <ManualPaymentProofCard
                request={pendingPaymentRequest}
                title="Comprovativo de pagamento"
                description="Anexe PDF, JPG ou PNG. O administrador valida e ativa o plano."
                onSubmitted={handleProofSubmitted}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
