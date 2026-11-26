import { expect, test } from '@playwright/test';
import { expectAllBrands, pinAllBrands } from './brand-pin';

// หน้า /rfm (โหมด fixture: ผู้ใช้ Dev MPD หัวหน้า): แผนที่กลุ่ม → การ์ดแนวทาง → รายชื่อที่กรองตามกลุ่ม
const APP = 'http://127.0.0.1:3100';

test.beforeEach(async ({ page }) => {
  await pinAllBrands(page);
});

for (const size of [{ tag: 'desktop', width: 1440, height: 900 }, { tag: 'mobile', width: 390, height: 844 }]) {
  test(`rfm map filters the customer list (${size.tag})`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto(`${APP}/rfm`);
    await expect(page.locator('#page-title')).toHaveText('กลุ่มลูกค้า RFM', { timeout: 60_000 });
    await expectAllBrands(page);
    // 10 กลุ่ม + ส่วนที่สองของ Loyal = 11 ปุ่ม · หัวหน้าเริ่มที่ "ทั้งทีม"
    await expect(page.locator('#rfm-map .rfm-cell')).toHaveCount(11);
    await expect(page.locator('#rfm-map .rfm-cell .nm')).toHaveText(["Shouldn't Lose", 'Loyal', 'Champion', 'Sleepers', 'Need Attention', 'Promising', 'Lost', 'Cold', 'Warm', 'Hot']);
    await expect(page.locator('#rfm-scope .chip')).toHaveText(['ทั้งทีม', 'ลูกค้าของฉัน', 'ถังกลาง']);
    await expect(page.locator('#rfm-scope .chip.active')).toHaveText('ทั้งทีม');
    await expect(page.locator('#rfm-summary')).toContainText('จัดกลุ่มแล้ว');
    await expect(page.locator('#rfm-list')).toHaveCount(0);

    // เลือก Lost → การ์ดแนวทาง + รายชื่อเฉพาะ Lost + URL
    await page.locator('#rfm-map [data-seg="Lost"]').click();
    await expect(page).toHaveURL(/\/rfm\?seg=Lost$/);
    await expect(page.locator('#rfm-action')).toHaveAttribute('data-seg', 'Lost');
    await expect(page.locator('#rfm-action')).toContainText('หยุดส่ง');
    await expect(page.locator('#rfm-action')).toContainText('ลูกค้าที่เหลือทั้งหมดที่ไม่เข้ากลุ่มอื่น');
    await expect(page.locator('#base-fixed-rfm')).toHaveText('กลุ่ม: Lost');
    await expect(page.locator('[data-rfm]')).toHaveCount(0);
    const segs = await page.locator('#rfm-list tbody tr td:nth-child(5)').allInnerTexts();
    expect(segs.length).toBeGreaterThan(0);
    expect(new Set(segs)).toEqual(new Set(['Lost']));
    const shown = Number((await page.locator('#rfm-map [data-seg="Lost"] .n').innerText()).replace(/,/g, ''));
    await expect(page.locator('#rfm-n')).toHaveText(shown.toLocaleString('th-TH'));

    // โหลดใหม่แล้วยังอยู่ที่เดิม · เปลี่ยนขอบเขต · กดกลุ่มเดิมซ้ำ = เลิกเลือก
    await page.reload();
    await expect(page.locator('#rfm-map [data-seg="Lost"]').first()).toHaveAttribute('aria-pressed', 'true', { timeout: 60_000 });
    await page.locator('#rfm-scope [data-scope=pool]').click();
    await expect(page).toHaveURL(/seg=Lost&scope=pool$/);
    await page.locator('#rfm-map [data-seg="Lost"]').click();
    await expect(page.locator('#rfm-list')).toHaveCount(0);
    await expect(page).toHaveURL(/\/rfm\?scope=pool$/);

    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(over, 'page scrolls sideways').toBeLessThanOrEqual(0);
  });
}
