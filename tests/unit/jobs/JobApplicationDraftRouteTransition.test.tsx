import { act, render, waitFor } from '@testing-library/react';

import VagaDetalhe from '../../../pages/vaga/[id]';

// O que é gravado hoje. `coverLetter` à solta é o formato antigo, ainda
// aceite em `onRestore` para não perder rascunhos já guardados.
type ApplicationDraft = {
  assessmentAnswers: Array<number | null>;
  applicationForm: { coverLetter: string };
};

type ApplicationDraftLegado = {
  assessmentAnswers: Array<number | null>;
  coverLetter: string;
};

type AutoDraftOptions = {
  onRestore: (draft: ApplicationDraftLegado) => void;
  ready: boolean;
  resourceId: string;
  value: ApplicationDraft;
};

const mockUseAutoDraft = jest.fn();
const mockClearDraft = jest.fn().mockResolvedValue(true);
const mockGetIdToken = jest.fn().mockResolvedValue('candidate-token');
const candidateUser = {
  getIdToken: mockGetIdToken,
  uid: 'candidate-1',
};

jest.mock('../../../hooks/useAutoDraft', () => ({
  __esModule: true,
  default: (options: AutoDraftOptions) => mockUseAutoDraft(options),
}));

jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: candidateUser }),
}));

jest.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: candidateUser }),
}));

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

const buildJob = (id: string, questionCount: number) => ({
  companyName: `Empresa ${id}`,
  dataAbertura: '2026-08-01T00:00:00.000Z',
  dataFecho: '2026-09-01T00:00:00.000Z',
  descricao: `Descrição da ${id}`,
  id,
  localizacao: 'São Tomé',
  requireCoverLetter: true,
  requisitos: 'Experiência relevante',
  skillsAssessment: {
    enabled: true,
    passingScore: 70,
    questions: Array.from({ length: questionCount }, (_, index) => ({
      id: `${id}-question-${index + 1}`,
      options: ['Opção A', 'Opção B'],
      prompt: `Pergunta ${index + 1}`,
    })),
  },
  status: 'active',
  tipoContrato: 'Tempo integral',
  titulo: `Vaga ${id}`,
});

function getDraftCalls() {
  return mockUseAutoDraft.mock.calls.map(
    ([options]) => options as AutoDraftOptions,
  );
}

describe('rascunho da candidatura ao navegar entre vagas', () => {
  beforeEach(() => {
    mockUseAutoDraft.mockReset().mockReturnValue({
      clearDraft: mockClearDraft,
      hasDraft: false,
      isOnline: true,
      lastSavedAt: '',
      status: 'idle',
    });
    mockClearDraft.mockClear();
    mockGetIdToken.mockClear();
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({
        applications: [],
        profile: {
          data: { plan: 'profissional', userType: 'candidato' },
        },
        savedJobs: [],
      }),
      ok: true,
    }) as typeof fetch;
  });

  test('só ativa o rascunho da nova vaga depois de reinicializar o formulário', async () => {
    const jobA = buildJob('job-a', 1);
    const jobB = buildJob('job-b', 2);
    const { rerender } = render(
      <VagaDetalhe relatedJobs={[]} referenceNow={Date.now()} vaga={jobA} />,
    );

    await waitFor(() => {
      expect(
        getDraftCalls().some(
          (call) => call.resourceId === 'job-a' && call.ready,
        ),
      ).toBe(true);
    });

    const jobAOptions = getDraftCalls()
      .filter((call) => call.resourceId === 'job-a' && call.ready)
      .at(-1);
    if (!jobAOptions) throw new Error('Rascunho da vaga A não inicializado');

    act(() => {
      jobAOptions.onRestore({
        assessmentAnswers: [1],
        coverLetter: 'Carta pertencente à vaga A',
      });
    });

    await waitFor(() => {
      expect(
        getDraftCalls().some(
          (call) =>
            call.resourceId === 'job-a' &&
            call.value.applicationForm.coverLetter ===
              'Carta pertencente à vaga A',
        ),
      ).toBe(true);
    });

    const callsBeforeNavigation = mockUseAutoDraft.mock.calls.length;
    rerender(
      <VagaDetalhe relatedJobs={[]} referenceNow={Date.now()} vaga={jobB} />,
    );

    await waitFor(() => {
      expect(
        getDraftCalls().some(
          (call) => call.resourceId === 'job-b' && call.ready,
        ),
      ).toBe(true);
    });

    const jobBCalls = getDraftCalls().slice(callsBeforeNavigation);
    expect(
      jobBCalls.some(
        (call) =>
          !call.ready &&
          call.value.applicationForm.coverLetter ===
            'Carta pertencente à vaga A',
      ),
    ).toBe(true);

    const readyJobBCalls = jobBCalls.filter(
      (call) => call.resourceId === 'job-b' && call.ready,
    );
    expect(readyJobBCalls).not.toHaveLength(0);
    readyJobBCalls.forEach((call) => {
      expect(call.value.assessmentAnswers).toEqual([null, null]);
      // O que interessa aqui é a não-contaminação: nada da vaga A pode
      // sobreviver à navegação para a vaga B.
      expect(call.value.applicationForm.coverLetter).toBe('');
    });

    const jobBOptions = readyJobBCalls.at(-1);
    if (!jobBOptions) throw new Error('Rascunho da vaga B não inicializado');

    act(() => {
      jobBOptions.onRestore({
        assessmentAnswers: [0, 1],
        coverLetter: 'Carta pertencente à vaga B',
      });
    });

    await waitFor(() => {
      expect(
        getDraftCalls().some(
          (call) =>
            call.resourceId === 'job-b' &&
            call.ready &&
            call.value.applicationForm.coverLetter ===
              'Carta pertencente à vaga B' &&
            call.value.assessmentAnswers.join(',') === '0,1',
        ),
      ).toBe(true);
    });
  });
});
