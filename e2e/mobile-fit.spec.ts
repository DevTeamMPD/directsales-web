import { expect, test } from '@playwright/test';
import { expectAllBrands, pinAllBrands } from './brand-pin';

// มือถือ 390px: ทุกหน้าต้องไม่เลื่อนแนวนอนทั้งหน้า (ตารางเลื่อนในกล่องของตัวเองได้), ปุ่มบน topbar อยู่แถวเดียว,
// แถวชิปสถานะไม่ตัดหลายบรรทัด และปุ่ม/ช่องกรอกที่แตะได้สูงอย่างน้อย 44px
const APP = 'http://127.0.0.1:3100';
const PAGES = ['/leads', '/mine', '/pool', '/rfm', '/outreach', '/campaigns/bebeplay', '/campaigns/hosttail', '/dashboard', '/setup'];

test.use({ viewport: { width: 390, height: 844 } });
// เมนูครบทุกแบรนด์ (9 เมนู) — ตัวสลับแบรนด์ที่ 390px ตรวจเพิ่มใน brand-switch.spec.ts
test.beforeEach(async ({ page }) => {
  await pinAllBrands(page);
});

for (const path of PAGES) {
  test(`fits a 390px phone: ${path}`, async ({ page }) => {
    await page.goto(`${APP}${path}`);
    await expect(page.locator('#view > *').first()).toBeVisible({ timeout: 60_000 });
    await expectAllBrands(page);
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    const m = await page.evaluate(() => {
      const main = document.querySelector('.main') as HTMLElement;
      const topbar = document.querySelector('.topbar') as HTMLElement;
      const chipRow = document.querySelector('.chip-row');
      const chipTops = new Set(Array.from(chipRow?.children ?? []).map((c) => Math.round(c.getBoundingClientRect().top)));
      const small = Array.from(document.querySelectorAll<HTMLElement>('.topbar .btn, .topbar .icon-btn, .topbar .select, #view .btn:not(.sm), #view .select, #view .input:not([type=checkbox]), #view .search'))
        .filter((el) => el.offsetParent !== null && el.getBoundingClientRect().height < 44)
        .map((el) => `${el.tagName}.${el.className}#${el.id} ${Math.round(el.getBoundingClientRect().height)}px`);
      return {
        pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
        mainOverflow: main.scrollWidth - main.clientWidth,
        topbarHeight: topbar.getBoundingClientRect().height,
        chipLines: chipRow ? chipTops.size : 1,
        small,
      };
    });
    expect(m.pageOverflow, 'page scrolls sideways').toBeLessThanOrEqual(0);
    expect(m.mainOverflow, 'content scrolls sideways').toBeLessThanOrEqual(0);
    expect(m.topbarHeight, 'topbar wraps onto a second line').toBeLessThanOrEqual(72);
    expect(m.chipLines, 'status chips wrap').toBe(1);
    expect(m.small, 'touch targets under 44px').toEqual([]);
  });
}

test('menu drawer opens and lists every page without scrolling sideways', async ({ page }) => {
  await page.goto(`${APP}/leads`);
  await expect(page.locator('#view tbody tr').first()).toBeVisible({ timeout: 60_000 });
  await page.locator('#menu-btn').click();
  await expect(page.locator('#sidebar')).toHaveClass(/\bopen\b/);
  const items = page.locator('#sidebar .nav-item');
  await expect(items).toHaveCount(9);
  for (const h of await items.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) expect(h).toBeGreaterThanOrEqual(44);
  const sb = await page.locator('#sidebar').evaluate((el) => ({ w: el.getBoundingClientRect().width, over: el.scrollWidth - el.clientWidth }));
  expect(sb.w).toBeLessThanOrEqual(300);
  expect(sb.over).toBeLessThanOrEqual(0);
});
