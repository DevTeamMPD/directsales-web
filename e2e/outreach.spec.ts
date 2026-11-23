import { expect, test, type Page } from '@playwright/test';
import { FIXTURE_NO_WRITE } from '../lib/constants';

// ส่งข้อความผ่าน JST worker (spec 2026-11-20 ข้อ 6) — หน้าใหม่ไม่มีใน prototype: ตรวจ DOM + ภาพของตัวเอง
// (baseline ใน e2e/__screenshots__/app/) โหมด fixture: ข้อมูลจาก lib/fixtures/outreach.ts
const APP = 'http://127.0.0.1:3100';
const SIZES = [
  { tag: 'mobile', width: 390, height: 844 },
  { tag: 'desktop', width: 1440, height: 900 },
] as const;
const TEST_MODE_TEXT = 'โหมดทดสอบ: ข้อความทั้งหมดจะถูกส่งไปห้องทดสอบ';
const OWN = { maxDiffPixelRatio: 0.001, threshold: 0.1 } as const;

async function settle(page: Page) {
  await page.mouse.move(0, 0);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.waitForTimeout(200);
}

/** .main เป็นกล่อง scroll สูงเท่าจอ — ปลดให้ยาวตามเนื้อหาก่อนถ่าย #view (เหมือน visual-parity.spec.ts) */
async function unclip(page: Page) {
  await page.addStyleTag({
    content: 'html, body, .app, .main { height: auto !important; } .main { overflow: visible !important; } .topbar { position: static !important; }',
  });
  await settle(page);
}

