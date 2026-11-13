import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import { apiRequest } from '@/lib/apiClient';
import JobDetail, {
  getServerSideProps,
} from '@/pages/dashboard/empresa/vaga/[id]';

const mockRouter = { reload: jest.fn(), push: jest.fn() };
const mockVerifyToken = jest.fn();
const mockGetUser = jest.fn();
const mockCollection = jest.fn();
jest.mock('next/router', () => ({ useRouter: () => mockRouter }));
jest.mock('nookies', () => ({
  __esModule: true,
  default: { get: () => ({ token: 'session' }) },
}));
jest.mock('@/lib/firebaseAdmin', () => ({
  admin: {
    auth: () => ({ verifyIdToken: mockVerifyToken }),
    firestore: () => ({ collection: mockCollection }),
  },
}));
jest.mock('@/lib/apiClient', () => ({ apiRequest: jest.fn() }));
jest.mock('@/components/dashboard/DashboardShell', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));

const job = {
  id: 'job-1',
  titulo: 'Motorista',
  descricao: 'Distribuição de mercadorias',
  status: 'active',
  v2Status: 'PUBLISHED',
  dataFecho: '2099-10-30',
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(apiRequest).mockResolvedValue({});
});

test('closing from the job detail requires an outcome and confirmation and uses the recruitment endpoint', async () => {
  render(<JobDetail vaga={job} candidaturas={[]} />);
  const form = screen.getByRole('form', { name: 'Fechar vaga' });
  fireEvent.submit(form);
  expect(apiRequest).not.toHaveBeenCalled();
  fireEvent.change(within(form).getByLabelText('Resultado do processo'), {
    target: { value: 'POSITION_CANCELLED' },
  });
  fireEvent.submit(form);
  expect(apiRequest).not.toHaveBeenCalled();
  fireEvent.click(within(form).getByRole('checkbox'));
  fireEvent.submit(form);
  await waitFor(() =>
    expect(apiRequest).toHaveBeenCalledWith(
      '/api/jobs/job-1/close',
      expect.objectContaining({
        method: 'POST',
        body: { closeOutcome: 'POSITION_CANCELLED' },
        key: expect.any(String),
      }),
    ),
  );
  await waitFor(() => expect(mockRouter.reload).toHaveBeenCalledTimes(1));
});

test('the Other outcome requires a description before closing', async () => {
  render(<JobDetail vaga={job} candidaturas={[]} />);
  const form = screen.getByRole('form', { name: 'Fechar vaga' });
  fireEvent.change(within(form).getByRole('combobox'), {
    target: { value: 'OTHER' },
  });
  fireEvent.click(within(form).getByRole('checkbox'));
  fireEvent.submit(form);
  expect(apiRequest).not.toHaveBeenCalled();
  fireEvent.change(within(form).getByLabelText('Descreva o resultado'), {
    target: { value: 'Reorganização da equipa' },
  });
  fireEvent.submit(form);
  await waitFor(() =>
    expect(apiRequest).toHaveBeenCalledWith(
      '/api/jobs/job-1/close',
      expect.objectContaining({
        body: { closeOutcome: 'OTHER', otherText: 'Reorganização da equipa' },
      }),
    ),
  );
});

test.each(['CLOSED', 'FILLED', 'ARCHIVED'])(
  'a completed %s recruitment does not offer reactivation',
  (v2Status) => {
    render(
      <JobDetail
        vaga={{ ...job, status: 'closed', v2Status }}
        candidaturas={[]}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Reabrir Vaga' })).toBeNull();
  },
);

test.each(['EXPIRED', 'PAUSED'])(
  'a renewable %s job retains the reactivation action',
  (v2Status) => {
    render(
      <JobDetail
        vaga={{ ...job, status: 'closed', v2Status }}
        candidaturas={[]}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Reabrir Vaga' }),
    ).toBeInTheDocument();
  },
);

test('a suspended company cannot read applications through the job detail SSR', async () => {
  mockVerifyToken.mockResolvedValue({ uid: 'company-1' });
  mockGetUser.mockResolvedValue({
    exists: true,
    data: () => ({ userType: 'empresa', status: 'suspended' }),
  });
  mockCollection.mockReturnValue({ doc: () => ({ get: mockGetUser }) });
  expect(await getServerSideProps({ params: { id: 'job-1' } })).toEqual({
    redirect: { destination: '/login', permanent: false },
  });
  expect(mockVerifyToken).toHaveBeenCalledWith('session', true);
  expect(mockCollection).toHaveBeenCalledTimes(1);
  expect(mockCollection).toHaveBeenCalledWith('users');
});
