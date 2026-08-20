import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiDollarSign,
  FiMapPin,
  FiUsers,
} from 'react-icons/fi';
import styles from '../../styles/CompactJobCard.module.css';

function getInitials(value = '') {
  return (
    String(value || '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'ES'
  );
}

function LocationIcon() {
  return (
    <svg
      className={styles.locationIcon}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2.25a7.5 7.5 0 00-7.5 7.5c0 5.625 6.65 11.42 6.934 11.664a.85.85 0 001.132 0C12.85 21.17 19.5 15.375 19.5 9.75a7.5 7.5 0 00-7.5-7.5zm0 10.125a2.625 2.625 0 110-5.25 2.625 2.625 0 010 5.25z" />
    </svg>
  );
}

export default function CompactJobCard({
  href,
  title,
  badgeLabel,
  status = 'active',
  salary,
  companyName,
  companyLogo,
  imageAlt,
  metaItems = [],
  variant = 'light',
  className = '',
  actionLabel = '',
  actionHref = '',
  categoryLabel = '',
  modalityLabel = '',
  experienceLabel = '',
  publishedLabel = '',
  closingLabel = '',
  vacancyCount = 0,
  isFeatured = false,
  isVerified = false,
}) {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const variantClassName =
    variant === 'dark' ? styles.cardDark : styles.cardLight;
  const rootClassName = [
    styles.card,
    variantClassName,
    isNavigating ? styles.cardNavigating : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  const normalizedStatus = String(status || 'active')
    .trim()
    .toLowerCase();
  const isClosed = [
    'closed',
    'fechada',
    'inactive',
    'inativa',
    'expired',
    'expirada',
  ].includes(normalizedStatus);
  const statusLabel = isClosed ? 'Fechada' : 'Aberta';
  const locationItem = metaItems.find((item) =>
    item.icon?.includes('location'),
  );
  const contractItem = metaItems.find((item) =>
    item.icon?.includes('briefcase'),
  );
  const publishedItem = metaItems.find((item) => item.icon?.includes('clock'));
  const otherMetaItems = metaItems.filter(
    (item) =>
      !item.icon?.includes('location') &&
      !item.icon?.includes('briefcase') &&
      !item.icon?.includes('clock'),
  );
  const supplementalText = [
    `Estado: ${statusLabel}`,
    publishedItem?.text ? `Publicada: ${publishedItem.text}` : '',
    ...otherMetaItems.map((item) => item.text),
  ]
    .filter(Boolean)
    .join('. ');

  useEffect(() => {
    const resetNavigation = () => setIsNavigating(false);
    router.events.on('routeChangeError', resetNavigation);
    return () => router.events.off('routeChangeError', resetNavigation);
  }, [router.events]);

  const handleNavigation = (event) => {
    if (
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    setIsNavigating(true);
  };

  const companyIdentity = (
    <div className={styles.avatar}>
      {companyLogo ? (
        <Image
          src={companyLogo}
          alt={imageAlt || companyName || 'Empresa'}
          className={styles.logo}
          width={72}
          height={72}
          unoptimized
        />
      ) : (
        <span className={styles.initials}>{getInitials(companyName)}</span>
      )}
    </div>
  );

  if (actionLabel) {
    const listingTags = [
      {
        className: styles.contractTag,
        icon: <FiBriefcase aria-hidden="true" />,
        text: badgeLabel || contractItem?.text || 'Regime não informado',
      },
      modalityLabel
        ? {
            className: styles.modalityTag,
            text: modalityLabel,
          }
        : null,
      categoryLabel
        ? {
            className: styles.neutralTag,
            text: categoryLabel,
          }
        : null,
      experienceLabel
        ? {
            className: styles.neutralTag,
            text: experienceLabel,
          }
        : null,
    ].filter(Boolean);

    return (
      <article
        className={`${rootClassName} ${styles.listingCard}`}
        aria-busy={isNavigating || undefined}
      >
        <div className={styles.listingHeader}>
          {companyIdentity}

          <div className={styles.listingHeading}>
            {isFeatured ? (
              <span className={styles.featuredLabel}>Em destaque</span>
            ) : null}
            <Link
              href={href}
              className={styles.titleLink}
              prefetch
              onClick={handleNavigation}
            >
              <h3 className={styles.title}>{title}</h3>
            </Link>
            <p className={styles.listingCompanyName}>
              {companyName || 'Empresa'}
              {isVerified ? (
                <span
                  className={styles.verifiedCompany}
                  role="img"
                  aria-label="Empresa verificada"
                  title="Empresa verificada"
                >
                  <FiCheckCircle aria-hidden="true" />
                </span>
              ) : null}
            </p>
          </div>

          <span
            className={`${styles.statusPill} ${
              isClosed ? styles.statusClosed : styles.statusOpen
            }`}
          >
            {statusLabel}
          </span>
        </div>

        <div className={styles.listingPrimaryMeta}>
          <span className={styles.listingMetaItem}>
            <FiMapPin aria-hidden="true" />
            <span>{locationItem?.text || 'Localização não indicada'}</span>
          </span>
          <span className={styles.listingMetaItem}>
            <FiDollarSign aria-hidden="true" />
            <span>{salary || 'A combinar'}</span>
          </span>
        </div>

        <div
          className={styles.listingTags}
          aria-label="Características da vaga"
        >
          {listingTags.map((tag) => (
            <span
              key={`${tag.text}-${tag.className}`}
              className={`${styles.listingTag} ${tag.className}`}
            >
              {tag.icon}
              {tag.text}
            </span>
          ))}
        </div>

        <div className={styles.listingFooter}>
          <div className={styles.listingTimeline}>
            <span>
              <FiClock aria-hidden="true" />
              {publishedLabel ||
                (publishedItem?.text
                  ? `Publicada ${publishedItem.text}`
                  : 'Publicação recente')}
            </span>
            <span>
              <FiCalendar aria-hidden="true" />
              {closingLabel || 'Prazo não indicado'}
            </span>
            {Number(vacancyCount) > 1 ? (
              <span>
                <FiUsers aria-hidden="true" />
                {vacancyCount} posições
              </span>
            ) : null}
          </div>
          {isClosed ? (
            <span className={styles.applyTextDisabled} aria-disabled="true">
              Vaga encerrada
            </span>
          ) : (
            <Link
              href={actionHref || href}
              className={styles.applyTextLink}
              prefetch
              onClick={handleNavigation}
            >
              {actionLabel}
            </Link>
          )}
        </div>

        <span className={styles.srOnly}>{supplementalText}</span>
        <span className={styles.srOnly} aria-live="polite">
          {isNavigating ? 'A abrir detalhes da vaga...' : ''}
        </span>
      </article>
    );
  }

  return (
    <Link
      href={href}
      className={rootClassName}
      prefetch
      aria-busy={isNavigating || undefined}
      onClick={handleNavigation}
    >
      <h3 className={styles.title}>{title}</h3>

      <div className={styles.jobDetails}>
        <span className={styles.badge}>
          {badgeLabel || contractItem?.text || 'Regime não informado'}
        </span>
        <p className={styles.salary}>
          <span>Salário:</span> {salary || 'A combinar'}
        </p>
      </div>

      <div className={styles.company}>
        {companyIdentity}
        <div className={styles.companyDetails}>
          <p className={styles.companyName}>{companyName || 'Empresa'}</p>
          {locationItem?.text ? (
            <span className={styles.location}>
              <LocationIcon />
              {locationItem.text}
            </span>
          ) : null}
        </div>
      </div>

      <span className={styles.srOnly}>{supplementalText}</span>
      <span className={styles.srOnly} aria-live="polite">
        {isNavigating ? 'A abrir detalhes da vaga...' : ''}
      </span>
    </Link>
  );
}
