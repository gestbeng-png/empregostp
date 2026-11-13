import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import {
  CandidateOfferPanel,
  EmployerOfferPanel,
  formatOfferAmount,
} from '@/components/empresa/OfferControls';

const sentOffer = {
  id: 'offer-1',
  version: 1,
  status: 'SENT',
  amountMinor: 1_500_000,
  currency: 'STN',
  period: 'MONTH',
  startDate: '2026-11-02',
  expiresAt: '2026-10-31T23:59:59.000Z',
  message: 'Bem-vinda à equipa.',
};

function fill(form: HTMLElement, label: string, value: string) {
  fireEvent.change(within(form).getByLabelText(label), {
    target: { value },
  });
}

test('formata o valor em Dobras por mês', () => {
  // pt-PT separa os milhares com um espaço fino inseparável.
  expect(formatOfferAmount(sentOffer).replace(/\s/g, ' ')).toBe(
    '15 000 Db por mês',
  );
});

test('a empresa prepara e envia uma proposta a partir da pré-seleção', async () => {
  const request = jest
    .fn()
    .mockResolvedValueOnce({ offers: [] })
    .mockResolvedValue({ offer: sentOffer });
  const onChange = jest.fn();
  render(
    <EmployerOfferPanel
      base="/api/applications/app-1"
      status="SHORTLISTED"
      version={3}
      request={request}
      onChange={onChange}
    />,
  );
  fireEvent.click(await screen.findByText('Preparar proposta'));
  const form = screen.getByRole('form', { name: 'Nova proposta' });
  fill(form, 'Salário proposto (valor inteiro)', '15000');
  fill(form, 'Data de início', '2026-11-02');
  fill(form, 'O candidato pode responder até (inclusive)', '2026-10-31');
  fill(form, 'Mensagem ao candidato', '  Bem-vinda à equipa.  ');
  fireEvent.click(within(form).getByRole('checkbox'));
  fireEvent.submit(form);

  await waitFor(() => expect(onChange).toHaveBeenCalled());
  const [path, options] = request.mock.calls[1];
  expect(path).toBe('/api/applications/app-1/offers');
  expect(options).toMatchObject({
    method: 'POST',
    body: {
      action: 'send',
      amountMinor: 1_500_000,
      currency: 'STN',
      period: 'MONTH',
      startDate: '2026-11-02',
      expiresAt: '2026-10-31T23:59:59Z',
      message: 'Bem-vinda à equipa.',
    },
  });
});

test('antes da pré-seleção explica o passo em falta', async () => {
  const request = jest.fn().mockResolvedValue({ offers: [] });
  render(
    <EmployerOfferPanel
      base="/api/applications/app-1"
      status="OFFER_DECLINED"
      version={1}
      request={request}
    />,
  );
  expect(
    await screen.findByText(
      'Pré-selecione ou entreviste o candidato para lhe fazer uma proposta.',
    ),
  ).toBeInTheDocument();
  expect(screen.queryByText('Preparar proposta')).not.toBeInTheDocument();
});

test('com a proposta enviada a empresa só pode retirá-la', async () => {
  const request = jest.fn().mockResolvedValue({ offers: [sentOffer] });
  render(
    <EmployerOfferPanel
      base="/api/applications/app-1"
      status="OFFER"
      version={4}
      request={request}
    />,
  );
  expect(
    await screen.findByText('Enviada — a aguardar resposta'),
  ).toBeInTheDocument();
  expect(
    screen.getByText('Retirar a proposta', { selector: 'summary' }),
  ).toBeInTheDocument();
  expect(screen.queryByText('Preparar proposta')).not.toBeInTheDocument();
});

test('o candidato aceita a proposta', async () => {
  const request = jest.fn().mockResolvedValue({ offer: { ...sentOffer } });
  const onSuccess = jest.fn();
  render(
    <CandidateOfferPanel
      applicationId="app-1"
      offers={[sentOffer]}
      onSuccess={onSuccess}
      request={request}
    />,
  );
  expect(screen.getByText('15 000 Db por mês')).toBeInTheDocument();
  const form = screen.getByRole('form', { name: 'Aceitar a proposta' });
  fireEvent.click(within(form).getByRole('checkbox'));
  fireEvent.submit(form);
  await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  expect(request).toHaveBeenCalledWith(
    '/api/applications/app-1/offers',
    expect.objectContaining({
      method: 'POST',
      body: { action: 'accept', offerId: 'offer-1', expectedVersion: 1 },
    }),
  );
});

test('recusar é a ação secundária; aceitar a principal', () => {
  render(<CandidateOfferPanel applicationId="app-1" offers={[sentOffer]} />);
  expect(screen.getByRole('button', { name: 'Recusar proposta' })).toHaveClass(
    'btn-ghost',
  );
  expect(screen.getByRole('button', { name: 'Aceitar proposta' })).toHaveClass(
    'btn-primary',
  );
});

test('sem propostas o candidato não vê o painel', () => {
  const { container } = render(
    <CandidateOfferPanel applicationId="app-1" offers={[]} />,
  );
  expect(container).toBeEmptyDOMElement();
});
