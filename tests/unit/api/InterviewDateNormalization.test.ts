import { normalizeDateValue } from '../../../lib/dateValue';
import { admin } from '../../../lib/firebaseAdmin';
import interviewIcsHandler from '../../../pages/api/applications/[id]/interview-ics';
import applicationStatusHandler from '../../../pages/api/applications/[id]/status';

jest.mock('../../../lib/firebaseAdmin', () => ({
  admin: {
    auth: jest.fn(),
    firestore: jest.fn(),
  },
}));

jest.mock('../../../lib/serverNotifications', () => ({
  createServerNotification: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../lib/serverLog', () => ({
  logServerError: jest.fn(),
}));

const authMock = admin.auth as unknown as jest.Mock;
const firestoreMock = admin.firestore as unknown as jest.Mock;

function createResponse() {
  const response = {
    end: jest.fn(),
    json: jest.fn(),
    send: jest.fn(),
    setHeader: jest.fn(),
    status: jest.fn(),
  };
  response.end.mockReturnValue(response);
  response.json.mockReturnValue(response);
  response.send.mockReturnValue(response);
  response.setHeader.mockReturnValue(response);
  response.status.mockReturnValue(response);
  return response;
}

function configureIcsFirestore(scheduledAt: unknown) {
  firestoreMock.mockReturnValue({
    collection: jest.fn((name: string) => {
      if (name === 'users') {
        return {
          doc: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({
              exists: true,
              data: () => ({ userType: 'candidato' }),
            }),
          })),
        };
      }
      if (name === 'applications') {
        return {
          doc: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({
              exists: true,
              data: () => ({
                candidateId: 'candidate-1',
                company: 'Empresa STP',
                jobTitle: 'Gestor de Projetos',
                interviewDetails: {
                  scheduledAt,
                  mode: 'online',
                  link: 'https://meet.example.test/interview',
                },
              }),
            }),
          })),
        };
      }
      throw new Error(`Coleção inesperada: ${name}`);
    }),
  });
}

describe('normalização das datas de entrevista', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authMock.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'candidate-1' }),
    });
  });

  test.each([
    ['ISO', '2026-08-16T12:00:00.000Z'],
    ['Date', new Date('2026-08-16T12:00:00.000Z')],
    [
      'Timestamp Firestore',
      { toDate: () => new Date('2026-08-16T12:00:00.000Z') },
    ],
    [
      'Timestamp serializado',
      { _seconds: 1786881600, _nanoseconds: 0 },
    ],
  ])('gera ICS para data em formato %s', async (_label, scheduledAt) => {
    configureIcsFirestore(scheduledAt);
    const response = createResponse();

    await interviewIcsHandler(
      {
        headers: { authorization: 'Bearer valid-token' },
        method: 'GET',
        query: { id: 'application-1' },
      },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.send).toHaveBeenCalledWith(
      expect.stringContaining('DTSTART:20260816T120000Z'),
    );
    expect(response.send).toHaveBeenCalledWith(
      expect.stringContaining('DTEND:20260816T130000Z'),
    );
  });

  test('normalizador rejeita valores impossíveis sem lançar', () => {
    expect(normalizeDateValue('não-é-data')).toBeNull();
    expect(normalizeDateValue({ toDate: () => { throw new Error('bad'); } })).toBeNull();
  });

  test('ICS responde 400 para data inválida', async () => {
    configureIcsFirestore('data-inválida');
    const response = createResponse();

    await interviewIcsHandler(
      {
        headers: { authorization: 'Bearer valid-token' },
        method: 'GET',
        query: { id: 'application-1' },
      },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.end).toHaveBeenCalledWith('Invalid interview date');
  });

  test('agendamento responde 400, em vez de 500, para data inválida', async () => {
    const response = createResponse();

    await applicationStatusHandler(
      {
        body: {
          status: 'interview',
          interviewDate: 'data-inválida',
          interviewMode: 'online',
          interviewLink: 'https://meet.example.test',
        },
        headers: { authorization: 'Bearer valid-token' },
        method: 'PATCH',
        query: { id: 'application-1' },
      },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('data valida') }),
    );
  });
});
