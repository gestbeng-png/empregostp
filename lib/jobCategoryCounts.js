/**
 * Conta as vagas por categoria, da mais para a menos frequente.
 *
 * Usado pelo endpoint público `/api/jobs/categories` e pela home, que já lê as
 * vagas ativas no servidor e assim não precisa de pedir a mesma contagem ao
 * browser.
 *
 * @param {Array<Record<string, unknown>>} jobs dados das vagas
 * @returns {Array<{ name: string, count: number }>}
 */
export function countJobsByCategory(jobs) {
  const counts = {};
  for (const job of jobs) {
    const categoria = job.categoria || job.category || 'Outros';
    counts[categoria] = (counts[categoria] || 0) + 1;
  }
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([name, count]) => ({ name, count }));
}
