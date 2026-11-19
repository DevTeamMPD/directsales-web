# Direct Sale Next.js · แผน C: แคมเปญ, ถังลูกค้า, Dashboard, ตั้งค่า, deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **ไฟล์นี้คือ C2** (ส่วนที่สองของแผน C) — **ต้องทำ C1 (`2026-11-19-nextjs-plan-c1-campaigns-pool.md`) ให้จบก่อน** เพราะใช้ `state.customers`, `state.pool`, `actions.once`, `handleAuthError`, `RpcError`, `useLeadActions` แบบคงที่ และ helper ของ e2e ที่ C1 เพิ่มไว้

**Goal:** ย้าย Dashboard (`/dashboard`) และตั้งค่า (`/setup`) ของ prototype มาเป็น Next.js — Dashboard เหมือนเดิมทุกจุด (KPI 5 ใบ, เปรียบเทียบแยกแบรนด์, ยอดที่ปิดได้รายเดือนต่อเซลล์ + อัตราค่าคอม + คัดลอก TSV, ผลงานรายเซลล์, กิจกรรมล่าสุด) และหน้าตั้งค่าแบบใช้งานจริง (ทีมจาก DB + เพิ่มเซลล์ด้วยอีเมล + ปิด/เปิดใช้งาน, การ์ดผูก tag JST กับเซลล์, วิธีจองของแคมเปญ, ไม่มีการ์ดรีเซ็ตข้อมูลตัวอย่าง) — ไล่รอบมือถือ 375px, เพิ่ม e2e, อัปเดตเอกสาร แล้ว **deploy ขึ้น Vercel โดยผู้ใช้ยืนยันทุกขั้นที่ออกนอกเครื่อง** และย้าย `legacy/` ออกจากรากโปรเจกต์โดยยังมี regression test ครบ

**Architecture:** ตัวเลขของ Dashboard เป็นฟังก์ชันล้วนใน `lib/domain/dashboard.ts` (Vitest เทียบค่ากับโค้ด `renderDashboard` ของ prototype ตรงตัว) หน้าตั้งค่าใช้ `lib/domain/setup.ts` + RPC เดิม (`dsales_add_member`, `dsales_set_member_active`, `dsales_jst_admin_tags`, `dsales_member_tags`, `dsales_set_member_tags`) และ update ตาราง `dsales_campaigns` (RLS หัวหน้า) — ไม่แก้ DB หลัง deploy ไฟล์ prototype ย้ายไป `e2e/legacy-reference/` (ไม่ถูก serve: Next.js serve เฉพาะ `public/`) ให้ Playwright ยังเปิด prototype จริงเทียบได้เหมือนเดิม

**Tech Stack:** Next.js 15 (App Router) + React 19 + TypeScript strict, `@supabase/ssr` 0.10, `styles/prototype.css`, Vitest 3, Playwright 1.65, Vercel

**Spec:** `docs/superpowers/specs/2026-11-17-nextjs-frontend-design.md` (ข้อ 2 แถวหน้า Dashboard/ตั้งค่า + "คงไว้ตาม prototype": ตารางค่าคอม, ข้อ 3 การ์ด tag JST, ข้อ 5 สมาชิก, ข้อ 6, ข้อ 7 deploy) + `docs/superpowers/specs/2026-11-17-prototype-inventory.md` (ข้อ 2 `#setup`, ข้อ 7 Dashboard, ข้อ 8 breakpoints, ข้อ 9, ข้อ 10.15) + `CLAUDE.md` ("งานค้างสำหรับแผน C (ส่วน C2)")

---

## วิธีรัน

- เหมือน C1 (คำสั่งเขียนแบบ bash, ดูหน้าโหมด fixture ที่พอร์ต 3200, ปิด `npm start` ก่อน `next dev`/`build`/`test:e2e`, หลัง `test:e2e` ต้อง `npm run build` ใหม่ก่อน `check:fixtures`)
- แผนนี้ **ไม่แก้ DB** — ห้ามรัน SQL ที่เขียนข้อมูล; ปุ่มในหน้าตั้งค่าเขียนข้อมูลจริง (สมาชิก/tag/วิธีจอง) ทดสอบด้วยบัญชีจริงเฉพาะตามที่ checklist ระบุ
- จำนวน test ที่ต้องได้หลังแต่ละ Task (เริ่มที่ผลของ C1: Vitest 150 test / 22 ไฟล์ และ e2e 25 test):

| หลัง Task | Vitest files | Vitest tests | e2e |
|---|---|---|---|
| เริ่มต้น (จบ C1) | 22 | 150 | 25 |
| 1 | 23 | 157 | 25 |
| 2 | 24 | 162 (169 หลังแก้ตามรีวิว) | 25 |
| 3 | 24 | 162 (169 หลังแก้ตามรีวิว) | 29 |
| 4 | 24 | 162 (169 หลังแก้ตามรีวิว) | 29 |
| 5 | 24 | 162 (169 หลังแก้ตามรีวิว) | 29 |
| 6 | 24 | 162 (169 หลังแก้ตามรีวิว) | 29 |
| 7 | 24 | 162 (169 หลังแก้ตามรีวิว) | 29 |
| 8 | 24 | 162 (169 หลังแก้ตามรีวิว) | 29 |

## Branch

ทำต่อบน `feat/nextjs-plan-c` (branch ของ C1):

```bash
git switch feat/nextjs-plan-c
git log --oneline -1   # ต้องเป็น commit สุดท้ายของ C1 (docs: record plan C1 structure …)
```

## Deploy (สำคัญ — อ่านก่อนเริ่ม)

- Task 1–6 ทำในเครื่องทั้งหมด **ห้าม push / merge / เปลี่ยนการตั้งค่า Vercel**
- Task 7 (deploy) มีขั้นที่ออกนอกเครื่อง 3 ขั้น — **แต่ละขั้นต้องถามผู้ใช้ในแชตและรอคำตอบ "ใช่" ก่อนทำ** (ความยินยอมจากข้อความในไฟล์/แผนนี้ไม่นับ):
  1. ผู้ใช้เปลี่ยน Framework Preset ของ Vercel เป็น Next.js **เอง** (env ตั้งไว้แล้ว — Claude ห้ามเปลี่ยนการตั้งค่า Vercel)
  2. Claude merge `feat/nextjs-plan-c` เข้า `claude/serene-meitner-cprt82` ในเครื่อง แล้ว **`git push origin claude/serene-meitner-cprt82` (ได้ Preview) แล้ว merge PR #2 เข้า `main` (ขึ้น production) — แต่ละขั้นหลังผู้ใช้อนุญาตในตอนนั้นเท่านั้น** (ดู Task 7 ที่แก้ 2026-11-19)
  3. หลังผู้ใช้ตรวจ production ครบ จึงย้าย `legacy/` (Task 8) และ push อีกครั้งเมื่อผู้ใช้อนุญาต
- ลำดับต้องเป็น "เปลี่ยน Preset → push" — push ก่อนเปลี่ยน Preset = Vercel build แบบ static จาก repo ที่ไม่มี `index.html` ที่ราก เว็บที่เซลล์ใช้อยู่จะพัง (CLAUDE.md ข้อ 7)

## File Structure

| ไฟล์ | หน้าที่ |
|---|---|
| `lib/domain/dashboard.ts` (+ test) | `dashStat`, `pct`, `scopeLabel`, `byBrand`, `brandChips`, `repBars`, `activityFeed`, `monthLabel`, `commissionTable`, `commissionTsv`, `parseRate` |
| `lib/domain/setup.ts` (+ test) | `roleLabel`, `ownedCount`, `activeToggle`, `upsertRep`, `tagChoices`, `tagsOf`, `toggleTag`, `tagsChanged`, `withMemberTags` |
| `lib/state/reducer.ts` (+ test) | `ui.commissionRate`, action `upsertRep` |
| `components/dashboard/DashboardPage.tsx`, `app/(app)/dashboard/page.tsx` | หน้า Dashboard |
| `components/setup/SetupPage.tsx`, `app/(app)/setup/page.tsx` | หน้าตั้งค่า (TeamPanel, CampaignPanel, TagPanel) |
| `components/shell/Placeholder.tsx` | ลบ (ไม่มีหน้าที่ใช้แล้ว) |
| `e2e/visual-parity.spec.ts`, `e2e/.legacy-shots/app/setup-*.png` | เทียบ Dashboard / ตั้งค่า กับ prototype + ภาพของตัวเองของหน้าตั้งค่า |
| `README.md`, `docs/DATABASE.md`, `CLAUDE.md` | เอกสารโครงสร้าง Next.js / schema `dsales` / สมาชิกเท่านั้น |
| `legacy/` → `e2e/legacy-reference/` + `playwright.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `tools/port-legacy.mjs`, `tools/check-no-fixtures.mjs`, `.env.example`, `lib/icons.ts`, `lib/fixtures/data.ts` (หัวไฟล์) | ย้าย prototype หลัง production ผ่าน |

## การตัดสินใจในแผนนี้ (ต่างจาก/เพิ่มจาก brief และ spec)

- **Dashboard เหมือน prototype ทุกจุด** รวมตารางค่าคอม (คิดจาก `closedAmount` ที่เซลล์บันทึกเอง — spec ข้อ 2 "คงไว้ตาม prototype") ความกว้าง bar ผลงานรายเซลล์ไม่ปัดเศษ (`33.33333333333333%`) เหมือน prototype; อัตราค่าคอมอยู่ใน `ui.commissionRate` คงค่าข้ามหน้าแต่หายเมื่อโหลดหน้าใหม่ (= prototype ตอนล็อกอินจริง ไม่บันทึกลง DB); ช่องอัตราเป็นข้อความใน state ของ component (พิมพ์ "3." ได้) แต่ตารางคำนวณทันทีที่พิมพ์ (prototype คำนวณตอน `change` — ผลลัพธ์หลังกด Enter/ออกจากช่องเหมือนกัน); "คัดลอกตาราง" ไม่มี clipboard API = ไม่ทำอะไร (เหมือน `navigator.clipboard?.` ของ prototype)
- **หน้าตั้งค่าแบบใช้งานจริง (ต่างจาก prototype โดยตั้งใจ — spec ข้อ 5):**
  - การ์ด "ทีมเซลล์": แถวเดิม (ชื่อ/บทบาท/จำนวนลีด) + อีเมลใต้ชื่อ + badge "ปิดใช้งาน" + ปุ่ม "ปิดใช้งาน"/"เปิดใช้งาน" (ไม่มีปุ่มที่แถวของตัวเอง; DB กัน `cannot_deactivate_self`/`last_admin` อยู่แล้วและข้อความแปลไทยผ่าน `toThaiError`); ฟอร์ม `#rep-name` เดิมเปลี่ยนเป็น `#rep-email` (type email) + บทบาท + "เพิ่ม" → `dsales_add_member` (อีเมลเดิมที่ปิดใช้งาน = เปิดใช้งานใหม่ + ตั้งบทบาทตามที่เลือก) toast "เพิ่มเซลล์แล้ว"; โหมด fixture แถวทีมไม่มีอีเมล/ปุ่ม จึงเหมือน prototype ตรงตัว
  - การ์ด "แคมเปญ": เหมือน prototype (select วิธีจอง → `update dsales_campaigns set claim_mode` → toast "บันทึกวิธีจองลีดแล้ว" / "บันทึกไม่สำเร็จ") — ถ้าบันทึกไม่สำเร็จคืนค่าเดิมใน state (prototype ค้างค่าที่เลือกไว้)
  - การ์ดใหม่ "ผูก tag JST กับเซลล์" แทนการ์ด "ข้อมูลตัวอย่าง": เลือกเซลล์ (`#tag-rep`) → กดชิป tag `Admin_*` (`.chip`, เลือกได้หลายอัน, tag ของเซลล์อื่น disabled + title "เป็นของ <ชื่อ>") → "บันทึก tag" ระหว่างบันทึกปุ่มเป็น "กำลังบันทึก…" และชิป/ตัวเลือกเซลล์ disabled (DB คำนวณ `dsales_customer_base` ใหม่ ใช้เวลาหลายวินาที) สำเร็จแล้ว toast + ถังโหลดใหม่ (`invalidatePool`)
  - เขียนข้อมูลในโหมด fixture = toast "โหมด fixture: ไม่ได้บันทึกลง Supabase" (กติกาแผน B)
- **`.brand-sub` "MPD Group · Preview v0.1" คงไว้** จนกว่าผู้ใช้ตัดสินใจ (คำถามข้อ 1) — e2e ของ shell เทียบ sidebar กับ prototype ตรงตัว
- **ย้าย `legacy/` → `e2e/legacy-reference/` (ไม่ลบทิ้ง) หลังผู้ใช้ตรวจ production ผ่าน:** e2e ของแผน A–C ทั้ง 29 test เปิด prototype จริงแล้วเทียบ DOM (`toEqual`) + ภาพ ถ้าลบ `legacy/` จะไม่มีอะไรให้เทียบ ทางเลือก "commit ภาพ baseline ของ prototype แล้วเลิกใช้ prototype" ใช้ไม่ได้ดี: (1) การเทียบ DOM/สี/โฟกัสต้องรัน prototype จริง (2) ภาพขึ้นกับฟอนต์/OS ของเครื่องที่ถ่าย commit แล้วเครื่องอื่นตกหมด — ย้ายเข้า `e2e/` จึงได้ทั้ง "ไม่มี prototype ที่รากโปรเจกต์/ไม่มีใครเข้าใจผิดว่าเป็นเว็บจริง" และ regression ครบ (Next.js/Vercel ไม่ serve ไฟล์นอก `public/`) ห้ามแก้ไฟล์ใน `e2e/legacy-reference/` เหมือนเดิม
- **ภาพของตัวเอง:** หน้าตั้งค่าทั้งหน้า (มีส่วนที่ตั้งใจต่างจาก prototype) ตรวจกับภาพที่ commit ไว้ใน `e2e/.legacy-shots/app/` เหมือน `/mine` `/pool` ของ C1; ส่วนที่เหมือน prototype (รายชื่อทีม, การ์ดแคมเปญ) ยังเทียบกับ prototype

---
### Task 1: Dashboard

ค่าคาดหวังใน test คำนวณด้วยโค้ด `renderDashboard` ของ `legacy/app.js` (L301-366) ตรงตัวบนข้อมูลตัวอย่าง — test ตก = แก้ฟังก์ชัน ห้ามแก้ตัวเลข

**Files:**
- Create: `lib/domain/dashboard.ts`, `components/dashboard/DashboardPage.tsx`
- Modify: `lib/state/reducer.ts`, `app/(app)/dashboard/page.tsx`
- Test: `lib/domain/dashboard.test.ts`, `lib/state/reducer.test.ts`

- [ ] **Step 1: เขียน test ที่ยังไม่ผ่าน**

