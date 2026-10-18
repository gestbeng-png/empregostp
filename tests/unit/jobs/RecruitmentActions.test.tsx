import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import CandidateRecruitmentActions from '@/components/empresa/CandidateRecruitmentActions';
import {
  ActionForm,
  InterviewControls,
} from '@/components/empresa/RecruitmentControls';
const interview = {
  id: 'i',
  status: 'SCHEDULED',
  when: '20 out. 2026, 10:00 (São Tomé)',
  startsAt: '2026-10-20T10:00:00Z',
  type: 'VIDEO',
  canManage: true,
  canFeedback: true,
  feedback: 'PRIVATE_FEEDBACK',
};

test('failed writes keep the same idempotency key on retry and prevent concurrent submission', async () => {
  const request = jest
    .fn()
    .mockRejectedValueOnce(new Error('Falha temporária'))
    .mockResolvedValue({});
  render(<ActionForm title="Teste" path="/api/test" request={request} />);
  const form = screen.getByRole('form', { name: 'Teste' });
  fireEvent.submit(form);
  fireEvent.submit(form);
  await screen.findByRole('alert');
  expect(request).toHaveBeenCalledTimes(1);
  fireEvent.submit(form);
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  expect(request.mock.calls[0][1].key).toBe(request.mock.calls[1][1].key);
});
test.each([
  ['Confirmar presença', 'confirm', null, null],
  [
    'Pedir reagendamento',
    'request-reschedule',
    'Proposta de horário',
    'Amanhã às 14h',
  ],
  [
    'Cancelamento da entrevista',
    'cancel',
    'Motivo do cancelamento',
    'Indisponibilidade',
  ],
])(
  'candidate action %s reaches its own authenticated route, without internal feedback',
  async (title, action, label, value) => {
    const request = jest.fn().mockResolvedValue({});
    render(
      <InterviewControls candidate interview={interview} request={request} />,
    );
    expect(screen.queryByText('PRIVATE_FEEDBACK')).toBeNull();
    expect(
      screen.queryByRole('form', { name: 'Avaliação da entrevista' }),
    ).toBeNull();
    const form = screen.getByRole('form', { name: title });
    if (label)
      fireEvent.change(within(form).getByRole('textbox', { name: label }), {
        target: { value },
      });
    const confirm = within(form).queryByRole('checkbox');
    if (confirm) fireEvent.click(confirm);
    fireEvent.submit(form);
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        `/api/interviews/i/${action}`,
        expect.objectContaining({ method: 'POST', key: expect.any(String) }),
      ),
    );
  },
);
test('disabled interview rollout hides candidate writes but retains the calendar read', () => {
  render(<InterviewControls candidate enabled={false} interview={interview} />);
  expect(screen.queryAllByRole('form')).toHaveLength(0);
  expect(
    screen.getByRole('button', { name: 'Adicionar ao calendário' }),
  ).toBeEnabled();
});
test.each([
  ['Concluir entrevista', 'complete'],
  ['Registar falta', 'no-show'],
])(
  'employer action %s requires the interview time and confirmation',
  async (title, action) => {
    const request = jest.fn().mockResolvedValue({});
    const { rerender } = render(
      <InterviewControls interview={interview} request={request} />,
    );
    expect(screen.queryByRole('form', { name: title })).toBeNull();
    rerender(
      <InterviewControls
        interview={{ ...interview, startsAt: '2020-01-01T10:00:00Z' }}
        request={request}
      />,
    );
    const form = screen.getByRole('form', { name: title });
    fireEvent.submit(form);
    expect(request).not.toHaveBeenCalled();
    fireEvent.click(within(form).getByRole('checkbox'));
    fireEvent.submit(form);
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        `/api/interviews/i/${action}`,
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  },
);
test('reagendamento uses explicit STP time and feedback remains employer-only', async () => {
  const request = jest.fn().mockResolvedValue({});
  render(<InterviewControls interview={interview} request={request} />);
  const form = screen.getByRole('form', { name: 'Novo horário' });
  fireEvent.change(within(form).getByLabelText('Data e hora (São Tomé, UTC)'), {
    target: { value: '2026-10-21T14:00' },
  });
  fireEvent.change(within(form).getByLabelText(/Local \(/), {
    target: { value: 'Sede' },
  });
  fireEvent.submit(form);
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      '/api/interviews/i/reschedule',
      expect.objectContaining({
        body: expect.objectContaining({
          startsAt: '2026-10-21T14:00:00Z',
          durationMin: 30,
          timezone: 'Africa/Sao_Tome',
          interviewerUserIds: [],
        }),
      }),
    ),
  );
  fireEvent.submit(
    screen.getByRole('form', { name: 'Avaliação da entrevista' }),
  );
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      '/api/interviews/i/feedback',
      expect.objectContaining({
        body: { recommendation: 'AVANCAR', notes: '' },
      }),
    ),
  );
});
test.each(['CONFIRMED', 'DISPUTED'])(
  'candidate can answer requested hire confirmation %s',
  async (answer) => {
    const request = jest.fn().mockResolvedValue({});
    const onSuccess = jest.fn();
    render(
      <CandidateRecruitmentActions
        timeline={{
          interviews: [],
          hireConfirmation: {
            hireId: 'hire',
            question: 'Começou a trabalhar?',
          },
        }}
        request={request}
        onSuccess={onSuccess}
      />,
    );
    const form = screen.getByRole('form', {
      name: 'Confirmar início de trabalho',
    });
    fireEvent.change(within(form).getByRole('combobox'), {
      target: { value: answer },
    });
    fireEvent.click(within(form).getByRole('checkbox'));
    fireEvent.submit(form);
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        '/api/hires/hire/confirm',
        expect.objectContaining({ body: { answer } }),
      ),
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  },
);
test('hire confirmation is absent when not requested by server projection', () => {
  render(
    <CandidateRecruitmentActions
      timeline={{ interviews: [] }}
      onSuccess={() => undefined}
    />,
  );
  expect(screen.queryByRole('form')).toBeNull();
});
test('calendar download uses the authenticated blob route and releases its object URL', async () => {
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const click = jest
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => undefined);
  URL.createObjectURL = jest.fn(() => 'blob:synthetic-calendar');
  URL.revokeObjectURL = jest.fn();
  jest.useFakeTimers();
  try {
    const blob = new Blob(['BEGIN:VCALENDAR']);
    const request = jest.fn().mockResolvedValue(blob);
    render(
      <InterviewControls candidate interview={interview} request={request} />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Adicionar ao calendário' }),
    );
    await act(async () => undefined);
    expect(request).toHaveBeenCalledWith(
      '/api/interviews/i/ics',
      expect.objectContaining({ file: true }),
    );
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    act(() => jest.advanceTimersByTime(1000));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:synthetic-calendar');
  } finally {
    jest.useRealTimers();
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    click.mockRestore();
  }
});
