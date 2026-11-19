import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { PATHS } from '../lib/constants';

const LEGACY = 'http://127.0.0.1:4100/index.html';
const APP = 'http://127.0.0.1:3100';
const SIZES = [
  { tag: 'mobile', width: 375, height: 812 },
  { tag: 'desktop', width: 1280, height: 800 },
] as const;
// เทียบเป็นรายองค์ประกอบ (element screenshot) แบบเข้ม: threshold 0.02 = ความต่างสีต่อพิกเซลที่ยังนับว่าเหมือน
// maxDiffPixels = จำนวนพิกเซลที่ต่างได้ (กัน anti-alias) ห้ามขยายเกณฑ์เพื่อให้ผ่าน
// Playwright คิดความต่างทีละพิกเซล: ตัวอักษรของ prototype (ฟอนต์จาก Google CDN) กับ next/font (self-host) anti-alias ไม่เท่ากันเล็กน้อย
// และคงที่ทุกรอบ จึงตั้ง maxDiffPixels ตาม element ตามที่วัดได้ (ที่ threshold 0.1)
// ส่วนสีตรวจแยกด้วย computed-style (shellMetrics) ซึ่งแม่นกว่าภาพ
const strict = (maxDiffPixels: number) => ({ maxDiffPixels, threshold: 0.1 }) as const;
const STRICT_SIDEBAR = strict(400);
const STRICT_CARD = strict(200);
const STRICT_TOPBAR = strict(50);
const OPEN = /\bopen\b/;
// full-page เป็นแค่ตัวเช็กหยาบ ๆ ว่าโครงรวมไม่เพี้ยน
const COARSE = { maxDiffPixelRatio: 0.005, threshold: 0.1 } as const;
// ใช้ทดสอบว่าเทสต์จับความต่างได้จริง: ฉีด CSS เข้าฝั่ง Next เท่านั้น (ไม่ตั้งค่า = ไม่ทำอะไร)
const INJECT = process.env.PARITY_INJECT_CSS;
// แผน A เทียบเฉพาะ shell: ซ่อนเนื้อหาหน้าและปุ่มของหน้าใน topbar ทั้งสองฝั่ง
const HIDE_WORK_AREA = '#view > *, #topbar-actions > * { display: none !important; }';

const legacyShot = (name: string) => path.join(__dirname, '.legacy-shots', `${name}.png`);

async function settle(page: Page) {
  await page.addStyleTag({ content: HIDE_WORK_AREA });
  // รอฟอนต์ (prototype โหลดแบบ blocking, next/font เป็น swap) ให้กว้างตัวอักษรไทยนิ่งก่อนถ่ายทุกครั้ง
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.waitForTimeout(200);
}

async function shootLegacy(page: Page, name: string, selector?: string) {
  const opts = { path: legacyShot(name), animations: 'disabled', caret: 'hide' } as const;
  if (selector) await page.locator(selector).screenshot(opts);
  else await page.screenshot(opts);
}

// ค่า computed style / geometry ของ shell เอาไว้เทียบ legacy กับ Next ตรง ๆ (สีที่ต่างเล็กน้อยภาพอาจไม่จับ)
async function shellMetrics(page: Page) {
  return page.evaluate(() => {
    const cs = (el: Element | null) => (el ? getComputedStyle(el) : null);
    const r = (el: Element | null) => {
      const b = el?.getBoundingClientRect();
      return b ? { x: b.x, y: b.y, width: b.width, height: b.height } : null;
    };
    const sidebar = document.querySelector('#sidebar');
    const topbar = document.querySelector('.topbar');
    const brand = document.querySelector('.brand-name');
    return {
      body: { backgroundColor: cs(document.body)?.backgroundColor },
      sidebar: { backgroundColor: cs(sidebar)?.backgroundColor, width: r(sidebar)?.width },
      topbar: { backgroundColor: cs(topbar)?.backgroundColor, height: r(topbar)?.height },
      brandName: {
        fontSize: cs(brand)?.fontSize,
        // next/font เติม family สำรองของตัวเอง ("... Fallback") จึงเทียบเฉพาะฟอนต์แรก
        fontFamily: cs(brand)?.fontFamily.split(',')[0],
        fontWeight: cs(brand)?.fontWeight,
      },
      navItems: Array.from(document.querySelectorAll('.nav-item')).map((el) => ({
        route: el.getAttribute('data-route'),
        text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
        x: r(el)?.x,
        height: r(el)?.height,
        active: el.classList.contains('active'),
        backgroundColor: cs(el)?.backgroundColor,
        color: cs(el)?.color,
        paddingLeft: cs(el)?.paddingLeft,
        badge: (() => {
          const b = el.querySelector('.nav-badge');
          return b ? { text: b.textContent, backgroundColor: cs(b)?.backgroundColor, color: cs(b)?.color } : null;
        })(),
      })),
    };
  });
}

type Metrics = Awaited<ReturnType<typeof shellMetrics>>;