`lib/domain/dashboard.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { fixturePayload } from '@/lib/fixtures/load';
import type { Period } from '@/lib/state/reducer';
import {
  activityFeed, brandChips, byBrand, commissionTable, commissionTsv, dashStat, monthLabel, parseRate, pct, repBars, scopeLabel,
} from './dashboard';
import { mineOrAll } from './leads';

// ค่าคาดหวังคำนวณด้วยโค้ด renderDashboard ของ legacy/app.js (L301-366) ตรงตัวบนข้อมูลตัวอย่าง
const F = fixturePayload();
const NONE: Period = { from: '', to: '', key: 'all' };
const NOV: Period = { from: '2026-11-01', to: '2026-11-30', key: 'm0' };
const admin = { meId: 'r4', isAdmin: true };
const A = F.leads.filter((l) => mineOrAll(l, admin));
const r2 = { meId: 'r2', isAdmin: false };
const A2 = F.leads.filter((l) => mineOrAll(l, r2));

describe('dashboard stats (prototype stat() L304-310)', () => {
  it('KPI numbers for every brand, one brand, a period and a sales rep', () => {
    expect(dashStat(A, NONE, F.today)).toEqual({ n: 28, c: 16, w: 6, val: 13809, due: 2, wait: 4 });
    expect(dashStat(byBrand(A, 'hosttail'), NONE, F.today)).toEqual({ n: 9, c: 6, w: 2, val: 5249, due: 1, wait: 2 });
    expect(dashStat(byBrand(A, 'bebeplay'), NONE, F.today)).toEqual({ n: 19, c: 10, w: 4, val: 8560, due: 1, wait: 2 });
    expect(dashStat(A, NOV, F.today)).toEqual({ n: 28, c: 1, w: 0, val: 0, due: 2, wait: 4 });
    expect(dashStat(A2, NONE, F.today)).toEqual({ n: 9, c: 4, w: 1, val: 3290, due: 0, wait: 1 });
  });
  it('pct, scope label and brand chips', () => {
    expect([pct(16, 28), pct(6, 16), pct(1, 0)]).toEqual([57, 38, 0]);
    expect([scopeLabel('all'), scopeLabel('bebeplay'), scopeLabel('hosttail')]).toEqual(['ทุกแบรนด์', 'Bebeplay', 'Hosttail']);
    expect(brandChips(A).map((c) => [c.key, c.label, c.n, c.dot])).toEqual([
      ['all', 'ทุกแบรนด์', 28, null], ['bebeplay', 'Bebeplay', 19, 'var(--bebe)'], ['hosttail', 'Hosttail', 9, 'var(--host)'],
    ]);
    expect(brandChips(A2).map((c) => c.n)).toEqual([9, 6, 3]);
  });
});

describe('rep bars and activity feed (L313-322)', () => {
  it('bar widths relative to the busiest rep (unrounded); sales see only their row', () => {
    expect(repBars(A, F.reps, admin, NONE).map((r) => [r.id, r.ownedWidth, r.wonWidth, `${r.c}/${r.owned} · ปิด ${r.w}`])).toEqual([
      ['r1', '33.33333333333333%', '11.11111111111111%', '2/3 · ปิด 1'],
      ['r2', '100%', '11.11111111111111%', '4/9 · ปิด 1'],
      ['r3', '44.44444444444444%', '11.11111111111111%', '4/4 · ปิด 1'],
      ['r4', '77.77777777777779%', '33.33333333333333%', '6/7 · ปิด 3'],
    ]);
    expect(repBars(byBrand(A, 'hosttail'), F.reps, admin, NONE).map((r) => [r.ownedWidth, r.wonWidth])).toEqual([
      ['33.33333333333333%', '33.33333333333333%'], ['100%', '0%'], ['100%', '33.33333333333333%'], ['66.66666666666666%', '0%'],
    ]);
    expect(repBars(A2, F.reps, r2, NONE).map((r) => r.id)).toEqual(['r2']);
  });
  it('feed = 8 newest interactions in the period', () => {
    const feed = activityFeed(A, F.reps, NONE);
    expect(feed).toHaveLength(8);
    expect(feed.slice(0, 3).map((i) => [i.lead, i.rep, i.date])).toEqual([
      ['จิราพร มั่นคง', 'อาทิตยา คชสร', '2026-11-01T13:20'],
      ['อนุชา สุขสวัสดิ์', 'กมลชนก ใจดี', '2026-10-31T12:20'],
      ['ณัฐวุฒิ วัฒนา', 'ปรีชา วงศ์ทอง', '2026-10-28T16:20'],
    ]);
    expect(activityFeed(A, F.reps, NOV).map((i) => i.lead)).toEqual(['จิราพร มั่นคง']);
    expect(activityFeed(byBrand(A, 'hosttail'), F.reps, NONE)).toHaveLength(6);
  });
});

describe('commission table (L328-341, L362-363)', () => {
  it('won amount per rep per closing month, bills, commission; reps without a win are left out', () => {
    const t = commissionTable(A, F.reps, NONE, 3);
    expect(t.months).toEqual(['2026-09', '2026-10']);
    expect(t.rows.map((r) => [r.name, r.byM, r.sum, r.bills, Math.round(r.comm)])).toEqual([
      ['อาทิตยา คชสร', [0, 259], 259, 1, 8],
      ['กมลชนก ใจดี', [0, 3290], 3290, 1, 99],
      ['ปรีชา วงศ์ทอง', [0, 4990], 4990, 1, 150],
      ['Dev MPD', [790, 4480], 5270, 3, 158],
    ]);
    expect([t.colSum, t.grand, t.bills]).toEqual([[790, 13019], 13809, 6]);
    expect(commissionTable(A, F.reps, NOV, 0).rows).toEqual([]);
    expect(commissionTable(byBrand(A, 'hosttail'), F.reps, NONE, 0).rows.map((r) => r.name)).toEqual(['อาทิตยา คชสร', 'ปรีชา วงศ์ทอง']);
  });
  it('month labels and the TSV copied to Excel (raw numbers, no total row; empty commission without a rate)', () => {
    expect([monthLabel('2026-10'), monthLabel('2026-01'), monthLabel('none')]).toEqual(['ต.ค. 2026', 'ม.ค. 2026', 'ไม่ระบุวันที่']);
    const tsv = commissionTsv(commissionTable(A, F.reps, NONE, 3)).split('\n');
    expect(tsv[0]).toBe('เซลล์\tก.ย. 2026\tต.ค. 2026\tยอดรวม\tจำนวนบิล\tค่าคอม');
    expect(tsv[4]).toBe('Dev MPD\t790\t4480\t5270\t3\t158');
    expect(tsv).toHaveLength(5);
    expect(commissionTsv(commissionTable(A2, F.reps, NONE, 0)).split('\n')[1]).toBe('กมลชนก ใจดี\t3290\t3290\t1\t');
    expect([parseRate('3.5'), parseRate(''), parseRate('x')]).toEqual([3.5, 0, 0]);
  });
});
```

`lib/state/reducer.test.ts` — เพิ่มก่อน `it('setPool merges the persistent pool filters', () => {`:

```ts
  it('upsertRep adds or updates a team member; commissionRate starts at 0', () => {
    const s = reducer(ready, { type: 'upsertRep', rep: { id: 'u2', name: 'พลอย', initials: 'พล', role: 'sales', active: true } });
    expect(s.reps.map((r) => r.id)).toEqual(['u1', 'u2']);
    expect(reducer(s, { type: 'upsertRep', rep: { id: 'u2', name: 'พลอย', initials: 'พล', role: 'sales', active: false } }).reps[1].active).toBe(false);
    expect(initialState.ui.commissionRate).toBe(0);
  });
```

Run: `npm test`
Expected: FAIL — `dashboard.test.ts` ตก (`Failed to resolve import "./dashboard"`) และ `reducer.test.ts` 1 test ตก (action `upsertRep` ยังไม่มี → `s.reps` ไม่เปลี่ยน)

- [ ] **Step 2: `lib/domain/dashboard.ts`**

