import { mayCollectPageAnalytics } from '@/lib/analyticsPrivacy';
test.each([
  { pathname: '/equipa/convite', search: '?i=inv&t=synthetic' },
  {
    pathname: '/login',
    search: '?redirect=%2Fequipa%2Fconvite%3Fi%3Dinv%26t%3Dsynthetic',
  },
  { pathname: '/login', search: '?next=%2Fequipa%2Fconvite' },
])(
  'invitation or return-to-invitation URL is excluded from automatic analytics %j',
  (location) => {
    expect(mayCollectPageAnalytics(location)).toBe(false);
  },
);
test('ordinary public page analytics is preserved', () => {
  expect(
    mayCollectPageAnalytics({ pathname: '/vagas', search: '?q=assistente' }),
  ).toBe(true);
});
test('unknown location fails closed', () => {
  expect(mayCollectPageAnalytics(null)).toBe(false);
});
