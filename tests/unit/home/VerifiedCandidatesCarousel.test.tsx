import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import VerifiedCandidatesCarousel from '../../../components/home/VerifiedCandidatesCarousel';

const candidates: Array<{
  id: string;
  fullName: string;
  headline: string;
  experienceLabel: string;
  initials: string;
  photoUrl: string;
  profileVisibility: 'public' | 'recruiters';
}> = [
  {
    id: 'candidate-public',
    fullName: 'Ana de Sousa',
    headline: 'Gestora de projetos',
    experienceLabel: 'Anos de experiência: 4 anos',
    initials: 'AS',
    photoUrl: '',
    profileVisibility: 'public',
  },
  {
    id: 'candidate-recruiters',
    fullName: 'Carlos Neto',
    headline: 'Técnico de operações',
    experienceLabel: 'Experiência profissional registada',
    initials: 'CN',
    photoUrl: '',
    profileVisibility: 'recruiters',
  },
  {
    id: 'candidate-public-2',
    fullName: 'Marta Lima',
    headline: 'Designer de produto',
    experienceLabel: 'Perfil profissional verificado',
    initials: 'ML',
    photoUrl: '',
    profileVisibility: 'public',
  },
];

describe('carrossel de candidatos verificados', () => {
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: jest.fn(),
    });
  });

  test('apresenta todos os perfis recebidos sem os truncar', () => {
    render(<VerifiedCandidatesCarousel candidates={candidates} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('Ana de Sousa')).toBeVisible();
    expect(screen.getByText('Carlos Neto')).toBeVisible();
    expect(screen.getByText('Marta Lima')).toBeVisible();
    expect(screen.getByText('3 talentos disponíveis')).toBeInTheDocument();
    expect(screen.getByText('Gestora de projetos')).toBeVisible();
    // O cartão da home mostra o estado por extenso; o selo é decorativo.
    expect(screen.getAllByText('Verificado')).toHaveLength(3);
  });

  test('agrupa três perfis por página e permite navegar entre grupos', async () => {
    const user = userEvent.setup();
    const paginatedCandidates = Array.from({ length: 7 }, (_, index) => {
      const baseCandidate = candidates[index % candidates.length];
      if (!baseCandidate) throw new Error('Candidato de teste em falta.');

      return {
        ...baseCandidate,
        id: `candidate-${index + 1}`,
        fullName: `Candidato ${index + 1}`,
      };
    });
    render(<VerifiedCandidatesCarousel candidates={paginatedCandidates} />);

    expect(screen.getByText('1 / 3')).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: 'Ver perfis seguintes' }),
    );
    expect(screen.getByText('2 / 3')).toBeVisible();

    await user.click(
      screen.getByRole('button', { name: 'Ver perfis anteriores' }),
    );
    expect(screen.getByText('1 / 3')).toBeVisible();
  });

  test('abre perfis públicos e protege os reservados com autenticação', () => {
    render(<VerifiedCandidatesCarousel candidates={candidates} />);

    expect(
      screen.getByRole('link', { name: 'Ver perfil de Ana de Sousa' }),
    ).toHaveAttribute('href', '/candidatos/candidate-public');
    expect(
      screen.getByRole('link', {
        name: /Iniciar sessão de empresa para ver o perfil de Carlos Neto/i,
      }),
    ).toHaveAttribute(
      'href',
      '/login?redirect=%2Fcandidatos%2Fcandidate-recruiters',
    );
    expect(screen.getAllByText('Ver perfil')).toHaveLength(3);
  });

  test('convida a ser verificado quando não há perfis disponíveis', () => {
    render(<VerifiedCandidatesCarousel candidates={[]} />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'O próximo perfil em destaque pode ser o seu',
    );
    expect(
      screen.getByRole('link', { name: /Seja verificado/i }),
    ).toHaveAttribute('href', '/candidatos#planos');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
