import {
  normalizeCompanyProfileJob,
  normalizeCompanyWebsite,
  prepareCompanyProfileJobs,
} from '../../../lib/publicCompanyProfile';
import { filterPublicJobsByCompany } from '../../../lib/publicJob';

describe('perfil público de empresa', () => {
  test('normaliza os campos reais da vaga apresentados no cartão', () => {
    const job = normalizeCompanyProfileJob({
      id: 'job-1',
      titulo: 'Engenheiro de software',
      status: 'active',
      salarioDe: '12000',
      salarioAte: '18000',
      remoto: true,
      nivelExperiencia: 'Sénior (5+ anos)',
      vagasDisponiveis: 3,
      dataFecho: '2026-09-30',
      createdAt: '2026-07-20T10:00:00.000Z',
    });

    expect(job).toMatchObject({
      id: 'job-1',
      title: 'Engenheiro de software',
      salaryMin: '12000',
      salaryMax: '18000',
      modality: 'Remoto',
      experience: 'Sénior (5+ anos)',
      vacancyCount: 3,
      deadline: '2026-09-30T00:00:00.000Z',
    });
  });

  test('mantém a contagem total mesmo quando limita os cartões renderizados', () => {
    const rawJobs = Array.from({ length: 15 }, (_, index) => ({
      id: `job-${index}`,
      titulo: `Vaga ${index}`,
      status: 'active',
      dataFecho: '2026-12-31',
      createdAt: `2026-07-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`,
    }));

    const result = prepareCompanyProfileJobs(rawJobs, {
      limit: 12,
      now: new Date('2026-07-28T12:00:00.000Z'),
    });

    expect(result.activeJobCount).toBe(15);
    expect(result.jobs).toHaveLength(12);
    expect(result.jobs.at(0)?.id).toBe('job-14');
  });

  test('não inclui vagas fechadas ou expiradas na contagem ativa', () => {
    const result = prepareCompanyProfileJobs(
      [
        {
          id: 'active',
          status: 'active',
          dataFecho: '2026-07-29',
        },
        {
          id: 'closed',
          status: 'closed',
          dataFecho: '2026-07-29',
        },
        {
          id: 'expired',
          status: 'active',
          dataFecho: '2026-07-27',
        },
      ],
      { now: new Date('2026-07-28T12:00:00.000Z') },
    );

    expect(result.activeJobCount).toBe(1);
    expect(result.jobs.map((job) => job.id)).toEqual(['active']);
  });

  test('normaliza sites sem protocolo e rejeita esquemas inseguros', () => {
    expect(normalizeCompanyWebsite('empresa.st')).toBe('https://empresa.st/');
    expect(normalizeCompanyWebsite('http://empresa.st/sobre')).toBe(
      'http://empresa.st/sobre',
    );
    expect(normalizeCompanyWebsite('javascript:alert(1)')).toBe('');
  });

  test('filtra a listagem pública pela empresa pedida na URL', () => {
    const jobs = [
      { id: 'a', companyId: 'empresa-1' },
      { id: 'b', companyId: 'empresa-2' },
      { id: 'c', companyId: 'empresa-1' },
    ];

    expect(filterPublicJobsByCompany(jobs, 'empresa-1')).toEqual([
      { id: 'a', companyId: 'empresa-1' },
      { id: 'c', companyId: 'empresa-1' },
    ]);
    expect(filterPublicJobsByCompany(jobs, '')).toBe(jobs);
  });
});
