// Set-Cookie é aplicado quando cada resposta chega. Serializar POST/DELETE
// impede uma resposta antiga de restaurar o cookie depois de trocar de conta
// ou sair (incluindo pedidos iniciados pelo formulário de login).
let sessionQueue = Promise.resolve();

function enqueueSessionRequest(request) {
  const pending = sessionQueue.catch(() => undefined).then(request);
  sessionQueue = pending;
  return pending;
}

export function createServerSession(token) {
  return enqueueSessionRequest(() => postServerSession(token));
}

async function postServerSession(token) {
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

export function destroyServerSession(token = '') {
  return enqueueSessionRequest(() => deleteServerSession(token));
}

async function deleteServerSession(token) {
  const response = await fetch('/api/auth/session', {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    throw new Error('Não foi possível encerrar a sessão no servidor.');
  }
}
