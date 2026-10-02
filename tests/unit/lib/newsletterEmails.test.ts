import { announcementEmail } from '../../../lib/newsletterEmails';

const site = 'https://empregostp.com';

describe('email de anúncio da newsletter', () => {
  test('uma notícia não é tratada como artigo', () => {
    const { subject, html, text } = announcementEmail({
      post: {
        title: 'Noite Catchupa',
        category: 'DESTAQUE',
        content: '<p>Uma noite de música e catchupa na cidade.</p>',
      },
      postId: 'noticia-1',
      type: 'news',
      site,
    });

    expect(subject).toBe('Noite Catchupa');
    expect(html).toContain('Nova notícia');
    expect(html).toContain('Ver a notícia');
    expect(html).not.toContain('Ler o artigo completo');
    expect(html).not.toContain('Nova publicação');
    // O conteúdo da notícia entra como resumo, sem as etiquetas HTML.
    expect(html).toContain('Uma noite de música e catchupa na cidade.');
    expect(html).not.toContain('<p>Uma noite');
    expect(text).toContain(`Ver a notícia: ${site}/blog/noticia-1`);
  });

  test('os links da notícia viram botões, com o formulário como acção principal', () => {
    const { html, text } = announcementEmail({
      post: {
        title: 'Limpeza PM',
        content: 'Inscrições abertas.',
        formUrl: 'https://forms.gle/abc123',
        siteUrl: 'https://exemplo.st/limpeza',
      },
      postId: 'noticia-2',
      type: 'news',
      site,
    });

    expect(html).toContain('Preencher formulário');
    expect(html).toContain('https://forms.gle/abc123');
    expect(html).toContain('Ir ao site');
    expect(html).toContain('https://exemplo.st/limpeza');
    expect(text).toContain('Preencher formulário: https://forms.gle/abc123');
    expect(text).toContain('Site: https://exemplo.st/limpeza');
  });

  test('links com esquema perigoso não chegam ao email', () => {
    const { html } = announcementEmail({
      post: {
        title: 'Aviso',
        content: 'Texto.',
        formUrl: 'javascript:alert(1)',
      },
      postId: 'noticia-3',
      type: 'news',
      site,
    });

    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('Preencher formulário');
  });

  test('o artigo do blog mantém o vocabulário de artigo', () => {
    const { html, text } = announcementEmail({
      post: {
        title: 'Cinco erros comuns no currículo',
        excerpt: 'O que os empregadores notam primeiro.',
        author: 'Equipa EmpregoSTP',
        readTime: '6 min',
      },
      postId: 'artigo-1',
      type: 'blog',
      site,
    });

    expect(html).toContain('Nova publicação');
    expect(html).toContain('Ler o artigo completo');
    expect(html).not.toContain('Ver a notícia');
    expect(html).toContain('6 min de leitura');
    expect(text).toContain('Por Equipa EmpregoSTP.');
  });

  test('sem type explícito, o email continua a ser de artigo', () => {
    const { html } = announcementEmail({
      post: { title: 'Artigo antigo' },
      postId: 'artigo-2',
      site,
    });

    expect(html).toContain('Ler o artigo completo');
  });
});
