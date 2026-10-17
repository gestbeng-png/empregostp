import type { Firestore } from 'firebase-admin/firestore';

import type { MemberRole } from '@/domain/memberships/teamRules';

/** Project only a display name for organizations already authorized by membership. */
export async function organizationLabels(
  db: Firestore,
  memberships: { organizationId: string; role: MemberRole }[],
): Promise<{ organizationId: string; role: MemberRole; name: string }[]> {
  return Promise.all(
    memberships.map(async (membership) => {
      const [organization, legacy] = await Promise.all([
        db.collection('organizations').doc(membership.organizationId).get(),
        db.collection('users').doc(membership.organizationId).get(),
      ]);
      const org = organization.data();
      const owner = legacy.data();
      return {
        ...membership,
        name: String(
          org?.name ||
            org?.legalName ||
            owner?.companyName ||
            owner?.name ||
            'Organização',
        ),
      };
    }),
  );
}
