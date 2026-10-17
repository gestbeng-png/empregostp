import { useEffect } from 'react';

/**
 * Revela os blocos marcados com `data-reveal` quando entram no ecrã,
 * escrevendo `data-visible="true"` neles. Só liga a animação (marca
 * `data-motion="on"` na raiz) depois de confirmar que pode animar, por isso
 * sem JS ou com movimento reduzido a página aparece completa e estática.
 * Cada página decide no seu CSS como os blocos entram.
 *
 * `deps` volta a procurar blocos novos (ex.: a lista de vagas mudou com um
 * filtro); os que já se revelaram não voltam a esconder-se.
 */
export default function useScrollReveal(rootRef, deps = []) {
  useEffect(() => {
    const root = rootRef.current;
    if (
      !root ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !('IntersectionObserver' in window)
    )
      return undefined;

    root.dataset.motion = 'on';
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.dataset.visible = 'true';
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -6% 0px' },
    );
    root
      .querySelectorAll('[data-reveal]:not([data-visible])')
      .forEach((element) => observer.observe(element));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootRef, ...deps]);
}
