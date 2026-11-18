import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { PATHS } from '../lib/constants';

const LEGACY = 'http://127.0.0.1:4100/index.html';
const APP = 'http://127.0.0.1:3100';
const SIZES = [
  { tag: 'mobile', width: 375, height: 812 },
  { tag: 'desktop', width: 1280, height: 800 },
] as const;
// เกณฑ์ผ่าน: พิกเซลที่ต่างไม่เกิน 0.5% ของภาพ (threshold 0.1 = ความต่างสีต่อพิกเซลที่ยังนับว่าเหมือน) ห้ามขยายเกณฑ์เพื่อให้ผ่าน
const SAME = { maxDiffPixelRatio: 0.005, threshold: 0.1 } as const;
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

async function shootLegacy(page: Page, name: string) {
  await page.screenshot({ path: legacyShot(name), animations: 'disabled', caret: 'hide' });
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
  await settle(page);
}

for (const s of SIZES) {
  test.describe(`${s.tag} ${s.width}x${s.height}`, () => {
    test.use({ viewport: { width: s.width, height: s.height } });

    test('shell matches the prototype', async ({ page }) => {
      const name = `shell-${s.tag}`;
      await openLegacyShell(page);
      await shootLegacy(page, name);
      await openAppShell(page);
      await expect(page).toHaveScreenshot(`${name}.png`, SAME);
    });

    if (s.tag === 'mobile') {
      test('shell with the menu open matches the prototype', async ({ page }) => {
        const name = 'shell-menu-mobile';
        await openLegacyShell(page);
        await page.locator('#menu-btn').click();
        await expect(page.locator('#sidebar')).toHaveClass(/\bopen\b/);
        await shootLegacy(page, name);
        await openAppShell(page);
        await page.locator('#menu-btn').click();
        await expect(page.locator('#sidebar')).toHaveClass(/\bopen\b/);
        await expect(page).toHaveScreenshot(`${name}.png`, SAME);
      });
    }

    test('login matches the prototype (without the demo button)', async ({ page }) => {
      const name = `login-${s.tag}`;
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
      await shootLegacy(page, name);
      await page.goto(`${APP}/login`);
      await expect(page.locator('#login-form')).toBeVisible({ timeout: 60_000 });
      await settle(page);
      await expect(page).toHaveScreenshot(`${name}.png`, SAME);
    });
  });
}
