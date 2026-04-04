export const STP_COMPENSATION_SOURCES = {
  minimumWage: {
    title: 'WageIndicator - Salario minimo STP',
    url: 'https://wageindicator.org/pt-st/trabalho-em-sao-tome-e-principe/salario-minimo/',
    effectiveDate: '2025-10-01'
  },
  incomeTax: {
    title: 'Direccao dos Impostos STP - IRS Parcelas a Abater',
    url: 'https://impostos.financas.gov.st/index.php/insurance-planning',
    legalBasis: 'Decreto-Lei n. 16/2016'
  },
  socialSecurity: {
    title: 'OIT / INSS STP - 1. Boletim Estatistico',
    url: 'https://www.ilo.org/sites/default/files/wcmsp5/groups/public/%40europe/%40ro-geneva/%40ilo-lisbon/documents/publication/wcms_905985.pdf',
    legalBasis: 'Decreto-Lei n. 25/2014 e Decreto n. 21/2015'
  }
};

export const STP_MINIMUM_WAGE = {
  monthly: 3000,
  currency: 'Db',
  effectiveDate: '2025-10-01'
};

// Tabela oficial de englobamento IRS (Categorias A, B e D) + parcela a abater.
// Fonte: Direccao dos Impostos de STP.
export const STP_IRS_BRACKETS = [
  { upToAnnual: 11700, rate: 0, deduction: 0 },
  { upToAnnual: 50000, rate: 0.1, deduction: 1170 },
  { upToAnnual: 100000, rate: 0.13, deduction: 2670 },
  { upToAnnual: 150000, rate: 0.15, deduction: 4670 },
  { upToAnnual: 240000, rate: 0.2, deduction: 12170 },
  { upToAnnual: null, rate: 0.25, deduction: 24170 }
];

// Contribuicoes INSS:
// - Taxa legal prevista: 14% (8% empregador + 6% trabalhador)
// - Taxa aplicada na pratica (suspensao): 10% (6% empregador + 4% trabalhador)
export const STP_SOCIAL_SECURITY = {
  legal: {
    employeeRate: 0.06,
    employerRate: 0.08
  },
  applied: {
    employeeRate: 0.04,
    employerRate: 0.06
  }
};

export function computeAnnualIrsTax(annualTaxableIncome, brackets = STP_IRS_BRACKETS) {
  const taxable = Math.max(Number(annualTaxableIncome) || 0, 0);
  const selectedBracket = brackets.find((bracket) => bracket.upToAnnual === null || taxable <= bracket.upToAnnual) || brackets[brackets.length - 1];
  const grossTax = taxable * selectedBracket.rate;
  const tax = Math.max(grossTax - selectedBracket.deduction, 0);
  return {
    tax,
    rate: selectedBracket.rate,
    deduction: selectedBracket.deduction
  };
}

function normalizeJobCategory(value) {
  return String(value || 'Outros')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 60) || 'Outros';
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

export function buildSalaryBenchmarksFromJobs(jobs = []) {
  const buckets = new Map();
  const allMins = [];
  const allMaxs = [];

  jobs.forEach((job) => {
    const category = normalizeJobCategory(job?.categoria || job?.category || 'Outros');
    const salaryMin = toNumber(job?.salarioDe || job?.salaryMin || job?.salario);
    const salaryMax = toNumber(job?.salarioAte || job?.salaryMax || job?.salario);

    if (!salaryMin && !salaryMax) return;

    const resolvedMin = salaryMin || Math.max((salaryMax || 0) * 0.75, STP_MINIMUM_WAGE.monthly);
    const resolvedMax = salaryMax || Math.max((salaryMin || 0) * 1.25, resolvedMin);
    allMins.push(resolvedMin);
    allMaxs.push(resolvedMax);

    if (!buckets.has(category)) {
      buckets.set(category, { mins: [], maxs: [] });
    }

    const bucket = buckets.get(category);
    bucket.mins.push(resolvedMin);
    bucket.maxs.push(resolvedMax);
  });

  const categories = Array.from(buckets.entries())
    .map(([name, values]) => ({
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'outros',
      name,
      sampleSize: values.mins.length,
      medianMin: Math.round(median(values.mins) || STP_MINIMUM_WAGE.monthly),
      medianMax: Math.round(median(values.maxs) || STP_MINIMUM_WAGE.monthly * 1.5)
    }))
    .filter((item) => item.sampleSize > 0)
    .sort((a, b) => b.sampleSize - a.sampleSize);

  return {
    totalJobsWithSalary: categories.reduce((sum, item) => sum + item.sampleSize, 0),
    categories,
    overallMedianMin: Math.round(median(allMins) || STP_MINIMUM_WAGE.monthly),
    overallMedianMax: Math.round(median(allMaxs) || STP_MINIMUM_WAGE.monthly * 1.7)
  };
}
