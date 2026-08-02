import { getCareerAdvice } from '../../../lib/geminiService';

describe('cliente de recomendações de carreira', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('envia o token da sessão para a API protegida', async () => {
    const fetchMock = jest.mocked(global.fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        tips: [
          {
            id: '1',
            title: 'Recomendação',
            description: 'Ação concreta',
            icon: '💡',
          },
        ],
      }),
    } as Response);

    await getCareerAdvice('Engenharia mecânica', 'token-candidato');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/career-advice',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-candidato',
        }),
      }),
    );
  });

  test('não faz pedidos sem uma descrição profissional', async () => {
    const fetchMock = jest.mocked(global.fetch);

    const tips = await getCareerAdvice('', 'token-candidato');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(tips.length).toBeGreaterThan(0);
  });
});
