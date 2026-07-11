import Link from "next/link";
import styles from "../../styles/CompactJobCard.module.css";

function getInitials(value = "") {
  return (
    String(value || "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "ES"
  );
}

function MetaIcon({ icon }) {
  if (icon?.includes("location")) {
    return (
      <svg className={styles.metaIcon} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.25a7.5 7.5 0 00-7.5 7.5c0 5.625 6.65 11.42 6.934 11.664a.85.85 0 001.132 0C12.85 21.17 19.5 15.375 19.5 9.75a7.5 7.5 0 00-7.5-7.5zm0 10.125a2.625 2.625 0 110-5.25 2.625 2.625 0 010 5.25z" />
      </svg>
    );
  }

  if (icon?.includes("briefcase")) {
    return (
      <svg className={styles.metaIcon} viewBox="0 0 24 24" fill="currentColor">
        <path d="M9 3.75A2.25 2.25 0 006.75 6v.75H4.5A2.25 2.25 0 002.25 9v8.25A2.25 2.25 0 004.5 19.5h15A2.25 2.25 0 0021.75 17.25V9A2.25 2.25 0 0019.5 6.75h-2.25V6A2.25 2.25 0 0015 3.75H9zm6.75 3H8.25V6A.75.75 0 019 5.25h6a.75.75 0 01.75.75v.75z" />
      </svg>
    );
  }

  if (icon?.includes("clock")) {
    return (
      <svg className={styles.metaIcon} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.25A9.75 9.75 0 1021.75 12 9.761 9.761 0 0012 2.25zm.75 5.25a.75.75 0 00-1.5 0V12a.75.75 0 00.33.623l3 2a.75.75 0 10.84-1.246l-2.67-1.78V7.5z" />
      </svg>
    );
  }

  return null;
}

export default function CompactJobCard({
  href,
  title,
  badgeLabel,
  status = "active",
  salary,
  companyName,
  companyLogo,
  imageAlt,
  metaItems = [],
  className = "",
  variant = "dark",
}) {
  const variantClassName = variant === "light" ? styles.cardLight : "";
  const rootClassName = [styles.card, variantClassName, className]
    .filter(Boolean)
    .join(" ");
  const isClosed = status && String(status).toLowerCase() !== "active";
  const statusLabel = isClosed ? "Fechada" : "Aberta";
  const statusClassName = isClosed ? styles.statusClosed : styles.statusOpen;

  return (
    <Link href={href} className={rootClassName}>
      <div className={styles.ribbonRow}>
        {badgeLabel ? (
          <span className={styles.badge}>{badgeLabel}</span>
        ) : (
          <span className={styles.badgeMuted}>Vaga</span>
        )}
        <span className={`${styles.statusBadge} ${statusClassName}`}>
          <span className={styles.statusDot} aria-hidden="true" />
          {statusLabel}
        </span>
      </div>

      <div className={styles.header}>
        <div className={styles.avatar}>
          {companyLogo ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={companyLogo}
                alt={imageAlt || companyName || "Empresa"}
                className={styles.logo}
                loading="lazy"
                decoding="async"
              />
            </>
          ) : (
            <span className={styles.initials}>{getInitials(companyName)}</span>
          )}
        </div>
        <div className={styles.top}>
          <h3 className={styles.title}>{title}</h3>
          <p className={styles.companyName}>{companyName || "Empresa"}</p>
        </div>
      </div>

      {metaItems.length > 0 ? (
        <div className={styles.meta}>
          {metaItems.map((item, index) => (
            <span key={`${item.text}-${index}`} className={styles.metaItem}>
              {item.icon ? <MetaIcon icon={item.icon} /> : null}
              {item.text}
            </span>
          ))}
        </div>
      ) : null}

      {salary ? <p className={styles.salary}>{salary}</p> : null}

      <div className={styles.footer}>
        <span className={styles.footerLabel}>Ver detalhes da vaga</span>
        <span className={styles.footerArrow} aria-hidden="true">
          →
        </span>
      </div>
    </Link>
  );
}
