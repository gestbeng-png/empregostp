/**
 * Mensagem para o editor de vagas a partir da resposta de `POST /api/jobs`.
 * Aceita o formato antigo (texto em `error`/`reason`/`message`) e o formato
 * único D16 (`{ error: { code, message } }`) com os detalhes da v2:
 * títulos para dividir (F1.1) e o que falta para publicar (F1.2).
 */
export function describeJobSubmissionError(data, fallback) {
  const payload = data && typeof data === 'object' ? data : {};
  const base =
    (typeof payload.error === 'object' && payload.error
      ? payload.error.message
      : payload.error) ||
    payload.reason ||
    payload.message ||
    fallback;
  if (Array.isArray(payload.splitTitles) && payload.splitTitles.length > 1) {
    return `${base} Crie uma vaga para cada função: ${payload.splitTitles.join(' · ')}.`;
  }
  if (Array.isArray(payload.missing) && payload.missing.length) {
    return `${base} ${payload.missing
      .map((item) => item?.label)
      .filter(Boolean)
      .join('; ')}.`;
  }
  return String(base);
}

/** Na v2 a resposta traz `suggestions`; uma vaga em revisão mostra a mensagem
 * do servidor (F1.6: nunca os sinais), em vez de «criada com sucesso». */
export function describeJobSubmissionSuccess(data, defaultMessage) {
  const payload = data && typeof data === 'object' ? data : {};
  const isV2 = Array.isArray(payload.suggestions);
  const pending = payload.job?.status === 'pending_review';
  const main =
    isV2 && pending && payload.message ? payload.message : defaultMessage;
  const extra = [
    payload.warning,
    isV2 && payload.suggestions.length
      ? `Para a tornar mais completa: ${payload.suggestions.join('; ')}.`
      : '',
  ].filter(Boolean);
  return [main, ...extra].join(' ');
}
