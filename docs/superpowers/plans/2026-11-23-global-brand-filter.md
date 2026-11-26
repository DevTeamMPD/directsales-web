# ตัวกรองแบรนด์ใหญ่ (Bebeplay / Hosttail) — Design + Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เลือกแบรนด์ครั้งเดียวที่ topbar แล้วทุกหน้าแสดงเฉพาะแบรนด์นั้น (การจัดการของ Bebeplay กับ Hosttail แยกกันทั้งหมด)

**Design (ผู้ใช้ยืนยัน 2026-11-23):**
- ตัวสลับใน topbar ทุกหน้า: `Bebeplay | Hosttail` + `ทั้งหมด` เฉพาะหัวหน้า · **ค่าเริ่มต้น = Bebeplay สำหรับทุกคน (รวมหัวหน้า)** · จำไว้ในเครื่อง (localStorage `dsales.brand`) · เซลล์ที่ค่าที่เก็บเป็น `ทั้งหมด` ถูกปรับเป็น Bebeplay
- จอ ≥ 761px = ปุ่มแบบแบ่งช่อง (segmented) · จอ ≤ 760px = dropdown เล็ก (topbar ต้องอยู่แถวเดียว, จุดแตะ ≥ 44px)
- ผลต่อหน้า: Direct Sale (ลีดเฉพาะแบรนด์, ชิปนับ, dropdown แคมเปญ), ลูกค้าของฉัน/ถังกลาง (ใช้แบรนด์ใหญ่ เอา dropdown แบรนด์ในหน้าออก; `?brand=` ใน URL เดิม = ตั้งแบรนด์ใหญ่), เมนูแคมเปญ (แสดงเฉพาะแบรนด์ที่เลือก; เปิดหน้าแคมเปญของอีกแบรนด์ = สลับแบรนด์ให้), badge เมนู Direct Sale, popup ส่งข้อความ/ส่งเข้า Direct Sale (แบรนด์เริ่มต้น), หน้า ส่งข้อความ (ชุดของแบรนด์นั้น), Dashboard (ใช้แบรนด์ใหญ่แทน `ui.dashBrand`; ชิป "ทั้งหมด" เฉพาะหัวหน้า; ตารางเทียบแบรนด์ยังแสดงทั้งสอง), ตั้งค่า template (แบรนด์เริ่มต้น)
- e2e: test เดิมที่เทียบกับ prototype ตั้ง `localStorage['dsales.brand'] = 'all'` ก่อนเปิดหน้า (ผู้ใช้ fixture เป็นหัวหน้า) + test ใหม่ของตัวสลับ

**Architecture:** ฟังก์ชันล้วนใน `lib/domain/brand.ts` (อ่าน/เขียน storage, ปรับตามสิทธิ์, จับคู่แบรนด์) · state กลาง `state.brand` + action `setBrand` (เขียน storage) ใน AppProvider · component `BrandSwitch` ใน topbar · แต่ละหน้าอ่าน `useAppState().brand`

**Tech Stack:** Next.js 15 + React 19 + TypeScript strict, Vitest, Playwright · worktree `C:\Claude Ai\Directsale\directsales-web-links` branch `feat/buyer-id-room-links` · commit `git -c user.name=DevTeamMPD -c user.email=dev@mpdgroup.co commit` ปิดท้าย `Co-Authored-By:` · `git add` เฉพาะไฟล์ที่แก้ (ห้าม `-A`)

---

## File Structure

