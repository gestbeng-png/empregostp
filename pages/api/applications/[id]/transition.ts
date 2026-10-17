import { createApplicationTransitionPolicy } from '@/application/applications/applicationTransitionPolicy';
import { TransitionEntity } from '@/application/marketplace/TransitionEntity';
import { getFeatureEnvironment } from '@/infrastructure/firebase/marketplace/environment';
import { FirestoreFeatureFlags } from '@/infrastructure/firebase/marketplace/FirestoreFeatureFlags';
import { FirestoreLifecycleStore } from '@/infrastructure/firebase/marketplace/FirestoreLifecycleStore';
import { requireActiveApiUser } from '@/lib/apiUserAuth';
import { admin } from '@/lib/firebaseAdmin';
import { createApplicationTransitionHandler } from '@/presentation/applications/createApplicationTransitionHandler';
import { recruitmentApi } from '@/presentation/applications/recruitmentApi';

const route = createApplicationTransitionHandler({
  authenticate: async (req, res) => {
    const result = await requireActiveApiUser(req, res, { adminApp: admin });
    return result ? { uid: result.uid } : null;
  },
  transition: async (input) => {
    const db = admin.firestore();
    const { reason, closedReason, candidateVisibleNote, ...rest } = input;
    const entity = new TransitionEntity(
      new FirestoreFeatureFlags(db),
      new FirestoreLifecycleStore(db),
      createApplicationTransitionPolicy(input.to),
    );
    // Rollout por organização: na conta de empresa legada o uid é a organização.
    return entity.execute(
      {
        kind: 'Application',
        entityId: rest.applicationId,
        to: rest.to,
        expectedVersion: rest.expectedVersion,
        actorUserId: rest.actorUserId,
        idempotencyKey: rest.idempotencyKey,
        ...(reason ? { reason } : {}),
        ...(closedReason ? { closedReason } : {}),
        ...(candidateVisibleNote ? { candidateVisibleNote } : {}),
      },
      {
        environment: getFeatureEnvironment(),
        organizationId: rest.actorUserId,
      },
    );
  },
});

export default recruitmentApi(route);