function assertLegacyMetricsUsable(m: Metrics) {
  // กันเทสต์เทียบของว่างเปล่า: ต้องมีเมนูหลายอัน มีอันที่ active และมี badge จริง
  expect(m.navItems.length).toBeGreaterThan(5);
  expect(m.navItems.some((n) => n.active)).toBe(true);
  expect(m.navItems.some((n) => n.badge)).toBe(true);
}

async function openLegacyShell(page: Page) {
  await page.goto(LEGACY);
  await page.locator('#l-demo').click();
  await expect(page.locator('#login')).toBeHidden();
  // ส่วนที่เว็บใหม่ตั้งใจต่างจาก prototype: กลุ่มเมนู "ฐานลูกค้าเก่า" และกล่อง me แบบล็อกอินแล้ว
  await page.evaluate(({ person, list }) => {
    const campaigns = Array.from(document.querySelectorAll('.nav-group')).find((g) => g.textContent === 'แคมเปญ');
    campaigns?.insertAdjacentHTML(
      'beforebegin',
      '<div class="nav-group">ฐานลูกค้าเก่า</div>' +
        `<a class="nav-item" href="#mine" data-route="mine"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${person}"></path></svg><span>ลูกค้าของฉัน</span></a>` +
        `<a class="nav-item" href="#pool" data-route="pool"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${list}"></path></svg><span>ถังกลาง</span></a>`,
    );
    const label = document.querySelector('#me-label');
    if (label) label.textContent = 'เข้าสู่ระบบแล้ว';
    const select = document.querySelector<HTMLSelectElement>('#me-select');
    if (select) {
      select.innerHTML = '<option>Dev MPD</option>';
      select.disabled = true;
    }
  }, { person: PATHS.person, list: PATHS.list });
  await settle(page);
}

async function openAppShell(page: Page) {
  await page.goto(`${APP}/leads`);
  await expect(page.locator('#page-title')).toHaveText('Direct Sale', { timeout: 60_000 });
  await expect(page.locator('.nav-item.active')).toHaveAttribute('data-route', 'leads');
  if (INJECT) await page.addStyleTag({ content: INJECT });
  await settle(page);
}

for (const s of SIZES) {
  test.describe(`${s.tag} ${s.width}x${s.height}`, () => {
    test.use({ viewport: { width: s.width, height: s.height } });

    if (s.tag === 'desktop') {
      test('shell matches the prototype', async ({ page }) => {
        await openLegacyShell(page);
        const legacy = await shellMetrics(page);
        assertLegacyMetricsUsable(legacy);
        await shootLegacy(page, 'shell-desktop');
        await shootLegacy(page, 'sidebar-desktop', '#sidebar');
        await shootLegacy(page, 'topbar-desktop', '.topbar');
        await openAppShell(page);
        expect(await shellMetrics(page)).toEqual(legacy);
        await expect(page.locator('#sidebar')).toHaveScreenshot('sidebar-desktop.png', STRICT_SIDEBAR);
        await expect(page.locator('.topbar')).toHaveScreenshot('topbar-desktop.png', STRICT_TOPBAR);
        await expect(page).toHaveScreenshot('shell-desktop.png', COARSE);
      });
    } else {
      test('shell (menu closed) matches the prototype', async ({ page }) => {
        await openLegacyShell(page);
        const legacy = await shellMetrics(page);
        assertLegacyMetricsUsable(legacy);
        await shootLegacy(page, 'shell-mobile');
        await shootLegacy(page, 'topbar-mobile', '.topbar');
        await openAppShell(page);
        expect(await shellMetrics(page)).toEqual(legacy);
        await expect(page.locator('.topbar')).toHaveScreenshot('topbar-mobile.png', STRICT_TOPBAR);
        await expect(page).toHaveScreenshot('shell-mobile.png', COARSE);
      });

      test('shell with the menu open matches the prototype', async ({ page }) => {
        await openLegacyShell(page);
        await page.locator('#menu-btn').click();
        await expect(page.locator('#sidebar')).toHaveClass(OPEN);
        await settle(page);
        const legacy = await shellMetrics(page);
        assertLegacyMetricsUsable(legacy);
        await shootLegacy(page, 'shell-menu-mobile');
        await shootLegacy(page, 'sidebar-menu-mobile', '#sidebar');
        await openAppShell(page);
        await page.locator('#menu-btn').click();
        await expect(page.locator('#sidebar')).toHaveClass(OPEN);
        await settle(page);
        expect(await shellMetrics(page)).toEqual(legacy);
        await expect(page.locator('#sidebar')).toHaveScreenshot('sidebar-menu-mobile.png', STRICT_SIDEBAR);
        await expect(page).toHaveScreenshot('shell-menu-mobile.png', COARSE);
      });
    }

    test('login matches the prototype (without the demo button)', async ({ page }) => {
      await page.goto(LEGACY);
      await expect(page.locator('#login')).toBeVisible();
      await page.evaluate(() => {
        document.querySelector('#l-demo')?.remove();
        const err = document.querySelector<HTMLElement>('#l-err');
        if (err) {
          err.hidden = true;
          err.textContent = '';
        }
      });
      await settle(page);
      await shootLegacy(page, `login-${s.tag}`);
      await shootLegacy(page, `login-card-${s.tag}`, '.login-card');
      await page.goto(`${APP}/login`);
      await expect(page.locator('#login-form')).toBeVisible({ timeout: 60_000 });
      if (INJECT) await page.addStyleTag({ content: INJECT });
      await settle(page);
      await expect(page.locator('.login-card')).toHaveScreenshot(`login-card-${s.tag}.png`, STRICT_CARD);
      await expect(page).toHaveScreenshot(`login-${s.tag}.png`, COARSE);
    });
  });
}

