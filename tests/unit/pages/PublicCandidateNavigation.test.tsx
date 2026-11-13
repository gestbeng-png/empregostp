import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import PublicCandidatoProfile from '../../../pages/candidatos/[id]';

jest.mock('next/router', () => ({
  useRouter: () => ({ asPath: '/candidatos/candidate-navigation-test', replace: jest.fn() }),
}));

jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: null, loading: false }),
}));

jest.mock('../../../components/PublicPageShell', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

test('o perfil individual regressa à listagem de verificados e não à página de marketing', () => {
  render(
    <PublicCandidatoProfile
      candidato={{
        id: 'candidate-navigation-test',
        fullName: 'Candidata de teste',
        headline: 'Perfil sintético para teste de navegação',
        verified: true,
        verificationTypes: ['paid'],
        languages: [],
        experiences: [],
        education: [],
        certifications: [],
        skills: [],
        softSkills: [],
      }}
      viewerAccess={{ userType: 'guest' }}
    />,
  );
  expect(
    screen.getByRole('link', { name: 'Candidatos verificados' }),
  ).toHaveAttribute('href', '/verificados');
  expect(
    screen.getByRole('link', { name: 'Iniciar sessão como empresa' }),
  ).toHaveAttribute('href', '/login?type=empresa');
});
