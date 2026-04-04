export function formatMaybeDateTimePt(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('pt-PT');
}

export function isLikelyUrl(value) {
  const v = String(value || '').trim().toLowerCase();
  return v.startsWith('http://') || v.startsWith('https://');
}

export function getInterviewStatusLabelPt(status) {
  const s = String(status || 'scheduled').toLowerCase();
  if (s === 'confirmed') return 'Confirmada';
  if (s === 'reschedule_requested') return 'Reagendamento solicitado';
  return 'Agendada';
}

// Client-side helper: downloads an .ics file for the currently authenticated user.
export async function downloadInterviewICS(applicationId) {
  if (!applicationId) return;
  const { getAuth } = await import('firebase/auth');
  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Não autenticado');

  const res = await fetch(`/api/applications/${applicationId}/interview-ics`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Não foi possível gerar o calendário.');

  const ics = await res.text();
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `entrevista_${applicationId}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

