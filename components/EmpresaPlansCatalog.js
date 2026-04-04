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
  const catalog = getEmpresaPlanCatalog(plans);
  const normalizedCurrentPlanId = normalizeEmpresaPlanId(currentPlanId, currentPlanName);
  const hasExactCurrentPlan = catalog.some(
    (plan) => plan.id === currentPlanId || (currentPlanName && plan.name === currentPlanName)
  );

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div>
          <h2>Planos</h2>
          <p>Escolha o plano que conecta mais talentos ao seu time</p>
        </div>
        {currentPlanName && (
          <div className={styles.currentPlanBox}>
            <span>Plano atual</span>
            <strong>{currentPlanName}</strong>
          </div>
        )}
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}

      {paymentInstructions && (
        <div className={styles.infoBox}>
          <p><strong>Valor:</strong> {paymentInstructions.amount} {paymentInstructions.currency}</p>
          <p><strong>Email de suporte:</strong> {paymentInstructions.email}</p>
          <p>{paymentInstructions.message}</p>
          <p>Depois da transferência, envie o comprovativo abaixo para validação manual.</p>
        </div>
      )}

      {pendingPaymentRequest && (
        <ManualPaymentProofCard
          request={pendingPaymentRequest}
          title="Pagamento manual"
          description="O pagamento continua manual. Faça a transferência e anexe o comprovativo para aprovação do administrador."
          onSubmitted={onPaymentProofSubmitted}
        />
      )}

      <div className={styles.grid}>
        {catalog.map((plan) => {
          const isCurrent = hasExactCurrentPlan
            ? plan.id === currentPlanId || (currentPlanName && plan.name === currentPlanName)
            : normalizedCurrentPlanId === plan.normalizedId || normalizedCurrentPlanId === plan.id;
          const isLoading = loadingPlanId === plan.id;

          return (
            <article key={plan.id} className={`${styles.card} ${plan.popular ? styles.cardPopular : ''}`}>
              {plan.popular && <span className={styles.badge}>Plano mais escolhido</span>}
              <h3>{plan.name}</h3>
              <p className={styles.description}>{plan.description}</p>
              <p className={styles.price} style={{ color: plan.accent }}>{plan.priceLabel}</p>
              <ul className={styles.featureList}>
                {(plan.features || []).map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <button
                type="button"
                className={styles.action}
                onClick={() => onSubscribe?.(plan.id)}
                disabled={!onSubscribe || isCurrent || Boolean(loadingPlanId)}
              >
                {isLoading
                  ? 'Processando...'
                  : isCurrent
                    ? 'Plano ativo'
                    : plan.price === 0
                      ? 'Começar com este plano'
                      : 'Assinar plano'}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
