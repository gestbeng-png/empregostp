import { render, screen } from '@testing-library/react';

import VagaDetalhe, { getServerSideProps } from '../../../pages/vaga/[id]';

const mockFlagEnabled = jest.fn();
const mockJobs = new Map<string, Record<string, unknown>>();
const mockWrites: string[] = [];

jest.mock(
  '../../../infrastructure/firebase/marketplace/FirestoreFeatureFlags',
  () => ({
    FirestoreFeatureFlags: jest.fn().mockImplementation(() => ({
      enabled: (...args: unknown[]) => mockFlagEnabled(...args),
    })),
  }),
);

jest.mock('../../../lib/empresaPlanFeatures', () => ({
  getEmpresaPlanSummary: () => ({ features: {} }),
}));

jest.mock('../../../lib/firebaseAdmin', () => {
  const docRef = (collection: string, id: string) => ({
    id,
    get: async () => ({
      id,
      ref: docRef(collection, id),
      exists: collection === 'jobs' && mockJobs.has(id),
      data: () => (collection === 'jobs' ? mockJobs.get(id) : undefined),
    }),
    update: async () => {
      mockWrites.push(`${collection}/${id}`);
    },
  });
  const firestore = () => ({
    collection: (collection: string) => ({
      doc: (id: string) => docRef(collection, id),
      orderBy: () => ({
        limit: () => ({
          get: async () => ({
            docs: [...mockJobs.entries()].map(([id, data]) => ({
              id,
              ref: docRef('jobs', id),
              data: () => data,
            })),
          }),
        }),
      }),
    }),
    getAll: async () => [],
  });
  return {
    admin: Object.assign(
      { firestore },
      { firestore: Object.assign(firestore, { FieldValue: {} }) },
    ),
  };
});

jest.mock('../../../hooks/useAutoDraft', () => ({
  __esModule: true,
  default: () => ({
    clearDraft: jest.fn(),
    hasDraft: false,
    isOnline: true,
    lastSavedAt: '',
    status: 'idle',
  }),
}));
jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: null, loading: false }),
}));
jest.mock('firebase/auth', () => ({ getAuth: () => ({ currentUser: null }) }));
jest.mock('../../../components/PublicPageShell', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));
jest.mock('../../../components/UpgradeModal', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../components/forms/AutoSaveStatus', () => ({
  __esModule: true,
  default: () => null,
}));

const baseJob = {
  titulo: 'Contabilista Sénior',
  descricao: '<p>Contabilidade geral.</p>',
  localizacao: 'São Tomé',
  tipoContrato: 'Tempo integral',
  companyName: 'Empresa Exemplo',
  categoria: 'Contabilidade e Finanças',
  createdAt: '2026-08-01T00:00:00.000Z',
  dataFecho: '2026-12-31',
};

function context(id: string) {
  return { params: { id }, res: { statusCode: 200 } } as never;
}

