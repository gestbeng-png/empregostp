import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AnnouncementBar from '../../../components/AnnouncementBar';

type NewsItem = {
  id: string;
  title: string;
  category: string;
  date: string;
  content: string;
  siteUrl?: string;
  formUrl?: string;
  expiresAt?: string;
};

function mockNews(news: NewsItem[]) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ news }),
  }) as unknown as typeof fetch;
}

async function abrirModal() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /saiba mais/i }));
  await screen.findByRole('dialog');
  return user;
}

describe('barra de avisos com links da notícia', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('mostra os botões de formulário e de site quando a notícia os tem', async () => {
    mockNews([
      {
        id: 'noticia-1',
        title: 'Limpeza PM',
        category: 'EVENTO',
        date: '2026-02-03',
        content: 'Inscrições abertas.',
        siteUrl: 'https://exemplo.st/limpeza',
        formUrl: 'forms.gle/abc123',
      },
    ]);

    render(<AnnouncementBar />);
    await abrirModal();

    const formulario = screen.getByRole('link', {
      name: /preencher o formulário/i,
    });
    expect(formulario).toHaveAttribute('href', 'https://forms.gle/abc123');
    expect(formulario).toHaveAttribute('target', '_blank');
    expect(formulario).toHaveAttribute('rel', 'noopener noreferrer');

    expect(screen.getByRole('link', { name: /ir ao site/i })).toHaveAttribute(
      'href',
      'https://exemplo.st/limpeza',
    );
  });

  test('não mostra botões quando não há links e rejeita esquemas perigosos', async () => {
    mockNews([
      {
        id: 'noticia-2',
        title: 'Sem links',
        category: 'NOVIDADE',
        date: '2026-02-04',
        content: 'Apenas texto.',
        siteUrl: 'javascript:alert(1)',
      },
    ]);

    render(<AnnouncementBar />);
    await abrirModal();

    await waitFor(() => {
      expect(screen.queryByRole('link', { name: /ir ao site/i })).toBeNull();
    });
    expect(
      screen.queryByRole('link', { name: /preencher o formulário/i }),
    ).toBeNull();
  });

  test('esconde o aviso cujo prazo de exibição já passou', async () => {
    mockNews([
      {
        id: 'noticia-expirada',
        title: 'Limpeza PM',
        category: 'EVENTO',
        date: '2026-02-03',
        content: 'Já terminou.',
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      },
    ]);

    const { container } = render(<AnnouncementBar />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/news');
    });
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('Limpeza PM')).toBeNull();
  });

  test('mantém o aviso enquanto o prazo não chegou', async () => {
    mockNews([
      {
        id: 'noticia-viva',
        title: 'Limpeza PM',
        category: 'EVENTO',
        date: '2026-02-03',
        content: 'Ainda a decorrer.',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
    ]);

    render(<AnnouncementBar />);

    expect(await screen.findByText('Limpeza PM')).toBeInTheDocument();
  });

  test('sem conteúdo mas com formulário, o aviso mostra o botão em vez do texto de vazio', async () => {
    mockNews([
      {
        id: 'noticia-3',
        title: 'Limpeza PM',
        category: 'EVENTO',
        date: '2026-02-03',
        content: '',
        formUrl: 'https://forms.gle/inscricao',
      },
    ]);

    render(<AnnouncementBar />);
    await abrirModal();

    expect(screen.queryByText(/sem detalhes adicionais/i)).toBeNull();
    expect(
      screen.getByRole('link', { name: /preencher o formulário/i }),
    ).toHaveAttribute('href', 'https://forms.gle/inscricao');
  });

  test('modal lazy continua a sanitizar HTML e devolve foco ao botão ao fechar', async () => {
    mockNews([
      {
        id: 'noticia-html',
        title: 'Aviso de teste',
        category: 'NOVIDADE',
        date: '',
        content:
          '<p>Texto seguro</p><img src="x" onerror="alert(1)"><script>alert(1)</script><a href="javascript:alert(1)">Link perigoso</a>',
      },
    ]);
    const { container } = render(<AnnouncementBar />);
    expect(screen.queryByRole('dialog')).toBeNull();
    const opener = await screen.findByRole('button', { name: /saiba mais/i });
    const user = await abrirModal();
    expect(screen.getByText('Texto seguro')).toBeVisible();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('[onerror]')).toBeNull();
    expect(screen.getByText('Link perigoso')).not.toHaveAttribute('href');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(opener).toHaveFocus();
  });
});
