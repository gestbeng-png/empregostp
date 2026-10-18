import {
  buildAnswersSnapshot,
  buildCandidateSnapshot,
  buildJobSnapshot,
  deepFreeze,
  selectSharedContacts,
} from '@/domain/applications/snapshot';
import { JOB_INTERNAL_FIELDS } from '@/domain/jobs/internalFields';

const SENSITIVE = {
  dateOfBirth: '1990-01-01',
  birthDate: '1990-01-01',
  gender: 'F',
  photoUrl: 'https://x/photo.jpg',
  salaryExpectation: 9000,
  salaryExpectationMinor: 900000,
  address: 'Rua 1',
  morada: 'Rua 1',
  nationality: 'ST',
  idDocument: 'BI-123',
  documents: { bi: 'x' },
  religion: 'x',
};

const user = {
  fullName: 'Maria Costa',
  email: 'maria@example.st',
  phone: '+2399912345',
  userType: 'candidato',
  ...SENSITIVE,
};
const profile = {
  headline: 'Contabilista',
  bio: 'Resumo profissional',
  city: 'São Tomé',
  experience: [
    {
      cargo: 'Contabilista',
      empresa: 'Banco X',
      inicio: '2020-01',
      atual: true,
      descricao: 'Fecho de contas',
      salario: 12000,
    },
    {},
  ],
  education: [{ nivel: 'LICENCIATURA', instituicao: 'USTP', curso: 'Gestão' }],
  skillsHard: 'Excel, SNC; Excel',
  languages: [{ idioma: 'Francês', nivel: 'INTERMEDIO' }, 'Inglês'],
  certifications: [{ nome: 'SNC', entidade: 'OTOC' }],
  cvUrl: 'cvUrl/u1/cv.pdf',
  ...SENSITIVE,
};

describe('F2.4 — snapshot do candidato (allowlist, sem SENSITIVE)', () => {
  const snapshot = buildCandidateSnapshot({
    user,
    profile,
    district: 'agua-grande',
    contacts: { email: 'maria@example.st' },
  });

  test('copia o perfil profissional', () => {
    expect(snapshot.fullName).toBe('Maria Costa');
    expect(snapshot.headline).toBe('Contabilista');
    expect(snapshot.district).toBe('agua-grande');
    expect(snapshot.experiences).toEqual([
      {
        title: 'Contabilista',
        organizationName: 'Banco X',
        location: '',
        startDate: '2020-01',
        endDate: '',
        current: true,
        description: 'Fecho de contas',
      },
    ]);
    expect(snapshot.education[0]).toMatchObject({
      level: 'LICENCIATURA',
      institution: 'USTP',
      field: 'Gestão',
    });
    expect(snapshot.skills).toEqual(['Excel', 'SNC']);
    expect(snapshot.languages).toEqual([
      { language: 'Francês', level: 'INTERMEDIO' },
      { language: 'Inglês', level: '' },
    ]);
    expect(snapshot.certifications).toEqual([{ name: 'SNC', issuer: 'OTOC' }]);
  });

  test('nunca copia campos sensíveis nem o salário de experiências', () => {
    const serialized = JSON.stringify(snapshot);
    for (const value of [
      '1990-01-01',
      'photo.jpg',
      'Rua 1',
      'BI-123',
      '12000',
      '900000',
    ])
      expect(serialized).not.toContain(value);
    for (const key of Object.keys(SENSITIVE))
      expect(serialized).not.toContain(`"${key}"`);
  });

  test('o snapshot congelado não muda quando o perfil muda depois', () => {
    const mutable = {
      ...profile,
      experience: [...profile.experience] as Record<string, unknown>[],
    };
    const frozen = deepFreeze(
      buildCandidateSnapshot({
        user,
        profile: mutable,
        district: null,
        contacts: {},
      }),
    );
    mutable.experience.push({ cargo: 'Outro' });
    (mutable as Record<string, unknown>).headline = 'Mudou';
    expect(frozen.headline).toBe('Contabilista');
    expect(frozen.experiences).toHaveLength(1);
    expect(Object.isFrozen(frozen.experiences[0])).toBe(true);
  });
});

describe('F2.5 — contactos partilhados', () => {
  const available = {
    email: 'a@x.st',
    emailVerified: true,
    phone: '+2399912345',
    phoneVerified: false,
  };
  test('por defeito, só o verificado', () => {
    expect(selectSharedContacts(available, null)).toEqual({ email: 'a@x.st' });
  });
  test('o candidato escolhe; WhatsApp usa o telemóvel da conta', () => {
    expect(selectSharedContacts(available, ['phone', 'whatsapp'])).toEqual({
      phone: '+2399912345',
      whatsapp: '+2399912345',
    });
  });
  test('nunca partilha contactos que a conta não tem', () => {
    expect(
      selectSharedContacts({ emailVerified: true, phoneVerified: false }, [
        'phone',
      ]),
    ).toEqual({});
  });
  test('escolha vazia recai no contacto verificado (a empresa precisa de um)', () => {
    expect(selectSharedContacts(available, [])).toEqual({ email: 'a@x.st' });
  });
});

describe('F2.4 — snapshot da vaga e das respostas', () => {
  test('a vaga entra sem campos internos nem dados operacionais', () => {
    const job: Record<string, unknown> = {
      titulo: 'Contabilista',
      descricao: 'Descrição',
      dataFecho: '2026-11-15',
      companyId: 'owner-uid',
      views: 99,
      applicationCount: 3,
      moderationStatus: 'x',
    };
    for (const field of JOB_INTERNAL_FIELDS) job[field] = 'segredo';
    const snapshot = buildJobSnapshot('job1', job, 'v3');
    expect(snapshot).toMatchObject({
      jobId: 'job1',
      jobVersionId: 'v3',
      titulo: 'Contabilista',
      dataFecho: '2026-11-15',
    });
    expect(JSON.stringify(snapshot)).not.toContain('segredo');
    for (const key of [
      'companyId',
      'views',
      'applicationCount',
      'moderationStatus',
    ])
      expect(snapshot).not.toHaveProperty(key);
  });

  test('respostas só com ids e valores simples', () => {
    expect(
      buildAnswersSnapshot([
        { questionId: 'q1', value: true },
        { id: 'q2', answer: ['A', 'B', 'A'] },
        { questionId: 'q3', value: { evil: true } },
        { value: 'sem id' },
        'lixo',
      ]),
    ).toEqual([
      { questionId: 'q1', value: true },
      { questionId: 'q2', value: ['A', 'B'] },
      { questionId: 'q3', value: '' },
    ]);
  });
});
