import {
  buildCandidateTimeline,
  candidateStatusLabel,
} from '@/domain/applications/candidateView';
import {
  businessDaysBetween,
  closedReasonForJobEnd,
  DEFAULT_REJECTION_TEMPLATES,
  employerSilenceStage,
  planJobEndClosures,
  renderCandidateTemplate,
} from '@/domain/applications/jobEnd';
import { readJobLifecycle } from '@/domain/jobs/legacyView';

const d = (iso: string) => new Date(iso);

describe('E4 — rótulos para o candidato', () => {
  test.each([
    ['SUBMITTED', null, 'Recebida'],
    ['UNDER_REVIEW', null, 'Em análise'],
    ['SHORTLISTED', null, 'Em análise'],
    ['INTERVIEW', null, 'Entrevista'],
    ['OFFER', null, 'Proposta recebida'],
    ['HIRED', null, 'Contratado(a)'],
    ['REJECTED', 'NOT_SELECTED', 'Não selecionada'],
    ['REJECTED', 'KNOCKOUT_ANSWER', 'Não selecionada'],
    ['REJECTED', 'POSITION_FILLED', 'Processo encerrado'],
    ['REJECTED', 'POSITION_CANCELLED', 'Processo encerrado'],
    ['WITHDRAWN', null, 'Retirada'],
    ['OFFER_DECLINED', null, 'Proposta recusada'],
  ] as const)('%s/%s → %s', (status, reason, label) => {
    expect(candidateStatusLabel(status, reason)).toBe(label);
  });
});

describe('E4/F2.8 — linha temporal', () => {
  test('a pré-seleção nunca aparece como passo distinto', () => {
    const { items } = buildCandidateTimeline(
      [
        { to: 'SUBMITTED', at: d('2026-10-01T09:00:00Z') },
        { to: 'UNDER_REVIEW', at: d('2026-10-02T09:00:00Z') },
        { to: 'SHORTLISTED', at: d('2026-10-03T09:00:00Z') },
        {
          to: 'INTERVIEW',
          at: d('2026-10-04T09:00:00Z'),
          candidateVisibleNote: 'Traga o BI.',
        },
      ],
      d('2026-10-05T00:00:00Z'),
    );
    expect(items).toEqual([
      { label: 'Recebida', date: '1 out. 2026', note: null },
      { label: 'Em análise', date: '2 out. 2026', note: null },
      { label: 'Entrevista', date: '4 out. 2026', note: 'Traga o BI.' },
    ]);
  });

  test('21 dias sem mudança num estado aberto mostram o aviso', () => {
    const history = [
      { to: 'SUBMITTED' as const, at: d('2026-10-12T10:00:00Z') },
    ];
    expect(
      buildCandidateTimeline(history, d('2026-11-01T09:00:00Z')).silenceNotice,
    ).toBeNull();
    expect(
      buildCandidateTimeline(history, d('2026-11-02T10:00:00Z')).silenceNotice,
    ).toBe(
      'Sem atualização desde 12 out. 2026 — a empresa ainda está a analisar.',
    );
  });

  test('estados terminais não mostram aviso de silêncio', () => {
    expect(
      buildCandidateTimeline(
        [{ to: 'WITHDRAWN', at: d('2026-01-01T00:00:00Z') }],
        d('2026-12-01T00:00:00Z'),
      ).silenceNotice,
    ).toBeNull();
  });
});

describe('F2.8 — fecho da vaga trata candidaturas abertas', () => {
  const applications = [
    { id: 'a', status: 'SUBMITTED' as const },
    { id: 'b', status: 'INTERVIEW' as const },
    { id: 'c', status: 'OFFER' as const },
    { id: 'd', status: 'HIRED' as const },
    { id: 'e', status: 'WITHDRAWN' as const },
  ];
  const endedAt = d('2026-10-10T12:00:00Z');

  test('espera até 7 dias pela mensagem do empregador', () => {
    const plan = planJobEndClosures({
      state: 'CLOSED',
      outcome: 'NO_SUITABLE_CANDIDATE',
      endedAt,
      now: d('2026-10-16T12:00:00Z'),
      employerMessageConfirmed: false,
      applications,
    });
    expect(plan.due).toEqual([]);
    expect(plan.waitingForEmployer).toEqual(['a', 'b']);
    expect(plan.dueAt.toISOString()).toBe('2026-10-17T12:00:00.000Z');
  });

  test('ao 7.º dia (ou com mensagem confirmada) fecha só as abertas', () => {
    for (const input of [
      { now: d('2026-10-17T12:00:00Z'), employerMessageConfirmed: false },
      { now: d('2026-10-11T00:00:00Z'), employerMessageConfirmed: true },
    ])
      expect(
        planJobEndClosures({
          state: 'EXPIRED',
          outcome: null,
          endedAt,
          applications,
          ...input,
        }).due,
      ).toEqual([
        { applicationId: 'a', closedReason: 'POSITION_CLOSED' },
        { applicationId: 'b', closedReason: 'POSITION_CLOSED' },
      ]);
  });

  test.each([
    ['FILLED', null, 'POSITION_FILLED'],
    ['CLOSED', 'HIRED_VIA_EMPREGOSTP', 'POSITION_FILLED'],
    ['CLOSED', 'HIRED_OTHER_CHANNEL', 'POSITION_FILLED'],
    ['CLOSED', 'POSITION_CANCELLED', 'POSITION_CANCELLED'],
    ['CLOSED', 'POSITION_ON_HOLD', 'POSITION_CLOSED'],
    ['EXPIRED', null, 'POSITION_CLOSED'],
  ] as const)('%s/%s → %s', (state, outcome, reason) => {
    expect(closedReasonForJobEnd(state, outcome)).toBe(reason);
  });
});

