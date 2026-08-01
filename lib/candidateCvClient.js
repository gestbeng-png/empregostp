/**
 * Abre o CV de um candidato através de um URL assinado de curta duração.
 *
 * A janela é aberta de forma síncrona, no gesto do utilizador, e só depois
 * recebe o endereço: abrir depois do `await` faria o bloqueador de popups
 * travar o download.
 */
export async function openCandidateCv(candidateId) {
  const popup = window.open('', '_blank', 'noopener,noreferrer');

  try {
    const authModule = await import('firebase/auth');
    const idToken = await authModule.getAuth().currentUser?.getIdToken();
    if (!idToken) {
      throw new Error('Sessão expirada');
    }

    const response = await fetch('/api/files/candidate-cv', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ candidateId }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'Não foi possível abrir o CV.');
    }

    if (popup) {
      popup.location.href = data.url;
    } else {
      // Popup bloqueado: navega na própria janela, para o utilizador não
      // ficar sem feedback nenhum.
      window.location.href = data.url;
    }

    return { success: true };
  } catch (error) {
    popup?.close();
    return {
      success: false,
      error: error.message || 'Não foi possível abrir o CV.',
    };
  }
}
