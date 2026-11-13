import { getAuth } from 'firebase/auth';

import { submitCompetencyVerification } from '../../../lib/candidateVerificationClient';

jest.mock('firebase/auth', () => ({ getAuth: jest.fn() }));

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  jest.clearAllMocks();
});

test('envia todos os links com as suas descrições para a API autenticada', async () => {
  const links = [
    { url: 'https://example.com/projeto', description: 'Projeto de gestão.' },
    { url: 'https://example.com/artigo', description: 'Artigo técnico.' },
  ];
  (getAuth as jest.Mock).mockReturnValue({
    currentUser: {
      uid: 'candidate-1',
      getIdToken: jest.fn().mockResolvedValue('test-token'),
    },
  });
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ verification: { status: 'pending' } }),
  });
  await expect(
    submitCompetencyVerification({
      email: 'candidate@example.com',
      phone: '9900000',
      links,
      skills: 'Desenvolvimento web',
      experience: 'Experiência profissional',
    }),
  ).resolves.toEqual({ status: 'pending' });
  expect(global.fetch).toHaveBeenCalledWith(
    '/api/verifications',
    expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
    }),
  );
  const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
  expect(body.documents.supportingLinks).toEqual(links);
  expect(body.verificationMethod).toBe('competencies');
});

test('uma sessão expirada não envia o pedido', async () => {
  (getAuth as jest.Mock).mockReturnValue({ currentUser: null });
  global.fetch = jest.fn();
  await expect(submitCompetencyVerification({ links: [] })).rejects.toThrow(
    'A sessão expirou',
  );
  expect(global.fetch).not.toHaveBeenCalled();
});
