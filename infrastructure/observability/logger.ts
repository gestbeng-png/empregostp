import { createHash } from 'node:crypto';

import { getSafeErrorMetadata } from '@/lib/serverLog';

export interface LogContext { requestId?: string; userId?: string; orgId?: string; route?: string; durationMs?: number; errorCode?: string }
const safeToken = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,100}$/.test(value);
/** Allowlist only. Never serialize exceptions, request bodies or free text. */
export function logEvent(level: 'info' | 'warn' | 'error', msg: string, context: LogContext = {}, error?: unknown, write: (line: string) => void = (line) => { process.stdout.write(line); }): void {
  const fields = {
    level, msg: /^[a-z][a-z0-9_]{0,79}$/.test(msg) ? msg : 'unclassified_event',
    ...(safeToken(context.requestId) ? { requestId: context.requestId } : {}),
    ...(typeof context.userId === 'string' && context.userId ? { userId: createHash('sha256').update(context.userId).digest('hex') } : {}),
    ...(safeToken(context.orgId) ? { orgId: context.orgId } : {}),
    ...(typeof context.route === 'string' && /^\/(?:[a-zA-Z0-9/_-]|\[[a-zA-Z]+\]){0,160}$/.test(context.route) ? { route: context.route } : {}),
    ...(Number.isFinite(context.durationMs) && (context.durationMs ?? -1) >= 0 ? { durationMs: context.durationMs } : {}),
    ...(typeof context.errorCode === 'string' && /^[A-Z][A-Z0-9_]{1,63}$/.test(context.errorCode) ? { errorCode: context.errorCode } : {}),
    ...(error ? { errorCategory: getSafeErrorMetadata(error).category } : {}),
  };
  write(`${JSON.stringify(fields)}\n`);
}
