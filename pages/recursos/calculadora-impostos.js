import Head from 'next/head';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  FiArrowLeft,
  FiDatabase,
  FiExternalLink,
  FiInfo,
  FiPercent,
  FiSliders,
} from 'react-icons/fi';
import PublicPageShell from '../../components/PublicPageShell';
import { resolveProfessionalResourceAccess } from '../../lib/resourcePremiumAccess';
import {
  STP_COMPENSATION_SOURCES,
  STP_IRS_BRACKETS,
  STP_SOCIAL_SECURITY,
  computeAnnualIrsTax,
} from '../../lib/stpCompensationData';
import styles from '../../styles/ResourceCalculatorPage.module.css';
import { redirectToLogin } from '../../lib/loginRedirect';

const formatMoney = (value) =>
  Number(value || 0).toLocaleString('pt-PT', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
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
    const selectedRates =
      inssProfile === 'legal'
        ? STP_SOCIAL_SECURITY.legal
        : STP_SOCIAL_SECURITY.applied;
    const employeeRate =
      contractType === 'dependente'
        ? selectedRates.employeeRate
        : Math.max(Number(customSocialRate) || 0, 0) / 100;
    const employerRate =
      contractType === 'dependente' ? selectedRates.employerRate : 0;

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
      employerTotalCost,
    };
  }, [grossSalary, contractType, inssProfile, customSocialRate, months]);

  return (
    <>
      <Head>
        <title>Calculadora de Impostos | Recursos EmpregoSTP</title>
        <meta
          name="description"
          content="Simulação fiscal para São Tomé e Príncipe com tabela de IRS e contribuições para a segurança social."
        />
      </Head>

      <PublicPageShell>
        <div className={`${styles.page} ${styles.taxPage}`}>
          <div className={styles.container}>
            <Link href="/recursos" className={styles.backLink}>
              <FiArrowLeft aria-hidden="true" />
              Voltar aos recursos
            </Link>

            <header className={styles.hero}>
              <span className={styles.eyebrow}>
                <FiPercent aria-hidden="true" />
                Simulação fiscal
              </span>
              <h1>Calculadora de impostos</h1>
              <p>
                Estime IRS, segurança social, salário líquido e custo mensal
                para a entidade empregadora.
              </p>
            </header>

            <section
              className={styles.sourceBand}
              aria-labelledby="tax-source-title"
            >
              <div className={styles.sourceHeading}>
                <FiDatabase aria-hidden="true" />
                <div>
                  <h2 id="tax-source-title">Fontes de referência</h2>
                  <p>
                    Tabela de englobamento de IRS com parcela a abater. Para a
                    segurança social, pode comparar a taxa aplicada e a taxa
                    legal indicada pelas fontes oficiais.
                  </p>
                </div>
              </div>
              <div className={styles.sourceLinks}>
                <a
                  href={STP_COMPENSATION_SOURCES.incomeTax.url}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.sourceLink}
                >
                  Fonte do IRS
                  <FiExternalLink aria-hidden="true" />
                </a>
                <a
                  href={STP_COMPENSATION_SOURCES.socialSecurity.url}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.sourceLink}
                >
                  Fonte do INSS
                  <FiExternalLink aria-hidden="true" />
                </a>
              </div>
            </section>

            <section
              className={styles.calculatorSection}
              aria-labelledby="tax-scenario-title"
            >
              <div className={styles.sectionHeading}>
                <FiSliders aria-hidden="true" />
                <div>
                  <h2 id="tax-scenario-title">Dados da simulação</h2>
                  <p>
                    Altere o salário, o vínculo e o período para atualizar o
                    cálculo.
                  </p>
                </div>
              </div>

              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Salário bruto mensal, Db</span>
                  <input
                    type="number"
                    min="0"
                    value={grossSalary}
                    onChange={(event) => setGrossSalary(event.target.value)}
                  />
                </label>

                <label className={styles.field}>
                  <span>Tipo de vínculo</span>
                  <select
                    value={contractType}
                    onChange={(event) => setContractType(event.target.value)}
                  >
                    <option value="dependente">Trabalhador dependente</option>
                    <option value="independente">
                      Trabalhador independente
                    </option>
                  </select>
                </label>

                <label className={styles.field}>
                  <span>Perfil da taxa do INSS</span>
                  <select
                    value={inssProfile}
                    onChange={(event) => setInssProfile(event.target.value)}
                  >
                    <option value="aplicada">
                      Taxa aplicada, 10% no total
                    </option>
                    <option value="legal">Taxa legal, 14% no total</option>
                  </select>
                </label>

                {contractType === 'independente' ? (
                  <label className={styles.field}>
                    <span>Contribuição social manual, %</span>
                    <input
                      type="number"
                      min="0"
                      max="40"
                      value={customSocialRate}
                      onChange={(event) =>
                        setCustomSocialRate(event.target.value)
                      }
                    />
                  </label>
                ) : null}

                <label className={styles.field}>
                  <span>Meses de referência anual</span>
                  <select
                    value={months}
                    onChange={(event) => setMonths(Number(event.target.value))}
                  >
                    <option value={12}>12 meses</option>
                    <option value={14}>14 meses</option>
                  </select>
                </label>
              </div>

              <div className={styles.resultHeading}>
                <h2>Resultado mensal e anual</h2>
                <span>Estimativa atualizada</span>
              </div>

              <div
                className={`${styles.results} ${styles.taxResults}`}
                aria-live="polite"
              >
                <output
                  className={styles.resultBox}
                  aria-label="Segurança social mensal"
                >
                  <span>Segurança social mensal</span>
                  <strong>{formatMoney(result.socialSecurity)} Db</strong>
                </output>
                <output
                  className={styles.resultBox}
                  aria-label="IRS mensal estimado"
                >
                  <span>IRS mensal estimado</span>
                  <strong>{formatMoney(result.monthlyIncomeTax)} Db</strong>
                </output>
                <output
                  className={styles.resultBox}
                  aria-label="Salário líquido mensal"
                >
                  <span>Salário líquido mensal</span>
                  <strong>{formatMoney(result.netSalary)} Db</strong>
                </output>
                <output
                  className={styles.resultBox}
                  aria-label="Salário líquido anual"
                >
                  <span>Salário líquido anual</span>
                  <strong>{formatMoney(result.annualNet)} Db</strong>
                </output>
                <output
                  className={styles.resultBox}
                  aria-label="Taxa de IRS aplicada"
                >
                  <span>Taxa de IRS aplicada</span>
                  <strong>{(result.irsRate * 100).toFixed(0)}%</strong>
                </output>
                <output
                  className={styles.resultBox}
                  aria-label="Custo mensal para a entidade empregadora"
                >
                  <span>Custo mensal para a entidade empregadora</span>
                  <strong>{formatMoney(result.employerTotalCost)} Db</strong>
                </output>
              </div>

              <p className={styles.note}>
                <FiInfo aria-hidden="true" />
                Esta simulação é orientativa. Em caso de dúvida legal ou
                contabilística, confirme os valores com a Direção dos Impostos e
                o INSS.
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

  return {
    props: {},
  };
}
