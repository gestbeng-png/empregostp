import type { FeatureContext, FeatureKey } from '@/domain/feature-flags/flags';
import type {
  EntityKind,
  TransitionActor,
  TransitionContext,
} from '@/domain/lifecycle/states';
import type {
  PermissionActor,
  PermissionResource,
} from '@/domain/permissions/can';
import type { Result } from '@/domain/shared/Result';

export interface FeatureFlagReader {
  enabled(key: FeatureKey, context: FeatureContext): Promise<boolean>;
}
export interface LifecycleRecord extends PermissionResource {
  id: string;
  kind: EntityKind;
  v2Status: string;
  version: number;
  facts: Readonly<Record<string, unknown>>;
}
export interface TransitionCommand {
  kind: EntityKind;
  entityId: string;
  to: string;
  expectedVersion: number;
  actorUserId: string;
  idempotencyKey: string;
  reason?: string;
  /** Só candidaturas (E4): motivo de fecho e nota visível ao candidato. */
  closedReason?: string;
  candidateVisibleNote?: string;
}
export interface TransitionReceipt {
  entityId: string;
  status: string;
  version: number;
  eventId: string;
}
export interface ResolvedIdentity {
  permission: PermissionActor;
  transition: TransitionActor;
}
export type TransitionPolicy = (
  record: LifecycleRecord,
  actor: ResolvedIdentity,
) => Promise<Result<TransitionContext>>;
export interface LifecycleStore {
  transition(
    command: TransitionCommand,
    policy: TransitionPolicy,
  ): Promise<Result<TransitionReceipt>>;
}
/** LIF-01: transitions owned by the platform (cron expiry, first view…).
 * Server-only: callers are authenticated jobs (CRON_SECRET), never an HTTP
 * request on behalf of a user. The actor is the job name, not a user id. */
export interface SystemTransitionCommand extends Omit<
  TransitionCommand,
  'actorUserId'
> {
  systemJob: string;
}
export interface SystemLifecycleStore {
  transitionAsSystem(
    command: SystemTransitionCommand,
    policy: TransitionPolicy,
  ): Promise<Result<TransitionReceipt>>;
}
