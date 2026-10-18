import { buildCandidateApplicationView } from '@/application/applications/candidateApplicationView';

const at = (iso: string) => ({ toDate: () => new Date(iso) });

describe('candidateApplicationView — projeção segura para o candidato', () => {
  test('expõe apenas campos públicos e colapsa SHORTLISTED em Em análise', () => {
    const view = buildCandidateApplicationView(
      'app-1',
      {
        jobId: 'job-1',
        v2Status: 'SHORTLISTED',
        jobSnapshot: { titulo: 'Contabilista', companyName: 'Empresa STP' },
        internalNotes: 'não expor',
        rating: 5,
        tags: ['urgente'],
        interviewerFeedback: 'privado',
      },
      [
        { to: 'SUBMITTED', at: at('2026-10-01T09:00:00Z') },
        { to: 'UNDER_REVIEW', at: at('2026-10-02T09:00:00Z') },
        { to: 'SHORTLISTED', at: at('2026-10-03T09:00:00Z') },
      ],
      new Date('2026-10-04T09:00:00Z'),
    );

    expect(view).toEqual({
      applicationId: 'app-1',
      jobId: 'job-1',
      jobTitle: 'Contabilista',
      organizationName: 'Empresa STP',
      statusLabel: 'Em análise',
      canWithdraw: true,
      timeline: [
        { label: 'Recebida', date: '1 out. 2026', note: null },
        { label: 'Em análise', date: '2 out. 2026', note: null },
      ],
      silenceNotice: null,
    });
    expect(view).not.toHaveProperty('internalNotes');
    expect(view).not.toHaveProperty('rating');
  });

  test('inclui apenas nota explicitamente visível e aviso de silêncio', () => {
    const view = buildCandidateApplicationView(
      'app-2',
      {
        jobId: 'job-2',
        v2Status: 'INTERVIEW',
        jobSnapshot: { title: 'Assistente' },
      },
      [
        {
          to: 'INTERVIEW',
          at: at('2026-10-01T09:00:00Z'),
          candidateVisibleNote: 'Traga o seu CV impresso.',
          internalNote: 'avaliar pontualidade',
        },
      ],
      new Date('2026-10-23T09:00:00Z'),
    );

    expect(view.timeline).toEqual([
      {
        label: 'Entrevista',
        date: '1 out. 2026',
        note: 'Traga o seu CV impresso.',
      },
    ]);
    expect(view.silenceNotice).toBe(
      'Sem atualização desde 1 out. 2026 — a empresa ainda está a analisar.',
    );
  });

  test('não permite retirar candidatura em estado terminal', () => {
    const view = buildCandidateApplicationView(
      'app-3',
      { jobId: 'job-3', v2Status: 'REJECTED', closedReason: 'NOT_SELECTED' },
      [],
      new Date('2026-10-04T09:00:00Z'),
    );

    expect(view.statusLabel).toBe('Não selecionada');
    expect(view.canWithdraw).toBe(false);
  });
});