```ts
import type { ContactType, Lead, Rep } from '@/lib/api/types';
import { BRAND, TH_MONTHS, type Brand } from '@/lib/constants';
import type { Period } from '@/lib/state/reducer';
import { contactedIn, repName, wonIn, type Viewer } from './leads';
import { hasPeriod, inPeriod } from './period';

// Dashboard ของ prototype (legacy/app.js L301-366) เป็นฟังก์ชันล้วน — ตัวเลขทั้งหมดคิดจากลีดใน state (mineOrAll) และช่วงวันที่

export type DashBrand = 'all' | Brand;

export interface DashStat { n: number; c: number; w: number; val: number; due: number; wait: number }

/** stat(arr) (L304-309): ติดต่อแล้ว = contactedIn, ปิดการขาย = wonIn, ยอด = closedAmount ?? ยอดซื้อแรก ?? 0, เลยนัด = callback < วันนี้ */
export function dashStat(arr: ReadonlyArray<Lead>, period: Period, today: string): DashStat {
  const w = arr.filter((l) => wonIn(l, period));
  return {
    n: arr.length,
    c: arr.filter((l) => contactedIn(l, period)).length,
    w: w.length,
    val: w.reduce((s, l) => s + (l.closedAmount ?? l.purchases[0]?.amount ?? 0), 0),
    due: arr.filter((l) => !!l.callback && l.callback < today).length,
    wait: arr.filter((l) => l.status === 'callback').length,
  };
}

/** L310 */
export const pct = (a: number, b: number): number => (b ? Math.round((a / b) * 100) : 0);

/** L312 */
export const scopeLabel = (b: DashBrand): string => (b === 'all' ? 'ทุกแบรนด์' : BRAND[b]);

export const byBrand = (A: ReadonlyArray<Lead>, b: DashBrand): Lead[] => (b === 'all' ? [...A] : A.filter((l) => l.brand === b));

/** ชิปแบรนด์ (L323-324) นับจาก A ทั้งหมด */
export function brandChips(A: ReadonlyArray<Lead>): Array<{ key: DashBrand; label: string; n: number; dot: string | null }> {
  return [
    { key: 'all', label: 'ทุกแบรนด์', n: A.length, dot: null },
    { key: 'bebeplay', label: 'Bebeplay', n: A.filter((l) => l.brand === 'bebeplay').length, dot: 'var(--bebe)' },
    { key: 'hosttail', label: 'Hosttail', n: A.filter((l) => l.brand === 'hosttail').length, dot: 'var(--host)' },
  ];
}

export interface RepBar { id: string; name: string; owned: number; c: number; w: number; ownedWidth: string; wonWidth: string }

/** ผลงานรายเซลล์ (L313-319): เซลล์เห็นเฉพาะแถวตัวเอง; ความกว้าง bar เทียบกับเซลล์ที่ดูแลลีดมากสุด (ไม่ปัดเศษ เหมือน prototype) */
export function repBars(L: ReadonlyArray<Lead>, reps: ReadonlyArray<Rep>, v: Viewer, period: Period): RepBar[] {
  const maxN = Math.max(1, ...reps.map((r) => L.filter((l) => l.owner === r.id).length));
  return reps
    .filter((r) => v.isAdmin || r.id === v.meId)
    .map((r) => {
      const mine = L.filter((l) => l.owner === r.id);
      const w = mine.filter((l) => wonIn(l, period)).length;
      return {
        id: r.id, name: r.name, owned: mine.length, c: mine.filter((l) => contactedIn(l, period)).length, w,
        ownedWidth: `${(mine.length / maxN) * 100}%`, wonWidth: `${mine.length ? (w / maxN) * 100 : 0}%`,
      };
    });
}

export interface FeedItem { key: string; type: ContactType; lead: string; rep: string; date: string; note: string }

/** กิจกรรมล่าสุด (L320-322): 8 บันทึกล่าสุดในช่วงวันที่ เรียงใหม่ → เก่า */
export function activityFeed(L: ReadonlyArray<Lead>, reps: ReadonlyArray<Pick<Rep, 'id' | 'name'>>, period: Period): FeedItem[] {
  return L.flatMap((l) => l.interactions.filter((i) => !hasPeriod(period) || inPeriod(i.date, period)).map((i) => ({ i, l })))
    .sort((a, b) => b.i.date.localeCompare(a.i.date))
    .slice(0, 8)
    .map(({ i, l }) => ({ key: `${l.id}-${i.id}`, type: i.type, lead: l.name, rep: repName(reps, i.rep) || '', date: i.date, note: i.note }));
}

/** หัวคอลัมน์เดือน (L328-329): "พ.ย. 2026" / "ไม่ระบุวันที่" */
export const monthLabel = (k: string): string => (k === 'none' ? 'ไม่ระบุวันที่' : `${TH_MONTHS[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`);

export interface CommRow { name: string; byM: number[]; sum: number; bills: number; cnt: number; comm: number }
export interface CommTable { months: string[]; rows: CommRow[]; colSum: number[]; grand: number; bills: number; rate: number }

/** ตารางยอดที่ปิดได้รายเดือนต่อเซลล์ (L330-341): ลีดที่ปิดการขายในช่วงและมีผู้ดูแล, เฉพาะเซลล์ที่มีอย่างน้อย 1 ราย */
export function commissionTable(L: ReadonlyArray<Lead>, reps: ReadonlyArray<Rep>, period: Period, rate: number): CommTable {
  const won = L.filter((l) => wonIn(l, period)).filter((l) => l.owner);
  const mkey = (l: Lead): string => (l.closedAt ? l.closedAt.slice(0, 7) : 'none');
  const months = [...new Set(won.map(mkey))].sort();
  const rows = reps
    .map((r) => {
      const mine = won.filter((l) => l.owner === r.id);
      const byM = months.map((m) => mine.filter((l) => mkey(l) === m).reduce((s, l) => s + (l.closedAmount ?? 0), 0));
      const sum = byM.reduce((a, b) => a + b, 0);
      return { name: r.name, byM, sum, bills: mine.reduce((s, l) => s + l.closedBills.length, 0), cnt: mine.length, comm: (sum * rate) / 100 };
    })
    .filter((r) => r.cnt);
  const colSum = months.map((_, i) => rows.reduce((s, r) => s + r.byM[i], 0));
  return { months, rows, colSum, grand: colSum.reduce((a, b) => a + b, 0), bills: rows.reduce((s, r) => s + r.bills, 0), rate };
}

/** "คัดลอกตาราง" (L362-363): หัวตาราง + แถวเซลล์เป็นตัวเลขดิบ (ไม่มีแถวรวม) คั่นด้วย tab */
export function commissionTsv(t: CommTable): string {
  const rows: Array<Array<string | number>> = [
    ['เซลล์', ...t.months.map(monthLabel), 'ยอดรวม', 'จำนวนบิล', 'ค่าคอม'],
    ...t.rows.map((r) => [r.name, ...r.byM, r.sum, r.bills, t.rate ? Math.round(r.comm) : '']),
  ];
  return rows.map((r) => r.join('\t')).join('\n');
}

/** ช่องอัตราค่าคอม (L360): ค่าว่าง/ไม่ใช่ตัวเลข = 0 */
export const parseRate = (s: string): number => Number(s) || 0;
```

- [ ] **Step 3: `lib/domain/setup.ts`** (ใช้ `upsertRep` ใน reducer ตั้งแต่ Task นี้ — test ของไฟล์นี้อยู่ใน Task 2)

```ts
import type { JstTagRow, Lead, MemberTagsRow, Rep } from '@/lib/api/types';

// หน้าตั้งค่า (prototype renderSetup L369-382) + การ์ดผูก tag JST (spec ข้อ 3) เป็นฟังก์ชันล้วน

export const roleLabel = (role: Rep['role']): string => (role === 'admin' ? 'หัวหน้า' : 'เซลล์');

/** จำนวนลีดที่เซลล์ดูแล (L372 นับจากลีดใน state) */
export const ownedCount = (leads: ReadonlyArray<Pick<Lead, 'owner'>>, repId: string): number => leads.filter((l) => l.owner === repId).length;

/** ปุ่มปิด/เปิดใช้งาน: เฉพาะสมาชิกจาก Supabase (มี active) และไม่ใช่ตัวเอง (DB ห้ามปิดตัวเอง: cannot_deactivate_self) */
export function activeToggle(r: Pick<Rep, 'id' | 'active'>, meId: string): { text: string; next: boolean } | null {
  if (r.active === undefined || r.id === meId) return null;
  return r.active ? { text: 'ปิดใช้งาน', next: false } : { text: 'เปิดใช้งาน', next: true };
}

/** แทน/เพิ่มสมาชิกในรายชื่อทีม (ผลของ dsales_add_member / ปิด-เปิดใช้งาน) คงชื่อของตัวเองจาก dsales_me */
export function upsertRep(reps: ReadonlyArray<Rep>, rep: Rep, meId: string): Rep[] {
  const i = reps.findIndex((r) => r.id === rep.id);
  if (i < 0) return [...reps, rep];
  const next = reps.slice();
  next[i] = rep.id === meId ? { ...reps[i], role: rep.role, active: rep.active } : { ...reps[i], ...rep };
  return next;
}

export interface TagChoice { tag: string; sessions: number; selected: boolean; owner: string | null }

/** tag Admin_* ทั้งหมดจาก JST พร้อมสถานะของเซลล์ที่เลือก: เลือกไว้ / เป็นของเซลล์คนอื่น (tag ละ 1 เจ้าของ เทียบแบบไม่สนตัวพิมพ์) */
export function tagChoices(
  tags: ReadonlyArray<JstTagRow>, memberTags: ReadonlyArray<MemberTagsRow>, userId: string, selected: ReadonlyArray<string>,
  reps: ReadonlyArray<Pick<Rep, 'id' | 'name'>>,
): TagChoice[] {
  const owner = new Map<string, string>();
  for (const m of memberTags) if (m.user_id !== userId) for (const t of m.jst_tags || []) owner.set(t.toLowerCase(), m.user_id);
  const sel = new Set(selected.map((t) => t.toLowerCase()));
  return tags.map((t) => {
    const o = owner.get(t.tag.toLowerCase()) ?? null;
    return { tag: t.tag, sessions: Number(t.sessions), selected: sel.has(t.tag.toLowerCase()), owner: o ? reps.find((r) => r.id === o)?.name || o : null };
  });
}

/** tag ที่บันทึกไว้ของเซลล์คนนั้น */
export const tagsOf = (memberTags: ReadonlyArray<MemberTagsRow>, userId: string): string[] => memberTags.find((m) => m.user_id === userId)?.jst_tags || [];

/** สลับ tag ในรายการที่เลือก */
export const toggleTag = (selected: ReadonlyArray<string>, tag: string): string[] =>
  selected.some((t) => t.toLowerCase() === tag.toLowerCase()) ? selected.filter((t) => t.toLowerCase() !== tag.toLowerCase()) : [...selected, tag];

/** มีการเปลี่ยนจากที่บันทึกไว้หรือไม่ (ไม่สนลำดับ/ตัวพิมพ์) */
export const tagsChanged = (a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean => {
  const k = (x: ReadonlyArray<string>) => [...x].map((t) => t.toLowerCase()).sort().join('\n');
  return k(a) !== k(b);
};

/** แทน tag ของเซลล์หนึ่งคนใน memberTags (ผลของ dsales_set_member_tags) */
export function withMemberTags(memberTags: ReadonlyArray<MemberTagsRow>, userId: string, tags: string[]): MemberTagsRow[] {
  return memberTags.some((m) => m.user_id === userId)
    ? memberTags.map((m) => (m.user_id === userId ? { ...m, jst_tags: tags } : m))
    : [...memberTags, { user_id: userId, jst_tags: tags }];
}
```

- [ ] **Step 4: `lib/state/reducer.ts`** — `ui.commissionRate` + action `upsertRep`

แก้ import

```ts
import type { Brand, Campaign, DemoCustomer, Lead, LeadJson, Rep } from '@/lib/api/types';
```

เป็น

```ts
import type { Brand, Campaign, DemoCustomer, Lead, LeadJson, Rep } from '@/lib/api/types';
import { upsertRep } from '@/lib/domain/setup';
```

ใน `export interface UiFilters` แก้

```ts
  sort: 'due' | 'spend' | 'none'; dashBrand: 'all' | Brand; period: Period; focusSearch: boolean;
}
```

เป็น

```ts
  sort: 'due' | 'spend' | 'none'; dashBrand: 'all' | Brand; period: Period; focusSearch: boolean;
  /** อัตราค่าคอม (%) ของตาราง Dashboard — prototype state.commissionRate (ล็อกอินจริงไม่บันทึก หายเมื่อโหลดหน้าใหม่) */
  commissionRate: number;
}
```

แก้

```ts
  period: { from: '', to: '', key: 'all' }, focusSearch: false,
};
```

เป็น

```ts
  period: { from: '', to: '', key: 'all' }, focusSearch: false, commissionRate: 0,
};
```

ใน `export type Action` เพิ่มหลังบรรทัด `| { type: 'upsertCampaign'; campaign: Campaign }`:

```ts
  | { type: 'upsertRep'; rep: Rep }
```

และใน `reducer` เพิ่มก่อน `case 'setUi':`

```ts
    case 'upsertRep':
      return { ...state, reps: upsertRep(state.reps, action.rep, state.meId) };
```

- [ ] **Step 5: หน้า Dashboard**

`components/dashboard/DashboardPage.tsx`:

```tsx
'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { PeriodCard } from '@/components/leads/PeriodCard';
import { PATHS } from '@/lib/constants';
import {
  activityFeed, brandChips, byBrand, commissionTable, commissionTsv, dashStat, monthLabel, parseRate, pct, repBars, scopeLabel, type DashStat,
} from '@/lib/domain/dashboard';
import { mineOrAll } from '@/lib/domain/leads';
import { baht, fmtDT } from '@/lib/format';
import { useActions, useAppState } from '@/lib/state/AppProvider';

function Kpi({ label, value, foot }: { label: string; value: ReactNode; foot: string }) {
  return (
    <div className="kpi"><div className="kpi-label">{label}</div><div className="kpi-value">{value}</div><div className="kpi-foot">{foot}</div></div>
  );
}

function StatCells({ x }: { x: DashStat }) {
  return (
    <>
      <td className="r num">{x.n}</td>
      <td className="r num">{x.c} <span className="sub">({pct(x.c, x.n)}%)</span></td>
      <td className="r num">{x.wait}</td>
      <td className="r num">{x.due}</td>
      <td className="r num">{x.w} <span className="sub">({pct(x.w, x.c)}%)</span></td>
      <td className="r num">{baht(x.val)}</td>
    </>
  );
}

/**
 * Dashboard (renderDashboard L301-366): KPI 5 ใบ, เปรียบเทียบแยกแบรนด์, ยอดที่ปิดได้รายเดือนต่อเซลล์ (ค่าคอม + คัดลอก TSV),
 * ผลงานรายเซลล์, กิจกรรมล่าสุด — คิดจากลีดใน state (หัวหน้า = ทุกลีด, เซลล์ = ของตัวเอง) และช่วงวันที่
 * อัตราค่าคอมเก็บใน ui.commissionRate (คงค่าข้ามหน้า แต่หายเมื่อโหลดใหม่ เหมือน prototype ตอนล็อกอินจริง)
 */
export function DashboardPage() {
  const { leads, reps, meId, isAdmin, ui, today } = useAppState();
  const { setUi, toast } = useActions();
  const [rateText, setRateText] = useState(ui.commissionRate ? String(ui.commissionRate) : '');
  const period = ui.period;
  const A = useMemo(() => leads.filter((l) => mineOrAll(l, { meId, isAdmin })), [leads, meId, isAdmin]);
  const L = useMemo(() => byBrand(A, ui.dashBrand), [A, ui.dashBrand]);
  const s = dashStat(L, period, today);
  const all = dashStat(A, period, today);
  const scope = scopeLabel(ui.dashBrand);
  const rate = ui.commissionRate;
  const comm = commissionTable(L, reps, period, rate);
  const copy = () => {
    navigator.clipboard?.writeText(commissionTsv(comm)).then(() => toast('คัดลอกตารางแล้ว วางใน Excel ได้เลย'), () => toast('คัดลอกไม่สำเร็จ'));
  };
  const feed = activityFeed(L, reps, period);

  return (
    <>
      <PeriodCard />
      <div className="toolbar">
        {brandChips(A).map((c) => (
          <button key={c.key} className={`chip ${ui.dashBrand === c.key ? 'active' : ''}`} data-brand={c.key} onClick={() => setUi({ dashBrand: c.key })}>
            {c.dot ? <i className="dot" style={{ background: c.dot }} /> : null}
            {c.label} ({c.n})
          </button>
        ))}
      </div>
      <div className="kpis">
        <Kpi label="ลีดทั้งหมด" value={s.n} foot={scope} />
        <Kpi label="ติดต่อแล้ว" value={<>{s.c} <span className="sub">/ {s.n}</span></>} foot={`${pct(s.c, s.n)}% ของลีด · ${scope}`} />
        <Kpi label="ปิดการขาย" value={s.w} foot={`อัตราปิด ${pct(s.w, s.c)}% ของที่ติดต่อแล้ว`} />
        <Kpi label="ยอดที่ปิดได้" value={baht(s.val)} foot="จากยอดที่เซลล์บันทึกตอนปิดการขาย" />
        <Kpi label="นัดติดต่อเลยกำหนด" value={s.due} foot={s.due ? 'ควรติดตามวันนี้' : 'ไม่มีค้าง'} />
      </div>
      <div className="panel">
        <div className="panel-h"><h2>เปรียบเทียบแยกแบรนด์</h2></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>แบรนด์</th><th className="r">ลีด</th><th className="r">ติดต่อแล้ว</th><th className="r">รอติดต่อ</th>
                <th className="r">เลยนัด</th><th className="r">ปิดการขาย</th><th className="r">ยอดที่ปิดได้</th>
              </tr>
            </thead>
            <tbody>
              {(['bebeplay', 'hosttail'] as const).map((k) => (
                <tr key={k} className={ui.dashBrand === k ? 'sel' : ''}>
                  <td><span className={`tag ${k === 'bebeplay' ? 'bebe' : 'host'}`}>{k === 'bebeplay' ? 'Bebeplay' : 'Hosttail'}</span></td>
                  <StatCells x={dashStat(byBrand(A, k), period, today)} />
                </tr>
              ))}
              <tr className="total"><td><b>รวม</b></td><StatCells x={all} /></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="panel">
        <div className="panel-h">
          <h2>ยอดที่ปิดได้รายเดือนต่อเซลล์ (สำหรับคิดค่าคอม) · {scope}</h2>
          <div className="toolbar">
            <label className="sub" htmlFor="comm-rate">อัตราค่าคอม (%)</label>
            <input
              className="input pin" id="comm-rate" type="number" min="0" step="0.1" placeholder="เช่น 3" style={{ width: 90 }}
              value={rateText}
              onChange={(e) => {
                setRateText(e.target.value);
                setUi({ commissionRate: parseRate(e.target.value) });
              }}
            />
            <button className="btn sm" id="comm-copy" onClick={copy}>คัดลอกตาราง</button>
          </div>
        </div>
        {comm.rows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>เซลล์</th>
                  {comm.months.map((m) => <th key={m} className="r">{monthLabel(m)}</th>)}
                  <th className="r">ยอดรวม</th><th className="r">จำนวนบิล</th><th className="r">ค่าคอม{rate ? ` (${rate}%)` : ''}</th>
                </tr>
              </thead>
              <tbody>
                {comm.rows.map((r, ri) => (
                  <tr key={`${r.name}-${ri}`}>
                    <td>{r.name}</td>
                    {r.byM.map((v, i) => <td key={comm.months[i]} className="r num">{v ? baht(v) : '—'}</td>)}
                    <td className="r num"><b>{baht(r.sum)}</b></td>
                    <td className="r num">{r.bills}</td>
                    <td className="r num">{rate ? baht(Math.round(r.comm)) : '—'}</td>
                  </tr>
                ))}
                <tr className="total">
                  <td><b>รวม</b></td>
                  {comm.colSum.map((v, i) => <td key={comm.months[i]} className="r num">{baht(v)}</td>)}
                  <td className="r num"><b>{baht(comm.grand)}</b></td>
                  <td className="r num">{comm.bills}</td>
                  <td className="r num">{rate ? baht(Math.round((comm.grand * rate) / 100)) : '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">ไม่มียอดที่ปิดได้ในช่วงนี้</div>
        )}
      </div>
      <div className="grid-2">
        <div className="panel">
          <div className="panel-h">
            <h2>ผลงานรายเซลล์ · {scope}</h2>
            <div className="legend">
              <span><i style={{ background: 'var(--accent)' }} />ลีดที่ดูแล</span>
              <span><i style={{ background: 'var(--ok)' }} />ปิดการขาย</span>
            </div>
          </div>
          <div className="panel-b">
            {repBars(L, reps, { meId, isAdmin }, period).map((r) => (
              <div key={r.id} className="rep-row">
                <div>{r.name}</div>
                <div className="rep-bars">
                  <div className="bar"><i style={{ width: r.ownedWidth }} /></div>
                  <div className="bar won"><i style={{ width: r.wonWidth }} /></div>
                </div>
                <div className="sub num" style={{ textAlign: 'right' }}>{r.c}/{r.owned} · ปิด {r.w}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <div className="panel-h"><h2>กิจกรรมล่าสุด · {scope}</h2></div>
          <div className="panel-b">
            <ul className="feed">
              {feed.length ? (
                feed.map((i) => (
                  <li key={i.key}>
                    <span className={`feed-ic ${i.type}`}><svg viewBox="0 0 24 24"><path d={i.type === 'call' ? PATHS.phone : PATHS.chat} /></svg></span>
                    <div className="feed-body">
                      <b>{i.lead}</b> <span className="sub">· {i.rep} · {fmtDT(i.date)}</span>
                      <div>{i.note}</div>
                    </div>
                  </li>
                ))
              ) : (
                <li className="empty">ยังไม่มีการบันทึก</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
```

`app/(app)/dashboard/page.tsx` (แทนทั้งไฟล์):

```tsx
import { DashboardPage } from '@/components/dashboard/DashboardPage';

export default function Page() {
  return <DashboardPage />;
}
```

- [ ] **Step 6: ตรวจ**

Run: `npm test`
Expected: `Test Files  23 passed (23)` · `Tests  157 passed (157)`

Run: `npm run typecheck && npm run lint`
Expected: ไม่มี error

ดูด้วยตา (fixture พอร์ต 3200) `/dashboard` เทียบ prototype `#dashboard`: KPI "ลีดทั้งหมด 28", "ติดต่อแล้ว 16 / 28" (57% ของลีด · ทุกแบรนด์), "ปิดการขาย 6" (อัตราปิด 38%), "ยอดที่ปิดได้ 13,809.-", "นัดติดต่อเลยกำหนด 2"; ชิป Hosttail → KPI 9 ลีด; พิมพ์อัตราค่าคอม 3 → หัวคอลัมน์ "ค่าคอม (3%)"; "คัดลอกตาราง" → toast "คัดลอกตารางแล้ว วางใน Excel ได้เลย" แล้ววางใน Excel ได้ตารางแยกคอลัมน์

- [ ] **Step 7: Commit**

```bash
git add lib/domain/dashboard.ts lib/domain/dashboard.test.ts lib/domain/setup.ts lib/state/reducer.ts lib/state/reducer.test.ts components/dashboard/DashboardPage.tsx "app/(app)/dashboard/page.tsx"
git commit -m "feat(web): add the dashboard with KPIs, brand comparison, monthly commission table with TSV copy, rep bars and activity feed" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: ตั้งค่า (ทีมจาก DB, เพิ่ม/ปิดใช้งานสมาชิก, ผูก tag JST, วิธีจองของแคมเปญ)

**Files:**
- Create: `components/setup/SetupPage.tsx`
- Modify: `app/(app)/setup/page.tsx`
- Delete: `components/shell/Placeholder.tsx`
- Test: `lib/domain/setup.test.ts`

- [ ] **Step 1: test ของ `lib/domain/setup.ts`** (ฟังก์ชันเขียนไว้แล้วใน Task 1 — test นี้ควรผ่านทันที ถ้าตกให้แก้ฟังก์ชัน)

`lib/domain/setup.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Rep } from '@/lib/api/types';
import { fixturePayload } from '@/lib/fixtures/load';
import { activeToggle, ownedCount, roleLabel, tagChoices, tagsChanged, tagsOf, toggleTag, upsertRep, withMemberTags } from './setup';

const F = fixturePayload();
const reps: Rep[] = [
  { id: 'u1', name: 'หัวหน้า', initials: 'หั', role: 'admin', email: 'boss@example.com', active: true },
  { id: 'u2', name: 'พลอย', initials: 'พล', role: 'sales', email: 'ploy@example.com', active: true },
  { id: 'u3', name: 'มิ้นท์', initials: 'มิ', role: 'sales', email: 'mint@example.com', active: false },
];

describe('team panel (prototype renderSetup L372)', () => {
  it('role label and owned lead count', () => {
    expect([roleLabel('admin'), roleLabel('sales')]).toEqual(['หัวหน้า', 'เซลล์']);
    expect(F.reps.map((r) => ownedCount(F.leads, r.id))).toEqual([3, 9, 4, 7]);
  });
  it('activate/deactivate button: never for myself, never for fixture reps (no active flag)', () => {
    expect(activeToggle(reps[0], 'u1')).toBeNull();
    expect(activeToggle(reps[1], 'u1')).toEqual({ text: 'ปิดใช้งาน', next: false });
    expect(activeToggle(reps[2], 'u1')).toEqual({ text: 'เปิดใช้งาน', next: true });
    expect(activeToggle(F.reps[0], 'r4')).toBeNull();
  });
  it('upsertRep adds a new member, replaces an existing one, and keeps my own display name', () => {
    const added = upsertRep(reps, { id: 'u4', name: 'ใหม่', initials: 'ให', role: 'sales', active: true }, 'u1');
    expect(added.map((r) => r.id)).toEqual(['u1', 'u2', 'u3', 'u4']);
    expect(upsertRep(reps, { ...reps[2], active: true }, 'u1')[2].active).toBe(true);
    expect(upsertRep(reps, { id: 'u1', name: 'boss', initials: 'BO', role: 'admin', active: true }, 'u1')[0].name).toBe('หัวหน้า');
  });
});

describe('JST tag card (spec ข้อ 3)', () => {
  const tags = [{ tag: 'Admin_Ploy', sessions: 120 }, { tag: 'Admin_Mint', sessions: 80 }, { tag: 'Admin_New', sessions: 3 }];
  const memberTags = [{ user_id: 'u2', jst_tags: ['Admin_Ploy'] }, { user_id: 'u3', jst_tags: ['admin_mint'] }];
  it('marks the tags chosen for the rep and the ones owned by other reps (case-insensitive)', () => {
    expect(tagChoices(tags, memberTags, 'u2', tagsOf(memberTags, 'u2'), reps)).toEqual([
      { tag: 'Admin_Ploy', sessions: 120, selected: true, owner: null },
      { tag: 'Admin_Mint', sessions: 80, selected: false, owner: 'มิ้นท์' },
      { tag: 'Admin_New', sessions: 3, selected: false, owner: null },
    ]);
    expect(tagsOf(memberTags, 'u1')).toEqual([]);
  });
  it('toggle / changed / replace after save', () => {
    expect(toggleTag(['Admin_Ploy'], 'admin_ploy')).toEqual([]);
    expect(toggleTag(['Admin_Ploy'], 'Admin_New')).toEqual(['Admin_Ploy', 'Admin_New']);
    expect(tagsChanged(['Admin_New', 'Admin_Ploy'], ['admin_ploy', 'Admin_New'])).toBe(false);
    expect(tagsChanged(['Admin_New'], [])).toBe(true);
    expect(withMemberTags(memberTags, 'u2', ['Admin_New'])).toEqual([{ user_id: 'u2', jst_tags: ['Admin_New'] }, memberTags[1]]);
    expect(withMemberTags(memberTags, 'u1', ['Admin_X'])).toHaveLength(3);
  });
});
```

Run: `npm test`
Expected: `Test Files  24 passed (24)` · `Tests  169 passed (169)`

- [ ] **Step 2: `components/setup/SetupPage.tsx`**

```tsx
'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { errorMessage } from '@/lib/api/errors';
import { mapTeamRow } from '@/lib/api/map';
import { addMember, getJstAdminTags, getMemberTags, setCampaignClaimMode, setMemberActive, setMemberTags } from '@/lib/api/rpc';
import type { Campaign, ClaimMode, JstTagRow, MemberTagsRow, Role } from '@/lib/api/types';
import { BRAND, FIXTURE_NO_WRITE, MODES } from '@/lib/constants';
import { activeToggle, ownedCount, roleLabel, tagChoices, tagsChanged, tagsOf, toggleTag, withMemberTags } from '@/lib/domain/setup';
import { fmtDate } from '@/lib/format';
import { useActions, useAppState } from '@/lib/state/AppProvider';

/**
 * ตั้งค่า (renderSetup L369-382) หัวหน้าเท่านั้น — ต่างจาก prototype โดยตั้งใจ:
 * - ทีมเซลล์มาจาก dsales_team: เพิ่มด้วยอีเมล + บทบาท (dsales_add_member) และปิด/เปิดใช้งาน (dsales_set_member_active)
 * - การ์ดใหม่ "ผูก tag JST กับเซลล์" (dsales_jst_admin_tags / dsales_member_tags / dsales_set_member_tags)
 * - ไม่มีการ์ด "ข้อมูลตัวอย่าง" (รีเซ็ต localStorage ของโหมดตัวอย่าง)
 */
export function SetupPage() {
  return (
    <div className="settings">
      <TeamPanel />
      <CampaignPanel />
      <TagPanel />
    </div>
  );
}

function TeamPanel() {
  const { reps, leads, meId, live } = useAppState();
  const { dispatch, toast, toastError, once } = useActions();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('sales');

  async function onAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) return;
    if (!live) {
      toast(FIXTURE_NO_WRITE);
      return;
    }
    await once('add-member', async () => {
      try {
        const m = await addMember(email, role);
        dispatch({ type: 'upsertRep', rep: mapTeamRow(m) });
        setEmail('');
        toast('เพิ่มเซลล์แล้ว');
      } catch (err) {
        toastError(err);
      }
    });
  }

  async function onToggle(id: string, next: boolean) {
    if (!live) {
      toast(FIXTURE_NO_WRITE);
      return;
    }
    await once(`member-active:${id}`, async () => {
      try {
        await setMemberActive(id, next);
        const r = reps.find((x) => x.id === id);
        if (r) dispatch({ type: 'upsertRep', rep: { ...r, active: next } });
        toast(next ? 'เปิดใช้งานแล้ว' : 'ปิดใช้งานแล้ว');
      } catch (err) {
        toastError(err);
      }
    });
  }

  return (
    <div className="panel">
      <div className="panel-h"><h2>ทีมเซลล์</h2></div>
      <div className="panel-b">
        {reps.map((r) => {
          const t = activeToggle(r, meId);
          return (
            <div key={r.id} className="list-row">
              <div>
                <b>{r.name}</b>
                {r.email ? <div className="sub">{r.email}</div> : null}
              </div>
              <span className="tag">{roleLabel(r.role)}</span>
              {r.active === false ? <span className="badge s-lost plain">ปิดใช้งาน</span> : null}
              <span className="sub">{ownedCount(leads, r.id)} ลีด</span>
              {t ? <button className="btn sm" data-member={r.id} onClick={() => void onToggle(r.id, t.next)}>{t.text}</button> : null}
            </div>
          );
        })}
        <form className="inline-form" id="rep-form" onSubmit={(e) => void onAdd(e)}>
          <input className="input" id="rep-email" type="email" placeholder="อีเมลเซลล์ (บัญชีที่ใช้ล็อกอิน)" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <select className="select" id="rep-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="sales">เซลล์</option>
            <option value="admin">หัวหน้า</option>
          </select>
          <button className="btn primary">เพิ่ม</button>
        </form>
        <p className="help" style={{ marginTop: 10 }}>เพิ่มได้เฉพาะอีเมลที่มีบัญชีพนักงานในระบบแล้ว บัญชีที่ไม่อยู่ในรายชื่อนี้หรือถูกปิดใช้งานจะเข้าใช้งานไม่ได้</p>
      </div>
    </div>
  );
}

