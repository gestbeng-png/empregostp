export function resolveDashboardTab(
  queryTab,
  validTabIds,
  defaultTab = 'dashboard',
) {
  const rawTab = Array.isArray(queryTab) ? queryTab[0] : queryTab;
  const normalizedTab =
    typeof rawTab === 'string' ? rawTab.trim().toLowerCase() : '';

  return validTabIds.has(normalizedTab) ? normalizedTab : defaultTab;
}
