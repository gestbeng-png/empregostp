/** Invitation tokens must never enter automatically collected page URLs. */
export function mayCollectPageAnalytics(location) {
  if (!location || typeof location.pathname !== 'string') return false;
  if (location.pathname === '/equipa/convite') return false;
  const params = new URLSearchParams(location.search || '');
  return !Array.from(params.values()).some((value) =>
    value.includes('/equipa/convite'),
  );
}
