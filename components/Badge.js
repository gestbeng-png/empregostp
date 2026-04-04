import styles from '../styles/Badge.module.css';

const Badge = ({ status }) => {
  const normalized = (status || '').toString().toLowerCase();
  const isClosed = ['closed', 'fechada', 'inactive', 'inativa', 'disabled', 'desativada'].includes(normalized);
  const isUrgent = ['urgent', 'urgente', 'destaque'].includes(normalized);
  const label = isClosed ? 'FECHADA' : isUrgent ? 'URGENTE' : 'ABERTA';
  const variantClass = isClosed ? styles.badgeClosed : isUrgent ? styles.badgeUrgent : styles.badgeOpen;
  const dotClass = isClosed ? styles.dotClosed : isUrgent ? styles.dotUrgent : styles.dotOpen;

  return (
    <span className={`${styles.badge} ${variantClass}`}>
      <span className={`${styles.dot} ${dotClass}`} />
      {label}
    </span>
  );
};

export default Badge;
