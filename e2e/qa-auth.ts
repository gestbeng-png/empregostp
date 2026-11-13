import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type { BrowserContext, Page } from '@playwright/test';

/**
 * Sessão autenticada para os E2E.
 *
 * Toda a suíte anterior era de visitante: nenhum percurso com sessão estava
 * coberto. As contas vêm de `scripts/qa-accounts.mjs`, que só cria endereços
 * `qa-*@empregostp.test` (domínio não encaminhável, RFC 2606) marcados com
 * `isTestAccount: true`.
 *
 * O cookie `token` é o próprio ID token do Firebase — é o que
 * `pages/api/auth/session.js` grava — por isso basta trocá-lo por sessão aqui
 * em vez de conduzir o formulário em cada teste. O formulário de login tem
 * cobertura própria em `login-form.spec.ts`; este atalho serve os percursos
 * que querem testar outra coisa.
 */

export type QaAccountKey =
  | 'candidato_basico'
  | 'candidato_premium'
  | 'empresa_basica'
  | 'empresa_pro'
  | 'admin';

interface QaAccount {
  uid: string;
  email: string;
  userType: string;
  planId: string;
}

interface QaRegistry {
  accounts: Partial<Record<QaAccountKey, QaAccount>>;
  password?: string;
}

const REGISTRY_PATH = path.join(
  process.cwd(),
  'docs',
  'audits',
  'qa-accounts.json',
);

let cachedRegistry: QaRegistry | null = null;

export function readQaRegistry(): QaRegistry | null {
  if (cachedRegistry) return cachedRegistry;
  if (!existsSync(REGISTRY_PATH)) return null;
  try {
    cachedRegistry = JSON.parse(
      readFileSync(REGISTRY_PATH, 'utf8'),
    ) as QaRegistry;
    return cachedRegistry;
  } catch {
    return null;
  }
}

export function qaAccount(key: QaAccountKey): QaAccount | null {
  return readQaRegistry()?.accounts?.[key] ?? null;
}

/** Explica porque é que um teste com sessão não pode correr, ou `null`. */
export function qaUnavailableReason(key: QaAccountKey): string | null {
  const registry = readQaRegistry();
  if (!registry) {
    return 'docs/audits/qa-accounts.json ausente — corre `node --import ./scripts/preloadEnv.mjs scripts/qa-accounts.mjs create`.';
  }
  if (!registry.password) return 'Registo de contas QA sem palavra-passe.';
  if (!registry.accounts?.[key]) return `Conta QA "${key}" não registada.`;
  if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    return 'NEXT_PUBLIC_FIREBASE_API_KEY em falta no ambiente do Playwright.';
  }
  return null;
}

/**
 * `baseURL` do Playwright já é garantido pela configuração (que rebenta sem
 * E2E_BASE_URL), mas o tipo continua opcional. Isto estreita-o sem usar `!`,
 * que o lint do projeto proíbe.
 */
export function requireBaseURL(baseURL: string | undefined): string {
  if (!baseURL) throw new Error('baseURL em falta: defina E2E_BASE_URL.');
  return baseURL;
}

/** Email e palavra-passe de uma conta QA, já validados. */
export function qaCredentials(key: QaAccountKey): {
  email: string;
  password: string;
} {
  const registry = readQaRegistry();
  const account = registry?.accounts?.[key];
  if (!registry?.password || !account) {
    throw new Error(`Conta QA "${key}" indisponível.`);
  }
  return { email: account.email, password: registry.password };
}

const tokenCache = new Map<QaAccountKey, { token: string; at: number }>();
// O ID token do Firebase dura 1 h; renovamos aos 40 min com folga larga.
const TOKEN_TTL_MS = 40 * 60 * 1000;

export async function qaIdToken(key: QaAccountKey): Promise<string> {
  const cached = tokenCache.get(key);
  if (cached && Date.now() - cached.at < TOKEN_TTL_MS) return cached.token;

  const registry = readQaRegistry();
  const account = registry?.accounts?.[key];
  if (!registry?.password || !account) {
    throw new Error(`Conta QA "${key}" indisponível.`);
  }
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) throw new Error('NEXT_PUBLIC_FIREBASE_API_KEY em falta.');

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: account.email,
        password: registry.password,
        returnSecureToken: true,
      }),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Autenticação QA falhou para ${account.email}: HTTP ${response.status}`,
    );
  }
  const payload = (await response.json()) as { idToken?: string };
  if (!payload.idToken) throw new Error('Resposta sem idToken.');

  tokenCache.set(key, { token: payload.idToken, at: Date.now() });
  return payload.idToken;
}

function originOf(baseURL: string): string {
  return new URL(baseURL).origin;
}

/** Põe o cookie de sessão no contexto, para a navegação já chegar autenticada. */
export async function loginAs(
  context: BrowserContext,
  key: QaAccountKey,
  baseURL: string,
): Promise<string> {
  const token = await qaIdToken(key);
  const { hostname, protocol } = new URL(baseURL);
  await context.addCookies([
    {
      name: 'token',
      value: token,
      domain: hostname,
      path: '/',
      httpOnly: true,
      secure: protocol === 'https:',
      sameSite: 'Lax',
    },
  ]);
  return token;
}

/** Limpa a sessão sem tocar no resto do estado do contexto. */
export async function logout(context: BrowserContext): Promise<void> {
  await context.clearCookies({ name: 'token' });
}

/**
 * Chamada autenticada à API, com o mesmo token da sessão do browser.
 * Devolve estado e corpo já descodificado quando é JSON.
 */
export async function qaApi(
  page: Page,
  key: QaAccountKey,
  pathname: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<{ status: number; body: unknown }> {
  const token = await qaIdToken(key);
  const baseURL = originOf(page.url());
  const response = await page.request.fetch(`${baseURL}${pathname}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
    ...(init.body ? { data: JSON.stringify(init.body) } : {}),
    failOnStatusCode: false,
  });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // Mantém o texto quando a resposta não é JSON (CSV, ICS, HTML de erro).
  }
  return { status: response.status(), body };
}
