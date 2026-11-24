import { expect, test, type Page } from '@playwright/test';

// ตัวสลับแบรนด์ใหญ่ใน topbar (แผน 2026-11-23 global brand filter) — ไม่มีใน prototype: ตรวจ DOM ของตัวเอง
// test นี้ไม่ตั้ง localStorage (spec อื่นตั้ง 'all') เพื่อดูค่าเริ่ม = Bebeplay
// fixture (legacy/data.js): ลีด 28 แถว = Bebeplay 19 + Hosttail 9, แคมเปญ Bebeplay 2 อัน (c-bebe-nov, c-bebe-oct) + Hosttail 1 อัน (c-host-nov)
// ผู้ใช้ fixture "Dev MPD" เป็นหัวหน้า → มีตัวเลือก "ทั้งหมด"
const APP = 'http://127.0.0.1:3100';
const SIZES = [
  { tag: 'mobile', width: 390, height: 844 },
  { tag: 'desktop', width: 1440, height: 900 },
] as const;
type Scope = 'bebeplay' | 'hosttail' | 'all';
const ROWS: Record<Scope, number> = { bebeplay: 19, hosttail: 9, all: 28 };
const CAMP_BEBE = ['Bebeplay · ลูกค้าเก่า 6 เดือน', 'Bebeplay · Double Date 10.10'];
const CAMP_HOST = ['Hosttail · ทาสแมวกลับมาซื้อ'];
const CAMP_OPTIONS: Record<Scope, string[]> = {
  bebeplay: ['แคมเปญทั้งหมด', 'เซลล์ขุดเอง', ...CAMP_BEBE],
  hosttail: ['แคมเปญทั้งหมด', 'เซลล์ขุดเอง', ...CAMP_HOST],
  all: ['แคมเปญทั้งหมด', 'เซลล์ขุดเอง', 'Bebeplay · ลูกค้าเก่า 6 เดือน', 'Hosttail · ทาสแมวกลับมาซื้อ', 'Bebeplay · Double Date 10.10'],
};
const MENU: Record<Scope, string[]> = {
  bebeplay: ['campaign-bebeplay'],
  hosttail: ['campaign-hosttail'],
  all: ['campaign-bebeplay', 'campaign-hosttail'],
};

const storedBrand = (page: Page) => page.evaluate(() => localStorage.getItem('dsales.brand'));

