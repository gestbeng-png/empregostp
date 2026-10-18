import type { Result } from '@/domain/shared/Result';

import type {
  LifecycleStore,
  TransitionCommand,
  TransitionPolicy,
  TransitionReceipt,
} from './ports';

/** Aplica uma transição de estado com a política (factos e autorização) do
 * caso de uso; a validação acontece no servidor, nunca no browser. */
export class TransitionEntity {
  constructor(
    private readonly store: LifecycleStore,
    private readonly policy: TransitionPolicy,
  ) {}

  async execute(
    command: TransitionCommand,
  ): Promise<Result<TransitionReceipt>> {
    return this.store.transition(command, this.policy);
  }
}
