import { buildLoginUrl, redirectToLogin } from '../../../lib/loginRedirect';

describe('buildLoginUrl', () => {
  test('preserva o destino codificado', () => {
    expect(buildLoginUrl('/dashboard/empresa?tab=jobs')).toBe(
      '/login?redirect=%2Fdashboard%2Fempresa%3Ftab%3Djobs',
    );
  });

  test('devolve o login simples quando não há destino', () => {
    expect(buildLoginUrl()).toBe('/login');
    expect(buildLoginUrl('')).toBe('/login');
    expect(buildLoginUrl(null)).toBe('/login');
  });

  test('não repete o próprio login como destino', () => {
    expect(buildLoginUrl('/login')).toBe('/login');
    expect(buildLoginUrl('/login?redirect=%2Fvagas')).toBe('/login');
  });

  test('recusa destinos absolutos, para não servir de open redirect', () => {
    expect(buildLoginUrl('https://atacante.example.com/phish')).toBe('/login');
    expect(buildLoginUrl('http://atacante.example.com')).toBe('/login');
    expect(buildLoginUrl('//atacante.example.com')).toBe('/login');
  });

  test('recusa destinos que não começam por barra', () => {
    expect(buildLoginUrl('dashboard/empresa')).toBe('/login');
    expect(buildLoginUrl('javascript:alert(1)')).toBe('/login');
  });

  test('aceita caminhos internos com query e fragmento', () => {
    expect(buildLoginUrl('/vaga/abc123')).toBe('/login?redirect=%2Fvaga%2Fabc123');
    expect(buildLoginUrl('/recursos/gerador-cv')).toBe(
      '/login?redirect=%2Frecursos%2Fgerador-cv',
    );
  });
});

describe('redirectToLogin', () => {
  test('devolve o objeto de redirect do Next com o destino preservado', () => {
    expect(redirectToLogin('/dashboard/admin')).toEqual({
      redirect: {
        destination: '/login?redirect=%2Fdashboard%2Fadmin',
        permanent: false,
      },
    });
  });

  test('aceita o contexto do getServerSideProps e usa o resolvedUrl', () => {
    expect(redirectToLogin({ resolvedUrl: '/dashboard/empresa?tab=plans' })).toEqual({
      redirect: {
        destination: '/login?redirect=%2Fdashboard%2Fempresa%3Ftab%3Dplans',
        permanent: false,
      },
    });
  });

  test('nunca é permanente, para o utilizador poder voltar depois de autenticar', () => {
    expect(redirectToLogin('/x').redirect.permanent).toBe(false);
  });
});
