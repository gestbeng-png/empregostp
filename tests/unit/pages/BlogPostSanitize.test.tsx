import { render } from '@testing-library/react';

const postGet = jest.fn();

jest.mock('../../../lib/firebaseAdmin', () => ({
  admin: {
    firestore: () => ({
      collection: () => ({
        doc: () => ({ get: postGet }),
        orderBy: () => ({ limit: () => ({ get: async () => ({ docs: [] }) }) }),
        limit: () => ({ get: async () => ({ docs: [] }) }),
      }),
    }),
  },
}));

jest.mock('../../../components/PublicPageShell', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('next/router', () => ({
  useRouter: () => ({ isFallback: false, asPath: '/blog/a', query: {} }),
}));

import BlogPost, { getStaticProps } from '../../../pages/blog/[id]';

function storedPost(content: string) {
  postGet.mockResolvedValue({
    exists: true,
    id: 'a',
    data: () => ({ title: 'Artigo', excerpt: 'Resumo', content }),
  });
}

type Props = {
  post: Record<string, unknown>;
  relatedPosts: Array<Record<string, unknown>>;
  articleHtml: string | null;
};

async function propsFor(content: string): Promise<Props> {
  storedPost(content);
  const result = (await getStaticProps({ params: { id: 'a' } })) as {
    props: Props;
  };
  return result.props;
}

describe('Artigo do blog: HTML sanitizado no servidor', () => {
  it('remove scripts e handlers antes de chegar ao browser', async () => {
    const props = await propsFor(
      '<p onclick="roubar()">Texto <strong>forte</strong></p><script>roubar()</script>',
    );
    expect(props.articleHtml).toContain('<strong>forte</strong>');
    expect(props.articleHtml).not.toMatch(/script|onclick/i);
  });

  it('texto sem marcação não é tratado como HTML', async () => {
    const props = await propsFor('Só texto simples.');
    expect(props.articleHtml).toBeNull();
  });

  it('a página injeta apenas o HTML já sanitizado', async () => {
    const props = await propsFor(
      '<p>Olá <em>mundo</em></p><img src=x onerror="x()">',
    );
    const { container } = render(<BlogPost {...props} />);
    expect(container.innerHTML).toContain('<em>mundo</em>');
    expect(container.innerHTML).not.toMatch(/onerror/i);
  });
});
