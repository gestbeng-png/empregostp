import { createHmac } from 'node:crypto';

import type { Firestore } from 'firebase-admin/firestore';

import { RATE_LIMIT_POLICIES } from '@/domain/rate-limits/policies';
import type { RateLimitedAction } from '@/domain/rate-limits/policies';
import { consumeFirestoreRateLimit } from '@/lib/firestoreRateLimit';

export interface RateLimitResult { allowed: boolean; remaining: number; retryAfterSeconds: number }
/** Reuses the existing distributed limiter; no changes to legacy endpoints.
 * Hashed identity avoids leaking IPs/uids via readable document prefixes. */
export async function consumeRateLimit(db: Firestore, action: RateLimitedAction, identities: { userId?: string; organizationId?: string; ip?: string; account?: string; phone?: string }, hashingSecret: string, now = Date.now()): Promise<RateLimitResult> {
  if (!hashingSecret || !Number.isFinite(now) || !Object.hasOwn(RATE_LIMIT_POLICIES, action)) return { allowed: false, remaining: 0, retryAfterSeconds: 60 };
  let remaining = Number.MAX_SAFE_INTEGER;
  const values = { USER: identities.userId, ORGANIZATION: identities.organizationId, IP: identities.ip, ACCOUNT: identities.account, PHONE: identities.phone, ACCOUNT_IP: identities.account && identities.ip ? JSON.stringify([identities.account, identities.ip]) : undefined };
  for (const policy of RATE_LIMIT_POLICIES[action]) {
    const identity = values[policy.subject];
    if (!identity) return { allowed: false, remaining: 0, retryAfterSeconds: 60 };
    const hashed = createHmac('sha256', hashingSecret).update(identity).digest('hex');
    const result: RateLimitResult = await consumeFirestoreRateLimit({ firestore: db, key: `${action}_${policy.subject}_${policy.windowMs}_${hashed}`, limit: policy.limit, windowMs: policy.windowMs, now });
    if (!result.allowed) return result;
    remaining = Math.min(remaining, result.remaining);
  }
  return { allowed: true, remaining, retryAfterSeconds: 0 };
}
