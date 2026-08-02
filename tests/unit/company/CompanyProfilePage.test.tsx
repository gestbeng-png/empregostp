import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import CompanyProfilePage from '../../../pages/dashboard/empresa/profile';

const mockPush = jest.fn();
const mockRouter = { push: mockPush };
const mockUseAuth = jest.fn();
const mockGetIdToken = jest.fn();
const mockFetch = jest.fn();

jest.mock('next/router', () => ({
  useRouter: () => mockRouter,
}));

jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('../../../components/dashboard/DashboardShell', () => ({
  __esModule: true,
  default: ({
    children,
    profile,
  }: {
    children: React.ReactNode;
    profile: { name: string };
  }) => (
    <main data-testid="dashboard-shell" data-profile-name={profile.name}>
      {children}
    </main>
  ),
}));

jest.mock('../../../lib/firebase', () => ({ storage: {} }));

jest.mock('firebase/storage', () => ({
  ref: jest.fn(),
  uploadBytes: jest.fn(),
  getDownloadURL: jest.fn(),
}));

jest.mock('../../../lib/firebaseStorageError', () => ({
  getFirebaseStorageErrorMessage: jest.fn(() => 'Erro ao enviar imagem.'),
}));

const companyProfile = {
  name: 'Empresa São Tomé',
  email: 'empresa@exemplo.st',
  phone: '+239 999 9999',
  description: 'Empresa focada no desenvolvimento sustentável.',
  companySize: '11-50 funcionários',
  website: 'https://empresa.st',
  industrySectors: ['Tecnologia'],
  location: 'Água Grande, São Tomé',
  logoUrl: '',
  coverImageUrl: '',
  socialMedia: {
    linkedin: 'https://linkedin.com/company/empresa-st',
    facebook: '',
    instagram: '',
  },
};

function mockProfileRequest() {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ profile: companyProfile }),
  });
}

describe('edição do perfil da empresa', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockGetIdToken.mockReset().mockResolvedValue('token-empresa');
    mockFetch.mockReset();
    global.fetch = mockFetch as typeof fetch;
    mockUseAuth.mockReturnValue({
      loading: false,
      user: {
        uid: 'empresa-1',
        email: 'empresa@exemplo.st',
        displayName: 'Edmir Santos',
        getIdToken: mockGetIdToken,
      },
    });
  });

  test('apresenta o formulário organizado sem perder os dados existentes', async () => {
    mockProfileRequest();

    render(<CompanyProfilePage />);

    expect(
      await screen.findByRole('heading', {
        name: 'Perfil da empresa',
        level: 1,
      }),
    ).toBeVisible();

    const navigation = screen.getByRole('navigation', {
      name: 'Secções do perfil da empresa',
    });
    expect(
      within(navigation).getByRole('link', { name: 'Marca' }),
    ).toHaveAttribute('href', '#marca');
    expect(
      within(navigation).getByRole('link', { name: 'Informações básicas' }),
    ).toHaveAttribute('href', '#informacoes-basicas');

    expect(
      screen.getByRole('heading', { name: 'Gestão de marca' }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Informações básicas' }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Sobre a empresa' }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Redes sociais' }),
    ).toBeVisible();

    expect(screen.getByLabelText('Nome da empresa *')).toHaveValue(
      'Empresa São Tomé',
    );
    expect(screen.getByLabelText('Email de contacto')).toBeDisabled();
    expect(screen.getByLabelText('Localização')).toHaveValue(
      'Água Grande, São Tomé',
    );
    expect(screen.getByLabelText('Descrição')).toHaveValue(
      'Empresa focada no desenvolvimento sustentável.',
    );
    expect(screen.getByText('1 selecionado(s)')).toBeVisible();
    expect(screen.getByTestId('dashboard-shell')).toHaveAttribute(
      'data-profile-name',
      'Empresa São Tomé',
    );
  });

  test('mantém a seleção de setores e a gravação funcional', async () => {
    mockProfileRequest();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ profile: companyProfile }),
    });

    render(<CompanyProfilePage />);

    const companyName = await screen.findByLabelText('Nome da empresa *');
    fireEvent.change(companyName, { target: { value: 'Empresa STP Premium' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Turismo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar alterações' }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));

    const [, saveRequest] = mockFetch.mock.calls;
    const [, requestOptions] = saveRequest;
    const body = JSON.parse(requestOptions.body as string);

    expect(saveRequest[0]).toBe('/api/empresa');
    expect(requestOptions.method).toBe('PUT');
    expect(body.name).toBe('Empresa STP Premium');
    expect(body.industrySectors).toEqual(['Tecnologia', 'Turismo']);
    expect(
      await screen.findByText('Perfil atualizado com sucesso.'),
    ).toBeVisible();
  });
});