| ไฟล์ | หน้าที่ |
|---|---|
| `lib/domain/brand.ts` (+test) — ใหม่ | `BrandScope`, `BRAND_STORAGE_KEY`, `readStoredBrand`, `writeStoredBrand`, `effectiveBrand`, `inBrand`, `pageBrand`, `navVisible` |
| `lib/state/reducer.ts` (+test), `lib/state/AppProvider.tsx` | `state.brand`, action `setBrand`, hydrate/persist, ปรับตามสิทธิ์ตอน `loaded` |
| `components/shell/BrandSwitch.tsx` — ใหม่, `components/shell/Topbar.tsx`, `styles/app.css` | ตัวสลับ |
| `components/shell/Sidebar.tsx`, `lib/domain/badges.ts` (+test) | เมนูแคมเปญ + badge ตามแบรนด์ |
| `components/leads/LeadsPage.tsx`, `LeadToolbar.tsx`, `LeadTable.tsx` | Direct Sale |
| `components/campaigns/BasePage.tsx`, `lib/domain/baseFilters.ts` (+test) | /mine /pool |
| `components/campaigns/CampaignPage.tsx` | sync แบรนด์จาก URL |
| `components/dashboard/DashboardPage.tsx`, `lib/domain/dashboard.ts`, `lib/state/reducer.ts` | Dashboard |
| `components/outreach/OutreachPage.tsx`, `components/setup/OutreachPanels.tsx` | ส่งข้อความ / template |
| `e2e/*.spec.ts`, `e2e/__screenshots__` | test |

---

### Task 1: ฟังก์ชันล้วน `lib/domain/brand.ts`

- [ ] **Step 1: test ที่ล้ม** — สร้าง `lib/domain/brand.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { BRAND_STORAGE_KEY, effectiveBrand, inBrand, navVisible, pageBrand, readStoredBrand, writeStoredBrand } from './brand';

const mem = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};

describe('global brand', () => {
  it('reads the stored brand; unknown/missing/broken storage = bebeplay', () => {
    expect(readStoredBrand(mem({ [BRAND_STORAGE_KEY]: 'hosttail' }))).toBe('hosttail');
    expect(readStoredBrand(mem({ [BRAND_STORAGE_KEY]: 'all' }))).toBe('all');
    expect(readStoredBrand(mem({ [BRAND_STORAGE_KEY]: 'x' }))).toBe('bebeplay');
    expect(readStoredBrand(mem())).toBe('bebeplay');
    expect(readStoredBrand(undefined)).toBe('bebeplay');
    expect(readStoredBrand({ getItem: () => { throw new Error('blocked'); }, setItem: () => {} })).toBe('bebeplay');
  });
  it('writes the brand and ignores storage errors', () => {
    const s = mem();
    writeStoredBrand(s, 'hosttail');
    expect(s.m.get(BRAND_STORAGE_KEY)).toBe('hosttail');
    expect(() => writeStoredBrand({ getItem: () => null, setItem: () => { throw new Error('full'); } }, 'all')).not.toThrow();
  });
  it('only admins keep "all"', () => {
    expect(effectiveBrand('all', true)).toBe('all');
    expect(effectiveBrand('all', false)).toBe('bebeplay');
    expect(effectiveBrand('hosttail', false)).toBe('hosttail');
  });
  it('matches rows, page brand and campaign menu items', () => {
    expect(inBrand('all', 'hosttail')).toBe(true);
    expect(inBrand('bebeplay', 'hosttail')).toBe(false);
    expect(inBrand('bebeplay', 'bebeplay')).toBe(true);
    expect(pageBrand('all')).toBe('');
    expect(pageBrand('hosttail')).toBe('hosttail');
    expect(navVisible('campaign-hosttail', 'bebeplay')).toBe(false);
    expect(navVisible('campaign-hosttail', 'hosttail')).toBe(true);
    expect(navVisible('campaign-bebeplay', 'all')).toBe(true);
    expect(navVisible('leads', 'hosttail')).toBe(true);
  });
});
```
- [ ] **Step 2:** `npx vitest run lib/domain/brand.test.ts` → FAIL (ไม่มีไฟล์)
- [ ] **Step 3:** สร้าง `lib/domain/brand.ts`:
```ts
import type { Brand } from '@/lib/constants';

/** แบรนด์ใหญ่ที่เลือกใน topbar — 'all' ได้เฉพาะหัวหน้า */
export type BrandScope = Brand | 'all';
export const BRAND_STORAGE_KEY = 'dsales.brand';
const DEFAULT_BRAND: BrandScope = 'bebeplay';

interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void }
const isScope = (v: unknown): v is BrandScope => v === 'bebeplay' || v === 'hosttail' || v === 'all';

/** ค่าที่จำไว้ในเครื่อง · ไม่มี/ผิด/อ่านไม่ได้ (โหมดส่วนตัว) = Bebeplay */
export function readStoredBrand(s: KV | undefined): BrandScope {
  try {
    const v = s?.getItem(BRAND_STORAGE_KEY);
    return isScope(v) ? v : DEFAULT_BRAND;
  } catch {
    return DEFAULT_BRAND;
  }
}
export function writeStoredBrand(s: KV | undefined, b: BrandScope): void {
  try {
    s?.setItem(BRAND_STORAGE_KEY, b);
  } catch {
    /* เขียนไม่ได้ (โหมดส่วนตัว/เต็ม) — ใช้ได้เฉพาะรอบนี้ */
  }
}
/** เซลล์เลือก "ทั้งหมด" ไม่ได้ */
export const effectiveBrand = (b: BrandScope, isAdmin: boolean): BrandScope => (b === 'all' && !isAdmin ? DEFAULT_BRAND : b);
export const inBrand = (scope: BrandScope, brand: Brand): boolean => scope === 'all' || scope === brand;
/** ค่าแบรนด์ของหน้าที่รับ '' = ทุกแบรนด์ (เช่น /mine /pool) */
export const pageBrand = (scope: BrandScope): '' | Brand => (scope === 'all' ? '' : scope);
/** เมนูแคมเปญแสดงเฉพาะแบรนด์ที่เลือก */
export function navVisible(key: string, scope: BrandScope): boolean {
  const m = /^campaign-(bebeplay|hosttail)$/.exec(key);
  return !m || inBrand(scope, m[1] as Brand);
}
```
- [ ] **Step 4:** test → PASS · `npm run typecheck`
- [ ] **Step 5:** commit `feat(web): global brand helpers (storage, admin-only all, matching)`

