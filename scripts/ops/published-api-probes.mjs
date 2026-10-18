// Sondas às APIs publicadas: cada rota deve responder o estado esperado sem
// sessão (401/405), o que prova que a versão em produção tem o código certo.
export const PRODUCTION_PROBES = Object.freeze([
  ['/api/workspace', 401],
  ['/api/me/organizations', 401],
  ['/api/admin/recruitment', 401],
  ['/api/applications/probe/cv', 401],
  ['/api/interviews/probe/ics', 401],
  ['/api/invitations/probe/accept', 405],
]);

export async function verifyPublishedApis(fetcher = fetch) {
  for (const [path, status] of PRODUCTION_PROBES) {
    const response = await fetcher(`https://empregostp.com${path}`, {
      method: 'GET',
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    });
    if (response.status !== status)
      throw new Error('PRODUCTION_CODE_NOT_READY');
  }
}
