import Head from 'next/head';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import LandingHeader from '../../components/LandingHeader';
import Footer from '../../components/home/Footer';
import { resolveProfessionalResourceAccess } from '../../lib/resourcePremiumAccess';
import {
  STP_COMPENSATION_SOURCES,
  STP_IRS_BRACKETS,
  STP_SOCIAL_SECURITY,
  computeAnnualIrsTax
} from '../../lib/stpCompensationData';

const formatMoney = (value) =>
  Number(value || 0).toLocaleString('pt-PT', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });

export default function CalculadoraImpostosPage() {
  const [grossSalary, setGrossSalary] = useState(3000);
  const [contractType, setContractType] = useState('dependente');
  const [inssProfile, setInssProfile] = useState('aplicada');
  const [customSocialRate, setCustomSocialRate] = useState(0);
  const [months, setMonths] = useState(12);

  const result = useMemo(() => {
    const gross = Math.max(Number(grossSalary) || 0, 0);
    const monthCount = Math.max(Number(months) || 12, 1);
    const selectedRates = inssProfile === 'legal' ? STP_SOCIAL_SECURITY.legal : STP_SOCIAL_SECURITY.applied;
    const employeeRate = contractType === 'dependente'
      ? selectedRates.employeeRate
      : Math.max(Number(customSocialRate) || 0, 0) / 100;
    const employerRate = contractType === 'dependente' ? selectedRates.employerRate : 0;

    const socialSecurity = gross * employeeRate;
    const annualGross = gross * monthCount;
    const annualSocialSecurity = socialSecurity * monthCount;
    const taxableAnnualIncome = Math.max(annualGross - annualSocialSecurity, 0);
    const irs = computeAnnualIrsTax(taxableAnnualIncome, STP_IRS_BRACKETS);
    const annualIncomeTax = irs.tax;
    const monthlyIncomeTax = annualIncomeTax / monthCount;
    const netSalary = Math.max(gross - socialSecurity - monthlyIncomeTax, 0);
    const employerTotalCost = gross * (1 + employerRate);

    return {
      socialSecurity,
      monthlyIncomeTax,
      netSalary,
      annualGross,
      annualNet: netSalary * monthCount,
      annualIncomeTax,
      taxableAnnualIncome,
      irsRate: irs.rate,
      irsDeduction: irs.deduction,
      employeeRate,
      employerRate,
      employerTotalCost
    };
  }, [grossSalary, contractType, inssProfile, customSocialRate, months]);

  const styles = {
    page: { minHeight: '100vh', background: '#09090b', color: '#fafafa' },
    container: { maxWidth: '980px', margin: '0 auto', padding: '2rem' },
    breadcrumb: { color: '#94a3b8', textDecoration: 'none', fontSize: '0.9rem' },
    title: { margin: '0.8rem 0 0.5rem', fontSize: '2rem', fontWeight: 800 },
    subtitle: { margin: 0, color: '#a1a1aa', lineHeight: 1.6 },
    sourceCard: {
      marginTop: '1rem',
      padding: '0.9rem 1rem',
      borderRadius: '12px',
      border: '1px solid rgba(245,158,11,0.25)',
      background: 'rgba(245,158,11,0.08)'
    },
    sourceText: { margin: 0, color: '#fde68a', fontSize: '0.82rem', lineHeight: 1.55 },
    sourceLink: { color: '#fcd34d' },
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
    box: {
      background: 'rgba(245,158,11,0.08)',
      border: '1px solid rgba(245,158,11,0.2)',
      borderRadius: '12px',
      padding: '0.95rem'
    },
    boxLabel: { margin: 0, color: '#fcd34d', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' },
    boxValue: { margin: '0.4rem 0 0', fontSize: '1.2rem', fontWeight: 700 },
    note: { marginTop: '1rem', color: '#a1a1aa', fontSize: '0.85rem', lineHeight: 1.6 }
  };

  return (
    <>
      <Head>
        <title>Calculadora de Impostos | Recursos EmpregoSTP</title>
        <meta
          name="description"
          content="Simulador fiscal de STP com tabela oficial de IRS e contribuicoes de seguranca social."
        />
      </Head>
      <div style={styles.page}>
        <LandingHeader />
        <main style={styles.container}>
          <Link href="/recursos" style={styles.breadcrumb}>
            {'<-'} Voltar para Recursos
          </Link>
          <h1 style={styles.title}>Calculadora de Impostos</h1>
          <p style={styles.subtitle}>
            Simulador com tabela oficial de IRS de STP e contribuicoes de seguranca social.
          </p>

          <div style={styles.sourceCard}>
            <p style={styles.sourceText}>
              IRS: tabela de englobamento A/B/D com parcela a abater.
              {' '}<a href={STP_COMPENSATION_SOURCES.incomeTax.url} target="_blank" rel="noreferrer" style={styles.sourceLink}>{STP_COMPENSATION_SOURCES.incomeTax.title}</a>.
            </p>
            <p style={{ ...styles.sourceText, marginTop: '0.3rem' }}>
              INSS: taxa aplicada (10% total = 6% empregador + 4% trabalhador) e taxa legal (14%) conforme boletim OIT/INSS.
              {' '}<a href={STP_COMPENSATION_SOURCES.socialSecurity.url} target="_blank" rel="noreferrer" style={styles.sourceLink}>{STP_COMPENSATION_SOURCES.socialSecurity.title}</a>.
            </p>
          </div>

          <section style={styles.card}>
            <div style={styles.grid}>
              <label style={styles.field}>
                <span style={styles.label}>Salario bruto mensal (Db)</span>
                <input
                  type="number"
                  min="0"
                  value={grossSalary}
                  onChange={(e) => setGrossSalary(e.target.value)}
                  style={styles.input}
                />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Tipo de vinculo</span>
                <select value={contractType} onChange={(e) => setContractType(e.target.value)} style={styles.input}>
                  <option value="dependente">Trabalhador dependente</option>
                  <option value="independente">Independente</option>
                </select>
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Perfil de taxa INSS</span>
                <select value={inssProfile} onChange={(e) => setInssProfile(e.target.value)} style={styles.input}>
                  <option value="aplicada">Taxa aplicada (10% total)</option>
                  <option value="legal">Taxa legal (14% total)</option>
                </select>
              </label>

              {contractType === 'independente' && (
                <label style={styles.field}>
                  <span style={styles.label}>Contribuicao social manual (%)</span>
                  <input
                    type="number"
                    min="0"
                    max="40"
                    value={customSocialRate}
                    onChange={(e) => setCustomSocialRate(e.target.value)}
                    style={styles.input}
                  />
                </label>
              )}

              <label style={styles.field}>
                <span style={styles.label}>Meses de referencia anual</span>
                <select value={months} onChange={(e) => setMonths(Number(e.target.value))} style={styles.input}>
                  <option value={12}>12 meses</option>
                  <option value={14}>14 meses</option>
                </select>
              </label>
            </div>

            <div style={styles.results}>
              <div style={styles.box}>
                <p style={styles.boxLabel}>Seguranca social mensal (Db)</p>
                <p style={styles.boxValue}>{formatMoney(result.socialSecurity)}</p>
              </div>
              <div style={styles.box}>
                <p style={styles.boxLabel}>IRS mensal estimado (Db)</p>
                <p style={styles.boxValue}>{formatMoney(result.monthlyIncomeTax)}</p>
              </div>
              <div style={styles.box}>
                <p style={styles.boxLabel}>Salario liquido mensal (Db)</p>
                <p style={styles.boxValue}>{formatMoney(result.netSalary)}</p>
              </div>
              <div style={styles.box}>
                <p style={styles.boxLabel}>Salario liquido anual (Db)</p>
                <p style={styles.boxValue}>{formatMoney(result.annualNet)}</p>
              </div>
              <div style={styles.box}>
                <p style={styles.boxLabel}>Taxa IRS aplicada</p>
                <p style={styles.boxValue}>{(result.irsRate * 100).toFixed(0)}%</p>
              </div>
              <div style={styles.box}>
                <p style={styles.boxLabel}>Custo mensal para empregador (Db)</p>
                <p style={styles.boxValue}>{formatMoney(result.employerTotalCost)}</p>
              </div>
            </div>

            <p style={styles.note}>
              Simulacao fiscal orientativa para planeamento. Em caso de duvida legal/contabilistica, valide com a Direccao dos Impostos e o INSS.
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

  return {
    props: {}
  };
}