---

### Task 2: state กลาง `state.brand` + `setBrand`

**Files:** `lib/state/reducer.ts` (+`reducer.test.ts`), `lib/state/AppProvider.tsx`

- [ ] **Step 1: test ที่ล้ม** ใน `reducer.test.ts` (ใช้ helper/fixture ที่ไฟล์มีอยู่แล้วสำหรับ payload ของ `loaded`):
```ts
describe('global brand', () => {
  it('defaults to bebeplay, setBrand works before and after loading, sessions keep it', () => {
    expect(initialState.brand).toBe('bebeplay');
    const s1 = reducer(initialState, { type: 'setBrand', brand: 'hosttail' });
    expect(s1.brand).toBe('hosttail'); // ก่อนโหลด (hydrate จาก localStorage) ต้องไม่ถูกทิ้ง
  });
  it('a sales rep cannot keep "all" after loading', () => {
    const s = reducer({ ...initialState, brand: 'all' }, { type: 'loaded', payload: { ...<payload ของ test เดิม>, isAdmin: false } });
    expect(s.brand).toBe('bebeplay');
  });
});
```
(แทน `<payload ของ test เดิม>` ด้วย payload ที่ test อื่นในไฟล์ใช้กับ `loaded`)
- [ ] **Step 2:** `npx vitest run lib/state/reducer.test.ts` → FAIL
- [ ] **Step 3: reducer** — `AppState` เพิ่ม `brand: BrandScope` (import จาก `@/lib/domain/brand`), `initialState.brand = 'bebeplay'`, `Action` เพิ่ม `{ type: 'setBrand'; brand: BrandScope }` (**ไม่ใส่ใน `DATA_ACTIONS`**), case `setBrand`: `return { ...state, brand: action.brand }` · ใน case `loaded`: ใส่ `brand: effectiveBrand(state.brand, action.payload.isAdmin)` · case `noAccess`/`sessionLost` ที่ reset เป็น `initialState`: คง `brand: state.brand`
- [ ] **Step 4: AppProvider** — `AppActions` เพิ่ม `setBrand: (b: BrandScope) => void`; ใน object actions: `setBrand: (b) => { writeStoredBrand(typeof window === 'undefined' ? undefined : window.localStorage, b); dispatch({ type: 'setBrand', brand: b }); }` · ใน effect ที่เริ่มโหลดข้อมูลฝั่ง client (ก่อน dispatch `loaded`) เพิ่มบรรทัดแรก: `dispatch({ type: 'setBrand', brand: readStoredBrand(window.localStorage) });`
- [ ] **Step 5:** test → PASS · typecheck · `npx vitest run`
- [ ] **Step 6:** commit `feat(web): app-wide brand state (default Bebeplay, remembered per browser)`

