import {
  MAX_REMEMBERED_TOKEN_HASHES,
  deliverJobAlerts,
  nextUnsubscribeHashes,
  shouldNotifyJobAlert,
} from '@/lib/jobAlertDelivery';
import {
  hashJobAlertUnsubscribeToken,
  isValidUnsubscribeTokenForAlert,
} from '@/lib/jobAlertSubscription';
import { createFakeFirestore } from '@/tests/helpers/fakeFirestore';

const sendEmail = jest.fn();
jest.mock('@/lib/email', () => ({
  sendEmail: (...args: unknown[]) => sendEmail(...args),
}));

const future = new Date(Date.now() + 30 * 86_400_000).toISOString();
const job = {
  titulo: 'Contabilista',
  categoria: 'Finanças',
  localizacao: 'Água Grande',
  tipoContrato: 'Tempo inteiro',
  status: 'active',
  dataFecho: future,
  companyName: 'Empresa Real',
};

const alert = (overrides = {}) => ({
  email: 'ana@exemplo.st',
  filters: { categoria: 'Finanças' },
  active: true,
  status: 'active',
  unsubscribeTokenHash: 'a'.repeat(64),
  ...overrides,
});

describe('shouldNotifyJobAlert', () => {
  test('avisa um alerta ativo cujos filtros correspondem', () => {
    expect(shouldNotifyJobAlert(alert(), job, 'job1')).toBe(true);
  });

  test.each([
    ['filtros diferentes', alert({ filters: { categoria: 'Saúde' } })],
    ['alerta cancelado', alert({ active: false, status: 'unsubscribed' })],
    ['vaga já avisada', alert({ notifiedJobIds: ['job1'] })],
  ])('não avisa: %s', (_label, data) => {
    expect(shouldNotifyJobAlert(data, job, 'job1')).toBe(false);
  });

  test('não avisa quem já recebeu o aviso geral de nova vaga', () => {
    expect(
      shouldNotifyJobAlert(alert(), job, 'job1', new Set(['ana@exemplo.st'])),
    ).toBe(false);
  });

  test('não avisa uma vaga expirada', () => {
    expect(
      shouldNotifyJobAlert(
        alert(),
        { ...job, dataFecho: '2020-01-01' },
        'job1',
      ),
    ).toBe(false);
  });
});

test('guarda no máximo os hashes dos últimos envios, começando pelo da subscrição', () => {
  expect(nextUnsubscribeHashes(alert(), 'b'.repeat(64))).toEqual([
    'a'.repeat(64),
    'b'.repeat(64),
  ]);
  const many = Array.from({ length: 15 }, (_, i) =>
    String(i).padStart(64, '0'),
  );
  expect(
    nextUnsubscribeHashes({ unsubscribeTokenHashes: many }, 'c'.repeat(64)),
  ).toHaveLength(MAX_REMEMBERED_TOKEN_HASHES);
});

describe('deliverJobAlerts', () => {
  function setup() {
    const { db, docs } = createFakeFirestore({
      'jobAlerts/a1': alert(),
      'jobAlerts/a2': alert({
        email: 'rui@exemplo.st',
        filters: { categoria: 'Saúde' },
      }),
      'jobAlerts/a3': alert({
        email: 'eva@exemplo.st',
        active: false,
        status: 'unsubscribed',
      }),
      'jobAlerts/a4': alert({ email: 'candidato@exemplo.st' }),
    });
    const firestore = Object.assign(() => db, {
      FieldValue: { serverTimestamp: () => 'ts' },
    });
    return { adminApp: { firestore }, docs };
  }

  beforeEach(() => {
    sendEmail.mockReset().mockResolvedValue(undefined);
  });

  test('envia só aos alertas correspondentes, com um link de cancelamento válido', async () => {
    const { adminApp, docs } = setup();

    const result = await deliverJobAlerts(adminApp, {
      job,
      jobId: 'job1',
      skipEmails: new Set(['candidato@exemplo.st']),
      siteUrl: 'https://empregostp.com',
    });

    expect(result).toEqual({ matched: 1, sent: 1, failed: 0 });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const email = sendEmail.mock.calls[0]?.[0];
    expect(email).toMatchObject({
      to: 'ana@exemplo.st',
      subject: '1 vaga para si',
    });
    expect(email.text).toContain('https://empregostp.com/vaga/job1');

    // O token do link valida contra o alerta gravado; um token inventado não.
    const token = /token=([A-Za-z0-9_-]{43})/.exec(email.text)?.[1] ?? '';
    const stored = docs.get('jobAlerts/a1') ?? {};
    expect(stored.notifiedJobIds).toEqual(['job1']);
    expect(stored.unsubscribeTokenHashes).toContain(
      hashJobAlertUnsubscribeToken(token),
    );
    expect(isValidUnsubscribeTokenForAlert(token, stored)).toBe(true);
    expect(isValidUnsubscribeTokenForAlert('x'.repeat(43), stored)).toBe(false);
  });

  test('não repete a mesma vaga ao mesmo alerta', async () => {
    const { adminApp } = setup();
    await deliverJobAlerts(adminApp, { job, jobId: 'job1' });
    sendEmail.mockClear();

    const second = await deliverJobAlerts(adminApp, { job, jobId: 'job1' });

    expect(second.sent).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('uma falha de email não interrompe os restantes', async () => {
    const { adminApp } = setup();
    sendEmail.mockRejectedValueOnce(new Error('brevo em baixo'));

    const result = await deliverJobAlerts(adminApp, {
      job,
      jobId: 'job1',
    });

    // a1 falha, a4 (sem skip) é enviado.
    expect(result).toEqual({ matched: 2, sent: 1, failed: 1 });
  });
});
