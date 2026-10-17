import { useEffect, useId, useRef, useState } from 'react';
import { FiAlertTriangle } from 'react-icons/fi';

import { pt } from '../../shared/i18n/pt';
import styles from '../../styles/JobReportPanel.module.css';

const t = pt.jobSafety;
const REASONS = Object.keys(t.reasons);

/**
 * F1.8/E9 — aviso de segurança e denúncia da vaga. A UI só recolhe; a
 * prioridade, a independência das denúncias e a ocultação automática são
 * decididas no servidor (`/api/reports`). O denunciante nunca vê se a vaga
 * foi ocultada (não revela a sanção).
 */
export default function JobReportPanel({ jobId, openSignal = 0, loginHref }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('ASKED_FOR_MONEY');
  const [details, setDetails] = useState('');
  const [state, setState] = useState({ kind: 'idle', message: '' });
  const formId = useId();
  const reasonRef = useRef(null);

  // O botão «Denunciar» já existente abre o mesmo painel com outro motivo.
  useEffect(() => {
    if (!openSignal) return;
    setReason('OTHER');
    setOpen(true);
  }, [openSignal]);

  useEffect(() => {
    if (open) reasonRef.current?.focus({ preventScroll: false });
  }, [open]);

  const openMoney = () => {
    setReason('ASKED_FOR_MONEY');
    setState({ kind: 'idle', message: '' });
    setOpen(true);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (state.kind === 'sending') return;
    setState({ kind: 'sending', message: '' });
    try {
      const { auth } = await import('../../lib/firebaseAuth');
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setState({ kind: 'login', message: t.loginRequired });
        return;
      }
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetType: 'JOB',
          targetId: jobId,
          reason,
          details,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setState({
          kind: 'error',
          message: data?.error?.message || t.failed,
        });
        return;
      }
      setDetails('');
      setOpen(false);
      setState({ kind: 'done', message: data.message || '' });
    } catch {
      setState({ kind: 'error', message: t.failed });
    }
  };

  return (
    <>
      <p className={styles.notice}>
        <strong>{t.notice}</strong> {t.noticeAction}
        <br />
        <button
          type="button"
          className={styles.moneyButton}
          onClick={openMoney}
          aria-expanded={open}
          aria-controls={formId}
        >
          <FiAlertTriangle aria-hidden="true" />
          {t.askedForMoney}
        </button>
      </p>

      {open ? (
        <form
          id={formId}
          className={styles.form}
          onSubmit={submit}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
          }}
          aria-label={t.reportTitle}
        >
          <p className={styles.title}>{t.reportTitle}</p>
          <label className={styles.label}>
            {t.reasonLabel}
            <select
              ref={reasonRef}
              className={styles.field}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            >
              {REASONS.map((key) => (
                <option key={key} value={key}>
                  {t.reasons[key]}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.label}>
            {t.detailsLabel}
            <textarea
              className={styles.field}
              rows={3}
              maxLength={2000}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
            />
          </label>
          <p className={styles.hint}>{t.detailsHint}</p>
          <div className={styles.actions}>
            <button
              type="submit"
              className={styles.primary}
              disabled={state.kind === 'sending'}
            >
              {state.kind === 'sending' ? t.sending : t.submit}
            </button>
            <button type="button" onClick={() => setOpen(false)}>
              {t.cancel}
            </button>
          </div>
        </form>
      ) : null}

      <div aria-live="polite">
        {state.kind === 'done' ||
        state.kind === 'error' ||
        state.kind === 'login' ? (
          <p
            className={`${styles.status} ${
              state.kind === 'error' ? styles.statusError : ''
            }`}
          >
            {state.message}{' '}
            {state.kind === 'login' ? <a href={loginHref}>{t.login}</a> : null}
          </p>
        ) : null}
      </div>
    </>
  );
}
