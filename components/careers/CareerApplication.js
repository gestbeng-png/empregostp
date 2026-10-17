import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import styles from '../../styles/CarreiraPage.module.css';

function readPdf(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () =>
      reject(
        new Error(
          'Não foi possível ler o currículo. Selecione novamente o ficheiro.',
        ),
      );
    reader.readAsDataURL(file);
  });
}
export default function CareerApplication({ open, setOpen }) {
  const [status, setStatus] = useState({ state: 'idle', message: '' });
  const [fileError, setFileError] = useState('');
  const sending = useRef(false);
  useEffect(() => {
    const checkHash = () => {
      if (window.location.hash === '#candidatura') setOpen(true);
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, [setOpen]);
  function validateFile(input) {
    const file = input.files?.[0];
    const error =
      file &&
      (!/\.pdf$/i.test(file.name) ||
        (file.type && file.type !== 'application/pdf'))
        ? 'Selecione um currículo em PDF.'
        : file && file.size > 2 * 1024 * 1024
          ? 'O currículo deve ter no máximo 2 MB.'
          : '';
    input.setCustomValidity(error);
    setFileError(error);
    return !error;
  }
  async function submit(event) {
    event.preventDefault();
    if (sending.current) return;
    const form = event.currentTarget;
    if (!validateFile(form.elements.cv) || !form.reportValidity()) return;
    sending.current = true;
    setStatus({ state: 'loading', message: 'A enviar a sua candidatura…' });
    try {
      const values = new FormData(form);
      const file = form.elements.cv.files?.[0];
      const payload = Object.fromEntries(
        ['name', 'email', 'phone', 'area', 'portfolio', 'message'].map(
          (key) => [key, String(values.get(key) || '').trim()],
        ),
      );
      payload.consent = values.get('consent') === 'on';
      payload.consentVersion = 'careers-v1';
      if (file)
        payload.cv = {
          name: file.name,
          contentType: 'application/pdf',
          base64: await readPdf(file),
        };
      const response = await fetch('/api/careers/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (response.status !== 201)
        throw new Error(
          result.error ||
            'Não foi possível guardar a candidatura. Tente novamente.',
        );
      setStatus({
        state: 'success',
        message:
          result.message ||
          'Candidatura recebida. Obrigado pelo seu interesse.',
      });
      form.reset();
      setFileError('');
    } catch (error) {
      setStatus({
        state: 'error',
        message:
          error.message === 'Failed to fetch'
            ? 'Erro de ligação. A candidatura não foi confirmada. Tente novamente.'
            : error.message,
      });
    } finally {
      sending.current = false;
    }
  }
  return (
    <div
      id="career-application-form"
      hidden={!open}
      className={styles.application}
    >
      <h3>Candidatura espontânea</h3>
      <p>Os campos assinalados com * são obrigatórios.</p>
      <form
        className={styles.form}
        onSubmit={submit}
        aria-busy={status.state === 'loading'}
      >
        <div className={styles.formGrid}>
          <label className={styles.field} htmlFor="career-name">
            Nome completo *
            <input
              id="career-name"
              name="name"
              autoComplete="name"
              required
              minLength={2}
              maxLength={100}
              disabled={status.state === 'loading'}
            />
          </label>
          <label className={styles.field} htmlFor="career-email">
            Email *
            <input
              id="career-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              disabled={status.state === 'loading'}
            />
          </label>
          <label className={styles.field} htmlFor="career-phone">
            Telefone (opcional)
            <input
              id="career-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              minLength={5}
              maxLength={40}
              disabled={status.state === 'loading'}
            />
          </label>
          <label className={styles.field} htmlFor="career-area">
            Área profissional *
            <input
              id="career-area"
              name="area"
              required
              minLength={2}
              maxLength={120}
              disabled={status.state === 'loading'}
            />
          </label>
          <label
            className={`${styles.field} ${styles.fullWidth}`}
            htmlFor="career-portfolio"
          >
            LinkedIn ou portefólio (opcional)
            <input
              id="career-portfolio"
              name="portfolio"
              type="url"
              placeholder="https://"
              maxLength={2048}
              disabled={status.state === 'loading'}
            />
          </label>
          <label
            className={`${styles.field} ${styles.fullWidth}`}
            htmlFor="career-message"
          >
            Mensagem de apresentação *
            <textarea
              id="career-message"
              name="message"
              required
              minLength={10}
              maxLength={4000}
              rows={6}
              disabled={status.state === 'loading'}
            />
          </label>
          <label
            className={`${styles.field} ${styles.fullWidth}`}
            htmlFor="career-cv"
          >
            Currículo em PDF (opcional)
            <input
              id="career-cv"
              name="cv"
              type="file"
              accept=".pdf,application/pdf"
              aria-describedby="career-cv-help career-cv-error"
              aria-invalid={Boolean(fileError)}
              onChange={(event) => validateFile(event.target)}
              disabled={status.state === 'loading'}
            />
            <small id="career-cv-help">PDF, até 2 MB.</small>
            <span
              id="career-cv-error"
              className={fileError ? styles.error : undefined}
              role="alert"
            >
              {fileError}
            </span>
          </label>
        </div>
        <label className={styles.consent} htmlFor="career-consent">
          <input
            id="career-consent"
            name="consent"
            type="checkbox"
            required
            disabled={status.state === 'loading'}
          />
          <span>
            Consinto no tratamento dos meus dados pessoais e do currículo pelo
            Empregos STP para análise da candidatura e contacto no âmbito do
            recrutamento, nos termos da{' '}
            <Link href="/politica-privacidade">política de privacidade</Link>. *
          </span>
        </label>
        <p
          className={`${styles.status} ${status.state === 'error' ? styles.error : status.state === 'success' ? styles.success : ''}`}
          role={status.state === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {status.message}
        </p>
        <button
          className={styles.submit}
          type="submit"
          disabled={status.state === 'loading'}
        >
          {status.state === 'loading' ? 'A enviar…' : 'Enviar candidatura'}
        </button>
      </form>
    </div>
  );
}
