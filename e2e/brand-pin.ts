import { expect, type Page } from '@playwright/test';

/**
 * spec ที่เทียบกับ prototype (ซึ่งแสดงทุกแบรนด์) ตั้งแบรนด์ใหญ่เป็น "ทั้งหมด" ก่อนเปิดหน้าแอป (ผู้ใช้ fixture เป็นหัวหน้า)
 * ตั้งทุกครั้งที่โหลดหน้า (รวม reload/goto) เฉพาะแอป = พอร์ต 3100 ไม่แตะ prototype (4100)
 */
export async function pinAllBrands(page: Page) {
  await page.addInitScript(() => {
    try {
      if (location.port === '3100') localStorage.setItem('dsales.brand', 'all');
    } catch {
      /* storage ปิดอยู่ */
    }
  });
}

/** รอให้แอปอ่านค่าที่ตั้งไว้แล้ว (เฟรมแรกอาจเป็นค่าเริ่ม Bebeplay) ก่อนเก็บข้อความ/ถ่ายภาพ */
export async function expectAllBrands(page: Page) {
  await expect(page.locator('.brand-switch')).toHaveAttribute('data-scope', 'all', { timeout: 60_000 });
}
