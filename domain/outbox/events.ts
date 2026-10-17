export const EVENT_FIELDS = Object.freeze({
  entity_status_changed: ['entityId', 'entityKind', 'version'],
  consent_recorded: ['consentId', 'userId'],
  terms_accepted: ['acceptanceId', 'userId'],
  // Fase 3 — lembretes e pedidos agendados (só ids; o dispatcher lê o resto).
  interview_reminder: ['interviewId', 'window'],
  employer_silence_reminder: ['jobId', 'stage'],
  hire_confirmation_request: ['hireId', 'stage'],
  // R94 — equipa: avisos in-app só a quem recebe a responsabilidade.
  application_assigned: ['applicationId', 'assigneeUserId'],
  hiring_team_assigned: ['jobId', 'userId'],
} as const);
export type EventType = keyof typeof EVENT_FIELDS;
export function validEventPayload(
  type: string,
  payload: unknown,
): payload is Readonly<Record<string, string | number>> {
  if (
    !Object.hasOwn(EVENT_FIELDS, type) ||
    !payload ||
    typeof payload !== 'object' ||
    Array.isArray(payload)
  )
    return false;
  const fields: readonly string[] = EVENT_FIELDS[type as EventType];
  const data = payload as Record<string, unknown>;
  return (
    Object.keys(data).length === fields.length &&
    fields.every(
      (field) =>
        Object.hasOwn(data, field) &&
        (field === 'version'
          ? Number.isSafeInteger(data[field]) && (data[field] as number) > 0
          : typeof data[field] === 'string' &&
            data[field].length > 0 &&
            data[field].length <= 512 &&
            !data[field].includes('/')),
    )
  );
}
