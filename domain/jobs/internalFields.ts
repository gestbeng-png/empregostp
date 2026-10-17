/**
 * SEC-04 — campos da vaga que nunca podem viver em `jobs/{jobId}`.
 *
 * O documento da vaga é servido a candidatos e visitantes (SSR, APIs) e as
 * regras do Firestore não conseguem esconder campos individuais. Tudo o que é
 * operacional ou sensível vai para `jobInternals/{jobId}`: só o Admin SDK lá
 * chega, e a coleção não tem nenhuma regra `allow`.
 */
export const JOB_INTERNALS_COLLECTION = 'jobInternals';

export const JOB_INTERNAL_FIELDS = [
  // Confiança e moderação (F1.6, E3): revelar os sinais ensina a contorná-los.
  'riskScore',
  'riskSignals',
  'moderationNotes',
  'moderationDecisionReason',
  'duplicateOfJobId',
  // Qualidade (F1.4): checklist só para o empregador e a moderação.
  'qualityScore',
  'qualityBreakdown',
  // Agências (B8): o cliente pode ser confidencial; a versão pública é só o
  // rótulo calculado no momento de publicar.
  'onBehalfOfClient',
] as const;

export type JobInternalField = (typeof JOB_INTERNAL_FIELDS)[number];

const INTERNAL = new Set<string>(JOB_INTERNAL_FIELDS);

export function isJobInternalField(field: string): field is JobInternalField {
  return INTERNAL.has(field);
}

/** Separa uma escrita de vaga em parte pública e parte interna. */
export function splitJobWrite(data: Readonly<Record<string, unknown>>): {
  publicFields: Record<string, unknown>;
  internalFields: Partial<Record<JobInternalField, unknown>>;
} {
  const publicFields: Record<string, unknown> = {};
  const internalFields: Partial<Record<JobInternalField, unknown>> = {};
  for (const [field, value] of Object.entries(data)) {
    if (isJobInternalField(field)) internalFields[field] = value;
    else publicFields[field] = value;
  }
  return { publicFields, internalFields };
}

/** Campos internos presentes num payload destinado ao documento público. */
export function internalFieldsIn(
  data: Readonly<Record<string, unknown>>,
): JobInternalField[] {
  return Object.keys(data).filter(isJobInternalField);
}
