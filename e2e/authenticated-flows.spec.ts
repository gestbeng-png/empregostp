import { expect, test, type APIRequestContext } from '@playwright/test';

import {
  e2eCandidate,
  e2eCompanyPro,
  e2eProApplication,
  e2eProJob,
} from './fixtures';

/**
 * Jornadas autenticadas que faltavam à suite (AUD-021/item 13):
 * favoritos, mensagens, entrevistas.
 *
 * Estas operações são exercidas com sessões Firebase reais obtidas no Auth
 * Emulator e enviadas contra o servidor da aplicação. Cobrem, portanto, o
 * mesmo caminho que o browser percorre — verificação de token, carregamento de
 * `users/{uid}`, gating de plano e escrita no Firestore — sem depender de
 * seletores visuais que mudam com o design. O passo final de favoritos
 * confirma na UI que o estado chegou ao painel do candidato.
 */

const EMULATOR_KEY = 'e2e-emulator-key';

async function signIn(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<string> {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const response = await request.post(
    `http://${host}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${EMULATOR_KEY}`,
    { data: { email, password, returnSecureToken: true } },
  );
  expect(response.status(), `login falhou para ${email}`).toBe(200);
  const body = await response.json();
  expect(body.idToken, `sem idToken para ${email}`).toBeTruthy();
  return body.idToken as string;
}

function authed(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

test.describe('jornadas autenticadas por perfil', () => {
  test.skip(
    !process.env.FIREBASE_AUTH_EMULATOR_HOST ||
      !process.env.FIRESTORE_EMULATOR_HOST,
    'Estas jornadas requerem Auth e Firestore Emulators.',
  );

  test('favoritos: guardar, listar, ver no painel e remover', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'A jornada muta uma fixture partilhada e corre num só projeto.',
    );

    const token = await signIn(
      request,
      e2eCandidate.email,
      e2eCandidate.password,
    );

    // Estado inicial: sem esta vaga guardada.
    const before = await request.get('/api/saved-jobs', {
      headers: authed(token),
    });
    expect(before.status()).toBe(200);
    const beforeIds = ((await before.json()).savedJobs || []).map(
      (job: { id?: string; jobId?: string }) => job.jobId ?? job.id,
    );
    expect(beforeIds).not.toContain(e2eProJob.id);

    // Guardar.
    const save = await request.post('/api/saved-jobs', {
      data: { jobId: e2eProJob.id },
      headers: authed(token),
    });
    expect([200, 201]).toContain(save.status());

    // Aparece na listagem da API.
    const after = await request.get('/api/saved-jobs', {
      headers: authed(token),
    });
    expect(after.status()).toBe(200);
    const afterIds = ((await after.json()).savedJobs || []).map(
      (job: { id?: string; jobId?: string }) => job.jobId ?? job.id,
    );
    expect(afterIds).toContain(e2eProJob.id);

    // E chega à UI do candidato.
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Email').fill(e2eCandidate.email);
    await page.getByLabel('Senha').fill(e2eCandidate.password);
    await page
      .getByRole('button', { name: 'Iniciar sessão', exact: true })
      .click();
    await expect(page).toHaveURL(/\/dashboard\/candidato(?:\?|$)/, {
      timeout: 20_000,
    });
    await page
      .getByRole('button', { name: 'Vagas guardadas', exact: true })
      .click();
    await expect(page.getByText(e2eProJob.title).first()).toBeVisible({
      timeout: 20_000,
    });

    // Remover, deixando a fixture como estava.
    // A rota lê `jobId` do corpo, não da query string (pages/api/saved-jobs.js:156).
    const remove = await request.delete('/api/saved-jobs', {
      data: { jobId: e2eProJob.id },
      headers: authed(token),
    });
    expect(remove.status()).toBe(200);
    const final = await request.get('/api/saved-jobs', {
      headers: authed(token),
    });
    const finalIds = ((await final.json()).savedJobs || []).map(
      (job: { id?: string; jobId?: string }) => job.jobId ?? job.id,
    );
    expect(finalIds).not.toContain(e2eProJob.id);
  });

  test('mensagens: empresa paga inicia conversa e o candidato lê-a', async ({
    request,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'A jornada muta uma fixture partilhada e corre num só projeto.',
    );

    const companyToken = await signIn(
      request,
      e2eCompanyPro.email,
      e2eCompanyPro.password,
    );

    const created = await request.post('/api/messages', {
      data: { participantId: e2eCandidate.uid },
      headers: authed(companyToken),
    });
    expect(
      [200, 201],
      `criar conversa devolveu ${created.status()}: ${await created.text()}`,
    ).toContain(created.status());
    const conversation = await created.json();
    const conversationId =
      conversation.conversationId ?? conversation.id ?? conversation.conversation?.id;
    expect(conversationId).toBeTruthy();

    // O corpo esperado é `{ text }` (pages/api/messages/[conversationId].js:61).
    const sent = await request.post(`/api/messages/${conversationId}`, {
      data: { text: 'Mensagem de auditoria E2E.' },
      headers: authed(companyToken),
    });
    expect(
      [200, 201],
      `enviar devolveu ${sent.status()}: ${await sent.text()}`,
    ).toContain(sent.status());

    // O candidato vê a conversa e a mensagem.
    const candidateToken = await signIn(
      request,
      e2eCandidate.email,
      e2eCandidate.password,
    );
    const list = await request.get('/api/messages', {
      headers: authed(candidateToken),
    });
    expect(list.status()).toBe(200);
    const conversations = (await list.json()).conversations || [];
    expect(
      conversations.some(
        (item: { id?: string }) => item.id === conversationId,
      ),
    ).toBe(true);

    const thread = await request.get(`/api/messages/${conversationId}`, {
      headers: authed(candidateToken),
    });
    expect(thread.status()).toBe(200);
    const messages = (await thread.json()).messages || [];
    // O campo persistido é `text`, o mesmo do POST.
    expect(
      messages.some((m: { text?: string; content?: string }) =>
        String(m.text ?? m.content ?? '').includes('Mensagem de auditoria E2E.'),
      ),
      `mensagens recebidas: ${JSON.stringify(messages).slice(0, 300)}`,
    ).toBe(true);
  });

  test('entrevistas: empresa agenda e o candidato confirma', async ({
    request,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'A jornada muta uma fixture partilhada e corre num só projeto.',
    );

    const companyToken = await signIn(
      request,
      e2eCompanyPro.email,
      e2eCompanyPro.password,
    );

    const scheduledAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    // A rota lê campos planos, não um objeto `interviewDetails`
    // (pages/api/applications/[id]/status.js:108).
    const scheduled = await request.put(
      `/api/applications/${e2eProApplication.id}/status`,
      {
        data: {
          interviewDate: scheduledAt,
          interviewLink: 'https://meet.example.test/auditoria-e2e',
          interviewMode: 'online',
          interviewNotes: 'Entrevista criada pela auditoria E2E.',
          status: 'interview',
        },
        headers: authed(companyToken),
      },
    );
    expect(
      scheduled.status(),
      `agendar devolveu ${scheduled.status()}: ${await scheduled.text()}`,
    ).toBe(200);

    // Data inválida tem de dar 4xx, nunca 500 (regressão do AUD-014).
    const invalid = await request.put(
      `/api/applications/${e2eProApplication.id}/status`,
      {
        data: {
          interviewDate: 'nao-e-uma-data',
          interviewMode: 'online',
          status: 'interview',
        },
        headers: authed(companyToken),
      },
    );
    expect(invalid.status()).toBeGreaterThanOrEqual(400);
    expect(invalid.status()).toBeLessThan(500);

    // O candidato confirma a presença.
    const candidateToken = await signIn(
      request,
      e2eCandidate.email,
      e2eCandidate.password,
    );
    const confirmed = await request.post(
      `/api/applications/${e2eProApplication.id}/interview-response`,
      {
        data: { action: 'confirm' },
        headers: authed(candidateToken),
      },
    );
    expect(
      confirmed.status(),
      `confirmar devolveu ${confirmed.status()}: ${await confirmed.text()}`,
    ).toBe(200);

    // E consegue exportar o calendário sem 400 (regressão do AUD-014).
    const ics = await request.get(
      `/api/applications/${e2eProApplication.id}/interview-ics`,
      { headers: authed(candidateToken) },
    );
    expect(ics.status()).toBe(200);
    expect(await ics.text()).toContain('BEGIN:VCALENDAR');
  });

  test('gating: empresa no plano básico não envia mensagens nem agenda', async ({
    request,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'Corre num só projeto por consistência com as restantes jornadas.',
    );

    const { e2eCompany } = await import('./fixtures');
    const basicToken = await signIn(
      request,
      e2eCompany.email,
      e2eCompany.password,
    );

    const message = await request.post('/api/messages', {
      data: { participantId: e2eCandidate.uid },
      headers: authed(basicToken),
    });
    expect(message.status()).toBeGreaterThanOrEqual(400);
    expect(message.status()).toBeLessThan(500);

    const interview = await request.put(
      '/api/applications/e2e-company-application/status',
      {
        data: {
          interviewDate: new Date(Date.now() + 86_400_000).toISOString(),
          interviewMode: 'online',
          status: 'interview',
        },
        headers: authed(basicToken),
      },
    );
    expect(interview.status()).toBeGreaterThanOrEqual(400);
    expect(interview.status()).toBeLessThan(500);
  });
});
