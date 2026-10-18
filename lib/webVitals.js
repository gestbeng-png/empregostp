import { mayCollectPageAnalytics } from './analyticsPrivacy';

/**
 * Filtro das medições Web Vitals enviadas ao Speed Insights da Vercel.
 *
 * Mesmas regras do Analytics: nada da página de convite e nunca a query
 * string ou o fragmento, que podem levar tokens ou emails.
 *
 * @template {{ url: string }} T
 * @param {T} event
 * @returns {T | null}
 */
export function beforeSendVitals(event) {
  const url = new URL(event.url);
  if (!mayCollectPageAnalytics(url)) return null;
  url.search = '';
  url.hash = '';
  return { ...event, url: url.toString() };
}
