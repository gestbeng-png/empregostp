/**
 * Abre um ficheiro pessoal do candidato através de um URL assinado de curta
 * duração. A janela é aberta no gesto do utilizador e só depois recebe o
 * endereço; abrir depois do `await` faria o bloqueador de popups travá-la.
 */
async function openCandidateFile({ endpoint, body, fallbackError }) {
  const popup = window.open('', '_blank', 'noopener,noreferrer');

  try {
    const authModule = await import('firebase/auth');
    const idToken = await authModule.getAuth().currentUser?.getIdToken();
    if (!idToken) {
      throw new Error('Sessão expirada');
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || fallbackError);
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
      error: error.message || fallbackError,
    };
  }
}

export function openCandidateCv(candidateId) {
  return openCandidateFile({
    endpoint: '/api/files/candidate-cv',
    body: { candidateId },
    fallbackError: 'Não foi possível abrir o CV.',
  });
}

export function openCandidateCertificate(candidateId, certificateIndex) {
  return openCandidateFile({
    endpoint: '/api/files/candidate-certificate',
    body: { candidateId, certificateIndex },
    fallbackError: 'Não foi possível abrir o certificado.',
  });
}
