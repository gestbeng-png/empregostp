import Head from 'next/head';
import Image from 'next/image';
import Link from '../../components/auth/AccountActionLink';
import {
  FiArrowLeft,
  FiArrowRight,
  FiBriefcase,
  FiFacebook,
  FiGlobe,
  FiInstagram,
  FiLayers,
  FiLinkedin,
  FiMail,
  FiMapPin,
  FiPhone,
  FiUsers,
} from 'react-icons/fi';
import CompactJobCard from '../../components/home/CompactJobCard';
import PublicPageShell from '../../components/PublicPageShell';
import VerificationBadge from '../../components/VerificationBadge';
import { getEmpresaPlanSummary } from '../../lib/empresaPlanFeatures';
import {
  normalizeCompanyWebsite,
  prepareCompanyProfileJobs,
} from '../../lib/publicCompanyProfile';
import styles from '../../styles/PublicCompanyProfilePage.module.css';

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function formatSalary(job) {
  const toNumber = (value) => {
    if (value === null || value === undefined || String(value).trim() === '') {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const minimum = toNumber(
    job.salaryMin ?? job.salarioMin ?? job.salarioMinimo,
  );
  const maximum = toNumber(
    job.salaryMax ?? job.salarioMax ?? job.salarioMaximo,
  );
  const currency = job.currency || job.moeda || 'Db';
  const format = (value) => value.toLocaleString('pt-PT');

  if (minimum !== null && maximum !== null) {
    return `${format(minimum)}–${format(maximum)} ${currency}`;
  }
  if (minimum !== null) return `Desde ${format(minimum)} ${currency}`;
  if (maximum !== null) return `Até ${format(maximum)} ${currency}`;
  return job.salario || job.salary || 'A combinar';
}

function formatDateLabel(value, prefix) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${prefix} ${date.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })}`;
}

export default function PublicCompanyProfile({
  company,
  jobs,
  activeJobCount,
}) {
  const initials = String(company.name || 'Empresa')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  const contacts = [
    company.phone && {
      icon: FiPhone,
      label: 'Telefone',
      value: company.phone,
      href: `tel:${company.phone.replace(/[^+\d]/g, '')}`,
    },
    company.email && {
      icon: FiMail,
      label: 'Email',
      value: company.email,
      href: `mailto:${company.email}`,
    },
    company.location && {
      icon: FiMapPin,
      label: 'Localização',
      value: company.location,
    },
    company.website && {
      icon: FiGlobe,
      label: 'Site',
      value: company.website.replace(/^https?:\/\//, '').replace(/\/$/, ''),
      href: company.website,
    },
  ].filter(Boolean);
  const jobsLabel = `${activeJobCount} ${
    activeJobCount === 1 ? 'vaga ativa' : 'vagas ativas'
  }`;
  const facts = [
    company.location && {
      icon: FiMapPin,
      label: 'Localização',
      value: company.location,
    },
    company.companySize && {
      icon: FiUsers,
      label: 'Dimensão',
      value: company.companySize,
    },
    company.industrySectors.length > 0 && {
      icon: FiLayers,
      label: 'Setor',
      value: company.industrySectors.slice(0, 2).join(', '),
    },
    { icon: FiBriefcase, label: 'Oportunidades', value: jobsLabel },
  ].filter(Boolean);

  return (
    <>
      <Head>
        <title>{`${company.name} | Empresa — EmpregoSTP`}</title>
        <meta
          name="description"
          content={
            company.description ||
            `Conheça a empresa ${company.name} e consulte as oportunidades disponíveis.`
          }
        />
        <meta name="robots" content="index,follow" />
      </Head>

      <PublicPageShell headerVariant="light">
        <div className={styles.page}>
          <Link href="/vagas" className={styles.backLink}>
            <FiArrowLeft className={styles.backIcon} aria-hidden="true" />
            Voltar às vagas
          </Link>

          <header className={styles.hero}>
            <div className={styles.heroBanner} aria-hidden="true">
              {company.coverImageUrl ? (
                <Image
                  src={company.coverImageUrl}
                  alt=""
                  className={styles.coverImage}
                  fill
                  sizes="(max-width: 760px) 100vw, 1160px"
                  unoptimized
                />
              ) : null}
            </div>

            <div className={styles.heroMain}>
              <div className={styles.logo}>
                {company.logoUrl ? (
                  <Image
                    src={company.logoUrl}
                    alt={`Logótipo de ${company.name}`}
                    width={120}
                    height={120}
                    sizes="120px"
                    unoptimized
                  />
                ) : (
                  <span aria-hidden="true">{initials || 'ES'}</span>
                )}
              </div>

              <div className={styles.identity}>
                <span className={styles.eyebrow}>Perfil da empresa</span>
                <h1 className={styles.name}>
                  {company.name}
                  {company.verified ? (
                    <span className={styles.nameSeal}>
                      <VerificationBadge
                        verified
                        size="xl"
                        variant="seal"
                        detail="Empresa confirmada pela equipa EmpregoSTP."
                      />
                    </span>
                  ) : null}
                </h1>
                {company.verified ? (
                  <p className={styles.verifiedLine}>Empresa verificada</p>
                ) : null}
              </div>

              <div className={styles.heroActions}>
                {[
                  {
                    href: company.website,
                    icon: FiGlobe,
                    label: 'Site da empresa',
                  },
                  {
                    href: company.social.linkedin,
                    icon: FiLinkedin,
                    label: 'LinkedIn',
                  },
                  {
                    href: company.social.facebook,
                    icon: FiFacebook,
                    label: 'Facebook',
                  },
                  {
                    href: company.social.instagram,
                    icon: FiInstagram,
                    label: 'Instagram',
                  },
                ]
                  .filter((link) => link.href)
                  .map(({ href, icon: Icon, label }) => (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.iconLink}
                      aria-label={`${label} (abre noutro separador)`}
                      title={label}
                    >
                      <Icon aria-hidden="true" />
                    </a>
                  ))}
              </div>
            </div>

            <dl className={styles.facts}>
              {facts.map(({ icon: Icon, label, value }) => (
                <div key={label} className={styles.fact}>
                  <dt className={styles.factLabel}>
                    <Icon aria-hidden="true" />
                    {label}
                  </dt>
                  <dd className={styles.factValue}>{value}</dd>
                </div>
              ))}
            </dl>
          </header>

          <div className={styles.layout}>
            <div className={styles.mainColumn}>
              <section className={styles.panel}>
                <h2 className={styles.panelTitle}>Sobre a empresa</h2>
                <p
                  className={
                    company.description ? styles.text : styles.textMuted
                  }
                >
                  {company.description ||
                    'Esta empresa ainda não adicionou uma apresentação pública.'}
                </p>
              </section>

              <section
                id="vagas"
                className={styles.panel}
                aria-labelledby="vagas-titulo"
              >
                <div className={styles.panelHeading}>
                  <h2 id="vagas-titulo" className={styles.panelTitle}>
                    Vagas disponíveis
                    {activeJobCount > 0 ? (
                      <span className={styles.panelCount}>
                        {activeJobCount}
                      </span>
                    ) : null}
                  </h2>
                  <Link
                    href={{
                      pathname: '/vagas',
                      query: { empresa: company.id },
                    }}
                    className={styles.textLink}
                  >
                    Explorar todas
                    <FiArrowRight aria-hidden="true" />
                  </Link>
                </div>

                {jobs.length > 0 ? (
                  <div className={styles.jobsList}>
                    {jobs.map((job) => (
                      <CompactJobCard
                        key={job.id}
                        href={`/vaga/${job.id}`}
                        actionHref={`/vaga/${job.id}`}
                        actionLabel="Ver oportunidade"
                        title={job.title}
                        companyName={company.name}
                        companyLogo={company.logoUrl}
                        imageAlt={`Logótipo de ${company.name}`}
                        status={job.status}
                        badgeLabel={job.contractType}
                        salary={formatSalary(job)}
                        categoryLabel={job.category}
                        modalityLabel={job.modality}
                        experienceLabel={job.experience}
                        publishedLabel={formatDateLabel(
                          job.createdAt,
                          'Publicada',
                        )}
                        closingLabel={formatDateLabel(job.deadline, 'Termina')}
                        vacancyCount={job.vacancyCount}
                        isFeatured={job.featured}
                        isVerified={company.verified}
                        metaItems={[
                          {
                            icon: 'location',
                            text:
                              job.location ||
                              company.location ||
                              'São Tomé e Príncipe',
                          },
                          {
                            icon: 'briefcase',
                            text: job.contractType,
                          },
                          {
                            icon: 'clock',
                            text: formatDateLabel(job.createdAt, 'em'),
                          },
                        ]}
                      />
                    ))}
                  </div>
                ) : (
                  <div className={styles.emptyState} role="status">
                    <span className={styles.emptyIcon} aria-hidden="true">
                      <FiBriefcase />
                    </span>
                    <h3 className={styles.emptyTitle}>
                      Sem vagas abertas neste momento
                    </h3>
                    <p className={styles.emptyText}>
                      Explore outras empresas ou volte mais tarde para consultar
                      novas oportunidades.
                    </p>
                    <Link href="/vagas" className={styles.textLink}>
                      Explorar vagas
                      <FiArrowRight aria-hidden="true" />
                    </Link>
                  </div>
                )}
              </section>
            </div>

            <aside className={styles.sideColumn}>
              <section className={styles.joinPanel}>
                <span className={styles.joinEyebrow}>Quer trabalhar aqui?</span>
                <h2 className={styles.joinTitle}>
                  Prepare o seu perfil para a próxima oportunidade.
                </h2>
                <Link
                  href="/register?type=candidato"
                  className={styles.joinLink}
                >
                  Criar perfil profissional
                </Link>
              </section>

              <section className={styles.panel}>
                <h2 className={styles.panelTitle}>Contactos</h2>
                {contacts.length > 0 ? (
                  <ul className={styles.contactList}>
                    {contacts.map(({ icon: Icon, label, value, href }) => (
                      <li key={label} className={styles.contactItem}>
                        <Icon aria-hidden="true" />
                        <span>
                          <span className={styles.contactLabel}>{label}</span>
                          {href ? (
                            <a
                              href={href}
                              className={styles.contactValue}
                              {...(href.startsWith('http')
                                ? {
                                    target: '_blank',
                                    rel: 'noopener noreferrer',
                                  }
                                : {})}
                            >
                              {value}
                            </a>
                          ) : (
                            <span className={styles.contactValue}>{value}</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.textMuted}>
                    A empresa ainda não indicou contactos.
                  </p>
                )}
              </section>

              <section className={styles.panel}>
                <h2 className={styles.panelTitle}>Setores de atividade</h2>
                {company.industrySectors.length > 0 ? (
                  <ul className={styles.tagList}>
                    {company.industrySectors.map((sector) => (
                      <li key={sector} className={styles.tag}>
                        {sector}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.textMuted}>
                    Setor de atividade ainda não indicado.
                  </p>
                )}
              </section>
            </aside>
          </div>
        </div>
      </PublicPageShell>
    </>
  );
}

export async function getServerSideProps(context) {
  try {
    const { admin } = await import('../../lib/firebaseAdmin');
    const companyId = String(context.params?.id || '');
    const companyDoc = await admin
      .firestore()
      .collection('users')
      .doc(companyId)
      .get();

    if (!companyDoc.exists || companyDoc.data()?.userType !== 'empresa') {
      return { notFound: true };
    }

    const data = companyDoc.data() || {};
    const jobsSnapshot = await admin
      .firestore()
      .collection('jobs')
      .where('companyId', '==', companyId)
      .get();
    const { jobs, activeJobCount } = prepareCompanyProfileJobs(
      jobsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    );

    const planSummary = getEmpresaPlanSummary(data);
    const company = {
      id: companyId,
      name: data.name || data.fullName || data.companyName || 'Empresa',
      description: data.description || '',
      companySize: data.companySize || '',
      industrySectors: normalizeList(data.industrySectors),
      location: data.location || data.address?.district || '',
      logoUrl: data.logoUrl || data.logo || '',
      coverImageUrl: data.coverImageUrl || '',
      website: normalizeCompanyWebsite(data.website),
      // Contactos que a empresa preenche no painel ("Perfil da empresa").
      phone: String(data.phone || '').trim(),
      email: String(data.contactEmail || data.email || '').trim(),
      // O painel grava em `socialMedia.*` e, em contas antigas, no topo.
      social: {
        linkedin: normalizeCompanyWebsite(
          data.socialMedia?.linkedin || data.linkedin,
        ),
        facebook: normalizeCompanyWebsite(
          data.socialMedia?.facebook || data.facebook,
        ),
        instagram: normalizeCompanyWebsite(
          data.socialMedia?.instagram || data.instagram,
        ),
      },
      verified: Boolean(planSummary?.features?.companyVerified),
    };

    return { props: { company, jobs, activeJobCount } };
  } catch (error) {
    console.error('Erro ao carregar perfil público da empresa:', error);
    return { notFound: true };
  }
}
