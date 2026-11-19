#!/usr/bin/env node
// แปลงไฟล์ prototype ใน legacy/ เป็น TypeScript ให้เว็บ Next.js ใช้ (ไฟล์ผลลัพธ์ห้ามแก้มือ รันใหม่ได้เสมอ)
//   node tools/port-legacy.mjs icons                      → lib/icons.ts
//   TZ=Asia/Bangkok node tools/port-legacy.mjs fixtures   → lib/fixtures/data.ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { runInNewContext } from 'node:vm';

function loadLegacy(file, key) {
  const window = {};
  runInNewContext(readFileSync(file, 'utf8'), { window }, { filename: file });
  if (!window[key]) throw new Error(`${file} did not set window.${key}`);
  return window[key];
}

function write(out, body) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, body);
  console.log(`wrote ${out} (${Buffer.byteLength(body)} bytes)`);
}

// เหมือน applyAuto ของ prototype (legacy/app.js L81-87) ที่รันใน route() ครั้งแรกของโหมดตัวอย่าง
function applyDemoAuto(data) {
  const reps = new Set(data.reps.map((r) => r.id));
  for (const c of data.campaigns.filter((x) => x.claimMode === 'auto')) {
    for (const l of data.leads.filter((x) => x.campaignId === c.id && !x.owner && !x.noCall && !x.autoSkip)) {
      const seller = l.purchases.find((p) => p.seller && reps.has(p.seller))?.seller || null;
      if (seller && !(l.releasedBy || []).includes(seller)) l.owner = seller;
    }
  }
  return data;
}

const what = process.argv[2];
if (what === 'icons') {
  const icons = loadLegacy('legacy/icons.js', 'DS_ICONS');
  write('lib/icons.ts',
    '/* สร้างจาก legacy/icons.js ด้วย `node tools/port-legacy.mjs icons` ห้ามแก้มือ */\n' +
    `export const DS_ICONS: Record<string, string> = ${JSON.stringify(icons, null, 1)};\n\n` +
    "export const iconSrc = (platform: string): string => DS_ICONS[platform] || DS_ICONS.other || '';\n");
} else if (what === 'fixtures') {
  if (new Date('2026-11-04T09:00:00').getTimezoneOffset() !== -420) {
    console.error('ต้องรันด้วย TZ=Asia/Bangkok (เช่น TZ=Asia/Bangkok node tools/port-legacy.mjs fixtures) ให้วันที่ตรงกับ prototype ที่ Playwright เปิดในเขตเวลา Asia/Bangkok');
    process.exit(1);
  }
  const data = applyDemoAuto(loadLegacy('legacy/data.js', 'DS_DATA'));
  write('lib/fixtures/data.ts',
    '/* สร้างจาก legacy/data.js (หลัง applyAuto ครั้งแรก) ด้วย `TZ=Asia/Bangkok node tools/port-legacy.mjs fixtures` ห้ามแก้มือ */\n' +
    "import type { FixtureData } from './types';\n\n" +
    `export const FIXTURE_DATA: FixtureData = ${JSON.stringify(data, null, 1)};\n`);
} else {
  console.error('usage: node tools/port-legacy.mjs icons|fixtures');
  process.exit(1);
}