for (const s of SIZES) {
  const mobile = s.tag === 'mobile';

  async function pick(page: Page, b: Scope) {
    if (mobile) await page.locator('#brand-switch').selectOption(b);
    else await page.locator(`[data-brand-pick=${b}]`).click();
  }

  async function expectSwitch(page: Page, b: Scope) {
    await expect(page.locator('.brand-switch')).toHaveAttribute('data-scope', b);
    if (mobile) {
      await expect(page.locator('#brand-switch')).toBeVisible();
      await expect(page.locator('.brand-seg')).toBeHidden();
      await expect(page.locator('#brand-switch')).toHaveValue(b);
    } else {
      await expect(page.locator('.brand-seg')).toBeVisible();
      await expect(page.locator('#brand-switch')).toBeHidden();
      await expect(page.locator('[data-brand-pick][aria-pressed=true]')).toHaveAttribute('data-brand-pick', b);
    }
  }

  /** หน้า /leads แสดงเฉพาะลีด/แคมเปญ/เมนูของแบรนด์ที่เลือก */
  async function expectLeads(page: Page, b: Scope) {
    await expectSwitch(page, b);
    await expect(page.locator('#view tbody tr')).toHaveCount(ROWS[b]);
    await expect(page.locator('#camp-sel option')).toHaveText(CAMP_OPTIONS[b]);
    const menu = page.locator('#sidebar .nav-item[data-route^="campaign-"]');
    await expect(menu).toHaveCount(MENU[b].length);
    expect(await menu.evaluateAll((els) => els.map((e) => e.getAttribute('data-route')))).toEqual(MENU[b]);
    // ตารางไม่มีชื่อแคมเปญของอีกแบรนด์
    const other = b === 'bebeplay' ? CAMP_HOST : b === 'hosttail' ? CAMP_BEBE : [];
    for (const name of other) await expect(page.locator('#view tbody')).not.toContainText(name);
  }

  test.describe(`brand switch ${s.tag} ${s.width}x${s.height}`, () => {
    test.use({ viewport: { width: s.width, height: s.height } });

    test('defaults to Bebeplay, switching to Hosttail filters /leads and the menu and survives a reload', async ({ page }) => {
      await page.goto(`${APP}/leads`);
      await expect(page.locator('#view tbody tr').first()).toBeVisible({ timeout: 60_000 });
      expect(await storedBrand(page)).toBeNull();
      await expectLeads(page, 'bebeplay');
      // หัวหน้าเห็น "ทั้งหมด"
      if (mobile) await expect(page.locator('#brand-switch option')).toHaveText(['Bebeplay', 'Hosttail', 'ทั้งหมด']);
      else await expect(page.locator('[data-brand-pick]')).toHaveText(['Bebeplay', 'Hosttail', 'ทั้งหมด']);

      await pick(page, 'hosttail');
      await expectLeads(page, 'hosttail');
      expect(await storedBrand(page)).toBe('hosttail');

      await page.reload();
      await expect(page.locator('#view tbody tr').first()).toBeVisible({ timeout: 60_000 });
      await expectLeads(page, 'hosttail');

      await pick(page, 'all');
      await expectLeads(page, 'all');
      expect(await storedBrand(page)).toBe('all');
    });

    test('opening the Hosttail campaign page switches the brand; switching back goes to the Bebeplay campaign page', async ({ page }) => {
      await page.goto(`${APP}/campaigns/hosttail`);
      await expect(page.locator('#page-title')).toHaveText('แคมเปญ Hosttail', { timeout: 60_000 });
      expect(await storedBrand(page)).toBe('hosttail');
      await expect(page.locator('#sidebar .nav-item[data-route^="campaign-"]')).toHaveCount(1);
      await expect(page.locator('#sidebar .nav-item.active')).toHaveAttribute('data-route', 'campaign-hosttail');
      if (mobile) {
        // หน้าแคมเปญเป็นของแบรนด์เดียวอยู่แล้ว: บนมือถือซ่อนตัวสลับ ให้ชื่อหน้า + ปุ่มพอดีแถวเดียว
        await expect(page.locator('.brand-switch')).toHaveAttribute('data-scope', 'hosttail');
        await expect(page.locator('.brand-switch')).toBeHidden();
        expect(await page.locator('#page-title').evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
        return;
      }
      await expectSwitch(page, 'hosttail');

      await pick(page, 'bebeplay');
      await expect(page).toHaveURL(`${APP}/campaigns/bebeplay`);
      await expect(page.locator('#page-title')).toHaveText('แคมเปญ Bebeplay');
      await expectSwitch(page, 'bebeplay');
      await expect(page.locator('#sidebar .nav-item.active')).toHaveAttribute('data-route', 'campaign-bebeplay');
    });

    if (mobile) {
      test('the topbar stays on one row with the brand dropdown and the dropdown is a 44px tap target', async ({ page }) => {
        await page.goto(`${APP}/leads`);
        await expect(page.locator('#view tbody tr').first()).toBeVisible({ timeout: 60_000 });
        for (const b of ['bebeplay', 'hosttail', 'all'] as const) {
          await pick(page, b);
          await expectSwitch(page, b);
          const m = await page.evaluate(() => ({
            topbar: (document.querySelector('.topbar') as HTMLElement).getBoundingClientRect().height,
            select: (document.querySelector('#brand-switch') as HTMLElement).getBoundingClientRect().height,
            overflow: document.documentElement.scrollWidth - window.innerWidth,
            titleCut: (() => { const h = document.querySelector('#page-title') as HTMLElement; return h.scrollWidth - h.clientWidth; })(),
          }));
          expect(m.titleCut, `page title cut off (${b})`).toBeLessThanOrEqual(0);
          expect(m.topbar, `topbar wraps (${b})`).toBeLessThanOrEqual(72);
          expect(m.select, `dropdown height (${b})`).toBeGreaterThanOrEqual(44);
          expect(m.overflow, `page scrolls sideways (${b})`).toBeLessThanOrEqual(0);
        }
      });
    }
  });
}
