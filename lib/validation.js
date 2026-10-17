// Validações partilhadas entre front-end e back-end.
// Usar o MESMO validador nos dois lados garante que um email rejeitado no
// browser também é rejeitado no servidor (defesa em profundidade).

// Regex pragmática para email: exige parte local, "@", domínio com pelo menos
// um ponto e TLD com 2+ letras. Não aceita espaços nem domínios sem ponto.
const EMAIL_REGEX =
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Normaliza um email: remove espaços e passa a minúsculas.
 * @param {unknown} email
 * @returns {string}
 */
export function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

/**
 * Valida o formato de um email.
 * @param {unknown} email
 * @returns {boolean}
 */
export function isValidEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized || normalized.length > 254) return false;
  return EMAIL_REGEX.test(normalized);
}

// Comprimento mínimo exigido para senhas fortes (registo/redefinição).
const PASSWORD_MIN_LENGTH = 8;

/**
 * Avalia uma senha contra cada regra de robustez individualmente.
 * Útil para mostrar uma lista de requisitos em tempo real no formulário.
 * @param {unknown} password
 * @returns {{ length: boolean, uppercase: boolean, lowercase: boolean, number: boolean, special: boolean }}
 */
export function getPasswordChecks(password) {
  const value = typeof password === 'string' ? password : '';
  return {
    length: value.length >= PASSWORD_MIN_LENGTH,
    uppercase: /[A-Z]/.test(value),
    lowercase: /[a-z]/.test(value),
    number: /[0-9]/.test(value),
    special: /[^A-Za-z0-9]/.test(value),
  };
}

/**
 * Valida uma senha forte: mínimo 8 caracteres, com maiúscula, minúscula,
 * número e caractere especial. Usado no registo e na redefinição de senha.
 * @param {unknown} password
 * @returns {boolean}
 */
export function isStrongPassword(password) {
  return Object.values(getPasswordChecks(password)).every(Boolean);
}
