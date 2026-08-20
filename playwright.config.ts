import { defineConfig, devices } from '@playwright/test';

const port = 3100;
const configuredBaseURL = process.env.E2E_BASE_URL;
const baseURL = configuredBaseURL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
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
  webServer: configuredBaseURL
    ? undefined
    : {
        // O servidor de desenvolvimento compila a pedido e satura sob carga
        // paralela: em duas execuções desta suíte começou a devolver 500 e a
        // produzir falhas que não eram do produto. Com E2E_PRODUCTION_BUILD=1
        // corre-se contra um build real, que é o que a auditoria recomenda
        // para CI. Localmente o modo dev continua a ser o predefinido, por ser
        // muito mais rápido a arrancar.
        command: process.env.E2E_PRODUCTION_BUILD
          ? `npm run build && npx next start --port ${port}`
          : `npm run dev -- --port ${port}`,
        env: {
          ...process.env,
          NEXT_DIST_DIR: '.next-e2e',
          FIREBASE_AUTH_EMULATOR_HOST:
            process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099',
          FIREBASE_PROJECT_ID: 'empregostp',
          FIRESTORE_EMULATOR_HOST:
            process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080',
          GCLOUD_PROJECT: 'empregostp',
          GOOGLE_CLOUD_PROJECT: 'empregostp',
          NEXT_PUBLIC_USE_FIREBASE_EMULATORS: 'true',
          NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
          NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
        },
        reuseExistingServer: !process.env.CI,
        // Um build de produção demora mais a ficar de pé do que o dev server.
        timeout: process.env.E2E_PRODUCTION_BUILD ? 300_000 : 120_000,
        url: baseURL,
      },
});
