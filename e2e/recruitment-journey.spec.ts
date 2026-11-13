import { expect, test } from '@playwright/test';

import { loginAs, qaApi, qaUnavailableReason, requireBaseURL } from './qa-auth';

/**
 * Percurso de recrutamento do lado da empresa (secções 5 e 10).
 *
 * Âmbito deliberado: este teste **não publica** a vaga. Publicar dispara
 * `broadcastNewJob`, que escreve uma notificação a todos os candidatos ativos
 * da plataforma — contra o Firestore real isso significaria avisar pessoas
 * reais de uma vaga de teste. Por isso cobre-se aqui tudo o que não precisa de
 * publicação: a barreira de qualidade, a entrada em revisão, a invisibilidade
 * pública enquanto não for aprovada, a recusa de candidaturas a uma vaga que
 * não está aberta, e as fronteiras de autorização entre empresas.
 *
 * O passo que falta (aprovação pelo admin → candidatura → mudança de estado →
 * o candidato vê a atualização) precisa de um ambiente onde a difusão não
 * atinja utilizadores reais.
 *
 * Tudo o que cria leva o prefixo `[QA TESTE]` e é apagado no fim, mesmo que um
 * passo falhe.
 */

const JOB_TITLE = `[QA TESTE] Auditoria ${Date.now()}`;

let jobId = '';
let skipReason: string | null = null;

test.describe.configure({ mode: 'serial' });

test.beforeAll(() => {
  skipReason =
    qaUnavailableReason('empresa_pro') ??
    qaUnavailableReason('candidato_basico');
});