/* ---------- แผน B: หน้า /leads และ popup A–D ---------- */
const DEMO_KEY = 'mpd-directsale-preview-v5';
// ความต่างที่ตั้งใจ (spec ข้อ 2) และวิธีจัดการใน test นี้:
// - .demo-note (หมายเหตุโหมดตัวอย่างบนหน้า Direct Sale) และ <div class="sub">ข้อมูลตัวอย่าง: …</div> ท้าย #chk-body
//   ไม่มีในเว็บใหม่ → ซ่อน/ลบฝั่ง prototype ก่อนเก็บสถานะและถ่ายภาพ (LEGACY_DEMO_ONLY + remove ใน compareSteps)
// - ช่องค้นหา #q: prototype วาดใหม่แล้วย้าย caret ไปท้ายทุกตัวอักษร เว็บใหม่คง caret ตามที่พิมพ์ — ไม่มีผลกับภาพ
//   (test ไม่พิมพ์ในช่องค้นหา และถ่ายภาพด้วย caret: 'hide')
// - โหมด fixture ไม่เขียนข้อมูล (แสดง toast แทน RPC) → test แค่เปิด popup / สลับแท็บ / เลือกตัวเลือก ไม่กดบันทึก
const LEGACY_DEMO_ONLY = '.demo-note, #chk-body > div.sub { display: none !important; }';
// PARITY_MEASURE=1 → maxDiffPixels = 0 ทุกภาพของแผน B เพื่ออ่านจำนวนพิกเซลที่ต่างจริงจากผลรัน (Step 6)
const MEASURE = !!process.env.PARITY_MEASURE;
// maxDiffPixels ต่อภาพที่ threshold 0.1 (ความต่าง anti-alias ของฟอนต์ CDN กับ next/font กระจายตามขอบตัวอักษร) ห้ามขยายเพื่อให้ผ่าน
// วัด 3 รอบ 2026-11-18 (Chromium ของ Playwright 1.65.1): ค่าเท่ากันทุกรอบ ตั้ง = ค่าที่วัดได้ × 1.25 ปัดขึ้นหลัก 50 (ทุกภาพ < 0.5% ของพื้นที่)
// ค่าที่วัดได้: view 11884/5571, topbar 81/57, customer-buy 1060/617, customer-talk 870/617, customer-nocall 993/785,
// log-call 281/281, log-won 454/486, log-dnc 553/560, log-chat 314/320, unclaim 298/298, bucket 360/361 (desktop/mobile)
const MAX_DIFF: Record<string, number> = {
  'leads-view-desktop': 14900, 'leads-view-mobile': 7000, 'leads-topbar-desktop': 150, 'leads-topbar-mobile': 100,
  'customer-buy-desktop': 1350, 'customer-buy-mobile': 800, 'customer-talk-desktop': 1100, 'customer-talk-mobile': 800,
  'customer-nocall-desktop': 1250, 'customer-nocall-mobile': 1000,
  'log-call-desktop': 400, 'log-call-mobile': 400, 'log-won-desktop': 600, 'log-won-mobile': 650,
  'log-dnc-desktop': 700, 'log-dnc-mobile': 700, 'log-chat-desktop': 400, 'log-chat-mobile': 400,
  'unclaim-desktop': 400, 'unclaim-mobile': 400, 'bucket-desktop': 450, 'bucket-mobile': 500,
};
const shot = (name: string) => ({ maxDiffPixels: MEASURE ? 0 : (MAX_DIFF[name] ?? 0), threshold: 0.1 }) as const;

async function settleWork(page: Page) {
  await page.mouse.move(0, 0); // ไม่ให้ :hover ของแถว/ปุ่มติดในภาพ
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.waitForTimeout(200);
}

/**
 * .main เป็นกล่อง scroll สูงเท่าจอ (prototype.css) element screenshot ของ #view จึงได้แค่ส่วนที่อยู่ในจอ (~3 แถวแรก ที่เหลือว่าง)
 * และ topbar (sticky) ทับขอบบน — ปลดให้ทั้งหน้ายาวตามเนื้อหาทั้งสองฝั่งเท่ากัน เพื่อให้ภาพครอบคลุมตารางครบ 28 แถว
 */
async function unclipView(page: Page) {
  await page.addStyleTag({
    content: 'html, body, .app, .main { height: auto !important; } .main { overflow: visible !important; } .topbar { position: static !important; }',
  });
  await settleWork(page);
}

