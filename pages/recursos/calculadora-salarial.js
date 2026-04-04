import Head from 'next/head';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import LandingHeader from '../../components/LandingHeader';
import Footer from '../../components/home/Footer';
import { admin } from '../../lib/firebaseAdmin';
import { resolveProfessionalResourceAccess } from '../../lib/resourcePremiumAccess';
import {
  STP_COMPENSATION_SOURCES,
  STP_MINIMUM_WAGE,
  STP_SOCIAL_SECURITY,
  buildSalaryBenchmarksFromJobs
} from '../../lib/stpCompensationData';

const LEVEL_FACTOR = {
  junior: 0.9,
  pleno: 1,
  senior: 1.2,
  lideranca: 1.35
};

const WORK_MODEL_FACTOR = {
  presencial: 1,
  hibrido: 1.03,
  remoto: 1.06
};

const formatMoney = (value) =>
  Number(value || 0).toLocaleString('pt-PT', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });

export default function CalculadoraSalarialPage({ marketData }) {
  const [mode, setMode] = useState('candidato');
  const [categoryId, setCategoryId] = useState(marketData?.categories?.[0]?.id || 'geral');
  const [level, setLevel] = useState('pleno');
  const [experienceYears, setExperienceYears] = useState(3);
  const [workModel, setWorkModel] = useState('presencial');

  const selectedCategory = marketData?.categories?.find((category) => category.id === categoryId) || null;

  const result = useMemo(() => {
    const categoryMin = selectedCategory?.medianMin || marketData?.overallMedianMin || STP_MINIMUM_WAGE.monthly;
    const categoryMax = selectedCategory?.medianMax || marketData?.overallMedianMax || STP_MINIMUM_WAGE.monthly * 1.7;

    const levelFactor = LEVEL_FACTOR[level] || 1;
    const experienceFactor = 1 + Math.min(Number(experienceYears) || 0, 25) * 0.015;
    const modelFactor = WORK_MODEL_FACTOR[workModel] || 1;
    const combinedFactor = levelFactor * experienceFactor * modelFactor;

    const minSalary = Math.max(STP_MINIMUM_WAGE.monthly, Math.round(categoryMin * combinedFactor));
    const maxSalary = Math.max(Math.round(minSalary * 1.05), Math.round(categoryMax * combinedFactor));
    const averageSalary = Math.round((minSalary + maxSalary) / 2);

    const employerContributionRate = marketData?.employerContributionRate || STP_SOCIAL_SECURITY.applied.employerRate;
    const monthlyEmployerBudget = Math.round(maxSalary * (1 + employerContributionRate));

    return {
      minSalary,
      maxSalary,
      averageSalary,
      annualAverage: averageSalary * 12,
      monthlyEmployerBudget,
      annualEmployerBudget: monthlyEmployerBudget * 12
    };
  }, [selectedCategory, marketData, level, experienceYears, workModel]);

  const styles = {
    page: { minHeight: '100vh', background: '#09090b', color: '#fafafa' },
    container: { maxWidth: '1020px', margin: '0 auto', padding: '2rem' },
    breadcrumb: { color: '#94a3b8', textDecoration: 'none', fontSize: '0.9rem' },
    title: { margin: '0.8rem 0 0.5rem', fontSize: '2rem', fontWeight: 800 },
    subtitle: { margin: 0, color: '#a1a1aa', lineHeight: 1.6 },
    modeTabs: { display: 'flex', gap: '0.5rem', marginTop: '1.3rem', flexWrap: 'wrap' },
    modeBtn: {
      padding: '0.55rem 0.9rem',
      borderRadius: '999px',
      border: '1px solid rgba(255,255,255,0.16)',
      background: 'transparent',
      color: '#a1a1aa',
      cursor: 'pointer',
      fontWeight: 600
    },
    modeBtnActive: {
      borderColor: 'rgba(16,185,129,0.45)',
      background: 'rgba(16,185,129,0.18)',
      color: '#6ee7b7'
    },
    sourceCard: {
      marginTop: '1rem',
      padding: '0.9rem 1rem',
      borderRadius: '12px',
      border: '1px solid rgba(16,185,129,0.25)',
      background: 'rgba(16,185,129,0.08)'
    },
    sourceText: { margin: 0, color: '#a7f3d0', fontSize: '0.82rem', lineHeight: 1.55 },
    sourceLink: { color: '#6ee7b7' },
    card: {
      marginTop: '1rem',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '16px',
      padding: '1.25rem'
    },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' },
    field: { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
    label: { color: '#d4d4d8', fontWeight: 600, fontSize: '0.9rem' },
    input: {
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '10px',
      color: '#fafafa',
      padding: '0.7rem 0.8rem'
    },
    results: { marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.9rem' },
    resultBox: {
      background: 'rgba(16,185,129,0.08)',
      border: '1px solid rgba(16,185,129,0.2)',
      borderRadius: '12px',
      padding: '0.95rem'
    },
    resultLabel: { margin: 0, color: '#a7f3d0', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' },
    resultValue: { margin: '0.4rem 0 0', fontSize: '1.2rem', fontWeight: 700 },
    note: { marginTop: '1rem', color: '#a1a1aa', fontSize: '0.85rem', lineHeight: 1.6 }
  };

  return (
    <>
      <Head>
        <title>Calculadora Salarial | Recursos EmpregoSTP</title>
        <meta
          name="description"
          content="Estimativa salarial baseada em dados reais de vagas publicadas em STP e piso salarial de referencia."
        />
      </Head>
      <div style={styles.page}>
        <LandingHeader />
        <main style={styles.container}>
          <Link href="/recursos" style={styles.breadcrumb}>
            {'<-'} Voltar para Recursos
          </Link>
          <h1 style={styles.title}>Calculadora Salarial</h1>
          <p style={styles.subtitle}>
            Estimativa baseada no piso salarial de STP e em vagas ativas publicadas na plataforma.
          </p>

          <div style={styles.sourceCard}>
            <p style={styles.sourceText}>
              Base de calculo: {marketData.totalJobsWithSalary} vagas com salario em STP. Piso de referencia: {formatMoney(marketData.minWageMonthly)} {marketData.currency}/mes
              {' '}({marketData.minimumWageEffectiveDate}).
            </p>
            <p style={{ ...styles.sourceText, marginTop: '0.3rem' }}>
              Fonte do piso: <a href={STP_COMPENSATION_SOURCES.minimumWage.url} target="_blank" rel="noreferrer" style={styles.sourceLink}>{STP_COMPENSATION_SOURCES.minimumWage.title}</a>.
            </p>
          </div>

          <div style={styles.modeTabs}>
            <button
              type="button"
              style={{ ...styles.modeBtn, ...(mode === 'candidato' ? styles.modeBtnActive : {}) }}
              onClick={() => setMode('candidato')}
            >
              Modo candidato
            </button>
            <button
              type="button"
              style={{ ...styles.modeBtn, ...(mode === 'empresa' ? styles.modeBtnActive : {}) }}
              onClick={() => setMode('empresa')}
            >
              Modo empresa
            </button>
          </div>

          <section style={styles.card}>
            <div style={styles.grid}>
              <label style={styles.field}>
                <span style={styles.label}>Area</span>
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={styles.input}>
                  {marketData.categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name} ({category.sampleSize})
                    </option>
                  ))}
                </select>
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Nivel</span>
                <select value={level} onChange={(e) => setLevel(e.target.value)} style={styles.input}>
                  <option value="junior">Junior</option>
                  <option value="pleno">Pleno</option>
                  <option value="senior">Senior</option>
                  <option value="lideranca">Lideranca</option>
                </select>
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Anos de experiencia</span>
                <input
                  type="number"
                  min="0"
                  max="40"
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(e.target.value)}
                  style={styles.input}
                />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Modelo de trabalho</span>
                <select value={workModel} onChange={(e) => setWorkModel(e.target.value)} style={styles.input}>
                  <option value="presencial">Presencial</option>
                  <option value="hibrido">Hibrido</option>
                  <option value="remoto">Remoto</option>
                </select>
              </label>
            </div>

            <div style={styles.results}>
              <div style={styles.resultBox}>
                <p style={styles.resultLabel}>Faixa minima mensal (Db)</p>
                <p style={styles.resultValue}>{formatMoney(result.minSalary)}</p>
              </div>
              <div style={styles.resultBox}>
                <p style={styles.resultLabel}>Faixa maxima mensal (Db)</p>
                <p style={styles.resultValue}>{formatMoney(result.maxSalary)}</p>
              </div>
              <div style={styles.resultBox}>
                <p style={styles.resultLabel}>Media anual estimada (Db)</p>
                <p style={styles.resultValue}>{formatMoney(result.annualAverage)}</p>
              </div>
              <div style={styles.resultBox}>
                <p style={styles.resultLabel}>
                  {mode === 'empresa' ? 'Orcamento mensal c/ encargos (Db)' : 'Referencia de custo empresa (Db)'}
                </p>
                <p style={styles.resultValue}>{formatMoney(result.monthlyEmployerBudget)}</p>
              </div>
            </div>

            <p style={styles.note}>
              Esta ferramenta e orientativa. Valores variam por negociacao, beneficios, regime contratual e mudancas legais.
            </p>
          </section>
        </main>
        <Footer />
      </div>
    </>
  );
}

export async function getServerSideProps(context) {
  const access = await resolveProfessionalResourceAccess(context);

  if (!access.isAuthenticated) {
    return {
      redirect: { destination: '/login', permanent: false }
    };
  }

  if (!access.allowed) {
    return {
      redirect: { destination: access.upgradeUrl || '/premium/candidatos', permanent: false }
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
      medianMax: Math.round(STP_MINIMUM_WAGE.monthly * 1.7)
    }
  ];

  return {
    props: {
      marketData: {
        totalJobsWithSalary: benchmark.totalJobsWithSalary,
        categories: benchmark.categories.length ? benchmark.categories.slice(0, 20) : fallbackCategories,
        overallMedianMin: benchmark.overallMedianMin,
        overallMedianMax: benchmark.overallMedianMax,
        minWageMonthly: STP_MINIMUM_WAGE.monthly,
        minimumWageEffectiveDate: STP_MINIMUM_WAGE.effectiveDate,
        employerContributionRate: STP_SOCIAL_SECURITY.applied.employerRate,
        currency: STP_MINIMUM_WAGE.currency,
        generatedAt: new Date().toISOString().slice(0, 10)
      }
    }
  };
}
