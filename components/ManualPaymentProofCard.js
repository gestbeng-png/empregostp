import { useMemo, useState } from 'react';
import { getAuth } from 'firebase/auth';
import PaymentMethodPicker from './payments/PaymentMethodPicker';
import useOnlinePaymentConfig from './payments/useOnlinePaymentConfig';
import {
  canChargeOnline,
  dobrasToEuroCents,
  formatEuroCents,
  formatPlanPrice,
} from '../lib/payments/currency';
import styles from '../styles/ManualPaymentProofCard.module.css';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const formatDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const sanitizeFileName = (value = '') => value.replace(/[^a-zA-Z0-9._-]/g, '-');

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () =>
      reject(new Error('Não foi possível ler o ficheiro selecionado.'));
    reader.readAsDataURL(file);
  });

/**
 * @param {{
 *   request: any;
 *   title?: string;
 *   description?: string;
 *   embedded?: boolean;
 *   initialMethod?: 'online' | 'transfer' | null;
 *   onSubmitted?: (request: any) => void;
 *   onCancelled?: (requestId: string) => void;
 * }} props
 */
export default function ManualPaymentProofCard({
  request,
  title = 'Enviar comprovativo',
  description = 'Depois da transferência, envie o comprovativo por aqui para revisão do administrador.',
  embedded = false,
  initialMethod = null,
  onSubmitted,
  onCancelled,
}) {
  const hasProof = Boolean(request?.paymentProof?.url);
  const [file, setFile] = useState(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const { onlineEnabled, loading: methodsLoading } = useOnlinePaymentConfig();
  const [method, setMethod] = useState(() =>
    hasProof
      ? 'transfer'
      : initialMethod ||
        (request?.paymentMethod === 'stripe' ? 'online' : null),
  );
  const [redirecting, setRedirecting] = useState(false);

  const instructions = request?.paymentInstructions || {};
  const submittedAt =
    request?.paymentProof?.submittedAt || request?.updatedAt || null;

  const buttonLabel = useMemo(() => {
    if (submitting) return 'A enviar...';
    return hasProof ? 'Atualizar comprovativo' : 'Enviar comprovativo';
  }, [hasProof, submitting]);

  if (!request?.id) {
    return null;
  }

  const price = Number(instructions.amount || request.price || 0);
  // Pagamento online só para um pedido à espera de pagamento: depois de um
  // comprovativo de transferência, a decisão é do administrador.
  const onlineAvailable =
    onlineEnabled &&
    request.status === 'pending' &&
    !hasProof &&
    canChargeOnline(price);
  // Nunca mostrar a transferência por defeito enquanto o Stripe carrega ou
  // está indisponível. A escolha manual tem de ser explícita.
  const activeMethod =
    hasProof || method === 'transfer'
      ? 'transfer'
      : method === 'online' && onlineAvailable
        ? 'online'
        : null;
  const euroLabel = formatEuroCents(dobrasToEuroCents(price));

  const handleOnlinePayment = async () => {
    setError('');
    setRedirecting(true);
    try {
      const token = await getAuth().currentUser?.getIdToken();
      if (!token)
        throw new Error('A sessão terminou. Inicie sessão novamente.');
      const response = await fetch('/api/payments/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ requestId: request.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) {
        throw new Error(
          data.error || 'Não foi possível abrir o pagamento online.',
        );
      }
      window.location.assign(data.url);
    } catch (paymentError) {
      setError(
        paymentError.message || 'Não foi possível abrir o pagamento online.',
      );
      setRedirecting(false);
    }
  };

  // Só antes do comprovativo: depois, a decisão é do administrador.
  const canCancel =
    typeof onCancelled === 'function' &&
    request.status === 'pending' &&
    !hasProof;

  const handleCancel = async () => {
    setError('');
    setCancelling(true);
    try {
      const token = await getAuth().currentUser?.getIdToken();
      if (!token)
        throw new Error('A sessão terminou. Inicie sessão novamente.');
      const response = await fetch(
        `/api/subscription-requests/${encodeURIComponent(request.id)}/cancel`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível cancelar o pedido.');
      }
      setConfirmingCancel(false);
      onCancelled(request.id);
    } catch (cancelError) {
      setError(cancelError.message || 'Não foi possível cancelar o pedido.');
    } finally {
      setCancelling(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!file) {
      setError('Selecione um ficheiro PDF, JPG ou PNG.');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError('O comprovativo deve ter no máximo 10 MB.');
      return;
    }

    try {
      setSubmitting(true);
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        setError('A sessão expirou. Inicie sessão novamente.');
        return;
      }

      const token = await user.getIdToken();
      const fileBase64 = await readFileAsDataUrl(file);
      const safeName = sanitizeFileName(
        file.name || `comprovativo-${Date.now()}`,
      );

      const response = await fetch(
        `/api/subscription-requests/${request.id}/payment-proof`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            fileBase64,
            proofName: safeName,
            note,
            contentType: file.type || '',
            size: file.size,
          }),
        },
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          data.error ||
            data.message ||
            'Não foi possível enviar o comprovativo.',
        );
      }

      setSuccess(
        'Comprovativo enviado com sucesso. Aguarde a revisão do administrador.',
      );
      setFile(null);
      setNote('');
      onSubmitted?.(data.request || null);
    } catch (uploadError) {
      setError(
        uploadError.message || 'Não foi possível enviar o comprovativo.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className={`${styles.card} ${embedded ? styles.embedded : ''}`}>
      <div className={styles.header}>
        <div>
          <h3>
            {!activeMethod
              ? 'Como quer pagar?'
              : activeMethod === 'online'
                ? 'Pagamento online'
                : title}
          </h3>
          <p>
            {activeMethod === 'online'
              ? 'Pague com cartão ou PayPal e o plano fica ativo assim que o pagamento for confirmado.'
              : activeMethod === 'transfer'
                ? description
                : 'Escolha uma forma de pagamento para continuar.'}
          </p>
        </div>
        <span
          className={`${styles.status} ${hasProof ? styles.statusSubmitted : styles.statusPending}`}
        >
          {hasProof
            ? 'Comprovativo enviado'
            : !activeMethod
              ? 'Escolha o pagamento'
              : activeMethod === 'online'
                ? 'Aguardando pagamento'
                : 'Aguardando comprovativo'}
        </span>
      </div>

      {!hasProof ? (
        <PaymentMethodPicker
          name={`payment-method-${request.id}`}
          value={activeMethod}
          onChange={(value) => {
            setMethod(value);
            setError('');
          }}
          onlineAvailable={onlineAvailable}
          loading={methodsLoading}
          disabled={submitting || redirecting || cancelling}
        />
      ) : null}

      <div className={styles.metaGrid}>
        <div>
          <span>Plano</span>
          <strong>{request.planName || request.planId}</strong>
        </div>
        <div>
          <span>Valor</span>
          <strong>
            {/* A moeda nunca vem do pedido guardado: pedidos antigos têm
                "Dobras" gravado e passariam a divergir do resto do site. */}
            {activeMethod === 'online'
              ? `${euroLabel} (${formatPlanPrice(price)})`
              : formatPlanPrice(price)}
          </strong>
        </div>
        {activeMethod === 'transfer' ? (
          <div>
            <span>Email</span>
            <strong>{instructions.email || 'Não configurado'}</strong>
          </div>
        ) : null}
        {submittedAt && (
          <div>
            <span>Último envio</span>
            <strong>{formatDateTime(submittedAt)}</strong>
          </div>
        )}
      </div>

      {activeMethod === 'online' ? (
        <div className={styles.onlinePanel}>
          <p>
            Vai ser levado para a página de pagamento segura do Stripe. O valor
            é cobrado em euros ao câmbio fixo de 24,5 STD por euro.
          </p>
          <button
            type="button"
            className={styles.action}
            onClick={handleOnlinePayment}
            disabled={redirecting}
          >
            {redirecting ? 'A abrir o pagamento…' : `Pagar ${euroLabel}`}
          </button>
        </div>
      ) : null}

      {activeMethod === 'transfer' &&
        (instructions.accountNumber ||
          instructions.accountName ||
          instructions.bankName ||
          instructions.message) && (
          <div className={styles.instructionsBox}>
            {instructions.accountNumber && (
              <p>
                <strong>Conta:</strong> {instructions.accountNumber}
              </p>
            )}
            {instructions.accountName && (
              <p>
                <strong>Titular:</strong> {instructions.accountName}
              </p>
            )}
            {instructions.bankName && (
              <p>
                <strong>Banco:</strong> {instructions.bankName}
              </p>
            )}
            {instructions.message && <p>{instructions.message}</p>}
          </div>
        )}

      {hasProof && (
        <div className={styles.previousProof}>
          <p>
            <strong>Ficheiro atual:</strong>{' '}
            <a href={request.paymentProof.url} target="_blank" rel="noreferrer">
              {request.paymentProof.name || 'Abrir comprovativo'}
            </a>
          </p>
          {request.paymentProof.note && (
            <p>
              <strong>Nota:</strong> {request.paymentProof.note}
            </p>
          )}
        </div>
      )}

      {error && (
        <div className={styles.errorBox} role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className={styles.successBox} role="status">
          {success}
        </div>
      )}

      {activeMethod === 'transfer' ? (
        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.fileField}>
            <span>Ficheiro</span>
            <input
              type="file"
              accept=".pdf,image/png,image/jpeg,image/jpg"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
          </label>

          <label className={styles.noteField}>
            <span>Observação opcional</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ex.: transferência feita pelo BAI às 10:32"
              rows={3}
            />
          </label>

          <button type="submit" className={styles.action} disabled={submitting}>
            {buttonLabel}
          </button>
        </form>
      ) : null}

      {canCancel ? (
        <div className={styles.cancelRow}>
          {confirmingCancel ? (
            <>
              <span>
                Cancelar este pedido? Pode escolher outro plano a seguir.
              </span>
              <button
                type="button"
                className={styles.secondaryAction}
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? 'A cancelar...' : 'Sim, cancelar pedido'}
              </button>
              <button
                type="button"
                className={styles.secondaryAction}
                onClick={() => setConfirmingCancel(false)}
                disabled={cancelling}
              >
                Manter pedido
              </button>
            </>
          ) : (
            <button
              type="button"
              className={styles.secondaryAction}
              onClick={() => setConfirmingCancel(true)}
            >
              Cancelar pedido
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}
