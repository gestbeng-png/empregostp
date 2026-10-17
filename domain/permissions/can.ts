export const PERMISSION_ROLES = [
  'CANDIDATE',
  'OWNER',
  'ORG_ADMIN',
  'RECRUITER',
  'ORG_REVIEWER',
  'MODERATOR',
  'REVIEWER',
  'ADMIN',
  'SUPPORT',
  'NONE',
] as const;
export type PermissionRole = (typeof PERMISSION_ROLES)[number];
export type AccessRule = 'yes' | 'own' | 'org' | 'assigned' | 'reason' | 'none';
type Row = readonly [
  AccessRule,
  AccessRule,
  AccessRule,
  AccessRule,
  AccessRule,
  AccessRule,
  AccessRule,
  AccessRule,
  AccessRule,
  AccessRule,
];
export const PERMISSION_MATRIX = {
  view_published_job: [
    'yes',
    'yes',
    'yes',
    'yes',
    'yes',
    'yes',
    'yes',
    'yes',
    'yes',
    'yes',
  ],
  create_job: [
    'none',
    'org',
    'org',
    'org',
    'none',
    'none',
    'none',
    'reason',
    'none',
    'none',
  ],
  publish_close_job: [
    'none',
    'org',
    'org',
    'org',
    'none',
    'none',
    'none',
    'reason',
    'none',
    'none',
  ],
  moderate_job: [
    'none',
    'none',
    'none',
    'none',
    'none',
    'yes',
    'none',
    'yes',
    'none',
    'none',
  ],
  apply: [
    'own',
    'none',
    'none',
    'none',
    'none',
    'none',
    'none',
    'none',
    'none',
    'none',
  ],
  view_application: [
    'own',
    'org',
    'org',
    'assigned',
    'org',
    'reason',
    'none',
    'reason',
    'none',
    'none',
  ],
  download_application_cv: [
    'own',
    'org',
    'org',
    'org',
    'org',
    'reason',
    'none',
    'reason',
    'none',
    'none',
  ],
  change_application_status: [
    'own',
    'org',
    'org',
    'org',
    'none',
    'none',
    'none',
    'reason',
    'none',
    'none',
  ],
  reverse_rejection: [
    'none',
    'org',
    'org',
    'none',
    'none',
    'none',
    'none',
    'reason',
    'none',
    'none',
  ],
  internal_notes: [
    'none',
    'org',
    'org',
    'org',
    'org',
    'reason',
    'none',
    'reason',
    'none',
    'none',
  ],
  interview_offer: [
    'none',
    'org',
    'org',
    'org',
    'none',
    'none',
    'none',
    'none',
    'none',
    'none',
  ],
  confirm_hire: [
    'none',
    'org',
    'org',
    'org',
    'none',
    'none',
    'none',
    'reason',
    'none',
    'none',
  ],
  talent_search: [
    'none',
    'org',
    'org',
    'org',
    'none',
    'none',
    'none',
    'reason',
    'none',
    'none',
  ],
  talent_invite: [
    'none',
    'org',
    'org',
    'org',
    'none',
    'none',
    'none',
    'none',
    'none',
    'none',
  ],
  export_applications: [
    'none',
    'org',
    'org',
    'none',
    'none',
    'none',
    'none',
    'reason',
    'none',
    'none',
  ],
  manage_members: [
    'none',
    'org',
    'org',
    'none',
    'none',
    'none',
    'none',
    'reason',
    'none',
    'none',
  ],
  transfer_ownership: [
    'none',
    'org',
    'none',
    'none',
    'none',
    'none',
    'none',
    'reason',
    'none',
    'none',
  ],
  billing: [
    'none',
    'org',
    'org',
    'none',
    'none',
    'none',
    'none',
    'yes',
    'none',
    'none',
  ],
  view_verification_documents: [
    'own',
    'org',
    'org',
    'none',
    'none',
    'none',
    'yes',
    'reason',
    'none',
    'none',
  ],
  decide_verification: [
    'none',
    'none',
    'none',
    'none',
    'none',
    'none',
    'yes',
    'yes',
    'none',
    'none',
  ],
  // H3: a equipa da plataforma decide denúncias; não as abre.
  report: [
    'yes',
    'yes',
    'yes',
    'yes',
    'yes',
    'none',
    'none',
    'none',
    'none',
    'none',
  ],
  decide_report_suspend: [
    'none',
    'none',
    'none',
    'none',
    'none',
    'yes',
    'none',
    'yes',
    'none',
    'none',
  ],
  merge_organizations: [
    'none',
    'none',
    'none',
    'none',
    'none',
    'none',
    'none',
    'yes',
    'none',
    'none',
  ],
  view_audit: [
    'none',
    'org',
    'org',
    'none',
    'none',
    'none',
    'none',
    'yes',
    'none',
    'none',
  ],
  export_personal_data: [
    'own',
    'none',
    'none',
    'none',
    'none',
    'none',
    'none',
    'none',
    'none',
    'none',
  ],
  delete_account: [
    'own',
    'own',
    'own',
    'own',
    'own',
    'none',
    'none',
    'reason',
    'none',
    'none',
  ],
} as const satisfies Record<string, Row>;
export type PermissionAction = keyof typeof PERMISSION_MATRIX;
export interface PermissionActor {
  userId?: string;
  role: PermissionRole;
  active: boolean;
  organizationId?: string;
  membershipActive?: boolean;
  assignedJobIds?: readonly string[];
  recruiterCanViewAllJobs?: boolean;
  entitlements?: readonly string[];
  organizationContactVerified?: boolean;
  reason?: string;
}
export interface PermissionResource {
  ownerUserId?: string;
  candidateUserId?: string;
  organizationId?: string;
  jobId?: string;
  published?: boolean;
  requestedStatus?: string;
  requestedMemberRole?: 'OWNER' | 'ADMIN' | 'RECRUITER' | 'REVIEWER';
  soleOwnerWithActiveSubscription?: boolean;
}
const entitlementFor: Partial<Record<PermissionAction, string>> = {
  talent_search: 'TALENT_SEARCH',
  talent_invite: 'INVITES_MONTHLY',
  export_applications: 'EXPORT',
};

