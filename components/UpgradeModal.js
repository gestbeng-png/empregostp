import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { getCandidateUpgradePlans } from '../lib/candidateCatalog';
import styles from '../styles/UpgradeModal.module.css';

/**
 * Modal exibido quando o utilizador atinge o limite do plano.
 * Usado em páginas de vaga e no dashboard candidato.
 */
export default function UpgradeModal({
  isOpen,
  onClose,
  message,
  upgradeUrl = '/premium/candidatos',
  userType = 'candidato',
}) {
  const modalRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previouslyFocused = document.activeElement;
    const modal = modalRef.current;
    const focusableSelector =
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !modal) return;

      const focusable = [...modal.querySelectorAll(focusableSelector)].filter(
        (element) => element.getClientRects().length > 0,
      );
      if (!focusable.length) {
        event.preventDefault();
        modal.focus();
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
      modal?.querySelector('button')?.focus({ preventScroll: true });
    });

    return () => {
      document.body.classList.remove('modal-open');
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const plans =
    userType === 'empresa'
      ? [
          {
            name: 'Profissional',
            price: '100 Db/mês',
            highlight: [
              '5 vagas ativas',
              '1 destaque',
              'Exportar candidaturas',
              'Suporte prioritário',
            ],
          },
          {
            name: 'PRO',
            price: '2000 Db/mês',
            highlight: [
              'Vagas ilimitadas',
              'Mensagens diretas com candidatos',
              'Analytics completos',
              'Banco de talentos',
            ],
            popular: true,
          },
        ]
      : getCandidateUpgradePlans();

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        ref={modalRef}
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-title"
        aria-describedby="upgrade-modal-message"
        tabIndex={-1}
      >
        <button
          type="button"
          onClick={onClose}
          className={styles.close}
          aria-label="Fechar"
        >
          ×
        </button>

        <div className={styles.header}>
          <div className={styles.icon} aria-hidden="true">
            🚀
          </div>
          <h2 id="upgrade-modal-title" className={styles.title}>
            Limite atingido
          </h2>
          <p id="upgrade-modal-message" className={styles.message}>
            {message ||
              'Faça upgrade para continuar a candidatar-se a mais vagas.'}
          </p>
        </div>

        <div className={styles.plans}>
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`${styles.plan}${plan.popular ? ` ${styles.planPopular}` : ''}`}
            >
              {plan.popular && (
                <span className={styles.popularBadge}>MAIS POPULAR</span>
              )}
              <p className={styles.planName}>{plan.name}</p>
              <p className={styles.price}>{plan.price}</p>
              <ul className={styles.features}>
                {plan.highlight.map((feat) => (
                  <li key={feat} className={styles.feature}>
                    <span className={styles.check} aria-hidden="true">
                      ✓
                    </span>
                    {feat}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Link href={upgradeUrl} className={styles.upgrade}>
          Ver Planos e Fazer Upgrade
        </Link>
      </div>
    </div>
  );
}
