import Link from 'next/link';
import { getCandidateUpgradePlans } from '../lib/candidateCatalog';
import styles from '../styles/UpgradeModal.module.css';

/**
 * Modal exibido quando o utilizador atinge o limite do plano.
 * Usado em páginas de vaga e no dashboard candidato.
 */
export default function UpgradeModal({ isOpen, onClose, message, upgradeUrl = '/premium/candidatos', userType = 'candidato' }) {
  if (!isOpen) return null;

  const plans = userType === 'empresa'
    ? [
        { name: 'Profissional', price: '100 Db/mês', highlight: ['5 vagas ativas', '1 destaque', 'Exportar candidaturas', 'Suporte prioritário'] },
        { name: 'PRO', price: '2000 Db/mês', highlight: ['Vagas ilimitadas', 'Mensagens diretas com candidatos', 'Analytics completos', 'Banco de talentos'], popular: true }
      ]
    : getCandidateUpgradePlans();

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-title"
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
          <div className={styles.icon} aria-hidden="true">🚀</div>
          <h2 id="upgrade-modal-title" className={styles.title}>
            Limite atingido
          </h2>
          <p className={styles.message}>
            {message || 'Faça upgrade para continuar a candidatar-se a mais vagas.'}
          </p>
        </div>

        <div className={styles.plans}>
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`${styles.plan}${plan.popular ? ` ${styles.planPopular}` : ''}`}
            >
              {plan.popular && (
                <span className={styles.popularBadge}>
                  MAIS POPULAR
                </span>
              )}
              <p className={styles.planName}>{plan.name}</p>
              <p className={styles.price}>{plan.price}</p>
              <ul className={styles.features}>
                {plan.highlight.map((feat) => (
                  <li key={feat} className={styles.feature}>
                    <span className={styles.check} aria-hidden="true">✓</span>
                    {feat}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Link
          href={upgradeUrl}
          className={styles.upgrade}
        >
          Ver Planos e Fazer Upgrade
        </Link>
      </div>
    </div>
  );
}
