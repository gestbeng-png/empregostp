import { filterPublishedJobs } from '../../../lib/email/jobAlertEmail';

const jobs = [
  {
    id: 'remote-senior',
    titulo: 'Engenheiro',
    empresaNome: 'Acme',
    status: 'active',
    remoto: true,
    nivelExperiencia: 'Sénior',
  },
  {
    id: 'hybrid-junior',
    titulo: 'Designer',
    companyName: 'Studio Azul',
    status: 'active',
    modalidade: 'Híbrido',
    nivelExperiencia: 'Júnior',
  },
  {
    id: 'onsite-entry',
    titulo: 'Assistente',
    status: 'active',
    modalidade: 'Presencial',
    nivelExperiencia: 'Sem experiência',
  },
];

describe('filtros de alertas de vagas', () => {
  test('aplica modalidade e experiência guardadas no alerta', () => {
    expect(
      filterPublishedJobs(jobs, {
        modalidade: 'hibrido',
        experiencia: '1-3',
      }).map((job) => job.id),
    ).toEqual(['hybrid-junior']);

    expect(
      filterPublishedJobs(jobs, {
        modalidade: 'presencial',
        experiencia: 'sem',
      }).map((job) => job.id),
    ).toEqual(['onsite-entry']);
  });

  test('a pesquisa inclui o nome da empresa', () => {
    expect(
      filterPublishedJobs(jobs, { search: 'studio azul' }).map((job) => job.id),
    ).toEqual(['hybrid-junior']);
  });
});
