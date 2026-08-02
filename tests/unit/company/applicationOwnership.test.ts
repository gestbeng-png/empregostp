import {
  collectCompanyApplicationHistory,
  getCompanyIdFromRecord,
  resolveApplicationCompanyId,
} from '../../../lib/applicationOwnership';

describe('propriedade de candidaturas', () => {
  test('usa o companyId atual quando está presente', () => {
    expect(getCompanyIdFromRecord({ companyId: 'empresa-atual' })).toBe(
      'empresa-atual',
    );
    expect(
      resolveApplicationCompanyId(
        { companyId: 'empresa-atual' },
        { companyId: 'outra-empresa' },
      ),
    ).toBe('empresa-atual');
  });

  test('resolve candidaturas antigas através da vaga associada', () => {
    expect(
      resolveApplicationCompanyId({}, { createdBy: 'empresa-legada' }),
    ).toBe('empresa-legada');
    expect(
      resolveApplicationCompanyId({}, { empresaId: 'empresa-legada-pt' }),
    ).toBe('empresa-legada-pt');
  });

  test('não atribui uma candidatura sem qualquer prova de propriedade', () => {
    expect(resolveApplicationCompanyId({}, {})).toBeNull();
  });

  test('continua a paginar quando candidaturas mais recentes pertencem a outras empresas', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      id: `other-${index}`,
      companyId: 'outra-empresa',
      jobId: `other-job-${index}`,
    }));
    const secondPage = [
      {
        id: 'own-current',
        companyId: 'empresa-atual',
        jobId: 'current-job',
      },
      {
        id: 'own-legacy',
        jobId: 'legacy-own-job',
      },
      {
        id: 'other-legacy',
        jobId: 'legacy-other-job',
      },
      {
        id: 'conflicting-owner',
        companyId: 'outra-empresa',
        jobId: 'legacy-own-job',
      },
      {
        id: 'unattributed',
      },
    ];
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce({
        applications: firstPage,
        cursor: 'page-1',
        hasMore: true,
      })
      .mockResolvedValueOnce({
        applications: secondPage,
        cursor: 'page-2',
        hasMore: false,
      });
    const fetchJob = jest.fn(async (jobId: string) =>
      jobId === 'legacy-own-job'
        ? { createdBy: 'empresa-atual' }
        : { companyId: 'outra-empresa' },
    );

    const result = await collectCompanyApplicationHistory({
      companyId: 'empresa-atual',
      fetchPage,
      fetchJob,
    });

    expect(result.map((application: { id: string }) => application.id)).toEqual(
      ['own-current', 'own-legacy'],
    );
    expect(fetchPage).toHaveBeenNthCalledWith(1, null);
    expect(fetchPage).toHaveBeenNthCalledWith(2, 'page-1');
    expect(fetchJob).toHaveBeenCalledTimes(2);
    expect(fetchJob).toHaveBeenCalledWith('legacy-own-job');
    expect(fetchJob).toHaveBeenCalledWith('legacy-other-job');
  });

  test('resolve uma vaga legada apenas uma vez e respeita o limite pedido', async () => {
    const fetchPage = jest.fn().mockResolvedValue({
      applications: [
        { id: 'legacy-1', jobId: 'same-job' },
        { id: 'legacy-2', jobId: 'same-job' },
        { id: 'legacy-3', jobId: 'same-job' },
      ],
      cursor: null,
      hasMore: false,
    });
    const fetchJob = jest
      .fn()
      .mockResolvedValue({ employerId: 'empresa-atual' });

    const result = await collectCompanyApplicationHistory({
      companyId: 'empresa-atual',
      fetchPage,
      fetchJob,
      limit: 2,
    });

    expect(result.map((application: { id: string }) => application.id)).toEqual(
      ['legacy-1', 'legacy-2'],
    );
    expect(fetchJob).toHaveBeenCalledTimes(1);
  });
});
