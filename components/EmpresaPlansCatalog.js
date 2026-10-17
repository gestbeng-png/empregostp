import { useEffect, useRef, useState } from 'react';
import { FiCheck, FiCreditCard, FiUploadCloud, FiX } from 'react-icons/fi';

import { getEmpresaPlanCatalog } from '../lib/empresaPlansCatalog';
import { normalizeEmpresaPlanId } from '../lib/empresaPlanFeatures';
import styles from '../styles/EmpresaPlansCatalog.module.css';

import ManualPaymentProofCard from './ManualPaymentProofCard';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * @param {{
 *   plans?: unknown[];
 *   currentPlanId?: string;
 *   currentPlanName?: string;
 *   loadingPlanId?: string;
 *   error?: string;
 *   paymentInstructions?: Record<string, unknown> | null;
 *   pendingPaymentRequest?: Record<string, unknown> | null;
 *   onPaymentProofSubmitted?: (...args: any[]) => any;
 *   onSubscribe?: (...args: any[]) => any;
 * }} props
 */
export default function EmpresaPlansCatalog({
  plans = [],
  currentPlanId,
  currentPlanName,
  loadingPlanId = '',
  error = '',
  paymentInstructions = null,
  pendingPaymentRequest = null,
  onPaymentProofSubmitted,
  onSubscribe,
}) {
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [proofModalOpen, setProofModalOpen] = useState(false);
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);
  const catalog = getEmpresaPlanCatalog(plans);
  const normalizedCurrentPlanId = normalizeEmpresaPlanId(
    currentPlanId,
    currentPlanName,
  );
  const hasExactCurrentPlan = catalog.some(
    (plan) =>
      plan.id === currentPlanId ||
      plan.sourcePlanId === currentPlanId ||
      (currentPlanName && plan.name === currentPlanName),
  );
  const isBusy = Boolean(loadingPlanId);
  const dialogOpen = Boolean(
    selectedPlan || (proofModalOpen && pendingPaymentRequest),
  );

  useEffect(() => {
    if (!dialogOpen) return undefined;

    const previouslyFocused = triggerRef.current || document.activeElement;
    const dialog = dialogRef.current;
    const focusTimer = window.setTimeout(() => {
      dialog?.querySelector(FOCUSABLE_SELECTOR)?.focus();
    }, 0);

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isBusy) {
        setSelectedPlan(null);
        setProofModalOpen(false);
        return;
      }

      if (event.key !== 'Tab' || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.classList.add('modal-open');

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.classList.remove('modal-open');
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [dialogOpen, isBusy]);

  const startSubscription = (plan, trigger) => {
    if (!plan || isBusy) return;
    triggerRef.current = trigger;
    setSelectedPlan(plan);
  };

  const openProofModal = (trigger) => {
    triggerRef.current = trigger;
    setProofModalOpen(true);
  };

  const closeDialogs = () => {
    if (isBusy) return;
    setSelectedPlan(null);
    setProofModalOpen(false);
  };

  const confirmSubscription = async () => {
    if (!selectedPlan || isBusy) return;
    const result = await onSubscribe?.(
      selectedPlan.subscriptionPlanId ||
        selectedPlan.sourcePlanId ||
        selectedPlan.id,
    );
    setSelectedPlan(null);
    if (result?.status === 'awaiting_payment') {
      setProofModalOpen(true);
    }
  };

  const handleProofSubmitted = (updatedRequest) => {
    onPaymentProofSubmitted?.(updatedRequest);
    setProofModalOpen(false);
  };

  // Pedido cancelado pelo titular: deixa de haver pedido em aberto (o pai
  // guarda-o pelo mesmo callback).
  const handleRequestCancelled = () => {
    onPaymentProofSubmitted?.(null);
    setProofModalOpen(false);
  };

  return (
    <section className={styles.wrap} aria-labelledby="empresa-plans-title">
      <div className={styles.header}>
        <div className={styles.headerCopy}>
          <span className={styles.eyebrow}>Planos para empresas</span>
          <h1 className={styles.title} id="empresa-plans-title">
            Escolha o plano certo para recrutar
          </h1>
          <p>
            Compare os recursos, confirme a opção e acompanhe a validação do
            pagamento no mesmo espaço.
          </p>
        </div>
        {currentPlanName ? (
          <div className={styles.currentPlanBox}>
            <span>Plano atual</span>
            <strong>{currentPlanName}</strong>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className={`${styles.alert} ${styles.alertError}`} role="alert">
          {error}
        </div>
      ) : null}

      {pendingPaymentRequest ? (
        <div className={styles.pendingBanner} role="status">
          <span className={styles.pendingIcon} aria-hidden="true">
            <FiCreditCard />
          </span>
          <div className={styles.pendingTexts}>
            <strong>
              Pagamento por concluir
              {pendingPaymentRequest.planName
                ? `, plano ${pendingPaymentRequest.planName}`
                : ''}
            </strong>
            <span>
              Envie o comprovativo para a equipa validar e ativar o plano.
            </span>
          </div>
          <button
            type="button"
            className={styles.pendingAction}
            onClick={(event) => openProofModal(event.currentTarget)}
          >
            <FiUploadCloud aria-hidden="true" />
            Enviar comprovativo
          </button>
        </div>
      ) : null}

      <div className={styles.grid}>
        {catalog.map((plan) => {
          const subscriptionPlanId = plan.sourcePlanId || plan.id;
          const isCurrent = hasExactCurrentPlan
            ? plan.id === currentPlanId ||
              plan.sourcePlanId === currentPlanId ||
              (currentPlanName && plan.name === currentPlanName)
            : normalizedCurrentPlanId === plan.normalizedId ||
              normalizedCurrentPlanId === plan.id;
          const isLoading =
            loadingPlanId === subscriptionPlanId || loadingPlanId === plan.id;

          return (
            <article
              key={plan.id}
              className={`${styles.card} ${plan.popular ? styles.cardPopular : ''} ${isCurrent ? styles.cardCurrent : ''}`}
            >
              <div className={styles.cardTopline}>
                <h2 className={styles.planName}>{plan.name}</h2>
                {plan.popular ? (
                  <span className={styles.popularBadge}>Mais escolhido</span>
                ) : null}
              </div>
              <div className={styles.priceRow}>
                <span className={styles.price}>{plan.priceLabel}</span>
                {plan.pricePeriodLabel ? (
                  <span className={styles.pricePeriod}>
                    {plan.pricePeriodLabel}
                  </span>
                ) : null}
              </div>
              <p className={styles.summary}>{plan.description}</p>

              <ul className={styles.features}>
                {(plan.features || []).slice(0, 8).map((feature) => (
                  <li key={feature} className={styles.feature}>
                    <span className={styles.checkIcon} aria-hidden="true">
                      <FiCheck />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={`${styles.subscribeBtn} ${plan.popular ? styles.subscribeBtnPopular : ''} ${isCurrent ? styles.subscribeBtnCurrent : ''}`}
                onClick={(event) =>
                  startSubscription(
                    { ...plan, subscriptionPlanId },
                    event.currentTarget,
                  )
                }
                disabled={!onSubscribe || isCurrent || isBusy}
              >
                {isLoading
                  ? 'A processar'
                  : isCurrent
                    ? 'Plano atual'
                    : Number(plan.price) === 0
                      ? 'Começar gratuitamente'
                      : 'Escolher plano'}
              </button>
            </article>
          );
        })}
      </div>

      {selectedPlan ? (
        <div
          className={styles.overlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialogs();
          }}
        >
          <div
            className={styles.modal}
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="empresa-plan-confirm-title"
          >
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.modalStep}>Confirmar plano</span>
                <h2 id="empresa-plan-confirm-title">{selectedPlan.name}</h2>
                <p>Confirme os dados antes de criar o pedido.</p>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={closeDialogs}
                disabled={isBusy}
                aria-label="Fechar confirmação"
              >
                <FiX aria-hidden="true" />
              </button>
            </div>

            <div className={styles.planSummary}>
              <span>Valor mensal</span>
              <strong>{selectedPlan.priceLabel}</strong>
            </div>

            <p className={styles.modalNote}>
              {Number(selectedPlan.price) > 0
                ? 'Ao confirmar, criamos o pedido e abrimos o envio do comprovativo. O plano só fica ativo depois da validação.'
                : 'Este plano é ativado sem comprovativo de pagamento.'}
            </p>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={closeDialogs}
                disabled={isBusy}
              >
                Voltar
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={confirmSubscription}
                disabled={isBusy}
              >
                {loadingPlanId === selectedPlan.id
                  ? 'A criar pedido'
                  : 'Confirmar plano'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {proofModalOpen && pendingPaymentRequest ? (
        <div
          className={styles.overlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialogs();
          }}
        >
          <div
            className={`${styles.modal} ${styles.modalWide}`}
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="empresa-proof-title"
          >
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.modalStep}>Pagamento</span>
                <h2 id="empresa-proof-title">Enviar comprovativo</h2>
                <p>
                  Consulte os dados da transferência e anexe o ficheiro para
                  validação.
                </p>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={closeDialogs}
                aria-label="Fechar envio do comprovativo"
              >
                <FiX aria-hidden="true" />
              </button>
            </div>

            {paymentInstructions ? (
              <div className={styles.paymentHint}>
                <div>
                  <span>Valor</span>
                  <strong>
                    {paymentInstructions.amount} {paymentInstructions.currency}
                  </strong>
                </div>
                <div>
                  <span>Contacto de apoio</span>
                  <strong>
                    {paymentInstructions.email || 'Não configurado'}
                  </strong>
                </div>
              </div>
            ) : null}

            <div className={styles.modalBody}>
              <ManualPaymentProofCard
                request={pendingPaymentRequest}
                title="Comprovativo de pagamento"
                description="Aceitamos ficheiros PDF, JPG ou PNG até 10 MB."
                embedded
                onSubmitted={handleProofSubmitted}
                onCancelled={handleRequestCancelled}
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
