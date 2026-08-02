import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

import { createDefaultCandidateSettings } from '../domain/candidate-settings/CandidateSettings';

import {
  e2eAdmin,
  e2eCandidate,
  e2eCompany,
  e2ePublicGuide,
  e2ePublicJob,
  e2ePublicPost,
} from './fixtures';

const projectId = 'empregostp';

export default async function globalSetup(): Promise<void> {
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
  if (!authHost || !firestoreHost) {
    return;
  }

  await clearEmulator(
    `http://${authHost}/emulator/v1/projects/${projectId}/accounts`,
  );
  await clearEmulator(
    `http://${firestoreHost}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
  );

  const app = initializeApp({ projectId }, `playwright-${Date.now()}`);
  try {
    await getAuth(app).createUser({
      displayName: e2eAdmin.name,
      email: e2eAdmin.email,
      emailVerified: true,
      password: e2eAdmin.password,
      uid: e2eAdmin.uid,
    });
    await getAuth(app).createUser({
      displayName: e2eCandidate.name,
      email: e2eCandidate.email,
      emailVerified: true,
      password: e2eCandidate.password,
      uid: e2eCandidate.uid,
    });
    await getAuth(app).createUser({
      displayName: e2eCompany.name,
      email: e2eCompany.email,
      emailVerified: true,
      password: e2eCompany.password,
      uid: e2eCompany.uid,
    });

    const firestore = getFirestore(app);
    await firestore.collection('users').doc(e2eAdmin.uid).set({
      createdAt: new Date().toISOString(),
      email: e2eAdmin.email,
      name: e2eAdmin.name,
      status: 'active',
      userType: 'admin',
    });
    await firestore.collection('users').doc(e2eCandidate.uid).set({
      createdAt: new Date().toISOString(),
      currentPlan: 'professional_candidato',
      email: e2eCandidate.email,
      name: e2eCandidate.name,
      planEndDate: null,
      planId: 'professional_candidato',
      planName: 'Profissional',
      planTierId: 'professional_candidato',
      userType: 'candidato',
      verificationStatus: 'verified',
      verified: true,
    });
    await firestore.collection('users').doc(e2eCompany.uid).set({
      companyName: e2eCompany.name,
      createdAt: new Date().toISOString(),
      currentPlan: 'basic_empresa',
      email: e2eCompany.email,
      industry: 'Serviços profissionais',
      location: 'São Tomé',
      name: e2eCompany.name,
      planName: 'Gratuito',
      planTierId: 'basic_empresa',
      userType: 'empresa',
    });
    await firestore
      .collection('profiles')
      .doc(e2eCandidate.uid)
      .set({
        email: e2eCandidate.email,
        location: 'São Tomé',
        name: e2eCandidate.name,
        settings: createDefaultCandidateSettings(),
        skills: ['Comunicação', 'Organização'],
        title: 'Profissional de operações',
        userType: 'candidato',
      });

    await firestore
      .collection('jobs')
      .doc('e2e-company-job')
      .set({
        companyId: e2eCompany.uid,
        companyName: e2eCompany.name,
        createdAt: new Date('2029-01-03T10:00:00.000Z'),
        dataAbertura: new Date('2029-01-03T10:00:00.000Z'),
        dataFecho: '2030-12-31T23:59:59.000Z',
        descricao: 'Acompanhar processos administrativos e operacionais.',
        empresaNome: e2eCompany.name,
        localizacao: 'São Tomé',
        status: 'active',
        tipoContrato: 'full-time',
        titulo: 'Assistente de operações',
      });
    await firestore
      .collection('applications')
      .doc('e2e-company-application')
      .set({
        appliedAt: new Date('2029-01-04T10:00:00.000Z'),
        candidateEmail: e2eCandidate.email,
        candidateId: e2eCandidate.uid,
        candidateName: e2eCandidate.name,
        companyId: e2eCompany.uid,
        jobId: 'e2e-company-job',
        jobTitle: 'Assistente de operações',
        status: 'pending',
      });

    await firestore
      .collection('jobs')
      .doc('e2e-admin-job')
      .set({
        applicationCount: 1,
        categoria: 'Gestão e Administração',
        companyId: '',
        companyName: 'Empresa Parceira E2E',
        companySource: 'external',
        createdAt: new Date('2029-01-06T10:00:00.000Z'),
        createdBy: e2eAdmin.uid,
        createdByRole: 'admin',
        currency: 'STN',
        dataAbertura: '2029-01-06',
        dataFecho: '2030-12-31',
        descricao: 'Coordenar processos administrativos e operacionais.',
        empresaNome: 'Empresa Parceira E2E',
        isExternalCompany: true,
        localizacao: 'São Tomé',
        requisitos: 'Experiência em coordenação e boa comunicação.',
        salarioAte: 12000,
        salarioDe: 9000,
        status: 'active',
        tipoContrato: 'Tempo Integral',
        titulo: 'Coordenador administrativo',
      });
    await firestore
      .collection('applications')
      .doc('e2e-admin-application')
      .set({
        appliedAt: new Date('2029-01-07T10:00:00.000Z'),
        candidateEmail: e2eCandidate.email,
        candidateId: e2eCandidate.uid,
        candidateName: e2eCandidate.name,
        companyId: '',
        jobId: 'e2e-admin-job',
        jobTitle: 'Coordenador administrativo',
        status: 'pending',
      });
    await firestore
      .collection('hrServiceRequests')
      .doc('e2e-hr-request')
      .set({
        adminResponse: '',
        companyEmail: e2eCompany.email,
        companyId: e2eCompany.uid,
        companyName: e2eCompany.name,
        createdAt: new Date('2029-01-05T10:00:00.000Z'),
        description:
          'Precisamos de apoio para organizar a triagem inicial de candidaturas.',
        documents: [
          {
            label: 'Descrição da função',
            url: 'https://example.com/descricao-funcao',
          },
        ],
        resultDocuments: [],
        serviceType: 'Triagem de candidatos',
        status: 'pending',
        title: 'Triagem para assistente de operações',
        updatedAt: new Date('2029-01-05T10:00:00.000Z'),
      });

    await firestore
      .collection('jobs')
      .doc(e2ePublicJob.id)
      .set({
        createdAt: new Date().toISOString(),
        dataAbertura: new Date().toISOString(),
        dataFecho: '2030-12-31T23:59:59.000Z',
        descricao: 'Apoie a organização das operações e a melhoria contínua.',
        empresaNome: 'Empresa E2E',
        localizacao: 'São Tomé',
        nivelExperiencia: 'Júnior (0-2 anos)',
        palavrasChave: ['Organização', 'Comunicação'],
        requisitos: ['Organização', 'Boa comunicação'],
        responsabilidades: ['Acompanhar processos operacionais'],
        salarioAte: 9000,
        salarioDe: 6000,
        status: 'active',
        tipoContrato: 'full-time',
        titulo: e2ePublicJob.title,
      });

    await firestore
      .collection('posts')
      .doc(e2ePublicPost.id)
      .set({
        author: 'EmpregoSTP',
        category: 'Carreira',
        content:
          'Uma candidatura clara começa por informação objetiva.\n\nOrganize o conteúdo essencial\nApresente experiência, competências e disponibilidade com frases simples.\nDestaque apenas o que é relevante para a função.',
        createdAt: new Date('2029-01-02T10:00:00.000Z'),
        excerpt: 'Passos práticos para apresentar experiência e competências.',
        featured: true,
        image: '',
        readTime: '4 min',
        status: 'published',
        title: e2ePublicPost.title,
      });
    await firestore
      .collection('posts')
      .doc('e2e-secondary-post')
      .set({
        author: 'EmpregoSTP',
        category: 'Mercado',
        createdAt: new Date('2029-01-01T10:00:00.000Z'),
        excerpt: 'Uma leitura breve sobre oportunidades no mercado nacional.',
        image: '',
        readTime: '3 min',
        status: 'published',
        title: 'Oportunidades no mercado nacional',
      });
    await firestore
      .collection('posts')
      .doc('e2e-tertiary-post')
      .set({
        author: 'EmpregoSTP',
        category: 'Carreira',
        createdAt: new Date('2028-12-31T10:00:00.000Z'),
        excerpt: 'Conselhos para organizar experiência e competências no CV.',
        image: '/assets/home/cta-candidate.webp',
        readTime: '5 min',
        status: 'published',
        title: 'Gestão e currículo eficaz',
      });
    await firestore
      .collection('news')
      .doc('e2e-news')
      .set({
        category: 'Novidade',
        createdAt: new Date('2029-01-02T12:00:00.000Z'),
        date: '02/01/2029',
        status: 'published',
        title: 'Novos conteúdos disponíveis',
      });
    await firestore.collection('resources_guides').doc(e2ePublicGuide.id).set({
      category: 'Entrevistas',
      content:
        '## Antes da entrevista\n- Reveja a descrição da função.\n- Prepare exemplos concretos.\n\n## Durante a conversa\n- Responda com clareza.\n- Faça perguntas relevantes.',
      description:
        'Passos simples para preparar e conduzir uma boa entrevista.',
      pages: 4,
      readTime: '5 min',
      title: e2ePublicGuide.title,
    });
  } finally {
    await deleteApp(app);
  }
}

async function clearEmulator(url: string): Promise<void> {
  const response = await fetch(url, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(`Não foi possível preparar o emulador: ${response.status}`);
  }
}