/** prototype โหมดตัวอย่างที่หน้า Direct Sale; claim = ทำเหมือน Dev MPD จองลีดนั้น (แก้ state ใน localStorage แล้วโหลดใหม่) */
async function openLegacyLeads(page: Page, claim?: string) {
  await page.goto(LEGACY);
  await page.locator('#l-demo').click();
  await expect(page.locator('#login')).toBeHidden();
  if (claim) {
    await page.evaluate(({ key, id }) => {
      const s = JSON.parse(localStorage.getItem(key) ?? '{}');
      const l = s.leads.find((x: { id: string }) => x.id === id);
      Object.assign(l, { owner: 'r4', claimedBy: 'r4', claimedAt: '2026-11-04T10:00' });
      localStorage.setItem(key, JSON.stringify(s));
    }, { key: DEMO_KEY, id: claim });
    await page.reload();
    await page.locator('#l-demo').click();
    await expect(page.locator('#login')).toBeHidden();
  }
  await page.addStyleTag({ content: LEGACY_DEMO_ONLY });
  await expect(page.locator('#view tbody tr')).toHaveCount(28);
  await settleWork(page);
}

async function openAppLeads(page: Page, claim?: string) {
  await page.goto(`${APP}/leads${claim ? `?claim=${claim}` : ''}`);
  await expect(page.locator('#view tbody tr')).toHaveCount(28, { timeout: 60_000 });
  if (INJECT) await page.addStyleTag({ content: INJECT });
  await settleWork(page);
}

// ข้อความ/คลาส/สีของหน้า /leads เทียบตรงตัว (ภาพอาจไม่จับตัวเลขหรือสีที่ต่างเล็กน้อย)
async function leadsText(page: Page) {
  return page.evaluate(() => {
    // innerText = ข้อความที่แสดงผลจริง: prototype สร้าง markup จาก template string จึงมี whitespace ระหว่าง block ที่ไม่แสดงผล
    // (textContent ได้ "ชื่อ 08…") ส่วน JSX ไม่มี ("ชื่อ08…") ทั้งที่หน้าจอเหมือนกัน
    const t = (el: Element | null) => ((el instanceof HTMLElement ? el.innerText : el?.textContent) ?? '').replace(/\s+/g, ' ').trim();
    const cls = (el: Element) => (typeof el.className === 'string' ? el.className : '').split(/\s+/).filter(Boolean).join(' ');
    const cs = (el: Element | null) => (el ? getComputedStyle(el) : null);
    const view = document.querySelector('#view');
    const all = (sel: string) => Array.from(view?.querySelectorAll(sel) ?? []);
    return {
      period: all('.period [data-pk]').map((b) => `${cls(b)}|${t(b)}`),
      periodNote: t(view?.querySelector('.period > .sub') ?? null),
      periodYear: all('#p-year option').map(t),
      chips: all('[data-chip]').map((b) => ({ text: t(b), cls: cls(b), dot: cs(b.querySelector('.dot'))?.backgroundColor ?? null })),
      selects: all('.toolbar select').map((s) => ({
        id: s.id, options: Array.from((s as HTMLSelectElement).options).map((o) => o.text), value: (s as HTMLSelectElement).value,
      })),
      search: (view?.querySelector('#q') as HTMLInputElement | null)?.placeholder ?? null,
      head: all('thead th').map(t),
      // ความกว้างคอลัมน์: บนมือถือตารางล้นจอ (table-wrap เลื่อนแนวนอน) ภาพเห็นแค่ 2–3 คอลัมน์แรก
      cols: all('thead th').map((th) => Math.round(th.getBoundingClientRect().width * 10) / 10),
      rows: all('tbody tr').map((tr) => Array.from(tr.children).map(t)),
      badges: all('tbody .badge').map((b) => ({ cls: cls(b), bg: cs(b)?.backgroundColor, color: cs(b)?.color })),
      actions: all('tbody .actions').map((a) => Array.from(a.children).map((b) => `${cls(b)}|${t(b)}`)),
      icons: all('tbody .ch-bar').map((bar) => Array.from(bar.querySelectorAll('img')).map((i) => i.getAttribute('alt'))),
      topbar: Array.from(document.querySelectorAll('#topbar-actions > *')).map((b) => `${cls(b)}|${t(b)}`),
    };
  });
}

