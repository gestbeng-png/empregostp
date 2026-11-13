import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import type { ReactNode } from 'react';

import SobreNos from '../../../pages/sobre-nos';

jest.mock('../../../components/PublicPageShell', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
jest.mock('../../../components/careers/CareerTeam', () => () => null);
jest.mock('../../../hooks/useScrollReveal', () => jest.fn());

// Synthetic UI fixtures, not real testimonials or API integration evidence.
const TEST_TESTIMONIALS = [
  {
    id: 'test-testimonial-1',
    name: 'Testemunho de teste 1',
    role: 'Fixture sintética de teste',
    rating: 5,
    message: 'Conteúdo sintético para testar o primeiro slide do carrossel.',
  },
  {
    id: 'test-testimonial-2',
    name: 'Testemunho de teste 2',
    role: 'Fixture sintética de teste',
    rating: 4,
    message: 'Conteúdo sintético para testar o segundo slide do carrossel.',
  },
] as const;

const originalFetch = global.fetch;
const mockFetch = jest.fn();
const response = (body: unknown, ok = true) =>
  ({ ok, json: async () => body }) as Response;
const testimonialsRegion = () =>
  screen.getByRole('region', { name: 'O que dizem de nós' });
const carousel = () =>
  screen.getByRole('region', {
    name: 'Testemunhos de candidatos e empresas',
  });

function expectNoTestimonials() {
  const region = testimonialsRegion();
  expect(region.querySelectorAll('[data-testimonial-slide]')).toHaveLength(0);
  expect(within(region).queryByRole('button')).not.toBeInTheDocument();
  expect(region).not.toHaveTextContent('Ana Trindade');
  expect(region).not.toHaveTextContent('Nelson Costa');
}

beforeEach(() => {
  mockFetch.mockReset().mockResolvedValue(response({ testimonials: [] }));
  global.fetch = mockFetch;
});

afterEach(() => {
  cleanup();
  global.fetch = originalFetch;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test('loading transitions to an honest empty state without fabricated testimonials', async () => {
  let resolveFetch!: (value: Response) => void;
  mockFetch.mockReturnValueOnce(
    new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    }),
  );
  render(<SobreNos />);

  expect(within(testimonialsRegion()).getByRole('status')).toHaveTextContent(
    'A carregar testemunhos...',
  );
  expectNoTestimonials();
  expect(screen.getByRole('button', { name: 'Enviar' })).toBeEnabled();

  await act(async () => resolveFetch(response({ testimonials: [] })));

  expect(within(testimonialsRegion()).getByRole('status')).toHaveTextContent(
    'Ainda não há testemunhos publicados.',
  );
  expectNoTestimonials();
  expect(mockFetch).toHaveBeenCalledWith('/api/testimonials');
});

test.each(['http', 'network', 'json', 'missing array', 'null payload'])(
  '%s failure shows an error rather than empty or fabricated content',
  async (failure) => {
    if (failure === 'http') {
      mockFetch.mockResolvedValueOnce(
        response({ error: 'Unavailable' }, false),
      );
    } else if (failure === 'network') {
      mockFetch.mockRejectedValueOnce(new Error('Offline'));
    } else if (failure === 'json') {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new SyntaxError('Invalid JSON');
        },
      });
    } else {
      mockFetch.mockResolvedValueOnce(
        response(failure === 'null payload' ? null : {}),
      );
    }
    render(<SobreNos />);

    expect(
      await within(testimonialsRegion()).findByRole('alert'),
    ).toHaveTextContent('Não foi possível carregar os testemunhos.');
    expect(within(testimonialsRegion()).queryByRole('status')).toBeNull();
    expectNoTestimonials();
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeEnabled();
  },
);

test('renders only the public API entries and preserves carousel navigation', async () => {
  mockFetch.mockResolvedValueOnce(
    response({ testimonials: TEST_TESTIMONIALS }),
  );
  render(<SobreNos />);
  const region = await screen.findByRole('region', {
    name: 'Testemunhos de candidatos e empresas',
  });

  expect(region.querySelectorAll('[data-testimonial-slide]')).toHaveLength(2);
  expect(region).not.toHaveTextContent('Ana Trindade');
  expect(region).not.toHaveTextContent('Nelson Costa');
  expect(within(region).getByRole('article')).toHaveTextContent(
    TEST_TESTIMONIALS[0].message,
  );

  fireEvent.click(
    within(region).getByRole('button', { name: 'Testemunho anterior' }),
  );
  expect(within(region).getByRole('article')).toHaveTextContent(
    TEST_TESTIMONIALS[1].name,
  );
  fireEvent.click(
    within(region).getByRole('button', { name: 'Testemunho seguinte' }),
  );
  expect(within(region).getByRole('article')).toHaveTextContent(
    TEST_TESTIMONIALS[0].name,
  );
  fireEvent.click(
    within(region).getByRole('button', { name: 'Ir para o testemunho 2' }),
  );
  expect(within(region).getByRole('article')).toHaveTextContent(
    TEST_TESTIMONIALS[1].name,
  );
  expect(
    within(region).getByRole('button', { name: 'Ir para o testemunho 2' }),
  ).toHaveAttribute('aria-current', 'true');
});

