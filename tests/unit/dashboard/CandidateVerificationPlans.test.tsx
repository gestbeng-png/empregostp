import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import CandidatePremiumPlansExperience from '../../../components/CandidatePremiumPlansExperience';

const router = { push: jest.fn() };
let currentProfile: Record<string, unknown>;
jest.mock('next/router', () => ({ useRouter: () => router }));
jest.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: { getIdToken: async () => 'test-token' } }),
}));

describe('verificação na área de planos', () => {
  const fetchBefore = global.fetch;
  beforeEach(() => {
    currentProfile = { currentPlan: 'verification_candidato' };
    global.fetch = jest.fn(async (url) => ({
      ok: true,
      json: async () =>
        url === '/api/profile'
          ? { profile: { data: currentProfile } }
          : url === '/api/candidate/plans'
            ? {
                plans: [
                  {
                    id: 'configured-verification',
                    planTierId: 'verification_candidato',
                    name: 'Verificação configurada',
                    price: 20,
                    features: [],
                  },
                ],
              }
            : {},
    })) as jest.Mock;
  });
  afterEach(() => {
    global.fetch = fetchBefore;
  });

  test.each([
    [{ verificationActive: true }, 'Verificado'],
    [{ verificationPending: true }, 'Verificação em análise'],
  ])('bloqueia nova compra para o estado %s', async (props, label) => {
    render(
      <CandidatePremiumPlansExperience
        embedded
        onPlanApproved={jest.fn()}
        onOpenVerification={jest.fn()}
        {...props}
      />,
    );
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(4));
    const button = screen.getByRole('button', { name: label });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalledWith(
      '/api/subscribe-plan',
      expect.anything(),
    );
  });

  test('plano que inclui verificação abre o envio sem pedir outro pagamento', async () => {
    const onOpenVerification = jest.fn();
    render(
      <CandidatePremiumPlansExperience
        embedded
        onPlanApproved={jest.fn()}
        verificationIncluded
        onOpenVerification={onOpenVerification}
      />,
    );
    await screen.findByRole('heading', { name: 'Verificação configurada' });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Enviar documentos' }),
    );
    expect(onOpenVerification).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalledWith(
      '/api/subscribe-plan',
      expect.anything(),
    );
  });

  test.each(['unverified', 'pending', 'rejected'])(
    'Premium ativo bloqueia a segunda compra mesmo com revisão %s',
    async (verificationStatus) => {
      currentProfile = {
        currentPlan: 'unlimited_candidato',
        verificationStatus,
        planEndDate: '2099-01-01',
      };
      const onOpenVerification = jest.fn();
      render(
        <CandidatePremiumPlansExperience
          embedded
          onPlanApproved={jest.fn()}
          onOpenVerification={onOpenVerification}
          verificationIncluded
          verificationPending
        />,
      );
      const button = await screen.findByRole('button', { name: 'Verificado' });
      expect(button).toBeDisabled();
      await userEvent.click(button);
      expect(onOpenVerification).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(global.fetch).not.toHaveBeenCalledWith(
        '/api/subscribe-plan',
        expect.anything(),
      );
    },
  );
});
