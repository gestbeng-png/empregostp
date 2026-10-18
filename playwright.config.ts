import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL;
if (!baseURL) {
  throw new Error('Defina E2E_BASE_URL para um ambiente de testes dedicado.');
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,
  workers: process.env.CI ? 2 : 4,
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    // `retain-on-failure` guardava trace e vídeo de cada falha. Com a suíte a
    // falhar em massa isso gerou 131 MB numa só execução e ajudou a esgotar o
    // disco, o que corrompeu o cache do Next e produziu HTTP 500 — falhas de
    // laboratório indistinguíveis de defeitos. `retain-on-first-failure` dá o
    // mesmo diagnóstico para o primeiro caso de cada tipo, sem o acumular.
    trace: 'retain-on-first-failure',
    video: process.env.PLAYWRIGHT_VIDEO === 'on' ? 'retain-on-failure' : 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
    },
  ],
});
