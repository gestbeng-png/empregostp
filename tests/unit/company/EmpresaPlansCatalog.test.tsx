import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import EmpresaPlansCatalog from '../../../components/EmpresaPlansCatalog';

jest.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: null }),
}));

function PlansHarness() {
  const [pendingRequest, setPendingRequest] = useState<null | {
    id: string;
    planId: string;
    planName: string;
    price: number;
    status: string;
    paymentInstructions: { amount: number; currency: string };
  }>(null);

  return (
    <EmpresaPlansCatalog
      currentPlanId="basic_empresa"
      currentPlanName="Básico"
      pendingPaymentRequest={pendingRequest}
      paymentInstructions={pendingRequest?.paymentInstructions ?? null}
      onPaymentProofSubmitted={setPendingRequest}
      onSubscribe={async () => {
        setPendingRequest({
          id: 'request-id',
          planId: 'professional_empresa',
          planName: 'Profissional',
          price: 100,
          status: 'pending',
          paymentInstructions: { amount: 100, currency: 'Dobras' },
        });
        return { ok: true, status: 'awaiting_payment' };
      }}
    />
  );
}

describe('planos da empresa', () => {
  test('confirma o plano e abre diretamente o envio do comprovativo', async () => {
    const user = userEvent.setup();
    render(<PlansHarness />);

    const professionalPlan = screen
      .getByRole('heading', { name: 'Profissional' })
      .closest('article');
    expect(professionalPlan).not.toBeNull();

    await user.click(
      within(professionalPlan as HTMLElement).getByRole('button', {
        name: 'Escolher plano',
      }),
    );
    expect(screen.getByRole('dialog', { name: 'Profissional' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Confirmar plano' }));

    await waitFor(() =>
      expect(
        screen.getByRole('dialog', { name: 'Enviar comprovativo' }),
      ).toBeVisible(),
    );
    const [amountSummary] = screen.getAllByText('100 Dobras');
    expect(amountSummary).toBeVisible();
    expect(screen.getByLabelText('Ficheiro')).toBeVisible();
  });

  test('fecha com Escape e devolve o foco ao plano escolhido', async () => {
    const user = userEvent.setup();
    render(<PlansHarness />);

    const professionalPlan = screen
      .getByRole('heading', { name: 'Profissional' })
      .closest('article');
    const trigger = within(professionalPlan as HTMLElement).getByRole(
      'button',
      { name: 'Escolher plano' },
    );

    await user.click(trigger);
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(trigger).toHaveFocus();
  });

  test('usa o identificador real do plano configurado pelo administrador', async () => {
    const user = userEvent.setup();
    const onSubscribe = jest.fn().mockResolvedValue({ status: 'pending' });

    render(
      <EmpresaPlansCatalog
        plans={[
          {
            id: 'plano-empresa-firestore',
            type: 'empresa',
            name: 'Profissional',
            price: 375,
            priceLabel: '375 Dobras',
            duration: 30,
            vagasLimit: 5,
            destaque: true,
            features: ['5 vagas ativas', 'Suporte prioritário'],
            isActive: true,
          },
        ]}
        currentPlanId="basic_empresa"
        currentPlanName="Básico"
        onSubscribe={onSubscribe}
      />,
    );

    const professionalPlan = screen
      .getByRole('heading', { name: 'Profissional' })
      .closest('article');
    expect(professionalPlan).not.toBeNull();
    expect(
      within(professionalPlan as HTMLElement).getByText('375 Dobras'),
    ).toBeVisible();

    await user.click(
      within(professionalPlan as HTMLElement).getByRole('button', {
        name: 'Escolher plano',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Confirmar plano' }));

    expect(onSubscribe).toHaveBeenCalledWith('plano-empresa-firestore');
  });
});
