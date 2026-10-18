import { beforeSendVitals } from '@/lib/webVitals';

describe('beforeSendVitals', () => {
  it('retira a query string e o fragmento do URL', () => {
    expect(
      beforeSendVitals({
        type: 'vital',
        url: 'https://empregostp.com/vagas?q=contabilista&email=a%40b.st#topo',
      }),
    ).toEqual({ type: 'vital', url: 'https://empregostp.com/vagas' });
  });

  it('não envia medições da página de convite da equipa', () => {
    expect(
      beforeSendVitals({
        type: 'vital',
        url: 'https://empregostp.com/equipa/convite?token=segredo',
      }),
    ).toBeNull();
  });

  it('mantém o resto do evento', () => {
    expect(
      beforeSendVitals({
        type: 'vital',
        url: 'https://empregostp.com/',
        route: '/',
      }),
    ).toEqual({ type: 'vital', url: 'https://empregostp.com/', route: '/' });
  });
});