---

### Task 3: ตัวสลับใน topbar

**Files:** create `components/shell/BrandSwitch.tsx`; modify `components/shell/Topbar.tsx`, `styles/app.css`

- [ ] **Step 1:** `components/shell/BrandSwitch.tsx`:
```tsx
'use client';

import { BRAND } from '@/lib/constants';
import type { BrandScope } from '@/lib/domain/brand';
import { useActions, useAppState } from '@/lib/state/AppProvider';

/** ตัวสลับแบรนด์ใหญ่ — จอกว้าง = ปุ่มแบ่งช่อง, จอ ≤ 760px = dropdown (CSS สลับการแสดง) · "ทั้งหมด" เฉพาะหัวหน้า */
export function BrandSwitch() {
  const { brand, isAdmin } = useAppState();
  const { setBrand } = useActions();
  const opts: { value: BrandScope; label: string }[] = [
    { value: 'bebeplay', label: BRAND.bebeplay },
    { value: 'hosttail', label: BRAND.hosttail },
    ...(isAdmin ? [{ value: 'all' as const, label: 'ทั้งหมด' }] : []),
  ];
  return (
    <div className="brand-switch" data-brand={brand}>
      <div className="seg brand-seg" role="group" aria-label="แบรนด์">
        {opts.map((o) => (
          <button key={o.value} type="button" className={`seg-btn${brand === o.value ? ' on' : ''}`} data-brand-pick={o.value}
            aria-pressed={brand === o.value} onClick={() => setBrand(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
      <select className="select brand-select" id="brand-switch" aria-label="แบรนด์" value={brand} onChange={(e) => setBrand(e.target.value as BrandScope)}>
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
```
- [ ] **Step 2:** `Topbar.tsx`: ใส่ `<BrandSwitch />` ระหว่าง `topbar-title` กับ `#topbar-actions` (อยู่นอก `#topbar-actions` เพราะหน้าต่าง ๆ portal ปุ่มของตัวเองเข้าไปที่นั่น)
- [ ] **Step 3:** `styles/app.css` — ใช้ตัวแปรจาก `styles/tokens.css` เท่านั้น (ดูชื่อตัวแปรจริงในไฟล์ เช่น `--line`, `--surface`, `--primary`, `--r`, `--tap`): `.brand-switch{margin-left:auto;margin-right:12px}` · `.brand-seg` เป็นกรอบมน 1px border มีปุ่ม `.seg-btn` สามช่อง ปุ่มที่เลือก (`.on`) ใช้สีหลัก · `.brand-select{display:none}` · ใน `@media (max-width:760px)`: `.brand-seg{display:none}` `.brand-select{display:block;min-height:var(--tap);width:auto;max-width:132px}` · ถ้าใน topbar มีกฎ `margin-left:auto` ที่ `.topbar-actions` อยู่แล้ว ให้ปรับไม่ให้ซ้อนจนปุ่มหน้า (`#topbar-actions`) หลุดแถว
- [ ] **Step 4:** typecheck + lint + vitest
- [ ] **Step 5:** commit `feat(web): brand switch in the topbar`

---

### Task 4: เมนูแคมเปญ + badge ตามแบรนด์

- [ ] **Step 1: test** ใน `lib/domain/badges.test.ts`: badge `leads` นับเฉพาะลีดของแบรนด์ที่เลือก (`badgeCounts(leads, meId, 'hosttail')` นับเฉพาะ `l.brand === 'hosttail'`; `'all'` = เดิม); badge แคมเปญ `bebeplay`/`hosttail` ไม่เปลี่ยน
- [ ] **Step 2:** FAIL → **Step 3:** `badgeCounts(leads, meId, scope: BrandScope = 'all')` กรอง `leads` count ด้วย `inBrand(scope, l.brand)` · `Sidebar.tsx`: `badgeCounts(state.leads, state.meId, state.brand)` และกรองรายการเมนูด้วย `navVisible(it.key, state.brand)` (ซ่อนกลุ่มที่ไม่เหลือเมนู)
- [ ] **Step 4:** PASS + typecheck → commit `feat(web): sidebar campaign menu and Direct Sale badge follow the brand`