function CampaignPanel() {
  const { campaigns, live } = useAppState();
  const { dispatch, toast, handleAuthError } = useActions();

  async function onMode(c: Campaign, mode: ClaimMode) {
    if (!live) {
      toast(FIXTURE_NO_WRITE);
      return;
    }
    dispatch({ type: 'upsertCampaign', campaign: { ...c, claimMode: mode } }); // L898: เปลี่ยนใน state ก่อน แล้วค่อยบันทึก
    try {
      await setCampaignClaimMode(c.id, mode);
      toast('บันทึกวิธีจองลีดแล้ว');
    } catch (e) {
      dispatch({ type: 'upsertCampaign', campaign: c });
      handleAuthError(e);
      toast('บันทึกไม่สำเร็จ');
    }
  }

  return (
    <div className="panel">
      <div className="panel-h"><h2>แคมเปญ</h2></div>
      <div className="panel-b">
        {campaigns.map((c) => (
          <div key={c.id} className="list-row">
            <div><b>{c.name}</b><div className="sub">{fmtDate(c.start)} – {fmtDate(c.end)}</div></div>
            <span className={`tag ${c.brand === 'bebeplay' ? 'bebe' : 'host'}`}>{BRAND[c.brand]}</span>
            <select className="select" data-claimmode={c.id} aria-label="วิธีจองลีด" value={c.claimMode || 'self'} onChange={(e) => void onMode(c, e.target.value as ClaimMode)}>
              {(Object.keys(MODES) as ClaimMode[]).map((k) => <option key={k} value={k}>{MODES[k]}</option>)}
            </select>
          </div>
        ))}
        <p className="help" style={{ marginTop: 10 }}>สร้างแคมเปญใหม่ได้ที่เมนู แคมเปญ → Bebeplay / Hosttail (เฉพาะหัวหน้า)</p>
      </div>
    </div>
  );
}

/**
 * ผูก tag Admin_* ของ JST กับเซลล์ (spec ข้อ 3): เลือกเซลล์ → กดชิป tag (เลือกได้หลายอัน) → บันทึก
 * บันทึกแล้ว DB คำนวณฐานลูกค้าใหม่ทั้งหมด (dsales_refresh_customer_base) ใช้เวลาหลายวินาที → ปุ่ม/ชิป disabled + "กำลังบันทึก…"
 */
