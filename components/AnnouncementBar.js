import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { FiArrowRight, FiX } from 'react-icons/fi';
import { isContentExpired } from '../lib/contentPublication';
import styles from '../styles/AnnouncementBar.module.css';

const DISMISSED_KEY = 'empregostp:announcement-dismissed';
const ROTATE_INTERVAL_MS = 7000;
const loadDetailModal = () => import('./AnnouncementDetailModal');
const NewsDetailModal = dynamic(loadDetailModal);

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
            onPointerEnter={() => void loadDetailModal()}
            onFocus={() => void loadDetailModal()}
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
