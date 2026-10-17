import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import {
  FiArrowRight,
  FiBriefcase,
  FiCheck,
  FiHome,
  FiSearch,
  FiUser,
  FiUsers,
} from 'react-icons/fi';
import PublicPageShell from '../components/PublicPageShell';
import {
  fetchActiveEmpresaPlans,
  getEmpresaPlanCatalog,
} from '../lib/empresaPlansCatalog';
import styles from '../styles/EmpresasStitchPage.module.css';

const COMPANY_PHOTOS = {
  collaboration:
    '/assets/imagens/Fotos para usar no site/06092026-EmpregoSTP Sequência nº (002)-45.jpg',
  professional:
    '/assets/imagens/Fotos para usar no site/06092026-EmpregoSTP Sequência nº (002)-34.jpg',
};

/**
 * @param {{
 *   companyPlans?: Array<{
 *     id: string;
 *     name: string;
 *     price: number;
 *     priceLabel: string;
 *     pricePeriodLabel?: string;
 *     description?: string;
 *     popular?: boolean;
 *     features: string[];
 *   }>;
 * }} props
 */
export default function EmpresasPage({ companyPlans = [] }) {
  return (
    <>
      <Head>
        <title>Ferramentas de Recrutamento Profissional | EmpregoSTP</title>
        <meta
          name="description"
          content="Ferramentas para empresas encontrarem, avaliarem e contratarem os melhores talentos em São Tomé e Príncipe."
        />
      </Head>

      <PublicPageShell headerVariant="light">
        <div className={styles.page}>
          <section className={styles.hero}>
            <div className={styles.container}>
              <div className={styles.heroGrid}>
                <div className={styles.heroCopy}>
                  <span className={styles.heroEyebrow}>
                    EmpregoSTP para empresas
                  </span>
                  <h1 className={styles.heroTitle}>
                    Recrutamento
                    <br />
                    para empresas
                  </h1>
                  <p className={styles.heroLead}>
                    Contrate melhor. Com menos complexidade.
                  </p>
                  <p className={styles.heroText}>
                    Publique vagas, organize candidaturas e encontre
                    profissionais preparados para fazer a sua empresa avançar.
                  </p>

                  <div className={styles.heroActions}>
                    <Link
                      href="/dashboard/empresa/vaga/criar-vaga"
                      className={styles.primaryAction}
                    >
                      Publicar uma vaga
                      <FiArrowRight aria-hidden="true" />
                    </Link>
                    <Link href="/candidatos" className={styles.secondaryAction}>
                      <FiSearch aria-hidden="true" />
                      Procurar candidatos
                    </Link>
                  </div>

                  <div className={styles.heroAssurance}>
                    <span>
                      <FiCheck aria-hidden="true" />
                    </span>
                    Comece gratuitamente e escolha um plano quando precisar de
                    mais alcance.
                  </div>
                </div>

                <div className={styles.heroVisual}>
                  <div className={styles.heroVisualMain}>
                    <Image
                      src={COMPANY_PHOTOS.collaboration}
                      alt="Profissionais a colaborar num processo de recrutamento"
                      fill
                      priority
                      sizes="(max-width: 767px) 100vw, 52vw"
                      className={styles.heroVisualImage}
                    />
                    <div className={styles.heroVisualCaption}>
                      <span>Empresas que avançam</span>
                      <strong>Talento certo, no momento certo</strong>
                    </div>
                  </div>
                  <div className={styles.heroVisualDetail}>
                    <Image
                      src={COMPANY_PHOTOS.professional}
                      alt="Profissional em ambiente de trabalho"
                      fill
                      sizes="180px"
                      className={styles.heroVisualImage}
                    />
                  </div>
                  <div className={styles.heroVisualBadge} aria-hidden="true">
                    <span>RH</span>
                    <small>com mais clareza</small>
                  </div>

                </div>
              </div>
            </div>
          </section>

          <section className={styles.plansSection} id="planos">
            <div className={styles.container}>
              <div className={styles.plansIntro}>
                <span className={styles.sectionEyebrow}>Planos flexíveis</span>
                <h2 className={styles.plansTitle}>Planos para empresas</h2>
                <p className={styles.plansSubtitle}>
                  Escolha o plano certo para publicar vagas, destacar
                  oportunidades e recrutar com mais eficiência.
                </p>
              </div>

              <div className={styles.plansGrid}>
                {companyPlans.map((plan) => {
                  const isPopular = Boolean(plan.popular);
                  return (
                    <article
                      key={plan.id}
                      className={`${styles.planCard} ${
                        isPopular ? styles.planCardPopular : ''
                      }`}
                    >
                      {isPopular ? (
                        <span className={styles.planBadge}>Mais escolhido</span>
                      ) : null}
                      <h3 className={styles.planName}>{plan.name}</h3>
                      <p className={styles.planPrice}>
                        {plan.priceLabel}
                        {plan.pricePeriodLabel ? (
                          <span className={styles.planPricePeriod}>
                            {plan.pricePeriodLabel}
                          </span>
                        ) : null}
                      </p>
                      <p className={styles.planDescription}>
                        {plan.description}
                      </p>
                      <ul className={styles.planFeatures}>
                        {plan.features.slice(0, 8).map((feature, index) => (
                          <li key={`${feature}-${index}`}>
                            <FiCheck aria-hidden="true" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                      <Link
                        href={
                          plan.price === 0
                            ? '/register?type=empresa'
                            : '/premium/empresa'
                        }
                        className={styles.planAction}
                      >
                        {plan.price === 0
                          ? 'Começar gratuitamente'
                          : 'Ver plano'}
                      </Link>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          <section className={styles.closingSection}>
            <div className={styles.container}>
              <div className={styles.closingPanel}>
                <div>
                  <span className={styles.closingEyebrow}>
                    Pronto para recrutar?
                  </span>
                  <h2>Encontre a próxima pessoa certa para a sua equipa.</h2>
                  <p>
                    Crie a sua conta de empresa e publique a primeira
                    oportunidade.
                  </p>
                </div>
                <Link
                  href="/register?type=empresa"
                  className={styles.closingAction}
                >
                  Criar conta de empresa
                  <FiArrowRight aria-hidden="true" />
                </Link>
              </div>
            </div>
          </section>

          <nav className={styles.mobileBottomNav} aria-label="Navegação rápida">
            <Link href="/empresas" aria-current="page">
              <FiHome aria-hidden="true" />
              <span>Empresas</span>
            </Link>
            <Link href="/vagas">
              <FiBriefcase aria-hidden="true" />
              <span>Vagas</span>
            </Link>
            <Link href="/candidatos">
              <FiUsers aria-hidden="true" />
              <span>Candidatos</span>
            </Link>
            <Link href="/dashboard">
              <FiUser aria-hidden="true" />
              <span>Painel</span>
            </Link>
          </nav>
        </div>
      </PublicPageShell>
    </>
  );
}

export async function getServerSideProps() {
  try {
    const { admin } = await import('../lib/firebaseAdmin');
    const sourcePlans = await fetchActiveEmpresaPlans(admin);

    return {
      props: {
        companyPlans: getEmpresaPlanCatalog(sourcePlans),
      },
    };
  } catch (error) {
    console.error('Erro ao carregar planos empresariais públicos:', error);
    return {
      props: {
        companyPlans: getEmpresaPlanCatalog([]),
      },
    };
  }
}
