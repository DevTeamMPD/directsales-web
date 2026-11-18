#!/usr/bin/env node
// ตรวจว่า production build ไม่มีข้อมูล fixture (Next.js spec ข้อ 6) — รันหลัง `npm run build` และก่อน `npm run test:e2e`
// (next dev ของ e2e เขียนทับ .next ด้วยไฟล์โหมด dev)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MARKERS = ['c-bebe-nov', 'c-host-nov', 'dev@fixtures.test']; // id แคมเปญตัวอย่างใน legacy/data.js + อีเมลของโหมด fixture
if (!existsSync('.next/BUILD_ID')) {
  console.error('ยังไม่มี production build: รัน npm run build ก่อน');
  process.exit(1);
}
const hits = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|html|json|rsc|body|txt)$/.test(name) && MARKERS.some((m) => readFileSync(p, 'utf8').includes(m))) hits.push(p);
  }
}
for (const root of ['.next/static', '.next/server']) if (existsSync(root)) walk(root);
if (hits.length) {
  console.error('พบข้อมูล fixture ใน build:\n' + hits.join('\n'));
  process.exit(1);
}
console.log('ok: ไม่มีข้อมูล fixture ใน .next/static และ .next/server');
