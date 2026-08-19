import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import styles from '../../styles/JobAlertUnsubscribe.module.css';

export default function CancelarAlertaPage() {
  const [credentials, setCredentials] = useState(null);
  const [state, setState] = useState('checking');
  const [message, setMessage] = useState('');
  const hashReadRef = useRef(false);

  useEffect(() => {
    // Em desenvolvimento, React pode repetir Effects para detetar efeitos
    // laterais. Como o fragmento é apagado logo abaixo, uma segunda leitura
    // converteria um link válido em “inválido”. Processá-lo uma só vez torna
    // o fluxo determinístico em Strict Mode e produção.
    if (hashReadRef.current) return;
    hashReadRef.current = true;

    const params = new URLSearchParams(window.location.hash.slice(1));
    const alertId = params.get('alert') || '';
    const token = params.get('token') || '';

    // O token fica no fragmento para não ser enviado ao servidor nem em
    // cabeçalhos Referer. Retirá-lo imediatamente também reduz exposição em
    // capturas de ecrã e no histórico do browser.
    window.history.replaceState(null, '', '/alertas/cancelar');

    if (!alertId || !token) {
      setState('invalid');
      return;
    }

    setCredentials({ alertId, token });
    setState('ready');
  }, []);

  const handleUnsubscribe = async () => {
    if (!credentials || state === 'loading') return;
    setState('loading');
    setMessage('');

    try {
      const response = await fetch('/api/job-alerts/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          data.error || 'Não foi possível cancelar o alerta. Tente novamente.',
        );
      }

      setCredentials(null);
      setMessage(data.message || 'O alerta foi cancelado com sucesso.');
      setState('success');
    } catch (error) {
      setMessage(
        error?.message || 'Não foi possível cancelar o alerta. Tente novamente.',
      );
      setState('error');
    }
  };

  const isInvalid = state === 'invalid';
  const isSuccess = state === 'success';

  return (
    <>
      <Head>
        <title>Cancelar alerta de vagas - EmpregoSTP</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="referrer" content="no-referrer" />
      </Head>
      <main className={styles.page}>
        <section className={styles.card} aria-labelledby="cancel-alert-title">
          <span className={styles.eyebrow}>Alertas de vagas</span>
          <h1 id="cancel-alert-title">
            {isSuccess ? 'Alerta cancelado' : 'Cancelar este alerta?'}
          </h1>

          {state === 'checking' ? (
            <p role="status">A validar o link de cancelamento…</p>
          ) : isInvalid ? (
            <p role="alert">
              Este link é inválido ou está incompleto. Use o link incluído no
              email do alerta.
            </p>
          ) : isSuccess ? (
            <p role="status">{message}</p>
          ) : (
            <>
              <p>
                Depois de confirmar, deixará de receber emails para esta
                pesquisa. Esta ação não altera as notificações da sua conta.
              </p>
              {state === 'error' ? <p role="alert">{message}</p> : null}
              <button
                type="button"
                className={styles.dangerButton}
                onClick={handleUnsubscribe}
                disabled={state === 'loading'}
              >
                {state === 'loading' ? 'A cancelar…' : 'Confirmar cancelamento'}
              </button>
            </>
          )}

          <Link href="/vagas" className={styles.backLink}>
            Voltar às vagas
          </Link>
        </section>
      </main>
    </>
  );
}
