/**
 * R24/R25/R88 — atribuição de candidaturas a uma pessoa da equipa. Puro.
 *
 * - «Esta candidatura é responsabilidade de João.» Uma candidatura tem no
 *   máximo um responsável pela análise; pode ficar sem ninguém (fila comum).
 * - Só candidaturas em curso se atribuem: as terminadas são histórico.
 * - Em lote, até 100 de cada vez, todas da mesma organização; ou todas
 *   passam ou nenhuma (sem atribuições a meio).
 * - A carga por pessoa é uma ferramenta operacional, nunca um ranking (R25,
 *   R82): devolve-se por ordem alfabética do nome, não por volume.
 */
import { failure, success } from '../shared/Result';
import type { Result } from '../shared/Result';

export const MAX_BULK_ASSIGNMENT = 100;
export const ASSIGNABLE_STATUSES: ReadonlySet<string> = new Set([
  'SUBMITTED',
  'UNDER_REVIEW',
  'SHORTLISTED',
  'INTERVIEW',
  'OFFER',
]);
const TO_REVIEW: ReadonlySet<string> = new Set([
  'SUBMITTED',
  'UNDER_REVIEW',
  'SHORTLISTED',
]);

const validId = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 256 &&
  !value.includes('/');

export interface AssignmentRequest {
  organizationId: string;
  applicationIds: string[];
  /** null = devolver à fila comum. */
  assigneeUserId: string | null;
}

export function parseAssignmentRequest(input: {
  organizationId?: unknown;
  applicationIds?: unknown;
  assigneeUserId?: unknown;
}): Result<AssignmentRequest> {
  if (!validId(input.organizationId)) return failure('INVALID_INPUT');
  const ids = input.applicationIds;
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.length > MAX_BULK_ASSIGNMENT ||
    !ids.every(validId)
  )
    return failure(
      'INVALID_INPUT',
      `Escolha entre 1 e ${MAX_BULK_ASSIGNMENT} candidaturas.`,
    );
  if (new Set(ids).size !== ids.length) return failure('INVALID_INPUT');
  const assignee =
    input.assigneeUserId === null ||
    input.assigneeUserId === undefined ||
    input.assigneeUserId === ''
      ? null
      : input.assigneeUserId;
  if (assignee !== null && !validId(assignee)) return failure('INVALID_INPUT');
  return success({
    organizationId: input.organizationId,
    applicationIds: [...ids],
    assigneeUserId: assignee,
  });
}

export const isAssignable = (status: string): boolean =>
  ASSIGNABLE_STATUSES.has(status);

export interface WorkloadRow {
  userId: string;
  name: string;
  /** Atribuídas e ainda por analisar (recebidas, em análise, pré-seleção). */
  toReview: number;
  /** Atribuídas e em curso (inclui entrevista e proposta). */
  open: number;
}

/** R25: carga por pessoa + fila sem responsável. Só candidaturas em curso. */
export function buildWorkload(
  applications: readonly { status: string; assigneeUserId: string | null }[],
  people: readonly { userId: string; name: string }[],
): { rows: WorkloadRow[]; unassignedToReview: number } {
  const rows = new Map(
    people.map((person) => [
      person.userId,
      { userId: person.userId, name: person.name, toReview: 0, open: 0 },
    ]),
  );
  let unassignedToReview = 0;
  for (const app of applications) {
    if (!isAssignable(app.status)) continue;
    const row = app.assigneeUserId ? rows.get(app.assigneeUserId) : undefined;
    if (!row) {
      if (TO_REVIEW.has(app.status)) unassignedToReview += 1;
      continue;
    }
    row.open += 1;
    if (TO_REVIEW.has(app.status)) row.toReview += 1;
  }
  return {
    rows: [...rows.values()]
      .filter((row) => row.open > 0)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-PT')),
    unassignedToReview,
  };
}
