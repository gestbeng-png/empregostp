import {
  buildLoginUrl,
  redirectToLogin,
  sanitizeLoginRedirect,
  readLoginRedirect,
  buildRegisterUrl,
} from '../../../lib/loginRedirect';

describe('continuação entre login e registo', () => {
  test('aceita returnTo e preserva os links redirect existentes', () => {
    expect(readLoginRedirect({ returnTo: '/vaga/abc#candidatura' })).toBe(
      '/vaga/abc#candidatura',
    );
    expect(
      readLoginRedirect({ redirect: '/vagas', returnTo: '/empresas' }),
    ).toBe('/vagas');
    expect(readLoginRedirect({ returnTo: ['/vagas', '/empresas'] })).toBe(
      '/vagas',
    );
    expect(buildRegisterUrl('/vaga/abc#candidatura')).toBe(
      '/register?redirect=%2Fvaga%2Fabc%23candidatura',
    );
  });

  test.each(['//evil.test', 'https://evil.test', '/%255Cevil.test', '/login'])(
    'recusa o destino inseguro %s nos dois percursos',
    (returnTo) => {
      expect(readLoginRedirect({ returnTo })).toBeNull();
      expect(buildRegisterUrl(returnTo)).toBe('/register');
    },
  );
});

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

  test('recusa variantes codificadas, barras invertidas e controlos', () => {
    expect(buildLoginUrl('/\\atacante.example.com')).toBe('/login');
    expect(buildLoginUrl('/%5Catacante.example.com')).toBe('/login');
    expect(buildLoginUrl('/%255Catacante.example.com')).toBe('/login');
    expect(buildLoginUrl('/%2F%2Fatacante.example.com')).toBe('/login');
    expect(buildLoginUrl('/vagas%0Ajavascript:alert(1)')).toBe('/login');
  });

  test('recusa destinos que não começam por barra', () => {
    expect(buildLoginUrl('dashboard/empresa')).toBe('/login');
    expect(buildLoginUrl('javascript:alert(1)')).toBe('/login');
  });

  test('aceita caminhos internos com query e fragmento', () => {
    expect(buildLoginUrl('/vaga/abc123')).toBe(
      '/login?redirect=%2Fvaga%2Fabc123',
    );
    expect(buildLoginUrl('/recursos/gerador-cv')).toBe(
      '/login?redirect=%2Frecursos%2Fgerador-cv',
    );
  });
});

describe('sanitizeLoginRedirect', () => {
  test('valida novamente o valor já lido da query do login', () => {
    expect(sanitizeLoginRedirect('/dashboard/candidato?tab=plans')).toBe(
      '/dashboard/candidato?tab=plans',
    );
    expect(sanitizeLoginRedirect('javascript:alert(1)')).toBeNull();
    expect(sanitizeLoginRedirect('//atacante.example.com')).toBeNull();
    expect(sanitizeLoginRedirect('/\\atacante.example.com')).toBeNull();
    expect(sanitizeLoginRedirect(undefined)).toBeNull();
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
    expect(
      redirectToLogin({ resolvedUrl: '/dashboard/empresa?tab=plans' }),
    ).toEqual({
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