describe('F2.8 — silêncio do empregador em dias úteis', () => {
  test('conta só segunda a sexta', () => {
    // sexta → segunda seguinte = 1 dia útil
    expect(
      businessDaysBetween(d('2026-10-09T10:00:00Z'), d('2026-10-12T10:00:00Z')),
    ).toBe(1);
    expect(
      businessDaysBetween(d('2026-10-12T10:00:00Z'), d('2026-10-12T18:00:00Z')),
    ).toBe(0);
    expect(
      businessDaysBetween(d('2026-10-12T10:00:00Z'), d('2026-10-01T10:00:00Z')),
    ).toBe(0);
  });
  test('D+5, D+10, D+15', () => {
    const start = d('2026-10-05T09:00:00Z'); // segunda
    expect(employerSilenceStage(start, d('2026-10-09T09:00:00Z'))).toBeNull();
    expect(employerSilenceStage(start, d('2026-10-12T09:00:00Z'))).toBe(
      'REMINDER_D5',
    );
    expect(employerSilenceStage(start, d('2026-10-19T09:00:00Z'))).toBe(
      'REMINDER_D10',
    );
    expect(employerSilenceStage(start, d('2026-10-26T09:00:00Z'))).toBe(
      'STAFF_FLAG_D15',
    );
    expect(employerSilenceStage(null, d('2026-10-26T09:00:00Z'))).toBeNull();
  });
});

describe('F3.6 — templates', () => {
  test('substitui só as variáveis permitidas', () => {
    expect(
      renderCandidateTemplate(DEFAULT_REJECTION_TEMPLATES.PROCESS_CLOSED, {
        nome: 'Ana',
        vaga: 'Motorista',
        organizacao: 'ONG Y',
      }),
    ).toBe(
      'Olá Ana, o processo de recrutamento para Motorista foi encerrado. Obrigado pela sua candidatura. Continue a acompanhar novas oportunidades — pode criar um alerta para vagas semelhantes.',
    );
    expect(
      renderCandidateTemplate('{nome} {email} {vaga}', {
        nome: 'A',
        vaga: 'B',
        organizacao: 'C',
      }),
    ).toBe('A {email} B');
  });
});

describe('D7 — leitura de vagas legadas', () => {
  test('estado legado traduzido; v2Status prevalece', () => {
    expect(readJobLifecycle({ status: 'active' }).status).toBe('PUBLISHED');
    expect(readJobLifecycle({}).status).toBe('PUBLISHED');
    expect(readJobLifecycle({ status: 'inactive' }).status).toBe('PAUSED');
    expect(readJobLifecycle({ status: 'disabled' }).status).toBe('REJECTED');
    expect(readJobLifecycle({ status: 'weird' }).status).toBe('DRAFT');
    expect(
      readJobLifecycle({ status: 'active', v2Status: 'EXPIRED' }).status,
    ).toBe('EXPIRED');
  });
  test('dataFecho é o fim do dia em STP; organização recai no dono legado', () => {
    const view = readJobLifecycle({
      status: 'active',
      dataFecho: '2026-11-15',
      companyId: 'u1',
    });
    expect(view.applicationDeadline?.toISOString()).toBe(
      '2026-11-15T23:59:59.999Z',
    );
    expect(view.organizationId).toBe('u1');
    expect(view.applicationMethod).toBe('INTERNAL');
  });
  test('aceita Timestamp-like e milissegundos', () => {
    const view = readJobLifecycle({
      expiresAt: { toDate: () => new Date('2026-12-01T00:00:00Z') },
      applicationDeadline: Date.UTC(2026, 10, 30),
    });
    expect(view.expiresAt?.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(view.applicationDeadline?.toISOString()).toBe(
      '2026-11-30T00:00:00.000Z',
    );
  });
});
