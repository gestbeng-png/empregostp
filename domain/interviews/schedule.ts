/**
 * E6 — entrevistas: validação, hora com fuso explícito, convite .ics e
 * lembretes. Puro; o servidor grava e despacha.
 */
export const INTERVIEW_TYPES = ['PRESENCIAL', 'TELEFONE', 'VIDEO'] as const;
export type InterviewType = (typeof INTERVIEW_TYPES)[number];
export const DEFAULT_TIMEZONE = 'Africa/Sao_Tome';
export const RESCHEDULE_WARNING_COUNT = 3;
const MIN_LEAD_MS = 60 * 60_000;
const MAX_AHEAD_MS = 180 * 86_400_000;
const MAX_MESSAGE = 1000;

export interface InterviewInput {
  type: InterviewType;
  startsAt: Date;
  durationMin: number;
  timezone: string;
  location: string | null;
  meetingUrl: string | null;
  interviewerUserIds: string[];
  candidateMessage: string | null;
}

export type InterviewValidation =
  | { ok: true; value: InterviewInput }
  | { ok: false; field: string; message: string };

function validTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('pt-PT', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function validateInterviewInput(
  raw: unknown,
  now: Date,
): InterviewValidation {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    unknown
  >;
  const fail = (field: string, message: string): InterviewValidation => ({
    ok: false,
    field,
    message,
  });
  const type = input.type as InterviewType;
  if (!(INTERVIEW_TYPES as readonly string[]).includes(type))
    return fail('type', 'Escolha o tipo de entrevista.');
  const startsAt = new Date(String(input.startsAt ?? ''));
  if (Number.isNaN(startsAt.getTime()))
    return fail('startsAt', 'Indique a data e a hora da entrevista.');
  if (startsAt.getTime() < now.getTime() + MIN_LEAD_MS)
    return fail(
      'startsAt',
      'Marque a entrevista com pelo menos 1 hora de antecedência.',
    );
  if (startsAt.getTime() > now.getTime() + MAX_AHEAD_MS)
    return fail(
      'startsAt',
      'A entrevista não pode ser marcada para daqui a mais de 6 meses.',
    );
  const durationMin = Number(input.durationMin ?? 30);
  if (!Number.isInteger(durationMin) || durationMin < 15 || durationMin > 240)
    return fail('durationMin', 'A duração deve ser entre 15 e 240 minutos.');
  const timezone =
    typeof input.timezone === 'string' && input.timezone
      ? input.timezone
      : DEFAULT_TIMEZONE;
  if (!validTimezone(timezone))
    return fail('timezone', 'Fuso horário inválido.');
  const location =
    typeof input.location === 'string'
      ? input.location.trim().slice(0, 300)
      : '';
  const meetingUrl =
    typeof input.meetingUrl === 'string' ? input.meetingUrl.trim() : '';
  if (type === 'PRESENCIAL' && !location)
    return fail('location', 'Indique o local da entrevista.');
  if (type === 'VIDEO' && !/^https:\/\/[^\s]+$/i.test(meetingUrl))
    return fail('meetingUrl', 'Indique a ligação da videochamada (https).');
  const candidateMessage =
    typeof input.candidateMessage === 'string'
      ? input.candidateMessage.trim()
      : '';
  if (candidateMessage.length > MAX_MESSAGE)
    return fail('candidateMessage', 'A mensagem é demasiado longa.');
  const interviewerUserIds = Array.isArray(input.interviewerUserIds)
    ? [
        ...new Set(
          input.interviewerUserIds.filter(
            (id): id is string =>
              typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id),
          ),
        ),
      ].slice(0, 10)
    : [];
  return {
    ok: true,
    value: {
      type,
      startsAt,
      durationMin,
      timezone,
      location: location || null,
      meetingUrl: meetingUrl || null,
      interviewerUserIds,
      candidateMessage: candidateMessage || null,
    },
  };
}

const MONTHS = [
  'jan.',
  'fev.',
  'mar.',
  'abr.',
  'mai.',
  'jun.',
  'jul.',
  'ago.',
  'set.',
  'out.',
  'nov.',
  'dez.',
];

const ZONE_LABELS: Readonly<Record<string, string>> = {
  'Africa/Sao_Tome': 'São Tomé',
  'Europe/Lisbon': 'Lisboa',
  'Africa/Luanda': 'Luanda',
  'Europe/Paris': 'Paris',
};

/** E6: «15 nov. 2026, 10:00 (hora de São Tomé, GMT+0)» no fuso do destinatário. */
export function formatInterviewTime(
  startsAt: Date,
  timezone: string = DEFAULT_TIMEZONE,
): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZoneName: 'shortOffset',
    })
      .formatToParts(startsAt)
      .map((part) => [part.type, part.value]),
  );
  const offset = String(parts.timeZoneName ?? 'GMT').replace(/^GMT$/, 'GMT+0');
  return `${parts.day} ${MONTHS[Number(parts.month) - 1]} ${parts.year}, ${parts.hour}:${parts.minute} (hora de ${ZONE_LABELS[timezone] ?? timezone}, ${offset})`;
}

function icsDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}
function icsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}
/** Dobra linhas a 75 octetos (RFC 5545 §3.1). */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest, 'utf8') > 75) {
    let cut = 75;
    while (Buffer.byteLength(rest.slice(0, cut), 'utf8') > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = ` ${rest.slice(cut)}`;
  }
  out.push(rest);
  return out.join('\r\n');
}

/** Convite .ics (E6). `sequence` sobe a cada reagendamento. */
export function buildInterviewIcs(input: {
  interviewId: string;
  title: string;
  organizationName: string;
  startsAt: Date;
  durationMin: number;
  location: string | null;
  meetingUrl: string | null;
  description: string | null;
  sequence: number;
  cancelled?: boolean;
  now: Date;
}): string {
  const end = new Date(input.startsAt.getTime() + input.durationMin * 60_000);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EmpregoSTP//Entrevistas//PT',
    'CALSCALE:GREGORIAN',
    `METHOD:${input.cancelled ? 'CANCEL' : 'REQUEST'}`,
    'BEGIN:VEVENT',
    `UID:${input.interviewId}@empregostp.com`,
    `SEQUENCE:${input.sequence}`,
    `DTSTAMP:${icsDate(input.now)}`,
    `DTSTART:${icsDate(input.startsAt)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(`Entrevista: ${input.title} — ${input.organizationName}`)}`,
    ...(input.location ? [`LOCATION:${icsText(input.location)}`] : []),
    ...(input.meetingUrl ? [`URL:${input.meetingUrl}`] : []),
    `DESCRIPTION:${icsText([input.description, input.meetingUrl].filter(Boolean).join('\n'))}`,
    `STATUS:${input.cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

export type ReminderWindow = '24H' | '2H';
const WINDOWS: readonly { window: ReminderWindow; beforeMs: number }[] = [
  { window: '24H', beforeMs: 24 * 3_600_000 },
  { window: '2H', beforeMs: 2 * 3_600_000 },
];

/**
 * Lembretes devidos: entrevistas ativas cuja janela (24 h ou 2 h antes) já
 * começou e que ainda não receberam esse lembrete. Idempotente pelo registo
 * `remindersSent`; uma entrevista criada a menos de 2 h só recebe o de 2 h.
 */
export function dueInterviewReminders(
  interviews: readonly {
    id: string;
    status: string;
    startsAt: Date;
    remindersSent: readonly string[];
  }[],
  now: Date,
): { interviewId: string; window: ReminderWindow }[] {
  const due: { interviewId: string; window: ReminderWindow }[] = [];
  for (const interview of interviews) {
    if (interview.status !== 'SCHEDULED' && interview.status !== 'CONFIRMED')
      continue;
    const untilStart = interview.startsAt.getTime() - now.getTime();
    if (untilStart <= 0) continue;
    const window = [...WINDOWS]
      .reverse()
      .find(
        (w) =>
          untilStart <= w.beforeMs &&
          !interview.remindersSent.includes(w.window),
      );
    if (window && !(window.window === '24H' && untilStart <= 2 * 3_600_000))
      due.push({ interviewId: interview.id, window: window.window });
  }
  return due;
}

export interface CandidateInterviewView {
  id: string;
  status: string;
  type: string;
  startsAt: string | null;
  when: string;
  durationMin: number;
  location: string | null;
  meetingUrl: string | null;
  candidateMessage: string | null;
}

/** Campos que o candidato pode ver (nunca notas internas nem entrevistadores). */
export function candidateInterviewView(
  interview: Readonly<Record<string, unknown>>,
  timezone?: string,
): CandidateInterviewView {
  const startsAt = new Date(
    String(
      (interview.startsAt as { toDate?: () => Date })?.toDate?.() ??
        interview.startsAt,
    ),
  );
  return {
    id: String(interview.id ?? ''),
    status: String(interview.v2Status ?? ''),
    type: String(interview.type ?? ''),
    startsAt: Number.isNaN(startsAt.getTime()) ? null : startsAt.toISOString(),
    when: Number.isNaN(startsAt.getTime())
      ? ''
      : formatInterviewTime(
          startsAt,
          timezone || String(interview.timezone || DEFAULT_TIMEZONE),
        ),
    durationMin: Number(interview.durationMin) || 0,
    location:
      typeof interview.location === 'string' ? interview.location : null,
    meetingUrl:
      typeof interview.meetingUrl === 'string' ? interview.meetingUrl : null,
    candidateMessage:
      typeof interview.candidateMessage === 'string'
        ? interview.candidateMessage
        : null,
  };
}
