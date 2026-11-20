import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // baseline = ภาพของเว็บนี้เองที่ commit ไว้ (ตั้งใจเปลี่ยนหน้าตา → --update-snapshots=changed แล้วตรวจภาพด้วยตา)
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
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
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      // JST_CHAT_URL ว่าง = test ไม่เปิดแท็บ JST จริงตอนจอง/กดแชต (ใช้ทางคัดลอกชื่อแชตแบบเดิม)
      env: { NEXT_PUBLIC_FIXTURES: '1', NEXT_PUBLIC_JST_CHAT_URL: '' },
    },
  ],
});