// สถานะของ popup ที่เปิดอยู่: ข้อความทั้งหมด, ค่าในช่องกรอก, [hidden], ปุ่ม, element ที่ถูก focus
async function modalState(page: Page) {
  return page.evaluate(() => {
    // innerText เหมือน leadsText (ข้อความที่แสดงผลจริง)
    const t = (el: Element | null) => ((el instanceof HTMLElement ? el.innerText : el?.textContent) ?? '').replace(/\s+/g, ' ').trim();
    const cls = (el: Element) => (typeof el.className === 'string' ? el.className : '').split(/\s+/).filter(Boolean).join(' ');
    const m = document.querySelector('.modal');
    const all = (sel: string) => Array.from(m?.querySelectorAll(sel) ?? []);
    const active = document.activeElement;
    return {
      cls: m ? cls(m) : null,
      text: t(m),
      // เนื้อหาทั้งหมดรวมส่วนที่ซ่อนอยู่ (innerText ข้าม [hidden]) ตัด whitespace ทิ้ง เทียบเนื้อหาโดยไม่ขึ้นกับการจัด markup
      source: (m?.textContent ?? '').replace(/\s+/g, ''),
      fields: all('input, select, textarea').map((el) => {
        const f = el as HTMLInputElement;
        return { id: f.id, value: f.value, disabled: f.disabled, shown: !f.closest('[hidden]') };
      }),
      hidden: all('[id]').map((el) => `${el.id}:${(el as HTMLElement).hidden}`),
      buttons: all('button, a.ch-btn').map((b) => `${cls(b)}|${t(b)}|${b.getAttribute('title') ?? ''}|${(b as HTMLButtonElement).disabled ?? ''}`),
      focused: active && m?.contains(active) ? active.id || cls(active) : null,
      // สี/ขนาดตัวอักษรที่ภาพ (threshold 0.1) อาจไม่จับเมื่อต่างเล็กน้อย เช่นสีแท็บที่เลือก, badge, ปุ่ม, หัว popup
      styles: all('.modal-h h3, .tab, .badge, .tag, .btn, .seg button, label').map((el) => {
        const c = getComputedStyle(el);
        return `${el.tagName}.${cls(el)}|${c.color}|${c.backgroundColor}|${c.fontSize}|${c.fontWeight}|${c.letterSpacing}`;
      }),
    };
  });
}

type Step = { name: string; act: (page: Page) => Promise<void> };

/** ปิด popup เดิม (ถ้ามี) แล้วคลิก selector และรอ ready */
const press = (selector: string, ready: string) => async (page: Page) => {
  await page.keyboard.press('Escape');
  await page.locator(selector).click();
  await expect(page.locator(ready).first()).toBeVisible();
};
const openCustomer = (id: string) => press(`[data-act=open][data-id=${id}]`, '#chk-body .badge');
const customerTab = (tab: 'buy' | 'talk') => async (page: Page) => {
  await page.locator(`.modal [data-tab=${tab}]`).click();
  await expect(page.locator(`.modal .tab.active[data-tab=${tab}]`)).toBeVisible();
  await page.waitForTimeout(150); // รอรอบตรวจแชตใหม่หลังสลับแท็บ
  await expect(page.locator('#chk-body .badge')).toBeVisible();
};
const openLog = (id: string) => press(`[data-act=log][data-id=${id}]`, '#log-form');
const logStatus = (value: string) => async (page: Page) => {
  await page.locator('#f-status').selectOption(value);
};

/** ทำ steps กับ prototype (เก็บสถานะ + ถ่าย baseline) แล้วทำซ้ำกับ Next และเทียบทีละ step */
async function compareSteps(page: Page, steps: Step[], opts: { claim?: string; view?: boolean } = {}) {
  await openLegacyLeads(page, opts.claim);
  const view = opts.view ? await leadsText(page) : null;
  const legacy: Awaited<ReturnType<typeof modalState>>[] = [];
  for (const st of steps) {
    await st.act(page);
    await page.evaluate(() => document.querySelector('#chk-body > div.sub')?.remove());
    await settleWork(page);
    legacy.push(await modalState(page));
    await shootLegacy(page, st.name, '.modal');
  }
  await openAppLeads(page, opts.claim);
  if (view) expect(await leadsText(page)).toEqual(view);
  for (const [i, st] of steps.entries()) {
    await st.act(page);
    await settleWork(page);
    expect.soft(await modalState(page), st.name).toEqual(legacy[i]);
    await expect.soft(page.locator('.modal')).toHaveScreenshot(`${st.name}.png`, shot(st.name));
  }
}