test('one API testimonial is displayed without carousel controls', async () => {
  mockFetch.mockResolvedValueOnce(
    response({ testimonials: [TEST_TESTIMONIALS[0]] }),
  );
  render(<SobreNos />);

  const article = await within(testimonialsRegion()).findByRole('article');
  expect(article).toHaveTextContent(TEST_TESTIMONIALS[0].name);
  expect(within(carousel()).queryByRole('button')).toBeNull();
});

test('API testimonials autoplay and pause on hover and keyboard focus', async () => {
  jest.useFakeTimers();
  mockFetch.mockResolvedValueOnce(
    response({ testimonials: TEST_TESTIMONIALS }),
  );
  render(<SobreNos />);
  await act(async () => {});
  const region = carousel();

  act(() => jest.advanceTimersByTime(4000));
  expect(within(region).getByRole('article')).toHaveTextContent(
    TEST_TESTIMONIALS[1].name,
  );
  fireEvent.mouseEnter(region);
  act(() => jest.advanceTimersByTime(4000));
  expect(within(region).getByRole('article')).toHaveTextContent(
    TEST_TESTIMONIALS[1].name,
  );
  fireEvent.mouseLeave(region);
  act(() => jest.advanceTimersByTime(4000));
  expect(within(region).getByRole('article')).toHaveTextContent(
    TEST_TESTIMONIALS[0].name,
  );
  fireEvent.focus(
    within(region).getByRole('button', { name: 'Testemunho seguinte' }),
  );
  act(() => jest.advanceTimersByTime(4000));
  expect(within(region).getByRole('article')).toHaveTextContent(
    TEST_TESTIMONIALS[0].name,
  );
});

test('reduced motion disables autoplay while preserving manual navigation', async () => {
  jest.useFakeTimers();
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  jest
    .spyOn(window, 'matchMedia')
    .mockReturnValue({ ...mediaQuery, matches: true });
  mockFetch.mockResolvedValueOnce(
    response({ testimonials: TEST_TESTIMONIALS }),
  );
  render(<SobreNos />);
  await act(async () => {});

  act(() => jest.advanceTimersByTime(4000));
  expect(within(carousel()).getByRole('article')).toHaveTextContent(
    TEST_TESTIMONIALS[0].name,
  );
  fireEvent.click(
    within(carousel()).getByRole('button', { name: 'Testemunho seguinte' }),
  );
  expect(within(carousel()).getByRole('article')).toHaveTextContent(
    TEST_TESTIMONIALS[1].name,
  );
});

test.each(['empty', 'load error'])(
  'submitting from %s still requires review and never publishes locally',
  async (loadState) => {
    if (loadState === 'load error')
      mockFetch.mockRejectedValueOnce(new Error('Offline'));
    render(<SobreNos />);
    await within(testimonialsRegion()).findByRole(
      loadState === 'empty' ? 'status' : 'alert',
    );
    await act(async () => {});

    const name = screen.getByRole('textbox', { name: 'Nome' });
    const message = screen.getByRole('textbox', {
      name: /^Testemunho/,
    });
    fireEvent.change(name, { target: { value: '  Submissão de teste  ' } });
    fireEvent.change(message, {
      target: {
        value: '  Conteúdo sintético apenas para testar a submissão.  ',
      },
    });
    fireEvent.click(screen.getByRole('radio', { name: '4 estrelas' }));

    let resolvePost!: (value: Response) => void;
    mockFetch.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolvePost = resolve;
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(screen.getByRole('button', { name: 'A enviar...' })).toBeDisabled();
    expect(mockFetch).toHaveBeenLastCalledWith('/api/testimonials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Submissão de teste',
        role: '',
        rating: 4,
        message: 'Conteúdo sintético apenas para testar a submissão.',
      }),
    });

    await act(async () => resolvePost(response({})));
    expect(
      screen.getByText(
        'Obrigado. O seu testemunho será publicado após revisão.',
      ),
    ).toBeVisible();
    expect(name).toHaveValue('');
    expect(message).toHaveValue('');
    expectNoTestimonials();
  },
);

test('a rejected submission preserves the input and shows the API error', async () => {
  render(<SobreNos />);
  await act(async () => {});
  const name = screen.getByRole('textbox', { name: 'Nome' });
  const message = screen.getByRole('textbox', {
    name: /^Testemunho/,
  });
  fireEvent.change(name, { target: { value: 'Submissão de teste' } });
  fireEvent.change(message, {
    target: { value: 'Conteúdo sintético para testar uma falha.' },
  });
  mockFetch.mockResolvedValueOnce(
    response({ error: 'Envio indisponível.' }, false),
  );

  fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
  expect(await screen.findByText('Envio indisponível.')).toBeVisible();
  expect(name).toHaveValue('Submissão de teste');
  expect(message).toHaveValue('Conteúdo sintético para testar uma falha.');
  expectNoTestimonials();
});
