const ACCOUNT_TYPES = {
  candidato: 'candidato',
  candidate: 'candidato',
  empresa: 'empresa',
  company: 'empresa',
  employer: 'empresa',
  admin: 'admin',
};

export function getActionHref(href) {
  if (typeof href === 'string') return href;
  if (!href?.pathname) return '';
  const query = new URLSearchParams();
  Object.entries(href.query || {}).forEach(([key, value]) => {
    (Array.isArray(value) ? value : [value]).forEach((item) => {
      if (item != null) query.append(key, String(item));
    });
  });
  const search = query.toString();
  const hash = href.hash ? '#' + String(href.hash).replace(/^#/, '') : '';
  return href.pathname + (search ? '?' + search : '') + hash;
}

// Só classifica funcionalidades privadas. Páginas de apresentação, pesquisa,
// vagas públicas e perfis públicos não pertencem a um papel exclusivo.
export function getActionAccountType(href, depth = 0) {
  if (!href || depth > 1) return null;
  try {
    const base = 'https://empregostp.local';
    const url = new URL(typeof href === 'string' ? href : href.pathname, base);
    if (url.origin !== base) return null;
    if (typeof href === 'object' && href.query) {
      Object.entries(href.query).forEach(([key, value]) => {
        if (value != null)
          url.searchParams.set(
            key,
            String(Array.isArray(value) ? value[0] : value),
          );
      });
    }
    const path = url.pathname.replace(/\/+$/, '');
    const dashboard = path.match(
      /^\/dashboard\/(candidato|empresa|admin)(?:\/|$)/,
    );
    if (dashboard) return dashboard[1];
    if (path === '/premium/candidatos' || path === '/recursos/gerador-cv')
      return 'candidato';
    if (path === '/premium/empresa') return 'empresa';
    if (path === '/register' || path === '/login') {
      const typedRole = ACCOUNT_TYPES[url.searchParams.get('type')];
      if (typedRole) return typedRole;
      const destination =
        url.searchParams.get('redirect') || url.searchParams.get('returnTo');
      if (destination) return getActionAccountType(destination, depth + 1);
    }
  } catch {
    // Um URL desconhecido não prova uma permissão. Os destinos privados
    // continuam protegidos pelo servidor, independentemente destes atalhos.
  }
  return null;
}
