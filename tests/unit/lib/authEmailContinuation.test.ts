import { sendEmail } from '../../../lib/email';
import { sendVerificationEmail } from '../../../lib/email/authEmails';

jest.mock('../../../lib/firebaseAdmin', () => ({
  admin: {
    auth: () => ({
      generateEmailVerificationLink: async () =>
        'https://firebase.test/action?oobCode=test-code',
    }),
  },
}));
jest.mock('../../../lib/email', () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));

test('o email transporta o destino interno até à confirmação', async () => {
  await sendVerificationEmail({
    email: 'test@example.test',
    baseUrl: 'https://empregostp.com',
    returnTo: '/vaga/abc?apply=1#candidatura',
  });
  const message = jest.mocked(sendEmail).mock.calls[0]?.[0];
  const url = new URL(message?.text?.match(/https:\/\/[^\s]+/)?.[0] || '');
  expect(url.origin).toBe('https://empregostp.com');
  expect(url.searchParams.get('oobCode')).toBe('test-code');
  expect(url.searchParams.get('returnTo')).toBe(
    '/vaga/abc?apply=1#candidatura',
  );
});

test.each(['https://evil.test', '//evil.test', '/%255Cevil.test'])(
  'o servidor remove o destino inseguro %s',
  async (returnTo) => {
    await sendVerificationEmail({
      email: 'test@example.test',
      baseUrl: 'https://empregostp.com',
      returnTo,
    });
    expect(jest.mocked(sendEmail).mock.calls[0]?.[0]?.text).not.toContain(
      'returnTo=',
    );
  },
);

test('uma falha real do envio propaga-se ao chamador', async () => {
  jest
    .mocked(sendEmail)
    .mockRejectedValueOnce(new Error('delivery unavailable'));
  await expect(
    sendVerificationEmail({
      email: 'test@example.test',
      baseUrl: 'https://empregostp.com',
    }),
  ).rejects.toThrow('delivery unavailable');
});
