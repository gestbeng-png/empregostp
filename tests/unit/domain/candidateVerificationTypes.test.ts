import {
  buildCandidateVisibility,
  getCandidateVerification,
} from '../../../lib/candidateProfileInsights';
import { buildVerificationRecord } from '../../../lib/candidateVerification';

const strongProfile = {
  name: 'Ana Silva',
  email: 'ana@example.com',
  phone: '+239 991 1111',
  verified: false,
};

const strongCandidateProfile = {
  headline: 'Engenheira de software',
  city: 'São Tomé',
  bio: 'Profissional com experiência comprovada em desenvolvimento de produtos digitais e trabalho em equipa.',
  objectiveArea: 'Tecnologia',
  skillsHard: ['JavaScript', 'React', 'Node.js'],
  experience: [
    {
      company: 'Empresa STP',
      role: 'Engenheira',
      period: '2023 - 2025',
      description: 'Desenvolvimento de aplicações web.',
    },
  ],
  education: 'Licenciatura em Engenharia Informática',
  cvUrl: 'https://example.com/cv.pdf',
};

describe('tipos públicos de verificação', () => {
  test('não transforma tipos aprovados antigos em novo pedido', () => {
    const previousRecord = {
      verificationItems: {
        identity: {
          type: 'identity',
          status: 'approved',
          requested: true,
          checklist: [],
          evidence: [],
        },
        certificates: {
          type: 'certificates',
          status: 'approved',
          requested: true,
          checklist: [],
          evidence: [],
        },
      },
    };

    const record = buildVerificationRecord({
      uid: 'candidate-1',
      documents: {
        requestedTypes: ['experience'],
        experienceSummary: 'Experiência recente',
        cvDocument: { url: 'https://example.com/cv.pdf', fileName: 'cv.pdf' },
      },
      userData: {
        email: 'candidate@example.com',
        phone: '+239 991 1111',
        cvUrl: 'https://example.com/cv.pdf',
      },
      previousRecord,
    });

    expect(record.verificationItems.identity.status).toBe('approved');
    expect(record.verificationItems.certificates.status).toBe('approved');
    expect(record.verificationItems.experience.status).toBe('pending');
    expect(record.summary.pendingCount).toBe(1);
  });

  test('atribui alta qualificação aprovada sem exigir plano pago', () => {
    const verification = getCandidateVerification(
      {
        ...strongProfile,
        verificationMethod: 'competencies',
        verificationStatus: 'verified',
        verificationType: 'qualified',
      },
      strongCandidateProfile,
    );

    expect(verification.qualified).toBe(true);
    expect(verification.paid).toBe(false);
    expect(verification.types).toEqual(['qualified']);
  });

  test('uma aprovação antiga não aprova automaticamente a nova modalidade', () => {
    const record = buildVerificationRecord({
      uid: 'candidate-1',
      verificationMethod: 'competencies',
      documents: {
        requestedTypes: ['competencies'],
        competencyNotes: 'Desenvolvimento de aplicações e gestão de projetos.',
        experienceSummary: 'Cinco anos de experiência profissional em sistemas web.',
        portfolioUrl: 'https://example.com/portfolio',
      },
      userData: strongProfile,
      profileData: strongCandidateProfile,
      previousRecord: {
        verificationMethod: 'paid',
        verificationItems: {
          competencies: {
            type: 'competencies',
            status: 'approved',
            requested: true,
            evidence: [],
            checklist: [],
          },
        },
      },
    });

    expect(record.verificationItems.competencies.status).toBe('pending');
    expect(record.summary.pendingCount).toBe(1);
    expect(record.summary.publicVerified).toBe(false);
  });

  test('preserva o selo pago sem atribuir automaticamente outro selo', () => {
    const verification = getCandidateVerification(
      { ...strongProfile, verified: true, verificationType: 'paid' },
      strongCandidateProfile,
    );

    expect(verification.types).toEqual(['paid']);
    expect(
      buildCandidateVisibility(
        { ...strongProfile, verified: true },
        strongCandidateProfile,
      ),
    ).toMatchObject({
      verified: true,
      paidVerified: true,
      qualifiedVerified: false,
    });
  });

  test('não chama um perfil incompleto de altamente qualificado', () => {
    const verification = getCandidateVerification(strongProfile, {
      headline: 'Profissional',
      skillsHard: ['Excel'],
    });

    expect(verification.qualified).toBe(false);
    expect(verification.types).toEqual([]);
  });
});
