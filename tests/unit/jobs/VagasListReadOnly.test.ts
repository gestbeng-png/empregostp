import { getServerSideProps } from '../../../pages/vagas';

const update = jest.fn();
const batch = jest.fn();

const PASSADO = '2020-01-01T00:00:00.000Z';
const FUTURO = '2099-12-31T23:59:59.000Z';

// Fixtures isoladas de teste: nenhum dado é escrito no Firebase ou no produto.
const docs = [
  {
    id: 'aberta',
    data: { titulo: 'Aberta', status: 'active', dataFecho: FUTURO },
  },
  {
    id: 'expirada',
    data: { titulo: 'Expirada', status: 'active', dataFecho: PASSADO },
  },
].map(({ id, data }) => ({ id, data: () => data, ref: { id, update } }));

jest.mock('next/router', () => ({ useRouter: () => ({ query: {} }) }));
jest.mock('../../../components/PublicPageShell', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../lib/firebaseAdmin', () => ({
  admin: {
    firestore: Object.assign(
      () => ({
        collection: () => ({
          orderBy: () => ({ get: async () => ({ docs }) }),
          doc: () => ({}),
        }),
        getAll: async () => [],
        batch,
      }),
      { FieldValue: { serverTimestamp: () => 'ts' } },
    ),
  },
}));

describe('/vagas: listagem só de leitura', () => {
  it('esconde a vaga expirada sem gravar nada no Firestore', async () => {
    const res = { setHeader: jest.fn(), statusCode: 200 };
    const result = (await getServerSideProps({ res } as never)) as {
      props: { initialJobs: Array<{ id: string }> };
    };

    expect(result.props.initialJobs.map((job) => job.id)).toEqual(['aberta']);
    expect(update).not.toHaveBeenCalled();
    expect(batch).not.toHaveBeenCalled();
  });
});
