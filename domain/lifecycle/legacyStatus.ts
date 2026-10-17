import type { ApplicationStatus } from '../applications/states';
import type { JobStatus } from '../jobs/states';
import { failure, success } from '../shared/Result';
import type { Result } from '../shared/Result';
import type { SubscriptionStatus } from '../subscriptions/states';

import type { EntityKind } from './states';

/**
 * MIG-01 — dual-write (D7) do estado legado.
 *
 * Enquanto a interface atual ler `status`, cada transição da v2 escreve
 * também o valor legado equivalente na mesma transação. `null` marca um
 * estado sem equivalente seguro: a transição é recusada em vez de gravar
 * algo que o código antigo leria mal. Os `Record<Estado, …>` obrigam o
 * TypeScript a cobrir todos os estados de cada máquina.
 *
 * Valores legados de referência: vagas — `lib/jobExpiration.js` (só `active`
 * é público) e `lib/jobModeration.js`; candidaturas — rótulos do painel do
 * candidato (pending, analysis, interview, approved, rejected, withdrawn);
 * subscrições — só `active` (a expiração antiga troca o plano, não o estado).
 */

const JOB: Readonly<Record<JobStatus, string | null>> = {
  DRAFT: 'draft',
  PENDING_REVIEW: 'pending_review',
  PUBLISHED: 'active',
  // `inactive` é a pausa histórica da empresa: some da listagem pública.
  PAUSED: 'inactive',
  CLOSED: 'closed',
  FILLED: 'closed',
  EXPIRED: 'closed',
  REJECTED: 'rejected',
  ARCHIVED: 'closed',
};

const APPLICATION: Readonly<Record<ApplicationStatus, string | null>> = {
  // Rascunhos não podem existir em `applications`: a empresa lê essa coleção
  // e veria a candidatura antes de o candidato a enviar.
  DRAFT: null,
  SUBMITTED: 'pending',
  UNDER_REVIEW: 'analysis',
  // O modelo antigo não tem pré-seleção; continua «Em análise».
  SHORTLISTED: 'analysis',
  INTERVIEW: 'interview',
  // `approved` é a decisão positiva final do modelo antigo («Aprovada»).
  OFFER: 'approved',
  HIRED: 'approved',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn',
  // Recusa da proposta parte do candidato: o equivalente é a retirada.
  OFFER_DECLINED: 'withdrawn',
};

const SUBSCRIPTION: Readonly<Record<SubscriptionStatus, string | null>> = {
  TRIAL: 'active',
  ACTIVE: 'active',
  // Período de tolerância e cancelamento no fim do período mantêm o acesso.
  PAST_DUE: 'active',
  CANCELLED: 'active',
  // A expiração antiga reverte para o plano básico (outro `planId`); não se
  // exprime só com o estado. Fica bloqueada até à migração das subscrições.
  EXPIRED: null,
};

/** Entidades que partilham a coleção com documentos lidos pelo código antigo. */
export const LEGACY_STATUS_MAPS: Readonly<
  Partial<Record<EntityKind, Readonly<Record<string, string | null>>>>
> = Object.freeze({
  Job: JOB,
  Application: APPLICATION,
  Subscription: SUBSCRIPTION,
});

/** Campos legados a escrever na mesma transação que `v2Status`. */
export function legacyStatusUpdate(
  kind: EntityKind,
  v2Status: string,
): Result<Readonly<Record<string, string>>> {
  const map = LEGACY_STATUS_MAPS[kind];
  if (!map) return success({});
  const legacy = Object.hasOwn(map, v2Status) ? map[v2Status] : undefined;
  if (typeof legacy !== 'string') return failure('LEGACY_STATUS_UNMAPPED');
  return success({ status: legacy });
}
