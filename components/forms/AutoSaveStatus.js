import {
  FiAlertCircle,
  FiCheckCircle,
  FiCloud,
  FiLoader,
  FiWifiOff,
} from 'react-icons/fi';
import styles from '../../styles/AutoSaveStatus.module.css';

const STATUS_COPY = {
  idle: 'Gravação automática ativa',
  restoring: 'A procurar rascunho…',
  restored: 'Rascunho recuperado',
  saving: 'A guardar…',
  saved: 'Guardado online',
  local: 'Guardado neste dispositivo',
  offline: 'Guardado offline',
  error: 'Não foi possível guardar',
};

function renderStatusIcon(status, className) {
  if (status === 'saving' || status === 'restoring') {
    return <FiLoader className={className} aria-hidden="true" />;
  }
  if (status === 'saved' || status === 'restored') {
    return <FiCheckCircle className={className} aria-hidden="true" />;
  }
  if (status === 'offline' || status === 'local') {
    return <FiWifiOff className={className} aria-hidden="true" />;
  }
  if (status === 'error') {
    return <FiAlertCircle className={className} aria-hidden="true" />;
  }
  return <FiCloud className={className} aria-hidden="true" />;
}

function formatSavedTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-PT', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default function AutoSaveStatus({
  status = 'idle',
  lastSavedAt = '',
  isOnline = true,
  className = '',
}) {
  const effectiveStatus = !isOnline && status === 'saved' ? 'offline' : status;
  const savedTime = formatSavedTime(lastSavedAt);
  const showTime =
    savedTime && ['saved', 'local', 'offline', 'restored'].includes(effectiveStatus);

  return (
    <span
      className={`${styles.root} ${styles[effectiveStatus] || ''} ${className}`}
      role="status"
      aria-live="polite"
      title="As alterações são guardadas neste dispositivo e sincronizadas online quando existe ligação."
    >
      {renderStatusIcon(
        effectiveStatus,
        `${styles.icon} ${
          effectiveStatus === 'saving' || effectiveStatus === 'restoring'
            ? styles.spinning
            : ''
        }`,
      )}
      <span>{STATUS_COPY[effectiveStatus] || STATUS_COPY.idle}</span>
      {showTime ? (
        <time className={styles.time} dateTime={lastSavedAt}>
          {savedTime}
        </time>
      ) : null}
    </span>
  );
}