for (const s of SIZES) {
  test.describe(`leads ${s.tag} ${s.width}x${s.height}`, () => {
    test.use({ viewport: { width: s.width, height: s.height } });

    test('leads page matches the prototype', async ({ page }) => {
      await openLegacyLeads(page);
      const legacy = await leadsText(page);
      expect(legacy.rows).toHaveLength(28);
      expect(legacy.chips.length).toBe(10);
      await shootLegacy(page, `leads-topbar-${s.tag}`, '.topbar');
      await unclipView(page);
      await shootLegacy(page, `leads-view-${s.tag}`, '#view');
      await openAppLeads(page);
      expect(await leadsText(page)).toEqual(legacy);
      await expect.soft(page.locator('.topbar')).toHaveScreenshot(`leads-topbar-${s.tag}.png`, shot(`leads-topbar-${s.tag}`));
      await unclipView(page);
      await expect.soft(page.locator('#view')).toHaveScreenshot(`leads-view-${s.tag}.png`, shot(`leads-view-${s.tag}`));
    });

    test('customer modal matches the prototype (both tabs)', async ({ page }) => {
      await compareSteps(page, [
        { name: `customer-buy-${s.tag}`, act: openCustomer('L1014') },
        { name: `customer-talk-${s.tag}`, act: customerTab('talk') },
        {
          name: `customer-nocall-${s.tag}`,
          act: async (p) => {
            await openCustomer('L1011')(p);
            await customerTab('talk')(p);
          },
        },
      ]);
    });

    test('log modal matches the prototype (call and chat)', async ({ page }) => {
      await compareSteps(page, [
        { name: `log-call-${s.tag}`, act: openLog('L1014') },
        { name: `log-won-${s.tag}`, act: logStatus('won') },
        { name: `log-dnc-${s.tag}`, act: logStatus('dnc') },
        { name: `log-chat-${s.tag}`, act: openLog('L1011') },
      ]);
    });

    test('unclaim confirm matches the prototype', async ({ page }) => {
      await compareSteps(page, [{ name: `unclaim-${s.tag}`, act: press('[data-act=unclaim][data-id=L1002]', '#unclaim-ok') }], { claim: 'L1002', view: true });
    });

    test('pick-from-bucket matches the prototype and opens the brand pool', async ({ page }) => {
      await compareSteps(page, [{ name: `bucket-${s.tag}`, act: press('#add-lead', '[data-open-bucket=bebeplay]') }]);
      await page.locator('[data-open-bucket=bebeplay]').click();
      await expect(page).toHaveURL(`${APP}/campaigns/bebeplay`);
      await expect(page.locator('#page-title')).toHaveText('แคมเปญ Bebeplay');
      await expect(page.locator('#modal-root')).toBeHidden();
    });
  });
}

/* ---------- แผน C1: หน้าแคมเปญ, ถังลูกค้า, popup E (รายละเอียดลูกค้าในถัง), popup F (ตัวสร้างแคมเปญ), /mine, /pool ---------- */
// ความต่างที่ตั้งใจ: ไม่มี — โหมด fixture (live = false) ทำแบบโหมดตัวอย่างของ prototype ทั้งการ์ดถัง ("ตัวอย่าง" + เข้าแคมเปญแล้ว/ยังไม่เข้า),
// ช่องแคมเปญของแถวถัง, ปุ่มจอง/จองโดย/ยกเลิกจอง และ funnel ของตัวสร้างแคมเปญ (นับจากลูกค้าตัวอย่าง)
// maxDiffPixels ของภาพแผน C1 (วัดด้วย PARITY_MEASURE=1 ตาม Task 8 Step 5 แล้วแก้ค่าในตารางนี้)
// วัดเมื่อ 2026-11-19 (Chromium ของ Playwright 1.65, Windows) 3 รอบได้ค่าเท่ากันทุกรอบ (noise 0) ค่าในตาราง = ค่าที่วัดได้สูงสุด × 1.25 ปัดขึ้นหลัก 50
const MAX_DIFF_C1: Record<string, number> = {
  'campaign-view-desktop': 14400, 'campaign-view-mobile': 9400, 'campaign-topbar-desktop': 250, 'campaign-topbar-mobile': 150,
  'campaign-table-desktop': 8200, 'campaign-table-mobile': 4750,
  'pool-detail-desktop': 1650, 'pool-detail-mobile': 650, 'pool-detail-mine-desktop': 1800, 'pool-detail-mine-mobile': 750,
  'builder-base-desktop': 450, 'builder-base-mobile': 450, 'builder-set-desktop': 850, 'builder-set-mobile': 850,
  'builder-aud-desktop': 500, 'builder-aud-mobile': 500, 'builder-crit-desktop': 650, 'builder-crit-mobile': 650,
  'builder-preview-desktop': 1450, 'builder-preview-mobile': 850,
};
const shotC1 = (name: string) => ({ maxDiffPixels: MEASURE ? 0 : (MAX_DIFF_C1[name] ?? 0), threshold: 0.1 }) as const;

/** prototype โหมดตัวอย่างที่หน้าแคมเปญ (การ์ด "ลูกค้าทั้งหมด" ถูกเลือกเป็นค่าเริ่ม) รอถังแสดงครบหน้าแรก */
async function openLegacyCampaign(page: Page, brand: 'bebeplay' | 'hosttail', rows: number) {
  await page.goto(LEGACY);
  await page.locator('#l-demo').click();
  await expect(page.locator('#login')).toBeHidden();
  await page.evaluate((b) => {
    location.hash = '#campaign-' + b;
  }, brand);
  await expect(page.locator('#pool-q')).toBeVisible();
  await expect(page.locator('#view tbody tr')).toHaveCount(rows);
  await settleWork(page);
}

async function openAppCampaign(page: Page, brand: 'bebeplay' | 'hosttail', rows: number) {
  await page.goto(`${APP}/campaigns/${brand}`);
  await expect(page.locator('#view tbody tr')).toHaveCount(rows, { timeout: 60_000 });
  if (INJECT) await page.addStyleTag({ content: INJECT });
  await settleWork(page);
}

