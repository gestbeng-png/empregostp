// A moeda de São Tomé e Príncipe está indexada ao euro a uma paridade fixa.
// Os preços dos planos são definidos nela; o pagamento online (Stripe) não a
// aceita, por isso cobra o equivalente em euros a esta taxa.
export const DOBRAS_PER_EURO = 24.5;

/**
 * Rótulo único da moeda em toda a aplicação.
 *
 * O catálogo mostrava "100 Dobras" ao lado de "250 STD" na mesma tabela,
 * porque metade dos rótulos vinha do Firestore (escritos à mão pelo admin) e
 * a outra metade dos valores por omissão. O preço continua a ser o número
 * guardado na base de dados — é o que o admin altera —, mas a moeda passa a
 * ser sempre derivada daqui, e nunca do texto guardado.
 */
export const PLAN_CURRENCY = 'STD';

// Mínimo do Stripe para cobranças em euros.
const STRIPE_MIN_EURO_CENTS = 50;

// Sufixo de periodicidade que vale a pena preservar do rótulo guardado.
const PERIOD_SUFFIX = /(\/\s*m[eê]s|\s*(?:por\s+m[eê]s|mensal))\s*$/i;

/**
 * `1500` → `"1.500 STD"`.
 *
 * O agrupamento é feito à mão e não com `toLocaleString`: o Node pode correr
 * com ICU reduzido e devolver "1500" onde o browser devolve "1.500", o que
 * daria divergência de hidratação entre o HTML do servidor e o do cliente.
 */
export function formatPlanPrice(price) {
  const amount = Number(price);
  if (!Number.isFinite(amount) || amount <= 0) return `0 ${PLAN_CURRENCY}`;
  const grouped = String(Math.round(amount)).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    '.',
  );
  return `${grouped} ${PLAN_CURRENCY}`;
}

// Formas que já apareceram escritas à mão nos documentos.
const CURRENCY_TOKEN_GLOBAL = /\b(?:dobras?|stn|db)\b/gi;

/**
 * Preços escritos à mão em texto livre (anúncios de produto), onde não há
 * campo numérico: mantém o número tal como está e troca só a moeda.
 */
export function normalizeCurrencyText(text) {
  const value = String(text ?? '').trim();
  if (!value) return value;
  return value.replace(CURRENCY_TOKEN_GLOBAL, PLAN_CURRENCY);
}

/**
 * Rótulo a mostrar para um plano.
 *
 * O número vem sempre do campo `price` do Firestore — é esse que o admin
 * altera. Do texto guardado aproveita-se apenas o sufixo de periodicidade,
 * para que nem a moeda nem o separador de milhares possam divergir entre
 * planos editados à mão e planos por omissão.
 */
export function normalizePlanPriceLabel(label, price) {
  const text = String(label ?? '').trim();
  // "Gratuito" e afins não são preços: ficam como estão.
  if (text && !/\d/.test(text)) return text;
  const suffix = text.match(PERIOD_SUFFIX)?.[0] ?? '';
  return `${formatPlanPrice(price)}${suffix}`;
}

export function dobrasToEuroCents(dobras) {
  const amount = Number(dobras);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round((amount / DOBRAS_PER_EURO) * 100);
}

export function canChargeOnline(dobras) {
  return dobrasToEuroCents(dobras) >= STRIPE_MIN_EURO_CENTS;
}

export function formatEuroCents(cents) {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format((Number(cents) || 0) / 100);
}