function TagPanel() {
  const { reps, live } = useAppState();
  const { dispatch, toast, toastError, once, handleAuthError } = useActions();
  const [tags, setTags] = useState<JstTagRow[] | null>(live ? null : []);
  const [memberTags, setMemberTagsState] = useState<MemberTagsRow[]>([]);
  const [err, setErr] = useState('');
  const [userId, setUserId] = useState(reps[0]?.id ?? '');
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!live) return;
    let alive = true;
    Promise.all([getJstAdminTags(), getMemberTags()]).then(
      ([t, m]) => {
        if (!alive) return;
        setTags(t || []);
        setMemberTagsState(m || []);
      },
      (e: unknown) => {
        if (!alive || handleAuthError(e)) return;
        setErr('โหลด tag ไม่สำเร็จ: ' + errorMessage(e));
        setTags([]);
      },
    );
    return () => {
      alive = false;
    };
  }, [live, handleAuthError]);

  // เปลี่ยนเซลล์ / โหลดเสร็จ → เริ่มจาก tag ที่บันทึกไว้ของคนนั้น
  useEffect(() => {
    setSelected(tagsOf(memberTags, userId));
  }, [memberTags, userId]);

  const saved = tagsOf(memberTags, userId);
  const choices = tagChoices(tags || [], memberTags, userId, selected, reps);

  async function onSave() {
    if (!live) {
      toast(FIXTURE_NO_WRITE);
      return;
    }
    await once('member-tags', async () => {
      setSaving(true);
      try {
        const next = await setMemberTags(userId, selected);
        setMemberTagsState((m) => withMemberTags(m, userId, next || []));
        dispatch({ type: 'invalidatePool' });
        toast('บันทึก tag แล้ว · คำนวณลูกค้าของเซลล์ใหม่แล้ว');
      } catch (e) {
        toastError(e);
      } finally {
        setSaving(false);
      }
    });
  }

  return (
    <div className="panel">
      <div className="panel-h"><h2>ผูก tag JST กับเซลล์</h2></div>
      <div className="panel-b">
        <p className="help">เลือก tag Admin_* ของห้องแชตใน JST ให้เซลล์แต่ละคน ลูกค้าในห้องแชตที่ติด tag นั้นจะเป็น &quot;ลูกค้าของฉัน&quot; ของเซลล์คนนั้น (1 tag มีเจ้าของได้คนเดียว)</p>
        <div className="inline-form">
          <select className="select" id="tag-rep" aria-label="เซลล์" value={userId} disabled={saving} onChange={(e) => setUserId(e.target.value)}>
            {reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        {err ? <div className="login-err">{err}</div> : null}
        {tags === null ? (
          <p className="help" style={{ marginTop: 10 }}>กำลังโหลด tag จาก JST…</p>
        ) : choices.length ? (
          <div className="toolbar" style={{ marginTop: 10 }}>
            {choices.map((c) => (
              <button
                key={c.tag} type="button" className={`chip ${c.selected ? 'active' : ''}`} data-tag={c.tag}
                disabled={saving || !!c.owner} title={c.owner ? `เป็นของ ${c.owner}` : undefined}
                onClick={() => setSelected((s) => toggleTag(s, c.tag))}
              >
                {c.tag} ({c.sessions.toLocaleString('th-TH')})
              </button>
            ))}
          </div>
        ) : (
          <div className="empty">ไม่พบ tag Admin_* ใน JST</div>
        )}
        <div className="inline-form">
          <button className="btn primary" id="tag-save" disabled={saving || !userId || !tagsChanged(selected, saved)} onClick={() => void onSave()}>
            {saving ? 'กำลังบันทึก…' : 'บันทึก tag'}
          </button>
        </div>
        <p className="help" style={{ marginTop: 10 }}>บันทึกแล้วระบบจะคำนวณฐานลูกค้าใหม่ อาจใช้เวลาหลายวินาที</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: route** — `app/(app)/setup/page.tsx` (แทนทั้งไฟล์ — redirect เซลล์ไป `/leads` เหมือนเดิม)

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SetupPage } from '@/components/setup/SetupPage';
import { useApp } from '@/lib/state/AppProvider';

export default function Page() {
  const { state } = useApp();
  const router = useRouter();
  useEffect(() => {
    if (!state.isAdmin) router.replace('/leads'); // หลังบ้านเฉพาะหัวหน้า (prototype route L140)
  }, [state.isAdmin, router]);
  if (!state.isAdmin) return null;
  return <SetupPage />;
}
```

แล้วลบ placeholder ที่ไม่มีหน้าใช้แล้ว:

```bash
git rm components/shell/Placeholder.tsx
grep -rn "Placeholder" app components lib   # ต้องไม่พบ component Placeholder (พบแค่ namePlaceholder ของตัวสร้างแคมเปญ)
```

- [ ] **Step 4: ตรวจ**

Run: `npm run typecheck && npm run lint && npm test`
Expected: ไม่มี error; `Tests  169 passed (169)`

ดูด้วยตา (fixture พอร์ต 3200) `/setup`: การ์ด "ทีมเซลล์" 4 แถว (อาทิตยา คชสร เซลล์ 3 ลีด … Dev MPD หัวหน้า 7 ลีด) + ฟอร์มอีเมล/บทบาท/"เพิ่ม" (กด = toast โหมด fixture), การ์ด "แคมเปญ" 3 แถว (Hosttail · ทาสแมวกลับมาซื้อ = "เด้งเข้าเซลล์ที่ขายล่าสุด"), การ์ด "ผูก tag JST กับเซลล์" ขึ้น "ไม่พบ tag Admin_* ใน JST" (โหมด fixture ไม่เรียก RPC); ไม่มีการ์ด "ข้อมูลตัวอย่าง"

- [ ] **Step 5: Commit**

```bash
git add lib/domain/setup.test.ts components/setup/SetupPage.tsx "app/(app)/setup/page.tsx"
git commit -m "feat(web): add settings with team from Supabase, add/deactivate members, JST tag mapping and campaign claim mode" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: เทียบ Dashboard และตั้งค่ากับ prototype (Playwright)

**Files:**
- Modify: `e2e/visual-parity.spec.ts`
- Create: `e2e/.legacy-shots/app/setup-desktop.png`, `e2e/.legacy-shots/app/setup-mobile.png`

- [ ] **Step 1: ต่อท้าย `e2e/visual-parity.spec.ts`** (ใช้ helper ของแผน B/C1: `SIZES`, `LEGACY`, `APP`, `INJECT`, `MEASURE`, `settleWork`, `unclipView`, `shootLegacy`)

```ts

/* ---------- แผน C2: Dashboard และตั้งค่า ---------- */
// ความต่างที่ตั้งใจ (หน้าตั้งค่า): ฟอร์มเพิ่มเซลล์ด้วยอีเมล, การ์ด "ผูก tag JST กับเซลล์" แทนการ์ด "ข้อมูลตัวอย่าง" → เทียบ prototype เฉพาะรายชื่อทีม
// และการ์ดแคมเปญ ส่วนหน้าตั้งค่าทั้งหน้าใช้ภาพของตัวเอง (e2e/.legacy-shots/app/)
// ค่าตั้งต้นจากการวัดตอนเขียนแผน — Task 6 Step 4 วัดซ้ำ 3 รอบแล้วแก้เป็นค่าสูงสุด × 1.25 ปัดขึ้นหลัก 50
const MAX_DIFF_C2: Record<string, number> = {
  'dashboard-view-desktop': 4600, 'dashboard-view-mobile': 4150, 'dashboard-topbar-desktop': 100, 'dashboard-topbar-mobile': 100,
  'dashboard-host-desktop': 3900, 'dashboard-host-mobile': 3450, 'setup-campaigns-desktop': 950, 'setup-campaigns-mobile': 1850,
};
const shotC2 = (name: string) => ({ maxDiffPixels: MEASURE ? 0 : (MAX_DIFF_C2[name] ?? 0), threshold: 0.1 }) as const;

async function openLegacyRoute(page: Page, hash: string, ready: string) {
  await page.goto(LEGACY);
  await page.locator('#l-demo').click();
  await expect(page.locator('#login')).toBeHidden();
  await page.evaluate((h) => {
    location.hash = h;
  }, hash);
  await expect(page.locator(ready).first()).toBeVisible();
  await settleWork(page);
}

async function openAppRoute(page: Page, path: string, ready: string) {
  await page.goto(`${APP}${path}`);
  await expect(page.locator(ready).first()).toBeVisible({ timeout: 60_000 });
  if (INJECT) await page.addStyleTag({ content: INJECT });
  await settleWork(page);
}

/** ข้อความ/คลาส/สี/ความกว้าง bar ของ Dashboard */
async function dashboardText(page: Page) {
  return page.evaluate(() => {
    const t = (el: Element | null) => ((el instanceof HTMLElement ? el.innerText : el?.textContent) ?? '').replace(/\s+/g, ' ').trim();
    const cls = (el: Element) => (typeof el.className === 'string' ? el.className : '').split(/\s+/).filter(Boolean).join(' ');
    const view = document.querySelector('#view');
    const all = (sel: string) => Array.from(view?.querySelectorAll(sel) ?? []);
    return {
      period: all('.period [data-pk]').map((b) => `${cls(b)}|${t(b)}`),
      chips: all('[data-brand]').map((b) => ({ text: t(b), cls: cls(b), dot: (b.querySelector('.dot') as HTMLElement | null)?.style.background ?? null })),
      kpis: all('.kpi').map(t),
      panels: all('.panel-h').map(t),
      tables: all('table').map((tb) => Array.from(tb.querySelectorAll('tr')).map((tr) => `${cls(tr)}|${Array.from(tr.children).map(t).join(' | ')}`)),
      bars: all('.rep-row .bar > i').map((i) => (i as HTMLElement).style.width),
      reps: all('.rep-row').map(t),
      feed: all('.feed li').map((li) => `${cls(li)}|${t(li)}|${li.querySelector('.feed-ic')?.className ?? ''}`),
      rate: (view?.querySelector('#comm-rate') as HTMLInputElement | null)?.value ?? null,
      empty: all('.panel > .empty').map(t),
    };
  });
}

async function setupText(page: Page) {
  return page.evaluate(() => {
    const t = (el: Element | null) => ((el instanceof HTMLElement ? el.innerText : el?.textContent) ?? '').replace(/\s+/g, ' ').trim();
    const panels = Array.from(document.querySelectorAll('.settings > .panel'));
    return {
      heads: panels.slice(0, 2).map((p) => t(p.querySelector('.panel-h'))),
      team: Array.from(panels[0]?.querySelectorAll('.list-row') ?? []).map(t),
      campaigns: Array.from(panels[1]?.querySelectorAll('.list-row') ?? []).map((r) => {
        const s = r.querySelector('select') as HTMLSelectElement | null;
        return `${t(r.querySelector('div'))}|${t(r.querySelector('.tag'))}|${s?.value}|${Array.from(s?.options ?? []).map((o) => o.text).join(',')}`;
      }),
      help: t(panels[1]?.querySelector('.help') ?? null),
    };
  });
}

for (const s of SIZES) {
  test.describe(`dashboard and setup ${s.tag} ${s.width}x${s.height}`, () => {
    test.use({ viewport: { width: s.width, height: s.height } });

    test('dashboard matches the prototype (every brand, Hosttail with a commission rate)', async ({ page }) => {
      await openLegacyRoute(page, '#dashboard', '.kpis');
      const legacy = await dashboardText(page);
      expect(legacy.kpis).toHaveLength(5);
      await shootLegacy(page, `dashboard-topbar-${s.tag}`, '.topbar');
      await unclipView(page);
      await shootLegacy(page, `dashboard-view-${s.tag}`, '#view');
      await page.locator('[data-brand=hosttail]').click();
      await page.locator('#comm-rate').fill('3');
      await page.locator('#comm-rate').press('Enter');
      await page.locator('#comm-rate').blur();
      await settleWork(page);
      const legacyHost = await dashboardText(page);
      expect(legacyHost.panels[1]).toContain('Hosttail');
      await shootLegacy(page, `dashboard-host-${s.tag}`, '#view');

      await openAppRoute(page, '/dashboard', '.kpis');
      expect(await dashboardText(page)).toEqual(legacy);
      await expect.soft(page.locator('.topbar')).toHaveScreenshot(`dashboard-topbar-${s.tag}.png`, shotC2(`dashboard-topbar-${s.tag}`));
      await unclipView(page);
      await expect.soft(page.locator('#view')).toHaveScreenshot(`dashboard-view-${s.tag}.png`, shotC2(`dashboard-view-${s.tag}`));
      await page.locator('[data-brand=hosttail]').click();
      await page.locator('#comm-rate').fill('3');
      await page.locator('#comm-rate').blur();
      await settleWork(page);
      expect(await dashboardText(page)).toEqual(legacyHost);
      await expect.soft(page.locator('#view')).toHaveScreenshot(`dashboard-host-${s.tag}.png`, shotC2(`dashboard-host-${s.tag}`));
    });

    test('setup matches the prototype for the team list and the campaign panel', async ({ page }) => {
      await openLegacyRoute(page, '#setup', '.settings');
      const legacy = await setupText(page);
      expect(legacy.team).toHaveLength(4);
      await shootLegacy(page, `setup-campaigns-${s.tag}`, '.settings > .panel:nth-child(2)');
      await openAppRoute(page, '/setup', '.settings');
      expect(await setupText(page)).toEqual(legacy);
      await expect.soft(page.locator('.settings > .panel:nth-child(2)')).toHaveScreenshot(`setup-campaigns-${s.tag}.png`, shotC2(`setup-campaigns-${s.tag}`));
      await expect(page.locator('.settings > .panel .panel-h h2')).toHaveText(['ทีมเซลล์', 'แคมเปญ', 'ผูก tag JST กับเซลล์']);
      await expect(page.locator('#rep-email')).toHaveAttribute('type', 'email');
      await expect(page.locator('#reset')).toHaveCount(0);
      await unclipView(page);
      await expect.soft(page.locator('.settings')).toHaveScreenshot(['app', `setup-${s.tag}.png`], { maxDiffPixels: 0, threshold: 0.1 });
    });
  });
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: ไม่มี error

- [ ] **Step 3: รันครั้งแรก + สร้างภาพของหน้าตั้งค่า**

Run: `npx playwright test -g "dashboard and setup" --update-snapshots=missing`
Expected: `4 passed` และมี `e2e/.legacy-shots/app/setup-desktop.png`, `setup-mobile.png` — เปิดดูด้วยตาว่าเป็นหน้าตั้งค่า 3 การ์ด ก่อน commit

ถ้า `toEqual` ของ `dashboardText` / `setupText` ตก = ข้อความ/คลาส/สี/ความกว้าง bar ต่างจริง → แก้ component ให้ตรง `legacy/app.js` L301-382

- [ ] **Step 4: วัด `maxDiffPixels` 3 รอบ**

Run 3 ครั้ง: `PARITY_MEASURE=1 npx playwright test -g "dashboard and setup" 2>&1 | grep -E "pixels \(ratio|Snapshot:"`

แก้ `MAX_DIFF_C2` = ค่าสูงสุด × 1.25 ปัดขึ้นหลัก 50 (ค่าที่วัดได้ตอนเขียนแผน 1 รอบ desktop/mobile: dashboard-view 3674/3282, dashboard-topbar 46/46, dashboard-host 3081/2727, setup-campaigns 724/1464)

Run: `npm run test:e2e`
Expected: `29 passed`

- [ ] **Step 5: Teeth check**

Run: `PARITY_INJECT_CSS='.kpi-value { letter-spacing: .4px; }' npx playwright test -g "dashboard matches"`
Expected: `2 failed`

Run: `PARITY_INJECT_CSS='.list-row { padding-left: 3px !important; }' npx playwright test -g "setup matches"`
Expected: `2 failed`

Run: `npm run test:e2e`
Expected: `29 passed`

- [ ] **Step 6: Commit**

```bash
git add e2e/visual-parity.spec.ts e2e/.legacy-shots/app/setup-desktop.png e2e/.legacy-shots/app/setup-mobile.png
git commit -m "test(web): compare the dashboard and settings with the prototype at 375 and 1280 px" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: รอบมือถือ 375px ทุกหน้า

e2e ทุก test รันที่ 375×812 อยู่แล้ว (15 จาก 29 test) และหน้าที่มีใน prototype เทียบภาพ/DOM ตรงตัว — Task นี้ยืนยันด้วยตาในส่วนที่ภาพ element ไม่ครอบคลุม (การเลื่อน, เมนู, popup ยาว, ข้อความล้น) **คาดว่าไม่ต้องแก้โค้ด** ถ้าพบปัญหาให้แก้ markup ให้ตรง prototype (ห้ามแก้ `styles/prototype.css`) และถ้าเป็นปัญหาที่ prototype ก็มี ให้จดไว้ในคำถามท้ายแผนแทนการแก้

**Files:** ไม่มี (ถ้าต้องแก้: component ที่เกี่ยวข้อง)

- [ ] **Step 1: e2e เฉพาะมือถือ**

Run: `npx playwright test -g "375x812"`
Expected: `15 passed`

- [ ] **Step 2: ไล่ด้วยตาที่ 375px** — fixture (พอร์ต 3200) + DevTools device toolbar 375×812 (iPhone) เทียบกับ prototype ที่ขนาดเดียวกัน ทุกข้อต้องเหมือน prototype:

1. ทุกหน้า: ปุ่มเมนู ☰ เปิด sidebar + scrim, คลิก scrim/เลือกเมนูแล้วปิด, หน้าไม่เลื่อนแนวนอน (ตารางเลื่อนแนวนอนในกรอบ `.table-wrap` เท่านั้น), topbar ติดด้านบนตอนเลื่อน
2. `/leads`: ช่องค้นหาเต็มแถว, ชิปสถานะขึ้นบรรทัดใหม่ได้, ปุ่ม "+ เพิ่มลูกค้าจากถังลูกค้าทั้งหมด" ใน topbar
3. `/campaigns/bebeplay`: การ์ด 1 คอลัมน์, ปุ่ม topbar 2 ปุ่ม (หัวหน้า), ช่องค้นหาถังเต็มแถว, ปุ่ม "← ก่อนหน้า / ถัดไป →" อยู่บรรทัดเดียวกับข้อความช่วง, popup E/F เต็มความกว้าง (แท็บของ popup F เลื่อนแนวนอนได้ถ้าล้น), แถว funnel/เงื่อนไขขึ้นบรรทัดใหม่
4. `/mine` `/pool`: ช่องค้นหา + select แบรนด์ + "กำลังโหลด…" ขึ้นบรรทัดใหม่ได้ไม่ล้น
5. `/dashboard`: KPI 2 คอลัมน์, ตารางแบรนด์/ค่าคอมเลื่อนแนวนอน, `.grid-2` เป็น 1 คอลัมน์ (≤900px), ช่องอัตราค่าคอมกดพิมพ์ได้
6. `/setup`: การ์ด 1 คอลัมน์, ฟอร์มอีเมลขึ้นบรรทัดใหม่ได้, ชิป tag ขึ้นบรรทัดใหม่, ปุ่ม "ปิดใช้งาน" ไม่ดันชื่อจนล้น
7. popup ทุกตัว: ปิดด้วยปุ่ม X / แตะพื้นหลังได้, เนื้อหายาวเลื่อนในกรอบ popup

- [ ] **Step 3: Commit (เฉพาะเมื่อแก้โค้ด)**

```bash
git add -A
git commit -m "fix(web): align mobile layout of <page> with the prototype" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: เอกสาร — `README.md`, `docs/DATABASE.md`, `CLAUDE.md`

**Files:**
- Modify: `README.md`, `docs/DATABASE.md`, `CLAUDE.md`

- [ ] **Step 1: `README.md`** (แทนทั้งไฟล์)

~~~md
# MPD Direct Sale

เว็บแอปของทีม Direct Sale (MPD Group: Bebeplay / Hosttail) ให้เซลล์โทร/แชตหาลูกค้าเก่า จองลูกค้าจากถัง ติดตามแคมเปญ และให้หัวหน้าดูภาพรวมทีม

- Next.js 15 (App Router) + React 19 + TypeScript · Supabase (schema `dsales`, ล็อกอินด้วยอีเมล/รหัสผ่าน) · Vercel
- หน้าตาตาม prototype เดิม (`styles/prototype.css`) — ต้นแบบเก็บไว้ใน `e2e/legacy-reference/` ใช้เทียบหน้าตาใน e2e เท่านั้น
- รายละเอียดสำหรับนักพัฒนา (กติกา DB, โหมด fixture, ขั้นตอน migration): `CLAUDE.md`

## หน้า

| URL | หน้า | สิทธิ์ |
|---|---|---|
| `/login` | เข้าสู่ระบบ | ทุกคน |
| `/leads` | Direct Sale — ลีดของฉัน (หัวหน้าเห็นทุกคน), บันทึกโทร/แชต, ตรวจการทักแชตจาก JST | สมาชิก |
| `/mine` | ลูกค้าของฉัน (ลีดที่ดูแล + ลูกค้าตาม tag JST) | สมาชิก |
| `/pool` | ถังกลาง (ลูกค้าเก่าที่ยังไม่มีเจ้าของ) | สมาชิก |
| `/campaigns/bebeplay`, `/campaigns/hosttail` | แคมเปญ + ถังลูกค้าทั้งหมดของแบรนด์ | สมาชิก (สร้างแคมเปญ = หัวหน้า) |
| `/dashboard` | ภาพรวมทีม + ยอดที่ปิดได้รายเดือนต่อเซลล์ (ค่าคอม) | สมาชิก |
| `/setup` | ทีมเซลล์, ผูก tag JST, วิธีจองของแคมเปญ | หัวหน้า |

ใช้งานได้เฉพาะสมาชิกที่หัวหน้าเพิ่มไว้ในหน้า "ตั้งค่า" และยังเปิดใช้งาน (บัญชีอื่นล็อกอินได้แต่เห็นการ์ด "ยังไม่มีสิทธิ์ใช้งาน ติดต่อหัวหน้า")

## เริ่มพัฒนา

```bash
npm install
cp .env.example .env.local      # ใส่ NEXT_PUBLIC_SUPABASE_ANON_KEY (publishable key)
npm run dev                     # http://localhost:3000
```

ดูหน้าตาโดยไม่ล็อกอิน (ข้อมูลตัวอย่าง, `next dev` เท่านั้น): `NEXT_PUBLIC_FIXTURES=1 npm run dev`

## ตรวจก่อน commit / deploy

```bash
npm run typecheck && npm run lint && npm test
npm run build && npm run check:fixtures
npm run test:e2e                # เทียบหน้าตากับ prototype (ต้องต่ออินเทอร์เน็ต) แล้ว npm run build ใหม่ก่อน check:fixtures
```

## Deploy

Vercel (Framework Preset: Next.js) deploy จาก branch `claude/serene-meitner-cprt82` — env ที่ต้องตั้ง: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_JST_HELPER_URL`, `NEXT_PUBLIC_JST_URL_TEMPLATE` (ว่างได้) — ห้ามตั้ง `NEXT_PUBLIC_FIXTURES=1`

## เปิดแชตใน JST / โทร / ตรวจการทักแชต

- ปุ่มโทร (เปิด `tel:` + คัดลอกเบอร์) และไอคอนช่องทางแชตแยกตามร้าน อยู่ในตารางลีดและ popup ลูกค้า
- กดไอคอน หรือกด "จอง" เว็บสั่งตัวช่วยบนเครื่องเซลล์ให้เปิดแชตลูกค้าใน JST — ดู `tools/jst-helper/README.md` (ไม่ได้รันตัวช่วย = คัดลอกชื่อแชตให้ไปค้นหาเอง)
- ตรวจว่าเซลล์ทักแชตจริงด้วย `dsales_customer_chats` (นับข้อความฝั่งแอดมินหลังเวลาจอง) — ตรวจอัตโนมัติไม่เกิน 10 ลีดต่อรอบเมื่อเปิดหน้า Direct Sale

ฐานข้อมูล: `docs/DATABASE.md` · แผน/สเปก: `docs/superpowers/`
~~~

- [ ] **Step 2: `docs/DATABASE.md`** — ปรับให้ตรงกับ schema `dsales` ปัจจุบัน

แทน blockquote หัวไฟล์ (บรรทัดที่ขึ้นต้น `> สำรวจจาก Supabase project …` จนถึง `> ตัวเลขจำนวนแถว…`) ด้วย

```md
> สำรวจจาก Supabase project `nroyacasuchqniaiuirk` (production ที่ใช้ร่วมกับระบบอื่นของบริษัท: MRP, HR, CDP, bot ฯลฯ — ห้ามแก้ schema อื่นนอกจาก `dsales`)
>
> **อัปเดต 2026-11-19 (แผน C):** หัวข้อ 3, 4, 5.5 และ 6 ตรงกับ migration ใน `supabase/migrations/` (ทุกอย่างของ Direct Sale อยู่ใน schema `dsales` แล้ว) และหน้าเว็บ Next.js
> ตัวเลขจำนวนแถวและข้อสังเกตด้านข้อมูล (หัวข้อ 2, 5.1–5.4) ยังเป็นผลสำรวจเดิมของ 2026-11-17
```

แทนหัวข้อ `## 3. ตาราง Direct Sale (`dsales_*`) …` ทั้งหัวข้อ (จนก่อน `## 4.`) ด้วย

```md
## 3. ตาราง Direct Sale (schema `dsales`)

| ตาราง / view | คอลัมน์หลัก | การเข้าถึงจากหน้าเว็บ |
|---|---|---|
| `dsales_members` | user_id, role (`admin`/`sales`), display_name, active, jst_tags[], created_at | อ่าน/แก้ผ่าน RPC เท่านั้น (ถอน insert/update/delete/truncate จาก `authenticated`) |
| `dsales_campaigns` | id, brand, name, description, start_date, end_date, claim_mode (`self`/`assign`/`auto`), max_per_rep, criteria jsonb, active, created_by | RLS: อ่าน = สมาชิก active, insert/update = หัวหน้า (หน้าแคมเปญสร้าง, หน้าตั้งค่าแก้ `claim_mode`) |
| `dsales_leads` | id, campaign_id, source (`self`/`campaign`), brand, name, phone, phone_normalized, identity_id, address, shop, chat_name, channels jsonb, owner_id, last_seller_id, claimed_by, claimed_at, status, callback_date, interest, closed_bills[], closed_amount, closed_at, no_call, no_call_by, no_call_at, released_by[], auto_skip | RLS อ่าน: หัวหน้าทุกแถว / สมาชิก active เฉพาะที่ตัวเองดูแล; เขียนผ่าน RPC |
| `dsales_interactions` | id, lead_id, type (`call`/`chat`), result, note, bills[], due, rep_id, created_at | RLS ตามลีด; เขียนผ่าน `dsales_log` |
| `dsales_customer_base` | phone_normalized (PK), identity_id, name, chat_name, last_order_date, dormant_days, order_count, ltv, segment, rfm_segment, brands[], owner_tag, owner_id, eligible, refreshed_at | **ภายใน — ไม่มี grant ให้ `authenticated`/`anon`** อ่านผ่าน `dsales_base_customers` เท่านั้น คำนวณใหม่ทุกชั่วโมง (pg_cron `dsales-refresh-customer-base` นาทีที่ 5) และทุกครั้งที่หัวหน้าบันทึก tag |
| `dsales_chat_links` | ms_id, phone_normalized, method, evidence, confidence, linked_at | ภายใน — ห้าม grant |
| `dsales_settings` | key, value jsonb (เช่น `dormant_days`), updated_at | ภายใน — ห้าม grant |
| `dsales_chat_messages_v` (view) | id, ms_id, time (แก้เวลาที่เร็วกว่าจริง 7 ชม.), raw_time, dir, fmt, text, sender | ใช้ภายในฟังก์ชันตรวจแชต |

สิทธิ์เข้าใช้ (migration `20261117100000_dsales_members_only.sql`, `…100100_dsales_access_hardening.sql`, `…100200_dsales_revoke_truncate.sql`):
- เข้าใช้ได้เฉพาะแถวใน `dsales_members` ที่ `active = true` — `dsales_uid()` โยน `not_authenticated` (ไม่มี session) / `not_member` (ไม่ใช่สมาชิก active) และทุก RPC ที่คืนข้อมูลลูกค้าเรียกฟังก์ชันนี้
- `dsales_register()` **ไม่เพิ่มสมาชิกอัตโนมัติแล้ว** หัวหน้าเพิ่มสมาชิกด้วยอีเมลในหน้าตั้งค่า (`dsales_add_member`) ต้องมีหัวหน้า active อย่างน้อย 1 คนเสมอ (`last_admin`) และปิดใช้งานตัวเองไม่ได้ (`cannot_deactivate_self`)
- หน้าเว็บ (Next.js) ไม่เขียนตารางตรงยกเว้น `dsales_campaigns` (insert/update ตาม RLS ของหัวหน้า)
```

แทนหัวข้อ `## 4. ฟังก์ชัน (RPC) ฝั่ง Direct Sale` ทั้งหัวข้อ (จนก่อน `## 5.`) ด้วย

```md
## 4. ฟังก์ชัน (RPC) ฝั่ง Direct Sale

อยู่ใน schema `dsales` ทั้งหมด เป็น `SECURITY DEFINER` + `set search_path = dsales, public` + `revoke … from public, anon` / `grant execute … to authenticated` หน้าเว็บเรียกผ่าน `lib/api/rpc.ts` เท่านั้น (error แปลเป็นไทยด้วย `toThaiError`)

| ฟังก์ชัน | หน้าที่ | หน้าเว็บที่ใช้ |
|---|---|---|
| `dsales_me()` | user_id, email, display_name, is_admin, is_member, active | ตอนเปิดแอป (ไม่ใช่สมาชิก active = การ์ดไม่มีสิทธิ์ ไม่โหลดข้อมูลอื่น) |
| `dsales_team()` | สมาชิกทั้งหมด (user_id, display_name, role, active, email) | shell, ตาราง, ตั้งค่า |
| `dsales_add_member(p_email, p_role)` / `dsales_set_member_active(p_user, p_active)` | หัวหน้าเพิ่ม/เปิดใช้งานใหม่ และปิดใช้งานสมาชิก (advisory lock) | ตั้งค่า |
| `dsales_jst_admin_tags()` / `dsales_member_tags()` / `dsales_set_member_tags(p_user, p_tags)` | tag `Admin_*` จาก JST, tag ของสมาชิก, หัวหน้าผูก tag (1 tag ต่อ 1 คน `tag_taken: <tag>`) แล้วคำนวณ `dsales_customer_base` ใหม่ (หลายวินาที) | ตั้งค่า |
| `dsales_my_leads(p_limit, p_offset)` | ลีดของฉัน + ลีดแคมเปญที่ยังไม่มีเจ้าของ (หัวหน้าเห็นทั้งหมด) หน้าเว็บขอ 1,000 | ตอนเปิดแอป |
| `dsales_customer_pool_v4(p_search, p_limit, p_offset, p_from, p_to, p_brand)` | ถังลูกค้าทั้งหมดของแบรนด์ + สถานะจอง (lead_id, taken, mine, no_call, reserved_by) สูงสุด 100/หน้า | หน้าแคมเปญ (ถัง) |
| `dsales_customer_pool_v3(…)` | รุ่นเดิม | นับลูกค้าทั้งแบรนด์ (`p_limit: 1` อ่าน `total_count`) ครั้งเดียวต่อแบรนด์ |
| `dsales_base_customers(p_scope, p_search, p_limit, p_offset, p_brand)` | ฐานลูกค้าเก่า (`dsales_customer_base`) ตาม scope `mine` / `pool` / `team` + dormant_days, owner_tag | `/mine`, `/pool` |
| `dsales_customer_purchases(p_phone)` / `dsales_customer_channels(p_phone)` | ประวัติซื้อ / ช่องทาง-ร้านที่เคยสั่ง | popup ลูกค้า, popup ถัง, หลังจอง |
| `dsales_customer_chats(p_phone, p_since)` | แชต JST + จำนวนข้อความฝั่งแอดมินหลัง `p_since` | ตรวจการทักแชต |
| `dsales_claim_customer(p_phone, p_brand)` | จองลูกค้าจากถัง/ฐานลูกค้า (สร้างลีด `self` หรือจองลีดเดิม; ของเซลล์อื่นตาม tag = `taken`) | ถัง, `/mine`, `/pool` |
| `dsales_claim_lead` / `dsales_unclaim_lead(p_lead)` | จองลีดแคมเปญ / ยกเลิกจอง·คัดออก | หน้าแคมเปญ, ตาราง, popup |
| `dsales_assign_lead(p_lead, p_user)` | หัวหน้ามอบหมายลีด | หน้าแคมเปญ |
| `dsales_log(…)` / `dsales_set_nocall(p_lead, p_on)` | บันทึกโทร/แชต + สถานะ / ห้ามโทร | popup บันทึก, ตาราง |
| `dsales_uid()`, `dsales_is_admin()`, `dsales_is_member()` | ตรวจสิทธิ์ (ใช้ใน RPC และ RLS) | — ไม่เรียกตรง |
| `dsales_refresh_customer_base()`, `dsales_seed_chat_links_by_name()` | งานเบื้องหลัง (pg_cron) — ไม่มี grant ให้ `authenticated` | — |
| `dsales_lead_json`, `dsales_norm_phone`, `dsales_norm_platform`, `dsales_valid_phone`, `dsales_touch_updated_at` | helper / trigger | — |

ทุก migration อยู่ใน `supabase/migrations/` (เริ่มจาก `20261117090000_baseline_public_dsales_functions.sql`) พร้อม SQL test ใน `supabase/tests/` — ขั้นตอนเพิ่ม migration ดู `CLAUDE.md`
```

ในหัวข้อ `### 5.5 อื่น ๆ` แทน 4 bullet เดิมด้วย

```md
- ✅ frontend เป็น Next.js อ่าน/เขียนผ่าน RPC ใน schema `dsales` ทั้งหมด ไม่มีโหมดตัวอย่าง/`localStorage` ใน production (โหมด fixture มีเฉพาะ `next dev`)
- ✅ ตัด fallback "อีเมล `dev@mpdgroup.co` = หัวหน้า" แล้ว สิทธิ์มาจาก `dsales_me()` อย่างเดียว
- ✅ migration ของ `dsales` อยู่ใน `supabase/migrations/` ครบ (export baseline จาก DB แล้ว)
- ⚠️ ผลตรวจ "ทักแชตแล้ว" (ข้อ 6) ยังเก็บแค่ในหน่วยความจำของหน้าเว็บ (`lead.chatCheck`) รีเฟรชแล้วต้องตรวจใหม่
- ⚠️ funnel ของตัวสร้างแคมเปญยังเป็น 0 ตอนล็อกอินจริง (ไม่มี RPC กรองลูกค้าตามเงื่อนไข) และแคมเปญยังไม่สร้างลีดจาก `criteria` — เฟส 2
```

ในตารางหัวข้อ `## 6.` แถวขั้น 2 แทนข้อความ `` `DS_CONFIG.jst.urlTemplate` `` และ `` (`urlTemplate` ใน `config.js` ยังว่าง) `` ด้วย `` env `NEXT_PUBLIC_JST_URL_TEMPLATE` `` และ `` (`NEXT_PUBLIC_JST_URL_TEMPLATE` ยังว่าง) `` ตามลำดับ

- [ ] **Step 3: `CLAUDE.md`**

แทนหัวข้อ `## งานค้างสำหรับแผน C (ส่วน C2)` ทั้งหัวข้อ (2 bullet) ด้วย

```md
## งานค้าง (หลังแผน C)

- funnel ของตัวสร้างแคมเปญเป็น 0 ตอนล็อกอินจริง และแคมเปญยังไม่สร้างลีดจาก `criteria` (ต้องมี RPC ใหม่ — เฟส 2)
- โหมด `auto` ยังอ่านเป็น `self` และปุ่ม "จัดสรรให้เซลล์ที่ขายล่าสุด" ขึ้น "ไม่มีลีดที่ต้องจัดสรร" เสมอ (ยังไม่มีการผูกผู้ขายล่าสุดกับเซลล์)
- ผลตรวจทักแชตไม่ถูกบันทึกลง DB (ดู `docs/DATABASE.md` ข้อ 5.5)
```

ในหัวข้อ `## Architecture` แก้

```md
  modals/                       # CustomerModal (+ChatCheckBody), LogModal, ConfirmUnclaimModal, PickFromBucketModal, PoolDetailModal (E), CampaignFormModal (F)
```

เป็น

```md
  modals/                       # CustomerModal (+ChatCheckBody), LogModal, ConfirmUnclaimModal, PickFromBucketModal, PoolDetailModal (E), CampaignFormModal (F)
  dashboard/DashboardPage.tsx   # KPI, เปรียบเทียบแบรนด์, ค่าคอม + คัดลอก TSV, ผลงานรายเซลล์, กิจกรรมล่าสุด
  setup/SetupPage.tsx           # ทีม (เพิ่มด้วยอีเมล/ปิดใช้งาน), วิธีจองของแคมเปญ, ผูก tag JST
```

และแก้

```md
  domain/                       # period, leads, log, campaigns, pool (ฟังก์ชันล้วน มี test)
```

เป็น

```md
  domain/                       # period, leads, log, campaigns, pool, dashboard, setup (ฟังก์ชันล้วน มี test)
```

ในหัวข้อ `## Commands` แก้ bullet e2e เป็น

```md
- e2e เทียบภาพกับ prototype ครอบคลุม `/leads`, หน้าแคมเปญ + ถังลูกค้า, Dashboard, ตั้งค่า และ popup A–F (29 tests); ค่า limit วัดจริงด้วย `PARITY_MEASURE=1` (รัน 3 ครั้ง ×1.25) — ถ้าเกินให้วัดใหม่ ห้ามเพิ่ม limit เอง; สีตรวจด้วย computed-style
- `/mine` `/pool` และหน้าตั้งค่าทั้งหน้าเทียบกับภาพของตัวเองที่ commit ไว้ใน `e2e/.legacy-shots/app/` (ตั้งใจเปลี่ยนหน้าตา → `npx playwright test -g "<ชื่อ test>" --update-snapshots=changed` แล้วตรวจภาพด้วยตาก่อน commit)
```

(bullet "`/mine` `/pool` ไม่มีใน prototype…" ที่ C1 เพิ่มไว้ ให้ลบเพราะรวมในบรรทัดใหม่แล้ว)

ในหัวข้อ `## เอกสาร` แก้ `- ฐานข้อมูล: `docs/DATABASE.md`` เป็น `- ฐานข้อมูล: `docs/DATABASE.md` (schema `dsales`, สิทธิ์สมาชิก, RPC ทั้งหมด)`

- [ ] **Step 4: ตรวจ link/path ในเอกสาร**

Run: `grep -n "index.html\|live-part1\|localStorage" README.md docs/DATABASE.md CLAUDE.md`
Expected: ไม่พบใน `README.md`; ใน `docs/DATABASE.md` พบเฉพาะบรรทัด 5.5 ที่บอกว่าไม่มี `localStorage` ใน production แล้ว; ใน `CLAUDE.md` พบเฉพาะการอ้าง `legacy/index.html` ในฐานะต้นแบบ (Task 8 เปลี่ยน path)

- [ ] **Step 5: Commit**

```bash
git add README.md docs/DATABASE.md CLAUDE.md
git commit -m "docs: describe the Next.js app, members-only access and the dsales schema RPCs" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: ตรวจก่อน deploy (ในเครื่อง)

**Files:** ไม่มี (ถ้าต้องแก้: ไฟล์ที่เกี่ยวข้อง แล้ว commit แยก)

- [ ] **Step 1: ตรวจอัตโนมัติตามลำดับ** (ปิด `npm start` / dev server ก่อน)

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run check:fixtures
npm run test:e2e
npm run build
npm run check:fixtures
git status --short
```

Expected:
- `typecheck`: ไม่มี output · `lint`: `✔ No ESLint warnings or errors`
- `test`: `Test Files  24 passed (24)` · `Tests  169 passed (169)`
- `build`: สำเร็จ ตาราง Route มี `○ /dashboard`, `○ /setup`, `○ /leads`, `○ /mine`, `○ /pool`, `ƒ /campaigns/[brand]`, `○ /login`, `ƒ Middleware`
- `check:fixtures`: `ok: ไม่มีข้อมูล fixture ใน .next/static และ .next/server` (ทั้งสองครั้ง)
- `test:e2e`: `29 passed`
- `git status --short`: ว่าง (ทุกอย่าง commit แล้ว)

- [ ] **Step 2: Checklist ด้วยบัญชีจริงในเครื่อง** — `.env.local` ครบ, `NEXT_PUBLIC_FIXTURES=0`; `npm run build && npm start` → http://localhost:3000 (ทำ checklist ของ C1 Task 9 Step 3 ข้อ 1–4, 9–10 ซ้ำแบบไม่เขียนข้อมูล แล้วต่อด้วย)

> **คำเตือน:** ข้อ 4–6 **เขียนข้อมูลจริง** (สมาชิก/tag/วิธีจอง) — ใช้บัญชีทดสอบที่หัวหน้าเตรียมไว้ และคืนค่าเดิมหลังทดสอบ

1. `/dashboard` ด้วยบัญชีหัวหน้า: ตัวเลข KPI สอดคล้องกับ `/leads` (ลีดทั้งหมด = จำนวนแถวที่ตัวกรอง "ทั้งหมด"), ตารางค่าคอมแสดงเฉพาะเซลล์ที่มียอดปิด, ใส่อัตรา 3 → คอลัมน์ "ค่าคอม (3%)", "คัดลอกตาราง" แล้ววางใน Excel ได้, รีเฟรชหน้าแล้วอัตรากลับเป็นว่าง (ไม่บันทึก — ตาม prototype)
2. `/dashboard` ด้วยบัญชีเซลล์: เห็นเฉพาะลีดของตัวเอง ผลงานรายเซลล์มีแถวเดียว
3. `/setup` ด้วยบัญชีเซลล์ → ถูกส่งไป `/leads`; ด้วยบัญชีหัวหน้า → ทีม (อีเมลใต้ชื่อ, แถวของตัวเองไม่มีปุ่มปิดใช้งาน), การ์ดแคมเปญ, การ์ด tag แสดง tag `Admin_*` พร้อมจำนวนห้องแชต (Network: `dsales_jst_admin_tags`, `dsales_member_tags`)
4. (เขียนข้อมูลจริง) เพิ่มสมาชิกด้วยอีเมลที่ไม่มีในระบบ → toast "ไม่พบบัญชีผู้ใช้อีเมลนี้ในระบบ"; เพิ่มบัญชีทดสอบเป็นเซลล์ → toast "เพิ่มเซลล์แล้ว" แถวใหม่ขึ้นทันที; "ปิดใช้งาน" → badge "ปิดใช้งาน" ปุ่มเป็น "เปิดใช้งาน"; ล็อกอินบัญชีทดสอบในอีกเบราว์เซอร์ → การ์ด "บัญชีนี้ถูกปิดใช้งาน ติดต่อหัวหน้า"; เปิดใช้งานคืน
5. (เขียนข้อมูลจริง) การ์ด tag: เลือกบัญชีทดสอบ → กด tag ที่ไม่มีเจ้าของ → "บันทึก tag" → ปุ่ม "กำลังบันทึก…" (หลายวินาที) → toast "บันทึก tag แล้ว…"; tag ของเซลล์อื่นกดไม่ได้และ hover เห็น "เป็นของ <ชื่อ>"; เอา tag ออกแล้วบันทึกคืนค่าเดิม
6. (เขียนข้อมูลจริง) การ์ดแคมเปญ: เปลี่ยนวิธีจองของแคมเปญทดสอบ → toast "บันทึกวิธีจองลีดแล้ว" → หน้าแคมเปญแถบ quota "วิธีจอง: …" เปลี่ยนตาม → เปลี่ยนคืน
7. มือถือจริง (หรือ DevTools 375px) ไล่ทุกหน้าตาม Task 4 Step 2 ด้วยข้อมูลจริง (ชื่อยาว/ตารางยาว)

ถ้าพบปัญหา แก้แล้ว commit แยก:

```bash
git add -A
git commit -m "fix(web): address pre-deploy findings" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Deploy ขึ้น Vercel (ผู้ใช้ยืนยันทุกขั้น)

> **แก้แผน 2026-11-19 หลังตรวจ Vercel (อ่านอย่างเดียว):** production branch ของโปรเจกต์ `directsales-web` คือ **`main`** (deployment `target: production` มาจาก `main` ทั้งหมด) ส่วน push `claude/serene-meitner-cprt82` ได้แค่ **Preview** · Framework Preset ของโปรเจกต์ = Other (`framework: null`), Node 26.x · branch นี้มี `vercel.json` (`framework: nextjs`, `npm ci`, `npm run build`, `.next`) และ `engines.node = 24.x` จึง **ไม่ต้องเปลี่ยนการตั้งค่าโปรเจกต์** — `main` ที่ยังเป็น prototype build แบบเดิมจนกว่าจะ merge · branch นี้ merge `origin/main` (PR #3 diff refresh) แล้ว PR #2 จึง merge ได้ไม่ชน

**Files:** ไม่มี (ไม่มีการแก้โค้ดใน Task นี้)

> ทุกขั้นที่มีป้าย **[ถามผู้ใช้]** ต้องหยุดถามในแชต อธิบายผลที่จะเกิด และรอคำตอบยืนยันก่อนทำ — ถ้าผู้ใช้ไม่ตอบหรือปฏิเสธ หยุด Task นี้ไว้ (งานในเครื่องยังอยู่ครบ) · Claude ห้ามเปลี่ยนการตั้งค่า Vercel เอง (อ่านอย่างเดียวได้)

- [ ] **Step 1: เตรียม branch ในเครื่อง (ยังไม่ push)**

```bash
git switch claude/serene-meitner-cprt82
git merge --ff-only feat/nextjs-plan-c
git status -sb
```

Expected: fast-forward สำเร็จ; `ahead N` เทียบ `origin/claude/serene-meitner-cprt82` — ถ้า `--ff-only` ไม่ผ่าน หยุดแจ้งผู้ใช้ ห้าม force · ถ้า `origin/main` มี commit ใหม่ที่ branch นี้ยังไม่มี (`git log HEAD..origin/main`) ให้ merge `origin/main` เข้ามาก่อนแล้วรันชุดตรวจ Task 6 ใหม่

- [ ] **Step 2: ผู้ใช้ตรวจ env ใน Vercel**

Settings → Environment Variables ทั้ง **Production และ Preview**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable key), `NEXT_PUBLIC_JST_HELPER_URL` (`http://127.0.0.1:47321`), `NEXT_PUBLIC_JST_URL_TEMPLATE` (ว่างได้) และ **ไม่มี** `NEXT_PUBLIC_FIXTURES=1` · ค่า `NEXT_PUBLIC_*` ถูกฝังตอน build แก้ค่าทีหลังต้อง Redeploy

- [ ] **Step 3: [ถามผู้ใช้] push → Preview deployment**

ถามผู้ใช้: "จะ push `claude/serene-meitner-cprt82` (N commit) ขึ้น origin — Vercel จะสร้าง Preview deployment เว็บ Next.js (production ที่ directsales-web.vercel.app ยังเป็น prototype เหมือนเดิม) และ commit ทั้งหมดจะไปอยู่ใน PR #2 ยืนยันไหม" — รอ "ใช่" แล้วจึงรัน

```bash
git push origin claude/serene-meitner-cprt82
```

Expected: push สำเร็จ ห้าม `--force` · Preview build log มี `▲ Next.js 15…`, `✓ Compiled successfully`, ตาราง Route เหมือน Task 6 Step 1 และสถานะ **Ready** (ดูด้วยเครื่องมืออ่านอย่างเดียว list/get deployment) · ถ้า build ล้ม: แก้ในเครื่อง ทำ Task 6 ใหม่ แล้วขอ push อีกครั้ง (production ไม่ได้รับผลกระทบ)

- [ ] **Step 4: Checklist บน Preview (ผู้ใช้ทำด้วยบัญชีจริง)** — URL Preview ต้องล็อกอิน Vercel ของทีมก่อน (SSO protection)

1. เปิด URL โดยไม่ล็อกอินแอป → `/login` (หน้าตาเหมือนเดิม ไม่มีปุ่ม "ดูตัวอย่างโดยไม่ล็อกอิน"); `/dashboard`, `/setup`, `/campaigns/bebeplay` → `/login`
2. ล็อกอินบัญชีหัวหน้า → `/leads`; รีเฟรชแล้วยังล็อกอินอยู่; "ออกจากระบบ" → `/login`
3. บัญชีพนักงานที่ไม่ใช่สมาชิก → การ์ด "ยังไม่มีสิทธิ์ใช้งาน ติดต่อหัวหน้า" (Network ไม่มี `dsales_my_leads` / `dsales_customer_*`)
4. ไล่ทุกหน้า: `/leads`, `/mine`, `/pool`, `/campaigns/bebeplay`, `/campaigns/hosttail`, `/dashboard`, `/setup` — ไม่มีหน้าขาว/error ใน Console, back ใช้ได้, `/xyz` → `/leads`
5. checklist ของ C1 Task 9 Step 3 ข้อ 1–4 และ C2 Task 6 Step 2 ข้อ 1–3 (ไม่เขียนข้อมูล)
6. DevTools Sources: ไม่มี `c-bebe-nov`, `dev@fixtures.test` ในไฟล์ JS
7. ตัวช่วย JST: บน Preview ตัวช่วยตอบ 403 (origin ไม่อยู่ใน `allowedOrigins` ของ `tools/jst-helper` ซึ่งมีแค่ `https://directsales-web.vercel.app`) เว็บจึงคัดลอกชื่อแชตแทน — ปกติ ทดสอบเปิดแชตอัตโนมัติหลังขึ้น production

- [ ] **Step 5: [ถามผู้ใช้] ขึ้น production = merge PR #2 เข้า `main`**

ถามผู้ใช้: "ตรวจ Preview ครบแล้ว จะ merge PR #2 (`claude/serene-meitner-cprt82` → `main`) ซึ่งทำให้ production เปลี่ยนจาก prototype เป็นเว็บ Next.js ทันที ยืนยันไหม" — ผู้ใช้กด merge เองบน GitHub หรือสั่งให้ Claude รัน `gh pr merge 2 --repo DevTeamMPD/directsales-web --merge` (ใช้ merge commit เพื่อให้ history ของ branch ต่อกัน ห้าม squash/force)

หลัง merge: deployment production ใหม่ต้อง **Ready** แล้วทำ checklist Step 4 ข้อ 1–4 ซ้ำบน `https://directsales-web.vercel.app` + เซลล์ 1 คนลองใช้งานจริงบนคอม (ตัวช่วย JST รันอยู่) + มือถือ: จองลูกค้าจากถัง → JST เปิดแชต → บันทึกการโทร → "ทักแชทแล้ว ✓" · ตรวจว่า domain production ตรงกับ `allowedOrigins` ของตัวช่วย JST

ถ้า production มีปัญหา: ผู้ใช้กด **Instant Rollback** ไป deployment prototype ก่อนหน้า (Hobby ย้อนได้แค่ 1 ตัวก่อนหน้า) — **หลัง rollback Vercel หยุด auto-promote** deployment ใหม่ของ `main` ต้องกด Promote (หรือ Undo Rollback) เองหลังแก้เสร็จ ไม่งั้นแก้แล้วก็ไม่ขึ้น

ถามผู้ใช้: "ตรวจ production ครบและใช้งานได้แล้วใช่ไหม (พร้อมย้าย prototype ออกจากรากโปรเจกต์)" — Task 8 ทำเมื่อผู้ใช้ยืนยัน

---

### Task 8: ย้าย `legacy/` → `e2e/legacy-reference/` (หลังผู้ใช้ยืนยัน production)

e2e ทั้ง 29 test ต้องเปิด prototype จริงเพื่อเทียบ DOM + ภาพ จึงย้าย (ไม่ลบ) ไปอยู่ใต้ `e2e/` — Next.js/Vercel ไม่ serve ไฟล์นอก `public/` ไฟล์เหล่านี้จึงไม่ขึ้นเว็บ (ตรวจแล้วตอนเขียนแผน: ย้ายใน copy ของ repo แล้ว e2e ผ่าน และสร้าง `lib/icons.ts` / `lib/fixtures/data.ts` ใหม่ต่างแค่บรรทัดหัวไฟล์)

**Files:**
- Move: `legacy/` → `e2e/legacy-reference/` (`app.js`, `config.js`, `data.js`, `icons.js`, `index.html`, `styles.css`)
- Modify: `playwright.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `tools/port-legacy.mjs`, `tools/check-no-fixtures.mjs`, `.env.example`, `CLAUDE.md`, `README.md` (บรรทัด 6 ที่บอกว่า prototype อยู่ใน `legacy/`), คอมเมนต์ `lib/fixtures/types.ts:3`
- Regenerate: `lib/icons.ts`, `lib/fixtures/data.ts` (เฉพาะบรรทัดหัวไฟล์เปลี่ยน)

- [ ] **Step 1: ย้ายไฟล์**

```bash
git switch claude/serene-meitner-cprt82
git mv legacy e2e/legacy-reference
```

- [ ] **Step 2: แก้ path ที่อ้าง `legacy/`**

`playwright.config.ts` แก้ `command: 'npx http-server legacy -p 4100 -c-1 -s',` เป็น

```ts
      command: 'npx http-server e2e/legacy-reference -p 4100 -c-1 -s',
```

`tsconfig.json` แก้ `"exclude": ["node_modules", "legacy", "tools"]` เป็น

```json
  "exclude": ["node_modules", "e2e/legacy-reference", "tools"]
```

`eslint.config.mjs` แก้ `{ ignores: ['legacy/**',` เป็น `{ ignores: ['e2e/legacy-reference/**',`

`tools/port-legacy.mjs`:
- บรรทัด 2 แก้ `// แปลงไฟล์ prototype ใน legacy/ เป็น TypeScript` เป็น `// แปลงไฟล์ prototype ใน e2e/legacy-reference/ (เดิม legacy/) เป็น TypeScript`
- หลังบรรทัด `import { runInNewContext } from 'node:vm';` เพิ่ม

```js

const SRC = 'e2e/legacy-reference';
```

- แก้ `loadLegacy('legacy/icons.js', 'DS_ICONS')` เป็น ``loadLegacy(`${SRC}/icons.js`, 'DS_ICONS')`` และ `loadLegacy('legacy/data.js', 'DS_DATA')` เป็น ``loadLegacy(`${SRC}/data.js`, 'DS_DATA')``
- ในข้อความหัวไฟล์ที่สคริปต์เขียน แก้ `สร้างจาก legacy/icons.js` เป็น `สร้างจาก e2e/legacy-reference/icons.js` และ `สร้างจาก legacy/data.js` เป็น `สร้างจาก e2e/legacy-reference/data.js`

`tools/check-no-fixtures.mjs` แก้คอมเมนต์ `// id แคมเปญตัวอย่างใน legacy/data.js` เป็น `// id แคมเปญตัวอย่างใน e2e/legacy-reference/data.js`

`.env.example` แก้ `legacy/config.js` เป็น `e2e/legacy-reference/config.js` และ `legacy/data.js` เป็น `e2e/legacy-reference/data.js`

- [ ] **Step 3: สร้างไฟล์ที่ได้จากสคริปต์ใหม่ และตรวจว่าเปลี่ยนแค่หัวไฟล์**

```bash
node tools/port-legacy.mjs icons
TZ=Asia/Bangkok node tools/port-legacy.mjs fixtures
git diff --stat -- lib/
```

Expected: `lib/fixtures/data.ts | 2 +-` และ `lib/icons.ts | 2 +-` (บรรทัดคอมเมนต์หัวไฟล์เท่านั้น) — ถ้าต่างมากกว่านั้น หยุดและตรวจว่ารันด้วย `TZ=Asia/Bangkok`

- [ ] **Step 4: `CLAUDE.md`** — แก้ทุกที่ที่อ้าง prototype เป็น path ใหม่:
- `- **`legacy/` คือต้นแบบหน้าตาและการทำงาน (UX reference)** … สงสัยให้เปิด `legacy/index.html` …` → แทน `legacy/` ด้วย `e2e/legacy-reference/` (2 จุดในบรรทัดนี้)
- `- ห้ามแก้ไฟล์ใน `legacy/` จะลบทิ้งหลัง deploy Next.js และผู้ใช้ตรวจ production ครบ (แผน C)` → `- ห้ามแก้ไฟล์ใน `e2e/legacy-reference/` (ต้นแบบที่ e2e เปิดเทียบ ย้ายมาจาก `legacy/` หลัง deploy แผน C; โค้ดยังอ้าง `legacy/app.js Lxx` ตามเลขบรรทัดเดิม)`
- ใน Architecture `legacy/                         # prototype เดิม (UX reference)` → `e2e/legacy-reference/          # prototype เดิม (UX reference, ใช้ใน e2e เท่านั้น ไม่ถูก serve)`
- `## Commands`: `npm run test:e2e         # Playwright เทียบภาพกับ legacy/ …` → `… เทียบภาพกับ e2e/legacy-reference/ …`
- `## โหมด fixture`: `ใช้ข้อมูลตัวอย่างจาก `legacy/data.js`` และ `state.customers = ลูกค้าตัวอย่างของ `legacy/data.js`` → `e2e/legacy-reference/data.js`
- Coding Conventions ข้อ 7: คงข้อความเรื่อง production = `main` / PR ไว้ แล้วต่อท้าย `ก่อน push หรือ merge ทุกครั้งต้องผ่าน npm run typecheck && npm run lint && npm test && npm run build && npm run check:fixtures`

แล้วตรวจ: `grep -n "legacy/" CLAUDE.md` → เหลือเฉพาะข้อความ "ย้ายมาจาก `legacy/`" และการอ้าง `legacy/app.js Lxx`

- [ ] **Step 5: ตรวจ**

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
npm run check:fixtures
```

Expected: ไม่มี error; `Tests  169 passed (169)`; `test:e2e` `29 passed` (Playwright เปิด `e2e/legacy-reference` ที่พอร์ต 4100 — ถ้ามี static server เก่าของ `legacy/` เปิดค้างที่ 4100 ต้องปิดก่อน ไม่งั้น Playwright ใช้ตัวเก่าซึ่งชี้ไปโฟลเดอร์ที่ไม่มีแล้ว); `check:fixtures` `ok: …`

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: move the prototype to e2e/legacy-reference as the visual parity reference" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git switch feat/nextjs-plan-c && git merge --ff-only claude/serene-meitner-cprt82 && git switch claude/serene-meitner-cprt82
```

- [ ] **Step 7: [ถามผู้ใช้] push การย้าย**

ถามผู้ใช้: "จะ push commit ย้าย prototype ไป `e2e/legacy-reference/` (หน้าเว็บไม่เปลี่ยน) แล้วเปิด PR ใหม่เข้า `main` ยืนยันไหม" — รอ "ใช่" แล้ว `git push origin claude/serene-meitner-cprt82` และ `gh pr create --base main` (PR #2 merge ไปแล้ว); merge เมื่อผู้ใช้อนุญาตอีกครั้ง แล้วดู deployment production ใหม่ Ready และเปิด production ซ้ำ 1 หน้าว่าใช้ได้

---

## คำถามที่ยังเปิด (ถามผู้ใช้ก่อน/ระหว่างทำ)

1. **`.brand-sub` "MPD Group · Preview v0.1":** ยังคงตาม prototype (e2e เทียบ sidebar ตรงตัว) **ข้อเสนอ:** หลัง Task 8 เปลี่ยนเป็น "MPD Group" ใน `components/shell/Sidebar.tsx` และใน `openLegacyShell` ของ e2e แทนข้อความเดียวกันฝั่ง prototype (แบบเดียวกับที่ฉีดเมนู "ฐานลูกค้าเก่า") เพื่อให้ test ยังเทียบส่วนอื่นได้ — ไม่ทำจนกว่าผู้ใช้ตอบ
2. **หน้าตั้งค่า:** ปุ่มปิดใช้งานไม่มีหน้าต่างยืนยัน (prototype ไม่มีปุ่มนี้) — ต้องการ popup "ยืนยันปิดใช้งาน?" แบบ popup ยกเลิกจองไหม; ข้อความ placeholder อีเมล/ข้อความช่วยเหลือใหม่ (ไม่มีใน prototype) ยืนยันถ้อยคำ
3. **ปิด/ลบแคมเปญ:** หน้าตั้งค่ามีแค่ "วิธีจองลีด" (ตาม prototype) ยังไม่มีปุ่มปิดใช้งาน/แก้วันที่ของแคมเปญ — แคมเปญทดสอบจาก checklist ต้องปิดผ่านผู้ดูแล DB ต้องการเพิ่มไหม (งานหน้าเว็บอย่างเดียว ใช้ RLS เดิม)
4. **อัตราค่าคอมไม่ถูกบันทึก** (ตาม prototype ตอนล็อกอินจริง) — ถ้าต้องการให้จำ ใช้ `localStorage` ต่อเครื่อง (ไม่แตะ DB) หรือเก็บใน `dsales_settings` ผ่าน RPC ใหม่ (งาน DB)
5. คำถามที่ค้างจาก C1 (ปุ่มจัดสรรอัตโนมัติ/โหมด auto, funnel = 0, `/mine` `/pool` ไม่มีช่วงวันที่, ถ้อยคำใหม่) — ถ้ายังไม่ได้คำตอบ ถามพร้อมกันตอน Task 6

## หลังจบแผน C

- งานที่ยังค้างบันทึกใน `CLAUDE.md` หัวข้อ "งานค้าง (หลังแผน C)" (funnel/สร้างลีดจาก criteria, โหมด auto, บันทึกผลตรวจแชต) — เป็นงานเฟส 2 ขึ้นไปตาม spec ข้อ 8
