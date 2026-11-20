// ฟังก์ชันร่วมของ spike: เปิด Chromium ด้วย session ที่บันทึกไว้, ค้นหา/เปิดห้องแชต JST, อ่านข้อมูลห้อง
// selector อิงหน้า https://asia-web.jsterp.com/iim/index ที่ตรวจไว้ 2026-11-19/20 (ดู docs/superpowers/plans/2026-11-20-jst-worker-spike.md)
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = dirname(fileURLToPath(import.meta.url));
export const LOG_DIR = join(ROOT, 'logs');

export const SEL = {
  filter: '.panel_contacts-filter',
  searchInput: '.panel_contacts-filter div.j-input > input',
  firstSearchType: '.panel_contacts-filter .j-select .j-option',
  sessions: '#session li[data-ms-id]',
  composer: '.chat-input textarea.j-textarea',
  sendButton: '.chat-input button.j-primary',
};

/* ---------- ส่วนที่ไม่ต้องใช้เบราว์เซอร์ (มี test) ---------- */

/** --key value / --flag → { key: 'value', flag: true } */
export function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

export function loadConfig(path = join(ROOT, 'config.json')) {
  if (!existsSync(path)) throw new Error(`ไม่พบ ${path} — คัดลอก config.example.json เป็น config.json ก่อน`);
  const c = JSON.parse(readFileSync(path, 'utf8'));
  return {
    jstUrl: c.jstUrl || 'https://asia-web.jsterp.com/iim/index',
    profileDir: resolve(ROOT, c.profileDir || '.profile'),
    channel: c.channel || undefined, // "chrome" = ใช้ Chrome ที่ติดตั้งในเครื่องแทน Chromium ของ Playwright
    testChats: Array.isArray(c.testChats) ? c.testChats : [],
    probeMinutes: Number(c.probeMinutes) > 0 ? Number(c.probeMinutes) : 30,
  };
}

/** ส่งได้เฉพาะห้องใน allowlist (ms_id ตรงตัว) */
export function allowedChat(config, ms) {
  const id = String(ms ?? '').trim();
  if (!/^\d+$/.test(id) || Number(id) <= 0) return null; // 0 = ค่าตัวอย่างใน config.example.json
  return config.testChats.find((c) => String(c.msId) === id) || null;
}

/** JST ส่งไปหน้าล็อกอิน (…/Account/Login…) เมื่อ session หลุด */
export const isLoginUrl = (url) => /\/account\/login/i.test(String(url));

/** เก็บเฉพาะสิ่งที่ต้องใช้วิเคราะห์ ไม่เก็บ header (cookie/token อยู่ใน header) */
export function redactExchange({ url, method, postData, status, body }) {
  const u = new URL(url);
  return { path: u.pathname, method, request: safeJson(postData), status, response: safeJson(body) };
}
function safeJson(s) {
  if (s == null || s === '') return null;
  try {
    return JSON.parse(s);
  } catch {
    return String(s).slice(0, 4000);
  }
}

export function logLine(file, obj) {
  mkdirSync(LOG_DIR, { recursive: true });
  appendFileSync(join(LOG_DIR, file), JSON.stringify({ at: new Date().toISOString(), ...obj }) + '\n');
}

/* ---------- ส่วนที่ใช้เบราว์เซอร์ ---------- */

/** เปิด Chromium แบบ persistent profile (เก็บ cookie ของ JST ไว้ใน profileDir) */
export async function openJst(config, { headless = true } = {}) {
  const { chromium } = await import('playwright');
  mkdirSync(config.profileDir, { recursive: true });
  const context = await chromium.launchPersistentContext(config.profileDir, {
    headless,
    channel: config.channel,
    viewport: { width: 1400, height: 900 },
    locale: 'th-TH',
    timezoneId: 'Asia/Bangkok',
  });
  const page = context.pages()[0] || (await context.newPage());
  return { context, page };
}

/** ไปหน้าแชตแล้วดูว่าล็อกอินอยู่ไหม: ล็อกอินอยู่ = มีช่องค้นหาและรายการห้อง */
export async function gotoChat(page, config, { timeout = 30000 } = {}) {
  await page.goto(config.jstUrl, { waitUntil: 'domcontentloaded', timeout });
  if (isLoginUrl(page.url())) return { loggedIn: false, url: page.url(), sessions: 0 };
  try {
    await page.locator(SEL.searchInput).first().waitFor({ state: 'visible', timeout });
    await page.locator(SEL.sessions).first().waitFor({ state: 'attached', timeout: 15000 });
  } catch {
    return { loggedIn: false, url: page.url(), sessions: 0 };
  }
  return { loggedIn: true, url: page.url(), sessions: await page.locator(SEL.sessions).count() };
}

/** รายการห้องที่แสดงอยู่ */
export async function listSessions(page) {
  return page.$$eval(SEL.sessions, (lis) =>
    lis.map((li) => ({
      ms: li.getAttribute('data-ms-id'),
      name: (li.querySelector('.name-text')?.textContent || '').trim(),
      provider: (li.querySelector('.pl-icon')?.className || '').replace('pl-icon', '').trim(),
      page: li.querySelector('img.picture')?.getAttribute('title') || '',
      active: li.classList.contains('active'),
      expired: li.classList.contains('isExpired'),
    })),
  );
}

/**
 * ค้นหาด้วย Buyer Name แล้วเปิดห้อง: ms_id ตรง → ชื่อตรง (ห้องเดียว) → ผลค้นหามีห้องเดียว
 * หมายเหตุ: การเปิดห้องทำให้ JST บันทึกบัญชีที่ล็อกอินเป็นผู้ดูแลห้อง (setSupportStaff)
 */
export async function searchAndOpen(page, { chat, ms }) {
  const first = page.locator(SEL.firstSearchType).first();
  if ((await first.count()) && !(await first.evaluate((e) => e.classList.contains('checked')))) await first.evaluate((e) => e.click());
  const before = (await listSessions(page)).map((s) => s.ms).join(',');
  const input = page.locator(SEL.searchInput).first();
  await input.fill(Array.from(chat).slice(0, 50).join(''));
  await input.press('Enter');

  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const items = await listSessions(page);
    const changed = items.map((s) => s.ms).join(',') !== before;
    const hit =
      (ms && items.find((s) => s.ms === String(ms))) ||
      (() => {
        const exact = items.filter((s) => s.name === chat);
        return exact.length === 1 ? exact[0] : null;
      })() ||
      (changed && items.length === 1 ? items[0] : null);
    if (hit) {
      if (!hit.active) await page.locator(`${SEL.sessions}[data-ms-id="${hit.ms}"]`).click();
      await page.waitForFunction((id) => document.querySelector(`#session li[data-ms-id="${id}"]`)?.classList.contains('active'), hit.ms, { timeout: 10000 });
      return { ...hit, active: true };
    }
    await page.waitForTimeout(300);
  }
  return null;
}

/** เปิด → ไปหน้าแชต → ปิด: ใช้ตรวจว่า session ยังล็อกอินอยู่ (check.mjs / probe.mjs) */
export async function checkSession(config, { headless = true } = {}) {
  const t0 = Date.now();
  const { context, page } = await openJst(config, { headless });
  try {
    const r = await gotoChat(page, config);
    return { logged_in: r.loggedIn, sessions: r.sessions, url: r.url, ms: Date.now() - t0 };
  } catch (e) {
    return { logged_in: false, error: String(e?.message || e).slice(0, 300), ms: Date.now() - t0 };
  } finally {
    await context.close();
  }
}
