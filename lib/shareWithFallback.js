/**
 * Tenta a partilha nativa e, se o browser não a suportar ou ela falhar,
 * copia a mensagem para o clipboard. O cancelamento explícito do utilizador
 * não é uma falha e não deve provocar uma cópia inesperada.
 */
export async function shareWithClipboardFallback({
  title,
  text,
  url,
  navigatorApi = globalThis.navigator,
}) {
  if (!url || !navigatorApi) {
    return { status: 'failed', nativeFailed: false };
  }

  let nativeFailed = false;
  if (typeof navigatorApi.share === 'function') {
    try {
      await navigatorApi.share({ title, text, url });
      return { status: 'shared', nativeFailed: false };
    } catch (error) {
      if (error?.name === 'AbortError') {
        return { status: 'cancelled', nativeFailed: false };
      }
      nativeFailed = true;
    }
  }

  if (typeof navigatorApi.clipboard?.writeText === 'function') {
    try {
      await navigatorApi.clipboard.writeText(`${text} ${url}`.trim());
      return { status: 'copied', nativeFailed };
    } catch (error) {
      return { status: 'failed', nativeFailed };
    }
  }

  return { status: 'failed', nativeFailed };
}
