import { DOMAIN_MESSAGES } from './messages';

export type DomainErrorCode = keyof typeof DOMAIN_MESSAGES;

export interface DomainError {
  code: DomainErrorCode;
  message: string;
}
export type Result<T> =
  { ok: true; value: T } | { ok: false; error: DomainError };
export function success<T>(value: T): Result<T> {
  return { ok: true, value };
}
export function failure<T = never>(
  code: DomainErrorCode,
  message: string = DOMAIN_MESSAGES[code],
): Result<T> {
  return { ok: false, error: { code, message } };
}
