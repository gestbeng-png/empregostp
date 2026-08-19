export const e2eCandidate = {
  email: 'candidato.e2e@empregostp.test',
  name: 'Candidata E2E',
  password: 'CandidateTest123!',
  uid: 'e2e-candidate',
} as const;

export const e2eCompany = {
  email: 'empresa.e2e@empregostp.test',
  name: 'Empresa E2E',
  password: 'CompanyTest123!',
  uid: 'e2e-company',
} as const;

export const e2eAdmin = {
  email: 'admin.e2e@empregostp.test',
  name: 'Administrador E2E',
  password: 'AdminTest123!',
  uid: 'e2e-admin',
} as const;

/**
 * Empresa com plano pago.
 *
 * `e2eCompany` está em `basic_empresa`, que por desenho NÃO pode enviar
 * mensagens diretas nem agendar entrevistas
 * (`lib/empresaPlanFeatures.js`: `canSendDirectMessages`/`canScheduleInterviews`
 * a false). As jornadas autenticadas de mensagens e entrevistas precisam de um
 * escalão que as inclua, por isso existe esta segunda empresa em vez de se
 * alterar a primeira — assim as suites existentes mantêm o gating que testam.
 */
export const e2eCompanyPro = {
  email: 'empresa-pro.e2e@empregostp.test',
  name: 'Empresa PRO E2E',
  password: 'CompanyProTest123!',
  uid: 'e2e-company-pro',
} as const;

/** Vaga da empresa paga, com candidatura da candidata E2E já associada. */
export const e2eProJob = {
  id: 'e2e-company-pro-job',
  title: 'Coordenadora de operações PRO',
} as const;

export const e2eProApplication = {
  id: 'e2e-company-pro-application',
} as const;

export const e2ePublicJob = {
  id: 'e2e-public-job',
  title: 'Especialista de operações',
} as const;

export const e2ePublicPost = {
  id: 'e2e-public-post',
  title: 'Como preparar uma candidatura clara',
} as const;

export const e2ePublicGuide = {
  id: 'e2e-public-guide',
  title: 'Guia para uma entrevista clara',
} as const;
