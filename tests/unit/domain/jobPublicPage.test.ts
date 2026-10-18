import type { JobPostingSource } from '@/domain/jobs/publicPage';
import {
  buildJobPostingJsonLd,
  resolvePublicJobPage,
  serializeJsonLd,
} from '@/domain/jobs/publicPage';

const now = new Date('2026-10-08T10:00:00Z');
const day = 86_400_000;

describe('F8.6 — resposta da URL de uma vaga', () => {
  it.each([
    ['active', 'OPEN', 200, true, true],
    ['closed', 'CLOSED', 200, true, false],
    ['inactive', 'PAUSED', 200, false, false],
    ['rejected', 'GONE', 410, false, false],
    ['disabled', 'GONE', 410, false, false],
    ['draft', 'NOT_FOUND', 404, false, false],
    ['pending_review', 'NOT_FOUND', 404, false, false],
    ['estado_estranho', 'NOT_FOUND', 404, false, false],
  ])(
    'legado %s → %s %i (index %s, json-ld %s)',
    (legacyStatus, kind, httpStatus, indexable, jsonLd) => {
      expect(
        resolvePublicJobPage({
          legacyStatus,
          closedAt: new Date(now.getTime() - day),
          now,
        }),
      ).toEqual({ kind, httpStatus, indexable, jsonLd });
    },
  );

  it.each([
    ['PUBLISHED', 'OPEN', 200],
    ['EXPIRED', 'CLOSED', 200],
    ['FILLED', 'CLOSED', 200],
    ['ARCHIVED', 'ARCHIVED', 200],
    ['REJECTED', 'GONE', 410],
    ['PENDING_REVIEW', 'NOT_FOUND', 404],
  ])(
    'v2 %s tem prioridade sobre o legado → %s',
    (v2Status, kind, httpStatus) => {
      expect(
        resolvePublicJobPage({
          v2Status,
          legacyStatus: 'active',
          closedAt: null,
          now,
        }),
      ).toMatchObject({ kind, httpStatus });
    },
  );

  it('vaga encerrada deixa de ser indexável 30 dias depois do fecho', () => {
    const recent = resolvePublicJobPage({
      legacyStatus: 'closed',
      closedAt: new Date(now.getTime() - 29 * day),
      now,
    });
    const old = resolvePublicJobPage({
      legacyStatus: 'closed',
      closedAt: new Date(now.getTime() - 31 * day),
      now,
    });
    expect([recent.indexable, old.indexable]).toEqual([true, false]);
    expect(old.httpStatus).toBe(200);
  });

  it('nunca 404 para uma vaga que esteve pública', () => {
    for (const legacyStatus of ['active', 'closed', 'inactive']) {
      expect(
        resolvePublicJobPage({ legacyStatus, closedAt: null, now }).httpStatus,
      ).toBe(200);
    }
  });
});

const source: JobPostingSource = {
  id: 'vWI0Q3NiSICjjOhvKNvL',
  title: 'Gestor(a) de Redes Sociais',
  descriptionHtml: '<p>Gestão das redes sociais.</p>',
  publishedAt: new Date('2026-08-03T00:00:00Z'),
  validThrough: new Date('2026-10-21T23:59:59.999Z'),
  employmentType: 'Tempo integral',
  companyName: 'Djinola Marketing Digital',
  companyWebsite: 'https://djinola.st',
  location: 'São Tomé',
  remote: false,
  salaryFrom: '3500',
  salaryTo: '7000',
  salaryPeriod: 'MONTH',
  createdAt: new Date('2026-08-03T00:00:00Z'),
  url: 'https://empregostp.com/vaga/vWI0Q3NiSICjjOhvKNvL',
};

describe('F8.5 — JobPosting', () => {
  it('tem os campos obrigatórios com dados reais', () => {
    expect(buildJobPostingJsonLd(source)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'JobPosting',
      title: 'Gestor(a) de Redes Sociais',
      description: '<p>Gestão das redes sociais.</p>',
      identifier: {
        '@type': 'PropertyValue',
        name: 'EmpregoSTP',
        value: source.id,
      },
      url: source.url,
      directApply: true,
      datePosted: '2026-08-03T00:00:00.000Z',
      validThrough: '2026-10-21T23:59:59.999Z',
      employmentType: 'FULL_TIME',
      hiringOrganization: {
        '@type': 'Organization',
        name: 'Djinola Marketing Digital',
        sameAs: 'https://djinola.st',
      },
      jobLocation: {
        '@type': 'Place',
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'São Tomé',
          addressRegion: 'Água Grande',
          addressCountry: 'ST',
        },
      },
      baseSalary: {
        '@type': 'MonetaryAmount',
        currency: 'STN',
        value: {
          '@type': 'QuantitativeValue',
          minValue: 3500,
          maxValue: 7000,
          unitText: 'MONTH',
        },
      },
    });
  });

  it('sem período conhecido (legado) não inventa salário', () => {
    expect(
      buildJobPostingJsonLd({ ...source, salaryPeriod: null }).baseSalary,
    ).toBeUndefined();
  });

  it('salário suspeito de STD antiga é omitido', () => {
    expect(
      buildJobPostingJsonLd({
        ...source,
        salaryFrom: '3.500.000',
        salaryTo: '7.000.000',
      }).baseSalary,
    ).toBeUndefined();
  });

  it('localização ao nível do país: só o país, sem região inventada', () => {
    expect(
      buildJobPostingJsonLd({ ...source, location: 'São Tomé e Príncipe' })
        .jobLocation,
    ).toEqual({
      '@type': 'Place',
      address: { '@type': 'PostalAddress', addressCountry: 'ST' },
    });
  });

  it('remoto usa TELECOMMUTE', () => {
    const posting = buildJobPostingJsonLd({ ...source, remote: true });
    expect(posting.jobLocationType).toBe('TELECOMMUTE');
    expect(posting.jobLocation).toBeUndefined();
  });

  it('a serialização não permite fechar o <script>', () => {
    const json = serializeJsonLd({
      title: '</script><script>alert(1)</script>',
    });
    expect(json).not.toContain('</script>');
    expect(JSON.parse(json)).toEqual({
      title: '</script><script>alert(1)</script>',
    });
  });
});
