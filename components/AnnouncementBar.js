import { useEffect, useRef, useState } from 'react';
import { FiArrowRight, FiExternalLink, FiX } from 'react-icons/fi';
import { isContentExpired } from '../lib/contentPublication';
import { normalizeExternalUrl } from '../lib/externalUrl';
import { sanitizeRichHtml } from '../lib/sanitizeRichHtml';
import styles from '../styles/AnnouncementBar.module.css';

const DISMISSED_KEY = 'empregostp:announcement-dismissed';
const ROTATE_INTERVAL_MS = 7000;

function hasHtmlMarkup(content) {
  return /<\/?[a-z][\s\S]*>/i.test(String(content || ''));
}

function NewsDetailModal({ item, onClose }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const dialog = dialogRef.current;
    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !dialog) return;
      const focusable = [...dialog.querySelectorAll(focusableSelector)].filter(
        (element) => element.getClientRects().length > 0,
      );
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.body.classList.add('modal-open');
    document.addEventListener('keydown', handleKeyDown);
    window.requestAnimationFrame(() => {
      dialog?.querySelector('button')?.focus({ preventScroll: true });
    });

    return () => {
      document.body.classList.remove('modal-open');
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [onClose]);

  const paragraphs = String(item.content || '')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  // Links opcionais definidos pelo admin: formulário de inscrição e site externo.
  const formUrl = normalizeExternalUrl(item.formUrl);
  const siteUrl = normalizeExternalUrl(item.siteUrl);
  const hasActions = Boolean(formUrl || siteUrl);

  return (
    <div
      className={styles.modalOverlay}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-modal-title"
        tabIndex={-1}
      >
        <button
          type="button"
          className={styles.modalClose}
          onClick={onClose}
          aria-label="Fechar"
        >
          <FiX aria-hidden="true" />
        </button>
        <span className={styles.modalBadge}>{item.category}</span>
        <h2 id="announcement-modal-title" className={styles.modalTitle}>
          {item.title}
        </h2>
        {item.date ? <p className={styles.modalDate}>{item.date}</p> : null}
        <div className={styles.modalBody}>
          {item.content ? (
            hasHtmlMarkup(item.content) ? (
              <div
                dangerouslySetInnerHTML={{
                  __html: sanitizeRichHtml(item.content),
                }}
              />
            ) : paragraphs.length > 0 ? (
              paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))
            ) : (
              <p>{item.content}</p>
            )
          ) : hasActions ? null : (
            <p>Sem detalhes adicionais para esta atualização.</p>
          )}
        </div>
        {hasActions ? (
          <div className={styles.modalActions}>
            {formUrl ? (
              <a
                className={`${styles.modalAction} ${styles.modalActionPrimary}`}
                href={formUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Preencher o formulário (abre numa nova janela)"
              >
                Preencher formulário
                <FiExternalLink aria-hidden="true" />
              </a>
            ) : null}
            {siteUrl ? (
              <a
                className={`${styles.modalAction} ${styles.modalActionSecondary}`}
                href={siteUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Ir ao site (abre numa nova janela)"
              >
                Ir ao site
                <FiExternalLink aria-hidden="true" />
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function AnnouncementBar() {
  const [newsList, setNewsList] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dismissed, setDismissed] = useState(true);
  const [modalItem, setModalItem] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    let active = true;

    async function fetchNews() {
      try {
        const response = await fetch('/api/news');
        if (!response.ok) return;
        const json = await response.json();
        // A resposta é cacheada até 5 minutos: reconfirmamos o prazo aqui para
        // não mostrar um aviso que já expirou entretanto.
        const items = (Array.isArray(json.news) ? json.news : []).filter(
          (item) => !isContentExpired(item.expiresAt),
        );
        if (!active || items.length === 0) return;

        const dismissedId = window.localStorage.getItem(DISMISSED_KEY);
        setNewsList(items);
        setDismissed(dismissedId === items[0].id);
      } catch (error) {
        // Silencioso: a barra é um extra, não pode quebrar a navegação.
      }
    }

    fetchNews();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (dismissed || modalItem || newsList.length <= 1) {
      clearInterval(intervalRef.current);
      return undefined;
    }

    intervalRef.current = setInterval(() => {
      setActiveIndex((current) => (current + 1) % newsList.length);
    }, ROTATE_INTERVAL_MS);

    return () => clearInterval(intervalRef.current);
  }, [dismissed, modalItem, newsList.length]);

  if (newsList.length === 0 || dismissed) return null;

  const activeItem = newsList[activeIndex];

  function handleDismiss() {
    setDismissed(true);
    window.localStorage.setItem(DISMISSED_KEY, newsList[0].id);
  }

  return (
    <>
      <div className={styles.bar} role="region" aria-label="Aviso">
        <div className={styles.inner}>
          <span className={styles.badge}>{activeItem.category}</span>
          <p key={activeItem.id} className={styles.text}>
            {activeItem.title}
          </p>
          <button
            type="button"
            className={styles.cta}
            onClick={() => setModalItem(activeItem)}
          >
            Saiba mais
            <FiArrowRight aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          className={styles.close}
          onClick={handleDismiss}
          aria-label="Fechar aviso"
        >
          <FiX aria-hidden="true" />
        </button>
      </div>
      {modalItem ? (
        <NewsDetailModal item={modalItem} onClose={() => setModalItem(null)} />
      ) : null}
    </>
  );
}
