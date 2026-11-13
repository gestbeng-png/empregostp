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
  test('confirma o plano e abre diretamente o pagamento', async () => {
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

    await user.click(
      await screen.findByRole('radio', { name: /Transferência bancária/ }),
    );
    await user.click(screen.getByRole('button', { name: 'Confirmar plano' }));

    await waitFor(() =>
      expect(
        screen.getByRole('dialog', { name: 'Pagamento do plano' }),
      ).toBeVisible(),
    );
    // O resumo do pagamento mostra sempre STD, mesmo que o pedido guardado
    // traga outra moeda.
    const [amountSummary] = screen.getAllByText('100 STD');
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
    // O preço gravado pelo admin mantém-se; a moeda é sempre normalizada
    // para STD, mesmo quando o documento diz outra coisa.
    expect(
      within(professionalPlan as HTMLElement).getByLabelText('375 STD'),
    ).toBeVisible();

    await user.click(
      within(professionalPlan as HTMLElement).getByRole('button', {
        name: 'Escolher plano',
      }),
    );
    await user.click(
      await screen.findByRole('radio', { name: /Transferência bancária/ }),
    );
    await user.click(screen.getByRole('button', { name: 'Confirmar plano' }));

    expect(onSubscribe).toHaveBeenCalledWith('plano-empresa-firestore');
  });

  test('mostra apenas os planos pagos e mantém a indicação do plano gratuito atual', () => {
    render(
      <EmpresaPlansCatalog
        currentPlanId="basic_empresa"
        currentPlanName="Gratuito"
        onSubscribe={jest.fn()}
      />,
    );
    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(3);
    expect(
      screen.queryByRole('article', { name: 'Gratuito' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Começar gratuitamente' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Gratuito')).toBeVisible();
    expect(
      screen.queryByText(
        'Para começar sem compromisso e publicar a primeira vaga.',
      ),
    ).not.toBeInTheDocument();
    for (const card of cards) {
      const action = within(card).getByRole('button');
      const benefits = within(card).getByRole('heading', {
        name: 'O que está incluído',
      });
      expect(
        action.compareDocumentPosition(benefits) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(card).toHaveClass('card');
    }
    expect(screen.getByRole('article', { name: 'Profissional' })).toHaveClass(
      'cardPopular',
    );
  });

  test('mantém o plano pago atual identificado e sem permitir uma compra repetida', () => {
    render(
      <EmpresaPlansCatalog
        currentPlanId="professional_empresa"
        currentPlanName="Profissional"
        onSubscribe={jest.fn()}
      />,
    );

    const current = screen.getByRole('article', { name: 'Profissional' });
    expect(
      within(current).getByRole('button', { name: 'Plano atual' }),
    ).toBeDisabled();
    expect(within(current).getByText('O seu plano atual')).toBeVisible();
  });

  test('oculta também o escalão gratuito com nome e identificador personalizados', () => {
    render(
      <EmpresaPlansCatalog
        plans={[
          {
            id: 'empresa-basic-real',
            type: 'empresa',
            name: 'Plano inicial',
            price: 0,
            vagasLimit: 1,
            isActive: true,
          },
        ]}
      />,
    );

    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(
      screen.queryByRole('article', { name: 'Plano inicial' }),
    ).not.toBeInTheDocument();
  });

  test('não permite iniciar outra subscrição durante o processamento', () => {
    const onSubscribe = jest.fn();
    render(
      <EmpresaPlansCatalog
        loadingPlanId="professional_empresa"
        onSubscribe={onSubscribe}
      />,
    );
    for (const card of screen.getAllByRole('article'))
      expect(within(card).getByRole('button')).toBeDisabled();
    expect(onSubscribe).not.toHaveBeenCalled();
  });
});
