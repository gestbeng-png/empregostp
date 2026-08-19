jest.mock('../../../lib/firebaseAdmin', () => ({ admin: {} }));

import {
  FIRESTORE_IN_QUERY_LIMIT,
  fetchSavedJobDetails,
} from '../../../pages/api/saved-jobs';

function createSavedDocs(ids: string[]) {
  return ids.map((jobId, index) => ({
    data: () => ({ jobId, savedAt: `saved-${index}` }),
  }));
}

function createAdminMock() {
  const requestedChunks: string[][] = [];
  const where = jest.fn((_field, _operator, ids: string[]) => {
    requestedChunks.push(ids);
    return {
      get: jest.fn().mockResolvedValue({
        // O Firestore não garante a ordem do resultado de `in`; inverter cada
        // bloco prova que a API recompõe a ordem dos favoritos.
        docs: [...ids].reverse().map((id) => ({
          id,
          data: () => ({ titulo: `Vaga ${id}` }),
        })),
      }),
    };
  });
  const firestore = jest.fn(() => ({
    collection: jest.fn((name: string) => {
      if (name !== 'jobs') throw new Error(`Coleção inesperada: ${name}`);
      return { where };
    }),
  })) as jest.Mock & { FieldPath: { documentId: jest.Mock } };
  firestore.FieldPath = { documentId: jest.fn(() => '__name__') };

  return { admin: { firestore }, requestedChunks };
}

describe('consulta de vagas guardadas em blocos Firestore', () => {
  test.each([31, 50, 95])(
    'suporta %i favoritos, preservando ordem e blocos <= 30',
    async (total) => {
      const ids = Array.from({ length: total }, (_, index) => `job-${index}`);
      const { admin, requestedChunks } = createAdminMock();

      const result = await fetchSavedJobDetails(
        admin,
        createSavedDocs(ids),
      );

      expect(requestedChunks).toHaveLength(
        Math.ceil(total / FIRESTORE_IN_QUERY_LIMIT),
      );
      expect(requestedChunks.every((items) => items.length <= 30)).toBe(true);
      expect(requestedChunks.flat()).toEqual(ids);
      expect(result.map((job) => job.id)).toEqual(ids);
      expect(result.map((job) => job.savedAt)).toEqual(
        ids.map((_, index) => `saved-${index}`),
      );
    },
  );

  test('elimina duplicados antigos e ignora referências órfãs', async () => {
    const { admin } = createAdminMock();
    const docs = createSavedDocs(['job-1', 'job-1', 'job-2']);
    const originalCollection = admin.firestore().collection;
    const where = originalCollection('jobs').where;
    where.mockImplementationOnce((
      _field: unknown,
      _operator: unknown,
      ids: string[],
    ) => ({
      get: jest.fn().mockResolvedValue({
        docs: ids
          .filter((id) => id !== 'job-2')
          .map((id) => ({ id, data: () => ({ titulo: id }) })),
      }),
    }));

    const result = await fetchSavedJobDetails(admin, docs);

    expect(result).toEqual([
      expect.objectContaining({ id: 'job-1', savedAt: 'saved-0' }),
    ]);
  });
});
