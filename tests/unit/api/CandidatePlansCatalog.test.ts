import { admin } from '../../../lib/firebaseAdmin';
import handler from '../../../pages/api/candidate/plans';

jest.mock('../../../lib/firebaseAdmin', () => ({
  admin: { firestore: jest.fn() },
}));
jest.mock('../../../lib/apiUserAuth', () => ({
  requireActiveApiUser: jest.fn(async () => ({
    userData: { userType: 'candidato' },
  })),
}));
jest.mock('../../../lib/serverLog', () => ({ logServerError: jest.fn() }));

let overrides: Record<string, Record<string, unknown>>;

beforeEach(() => {
  jest.clearAllMocks();
  overrides = {};
  (admin.firestore as unknown as jest.Mock).mockReturnValue({
    collection: jest.fn(() => ({ doc: (id: string) => ({ id }) })),
    getAll: jest.fn(async (...refs: Array<{ id: string }>) =>
      refs.map(({ id }) => ({
        id,
        exists: Boolean(overrides[id]),
        data: () => overrides[id],
      })),
    ),
  });
});

async function getPlans() {
  const res = { status: jest.fn(), json: jest.fn(), setHeader: jest.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  await handler({ method: 'GET', headers: {} }, res);
  expect(res.status).toHaveBeenCalledWith(200);
  return res.json.mock.calls[0][0].plans as Array<{
    id: string;
    name: string;
    price: number;
    priceLabel: string;
    features: string[];
  }>;
}

test('Premium inclui verificação no catálogo de compra, sem plano de verificação separado', async () => {
  const plans = await getPlans();
  expect(plans.map((plan) => plan.id)).toEqual([
    'professional_candidato',
    'unlimited_candidato',
  ]);
  expect(plans[1]?.features).toContain('Verificação do perfil incluída');
});

test('preserva preço e benefícios do admin sem perder a verificação incluída', async () => {
  overrides.unlimited_candidato = {
    name: 'Premium personalizado',
    price: 275,
    priceLabel: '275 STN',
    features: ['Suporte personalizado'],
  };
  const plans = await getPlans();
  expect(plans.find((plan) => plan.id === 'unlimited_candidato')).toMatchObject(
    {
      name: 'Premium personalizado',
      price: 275,
      // O admin gravou "275 STN"; o catálogo mostra sempre STD.
      priceLabel: '275 STD',
      features: ['Verificação do perfil incluída', 'Suporte personalizado'],
    },
  );
  expect(plans[0]?.features).not.toContain('Verificação do perfil incluída');
  expect(overrides.unlimited_candidato.features).toEqual([
    'Suporte personalizado',
  ]);
});

test('não duplica a verificação e respeita planos desativados pelo admin', async () => {
  overrides.unlimited_candidato = {
    features: ['Suporte personalizado', 'Verificação incluída'],
  };
  const plans = await getPlans();
  expect(plans[1]?.features).toEqual([
    'Verificação incluída',
    'Suporte personalizado',
  ]);

  overrides.unlimited_candidato.isActive = false;
  expect((await getPlans()).map((plan) => plan.id)).toEqual([
    'professional_candidato',
  ]);
});