/** ข้อความ/คลาส/สีของหน้าแคมเปญ: การ์ด (รวมความกว้าง bar), quota, ปุ่มท้ายแถวถัง, ตัวแบ่งหน้า + ส่วนเดียวกับหน้า /leads */
async function campaignText(page: Page) {
  const leads = await leadsText(page);
  const extra = await page.evaluate(() => {
    const t = (el: Element | null) => ((el instanceof HTMLElement ? el.innerText : el?.textContent) ?? '').replace(/\s+/g, ' ').trim();
    const cls = (el: Element) => (typeof el.className === 'string' ? el.className : '').split(/\s+/).filter(Boolean).join(' ');
    const view = document.querySelector('#view');
    const all = (sel: string) => Array.from(view?.querySelectorAll(sel) ?? []);
    return {
      cards: all('.camp-grid > *').map((c) => ({
        cls: cls(c), camp: c.getAttribute('data-camp'), text: t(c),
        bars: Array.from(c.querySelectorAll('.bar > i')).map((i) => (i as HTMLElement).style.width),
        badge: (() => {
          const b = c.querySelector('.badge');
          return b ? `${cls(b)}|${getComputedStyle(b).backgroundColor}` : null;
        })(),
      })),
      quota: t(view?.querySelector('.quota') ?? null),
      poolSearch: (view?.querySelector('#pool-q') as HTMLInputElement | null)?.placeholder ?? null,
      rowButtons: all('tbody tr > td:last-child > button').map((b) => `${cls(b)}|${t(b)}|${(b as HTMLButtonElement).disabled}`),
      pager: all('[data-pool]').map((b) => `${t(b)}|${(b as HTMLButtonElement).disabled}`).concat(all('.sub.num').map(t)),
      claimCells: all('tbody select[data-assign]').length,
    };
  });
  return { ...leads, ...extra };
}

/** เหมือน compareSteps แต่เปิดหน้าด้วยฟังก์ชันที่ส่งมา (หน้าแคมเปญ) */
async function compareStepsOn(page: Page, steps: Step[], openLegacy: (p: Page) => Promise<void>, openApp: (p: Page) => Promise<void>) {
  await openLegacy(page);
  const legacy: Awaited<ReturnType<typeof modalState>>[] = [];
  for (const st of steps) {
    await st.act(page);
    await settleWork(page);
    legacy.push(await modalState(page));
    await shootLegacy(page, st.name, '.modal');
  }
  await openApp(page);
  for (const [i, st] of steps.entries()) {
    await st.act(page);
    await settleWork(page);
    expect.soft(await modalState(page), st.name).toEqual(legacy[i]);
    await expect.soft(page.locator('.modal')).toHaveScreenshot(`${st.name}.png`, shotC1(st.name));
  }
}

const click = (selector: string, ready: string) => async (page: Page) => {
  await page.locator(selector).click();
  await expect(page.locator(ready).first()).toBeVisible();
};

