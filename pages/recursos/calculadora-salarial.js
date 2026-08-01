import Head from 'next/head';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  FiArrowLeft,
  FiBriefcase,
  FiDatabase,
  FiExternalLink,
  FiInfo,
  FiSliders,
  FiTrendingUp,
  FiUser,
} from 'react-icons/fi';
import PublicPageShell from '../../components/PublicPageShell';
import { admin } from '../../lib/firebaseAdmin';
import { resolveProfessionalResourceAccess } from '../../lib/resourcePremiumAccess';
import {
  STP_COMPENSATION_SOURCES,
  STP_MINIMUM_WAGE,
  STP_SOCIAL_SECURITY,
  buildSalaryBenchmarksFromJobs,
} from '../../lib/stpCompensationData';
import styles from '../../styles/ResourceCalculatorPage.module.css';
import { redirectToLogin } from '../../lib/loginRedirect';

const LEVEL_FACTOR = {
  junior: 0.9,
  pleno: 1,
  senior: 1.2,
  lideranca: 1.35,
};

const WORK_MODEL_FACTOR = {
  presencial: 1,
  hibrido: 1.03,
  remoto: 1.06,
};

const formatMoney = (value) =>
  Number(value || 0).toLocaleString('pt-PT', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

export default function CalculadoraSalarialPage({ marketData }) {
  const [mode, setMode] = useState('candidato');
  const [categoryId, setCategoryId] = useState(
    marketData?.categories?.[0]?.id || 'geral',
  );
  const [level, setLevel] = useState('pleno');
  const [experienceYears, setExperienceYears] = useState(3);
  const [workModel, setWorkModel] = useState('presencial');

  const selectedCategory =
    marketData?.categories?.find((category) => category.id === categoryId) ||
    null;

  const result = useMemo(() => {
    const categoryMin =
      selectedCategory?.medianMin ||
      marketData?.overallMedianMin ||
      STP_MINIMUM_WAGE.monthly;
    const categoryMax =
      selectedCategory?.medianMax ||
      marketData?.overallMedianMax ||
      STP_MINIMUM_WAGE.monthly * 1.7;

    const levelFactor = LEVEL_FACTOR[level] || 1;
    const experienceFactor =
      1 + Math.min(Number(experienceYears) || 0, 25) * 0.015;
    const modelFactor = WORK_MODEL_FACTOR[workModel] || 1;
    const combinedFactor = levelFactor * experienceFactor * modelFactor;

    const minSalary = Math.max(
      STP_MINIMUM_WAGE.monthly,
      Math.round(categoryMin * combinedFactor),
    );
    const maxSalary = Math.max(
      Math.round(minSalary * 1.05),
      Math.round(categoryMax * combinedFactor),
    );
    const averageSalary = Math.round((minSalary + maxSalary) / 2);

    const employerContributionRate =
      marketData?.employerContributionRate ||
      STP_SOCIAL_SECURITY.applied.employerRate;
    const monthlyEmployerBudget = Math.round(
      maxSalary * (1 + employerContributionRate),
    );

    return {
      minSalary,
      maxSalary,
      averageSalary,
      annualAverage: averageSalary * 12,
      monthlyEmployerBudget,
      annualEmployerBudget: monthlyEmployerBudget * 12,
    };
  }, [selectedCategory, marketData, level, experienceYears, workModel]);

  return (
    <>
      <Head>
        <title>Calculadora Salarial | Recursos EmpregoSTP</title>
        <meta
          name="description"
          content="Estimativa salarial baseada em vagas publicadas em São Tomé e Príncipe e no piso salarial de referência."
        />
      </Head>

      <PublicPageShell>
        <div className={`${styles.page} ${styles.salaryPage}`}>
          <div className={styles.container}>
            <Link href="/recursos" className={styles.backLink}>
              <FiArrowLeft aria-hidden="true" />
              Voltar aos recursos
            </Link>

            <header className={styles.hero}>
              <span className={styles.eyebrow}>
                <FiTrendingUp aria-hidden="true" />
                Planeamento salarial
              </span>
              <h1>Calculadora salarial</h1>
              <p>
                Compare uma faixa mensal com base no mercado, na experiência e
                no modelo de trabalho.
              </p>
            </header>

            <section
              className={styles.sourceBand}
              aria-labelledby="salary-source-title"
            >
              <div className={styles.sourceHeading}>
                <FiDatabase aria-hidden="true" />
                <div>
                  <h2 id="salary-source-title">Base de referência</h2>
                  <p>
                    {marketData.totalJobsWithSalary} vagas com salário em São
                    Tomé e Príncipe. Piso mensal de{' '}
                    <strong>
                      {formatMoney(marketData.minWageMonthly)}{' '}
                      {marketData.currency}
                    </strong>
                    , em vigor desde {marketData.minimumWageEffectiveDate}.
                  </p>
                </div>
              </div>
              <a
                href={STP_COMPENSATION_SOURCES.minimumWage.url}
                target="_blank"
                rel="noreferrer"
                className={styles.sourceLink}
              >
                Consultar {STP_COMPENSATION_SOURCES.minimumWage.title}
                <FiExternalLink aria-hidden="true" />
              </a>
            </section>

            <div
              className={styles.modeSwitch}
              aria-label="Perspetiva da estimativa"
            >
              <button
                type="button"
                className={
                  mode === 'candidato'
                    ? styles.modeButtonActive
                    : styles.modeButton
                }
                aria-pressed={mode === 'candidato'}
                onClick={() => setMode('candidato')}
              >
                <FiUser aria-hidden="true" />
                Candidato
              </button>
              <button
                type="button"
                className={
                  mode === 'empresa'
                    ? styles.modeButtonActive
                    : styles.modeButton
                }
                aria-pressed={mode === 'empresa'}
                onClick={() => setMode('empresa')}
              >
                <FiBriefcase aria-hidden="true" />
                Empresa
              </button>
            </div>

            <section
              className={styles.calculatorSection}
              aria-labelledby="salary-scenario-title"
            >
              <div className={styles.sectionHeading}>
                <FiSliders aria-hidden="true" />
                <div>
                  <h2 id="salary-scenario-title">Defina o cenário</h2>
                  <p>
                    Altere os campos para atualizar a estimativa imediatamente.
                  </p>
                </div>
              </div>

              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Área profissional</span>
                  <select
                    value={categoryId}
                    onChange={(event) => setCategoryId(event.target.value)}
                  >
                    {marketData.categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name} ({category.sampleSize})
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.field}>
                  <span>Nível</span>
                  <select
                    value={level}
                    onChange={(event) => setLevel(event.target.value)}
                  >
                    <option value="junior">Júnior</option>
                    <option value="pleno">Pleno</option>
                    <option value="senior">Sénior</option>
                    <option value="lideranca">Liderança</option>
                  </select>
                </label>

                <label className={styles.field}>
                  <span>Anos de experiência</span>
                  <input
                    type="number"
                    min="0"
                    max="40"
                    value={experienceYears}
                    onChange={(event) => setExperienceYears(event.target.value)}
                  />
                </label>

                <label className={styles.field}>
                  <span>Modelo de trabalho</span>
                  <select
                    value={workModel}
                    onChange={(event) => setWorkModel(event.target.value)}
                  >
                    <option value="presencial">Presencial</option>
                    <option value="hibrido">Híbrido</option>
                    <option value="remoto">Remoto</option>
                  </select>
                </label>
              </div>

              <div className={styles.resultHeading}>
                <h2>Estimativa</h2>
                <span>
                  {mode === 'empresa'
                    ? 'Perspetiva da empresa'
                    : 'Perspetiva do candidato'}
                </span>
              </div>

              <div className={styles.results} aria-live="polite">
                <output
                  className={styles.resultBox}
                  aria-label="Faixa mínima mensal"
                >
                  <span>Faixa mínima mensal</span>
                  <strong>{formatMoney(result.minSalary)} Db</strong>
                </output>
                <output
                  className={styles.resultBox}
                  aria-label="Faixa máxima mensal"
                >
                  <span>Faixa máxima mensal</span>
                  <strong>{formatMoney(result.maxSalary)} Db</strong>
                </output>
                <output
                  className={styles.resultBox}
                  aria-label="Média anual estimada"
                >
                  <span>Média anual estimada</span>
                  <strong>{formatMoney(result.annualAverage)} Db</strong>
                </output>
                <output
                  className={styles.resultBox}
                  aria-label="Custo mensal estimado para a empresa"
                >
                  <span>
                    {mode === 'empresa'
                      ? 'Orçamento mensal com encargos'
                      : 'Custo mensal para a empresa'}
                  </span>
                  <strong>
                    {formatMoney(result.monthlyEmployerBudget)} Db
                  </strong>
                </output>
              </div>

              <p className={styles.note}>
                <FiInfo aria-hidden="true" />
                Esta estimativa é orientativa. Os valores variam conforme a
                negociação, os benefícios, o regime contratual e eventuais
                alterações legais.
              </p>
            </section>
          </div>
        </div>
      </PublicPageShell>
    </>
  );
}

