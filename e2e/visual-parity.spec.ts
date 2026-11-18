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
