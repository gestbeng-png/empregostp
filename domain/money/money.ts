/**
 * B3 / F1.4 — dinheiro e salários.
 *
 * Valores guardados em inteiros de cêntimos (`amountMinor`) com moeda ISO.
 * A UI salarial não mostra casas decimais. O separador de milhares é o espaço
 * fino inseparável (U+202F) e o símbolo da Dobra é "Db" — não se confia no
 * `Intl` para isto. A taxa EUR↔STN é configuração, nunca uma constante aqui.
 */
export const CURRENCIES = ['STN', 'EUR'] as const;
export type Currency = (typeof CURRENCIES)[number];
export const SALARY_PERIODS = ['HOUR', 'DAY', 'MONTH', 'YEAR'] as const;
export type SalaryPeriod = (typeof SALARY_PERIODS)[number];
export const SALARY_TYPES = [
  'FIXED',
  'RANGE',
  'FROM',
  'NEGOTIABLE',
  'UNDISCLOSED',
] as const;
export type SalaryType = (typeof SALARY_TYPES)[number];

export const THIN_NBSP = ' ';
const SYMBOL: Readonly<Record<Currency, string>> = { STN: 'Db', EUR: '€' };
const PERIOD_LABEL: Readonly<Record<SalaryPeriod, string>> = {
  HOUR: 'hora',
  DAY: 'dia',
  MONTH: 'mês',
  YEAR: 'ano',
};

export interface Salary {
  type: SalaryType;
  minMinor?: number | null;
  maxMinor?: number | null;
  currency: Currency;
  period?: SalaryPeriod | null;
}

function groupThousands(units: number): string {
  const sign = units < 0 ? '-' : '';
  return (
    sign + String(Math.abs(units)).replace(/\B(?=(\d{3})+(?!\d))/g, THIN_NBSP)
  );
}

function isMinor(value: unknown): value is number {
  return Number.isSafeInteger(value);
}

/** `formatMoney(350000, 'STN', { period: 'MONTH' })` → "3 500 Db/mês". */
export function formatMoney(
  amountMinor: number,
  currency: Currency,
  options: { period?: SalaryPeriod | null } = {},
): string {
  if (!isMinor(amountMinor) || !Object.hasOwn(SYMBOL, currency)) return '';
  const value = `${groupThousands(Math.round(amountMinor / 100))} ${SYMBOL[currency]}`;
  return options.period ? `${value}/${PERIOD_LABEL[options.period]}` : value;
}

/** Texto público do salário (F1.4). */
export function formatSalary(salary: Salary): string {
  const { type, currency, period } = salary;
  if (type === 'NEGOTIABLE') return 'Salário negociável';
  if (type === 'UNDISCLOSED') return 'Salário não divulgado';
  const min = salary.minMinor;
  const max = salary.maxMinor;
  if (!isMinor(min)) return 'Salário não divulgado';
  if (type === 'FROM')
    return `A partir de ${formatMoney(min, currency, { period })}`;
  if (type === 'RANGE' && isMinor(max) && max !== min) {
    const symbol = SYMBOL[currency];
    const suffix = period ? `/${PERIOD_LABEL[period]}` : '';
    return `${groupThousands(Math.round(min / 100))} – ${groupThousands(
      Math.round(max / 100),
    )} ${symbol}${suffix}`;
  }
  return formatMoney(min, currency, { period });
}

export type SalaryIssue =
  | 'MIN_REQUIRED'
  | 'RANGE_ORDER'
  | 'RANGE_TOO_WIDE'
  | 'PERIOD_REQUIRED'
  | 'INVALID_AMOUNT'
  | 'INVALID_CURRENCY';

/** Validação estrutural (bloqueia a gravação). */
export function validateSalary(salary: Salary): SalaryIssue[] {
  const issues: SalaryIssue[] = [];
  if (!Object.hasOwn(SYMBOL, salary.currency)) issues.push('INVALID_CURRENCY');
  if (salary.type === 'NEGOTIABLE' || salary.type === 'UNDISCLOSED')
    return issues;
  const { minMinor: min, maxMinor: max } = salary;
  for (const value of [min, max]) {
    if (
      value !== undefined &&
      value !== null &&
      (!isMinor(value) || value <= 0)
    )
      issues.push('INVALID_AMOUNT');
  }
  if (!isMinor(min)) issues.push('MIN_REQUIRED');
  if (salary.type === 'RANGE') {
    if (!isMinor(max) || (isMinor(min) && max <= min))
      issues.push('RANGE_ORDER');
    else if (isMinor(min) && max > 5 * min) issues.push('RANGE_TOO_WIDE');
  }
  if (!salary.period) issues.push('PERIOD_REQUIRED');
  return [...new Set(issues)];
}