export async function getServerSideProps(context) {
  const access = await resolveProfessionalResourceAccess(context);

  if (!access.isAuthenticated) {
    return redirectToLogin(context);
  }

  if (!access.allowed) {
    return {
      redirect: {
        destination: access.upgradeUrl || '/premium/candidatos',
        permanent: false,
      },
    };
  }

  const jobsSnapshot = await admin
    .firestore()
    .collection('jobs')
    .where('status', '==', 'active')
    .limit(600)
    .get();

  const jobs = jobsSnapshot.docs.map((doc) => doc.data() || {});
  const benchmark = buildSalaryBenchmarksFromJobs(jobs);

  const fallbackCategories = [
    {
      id: 'geral',
      name: 'Mercado geral',
      sampleSize: 0,
      medianMin: STP_MINIMUM_WAGE.monthly,
      medianMax: Math.round(STP_MINIMUM_WAGE.monthly * 1.7),
    },
  ];

  return {
    props: {
      marketData: {
        totalJobsWithSalary: benchmark.totalJobsWithSalary,
        categories: benchmark.categories.length
          ? benchmark.categories.slice(0, 20)
          : fallbackCategories,
        overallMedianMin: benchmark.overallMedianMin,
        overallMedianMax: benchmark.overallMedianMax,
        minWageMonthly: STP_MINIMUM_WAGE.monthly,
        minimumWageEffectiveDate: STP_MINIMUM_WAGE.effectiveDate,
        employerContributionRate: STP_SOCIAL_SECURITY.applied.employerRate,
        currency: STP_MINIMUM_WAGE.currency,
        generatedAt: new Date().toISOString().slice(0, 10),
      },
    },
  };
}
