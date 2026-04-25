function tryParseJson(value) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function collectMessages(value, bucket) {
  if (!value) return;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) bucket.push(trimmed);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectMessages(item, bucket));
    return;
  }

  if (typeof value === "object") {
    if (typeof value.message === "string" && value.message.trim()) {
      bucket.push(value.message.trim());
    }

    if (value.error) {
      collectMessages(value.error, bucket);
    }

    if (value.errors) {
      collectMessages(value.errors, bucket);
    }
  }
}

export function extractFirebaseStorageServerMessage(error) {
  const messages = [];

  const serverResponse =
    error?.serverResponse ||
    error?.customData?.serverResponse ||
    error?.response?.data ||
    error?.error;

  const parsed =
    tryParseJson(serverResponse) ||
    (typeof serverResponse === "object" ? serverResponse : null);

  collectMessages(parsed, messages);
  collectMessages(serverResponse, messages);
  collectMessages(error?.message, messages);

  return [...new Set(messages)].find(Boolean) || "";
}

export function isFirebaseStorageBillingDisabledError(error) {
  const normalized = extractFirebaseStorageServerMessage(error).toLowerCase();

  return (
    normalized.includes("billing account") &&
    (normalized.includes("disabled") || normalized.includes("state closed"))
  );
}

export function getFirebaseStorageErrorMessage(
  error,
  fallback = "Erro ao enviar ficheiro.",
) {
  if (!error) return fallback;

  if (isFirebaseStorageBillingDisabledError(error)) {
    return "O Firebase Storage esta indisponivel porque a conta de faturacao do projeto esta desativada. Reative a faturacao no Firebase ou Google Cloud para voltar a enviar ficheiros.";
  }

  if (error?.code === "storage/unauthenticated") {
    return "Sessao expirada. Faca login novamente e tente de novo.";
  }

  if (error?.code === "storage/unauthorized") {
    return "Sem permissao para enviar ficheiros para este caminho no Firebase Storage.";
  }

  if (error?.code === "storage/quota-exceeded") {
    return "O limite do Firebase Storage foi excedido. Verifique o plano e a faturacao do projeto.";
  }

  if (error?.code === "storage/canceled") {
    return "Upload cancelado.";
  }

  const serverMessage = extractFirebaseStorageServerMessage(error);
  if (serverMessage) return serverMessage;

  return error?.message || fallback;
}