beforeEach(() => {
  mockJobs.clear();
  mockWrites.length = 0;
  mockFlagEnabled.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('/vaga/[id] com V2_SEO_PAGES desligada (comportamento atual)', () => {
  beforeEach(() => mockFlagEnabled.mockResolvedValue(false));

  it('vaga fechada continua a dar 404 e não há JSON-LD', async () => {
    mockJobs.set('job-closed', { ...baseJob, status: 'closed' });
    mockJobs.set('job-open', { ...baseJob, status: 'active' });

    await expect(getServerSideProps(context('job-closed'))).resolves.toEqual({
      notFound: true,
    });
    const open = (await getServerSideProps(context('job-open'))) as {
      props: Record<string, unknown>;
    };
    expect(open.props.jsonLd).toBeUndefined();
    expect(open.props.publicPage).toBeUndefined();
  });
});

describe('/vaga/[id] com V2_SEO_PAGES ligada (F8.5/F8.6)', () => {
  beforeEach(() => mockFlagEnabled.mockResolvedValue(true));

  it('vaga aberta: 200, indexável, com JobPosting', async () => {
    mockJobs.set('job-open', { ...baseJob, status: 'active' });
    const result = (await getServerSideProps(context('job-open'))) as {
      props: {
        jsonLd: string;
        publicPage: { kind: string; indexable: boolean };
      };
    };
    expect(result.props.publicPage).toMatchObject({
      kind: 'OPEN',
      indexable: true,
    });
    const posting = JSON.parse(result.props.jsonLd);
    expect(posting).toMatchObject({
      '@type': 'JobPosting',
      title: 'Contabilista Sénior',
      employmentType: 'FULL_TIME',
      directApply: true,
      url: 'https://empregostp.com/vaga/job-open',
    });
    expect(posting.baseSalary).toBeUndefined();
  });

  it('vaga encerrada: 200 com aviso, sem JSON-LD, nunca 404', async () => {
    mockJobs.set('job-closed', {
      ...baseJob,
      status: 'closed',
      closedAt: '2026-10-01T10:00:00.000Z',
    });
    const ctx = context('job-closed') as { res: { statusCode: number } };
    const result = (await getServerSideProps(ctx as never)) as {
      props: { jsonLd?: string; publicPage: Record<string, unknown> };
    };
    expect(ctx.res.statusCode).toBe(200);
    expect(result.props.jsonLd).toBeUndefined();
    expect(result.props.publicPage).toMatchObject({
      kind: 'CLOSED',
      closedAt: '2026-10-01T10:00:00.000Z',
    });
  });

  it('vaga rejeitada por fraude: 410', async () => {
    mockJobs.set('job-fraud', { ...baseJob, status: 'rejected' });
    const ctx = context('job-fraud') as { res: { statusCode: number } };
    const result = (await getServerSideProps(ctx as never)) as {
      props: Record<string, unknown>;
    };
    expect(ctx.res.statusCode).toBe(410);
    expect(result.props).toMatchObject({ vaga: null, gone: true });
  });

  it('rascunho nunca público: 404', async () => {
    mockJobs.set('job-draft', { ...baseJob, status: 'draft' });
    await expect(getServerSideProps(context('job-draft'))).resolves.toEqual({
      notFound: true,
    });
  });
});

describe('aviso de vaga encerrada', () => {
  beforeEach(() => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({}) }) as typeof fetch;
  });

  it('mostra a data em formato de STP, liga a semelhantes e bloqueia a candidatura', () => {
    render(
      <VagaDetalhe
        vaga={{ ...baseJob, id: 'job-closed', status: 'closed' }}
        publicPage={
          {
            kind: 'CLOSED',
            indexable: true,
            closedAt: '2026-10-01T10:00:00.000Z',
          } as never
        }
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'Esta vaga encerrou em 1 out. 2026',
    );
    expect(
      screen.getByRole('link', {
        name: 'Ver vagas semelhantes e criar alerta',
      }),
    ).toHaveAttribute(
      'href',
      '/vagas?categoria=Contabilidade%20e%20Finan%C3%A7as',
    );
    for (const button of screen.getAllByRole('button', {
      name: /Vaga encerrada/,
    }))
      expect(button).toBeDisabled();
  });

  it('vaga retirada mostra mensagem própria', () => {
    render(<VagaDetalhe vaga={null} gone />);
    expect(
      screen.getByRole('heading', { name: 'Esta vaga foi retirada' }),
    ).toBeInTheDocument();
  });

  it('uma vaga antiga com carta obrigatória não anuncia acesso pago nem prioridade', () => {
    render(
      <VagaDetalhe
        vaga={{
          ...baseJob,
          id: 'old-paid-job',
          status: 'active',
          dataFecho: '2999-01-01',
          premiumOnly: true,
          earlyAccessHours: 72,
          earlyAccessUntil: '2999-01-01T00:00:00Z',
          requireCoverLetter: true,
        }}
      />,
    );
    expect(
      screen.getByText('Carta de apresentação obrigatória'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/a carta escrita por si são gratuitas/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Fluxo premium de candidatura'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/apenas para candidatos Profissional e Premium/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/prioridade adicional na triagem/),
    ).not.toBeInTheDocument();
  });
});
