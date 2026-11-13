import styles from '../../styles/ManualPaymentProofCard.module.css';

export default function PaymentMethodPicker({
  name,
  value,
  onChange,
  onlineAvailable,
  loading = false,
  disabled = false,
}) {
  if (loading) return <p role="status">A carregar formas de pagamento…</p>;
  return (
    <div
      className={styles.methodPicker}
      role="radiogroup"
      aria-label="Forma de pagamento"
    >
      {onlineAvailable ? (
        <label
          className={`${styles.methodOption} ${value === 'online' ? styles.methodOptionActive : ''}`}
        >
          <input
            type="radio"
            name={name}
            value="online"
            checked={value === 'online'}
            disabled={disabled}
            onChange={() => onChange('online')}
          />
          <span className={styles.methodText}>
            <strong>Cartão ou PayPal</strong>
            <small>Pagamento imediato, ativação automática</small>
            <span className={styles.methodBrands} aria-hidden="true">
              <span>Visa</span>
              <span>Mastercard</span>
              <span>PayPal</span>
              <span>Apple Pay</span>
              <span>Google Pay</span>
            </span>
          </span>
        </label>
      ) : null}
      <label
        className={`${styles.methodOption} ${value === 'transfer' ? styles.methodOptionActive : ''}`}
      >
        <input
          type="radio"
          name={name}
          value="transfer"
          checked={value === 'transfer'}
          disabled={disabled}
          onChange={() => onChange('transfer')}
        />
        <span className={styles.methodText}>
          <strong>Transferência bancária</strong>
          <small>Pagamento manual: envie o comprovativo para análise</small>
        </span>
      </label>
    </div>
  );
}
