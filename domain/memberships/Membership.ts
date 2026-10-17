export const MEMBERSHIP_ROLES = ['OWNER', 'ADMIN', 'RECRUITER', 'REVIEWER'] as const;
export const MEMBERSHIP_STATUSES = ['INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED'] as const;
export interface OrganizationMembership { userId: string; organizationId: string; role: typeof MEMBERSHIP_ROLES[number]; status: typeof MEMBERSHIP_STATUSES[number]; invitedBy?: string; joinedAtMs?: number }
export interface LegacyCompanyUser { id: string; userType: string; status?: string; organizationId?: string; companyId?: string; organizationIds?: readonly string[] }
export interface LegacyOrganization { id: string; ownerUserId?: string }
export interface MembershipBackfillPlan { memberships: OrganizationMembership[]; organizations: { id: string; ownerUserId: string; legacyCompanyUserId: string }[]; ambiguous: { userId: string; code: 'MULTIPLE_ORGANIZATIONS' | 'OWNER_NOT_CONFIRMED' | 'CONFLICTING_OWNERS' | 'INVALID_ID' }[] }
const safeId = (value: string): boolean => Boolean(value && value.length <= 512 && !value.includes('/') && value !== '.' && value !== '..' && !/^__.*__$/.test(value));

/** Pure expand-only planner. Missing legacy org ids mean the existing company
 * identity (the company user's uid), NOT a guessed external organization. */
export function planMembershipBackfill(users: readonly LegacyCompanyUser[], organizations: readonly LegacyOrganization[], now: number): MembershipBackfillPlan {
  const plan: MembershipBackfillPlan = { memberships: [], organizations: [], ambiguous: [] };
  for (const user of users) {
    if (user.userType !== 'empresa') continue;
    const ids = [...new Set([user.organizationId, user.companyId, ...(user.organizationIds || [])].filter((id): id is string => Boolean(id)))];
    if (ids.length > 1) { plan.ambiguous.push({ userId: user.id, code: 'MULTIPLE_ORGANIZATIONS' }); continue; }
    const orgId = ids[0] || user.id;
    if (!safeId(user.id) || !safeId(orgId) || !Number.isFinite(now)) { plan.ambiguous.push({ userId: user.id, code: 'INVALID_ID' }); continue; }
    const existing = organizations.find((org) => org.id === orgId);
    if ((existing && existing.ownerUserId !== user.id) || (!existing && orgId !== user.id)) { plan.ambiguous.push({ userId: user.id, code: 'OWNER_NOT_CONFIRMED' }); continue; }
    const active = !['disabled', 'inactive', 'suspended'].includes(user.status?.trim().toLowerCase() || '');
    if (!existing) plan.organizations.push({ id: orgId, ownerUserId: user.id, legacyCompanyUserId: user.id });
    plan.memberships.push({ userId: user.id, organizationId: orgId, role: 'OWNER', status: active ? 'ACTIVE' : 'SUSPENDED', joinedAtMs: now });
  }
  const conflicting = new Set(plan.memberships.filter((item) => plan.memberships.some((other) => other.organizationId === item.organizationId && other.userId !== item.userId)).map((item) => item.organizationId));
  for (const item of plan.memberships.filter((item) => conflicting.has(item.organizationId))) plan.ambiguous.push({ userId: item.userId, code: 'CONFLICTING_OWNERS' });
  plan.memberships = plan.memberships.filter((item) => !conflicting.has(item.organizationId));
  plan.organizations = plan.organizations.filter((item) => !conflicting.has(item.id));
  return plan;
}
