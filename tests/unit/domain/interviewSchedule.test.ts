import {
  buildInterviewIcs,
  candidateInterviewView,
  dueInterviewReminders,
  formatInterviewTime,
  validateInterviewInput,
} from '@/domain/interviews/schedule';

const now = new Date('2026-10-10T10:00:00Z');

describe('E6 — validação da marcação', () => {
  test('aceita presencial com local e aplica o fuso de STP por defeito', () => {
    expect(
      validateInterviewInput(
        {
          type: 'PRESENCIAL',
          startsAt: '2026-10-12T09:00:00Z',
          location: 'Av. Marginal 12',
        },
        now,
      ),
    ).toMatchObject({
      ok: true,
      value: {
        durationMin: 30,
        timezone: 'Africa/Sao_Tome',
        location: 'Av. Marginal 12',
        meetingUrl: null,
      },
    });
  });
  test.each([
    [{ type: 'X', startsAt: '2026-10-12T09:00:00Z' }, 'type'],
    [{ type: 'PRESENCIAL', startsAt: '2026-10-12T09:00:00Z' }, 'location'],
    [
      {
        type: 'VIDEO',
        startsAt: '2026-10-12T09:00:00Z',
        meetingUrl: 'http://x',
      },
      'meetingUrl',
    ],
    [{ type: 'TELEFONE', startsAt: '2026-10-10T10:30:00Z' }, 'startsAt'],
    [{ type: 'TELEFONE', startsAt: '2027-06-01T10:30:00Z' }, 'startsAt'],
    [
      { type: 'TELEFONE', startsAt: '2026-10-12T09:00:00Z', durationMin: 5 },
      'durationMin',
    ],
    [
      {
        type: 'TELEFONE',
        startsAt: '2026-10-12T09:00:00Z',
        timezone: 'Lua/Base',
      },
      'timezone',
    ],
  ])('%p → erro em %s', (input, field) => {
    expect(validateInterviewInput(input, now)).toMatchObject({
      ok: false,
      field,
    });
  });
});

describe('E6 — hora sempre com o fuso explícito', () => {
  test('STP e diáspora', () => {
    expect(formatInterviewTime(new Date('2026-11-15T10:00:00Z'))).toBe(
      '15 nov. 2026, 10:00 (hora de São Tomé, GMT+0)',
    );
    expect(
      formatInterviewTime(new Date('2026-07-15T10:00:00Z'), 'Europe/Lisbon'),
    ).toBe('15 jul. 2026, 11:00 (hora de Lisboa, GMT+1)');
  });
});

describe('E6 — convite .ics', () => {
  const ics = buildInterviewIcs({
    interviewId: 'int-1',
    title: 'Contabilista; sénior',
    organizationName: 'Banco, X',
    startsAt: new Date('2026-11-15T10:00:00Z'),
    durationMin: 45,
    location: 'Sede',
    meetingUrl: null,
    description: 'Traga o BI.\nObrigado.',
    sequence: 2,
    now,
  });
  test('RFC 5545: CRLF, UTC, sequência e escapes', () => {
    expect(ics).toContain('DTSTART:20261115T100000Z\r\n');
    expect(ics).toContain('DTEND:20261115T104500Z\r\n');
    expect(ics).toContain('SEQUENCE:2\r\n');
    expect(ics).toContain(
      'SUMMARY:Entrevista: Contabilista\\; sénior — Banco\\, X',
    );
    expect(ics).toContain('DESCRIPTION:Traga o BI.\\nObrigado.');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    for (const line of ics.split('\r\n'))
      expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75);
  });
  test('cancelamento envia METHOD:CANCEL', () => {
    expect(
      buildInterviewIcs({
        interviewId: 'i',
        title: 't',
        organizationName: 'o',
        startsAt: now,
        durationMin: 30,
        location: null,
        meetingUrl: null,
        description: null,
        sequence: 0,
        cancelled: true,
        now,
      }),
    ).toContain('METHOD:CANCEL');
  });
});

describe('E6 — lembretes 24 h e 2 h', () => {
  const at = (h: number) => new Date(now.getTime() + h * 3_600_000);
  test('janela, idempotência e estados', () => {
    expect(
      dueInterviewReminders(
        [
          { id: 'a', status: 'SCHEDULED', startsAt: at(23), remindersSent: [] },
          {
            id: 'b',
            status: 'CONFIRMED',
            startsAt: at(1.5),
            remindersSent: ['24H'],
          },
          {
            id: 'c',
            status: 'CONFIRMED',
            startsAt: at(1.5),
            remindersSent: ['24H', '2H'],
          },
          { id: 'd', status: 'CANCELLED', startsAt: at(1), remindersSent: [] },
          { id: 'e', status: 'SCHEDULED', startsAt: at(30), remindersSent: [] },
          { id: 'f', status: 'SCHEDULED', startsAt: at(1), remindersSent: [] },
          { id: 'g', status: 'SCHEDULED', startsAt: at(-1), remindersSent: [] },
        ],
        now,
      ),
    ).toEqual([
      { interviewId: 'a', window: '24H' },
      { interviewId: 'b', window: '2H' },
      { interviewId: 'f', window: '2H' },
    ]);
  });
});

describe('E6 — vista do candidato', () => {
  test('nunca mostra notas internas nem entrevistadores', () => {
    const view = candidateInterviewView({
      id: 'i',
      v2Status: 'SCHEDULED',
      type: 'VIDEO',
      startsAt: new Date('2026-11-15T10:00:00Z'),
      durationMin: 30,
      meetingUrl: 'https://meet',
      internalNotes: 'segredo',
      interviewerUserIds: ['u9'],
      timezone: 'Africa/Sao_Tome',
    });
    expect(view.when).toBe('15 nov. 2026, 10:00 (hora de São Tomé, GMT+0)');
    expect(JSON.stringify(view)).not.toMatch(/segredo|u9/);
  });
});
