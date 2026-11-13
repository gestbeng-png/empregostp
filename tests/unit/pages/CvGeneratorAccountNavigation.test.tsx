import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import CvGenerator from '../../../pages/recursos/gerador-cv';

const mockUser = {
  uid: 'synthetic-account',
  getIdToken: async () => 'synthetic-token',
};
jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, loading: false }),
}));
jest.mock('../../../lib/firebaseAdmin', () => ({ admin: {} }));
jest.mock('../../../components/PublicPageShell', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
jest.mock('../../../hooks/useAutoDraft', () => ({
  __esModule: true,
  default: () => ({
    isOnline: true,
    lastSavedAt: '',
    status: 'idle',
    saveNow: jest.fn(),
  }),
}));

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

test.each(['empresa', 'admin'])(
  'o aviso do gerador para %s oferece o próprio painel, não o painel de candidato',
  async (userType) => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ profile: { data: { userType } } }),
      });
    render(<CvGenerator />);
    expect(
      await screen.findByRole('heading', {
        name: 'Recurso exclusivo para candidatos',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Ir para o meu painel' }),
    ).toHaveAttribute('href', '/dashboard');
    expect(
      screen.queryByRole('link', { name: 'Ir para o painel do candidato' }),
    ).not.toBeInTheDocument();
  },
);
