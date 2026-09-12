import { defineConfig, devices } from '@playwright/test';

/**
 * Two suites:
 *   offline — registry, storage, css engine, and a real unpacked-extension load.
 *             No network. This is what CI runs and what must always be green.
 *   live    — tests/selectors.spec.js, which loads real youtube.com to check
 *             that the selectors still match. Needs network; run it locally
 *             before a release (`npm run test:live`).
 *
 * Chromium: if a preinstalled binary is present, point at it rather than
 * downloading one — `PLAYWRIGHT_CHROMIUM_PATH=$(ls -d /opt/pw-browsers/chromium-*\/chrome-linux/chrome | head -1)`.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // YouTube rate-limits aggressive parallel loads
  workers: 2,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    },
  },
  projects: [
    {
      name: 'offline',
      testIgnore: /selectors\.spec\.js/,
    },
    {
      name: 'live',
      testMatch: /selectors\.spec\.js/,
    },
  ],
});