---

### Task 5: Direct Sale (`/leads`)

- [ ] `LeadsPage.tsx`: `base = leads.filter((l) => mineOrAll(l, { meId, isAdmin }) && inBrand(brand, l.brand))` (`brand` จาก `useAppState()`) — `base` ใช้กับชิปนับ, ตาราง, ตรวจทักแชตอยู่แล้ว
- [ ] `LeadToolbar.tsx`: dropdown แคมเปญ `#camp-sel` แสดงเฉพาะ `campaigns.filter((c) => inBrand(brand, c.brand))`; ถ้า `ui.selCamp` เป็นแคมเปญที่ไม่อยู่ในแบรนด์แล้ว ให้ถือเป็น `ALL` (ใช้ฟังก์ชันที่ไฟล์มีอยู่ หรือเช็กตรง ๆ)
- [ ] `LeadTable.tsx`: `defaultOutreachBrand(picked, pageBrand(brand) || null)`
- [ ] typecheck + vitest → commit `feat(web): Direct Sale follows the global brand`

---

### Task 6: ลูกค้าของฉัน / ถังกลาง

- [ ] `lib/domain/baseFilters.ts`: `filtersToQuery(f)` ไม่เขียน `brand` อีก (เอาพารามิเตอร์ brand ออก) · `filtersFromQuery` ยังอ่าน `brand` ได้ (ใช้ตั้งแบรนด์ใหญ่จากลิงก์เดิม) — แก้ test ใน `baseFilters.test.ts` ตาม
- [ ] `BasePage.tsx`: ลบ `brand` ออกจาก `BaseFilter` และลบ `<select id="base-brand">` · ใช้ `const b = pageBrand(useAppState().brand)` แทน `f.brand` ทุกที่ (RPC `brand: b || null`, `demoBase`, `defaultOutreachBrand(picked, b)`, `claimBrand(b, r.brands)`, `ChannelCell`, `bulkFollow(..., b, ...)`, `matchesFilters(..., b || null)`) · ตอนเริ่ม (`initialFilter`/effect แรก): ถ้า URL มี `?brand=bebeplay|hosttail` ให้ `setBrand(...)` ครั้งเดียว · เปลี่ยนแบรนด์ใหญ่ = กลับหน้าแรก (`page: 0`) และโหลดใหม่ (ใส่ `b` ใน deps ของ effect โหลด) · ที่ติ๊กเลือกไว้คงเดิม
- [ ] typecheck + vitest → commit `feat(web): /mine and /pool use the global brand`

---

### Task 7: หน้าแคมเปญ

- [ ] `CampaignPage.tsx`: `useEffect(() => { if (brand !== state.brand && state.brand !== 'all') setBrand(brand); }, [brand])` — URL เป็นตัวตัดสิน (ลิงก์ตรง/ปุ่ม "เพิ่มจากถัง" พาไปแบรนด์ไหน แบรนด์ใหญ่สลับตาม) · หัวหน้าที่เลือก "ทั้งหมด" คงเป็นทั้งหมด
- [ ] typecheck → commit `feat(web): campaign page switches the global brand to its own`

---

### Task 8: Dashboard

- [ ] ใช้ `state.brand` แทน `ui.dashBrand`: `L = byBrand(A, brand)` (ชนิด `DashBrand` = `'all' | Brand` ใช้ร่วมกับ `BrandScope` ได้), `scopeLabel(brand)` · ชิปแบรนด์ `[data-brand]` เรียก `setBrand(...)`; ชิป "ทั้งหมด" แสดงเฉพาะหัวหน้า (`brandChips` รับ `isAdmin`) · ตารางเทียบแบรนด์คงแสดงทั้งสองแบรนด์ (แถว `sel` = แบรนด์ที่เลือก)
- [ ] ลบ `dashBrand` ออกจาก `UiFilters`/`initialUi` และที่ใช้ทั้งหมด (`grep -rn dashBrand`) — แก้ test ที่อ้าง
- [ ] typecheck + vitest → commit `feat(web): dashboard uses the global brand`

