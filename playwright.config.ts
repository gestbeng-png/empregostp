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
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
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
        command: `npm run dev -- --port ${port}`,
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
        timeout: 120_000,
        url: baseURL,
      },
});