for (const s of SIZES) {
  test.describe(`campaigns ${s.tag} ${s.width}x${s.height}`, () => {
    test.use({ viewport: { width: s.width, height: s.height } });

    test('campaign page with the customer pool matches the prototype (both pages)', async ({ page }) => {
      await openLegacyCampaign(page, 'bebeplay', 50);
      const legacy = await campaignText(page);
      expect(legacy.cards).toHaveLength(4);
      expect(legacy.rowButtons).toHaveLength(50);
      await shootLegacy(page, `campaign-topbar-${s.tag}`, '.topbar');
      await unclipView(page);
      await shootLegacy(page, `campaign-view-${s.tag}`, '#view');
      await page.locator('[data-pool=next]').click();
      await expect(page.locator('#view tbody tr')).toHaveCount(9);
      // หน้า 2: เทียบแถว/ปุ่ม/ตัวแบ่งหน้า (ความกว้างคอลัมน์ขึ้นกับความกว้างตัวอักษรของชื่อในหน้านั้น ต่างกันได้ ±0.1px ระหว่างฟอนต์ CDN กับ next/font)
      const page2 = async (p: Page) => {
        const x = await campaignText(p);
        return { rows: x.rows, rowButtons: x.rowButtons, pager: x.pager, cards: x.cards };
      };
      const legacyPage2 = await page2(page);
      await openAppCampaign(page, 'bebeplay', 50);
      expect(await campaignText(page)).toEqual(legacy);
      await expect.soft(page.locator('.topbar')).toHaveScreenshot(`campaign-topbar-${s.tag}.png`, shotC1(`campaign-topbar-${s.tag}`));
      await unclipView(page);
      await expect.soft(page.locator('#view')).toHaveScreenshot(`campaign-view-${s.tag}.png`, shotC1(`campaign-view-${s.tag}`));
      await page.locator('[data-pool=next]').click();
      await expect(page.locator('#view tbody tr')).toHaveCount(9);
      expect(await page2(page)).toEqual(legacyPage2);
    });

    test('campaign lead tables match the prototype (campaign, all campaigns, auto campaign)', async ({ page }) => {
      const views = async (p: Page) => {
        const out = [];
        await p.locator('[data-camp=c-bebe-nov]').click();
        await expect(p.locator('.quota')).toBeVisible();
        await settleWork(p);
        out.push(await campaignText(p));
        await p.locator('[data-camp=CAMPS]').click();
        await settleWork(p);
        out.push(await campaignText(p));
        return out;
      };
      await openLegacyCampaign(page, 'bebeplay', 50);
      const legacy = await views(page);
      await page.locator('[data-camp=c-bebe-nov]').click();
      await unclipView(page);
      await shootLegacy(page, `campaign-table-${s.tag}`, '#view');
      await openLegacyCampaign(page, 'hosttail', 29);
      await page.locator('[data-camp=c-host-nov]').click();
      await settleWork(page);
      const legacyAuto = await campaignText(page);
      expect(legacyAuto.quota).toContain('วิธีจอง: เด้งเข้าเซลล์ที่ขายล่าสุด');

      await openAppCampaign(page, 'bebeplay', 50);
      expect(await views(page)).toEqual(legacy);
      await page.locator('[data-camp=c-bebe-nov]').click();
      await unclipView(page);
      await expect.soft(page.locator('#view')).toHaveScreenshot(`campaign-table-${s.tag}.png`, shotC1(`campaign-table-${s.tag}`));
      await openAppCampaign(page, 'hosttail', 29);
      await page.locator('[data-camp=c-host-nov]').click();
      await settleWork(page);
      expect(await campaignText(page)).toEqual(legacyAuto);
    });

    test('pool customer popup matches the prototype (reserved by another rep, mine)', async ({ page }) => {
      await compareStepsOn(page, [
        { name: `pool-detail-${s.tag}`, act: press('[data-pool-open=C5018]', '.modal .info-grid') },
        { name: `pool-detail-mine-${s.tag}`, act: press('[data-pool-open=C5016]', '.modal [data-act=unclaim]') },
      ], (p) => openLegacyCampaign(p, 'bebeplay', 50), (p) => openAppCampaign(p, 'bebeplay', 50));
    });

    test('campaign builder matches the prototype (every tab, criterion, preview)', async ({ page }) => {
      await compareStepsOn(page, [
        { name: `builder-base-${s.tag}`, act: press('#new-camp', '#cf-name') },
        {
          name: `builder-set-${s.tag}`,
          act: async (p) => {
            await p.locator('#cf-name').fill('แคมเปญทดสอบ');
            await click('[data-ca=next]', '.radio-card')(p);
          },
        },
        { name: `builder-aud-${s.tag}`, act: click('[data-ca=next]', '#funnel') },
        {
          name: `builder-crit-${s.tag}`,
          act: async (p) => {
            await click('[data-ca=add]', '.crit-row')(p);
            await p.locator('[data-cf="0:kw"]').fill('เตียง');
          },
        },
        { name: `builder-preview-${s.tag}`, act: click('[data-ca=prev]', '#funnel .mini-table') },
      ], (p) => openLegacyCampaign(p, 'bebeplay', 50), (p) => openAppCampaign(p, 'bebeplay', 50));
    });

    // /mine และ /pool ไม่มีใน prototype: ตรวจ DOM + ภาพของตัวเอง (baseline commit ไว้ที่ e2e/.legacy-shots/app/ สร้างด้วย --update-snapshots=missing)
    test('my customers and the central pool render the base customer table', async ({ page }) => {
      for (const [path, rows, first] of [['mine', 7, 'ยกเลิกจอง'], ['pool', 50, 'จอง']] as const) {
        await page.goto(`${APP}/${path}`);
        await expect(page.locator('#view tbody tr')).toHaveCount(rows, { timeout: 60_000 });
        await expect(page.locator('#page-title')).toHaveText(path === 'mine' ? 'ลูกค้าของฉัน' : 'ถังกลาง');
        await expect(page.locator('#view thead th')).toHaveText(['ชื่อ / เบอร์', 'ไม่ซื้อมา / tag', 'กลุ่มลูกค้า', 'ยอดซื้อสะสม', 'ออเดอร์', 'ซื้อล่าสุด', 'แบรนด์', '']);
        await expect(page.locator('#view tbody tr').first().locator('td').nth(1)).toContainText(/^ไม่ซื้อมา [\d,]+ วัน/);
        await expect(page.locator('#view tbody tr').first().locator('td:last-child button')).toHaveText(first);
        await expect(page.locator('#base-brand option')).toHaveText(['ทุกแบรนด์', 'Bebeplay', 'Hosttail']);
        if (INJECT) await page.addStyleTag({ content: INJECT });
        await unclipView(page);
        await expect.soft(page.locator('#view')).toHaveScreenshot(['app', `${path}-${s.tag}.png`], { maxDiffPixels: 0, threshold: 0.1 });
      }
      await page.locator('#base-brand').selectOption('hosttail');
      await expect(page.locator('#view tbody tr td:nth-child(7)').first()).toHaveText('Hosttail');
      expect(new Set(await page.locator('#view tbody tr td:nth-child(7)').allInnerTexts())).toEqual(new Set(['Hosttail']));
    });
  });
}
