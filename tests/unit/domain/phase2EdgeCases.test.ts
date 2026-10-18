import {
  buildCandidateSnapshot,
  buildJobSnapshot,
  selectSharedContacts,
} from '@/domain/applications/snapshot';
import { planJobExpand } from '@/domain/jobs/expand';
import { readJobLifecycle } from '@/domain/jobs/legacyView';
import { evaluateJobSubmission } from '@/domain/jobs/submission';
import { permissionRoleOf } from '@/domain/permissions/legacyRole';

const timestamp = (iso: string) => ({ toDate: () => new Date(iso) });

describe('casos-limite de datas legadas', () => {
  test('snapshot aceita Timestamp, Date, Date inválida e texto', () => {
    const snapshot = buildCandidateSnapshot({
      user: { name: 'Rui' },
      profile: {
        experience: [
          {
            title: 'A',
            startDate: timestamp('2020-01-01T00:00:00Z'),
            endDate: new Date('2021-01-01T00:00:00Z'),
          },
          {
            title: 'B',
            startDate: new Date('invalid'),
            endDate: { toDate: () => 'não é data' },
          },
          { title: 'C', from: 2019, current: true },
        ],
        education: 'Licenciatura em Gestão pela USTP',
        skills: 'Excel\nWord',
        languages: 'não é lista',
      },
      district: null,
      contacts: {},
    });
    expect(snapshot.fullName).toBe('Rui');
    expect(snapshot.experiences.map((e) => [e.startDate, e.endDate])).toEqual([
      ['2020-01-01T00:00:00.000Z', '2021-01-01T00:00:00.000Z'],
      ['', ''],
      ['2019', ''],
    ]);
    expect(snapshot.educationText).toBe('Licenciatura em Gestão pela USTP');
    expect(snapshot.education).toEqual([]);
    expect(snapshot.skills).toEqual(['Excel', 'Word']);
    expect(snapshot.languages).toEqual([]);
  });

  test('snapshot da vaga converte Timestamp e copia objetos simples', () => {
    const snapshot = buildJobSnapshot(
      'j',
      {
        applicationDeadline: timestamp('2026-11-15T23:59:59.999Z'),
        requiredDocuments: { cv: true },
        descricao: null,
        titulo: () => 'x',
      },
      null,
    );
    expect(snapshot).toEqual({
      schemaVersion: 1,
      jobId: 'j',
      jobVersionId: null,
      applicationDeadline: '2026-11-15T23:59:59.999Z',
      requiredDocuments: { cv: true },
    });
  });

  test('sem contacto verificado e sem escolha: telemóvel verificado é o recurso', () => {
    expect(
      selectSharedContacts(
        {
          email: 'a@x.st',
          emailVerified: false,
          phone: '+2399912345',
          phoneVerified: true,
        },
        [],
      ),
    ).toEqual({ phone: '+2399912345' });
  });

  test('leitura legada e expand com datas inválidas ou ausentes', () => {
    expect(
      readJobLifecycle({
        expiresAt: new Date('invalid'),
        applicationDeadline: 'não é data',
      }),
    ).toMatchObject({
      expiresAt: null,
      applicationDeadline: null,
    });
    expect(
      readJobLifecycle({
        applicationDeadline: '2026-12-01T10:00:00Z',
      }).applicationDeadline?.toISOString(),
    ).toBe('2026-12-01T10:00:00.000Z');
    expect(
      readJobLifecycle({
        applicationMethod: 'EXTERNAL_URL',
        organizationId: 'org',
      }),
    ).toMatchObject({
      applicationMethod: 'EXTERNAL_URL',
      organizationId: 'org',
    });
    expect(
      planJobExpand({
        createdAt: timestamp('2017-01-01T00:00:00Z'),
        salarioDe: '2000000',
      }).fields.salaryNeedsReview,
    ).toBe(false);
    expect(
      planJobExpand({ createdAt: new Date('invalid'), salarioAte: '5000' })
        .fields,
    ).toMatchObject({
      salaryType: 'FIXED',
      salaryMinMinor: 500000,
      salaryMaxMinor: 500000,
    });
    expect(
      planJobExpand({
        createdAt: 'lixo',
        salarioDe: '9000',
        salarioAte: '4000',
      }).review,
    ).toContain('SALARY_RANGE_INVALID');
    expect(
      planJobExpand({ vagasDisponiveis: '9999' }).fields.vacanciesCount,
    ).toBe(1);
  });
});

describe('papéis legados (D2)', () => {
  test.each([
    [{ userType: 'admin' }, 'ADMIN'],
    [{ userType: 'candidato', platformRole: 'MODERATOR' }, 'MODERATOR'],
    [{ platformRole: 'SUPPORT' }, 'SUPPORT'],
    [{ userType: 'empresa' }, 'OWNER'],
    [{ userType: 'candidato' }, 'CANDIDATE'],
    [{ userType: 'outro', platformRole: 'ROOT' }, 'NONE'],
  ])('%p → %s', (user, role) => {
    expect(permissionRoleOf(user)).toBe(role);
  });
});

describe('avaliador de submissão — ramos', () => {
  test('existentes com Date/Timestamp/sem data, publicação e listas em texto', () => {
    const result = evaluateJobSubmission({
      payload: {
        titulo: 'Rececionista',
        descricao: 'Hotel procura rececionista. '.repeat(15),
        responsabilidades: '- Check-in; - Check-out; - Reservas',
        requisitos: '1) Francês\n2) Inglês',
        palavrasChave: 'Atendimento, Francês, Reservas',
        localizacao: 'Neves',
        remoto: false,
        tipoContrato: 'Tempo Integral',
        salarioDe: '6000',
        dataFecho: '2026-11-30',
      },
      company: { verificationLevel: 'CONTACT_VERIFIED' },
      companyCreatedAt: null,
      existingJobs: [
        {
          id: 'a',
          titulo: 'Rececionista',
          status: 'active',
          district: 'caue',
          createdAt: new Date('2026-10-01'),
        },
        {
          id: 'b',
          title: 'Outro',
          status: 'draft',
          createdAt: timestamp('2026-10-02T00:00:00Z'),
        },
        { id: 'c', titulo: 'Mais um', status: 'pending_review' },
      ],
      platformModerationForced: false,
      now: new Date('2026-10-10T00:00:00Z'),
    });
    expect(result.decision).toEqual({ kind: 'PUBLISH' });
  });
});