// Equivalência mensal aproximada para a verificação de sanidade.
const TO_MONTHLY: Readonly<Record<SalaryPeriod, number>> = {
  HOUR: 176,
  DAY: 22,
  MONTH: 1,
  YEAR: 1 / 12,
};
export const SANITY_MONTHLY_MIN_STN_MINOR = 1_000 * 100;
export const SANITY_MONTHLY_MAX_STN_MINOR = 500_000 * 100;

/**
 * Sanidade F1.4: salário mensal < 1 000 Db ou > 500 000 Db → pedir confirmação
 * ao empregador e sinal de risco (F1.6). Não bloqueia. EUR só é verificado se
 * a taxa estiver configurada (`stnPerEur`).
 */
export function isSalaryOutsideSanity(
  salary: Salary,
  options: { stnPerEur?: number } = {},
): boolean {
  if (salary.type === 'NEGOTIABLE' || salary.type === 'UNDISCLOSED')
    return false;
  if (!salary.period) return false;
  const rate =
    salary.currency === 'STN'
      ? 1
      : options.stnPerEur && Number.isFinite(options.stnPerEur)
        ? options.stnPerEur
        : null;
  if (rate === null) return false;
  return [salary.minMinor, salary.maxMinor].filter(isMinor).some((value) => {
    const monthly = value * TO_MONTHLY[salary.period as SalaryPeriod] * rate;
    return (
      monthly < SANITY_MONTHLY_MIN_STN_MINOR ||
      monthly > SANITY_MONTHLY_MAX_STN_MINOR
    );
  });
}

/** "≈ 24 500 Db" ao lado de valores em EUR, só com taxa configurada. */
export function approximateInStn(
  amountMinor: number,
  stnPerEur: number | undefined,
): string {
  if (!isMinor(amountMinor) || !stnPerEur || !Number.isFinite(stnPerEur))
    return '';
  return `≈ ${formatMoney(Math.round(amountMinor * stnPerEur), 'STN')}`;
}

/**
 * Converte um valor salarial legado (texto livre) para cêntimos sem decidir a
 * moeda às cegas (B3): valores ≥ 1 000 000 em vagas posteriores à
 * redenominação de 2018 são suspeitos de estar em STD antigas e ficam para
 * revisão — nunca convertidos automaticamente.
 */
export function parseLegacySalary(
  value: unknown,
  createdAt: Date | null,
): { amountMinor: number | null; needsReview: boolean } {
  if (value === undefined || value === null || value === '')
    return { amountMinor: null, needsReview: false };
  const raw = String(value)
    .trim()
    .replace(/\s/g, '')
    .replace(/[^\d,.-]/g, '');
  if (!raw || raw.startsWith('-'))
    return { amountMinor: null, needsReview: true };
  let normalized = raw;
  if (raw.includes('.') && raw.includes(','))
    normalized =
      raw.lastIndexOf(',') > raw.lastIndexOf('.')
        ? raw.replace(/\./g, '').replace(',', '.')
        : raw.replace(/,/g, '');
  else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) normalized = raw.replace(/\./g, '');
  else if (/^\d{1,3}(,\d{3})+$/.test(raw)) normalized = raw.replace(/,/g, '');
  else normalized = raw.replace(',', '.');
  const units = Number.parseFloat(normalized);
  if (!Number.isFinite(units) || units <= 0)
    return { amountMinor: null, needsReview: true };
  const amountMinor = Math.round(units * 100);
  const afterRedenomination =
    createdAt === null || createdAt.getTime() >= Date.UTC(2018, 0, 1);
  return {
    amountMinor,
    needsReview: afterRedenomination && units >= 1_000_000,
  };
}
