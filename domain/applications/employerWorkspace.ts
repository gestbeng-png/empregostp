/**
 * F3.1/F3.5 — vista da empresa sobre uma candidatura e dados internos.
 *
 * A empresa vê sempre o snapshot (F2.4), nunca o perfil atual; notas,
 * avaliações e etiquetas são internas (vivem em `applicationInternals`, que o
 * candidato nunca lê). Puro: o servidor fornece os documentos.
 */
import type { ApplicationStatus } from './states';

export const MAX_NOTE_LENGTH = 2000;
export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 30;

type Plain = Readonly<Record<string, unknown>>;

export interface EmployerApplicationView {
  applicationId: string;
  jobId: string;
  status: ApplicationStatus;
  version: number;
  submittedAt: string | null;
  firstViewedAt: string | null;
  candidate: Plain;
  cv: { available: boolean };
  job: Plain;
  answers: unknown[];
  coverLetter: string;
  hardRequirementsNotMet: string[];
  knockoutFailed: boolean;
  source: string;
  history: {
    from: string | null;
    to: string;
    at: string | null;
    actorType: string;
    closedReason: string | null;
    reason: string | null;
  }[];
  internals: {
    tags: string[];
    ratings: { userId: string; rating: number }[];
    averageRating: number | null;
  };
  notes: {
    id: string;
    authorId: string;
    body: string;
    mentions: string[];
    createdAt: string | null;
  }[];
  previousApplications: {
    jobTitle: string;
    outcome: string;
    date: string | null;
  }[];
}

function iso(value: unknown): string | null {
  if (value && typeof value === 'object' && 'toDate' in value) {
    const date = (value as { toDate: () => unknown }).toDate();
    return date instanceof Date ? date.toISOString() : null;
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return null;
}
const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];

export function buildEmployerApplicationView(input: {
  applicationId: string;
  application: Plain;
  history: readonly Plain[];
  internals: Plain | null;
  notes: readonly (Plain & { id: string })[];
  previousApplications: readonly Plain[];
}): EmployerApplicationView {
  const app = input.application;
  const ratings = Object.entries(
    (input.internals?.ratings as Record<string, unknown>) ?? {},
  )
    .filter(
      ([, value]) => typeof value === 'number' && value >= 1 && value <= 5,
    )
    .map(([userId, rating]) => ({ userId, rating: rating as number }));
  return {
    applicationId: input.applicationId,
    jobId: String(app.jobId ?? ''),
    status: String(app.v2Status) as ApplicationStatus,
    version: Number.isSafeInteger(app.version) ? (app.version as number) : 0,
    submittedAt: iso(app.submittedAt),
    firstViewedAt: iso(app.firstViewedAt),
    candidate: (app.candidateSnapshot as Plain) ?? {},
    // O ficheiro só se obtém por rota com can() + URL assinada + AuditLog.
    cv: {
      available:
        typeof app.cvSnapshotKey === 'string' && app.cvSnapshotKey.length > 0,
    },
    job: (app.jobSnapshot as Plain) ?? {},
    answers: Array.isArray(app.answersSnapshot) ? app.answersSnapshot : [],
    coverLetter: typeof app.coverLetter === 'string' ? app.coverLetter : '',
    hardRequirementsNotMet: strings(app.hardRequirementsNotMet),
    knockoutFailed: app.knockoutFailed === true,
    source: typeof app.source === 'string' ? app.source : 'direct',
    history: [...input.history]
      .map((item) => ({
        from: typeof item.from === 'string' ? item.from : null,
        to: String(item.to),
        at: iso(item.at),
        actorType: String(item.actorType ?? ''),
        closedReason:
          typeof item.closedReason === 'string' ? item.closedReason : null,
        reason: typeof item.reason === 'string' ? item.reason : null,
      }))
      .sort((a, b) => String(a.at).localeCompare(String(b.at))),
    internals: {
      tags: strings(input.internals?.tags),
      ratings,
      averageRating: ratings.length
        ? Math.round(
            (ratings.reduce((sum, item) => sum + item.rating, 0) /
              ratings.length) *
              10,
          ) / 10
        : null,
    },
    notes: input.notes
      .map((note) => ({
        id: note.id,
        authorId: String(note.authorId ?? ''),
        body: String(note.body ?? ''),
        mentions: strings(note.mentions),
        createdAt: iso(note.createdAt),
      }))
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))),
    // F2.7: só candidaturas anteriores do mesmo candidato à mesma organização.
    previousApplications: input.previousApplications.map((item) => ({
      jobTitle: String(
        (item.jobSnapshot as Plain | undefined)?.titulo ?? item.jobTitle ?? '',
      ),
      outcome: String(item.v2Status ?? item.status ?? ''),
      date: iso(item.submittedAt ?? item.appliedAt ?? item.createdAt),
    })),
  };
}

/** Nota interna: texto aparado e menções `@[uid]` (F3.5). */
export function parseInternalNote(
  body: unknown,
  memberIds: readonly string[],
): { ok: true; body: string; mentions: string[] } | { ok: false } {
  if (typeof body !== 'string') return { ok: false };
  const text = body.trim();
  if (!text || text.length > MAX_NOTE_LENGTH) return { ok: false };
  const members = new Set(memberIds);
  const mentions = [...text.matchAll(/@\[([A-Za-z0-9_-]{1,128})\]/g)]
    .map((match) => match[1] as string)
    .filter((id) => members.has(id));
  return { ok: true, body: text, mentions: [...new Set(mentions)] };
}

/** Etiquetas internas normalizadas (minúsculas, sem duplicados, limites). */
export function normalizeTags(tags: unknown): string[] | null {
  if (!Array.isArray(tags)) return null;
  const clean = [
    ...new Set(
      tags
        .filter((tag): tag is string => typeof tag === 'string')
        .map((tag) => tag.trim().toLowerCase().replace(/\s+/g, ' '))
        .filter((tag) => tag.length >= 1 && tag.length <= MAX_TAG_LENGTH),
    ),
  ];
  return clean.length <= MAX_TAGS ? clean : null;
}

export function isValidRating(rating: unknown): rating is 1 | 2 | 3 | 4 | 5 {
  return (
    Number.isInteger(rating) &&
    (rating as number) >= 1 &&
    (rating as number) <= 5
  );
}
