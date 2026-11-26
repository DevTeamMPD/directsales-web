// นำ session JST จากโปรไฟล์ Chrome (Playwright persistent profile) มาเป็น .session.json ให้ worker ใช้
//   node import-session.mjs                 ใช้โปรไฟล์ ../jst-worker-spike/.profile (ต้องล็อกอินไว้แล้ว)
//   node import-session.mjs --login         เปิดหน้าต่าง Chrome ให้ล็อกอิน JST เอง (เช่น JST ขอ captcha) แล้วบันทึก
//   node import-session.mjs --profile <dir> ใช้โปรไฟล์อื่น
//   node import-session.mjs --login --upload vercel   ล็อกอินเองแล้วส่ง session ให้ worker บน Vercel (dsales_worker_session_put)
// Playwright ใช้เฉพาะคำสั่งนี้ (worker ส่งข้อความด้วย HTTP ล้วน) · ไม่พิมพ์ค่า cookie ออกหน้าจอ
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const BASE = 'https://asia-web.jsterp.com';
const CHAT_URL = `${BASE}/iim/index`;
const isLoginUrl = (url) => /\/account\/login/i.test(String(url));

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[a.slice(2)] = true;
    else {
      out[a.slice(2)] = next;
      i++;
    }
  }
  return out;
}

/** cookie ที่ใช้กับ asia-web.jsterp.com ได้ → [{name, value}] (ชื่อซ้ำ: เอา path ที่ยาวกว่า) */
export function toJar(cookies, host = new URL(BASE).hostname) {
  const byName = new Map();
  for (const c of cookies) {
    const domain = String(c.domain || '').replace(/^\./, '').toLowerCase();
    if (!(host === domain || host.endsWith(`.${domain}`))) continue;
    const prev = byName.get(c.name);
    if (!prev || String(c.path || '/').length > String(prev.path || '/').length) byName.set(c.name, c);
  }
  return [...byName.values()].map((c) => ({ name: c.name, value: c.value }));
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** ส่ง cookie ให้ worker บน cloud — ถ้า worker กำลังทำรอบอยู่ (worker_busy) รอแล้วลองใหม่; error อื่น/ยังไม่ว่างหลังครบรอบ = โยน error (ไม่พิมพ์ cookie) */
export async function uploadSession(queue, workerId, jar, { sleep = wait, log = console.log, attempts = 6, waitMs = 10_000 } = {}) {
  for (let i = 1; ; i++) {
    try {
      await queue.sessionPut(workerId, jar);
      return;
    } catch (e) {
      if (!String(e?.message || e).includes('worker_busy') || i >= attempts) throw e;
      log(`worker กำลังทำงานรอบหนึ่งอยู่ — รอ ${Math.round(waitMs / 1000)} วินาทีแล้วลองใหม่`);
      await sleep(waitMs);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const profileDir = resolve(ROOT, typeof args.profile === 'string' ? args.profile : '../jst-worker-spike/.profile');
  const headed = args.login === true;
  const out = join(ROOT, typeof args.out === 'string' ? args.out : '.session.json');

  const { chromium } = await import('playwright');
  mkdirSync(profileDir, { recursive: true });
  console.log(`โปรไฟล์: ${profileDir}${headed ? ' (เปิดหน้าต่างให้ล็อกอิน)' : ''}`);
  let context;
  try {
    context = await chromium.launchPersistentContext(profileDir, {
      headless: !headed,
      channel: typeof args.channel === 'string' ? args.channel || undefined : 'chrome',
      viewport: { width: 1400, height: 900 },
      locale: 'th-TH',
      timezoneId: 'Asia/Bangkok',
    });
  } catch (e) {
    console.error(`เปิด Chrome ไม่ได้: ${String(e?.message || e).split('\n')[0]}`);
    console.error('ถ้ามีหน้าต่าง/สคริปต์อื่นใช้โปรไฟล์นี้อยู่ (เช่น probe.mjs ของ spike) ให้ปิดก่อน');
    process.exit(1);
  }
  try {
    const page = context.pages()[0] || (await context.newPage());
    await page.goto(CHAT_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    if (isLoginUrl(page.url())) {
      if (!headed) {
        console.error('ยังไม่ได้ล็อกอิน JST ในโปรไฟล์นี้ — รัน: node import-session.mjs --login');
        process.exitCode = 2;
        return;
      }
      console.log('ล็อกอิน JST ในหน้าต่างที่เปิดขึ้น (รอได้ถึง 10 นาที) ...');
      await page.waitForURL((u) => !isLoginUrl(u.toString()) && /\/iim\//i.test(u.toString()), { timeout: 10 * 60_000 });
      await page.waitForLoadState('domcontentloaded');
    }
    const jar = toJar(await context.cookies());
    if (!jar.length) {
      console.error('ไม่พบ cookie ของ JST — ไม่ได้บันทึก');
      process.exitCode = 1;
      return;
    }
    const tmp = `${out}.tmp`;
    writeFileSync(tmp, JSON.stringify(jar, null, 2), { mode: 0o600 });
    renameSync(tmp, out);
    console.log(`บันทึก ${jar.length} cookie ลง ${out} แล้ว — worker ที่รออยู่ในสถานะ needs_login จะทำงานต่อเอง`);
    if (args.upload !== undefined) {
      if (typeof args.upload !== 'string') {
        console.error('ระบุชื่อ worker ด้วย เช่น --upload vercel');
        process.exitCode = 1;
        return;
      }
      const { createClient } = await import('@supabase/supabase-js');
      const { createQueueClient } = await import('./queue-client.mjs');
      const { loadSupabaseConfig } = await import('./config.mjs');
      const sb = loadSupabaseConfig({
        configPath: resolve(ROOT, typeof args.config === 'string' ? args.config : 'config.json'),
        envPath: resolve(ROOT, '..', '..', '.env.local'),
      });
      const queue = createQueueClient({ supabaseUrl: sb.url, anonKey: sb.anonKey, email: sb.email, password: sb.password, createClient });
      try {
        await uploadSession(queue, args.upload, jar);
      } catch (e) {
        console.error(`ส่ง session ให้ worker "${args.upload}" ไม่สำเร็จ: ${String(e?.message || e).split('\n')[0]}`);
        process.exitCode = 1;
        return;
      }
      console.log(`ส่ง ${jar.length} cookie ให้ worker "${args.upload}" แล้ว — รอบถัดไป (ไม่เกิน 1 นาที) จะทำงานต่อเอง`);
    }
  } finally {
    await context.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(String(e?.message || e).split('\n')[0]);
    process.exit(1);
  });
}
