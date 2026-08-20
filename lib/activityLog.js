/**
 * Registo de atividade administrativa, numa só coleção.
 *
 * Existiam dois trilhos em paralelo: as operações administrativas escreviam em
 * `activities`, que é a coleção que o painel de auditoria lê, enquanto as
 * operações sobre candidaturas escreviam em `admin_activities`, que nada lia.
 * Em produção estavam 13 registos numa e 9 na outra — ou seja, o administrador
 * via pouco mais de metade do que tinha acontecido.
 *
 * Este helper garante o formato que `pages/api/admin/activities/index.js`
 * consulta: `type` para filtrar, `createdAt` em ISO para ordenar e filtrar por
 * intervalo, e `description` para a pesquisa textual.
 */
export const ACTIVITY_COLLECTION = 'activities';

export async function recordActivity(adminApp, { type, description, ...rest }) {
  if (!type) return null;

  try {
    return await adminApp
      .firestore()
      .collection(ACTIVITY_COLLECTION)
      .add({
        type,
        description: description || '',
        createdAt: new Date().toISOString(),
        ...rest,
      });
  } catch (error) {
    // O trilho de auditoria nunca deve derrubar a operação que o gerou.
    return null;
  }
}

export default recordActivity;
