// Adia trabalho que não é preciso para a primeira pintura (Analytics, sessão
// do Firebase nas páginas públicas) até a pessoa interagir com a página — ou,
// sem interação, até um momento de reserva.

const INTERACTION_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
const LISTENER_OPTIONS = { capture: true, passive: true };

/**
 * Corre `callback` uma única vez: na primeira interação ou quando `fallback`
 * disparar, o que acontecer primeiro.
 *
 * @param {() => void} callback
 * @param {(run: () => void) => () => void} fallback agenda `run` e devolve a
 *   função que cancela esse agendamento.
 * @returns {() => void} cancela tudo (útil na limpeza de um efeito).
 */
export function runOnFirstInteraction(callback, fallback) {
  let done = false;
  let cancelFallback = () => {};
  const cleanup = () => {
    cancelFallback();
    for (const type of INTERACTION_EVENTS) {
      window.removeEventListener(type, run, LISTENER_OPTIONS);
    }
  };
  function run() {
    if (done) return;
    done = true;
    cleanup();
    callback();
  }
  for (const type of INTERACTION_EVENTS) {
    window.addEventListener(type, run, LISTENER_OPTIONS);
  }
  cancelFallback = fallback(run);
  return () => {
    done = true;
    cleanup();
  };
}

/** Reserva: passado um tempo fixo. */
export const afterDelay = (ms) => (run) => {
  const id = window.setTimeout(run, ms);
  return () => window.clearTimeout(id);
};

/** Reserva: quando o browser fica livre (com prazo máximo). O Safari não tem
 * `requestIdleCallback`, por isso aí usa o prazo como atraso fixo. */
export const whenIdle = (timeoutMs) => (run) => {
  if (typeof window.requestIdleCallback !== 'function') {
    return afterDelay(timeoutMs)(run);
  }
  const id = window.requestIdleCallback(run, { timeout: timeoutMs });
  return () => window.cancelIdleCallback(id);
};