test.afterAll(async ({ playwright, baseURL }) => {
  if (!jobId) return;
  // Limpeza pela API, com a sessão da empresa dona. Corre mesmo que o percurso
  // tenha falhado a meio.
  const context = await playwright.request.newContext({ baseURL });
  try {
    const { qaIdToken } = await import('./qa-auth');
    const token = await qaIdToken('empresa_pro');
    const response = await context.fetch(`${baseURL}/api/jobs/${jobId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      failOnStatusCode: false,
    });
    // eslint-disable-next-line no-console
    console.log(`[limpeza] DELETE /api/jobs/${jobId} -> ${response.status()}`);
  } finally {
    await context.dispose();
  }
});

const COMPLETE_JOB = {
  descricao:
    'Registo criado automaticamente pela auditoria técnica do EmpregoSTP para validar, de ponta a ponta, o percurso de recrutamento da plataforma: publicação da vaga, entrada no catálogo público, submissão de candidatura pelo candidato, leitura dessa candidatura pela empresa e fecho da vaga. Não corresponde a nenhuma oferta de emprego real e não deve ser respondido por candidatos. O registo é removido automaticamente no fim da execução dos testes.',
  responsabilidades: [
    'Validar o fluxo de publicação de vagas da plataforma.',
    'Confirmar a sincronização entre a empresa e o candidato.',
    'Registar o resultado da auditoria técnica.',
  ].join('\n'),
  requisitos: [
    'Registo de teste, sem requisitos reais.',
    'Nenhuma candidatura real é esperada.',
  ].join('\n'),
  palavrasChave: 'auditoria, testes, qualidade',
  salarioDe: '10000',
  salarioAte: '15000',
  localizacao: 'Água Grande',
  tipoContrato: 'Tempo inteiro',
  categoria: 'Tecnologia',
  vagasDisponiveis: 1,
  remoto: false,
};

function closingDate(): string {
  return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

test('uma vaga incompleta é recusada com a lista do que falta', async ({
  context,
  page,
  baseURL,
}) => {
  test.skip(Boolean(skipReason), skipReason ?? '');
  await loginAs(context, 'empresa_pro', requireBaseURL(baseURL));
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const thin = await qaApi(page, 'empresa_pro', '/api/jobs', {
    method: 'POST',
    body: {
      titulo: `${JOB_TITLE} incompleta`,
      descricao: 'Curta demais.',
      requisitos: 'Nenhum.',
      localizacao: 'Água Grande',
      tipoContrato: 'Tempo inteiro',
      dataFecho: closingDate(),
    },
  });

  expect(thin.status, 'uma vaga pobre não pode ser aceite').toBe(422);
  const body = thin.body as {
    error?: { code?: string };
    missing?: Array<{ criterion?: string }>;
  };
  expect(body.error?.code).toBe('JOB_QUALITY_TOO_LOW');
  // A recusa tem de explicar o que falta, não só dizer que não.
  expect((body.missing ?? []).length).toBeGreaterThan(0);
});

test('uma vaga completa de organização não verificada entra em revisão', async ({
  context,
  page,
  baseURL,
}) => {
  test.skip(Boolean(skipReason), skipReason ?? '');
  await loginAs(context, 'empresa_pro', requireBaseURL(baseURL));
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const created = await qaApi(page, 'empresa_pro', '/api/jobs', {
    method: 'POST',
    body: { ...COMPLETE_JOB, titulo: JOB_TITLE, dataFecho: closingDate() },
  });
  expect(
    [200, 201],
    `criação devolveu ${created.status}: ${JSON.stringify(created.body).slice(0, 300)}`,
  ).toContain(created.status);

  const payload = created.body as { job?: { id?: string }; id?: string };
  jobId = String(payload.job?.id ?? payload.id ?? '');
  expect(jobId, 'a resposta da criação não trouxe o id da vaga').not.toEqual(
    '',
  );

  // Interligação 1: uma vaga por rever não entra no catálogo público.
  const publicList = await page.request.get('/api/jobs/active', {
    failOnStatusCode: false,
  });
  expect(publicList.status()).toBe(200);
  const listBody = (await publicList.json()) as {
    jobs?: Array<{ id?: string }>;
  };
  expect(
    (listBody.jobs ?? []).some((job) => job.id === jobId),
    'uma vaga ainda por rever apareceu no catálogo público',
  ).toBe(false);

  // Interligação 2: a empresa dona vê-a na sua própria lista.
  const mine = await qaApi(page, 'empresa_pro', '/api/jobs');
  expect(mine.status).toBe(200);
  expect(
    JSON.stringify(mine.body).includes(jobId),
    'a empresa não vê a vaga que acabou de criar',
  ).toBe(true);
});

test('ninguém se candidata a uma vaga que não está aberta', async ({
  context,
  page,
  baseURL,
}) => {
  test.skip(Boolean(skipReason) || !jobId, skipReason ?? 'vaga não criada');
  await loginAs(context, 'candidato_basico', requireBaseURL(baseURL));
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // A regra tem de viver no servidor: o candidato conhece o id na mesma.
  const applied = await qaApi(page, 'candidato_basico', '/api/applications', {
    method: 'POST',
    body: { jobId, coverLetter: 'Candidatura de teste da auditoria técnica.' },
  });
  expect(
    [400, 403, 404, 409, 422],
    `vaga por rever aceitou candidatura: ${applied.status}`,
  ).toContain(applied.status);
});

test('uma empresa terceira não lê nem altera a vaga de outra', async ({
  context,
  page,
  baseURL,
}) => {
  test.skip(Boolean(skipReason) || !jobId, skipReason ?? 'vaga não criada');
  await loginAs(context, 'empresa_basica', requireBaseURL(baseURL));
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const stolenList = await qaApi(
    page,
    'empresa_basica',
    `/api/applications?jobId=${jobId}`,
  );
  expect(
    [401, 403, 404],
    `empresa alheia leu candidaturas: ${stolenList.status}`,
  ).toContain(stolenList.status);

  const hijack = await qaApi(page, 'empresa_basica', `/api/jobs/${jobId}`, {
    method: 'PUT',
    body: { titulo: '[QA TESTE] alterada por outra empresa' },
  });
  expect(
    [401, 403, 404],
    `empresa alheia alterou a vaga: ${hijack.status}`,
  ).toContain(hijack.status);
});

test('uma vaga por rever não pode ser "fechada" nem some do catálogo', async ({
  context,
  page,
  baseURL,
}) => {
  test.skip(Boolean(skipReason) || !jobId, skipReason ?? 'vaga não criada');
  await loginAs(context, 'empresa_pro', requireBaseURL(baseURL));
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // Fechar tem endpoint próprio e exige o resultado do processo (F1.9).
  const semResultado = await qaApi(
    page,
    'empresa_pro',
    `/api/jobs/${jobId}/close`,
    { method: 'POST', body: {} },
  );
  expect(
    [400, 422],
    `fecho sem resultado devolveu ${semResultado.status}`,
  ).toContain(semResultado.status);

  // E uma vaga que nunca chegou a abrir não transita para "fechada": o
  // processo não existiu. Quem desiste dela apaga-a.
  const closed = await qaApi(page, 'empresa_pro', `/api/jobs/${jobId}/close`, {
    method: 'POST',
    body: { closeOutcome: 'POSITION_CANCELLED' },
  });
  expect(closed.status).toBe(400);
  expect((closed.body as { error?: { code?: string } }).error?.code).toBe(
    'INVALID_TRANSITION',
  );

  // Em todo o caso, continua fora do catálogo público.
  const publicList = await page.request.get('/api/jobs/active', {
    failOnStatusCode: false,
  });
  const listBody = (await publicList.json()) as {
    jobs?: Array<{ id?: string }>;
  };
  expect(
    (listBody.jobs ?? []).some((job) => job.id === jobId),
    'a vaga por rever apareceu no catálogo público',
  ).toBe(false);
});
