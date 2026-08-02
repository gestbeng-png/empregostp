import Link from "next/link";
import {
  FiAlertCircle,
  FiArrowRight,
  FiCheckCircle,
  FiInbox,
  FiRefreshCw,
} from "react-icons/fi";

const STATE_ICONS = {
  empty: FiInbox,
  error: FiAlertCircle,
  success: FiCheckCircle,
};

export function DashboardPageHeader({
  eyebrow,
  title,
  description,
  actions,
  compact = false,
}) {
  return (
    <header className={`dash-page-header${compact ? " is-compact" : ""}`}>
      <div className="dash-page-header-copy">
        {eyebrow ? <span className="dash-page-eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="dash-page-header-actions">{actions}</div> : null}
    </header>
  );
}

export function DashboardMetricCard({
  label,
  value,
  meta,
  icon: Icon,
  tone = "blue",
  href,
}) {
  const Root = href ? Link : "article";

  return (
    <Root
      {...(href ? { href } : {})}
      className={`dash-metric-card tone-${tone}${href ? " is-link" : ""}`}
    >
      <div className="dash-metric-card-topline">
        <span className="dash-metric-label">{label}</span>
        {Icon ? <span className="dash-metric-icon"><Icon aria-hidden="true" /></span> : null}
      </div>
      <strong className="dash-metric-value">{value}</strong>
      {meta ? <span className="dash-metric-meta">{meta}</span> : null}
    </Root>
  );
}

export function DashboardState({
  kind = "empty",
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  compact = false,
}) {
  const Icon = STATE_ICONS[kind] || FiInbox;
  const action = actionLabel ? (
    actionHref ? (
      <Link href={actionHref} className="btn btn-primary">
        {actionLabel}<FiArrowRight aria-hidden="true" />
      </Link>
    ) : (
      <button type="button" className="btn btn-primary" onClick={onAction}>
        {kind === "error" ? <FiRefreshCw aria-hidden="true" /> : null}
        {actionLabel}
      </button>
    )
  ) : null;

  return (
    <section
      className={`dash-state-card is-${kind}${compact ? " is-compact" : ""}`}
      role={kind === "error" ? "alert" : "status"}
      aria-live={kind === "error" ? "assertive" : "polite"}
    >
      <span className="dash-state-icon"><Icon aria-hidden="true" /></span>
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="dash-state-action">{action}</div> : null}
    </section>
  );
}

export function DashboardSkeleton({ rows = 4, label = "A carregar conteúdo" }) {
  return (
    <div className="dash-skeleton-panel" role="status" aria-busy="true">
      <span className="dash-visually-hidden">{label}</span>
      <span className="dash-skeleton-line is-title" />
      {Array.from({ length: rows }, (_, index) => (
        <span
          key={`dashboard-skeleton-${index + 1}`}
          className="dash-skeleton-line"
          style={{ "--skeleton-width": `${92 - index * 8}%` }}
        />
      ))}
    </div>
  );
}

export function DashboardStatusBadge({ tone = "neutral", children }) {
  return <span className={`dash-status-badge tone-${tone}`}>{children}</span>;
}
