import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    '!./lib/fixtures/**', // ไฟล์ข้อมูลที่สร้างด้วยสคริปต์ ไม่ใช่ markup
    '!./lib/icons.ts',
  ],
  corePlugins: { preflight: false }, // ห้าม reset ทับหน้าตาของ styles/prototype.css
  // class เดิมของ prototype ที่ชื่อชนกับ utility ของ Tailwind (เช่นปุ่ม .btn.outline) ห้ามให้ Tailwind สร้างทับ
  blocklist: ['outline'],
  theme: { extend: {} },
  plugins: [],
};

export default config;
