import Head from "next/head";
import Link from "next/link";
import PublicPageShell from "../components/PublicPageShell";
import { getCandidateServiceGroups } from "../lib/candidateCatalog";
import styles from "../styles/CandidatosPage.module.css";

const IMPLEMENTED_SERVICES = getCandidateServiceGroups()
  .flatMap((group) => group.services)
  .filter((service) => service.statusTone === "implemented")
  .sort((a, b) => Number(b.featured) - Number(a.featured))
  .slice(0, 12);

function SparkIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11 2l1.86 5.14L18 9l-5.14 1.86L11 16l-1.86-5.14L4 9l5.14-1.86L11 2z" />
      <path d="M18 14l.93 2.57L21.5 17.5l-2.57.93L18 21l-.93-2.57L14.5 17.5l2.57-.93L18 14z" />
    </svg>
  );
}

function VerifiedIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ArrowRightIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

function normalizePlanTag(plan) {
  if (plan === "Premium" || plan === "Premium / Unlimited")
    return styles.planPremium;
  if (plan === "Profissional") return styles.planProfessional;
  if (plan === "Verificação") return styles.planVerification;
  return styles.planBasic;
}

function normalizeStatusTag(statusTone) {
  if (statusTone === "implemented") return styles.statusImplemented;
  if (statusTone === "partial") return styles.statusPartial;
  return styles.statusPlanned;
}

function compactDescription(service) {
  const text = String(service.description || "").trim();
  if (!text) return "";
  const [firstSentence] = text.split(". ");
  return firstSentence.endsWith(".") ? firstSentence : `${firstSentence}.`;
}

function CandidateServiceCard({ service }) {
  return (
    <article className={styles.serviceCard}>
      <div className={styles.serviceHeader}>
        <span className={styles.serviceCategory}>{service.category}</span>
        <div className={styles.serviceBadges}>
          <span
            className={`${styles.serviceStatusBadge} ${normalizeStatusTag(service.statusTone)}`}
          >
            {service.statusLabel}
          </span>
          {service.featured ? (
            <span className={styles.servicePopularBadge}>
              <SparkIcon className={styles.badgeIcon} />
              Destaque
            </span>
          ) : null}
          {service.verifiedRelated ? (
            <span className={styles.serviceVerifiedBadge}>
              <VerifiedIcon className={styles.badgeIcon} />
              Verificado
            </span>
          ) : null}
        </div>
      </div>

      <h3 className={styles.serviceTitle}>{service.title}</h3>
      <p className={styles.serviceDescription}>{compactDescription(service)}</p>

      <ul className={styles.serviceFeatures}>
        {service.highlights.slice(0, 2).map((highlight) => (
          <li key={`${service.id}-${highlight}`}>{highlight}</li>
        ))}
      </ul>

      <div className={styles.serviceMeta}>
        {service.plans.map((plan) => (
          <span
            key={`${service.id}-${plan}`}
            className={`${styles.serviceMetaItem} ${normalizePlanTag(plan)}`}
          >
            {plan}
          </span>
        ))}
      </div>

      <Link href={service.href} className={styles.serviceLinkButton}>
        {service.cta}
        <ArrowRightIcon className={styles.linkIcon} />
      </Link>
    </article>
  );
}

export default function Candidatos() {
  return (
    <>
      <Head>
        <title>Serviços para Candidatos - STP Emprego</title>
        <meta
          name="description"
          content="Veja os principais serviços já implementados para candidatos no STP Emprego."
        />
        <meta
          property="og:title"
          content="Serviços para Candidatos - STP Emprego"
        />
        <meta property="og:type" content="website" />
      </Head>

      <PublicPageShell>
        <div className={styles.page}>
          <section className={styles.contentSection}>
            <div className={styles.container}>
              <div className={styles.servicesSection}>
                <div className={styles.sectionHeading}>
                  <div>
                    <span className={styles.sectionEyebrow}>
                      Já implementado
                    </span>
                    <h2 className={styles.sectionHeadingTitle}>
                      Recursos disponíveis agora
                    </h2>
                  </div>
                </div>

                <div className={styles.servicesGrid}>
                  {IMPLEMENTED_SERVICES.map((service) => (
                    <CandidateServiceCard key={service.id} service={service} />
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </PublicPageShell>
    </>
  );
}
