import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // baseline = ภาพจาก prototype ที่ test ถ่ายเองทุกครั้ง (ไม่ commit)
  snapshotPathTemplate: '{testDir}/.legacy-shots/{arg}{ext}',
  timeout: 120_000,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    timezoneId: 'Asia/Bangkok',
    locale: 'th-TH',
    colorScheme: 'light',
    reducedMotion: 'reduce',
  },
  webServer: [
    {
      command: 'npx http-server legacy -p 4100 -c-1 -s',
      url: 'http://127.0.0.1:4100/index.html',
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: 'npx next dev -p 3100 -H 127.0.0.1',
      url: 'http://127.0.0.1:3100/login',
      reuseExistingServer: false,
      timeout: 180_000,
      env: { NEXT_PUBLIC_FIXTURES: '1' },
    },
  ],
});