---

### Task 9: หน้า ส่งข้อความ + template

- [ ] `OutreachPage.tsx`: แสดงเฉพาะ `batches.filter((b) => inBrand(brand, b.brand))` (ข้อความว่างเดิมเมื่อไม่มี)
- [ ] `OutreachPanels.tsx` `TemplatePanel`: ค่าเริ่มของ `useState<Brand>` = `pageBrand(brand) || 'bebeplay'` และเมื่อแบรนด์ใหญ่เปลี่ยนเป็น bebeplay/hosttail ให้ตามไปด้วย (`useEffect`) · ยังเปลี่ยนใน `#tpl-brand` ได้
- [ ] typecheck → commit `feat(web): outreach batches and templates follow the global brand`

---

### Task 10: e2e

- [ ] ทุก spec ที่มีอยู่ (`visual-parity`, `outreach`, `mobile-fit`): ตั้งแบรนด์ "ทั้งหมด" ก่อนเปิดหน้าแอป — `test.beforeEach(async ({ page }) => { await page.addInitScript(() => { try { if (location.port === '3100') localStorage.setItem('dsales.brand', 'all'); } catch {} }); });` (แอป = พอร์ต 3100, prototype = 4100 — ไม่แตะ prototype)
- [ ] `visual-parity.spec.ts` test `/mine` `/pool` (บรรทัด ~531–548): เลิกตรวจ `#base-brand` · แทนด้วย: กด `[data-brand-pick=hosttail]` แล้วทุกแถวเป็น Hosttail
- [ ] test ใหม่ `e2e/brand-switch.spec.ts` (1440 และ 390): ไม่ตั้ง storage → เปิด `/leads` → ตัวสลับเลือก Bebeplay อยู่ และทุกลีดเป็น Bebeplay · เลือก Hosttail (1440: `[data-brand-pick=hosttail]`, 390: `#brand-switch` selectOption) → ลีดเป็น Hosttail ทั้งหมด, เมนูแคมเปญเหลือ Hosttail · reload → ยังเป็น Hosttail · เปิด `/campaigns/bebeplay` → ตัวสลับเปลี่ยนเป็น Bebeplay · ผู้ใช้ fixture เป็นหัวหน้า จึงมีตัวเลือก "ทั้งหมด"
- [ ] `npm run test:e2e` → ภาพที่ต่างควรมีแค่ topbar/shell (มีตัวสลับ) และ `/mine` (ไม่มี dropdown แบรนด์) → `npx playwright test --update-snapshots=changed` แล้ว**ดูภาพทีละภาพ** · mobile-fit ต้องผ่าน (topbar ≤ 72px แถวเดียว, ไม่ล้น 390px)
- [ ] `npm run build && npm run check:fixtures` → commit `test(e2e): global brand switch; existing suites run with "all"`

---

### Task 11: ตรวจใน dev server + เอกสาร

- [ ] dev server ข้อมูลจริง: สลับแบรนด์ที่ 1440 และ 390 ดูว่า Direct Sale / ลูกค้าของฉัน / ถังกลาง / ส่งข้อความ / Dashboard ตามแบรนด์, reload แล้วยังจำ, เซลล์ไม่มี "ทั้งหมด"
- [ ] `CLAUDE.md` หัวข้อ Architecture/สถาปัตยกรรม: เพิ่มบรรทัด "แบรนด์ใหญ่ `state.brand` (topbar `BrandSwitch`, localStorage `dsales.brand`, ค่าเริ่ม Bebeplay, 'all' เฉพาะหัวหน้า) — หน้าใหม่ต้องกรองตาม `inBrand(state.brand, …)`; e2e เดิมตั้ง 'all' ผ่าน addInitScript"
- [ ] commit `docs: global brand filter`
