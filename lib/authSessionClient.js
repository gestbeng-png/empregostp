export async function createServerSession(token) {
  const response = await fetch('/api/auth/session', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.ok) return;

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    // O código HTTP continua a ser suficiente para fechar a sessão.
  }

  const error = new Error(payload.error || 'Não foi possível criar a sessão.');
  error.code = payload.code || 'SESSION_CREATE_FAILED';
  error.status = response.status;
  throw error;
}

export async function destroyServerSession(token = '') {
  const response = await fetch('/api/auth/session', {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    throw new Error('Não foi possível encerrar a sessão no servidor.');
  }
}
