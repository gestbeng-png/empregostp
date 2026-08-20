import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import {
  FiArrowLeft,
  FiBriefcase,
  FiCheckCircle,
  FiExternalLink,
  FiGlobe,
  FiMapPin,
  FiUsers,
} from 'react-icons/fi';
import CompactJobCard from '../../components/home/CompactJobCard';
import PublicPageShell from '../../components/PublicPageShell';
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

  return (
    <>
      <Head>
        <title>{company.name} | Empresa — EmpregoSTP</title>
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
          <div className={styles.container}>
            <Link href="/vagas" className={styles.backLink}>
              <FiArrowLeft aria-hidden="true" />
              Voltar às vagas
            </Link>

            <section className={styles.hero}>
              {company.coverImageUrl ? (
                <Image
                  src={company.coverImageUrl}
                  alt=""
                  className={styles.coverImage}
                  fill
                  sizes="(max-width: 760px) 100vw, 1200px"
                  unoptimized
                  aria-hidden="true"
                />
              ) : (
                <div className={styles.coverFallback} aria-hidden="true" />
              )}

              <div className={styles.heroContent}>
                <div className={styles.logo}>
                  {company.logoUrl ? (
                    <Image
                      src={company.logoUrl}
                      alt={`Logótipo de ${company.name}`}
                      width={112}
                      height={112}
                      sizes="112px"
                      unoptimized
                    />
                  ) : (
                    <span>{initials || 'ES'}</span>
                  )}
                </div>

                <div className={styles.identity}>
                  <span className={styles.eyebrow}>Perfil da empresa</span>
                  <div className={styles.titleRow}>
                    <h1>{company.name}</h1>
                    {/* O texto "Verificada" já nomeia o elemento, pelo que o
                        `aria-label` era redundante — e proibido sem `role`. */}
                    {company.verified ? (
                      <span className={styles.verified}>
                        <FiCheckCircle aria-hidden="true" />
                        Verificada
                      </span>
                    ) : null}
                  </div>
                  <div className={styles.meta}>
                    {company.location ? (
                      <span>
                        <FiMapPin aria-hidden="true" />
                        {company.location}
                      </span>
                    ) : null}
                    {company.companySize ? (
                      <span>
                        <FiUsers aria-hidden="true" />
                        {company.companySize}
                      </span>
                    ) : null}
                    <span>
                      <FiBriefcase aria-hidden="true" />
                      {activeJobCount}{' '}
                      {activeJobCount === 1
                        ? 'oportunidade ativa'
                        : 'oportunidades ativas'}
                    </span>
                  </div>
                </div>

                {company.website ? (
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.websiteButton}
                  >
                    <FiGlobe aria-hidden="true" />
                    Site da empresa
                    <FiExternalLink aria-hidden="true" />
                  </a>
                ) : null}
              </div>
            </section>

            <div className={styles.layout}>
              <div className={styles.main}>
                <section className={styles.about}>
                  <span className={styles.sectionEyebrow}>
                    Marca empregadora
                  </span>
                  <h2>Sobre a empresa</h2>
                  <p>
                    {company.description ||
                      'Esta empresa ainda não adicionou uma apresentação pública.'}
                  </p>
                </section>

                <section className={styles.jobsSection}>
                  <div className={styles.sectionHeading}>
                    <div>
                      <span className={styles.sectionEyebrow}>
                        Oportunidades
                      </span>
                      <h2>Vagas disponíveis</h2>
                    </div>
                    <Link
                      href={{
                        pathname: '/vagas',
                        query: { empresa: company.id },
                      }}
                      className={styles.allJobsLink}
                    >
                      Explorar todas
                    </Link>
                  </div>

                  {jobs.length > 0 ? (
                    <div className={styles.jobsGrid}>
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
                          closingLabel={formatDateLabel(
                            job.deadline,
                            'Termina',
                          )}
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
                      <span className={styles.emptyIcon}>
                        <FiBriefcase aria-hidden="true" />
                      </span>
                      <h3>Sem vagas abertas neste momento</h3>
                      <p>
                        Explore outras empresas ou volte mais tarde para
                        consultar novas oportunidades.
                      </p>
                      <Link href="/vagas" className={styles.emptyAction}>
                        Explorar vagas
                      </Link>
                    </div>
                  )}
                </section>
              </div>

              <aside className={styles.sidebar}>
                <section className={styles.infoCard}>
                  <h2>Informação</h2>
                  {company.industrySectors.length > 0 ? (
                    <div className={styles.sectors}>
                      {company.industrySectors.map((sector) => (
                        <span key={sector}>{sector}</span>
                      ))}
                    </div>
                  ) : (
                    <p>Setor de atividade ainda não indicado.</p>
                  )}
                </section>

                <section className={styles.ctaCard}>
                  <span>Quer trabalhar aqui?</span>
                  <h2>Prepare o seu perfil para a próxima oportunidade.</h2>
                  <Link href="/register?type=candidato">
                    Criar perfil profissional
                  </Link>
                </section>
              </aside>
            </div>
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
      verified: Boolean(planSummary?.features?.companyVerified),
    };

    return { props: { company, jobs, activeJobCount } };
  } catch (error) {
    console.error('Erro ao carregar perfil público da empresa:', error);
    return { notFound: true };
  }
}
