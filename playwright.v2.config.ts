import { defineConfig } from '@playwright/test';

const baseURL = process.env.V2_AUDIT_BASE_URL;
if (!baseURL || process.env.V2_VISUAL_SEED_CONFIRMED !== '1') {
  throw new Error(
    'Defina V2_AUDIT_BASE_URL e V2_VISUAL_SEED_CONFIRMED=1 num staging com dados sintéticos determinísticos.',
  );
}
const host = new URL(baseURL).hostname;
if (['empregostp.com', 'www.empregostp.com'].includes(host)) {
  throw new Error('As baselines v2 não podem usar produção.');
}
if (
  !['localhost', '127.0.0.1', '[::1]'].includes(host) &&
  process.env.V2_AUDIT_ENVIRONMENT !== 'staging'
) {
  throw new Error('Confirme V2_AUDIT_ENVIRONMENT=staging para um host remoto.');
}

export default defineConfig({
  testDir: './e2e/v2',
  testMatch: '**/*.visual.ts',
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
  outputDir: 'test-results/v2',
  snapshotPathTemplate: '{testDir}/baselines/{projectName}/{arg}{ext}',
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.001, animations: 'disabled' },
  },
  use: {
    baseURL,
    contextOptions: { reducedMotion: 'reduce' },
    trace: 'off',
    video: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [1440, 1024, 390, 375, 360].map((width) => ({
    name: `chromium-${width}`,
    use: { browserName: 'chromium', viewport: { width, height: 900 } },
  })),
});
