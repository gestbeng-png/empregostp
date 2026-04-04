import { admin as adminApp } from '../../../../lib/firebaseAdmin';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toICSDateUTC(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return (
    d.getUTCFullYear() +
    pad2(d.getUTCMonth() + 1) +
    pad2(d.getUTCDate()) +
    'T' +
    pad2(d.getUTCHours()) +
    pad2(d.getUTCMinutes()) +
    pad2(d.getUTCSeconds()) +
    'Z'
  );
}

function escapeICS(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

/**
 * GET /api/applications/:id/interview-ics
 * Candidate-only download of calendar invite for scheduled interview.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).setHeader('Allow', ['GET']).end('Method not allowed');
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).end('Unauthorized');
  }

  const token = authHeader.split('Bearer ')[1];
  const { id } = req.query;
  if (!id) {
    return res.status(400).end('Missing id');
  }

  let uid;
  try {
    const decoded = await adminApp.auth().verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return res.status(401).end('Unauthorized');
  }

  const userDoc = await adminApp.firestore().collection('users').doc(uid).get();
  if (!userDoc.exists || userDoc.data()?.userType !== 'candidato') {
    return res.status(403).end('Forbidden');
  }

  const appDoc = await adminApp.firestore().collection('applications').doc(id).get();
  if (!appDoc.exists) {
    return res.status(404).end('Not found');
  }
  const app = appDoc.data() || {};
  if (app.candidateId !== uid) {
    return res.status(403).end('Forbidden');
  }

  const interview = app.interviewDetails || null;
  const scheduledAt = interview?.scheduledAt;
  if (!scheduledAt) {
    return res.status(400).end('No interview scheduled');
  }

  const dtStart = toICSDateUTC(scheduledAt);
  if (!dtStart) {
    return res.status(400).end('Invalid interview date');
  }
  // Default duration: 60 minutes
  const end = new Date(new Date(scheduledAt).getTime() + 60 * 60 * 1000).toISOString();
  const dtEnd = toICSDateUTC(end);

  const title = `Entrevista - ${app.jobTitle || 'Vaga'}`;
  const mode = String(interview.mode || 'online');
  const where = mode === 'presencial' ? (interview.location || '') : (interview.link || '');
  const descriptionParts = [
    `Empresa: ${app.company || ''}`.trim(),
    mode === 'presencial' ? `Local: ${interview.location || 'A confirmar'}` : `Link: ${interview.link || 'A confirmar'}`,
    interview.notes ? `Observações: ${interview.notes}` : '',
  ].filter(Boolean);

  const uidLine = `${id}@empregostp.local`;
  const now = toICSDateUTC(new Date().toISOString());

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EmpregoSTP//Interview//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeICS(uidLine)}`,
    `DTSTAMP:${escapeICS(now)}`,
    `DTSTART:${escapeICS(dtStart)}`,
    `DTEND:${escapeICS(dtEnd)}`,
    `SUMMARY:${escapeICS(title)}`,
    where ? `LOCATION:${escapeICS(where)}` : '',
    `DESCRIPTION:${escapeICS(descriptionParts.join('\\n'))}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="entrevista_${id}.ics"`);
  return res.status(200).send(ics);
}