/** Pure policy. Actors and resources must be resolved on the server, never
 * constructed from role/orgId fields supplied by a browser. A reason rule also
 * requires a transactional AuditLog in the service before data is returned. */
export function can(
  actor: PermissionActor,
  action: PermissionAction,
  resource: PermissionResource = {},
): boolean {
  if (action === 'view_published_job') return resource.published === true;
  if (!actor.active || !actor.userId) return false;
  const index = PERMISSION_ROLES.indexOf(actor.role);
  const rule: AccessRule | undefined = PERMISSION_MATRIX[action]?.[index];
  if (!rule || rule === 'none') return false;
  const own = Boolean(
    (resource.ownerUserId || resource.candidateUserId) === actor.userId,
  );
  const org = Boolean(
    actor.membershipActive &&
    actor.organizationId &&
    actor.organizationId === resource.organizationId,
  );
  if (rule === 'own' && !own) return false;
  if (rule === 'org' && !org) return false;
  if (
    rule === 'assigned' &&
    (!org ||
      (!actor.recruiterCanViewAllJobs &&
        (!resource.jobId || !actor.assignedJobIds?.includes(resource.jobId))))
  )
    return false;
  if (rule === 'reason' && !actor.reason?.trim()) return false;
  if (
    action === 'change_application_status' &&
    actor.role === 'CANDIDATE' &&
    resource.requestedStatus !== 'WITHDRAWN'
  )
    return false;
  if (
    action === 'manage_members' &&
    actor.role === 'ORG_ADMIN' &&
    resource.requestedMemberRole === 'OWNER'
  )
    return false;
  if (action === 'delete_account' && resource.soleOwnerWithActiveSubscription)
    return false;
  if (actor.role !== 'ADMIN') {
    const entitlement = entitlementFor[action];
    if (entitlement && !actor.entitlements?.includes(entitlement)) return false;
    if (
      ['talent_search', 'talent_invite'].includes(action) &&
      !actor.organizationContactVerified
    )
      return false;
  }
  return true;
}
