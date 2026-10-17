import { createHash } from 'node:crypto';

export function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
export function validDocumentId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 512 &&
    value !== '.' &&
    value !== '..' &&
    !value.includes('/') &&
    !/^__.*__$/.test(value)
  );
}
export function membershipId(userId: string, organizationId: string): string {
  return digest([userId, organizationId]);
}
