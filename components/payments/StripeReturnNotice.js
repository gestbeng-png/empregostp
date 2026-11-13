import { useEffect, useRef, useState } from 'react';
// A versão compat devolve null fora de uma página (ex.: testes isolados).
import { useRouter } from 'next/compat/router';
import { getAuth } from 'firebase/auth';
import styles from '../../styles/ManualPaymentProofCard.module.css';

const MAX_ATTEMPTS = 6;
const RETRY_DELAY_MS = 2500;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function confirmSession(sessionId) {
  // No regresso do Stripe a página carrega de novo: esperar pela sessão.
  const auth = getAuth();
  await auth.authStateReady();
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('A sessão terminou. Inicie sessão novamente.');
  const response = await fetch('/api/payments/stripe/confirm', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ sessionId }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Não foi possível confirmar o pagamento.');
  }
  return data;
}

/**
 * Mostra o resultado de um pagamento quando o utilizador volta do Stripe
 * (`?pagamento=stripe&session_id=…` ou `?pagamento=cancelado`) e limpa o URL.
 */
export default function StripeReturnNotice({ onApproved }) {
  const router = useRouter();
  const [notice, setNotice] = useState(null);
  const handledRef = useRef(false);
  const mountedRef = useRef(true);
  const onApprovedRef = useRef(onApproved);

  useEffect(() => {
    onApprovedRef.current = onApproved;
  }, [onApproved]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!router?.isReady || handledRef.current) return undefined;
    const outcome = String(router.query.pagamento || '');
    if (!outcome) return undefined;
    handledRef.current = true;
    const active = () => mountedRef.current;

    const cleanQuery = { ...router.query };
    delete cleanQuery.pagamento;
    delete cleanQuery.session_id;
    router.replace(
      { pathname: router.pathname, query: cleanQuery },
      undefined,
      {
        shallow: true,
        scroll: false,
      },
    );

    if (outcome === 'cancelado') {
      setNotice({
        tone: 'info',
        text: 'Pagamento cancelado. Não foi cobrado nada; pode tentar de novo ou pagar por transferência.',
      });
      return undefined;
    }

    const sessionId = String(router.query.session_id || '');
    if (outcome !== 'stripe' || !sessionId) return undefined;

    setNotice({ tone: 'info', text: 'A confirmar o pagamento…' });
    (async () => {
      try {
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
          const result = await confirmSession(sessionId);
          if (!active()) return;
          if (result.status === 'approved') {
            setNotice({
              tone: 'success',
              text: result.planName
                ? `Pagamento confirmado. O plano ${result.planName} já está ativo.`
                : 'Pagamento confirmado. O plano já está ativo.',
            });
            onApprovedRef.current?.();
            return;
          }
          if (result.status === 'incident') {
            setNotice({
              tone: 'error',
              text: 'Recebemos o pagamento mas não conseguimos ativar o plano automaticamente. A equipa foi avisada e vai resolver; contacte o suporte se precisar.',
            });
            return;
          }
          if (attempt < MAX_ATTEMPTS) await wait(RETRY_DELAY_MS);
        }
        if (active()) {
          setNotice({
            tone: 'info',
            text: 'O pagamento ainda está a ser processado. O plano é ativado automaticamente assim que for confirmado.',
          });
        }
      } catch (error) {
        if (active()) setNotice({ tone: 'error', text: error.message });
      }
    })();
    return undefined;
  }, [router]);

  if (!notice) return null;
  const className =
    notice.tone === 'error'
      ? styles.errorBox
      : notice.tone === 'success'
        ? styles.successBox
        : styles.infoBox;
  return (
    <div
      className={className}
      role={notice.tone === 'error' ? 'alert' : 'status'}
    >
      {notice.text}
    </div>
  );
}