for (const s of SIZES) {
  test.describe(`outreach ${s.tag} ${s.width}x${s.height}`, () => {
    test.use({ viewport: { width: s.width, height: s.height } });

    test('select customers on the pool, preview the message and send (fixture toast)', async ({ page }) => {
      await page.goto(`${APP}/pool`);
      await expect(page.locator('#view tbody tr')).toHaveCount(50, { timeout: 60_000 });
      await expect(page.locator('#sel-bar')).toHaveCount(0);
      const boxes = page.locator('#view tbody input[data-sel]');
      await boxes.nth(0).check();
      await boxes.nth(1).check();
      await expect(page.locator('#sel-bar b')).toHaveText('เลือก 2 คน');
      await expect(page.locator('#base-sel-page')).not.toBeChecked();
      // จำที่เลือกข้ามหน้า
      if (await page.locator('[data-pool=next]').isEnabled()) {
        await page.locator('[data-pool=next]').click();
        await expect(page.locator('#sel-bar b')).toHaveText('เลือก 2 คน');
        await page.locator('[data-pool=prev]').click();
        await expect(boxes.nth(0)).toBeChecked();
      }
      // หัวตารางเลือกทั้งหน้า (50 = เต็มเพดาน) แล้วเอาออก → กลับไปไม่มีที่เลือก
      await page.locator('#base-sel-page').check();
      await expect(page.locator('#sel-bar b')).toHaveText('เลือก 50 คน');
      await expect(page.locator('#sel-send')).toBeEnabled();
      await page.locator('#base-sel-page').uncheck();
      await expect(page.locator('#sel-bar')).toHaveCount(0);

      // แถว 1-2 = ลูกค้า Hosttail (มีห้อง Hosttail เท่านั้น), แถว 11 = ลูกค้า Bebeplay ที่มีห้อง LINE ของ Hosttail ด้วย (fixture chat_rooms)
      await boxes.nth(0).check();
      await boxes.nth(1).check();
      await boxes.nth(10).check();
      await expect(page.locator('#sel-bar b')).toHaveText('เลือก 3 คน');
      await page.locator('#sel-send').click();
      const modal = page.locator('.modal');
      await expect(modal.locator('h3')).toHaveText('ส่งข้อความ');
      // แบรนด์เริ่มต้น = แบรนด์ที่คนที่เลือกมีห้องแชตมากที่สุด
      await expect(page.locator('#so-brand')).toHaveValue('hosttail');
      await expect(page.locator('#so-brand-hint')).toHaveText('1 คนมีห้องของ Bebeplay · 3 คนมีห้องของ Hosttail');
      await expect(page.locator('#so-template option')).toHaveText(['ทาสแมวกลับมาซื้อ']);
      await expect(page.locator('#so-summary')).toHaveText('จะส่ง 3 รายการ · ข้าม 0 รายการ');
      await expect(page.locator('[data-preview]').first()).toContainText('สวัสดีครับ');
      await expect(page.locator('#so-send')).toHaveText('ส่ง 3 รายการ');

      // เปลี่ยนเป็น Bebeplay: ลูกค้า Hosttail ถูกข้าม พร้อมบอกว่ามีห้องของอีกแบรนด์
      await page.locator('#so-brand').selectOption('bebeplay');
      await expect(page.locator('#so-template option')).toHaveText(['ทักลูกค้าเก่า 6 เดือน']);
      await expect(page.locator('#so-summary')).toHaveText('จะส่ง 1 รายการ · ข้าม 2 รายการ');
      await expect(page.locator('[data-skip] .badge')).toHaveText(['มีห้องแชตของ Hosttail — เปลี่ยนแบรนด์ด้านบน', 'มีห้องแชตของ Hosttail — เปลี่ยนแบรนด์ด้านบน']);
      await expect(page.locator('#so-send')).toHaveText('ส่ง 1 รายการ');
      await settle(page);
      await expect.soft(modal).toHaveScreenshot(['app', `send-outreach-${s.tag}.png`], OWN);
      await expect(page.locator('#so-send')).toBeEnabled();
      await page.locator('#so-send').click();
      await expect(page.locator('#toast')).toHaveText(FIXTURE_NO_WRITE);
    });

    test('pool filters change the result count and the rows show the contact channels', async ({ page }) => {
      await page.goto(`${APP}/pool`);
      await expect(page.locator('#view tbody tr')).toHaveCount(50, { timeout: 60_000 });
      await expect(page.locator('#base-count')).toHaveText('พบ 67 คน');
      await expect(page.locator('#base-clear')).toBeDisabled();
      await expect(page.locator('[data-rfm]')).toHaveText(['Loyal', 'Potential', 'Promising', 'At Risk', 'Hibernating', 'Unscored', 'ยังไม่จัดกลุ่ม']);
      await expect(page.locator('#base-sort option')).toHaveText(['มูลค่าสูงสุด', 'หายนานสุด', 'เพิ่งหายไป', 'ซื้อล่าสุด', 'ซื้อบ่อยสุด']);
      await expect(page.locator('#base-tag')).toBeVisible(); // Dev MPD เป็นหัวหน้า

      // คอลัมน์ช่องทาง: ปุ่มโทร + ไอคอนห้องแชตทุกแถว ห้องที่ worker ส่งไม่ได้แสดงจางพร้อมเหตุผล
      const first = page.locator('#view tbody tr').first();
      await expect(first.locator('td').nth(2).locator('[data-call]')).toHaveCount(1);
      await expect(first.locator('[data-room] img')).toHaveCount(3);
      expect(JSON.parse((await first.locator('[data-room]').first().getAttribute('data-t')) ?? '{}')).toMatchObject({
        shop: 'LOA_hosttail', platform: 'line', brand: 'hosttail', chat: 'mom_ploy150_loa',
      });
      await expect(page.locator('#view tbody tr').nth(2).locator('[data-sendable="0"]')).toHaveCount(2);
      await expect(page.locator('#view tbody tr').nth(2).locator('[data-sendable="0"]').last()).toHaveAttribute('title', /เพจนอกแบรนด์/);
      await expect(page.locator('#view tbody tr').nth(2).locator('[data-sendable="0"]').first()).toHaveAttribute('title', /เกิน 7 วัน ส่งผ่าน worker ไม่ได้/);

      // ที่ติ๊กไว้คงอยู่หลังเปลี่ยนตัวกรอง
      await page.locator('#view tbody input[data-sel]').first().check();
      await page.locator('[data-rfm=Loyal]').click();
      await expect(page.locator('[data-rfm=Loyal]')).toHaveClass(/active/);
      await expect(page.locator('#base-count')).toHaveText('พบ 3 คน');
      await expect(page.locator('#view tbody tr')).toHaveCount(3);
      expect(new Set(await page.locator('#view tbody tr td:nth-child(5)').allInnerTexts())).toEqual(new Set(['Loyal']));
      await expect(page).toHaveURL(/\/pool\?rfm=Loyal$/);
      await expect(page.locator('#sel-bar b')).toHaveText('เลือก 1 คน');
      await expect(page.locator('#base-clear')).toBeEnabled();

      await page.locator('#base-chat').click();
      await page.locator('#base-provider').selectOption('facebook');
      await expect(page.locator('#base-count')).toHaveText('พบ 2 คน');
      for (const tr of await page.locator('#view tbody tr').all()) await expect(tr.locator('[data-room] img[alt=Facebook]').first()).toBeVisible();

      await page.locator('#base-clear').click();
      await expect(page.locator('#base-count')).toHaveText('พบ 67 คน');
      await expect(page.locator('[data-rfm=Loyal]')).not.toHaveClass(/active/);
      await expect(page).toHaveURL(/\/pool$/);

      await page.locator('#base-dormant').selectOption('366-');
      await page.locator('#base-sort').selectOption('dormant_desc');
      await expect(page.locator('#base-count')).toHaveText(/^พบ \d+ คน$/);
      const days = (await page.locator('#view tbody tr td:nth-child(4) > div').allInnerTexts()).map((t) => Number(t.replace(/\D/g, '')));
      expect(days.length).toBeGreaterThan(0);
      expect(days.every((d) => d > 365)).toBe(true);
      expect(days).toEqual([...days].sort((a, b) => b - a));
    });

    test('outreach page lists the batches and opens the batch detail', async ({ page }) => {
      await page.goto(`${APP}/outreach`);
      await expect(page.locator('#ob-table tbody tr')).toHaveCount(2, { timeout: 60_000 });
      await expect(page.locator('#page-title')).toHaveText('ส่งข้อความ');
      await expect(page.locator('.nav-item.active')).toHaveAttribute('data-route', 'outreach');
      await expect(page.locator('[data-banner]')).toHaveText([TEST_MODE_TEXT]);
      await expect(page.locator('#ob-table thead th')).toHaveText(['เวลา', 'แบรนด์', 'Template', 'ผู้ส่ง', 'จำนวน', 'สถานะ']);
      await expect(page.locator('#ob-table tbody tr').first()).toContainText('4/11/2026 09:15');
      await expect(page.locator('#ob-table tbody tr').first().locator('.badge')).toHaveText(['ส่งแล้ว 2', 'รอส่ง 1', 'กำลังส่ง 1', 'ไม่สำเร็จ 1', 'ข้าม 1']);

      await page.locator('[data-batch=ob-demo-1]').click();
      const detail = page.locator('#ob-detail');
      await expect(detail.locator('tbody tr')).toHaveCount(5);
      await expect(detail.locator('tbody .badge')).toHaveText(['ส่งแล้ว', 'ส่งแล้ว', 'กำลังส่ง', 'ไม่สำเร็จ', 'รอส่ง']);
      await expect(detail.locator('[data-item=oq-4]')).toContainText('หมดช่วงส่งข้อความ');
      await expect(detail.locator('[data-item=oq-4] [data-call]')).toHaveAttribute('href', 'tel:0924363271');
      await expect(page.locator('#ob-skipped')).toContainText('ไม่พบห้องแชตของแบรนด์นี้');
      await expect(page.locator('#ob-cancel')).toBeDisabled();
      await unclip(page);
      await expect.soft(page.locator('#view')).toHaveScreenshot(['app', `outreach-${s.tag}.png`], OWN);

      await detail.locator('[data-item=oq-5] input[type=checkbox]').check();
      await expect(page.locator('#ob-cancel')).toHaveText('ยกเลิกที่เลือก (1)');
      await page.locator('#ob-cancel').click();
      await expect(page.locator('#toast')).toHaveText(FIXTURE_NO_WRITE);
    });

    test('setup shows the Template and Worker cards', async ({ page }) => {
      await page.goto(`${APP}/setup`);
      await expect(page.locator('#tpl-panel')).toBeVisible({ timeout: 60_000 });
      await expect(page.locator('#tpl-panel h2')).toHaveText('Template ข้อความ');
      await expect(page.locator('#tpl-panel [data-tpl]')).toHaveCount(2);
      await expect(page.locator('#tpl-panel [data-tpl] .badge')).toHaveText(['เปิดใช้', 'ปิดใช้']);
      await page.locator('#tpl-brand').selectOption('hosttail');
      await expect(page.locator('#tpl-panel [data-tpl]')).toHaveCount(1);
      await page.locator('#tpl-body').fill('สวัสดี {ชื่อ} จาก {ร้าน} {ส่วนลด}');
      await expect(page.locator('#tpl-preview')).toContainText('สวัสดี คุณสมใจ จาก Bebeplayofficial {ส่วนลด}');
      await expect(page.locator('#tpl-preview')).toContainText('ไม่รู้จักตัวแปร {ส่วนลด}');
      await page.locator('#tpl-save').click();
      await expect(page.locator('#tpl-panel .login-err')).toHaveText('ใส่ชื่อ template');
      await page.locator('#tpl-name').fill('ทดสอบ');
      await page.locator('#tpl-save').click();
      await expect(page.locator('#toast')).toHaveText(FIXTURE_NO_WRITE);

      await expect(page.locator('#wk-panel h2')).toHaveText('Worker ส่งข้อความ');
      await expect(page.locator('[data-worker=office-pc-1]')).toContainText('ออนไลน์');
      await expect(page.locator('[data-worker=office-pc-1] .badge')).toHaveText('กำลังทำงาน');
      await expect(page.locator('#wk-interval')).toHaveValue('60');
      await expect(page.locator('#wk-test')).toBeChecked();
      await expect(page.locator('#wk-rooms [data-room]')).toHaveText(['Dev MPD · LINE · bebeplayspace (900001) ✕']);
      await page.locator('#wk-room-q').fill('Dev');
      await page.locator('#wk-room-search button').click();
      await expect(page.locator('[data-room-result]')).toHaveCount(2);
      await page.locator('[data-room-result="900002"] button').click();
      await expect(page.locator('#wk-rooms [data-room]')).toHaveCount(2);
      await page.locator('#wk-interval').fill('3');
      await page.locator('#wk-save').click();
      await expect(page.locator('#wk-panel .login-err')).toContainText('5–3600');
      await page.locator('#wk-interval').fill('90');
      await page.locator('#wk-save').click();
      await expect(page.locator('#toast')).toHaveText(FIXTURE_NO_WRITE);
    });
  });
}
