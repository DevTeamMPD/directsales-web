# Direct Sale Next.js · แผน B: หน้าลีด Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ย้ายหน้า Direct Sale (`/leads`) ของ prototype มาเป็น Next.js ให้หน้าตาและการทำงานเหมือนเดิมทุกจุด: การ์ดช่วงวันที่, toolbar ลีด (สถานะ/เซลล์/แคมเปญ/ค้นหา/เรียง), ตารางลีด 9 คอลัมน์พร้อมปุ่มดำเนินการ, ปุ่มโทร/แชต JST, ตรวจทักแชทอัตโนมัติ (`verifyMine`) และ popup 4 ตัว (รายละเอียดลูกค้า, บันทึกโทร/แชต, ยืนยันยกเลิกจอง, เลือกจากถัง) พร้อมเก็บงานค้างจากแผน A (แยก context, timer ของ toast, error ระหว่างใช้งาน → toast, `loadLive` ไม่ redirect เมื่อเครือข่ายล้ม, `ui.dirtyRows`)

**Architecture:** กติกาทั้งหมดเป็นฟังก์ชันล้วนใน `lib/domain/{period,leads,log}.ts` และ `lib/jst.ts` (มี Vitest เทียบผลกับ prototype ด้วยข้อมูล fixture) ส่วน React เป็น client component ที่ใช้ class/markup/ข้อความเดิมของ `legacy/app.js` ตรงตัว state กลางแยกเป็น 4 context (state, actions ที่คงที่, toast, modal) เพื่อให้ตารางใหญ่ไม่ re-render ตาม toast/modal ทุก RPC ผ่าน `lib/api/rpc.ts` แล้ว `upsertLead` ผลลัพธ์ (ไม่โหลดใหม่ทั้งหน้า) error ระหว่างใช้งานแสดงด้วย `toastError` โหมด fixture (`state.live = false`) ทำตัวเหมือนโหมดตัวอย่างของ prototype ฝั่งอ่าน และไม่เรียก RPC ที่เขียนข้อมูล Playwright เทียบ `#view` / `.modal` กับ prototype ทั้งภาพ (element screenshot) และข้อความ/สี (DOM metrics)

**Tech Stack:** Next.js 15 (App Router) + React 19 + TypeScript strict, `@supabase/ssr` 0.10, `styles/prototype.css` (Tailwind 3 ปิด preflight ใช้น้อยที่สุด), Vitest 3 (environment `node`, เฉพาะ `lib/**/*.test.ts`), Playwright (Chromium, `Asia/Bangkok`)

**Spec:** `docs/superpowers/specs/2026-11-17-nextjs-frontend-design.md` (ข้อ 2 แถว ตัวกรองร่วม/Popup/กติกาลีด/JST/พฤติกรรมย่อย และ "เปลี่ยนจาก prototype โดยตั้งใจ", ข้อ 4, ข้อ 6) + `docs/superpowers/specs/2026-11-17-prototype-inventory.md` (ข้อ 2 การ์ดช่วงวันที่/toolbar/ตารางลีด/`#leads`, ข้อ 3 A–D, ข้อ 4, 5, 6, 9, 10) + `CLAUDE.md` หัวข้อ "งานค้างเล็กน้อยสำหรับแผน B"

---

## วิธีรัน

- ติดตั้ง/ตั้งค่าเหมือนแผน A (`npm install`, `.env.local` จาก `.env.example`) ทุกคำสั่งเขียนแบบ bash (Git Bash บน Windows ใช้ได้; PowerShell ใช้ `$env:VAR='x'; คำสั่ง` แทน `VAR=x คำสั่ง`)
- ตรวจ: `npm run typecheck` · `npm run lint` · `npm test` (Vitest) · `npm run build` · `npm run check:fixtures` (หลัง build) · `npm run test:e2e` (เปิด prototype ที่พอร์ต 4100 และ `next dev` โหมด fixture ที่พอร์ต 3100 ให้เอง ต้องต่ออินเทอร์เน็ต)
- ดูหน้าด้วยตาโหมด fixture: `NEXT_PUBLIC_FIXTURES=1 npx next dev -p 3200 -H 127.0.0.1` แล้วเปิด http://127.0.0.1:3200/leads เทียบกับ prototype `npx http-server legacy -p 4100 -c-1 -s` → http://127.0.0.1:4100/index.html กด "ดูตัวอย่างโดยไม่ล็อกอิน" (ใช้พอร์ต 3200 ไม่ใช่ 3000)
- **`next dev`, `npm run build`, `npm run test:e2e` และ `npm start` ใช้โฟลเดอร์ `.next` ร่วมกัน:** ถ้ามี `npm start` (production) เปิดค้างอยู่ ให้ปิดก่อนรันคำสั่งเหล่านี้ (CLAUDE.md ข้อ 9) และหลัง `test:e2e` ต้อง `npm run build` ใหม่ก่อน `check:fixtures` / `npm start`
- แผนนี้ **ไม่แก้ DB** (ไม่มี migration) — RPC ที่ใช้มีอยู่แล้วทั้งหมด (`dsales_log`, `dsales_set_nocall`, `dsales_unclaim_lead`, `dsales_claim_lead`, `dsales_assign_lead`, `dsales_customer_purchases`, `dsales_customer_chats`) ห้ามรัน SQL ที่เขียนข้อมูล
- จำนวน test ที่ต้องได้หลังแต่ละ Task (เริ่มที่ Vitest 53 test / 12 ไฟล์ และ e2e 5 test):

| หลัง Task | Vitest files | Vitest tests | e2e |
|---|---|---|---|
| เริ่มต้น | 12 | 53 | 5 |
| 1 | 14 | 63 | 5 |
| 2 | 16 | 84 | 5 |
| 3 | 17 | 98 | 5 |
| 4 | 17 | 98 | 5 |
| 5 | 18 | 106 | 5 |
| 6 | 18 | 106 | 5 |
| 7 | 18 | 107 | 15 |
| 8 | 18 | 107 | 15 |

## Branch

ทำงานบน branch ใหม่จาก `claude/serene-meitner-cprt82` (แผน A merge แล้ว):

```bash
git switch -c feat/nextjs-leads claude/serene-meitner-cprt82
```

## Deploy (สำคัญ)

- **ห้าม push / merge / deploy และห้ามเปลี่ยนการตั้งค่า Vercel จนถึงขั้น deploy ของแผน C** (CLAUDE.md ข้อ 6–7): Vercel ยัง deploy prototype แบบ static จาก `claude/serene-meitner-cprt82` ถ้าโค้ด Next.js ขึ้นไปก่อน เว็บที่เซลล์ใช้อยู่จะพัง
- งานแผนนี้จบที่ commit บน `feat/nextjs-leads` ในเครื่อง ผู้ใช้ตัดสินใจเองว่าจะ merge เข้า branch หลักเมื่อไร (ถามก่อนเสมอ)
- checklist ด้วยบัญชีจริง (Task 8) **เขียนข้อมูลจริงลง production** ใช้เฉพาะลูกค้าทดสอบ/ลูกค้าของตัวเองตามที่ระบุ

## File Structure

| ไฟล์ | หน้าที่ |
|---|---|
| `lib/state/session.ts` (+ `session.test.ts`) | แปลผลตรวจ session ตอนเปิดแอป → ใช้งานต่อ / ไป `/login` (เฉพาะไม่มี session จริง) / การ์ดโหลดไม่สำเร็จ |
| `lib/state/toast.ts` (+ `toast.test.ts`) | toast ช่องเดียว 2200 ms ข้อความใหม่เริ่มนับใหม่ + `dispose()` ตอน unmount |
| `lib/state/reducer.ts` (+ test) | เพิ่ม `live`, `poolVersion`, `ui.focusSearch`, action `invalidatePool`; `failed` หลัง ready ไม่มีผล |
| `lib/state/AppProvider.tsx` | 4 context (state / actions คงที่ / toast / modal), hook `useAppState` `useActions` `useToastMsg` `useModalState` `useApp`, `loadLive` แบบใหม่ |
| `lib/api/errors.ts` (+ test) | เพิ่ม `errorMessage(e)` |
| `lib/api/rpc.test.ts` | เพิ่ม test อาร์กิวเมนต์ `dsales_log` |
| `lib/fixtures/load.ts` (+ test) | `live: false` และ `?claim=<leadId>` สำหรับ e2e |
| `lib/constants.ts` | `FIXTURE_NO_WRITE` |
| `components/shell/Toast.tsx`, `components/shell/ModalRoot.tsx` | ใช้ context ใหม่ |
| `lib/domain/period.ts` (+ test) | ช่วงวันที่: `presetRange`, เดือน/ปี/กำหนดเอง, `hasPeriod`, `inPeriod`, ข้อความใต้การ์ด |
| `lib/domain/leads.ts` (+ test) | `visible`, `mineOrAll`, `releasedByMe`, `isDnc`, `periodOk`, `contactedIn`, `wonIn`, `filtered`, `sortLeads`, `statusCounts`, `canUnclaim(Any)`, `bills`, `total`, `lastSeller`, `dueInfo`, `claimBlock` |
| `lib/jst.ts` (+ test) | `platformOf`, `channelsOf`, `jstTarget`, `jstOpen`, `chatCheckFor`, `localChatCheck`, `chatCheckView`, `nextChatCheck`, `verifyTodo`, `runVerify` |
| `lib/domain/log.ts` (+ test) | ฟอร์มบันทึกโทร/แชต: ค่าเริ่ม, ตัวเลือกสถานะ, ส่วนที่แสดง, ตรวจความครบ, แปลงเป็นอาร์กิวเมนต์ `dsales_log` |
| `components/ui/{ChIcon,CloseButton,StatusBadge}.tsx` | ไอคอนช่องทาง, ปุ่ม X ของ popup, badge สถานะ + ป้ายวันนัด |
| `components/leads/{useJst.ts,ContactBar.tsx,PeriodCard.tsx,LeadToolbar.tsx}` | ปุ่มโทร/แชต/ชิปช่องทาง, การ์ดช่วงวันที่, toolbar ลีด |
| `components/modals/{CustomerModal,ChatCheckBody,LogModal,ConfirmUnclaimModal,PickFromBucketModal}.tsx` | popup A–D |
| `components/leads/{useLeadActions.tsx,useVerifyMine.ts,LeadTable.tsx,LeadsPage.tsx}`, `app/(app)/leads/page.tsx` | ปุ่มดำเนินการ, ตรวจแชตอัตโนมัติ, ตารางลีด, หน้า `/leads` |
| `e2e/visual-parity.spec.ts` | เทียบ `/leads` และ popup กับ prototype ที่ 375/1280 px |
| `CLAUDE.md` | ปิดงานค้างของแผน B, โครงไฟล์ใหม่, โหมด fixture `?claim=` |

## การตัดสินใจในแผนนี้ (ต่างจาก/เพิ่มจาก brief และ spec)

- **ลำดับ Task 5/6:** popup (A–D) ทำก่อนตาราง เพราะปุ่มในตารางเปิด popup — ทำตารางก่อนจะคอมไพล์ไม่ผ่านหรือต้องมีโค้ดชั่วคราว (เนื้อหาของแต่ละ Task ตาม brief ครบ แค่สลับลำดับ)
- **Context 4 ชั้น:** `useApp()` ยังอยู่ (คืน `state` + actions) ให้ shell เดิมใช้ต่อได้ แต่ component ใหม่ใช้ `useAppState()` / `useActions()` แยกกัน; `Toast` ฟังแค่ `ToastContext`, `ModalRoot` ฟังแค่ `ModalContext` → toast/modal เปลี่ยนแล้วตารางไม่ re-render
- **error ระหว่างใช้งาน:** ทุก handler ที่เรียก RPC `catch` แล้ว `toastError(e)` และ reducer ไม่รับ `failed` เมื่อ phase เป็น `ready` แล้ว (กันพลาดในอนาคต)
- **`loadLive`:** ใช้ `auth.getSession()` (อ่าน cookie ไม่ต้องออกเน็ต ยกเว้นต่ออายุ token) + `auth.getUser()` แล้วให้ `classifySession` ตัดสิน redirect เฉพาะ "ไม่มี session" หรือ `AuthSessionMissingError` นอกนั้น (เช่น `AuthRetryableFetchError` = เน็ตล้ม) โยน error → การ์ด "โหลดข้อมูลจาก Supabase ไม่สำเร็จ: …" ที่มีปุ่มลองใหม่/ออกจากระบบ (ไม่วนกับ middleware ที่ส่ง `/login` → `/leads`)
- **`ui.dirtyRows`:** `ChatCheckBody` เก็บผลตรวจแชตไว้ใน ref และ `patchLead` ตอน popup ปิด (unmount) เฉพาะเมื่อ `sent` เปลี่ยน — ตารางจึงเปลี่ยนป้าย "ทักแชทแล้ว ✓" ตอนปิด popup แบบเดียวกับ prototype
- **โหมด fixture (`state.live = false`):** ทำตามโหมดตัวอย่างของ prototype ฝั่งอ่าน (ไม่โหลดประวัติซื้อ เพราะ fixture มีอยู่แล้ว, ไม่รัน `verifyMine`, ตรวจแชตนับจากบันทึกแชตในแอป = `localChatCheck`) ส่วนปุ่มที่เขียนข้อมูลแสดง toast `โหมด fixture: ไม่ได้บันทึกลง Supabase` แทนการเรียก RPC (กัน id ตัวอย่างวิ่งไป production) — ข้อความนี้ไม่มีทางเห็นใน production เพราะ fixture ถูกตัดออกตอน build; ไม่แสดงหมายเหตุ "ข้อมูลตัวอย่าง: …" ในกล่องตรวจแชตและไม่มี `.demo-note` เลย (spec ข้อ 2)
- **ถังลูกค้า (แผน C):** `ui.pool.loaded = false` ของ prototype แทนด้วย `state.poolVersion` (+1 ผ่าน `invalidatePool` หลังบันทึก/ยกเลิกจอง/จอง/มอบหมาย/ยกเลิกห้ามโทร/เปลี่ยนช่วงวันที่/เลือกจากถัง) และ `ui.focusSearch`; popup "เลือกจากถัง" ตั้ง `selCamp='ALL'`, `focusSearch=true` แล้วไป `/campaigns/<brand>` (หน้านั้นยังเป็น placeholder จนแผน C)
- **ช่องค้นหา `#q`:** กรองใหม่ทุกตัวอักษร (ไม่ debounce) เหมือน prototype แต่เป็น controlled input — React ไม่สร้าง input ใหม่ จึงคง focus และตำแหน่ง caret ตามที่ผู้ใช้พิมพ์ (prototype วาดใหม่แล้วย้าย caret ไปท้ายเสมอ) ดู "คำถามที่ยังเปิด" ท้ายแผน
- **คอลัมน์จอง/มอบหมาย:** `LeadTable` รองรับ `opts.mode` / `opts.perCamp` (ปุ่ม "จอง" + `maxPerRep` + เปิด JST อัตโนมัติ, select "มอบหมายให้…") ครบตาม `claimCell` แต่หน้า `/leads` ไม่ส่ง `mode` (prototype ก็ไม่แสดงในหน้านี้) — หน้าแคมเปญของแผน C ใช้ต่อได้ทันที
- **`chatCheckFor`:** ส่ง `claimedAtIso` (เวลาเดิมจาก server) เป็น `p_since` ตามที่แผน A เตรียมไว้ และ error เป็นภาษาไทยผ่าน `toThaiError` (prototype แสดงข้อความดิบ)
- **`jstOpen`:** รอ `clipboard.writeText` ให้เสร็จก่อนคืนค่า (หน้าจอเหมือนเดิม ทดสอบง่ายขึ้น); แพลตฟอร์มที่ไม่รู้จักแสดงชื่อดิบแทน "undefined"
- **กันกดซ้ำ:** ปุ่มบันทึก/ยืนยันยกเลิกจองไม่ส่งซ้ำระหว่างรอ RPC (`busy` ref) — ไม่มีผลกับหน้าตา
- **e2e:** prototype ซ่อน `.demo-note` และหมายเหตุ demo ในกล่องตรวจแชตก่อนถ่าย; ใช้ `expect.soft` ให้เห็นทุกภาพที่ต่างในรอบเดียว; `PARITY_MEASURE=1` ใช้วัดจำนวนพิกเซลที่ต่างจริงเพื่อตั้ง `maxDiffPixels`; popup ยกเลิกจองต้องมีลีดที่ `claimedBy = me` ซึ่ง fixture ไม่มี จึงเพิ่ม `?claim=<leadId>` (เฉพาะโหมด fixture) และแก้ localStorage ฝั่ง prototype ให้ตรงกัน

---

### Task 1: งานค้างจากแผน A — แยก context, toast, error ระหว่างใช้งาน, `loadLive`

**Files:**
- Create: `lib/state/session.ts`, `lib/state/toast.ts`
- Modify: `lib/state/reducer.ts`, `lib/state/AppProvider.tsx`, `lib/api/errors.ts`, `lib/fixtures/load.ts`, `components/shell/Toast.tsx`, `components/shell/ModalRoot.tsx`
- Test: `lib/state/session.test.ts`, `lib/state/toast.test.ts`, `lib/state/reducer.test.ts`, `lib/api/errors.test.ts`

- [ ] **Step 1: เขียน test ที่ยังไม่ผ่าน**

`lib/state/session.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { classifySession } from './session';

const offline = { name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 };

describe('classifySession (AppProvider loadLive)', () => {
  it('a signed-in user continues', () => {
    expect(classifySession({ hasSession: true, sessionError: null, user: { id: 'u1', email: 'a@example.com' }, userError: null }))
      .toEqual({ kind: 'user', email: 'a@example.com' });
  });
  it('no session at all → /login', () => {
    expect(classifySession({ hasSession: false, sessionError: null, user: null, userError: null })).toEqual({ kind: 'login' });
  });
  it('AuthSessionMissingError → /login', () => {
    const missing = { name: 'AuthSessionMissingError', message: 'Auth session missing!', status: 400 };
    expect(classifySession({ hasSession: true, sessionError: null, user: null, userError: missing })).toEqual({ kind: 'login' });
  });
  it('network failures never redirect (would loop with the middleware) — show the error card', () => {
    expect(classifySession({ hasSession: true, sessionError: null, user: null, userError: offline }))
      .toEqual({ kind: 'error', message: 'Failed to fetch' });
    expect(classifySession({ hasSession: false, sessionError: offline, user: null, userError: null }))
      .toEqual({ kind: 'error', message: 'Failed to fetch' });
  });
});
```

`lib/state/toast.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createToaster, TOAST_MS } from './toast';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('createToaster (prototype toast L124-127)', () => {
  it('shows the message and hides it after 2200 ms', () => {
    const show = vi.fn();
    const t = createToaster(show);
    t.toast('บันทึกแล้ว');
    expect(show).toHaveBeenLastCalledWith('บันทึกแล้ว');
    vi.advanceTimersByTime(TOAST_MS - 1);
    expect(show).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(show).toHaveBeenLastCalledWith(null);
    expect(TOAST_MS).toBe(2200);
  });
  it('a new toast restarts the timer', () => {
    const show = vi.fn();
    const t = createToaster(show);
    t.toast('a');
    vi.advanceTimersByTime(2000);
    t.toast('b');
    vi.advanceTimersByTime(2000);
    expect(show).toHaveBeenLastCalledWith('b');
    vi.advanceTimersByTime(200);
    expect(show).toHaveBeenLastCalledWith(null);
  });
  it('dispose cancels the pending hide (provider unmount)', () => {
    const show = vi.fn();
    const t = createToaster(show);
    t.toast('a');
    t.dispose();
    vi.advanceTimersByTime(5000);
    expect(show).toHaveBeenCalledTimes(1);
  });
});
```

ใน `lib/state/reducer.test.ts` แก้

```ts
const payload: LoadedPayload = {
  email: 'a@example.com', meId: 'u1', isAdmin: true, reps: [{ id: 'u1', name: 'Dev MPD', initials: 'DE', role: 'admin' }],
  campaigns: [], leads: [], today: '2026-11-04',
};
```

เป็น

```ts
const payload: LoadedPayload = {
  email: 'a@example.com', meId: 'u1', isAdmin: true, live: true, reps: [{ id: 'u1', name: 'Dev MPD', initials: 'DE', role: 'admin' }],
  campaigns: [], leads: [], today: '2026-11-04',
};
```

และเพิ่ม 2 test นี้ต่อท้ายใน `describe('reducer', …)` (ก่อน `});` บรรทัดสุดท้าย):

```ts
  it('failed after ready is ignored — errors while using a page go to the toast', () => {
    expect(reducer(ready, { type: 'failed', error: 'boom' })).toBe(ready);
  });
  it('invalidatePool bumps poolVersion; live and focusSearch start false', () => {
    expect(initialState).toMatchObject({ live: false, poolVersion: 0, ui: { focusSearch: false } });
    expect(ready.live).toBe(true);
    expect(reducer(reducer(ready, { type: 'invalidatePool' }), { type: 'invalidatePool' }).poolVersion).toBe(2);
  });
```

ใน `lib/api/errors.test.ts` แก้บรรทัด import

```ts
import { toThaiError } from './errors';
```

เป็น

```ts
import { errorMessage, toThaiError } from './errors';
```

และเพิ่มต่อท้ายไฟล์:

```ts

describe('errorMessage', () => {
  it('reads Error.message or a string, and falls back to the generic text', () => {
    expect(errorMessage(new Error('ลูกค้ารายนี้มีคนจองไปแล้ว'))).toBe('ลูกค้ารายนี้มีคนจองไปแล้ว');
    expect(errorMessage('boom')).toBe('boom');
    expect(errorMessage(new Error(''))).toBe('ทำรายการไม่สำเร็จ');
    expect(errorMessage(undefined)).toBe('ทำรายการไม่สำเร็จ');
  });
});
```

- [ ] **Step 2: รัน test ให้เห็นว่าไม่ผ่าน**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./session" from "lib/state/session.test.ts". Does the file exist?` และ `"./toast"` แบบเดียวกัน; `reducer.test.ts` ตก 2 test (`expected { …(12) } to be { …(12) }` และ `TypeError: Cannot read properties of undefined (reading 'poolVersion')` หรือ toMatchObject ไม่ตรง); `errors.test.ts` ตก 1 test (`errorMessage is not a function`) สรุป `Test Files  4 failed | 10 passed (14)` · `Tests  3 failed | 53 passed (56)`

- [ ] **Step 3: `lib/state/session.ts`**

```ts
/**
 * ตัดสินผลตรวจ session ตอนเปิดแอป (CLAUDE.md งานค้างแผน B)
 * redirect ไป /login เฉพาะเมื่อไม่มี session จริง — ถ้าเน็ตล้มแล้ว redirect จะวนกับ middleware (มี session → ส่งกลับ /leads)
 * จึงให้แสดงการ์ด "โหลดข้อมูลจาก Supabase ไม่สำเร็จ" ที่มีปุ่มลองใหม่/ออกจากระบบแทน
 */
export interface AuthErrorLike { name?: string; message: string; status?: number }

export interface SessionProbe {
  hasSession: boolean;
  sessionError: AuthErrorLike | null;
  user: { id: string; email?: string | null } | null;
  userError: AuthErrorLike | null;
}

export type SessionCheck = { kind: 'user'; email: string } | { kind: 'login' } | { kind: 'error'; message: string };

const SESSION_MISSING = 'AuthSessionMissingError';

export function classifySession(p: SessionProbe): SessionCheck {
  if (p.user) return { kind: 'user', email: p.user.email ?? '' };
  const err = p.sessionError ?? p.userError;
  if (!err) return p.hasSession ? { kind: 'error', message: 'ไม่พบข้อมูลผู้ใช้' } : { kind: 'login' };
  if (err.name === SESSION_MISSING) return { kind: 'login' };
  return { kind: 'error', message: err.message || 'ตรวจสอบการเข้าสู่ระบบไม่สำเร็จ' };
}
```

- [ ] **Step 4: `lib/state/toast.ts`**

```ts
/** toast ช่องเดียวของ prototype (L124-127): แสดง 2200 ms ข้อความใหม่เริ่มนับใหม่; dispose() เรียกตอน provider unmount */
export const TOAST_MS = 2200;

export interface Toaster {
  toast: (msg: string) => void;
  dispose: () => void;
}

export function createToaster(show: (msg: string | null) => void, ms: number = TOAST_MS): Toaster {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    toast(msg) {
      show(msg);
      clearTimeout(timer);
      timer = setTimeout(() => show(null), ms);
    },
    dispose() {
      clearTimeout(timer);
      timer = undefined;
    },
  };
}
```

- [ ] **Step 5: `lib/state/reducer.ts`** (แทนทั้งไฟล์)

```ts
import { upsertLead } from '@/lib/api/map';
import type { Brand, Campaign, Lead, LeadJson, Rep } from '@/lib/api/types';

export type PeriodKey = 'all' | 'today' | '7d' | 'm0' | 'm1' | 'y0' | 'month' | 'year' | 'custom';
export interface Period { from: string; to: string; key: PeriodKey }

/** ตัวกรองที่คงค่าข้ามหน้า (prototype ui L27) + focusSearch (L616: โฟกัสช่องค้นหาถังหลัง "เลือกจากถัง" — หน้าแคมเปญแผน C ใช้) */
export interface UiFilters {
  q: string; status: string; camp: string; rep: string; selCamp: string | null;
  sort: 'due' | 'spend' | 'none'; dashBrand: 'all' | Brand; period: Period; focusSearch: boolean;
}
export const initialUi: UiFilters = {
  q: '', status: 'all', camp: 'all', rep: 'all', selCamp: null, sort: 'due', dashBrand: 'all',
  period: { from: '', to: '', key: 'all' }, focusSearch: false,
};

/** live = ข้อมูลจาก Supabase; false = โหมด fixture (อ่านแบบโหมดตัวอย่างของ prototype และไม่เรียก RPC ที่เขียนข้อมูล) */
export interface LoadedPayload { email: string; meId: string; isAdmin: boolean; live: boolean; reps: Rep[]; campaigns: Campaign[]; leads: Lead[]; today: string }
export type Phase = 'loading' | 'ready' | 'no-access' | 'inactive' | 'error';
/** poolVersion เพิ่มทุกครั้งที่ถังลูกค้าต้องโหลดใหม่ (prototype ui.pool.loaded = false) */
export interface AppState extends LoadedPayload { phase: Phase; error: string; ui: UiFilters; poolVersion: number }

export const initialState: AppState = {
  phase: 'loading', error: '', email: '', meId: '', isAdmin: false, live: false, reps: [], campaigns: [], leads: [], today: '',
  ui: initialUi, poolVersion: 0,
};

export type Action =
  | { type: 'loaded'; payload: LoadedPayload }
  | { type: 'noAccess'; email: string; inactive: boolean }
  | { type: 'failed'; error: string }
  | { type: 'upsertLead'; lead: LeadJson }
  | { type: 'patchLead'; id: string; patch: Partial<Lead> }
  | { type: 'removeLead'; id: string }
  | { type: 'upsertCampaign'; campaign: Campaign }
  | { type: 'setUi'; patch: Partial<UiFilters> }
  | { type: 'invalidatePool' };

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'loaded':
      return { ...state, ...action.payload, phase: 'ready', error: '' };
    case 'noAccess':
      return { ...initialState, phase: action.inactive ? 'inactive' : 'no-access', email: action.email };
    case 'failed':
      // หลังโหลดเสร็จ error ระหว่างใช้งานแสดงด้วย toast เท่านั้น (ห้ามแทนทั้ง Shell ด้วยการ์ด error)
      return state.phase === 'ready' ? state : { ...state, phase: 'error', error: action.error };
    case 'upsertLead':
      return { ...state, leads: upsertLead(state.leads, action.lead) };
    case 'patchLead':
      return { ...state, leads: state.leads.map((l) => (l.id === action.id ? { ...l, ...action.patch } : l)) };
    case 'removeLead':
      return { ...state, leads: state.leads.filter((l) => l.id !== action.id) };
    case 'upsertCampaign': {
      const exists = state.campaigns.some((c) => c.id === action.campaign.id);
      return {
        ...state,
        campaigns: exists ? state.campaigns.map((c) => (c.id === action.campaign.id ? action.campaign : c)) : [...state.campaigns, action.campaign],
      };
    }
    case 'setUi':
      return { ...state, ui: { ...state.ui, ...action.patch } };
    case 'invalidatePool':
      return { ...state, poolVersion: state.poolVersion + 1 };
  }
}
```

- [ ] **Step 6: `errorMessage` ใน `lib/api/errors.ts`** — เพิ่มต่อท้ายไฟล์:

```ts

/** ข้อความของ error ที่ catch ได้ (rpc.ts โยน Error ข้อความไทยแล้ว) สำหรับ toast */
export function errorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : e == null ? '' : String(e);
  return msg || 'ทำรายการไม่สำเร็จ';
}
```

- [ ] **Step 7: `live: false` ใน `lib/fixtures/load.ts`** — แก้

```ts
    isAdmin: me.role === 'admin',
    reps: d.reps,
```

เป็น

```ts
    isAdmin: me.role === 'admin',
    live: false,
    reps: d.reps,
```

- [ ] **Step 8: `lib/state/AppProvider.tsx`** (แทนทั้งไฟล์)

```tsx
'use client';

import {
  createContext, useContext, useEffect, useMemo, useReducer, useState, type Dispatch, type ReactNode,
} from 'react';
import { errorMessage } from '@/lib/api/errors';
import { buildReps, mapCampaign, mapLead } from '@/lib/api/map';
import { getMe, getMyLeads, getTeam, listCampaigns } from '@/lib/api/rpc';
import type { Lead, LeadJson } from '@/lib/api/types';
import { todayBangkok } from '@/lib/format';
import { supabase } from '@/lib/supabase/client';
import { initialState, reducer, type Action, type AppState, type UiFilters } from './reducer';
import { classifySession } from './session';
import { createToaster } from './toast';

export interface ModalState { node: ReactNode; cls: string; seq: number }

/** ฟังก์ชันที่คงที่ตลอดอายุ provider — component ที่ใช้แค่ส่วนนี้ไม่ re-render ตาม state / toast / modal */
export interface AppActions {
  dispatch: Dispatch<Action>;
  toast: (msg: string) => void;
  /** error ระหว่างใช้งานหน้า (RPC ล้ม) → toast เสมอ */
  toastError: (e: unknown) => void;
  openModal: (node: ReactNode, cls?: string) => void;
  closeModal: () => void;
  logout: () => Promise<void>;
  upsertLead: (lead: LeadJson) => void;
  patchLead: (id: string, patch: Partial<Lead>) => void;
  setUi: (patch: Partial<UiFilters>) => void;
}

const StateContext = createContext<AppState | null>(null);
const ActionsContext = createContext<AppActions | null>(null);
// undefined = ไม่มี provider (null = ไม่มี toast / popup)
const ToastContext = createContext<string | null | undefined>(undefined);
const ModalContext = createContext<ModalState | null | undefined>(undefined);

/** โหลดหลังล็อกอิน: dsales_me ก่อน ถ้าไม่ใช่สมาชิก active หยุดทันที (ไม่ดึงข้อมูลลูกค้าใด ๆ) */
async function loadLive(): Promise<Action | null> {
  const auth = supabase().auth;
  const { data: sessionData, error: sessionError } = await auth.getSession();
  const hasSession = !!sessionData.session;
  const { data: userData, error: userError } = hasSession ? await auth.getUser() : { data: { user: null }, error: null };
  const check = classifySession({ hasSession, sessionError, user: userData.user, userError });
  if (check.kind === 'login') {
    window.location.replace('/login');
    return null;
  }
  if (check.kind === 'error') throw new Error(check.message);
  const email = check.email;
  const me = await getMe();
  if (!me || !me.is_member) return { type: 'noAccess', email, inactive: false };
  if (!me.active) return { type: 'noAccess', email, inactive: true };
  const [team, campaigns, leads] = await Promise.all([getTeam(), listCampaigns(), getMyLeads(1000, 0)]);
  return {
    type: 'loaded',
    payload: {
      email, meId: me.user_id, isAdmin: me.is_admin, live: true, reps: buildReps(team, me),
      campaigns: campaigns.map(mapCampaign), leads: leads.map(mapLead), today: todayBangkok(),
    },
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const toaster = useMemo(() => createToaster(setToastMsg), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let action: Action | null;
      try {
        if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_FIXTURES === '1') {
          const { fixturePayload } = await import('@/lib/fixtures/load');
          action = { type: 'loaded', payload: fixturePayload() };
        } else {
          action = await loadLive();
        }
      } catch (e) {
        action = { type: 'failed', error: `โหลดข้อมูลจาก Supabase ไม่สำเร็จ: ${errorMessage(e)}` };
      }
      if (!cancelled && action) dispatch(action);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // เคลียร์ timer ของ toast ตอน unmount
  useEffect(() => () => toaster.dispose(), [toaster]);

  const actions = useMemo<AppActions>(() => {
    let seq = 0;
    return {
      dispatch,
      toast: toaster.toast,
      toastError: (e) => toaster.toast(errorMessage(e)),
      openModal: (node, cls = '') => {
        seq += 1;
        setModal({ node, cls, seq });
      },
      closeModal: () => setModal(null),
      // ออกจากระบบแล้วโหลดหน้าใหม่ทั้งหน้า (prototype L1005)
      logout: async () => {
        if (!(process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_FIXTURES === '1')) await supabase().auth.signOut();
        window.location.href = '/login';
      },
      upsertLead: (lead) => dispatch({ type: 'upsertLead', lead }),
      patchLead: (id, patch) => dispatch({ type: 'patchLead', id, patch }),
      setUi: (patch) => dispatch({ type: 'setUi', patch }),
    };
  }, [toaster]);

  return (
    <ActionsContext.Provider value={actions}>
      <StateContext.Provider value={state}>
        <ToastContext.Provider value={toastMsg}>
          <ModalContext.Provider value={modal}>{children}</ModalContext.Provider>
        </ToastContext.Provider>
      </StateContext.Provider>
    </ActionsContext.Provider>
  );
}

export function useAppState(): AppState {
  const v = useContext(StateContext);
  if (!v) throw new Error('useAppState ต้องอยู่ใน <AppProvider>');
  return v;
}

export function useActions(): AppActions {
  const v = useContext(ActionsContext);
  if (!v) throw new Error('useActions ต้องอยู่ใน <AppProvider>');
  return v;
}

export function useToastMsg(): string | null {
  const v = useContext(ToastContext);
  if (v === undefined) throw new Error('useToastMsg ต้องอยู่ใน <AppProvider>');
  return v;
}

export function useModalState(): ModalState | null {
  const v = useContext(ModalContext);
  if (v === undefined) throw new Error('useModalState ต้องอยู่ใน <AppProvider>');
  return v;
}

/** state + actions (re-render เมื่อ state เปลี่ยน แต่ไม่ตาม toast / modal) — ใช้กับ shell เดิม */
export function useApp(): AppActions & { state: AppState } {
  const state = useAppState();
  const actions = useActions();
  return useMemo(() => ({ ...actions, state }), [actions, state]);
}
```

- [ ] **Step 9: Toast และ ModalRoot ใช้ context ของตัวเอง**

`components/shell/Toast.tsx` (แทนทั้งไฟล์):

```tsx
'use client';

import { useToastMsg } from '@/lib/state/AppProvider';

export function Toast() {
  const msg = useToastMsg();
  return <div className="toast" id="toast" hidden={!msg}>{msg}</div>;
}
```

ใน `components/shell/ModalRoot.tsx` แก้

```tsx
import { useApp } from '@/lib/state/AppProvider';
```

เป็น

```tsx
import { useActions, useModalState } from '@/lib/state/AppProvider';
```

และแก้

```tsx
  const { modal, closeModal } = useApp();
```

เป็น

```tsx
  const modal = useModalState();
  const { closeModal } = useActions();
```

(`MeBox`, `Shell`, `Sidebar`, `Topbar` ใช้ `useApp()` ที่คืน `state` + `logout` เหมือนเดิม ไม่ต้องแก้)

- [ ] **Step 10: รัน test ให้ผ่าน**

Run: `npm test`
Expected: `Test Files  14 passed (14)` · `Tests  63 passed (63)` (รวม `guard.test.ts` ที่ยังผ่าน: ทุกจุดที่อ่าน `NEXT_PUBLIC_FIXTURES` ใน `AppProvider.tsx` ยังเป็นเงื่อนไขตรงตัว 2 จุด และ dynamic import อยู่ห่างเงื่อนไขไม่เกิน 200 ตัวอักษร)

- [ ] **Step 11: Typecheck + lint + build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: typecheck ไม่มี output; lint `✔ No ESLint warnings or errors`; build สำเร็จ ตาราง Route มี `/leads` และ `ƒ Middleware`

- [ ] **Step 12: Commit**

```bash
git add lib/state lib/api/errors.ts lib/api/errors.test.ts lib/fixtures/load.ts components/shell/Toast.tsx components/shell/ModalRoot.tsx
git commit -m "refactor(web): split app context, clear toast timer, keep page errors in toasts and avoid login redirect loops" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: กติกาลีด + ช่วงวันที่ (ฟังก์ชันล้วน)

ค่าที่คาดหวังใน test ได้จากการอ่าน `legacy/app.js` L31-56, L80, L89-90, L122, L165-191, L219-225, L884-887 แล้วคำนวณกับ `lib/fixtures/data.ts` (= `legacy/data.js` หลัง `applyAuto`, วันนี้ `2026-11-04`, ผู้ใช้ fixture `r4` = หัวหน้า) ข้อเท็จจริงของ fixture ที่ test อ้าง: ลีด 28 ราย, ห้ามโทร 2 ราย (`L1011` เบอร์ `0644338237` ของ r2, `L1013` ของ r1), `L1004` ถูก r4 คัดออก (ไม่มีเจ้าของ), นัด `L1014`/`L1025` = 2026-11-03, `L1023` = 2026-11-04, `L1019` = 2026-11-06, ไม่มีลีดไหนมี `claimedBy`

**Files:**
- Create: `lib/domain/period.ts`, `lib/domain/leads.ts`
- Test: `lib/domain/period.test.ts`, `lib/domain/leads.test.ts`

- [ ] **Step 1: เขียน test ที่ยังไม่ผ่าน**

`lib/domain/period.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  customPeriod, hasPeriod, inPeriod, monthPeriod, monthValue, periodNote, presetPeriod, presetRange, PRESETS, yearOptions, yearPeriod, yearValue,
} from './period';

const T = '2026-11-04';

describe('period (prototype presetRange L47-56, bindPeriod L67-78, periodHtml L57-66)', () => {
  it('presetRange uses UTC date maths on the today string', () => {
    expect(presetRange('today', T)).toEqual(['2026-11-04', '2026-11-04']);
    expect(presetRange('7d', T)).toEqual(['2026-10-29', '2026-11-04']);
    expect(presetRange('m0', T)).toEqual(['2026-11-01', '2026-11-30']);
    expect(presetRange('m1', T)).toEqual(['2026-10-01', '2026-10-31']);
    expect(presetRange('y0', T)).toEqual(['2026-01-01', '2026-12-31']);
    expect(presetRange('all', T)).toEqual(['', '']);
  });
  it('crosses month and year boundaries', () => {
    expect(presetRange('m1', '2026-01-15')).toEqual(['2025-12-01', '2025-12-31']);
    expect(presetRange('7d', '2026-03-03')).toEqual(['2026-02-25', '2026-03-03']);
    expect(presetPeriod('m0', '2024-02-10')).toEqual({ from: '2024-02-01', to: '2024-02-29', key: 'm0' });
  });
  it('month input → first..last day; cleared → all', () => {
    expect(monthPeriod('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28', key: 'month' });
    expect(monthPeriod('2024-02')).toEqual({ from: '2024-02-01', to: '2024-02-29', key: 'month' });
    expect(monthPeriod('')).toEqual({ from: '', to: '', key: 'all' });
  });
  it('year select and custom dates', () => {
    expect(yearPeriod('2025')).toEqual({ from: '2025-01-01', to: '2025-12-31', key: 'year' });
    expect(yearPeriod('')).toBeNull();
    expect(customPeriod('2026-11-01', '')).toEqual({ from: '2026-11-01', to: '', key: 'custom' });
    expect(customPeriod('', '')).toEqual({ from: '', to: '', key: 'all' });
  });
  it('card footer text', () => {
    expect(periodNote({ from: '', to: '', key: 'all' })).toBe('ยังไม่ได้กรองช่วงวันที่');
    expect(periodNote({ from: '2026-11-01', to: '', key: 'custom' }))
      .toBe('กรอง 1/11/2026 – … · แสดงลีดที่มีการติดต่อ นัด หรือปิดการขายในช่วงนี้ (ลีดที่ยังไม่มีผู้ดูแลแสดงเสมอ)');
    expect(periodNote({ from: '2026-10-01', to: '2026-10-31', key: 'm1' }))
      .toBe('กรอง 1/10/2026 – 31/10/2026 · แสดงลีดที่มีการติดต่อ นัด หรือปิดการขายในช่วงนี้ (ลีดที่ยังไม่มีผู้ดูแลแสดงเสมอ)');
  });
  it('chips, year options and the values shown in the inputs', () => {
    expect(PRESETS.map(([, t]) => t)).toEqual(['ทั้งหมด', 'วันนี้', '7 วันล่าสุด', 'เดือนนี้', 'เดือนก่อน', 'ปีนี้']);
    expect(yearOptions(T)).toEqual([2026, 2025, 2024]);
    expect(monthValue({ from: '2026-02-01', to: '2026-02-28', key: 'month' })).toBe('2026-02');
    expect(monthValue({ from: '2026-02-01', to: '2026-02-28', key: 'custom' })).toBe('');
    expect(yearValue({ from: '2025-01-01', to: '2025-12-31', key: 'year' })).toBe('2025');
    expect(yearValue({ from: '', to: '', key: 'all' })).toBe('');
  });
  it('hasPeriod / inPeriod compare the YYYY-MM-DD prefix', () => {
    const nov = { from: '2026-11-01', to: '2026-11-30' };
    expect(hasPeriod({ from: '', to: '' })).toBe(false);
    expect(hasPeriod({ from: '', to: '2026-11-30' })).toBe(true);
    expect(inPeriod('2026-11-30T23:59', nov)).toBe(true);
    expect(inPeriod('2026-10-31T10:00', nov)).toBe(false);
    expect(inPeriod(null, nov)).toBe(false);
    expect(inPeriod('2020-01-01', { from: '', to: '2026-11-30' })).toBe(true);
  });
});
```

`lib/domain/leads.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Lead } from '@/lib/api/types';
import { fixturePayload } from '@/lib/fixtures/load';
import type { Period } from '@/lib/state/reducer';
import {
  bills, canUnclaim, canUnclaimAny, chipLabel, CHIP_DOT, claimBlock, contactedIn, dueInfo, filtered, isDnc, lastSeller, mineOrAll,
  periodOk, releasedByMe, statusCounts, STATUS_CHIPS, total, visible, wonIn, type LeadFilter,
} from './leads';

const F = fixturePayload();
const L = F.leads;
const byId = (id: string): Lead => {
  const l = L.find((x) => x.id === id);
  if (!l) throw new Error(`fixture lead ${id} is missing`);
  return l;
};
const ids = (a: Lead[]) => a.map((l) => l.id);
const NONE: Period = { from: '', to: '', key: 'all' };
const NOV: Period = { from: '2026-11-01', to: '2026-11-30', key: 'm0' };
const OCT: Period = { from: '2026-10-01', to: '2026-10-31', key: 'm1' };
const admin = { meId: 'r4', isAdmin: true };
const sales = (meId: string) => ({ meId, isAdmin: false });
const base = L.filter((l) => mineOrAll(l, admin));
const f = (over: Partial<LeadFilter> = {}): LeadFilter => ({ q: '', status: 'all', rep: 'all', camp: 'all', sort: 'due', period: NONE, today: F.today, ...over });
const lead = (over: Partial<Lead>): Lead => ({ ...byId('L1000'), ...over });

describe('lead helpers (prototype L31, L80, L122)', () => {
  it('total / bills / lastSeller from fixture purchases and live summary fields', () => {
    expect([bills(byId('L1000')), total(byId('L1000')), lastSeller(byId('L1000'), F.reps)]).toEqual([['895016'], 790, 'r3']);
    expect([bills(byId('L1005')), total(byId('L1005')), lastSeller(byId('L1005'), F.reps)])
      .toEqual([['394039', '502585', '749306', '993023'], 6029, 'r1']);
    // live: dsales_lead_json ส่ง total/bills มาแล้วและ purchases = []
    expect(total(lead({ total: 2490, purchases: [] }))).toBe(2490);
    expect(bills(lead({ bills: [], purchases: byId('L1005').purchases }))).toEqual([]);
    expect(lastSeller(lead({ purchases: [] }), F.reps)).toBeNull();
  });
  it('isDnc matches any no-call lead with the same phone', () => {
    expect(isDnc(L, '0644338237')).toBe(true);
    expect(isDnc(L, '0864355692')).toBe(false);
  });
});

describe('visibility (prototype L35-38)', () => {
  it('visible / mineOrAll per viewer', () => {
    expect(L.filter((l) => visible(l, admin))).toHaveLength(26);
    expect(base).toHaveLength(28);
    expect(L.filter((l) => visible(l, sales('r1')))).toHaveLength(7);
    expect(ids(L.filter((l) => mineOrAll(l, sales('r1'))))).toEqual(['L1010', 'L1013', 'L1020']);
    expect(L.filter((l) => visible(l, sales('r2')))).toHaveLength(13);
    expect(ids(L.filter((l) => mineOrAll(l, sales('r2'))))).toEqual(['L1000', 'L1005', 'L1006', 'L1008', 'L1011', 'L1012', 'L1018', 'L1019', 'L1024']);
    expect(L.filter((l) => visible(l, sales('r3')))).toHaveLength(9);
    expect(ids(L.filter((l) => mineOrAll(l, sales('r3'))))).toEqual(['L1017', 'L1023', 'L1025', 'L1026']);
  });
  it('releasedByMe hides a released lead from that sales rep only', () => {
    const rel = lead({ owner: null, releasedBy: ['r1'] });
    expect(releasedByMe(rel, sales('r1'))).toBe(true);
    expect(visible(rel, sales('r1'))).toBe(false);
    expect(visible(rel, sales('r2'))).toBe(true);
    expect(releasedByMe(rel, { meId: 'r1', isAdmin: true })).toBe(false);
    expect(visible(byId('L1004'), admin)).toBe(true);
  });
});

describe('period filters (prototype L43-45)', () => {
  it('periodOk / contactedIn / wonIn over all fixture leads', () => {
    const count = (p: Period) => [
      L.filter((l) => periodOk(l, p)).length, L.filter((l) => contactedIn(l, p)).length, L.filter((l) => wonIn(l, p)).length,
    ];
    expect(count(NONE)).toEqual([28, 16, 6]);
    expect(count(NOV)).toEqual([10, 1, 0]);
    expect(count(OCT)).toEqual([16, 11, 5]);
  });
});

describe('filtered / sortLeads / statusCounts (prototype L165-185, L219-225)', () => {
  it('default admin view: due ascending, no callback last, otherwise original order', () => {
    expect(ids(filtered(base, f()))).toEqual([
      'L1014', 'L1025', 'L1023', 'L1019', 'L1000', 'L1001', 'L1002', 'L1003', 'L1004', 'L1005', 'L1006', 'L1007', 'L1008', 'L1009',
      'L1010', 'L1011', 'L1012', 'L1013', 'L1015', 'L1016', 'L1017', 'L1018', 'L1020', 'L1021', 'L1022', 'L1024', 'L1026', 'L1027',
    ]);
    expect(ids(filtered(base, f({ period: NOV })))).toEqual(['L1014', 'L1025', 'L1023', 'L1019', 'L1001', 'L1003', 'L1004', 'L1007', 'L1009', 'L1013']);
    expect(ids(filtered(L.filter((l) => mineOrAll(l, sales('r2'))), f())))
      .toEqual(['L1019', 'L1000', 'L1005', 'L1006', 'L1008', 'L1011', 'L1012', 'L1018', 'L1024']);
  });
  it('status chip counts (period-aware)', () => {
    expect(statusCounts(base, NONE, F.today)).toEqual({ all: 28, overdue: 2, today: 1, new: 12, following: 3, callback: 4, won: 6, unreachable: 3, lost: 0, nocall: 2 });
    expect(statusCounts(base, NOV, F.today)).toEqual({ all: 10, overdue: 2, today: 1, new: 5, following: 1, callback: 4, won: 0, unreachable: 0, lost: 0, nocall: 1 });
    expect(statusCounts(L.filter((l) => mineOrAll(l, sales('r3'))), NONE, F.today))
      .toEqual({ all: 4, overdue: 1, today: 1, new: 0, following: 0, callback: 2, won: 1, unreachable: 1, lost: 0, nocall: 0 });
  });
  it('status chip / rep / campaign filters', () => {
    expect(ids(filtered(base, f({ status: 'overdue' })))).toEqual(['L1014', 'L1025']);
    expect(ids(filtered(base, f({ status: 'today' })))).toEqual(['L1023']);
    expect(ids(filtered(base, f({ status: 'nocall' })))).toEqual(['L1011', 'L1013']);
    expect(ids(filtered(base, f({ status: 'won' })))).toEqual(['L1012', 'L1015', 'L1020', 'L1021', 'L1022', 'L1026']);
    expect(ids(filtered(base, f({ rep: 'r1' })))).toEqual(['L1010', 'L1013', 'L1020']);
    expect(ids(filtered(base, f({ camp: 'self' })))).toEqual(['L1025', 'L1000', 'L1005', 'L1010', 'L1015', 'L1020']);
    expect(ids(filtered(base, f({ camp: 'c-host-nov' })))).toEqual(['L1014', 'L1023', 'L1002', 'L1008', 'L1011', 'L1017', 'L1026']);
  });
  it('search: name, phone (dashes ignored), bill, shop — trimmed and case-insensitive', () => {
    expect(ids(filtered(base, f({ q: 'ใจดี' })))).toEqual(['L1019', 'L1009']);
    expect(ids(filtered(base, f({ q: '089' })))).toEqual(['L1001', 'L1009', 'L1022']);
    expect(ids(filtered(base, f({ q: '086-435' })))).toEqual(['L1000']);
    expect(ids(filtered(base, f({ q: '895016' })))).toEqual(['L1000']);
    expect(ids(filtered(base, f({ q: '  ธนากร ' })))).toEqual(['L1000', 'L1020']);
    expect(ids(filtered(base, f({ q: 'LOA_' })))).toEqual(['L1025', 'L1000', 'L1005', 'L1010', 'L1015', 'L1020']);
  });
  it('sort: spend = total descending, none = original order', () => {
    const spend = filtered(base, f({ sort: 'spend' })).slice(0, 5);
    expect(ids(spend)).toEqual(['L1026', 'L1008', 'L1011', 'L1020', 'L1009']);
    expect(spend.map(total)).toEqual([15360, 10888, 10757, 10629, 9750]);
    expect(ids(filtered(base, f({ sort: 'none' }))).slice(0, 5)).toEqual(['L1000', 'L1001', 'L1002', 'L1003', 'L1004']);
  });
  it('chips: order, labels and dot colours', () => {
    expect(STATUS_CHIPS.map(chipLabel)).toEqual([
      'ทั้งหมด', 'เลยนัด', 'นัดวันนี้', 'ยังไม่ติดต่อ', 'กำลังติดตาม', 'รอติดต่อ', 'ปิดการขายแล้ว', 'ติดต่อไม่ได้', 'ไม่สนใจ', 'ไม่สะดวกให้โทร',
    ]);
    expect([CHIP_DOT.overdue, CHIP_DOT.today, CHIP_DOT.unreachable, CHIP_DOT.nocall]).toEqual(['var(--bad)', 'var(--warn)', 'var(--violet)', 'var(--bad)']);
  });
});

describe('row rules (prototype L89-90, L186-191, L884-887)', () => {
  it('canUnclaim needs claimedBy = me; canUnclaimAny only needs owner = me', () => {
    const mine = lead({ owner: 'r1', claimedBy: 'r1', status: 'following', noCall: false });
    expect(canUnclaim(mine, 'r1')).toBe(true);
    const assigned: Lead = { ...mine, claimedBy: null }; // หัวหน้ามอบหมายให้ (ไม่ได้จองเอง)
    expect(canUnclaim(assigned, 'r1')).toBe(false);
    expect(canUnclaimAny(assigned, 'r1')).toBe(true);
    expect(canUnclaimAny({ ...mine, status: 'won' }, 'r1')).toBe(false);
    expect(canUnclaimAny({ ...mine, noCall: true }, 'r1')).toBe(false);
    expect(canUnclaim(mine, 'r2')).toBe(false);
    expect(L.filter((l) => canUnclaim(l, 'r4'))).toHaveLength(0);
  });
  it('dueInfo labels', () => {
    expect(dueInfo('2026-11-03', F.today)).toEqual({ cls: 'overdue', text: 'เลยนัด 3/11/2026' });
    expect(dueInfo('2026-11-04', F.today)).toEqual({ cls: 'today', text: 'นัดวันนี้ 4/11/2026' });
    expect(dueInfo('2026-11-06', F.today)).toEqual({ cls: '', text: 'นัดติดต่อ 6/11/2026' });
    expect(dueInfo(null, F.today)).toBeNull();
  });
  it('claimBlock: taken lead, maxPerRep per campaign, otherwise allowed', () => {
    const camp = { ...F.campaigns[0], maxPerRep: 1 }; // c-bebe-nov: r4 ดูแลอยู่ 3 ลีด (L1016, L1022, L1027)
    expect(claimBlock(byId('L1006'), camp, L, 'r4')).toBe('ลีดนี้มีคนจองไปแล้ว');
    expect(claimBlock(byId('L1001'), camp, L, 'r4')).toBe('จองได้สูงสุด 1 ลีดต่อคนในแคมเปญนี้');
    expect(claimBlock(byId('L1001'), { ...camp, maxPerRep: 4 }, L, 'r4')).toBeNull();
    expect(claimBlock(byId('L1001'), { ...camp, maxPerRep: null }, L, 'r4')).toBeNull();
    expect(claimBlock(byId('L1001'), undefined, L, 'r4')).toBeNull();
  });
});
```

- [ ] **Step 2: รัน test ให้เห็นว่าไม่ผ่าน**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./period" from "lib/domain/period.test.ts". Does the file exist?` และ `Failed to resolve import "./leads" from "lib/domain/leads.test.ts"` สรุป `Test Files  2 failed | 14 passed (16)` · `Tests  63 passed (63)`

- [ ] **Step 3: `lib/domain/period.ts`**

```ts
import { fmtDate } from '@/lib/format';
import type { Period } from '@/lib/state/reducer';

// การ์ดช่วงวันที่ของ prototype (legacy/app.js L40-41, L46-78) — คำนวณวันที่แบบ UTC บนข้อความ today จึงไม่ขึ้นกับเขตเวลาเครื่อง

export type PresetKey = 'all' | 'today' | '7d' | 'm0' | 'm1' | 'y0';
export const PRESETS: ReadonlyArray<readonly [PresetKey, string]> = [
  ['all', 'ทั้งหมด'], ['today', 'วันนี้'], ['7d', '7 วันล่าสุด'], ['m0', 'เดือนนี้'], ['m1', 'เดือนก่อน'], ['y0', 'ปีนี้'],
];

const ALL: Period = { from: '', to: '', key: 'all' };
const ymd = (d: Date): string => d.toISOString().slice(0, 10);
const utc = (y: number, m: number, d: number): string => ymd(new Date(Date.UTC(y, m, d)));

export const hasPeriod = (p: Pick<Period, 'from' | 'to'>): boolean => !!(p.from || p.to);

export const inPeriod = (d: string | null | undefined, p: Pick<Period, 'from' | 'to'>): boolean =>
  !!d && (!p.from || d.slice(0, 10) >= p.from) && (!p.to || d.slice(0, 10) <= p.to);

export function presetRange(k: PresetKey, today: string): [string, string] {
  const t = new Date(today + 'T00:00:00Z');
  const y = t.getUTCFullYear();
  const m = t.getUTCMonth();
  if (k === 'today') return [today, today];
  if (k === '7d') return [ymd(new Date(t.getTime() - 6 * 864e5)), today];
  if (k === 'm0') return [utc(y, m, 1), utc(y, m + 1, 0)];
  if (k === 'm1') return [utc(y, m - 1, 1), utc(y, m, 0)];
  if (k === 'y0') return [utc(y, 0, 1), utc(y, 11, 31)];
  return ['', ''];
}

export function presetPeriod(k: PresetKey, today: string): Period {
  const [from, to] = presetRange(k, today);
  return { from, to, key: k };
}

/** input[type=month] → วันแรกถึงวันสุดท้ายของเดือน; ล้างค่า → ทั้งหมด (L70-73) */
export function monthPeriod(value: string): Period {
  if (!value) return ALL;
  const [yy, mm] = value.split('-').map(Number);
  return { from: `${value}-01`, to: utc(yy, mm, 0), key: 'month' };
}

/** select ปี → ทั้งปี; เลือก "ปี…" ไม่เปลี่ยนอะไร (L74) */
export const yearPeriod = (value: string): Period | null => (value ? { from: `${value}-01-01`, to: `${value}-12-31`, key: 'year' } : null);

/** ช่องวันที่เริ่ม/สิ้นสุด (L75-77) */
export const customPeriod = (from: string, to: string): Period => ({ from, to, key: from || to ? 'custom' : 'all' });

export const yearOptions = (today: string): number[] => {
  const y = +today.slice(0, 4);
  return [y, y - 1, y - 2];
};

export const monthValue = (p: Period): string => (p.key === 'month' ? p.from.slice(0, 7) : '');
export const yearValue = (p: Period): string => (p.key === 'year' ? p.from.slice(0, 4) : '');

export function periodNote(p: Period): string {
  if (!hasPeriod(p)) return 'ยังไม่ได้กรองช่วงวันที่';
  return `กรอง ${p.from ? fmtDate(p.from) : '…'} – ${p.to ? fmtDate(p.to) : '…'} · แสดงลีดที่มีการติดต่อ นัด หรือปิดการขายในช่วงนี้ (ลีดที่ยังไม่มีผู้ดูแลแสดงเสมอ)`;
}
```

- [ ] **Step 4: `lib/domain/leads.ts`**

```ts
import type { Campaign, Lead, Rep } from '@/lib/api/types';
import { STATUS, type LeadStatus } from '@/lib/constants';
import { fmtDate } from '@/lib/format';
import type { Period, UiFilters } from '@/lib/state/reducer';
import { hasPeriod, inPeriod } from './period';

// กติกาลีดของ prototype (legacy/app.js L28-45, L80, L89-90, L122, L165-191, L219-225, L884-887) เป็นฟังก์ชันล้วน ไม่อ่าน state เอง

export interface Viewer { meId: string; isAdmin: boolean }
type RepNames = ReadonlyArray<Pick<Rep, 'id' | 'name'>>;

export const repName = (reps: RepNames, id: string | null | undefined): string | undefined =>
  id ? reps.find((r) => r.id === id)?.name : undefined;

/** ยอดซื้อรวม (L31): live ใช้ total จาก server, fixture รวมจากประวัติซื้อ */
export const total = (l: Pick<Lead, 'total' | 'purchases'>): number =>
  l.total != null ? Number(l.total) : l.purchases.reduce((s, p) => s + p.amount, 0);

/** เลขบิลที่เคยซื้อ (L122): live ใช้ bills จาก server (ว่างได้), fixture ใช้บิลไม่ซ้ำจากประวัติซื้อ */
export const bills = (l: Pick<Lead, 'bills' | 'purchases'>): string[] => l.bills ?? [...new Set(l.purchases.map((p) => p.bill))];

/** เซลล์ที่ขายล่าสุด (L80) = รายการซื้อแรกที่ผู้ขายเป็นเซลล์ในทีม (live ไม่มีผู้ขาย → null) */
export const lastSeller = (l: Pick<Lead, 'purchases'>, reps: ReadonlyArray<Pick<Rep, 'id'>>): string | null =>
  l.purchases.find((p) => p.seller && reps.some((r) => r.id === p.seller))?.seller || null;

/** ห้ามโทร (L35): มีลีดเบอร์นี้ที่ noCall */
export const isDnc = (leads: ReadonlyArray<Pick<Lead, 'phone' | 'noCall'>>, phone: string): boolean =>
  leads.some((l) => l.phone === phone && !!l.noCall);

export const releasedByMe = (l: Pick<Lead, 'releasedBy'>, v: Viewer): boolean => !v.isAdmin && !!l.releasedBy?.includes(v.meId);

/** หน้าแคมเปญ/การ์ด (L37): เซลล์เห็นเฉพาะลีดว่างกับของตัวเอง ไม่เห็นห้ามโทร/ที่ตัวเองคัดออก */
export const visible = (l: Pick<Lead, 'noCall' | 'releasedBy' | 'owner'>, v: Viewer): boolean =>
  !l.noCall && !releasedByMe(l, v) && (v.isAdmin || !l.owner || l.owner === v.meId);

/** หน้า Direct Sale / Dashboard (L38) */
export const mineOrAll = (l: Pick<Lead, 'owner'>, v: Viewer): boolean => v.isAdmin || l.owner === v.meId;

type Dated = Pick<Lead, 'owner' | 'interactions' | 'callback' | 'closedAt' | 'status'>;

/** ลีดที่ยังไม่มีผู้ดูแลแสดงเสมอ ที่เหลือต้องมีการติดต่อ/นัด/ปิดการขายในช่วง (L43) */
export const periodOk = (l: Dated, p: Period): boolean =>
  !hasPeriod(p) || !l.owner || l.interactions.some((i) => inPeriod(i.date, p)) || inPeriod(l.callback, p) || inPeriod(l.closedAt, p);

export const contactedIn = (l: Dated, p: Period): boolean => (hasPeriod(p) ? l.interactions.some((i) => inPeriod(i.date, p)) : l.status !== 'new');

export const wonIn = (l: Dated, p: Period): boolean => l.status === 'won' && (!hasPeriod(p) || inPeriod(l.closedAt, p));

/** ปุ่ม "ยกเลิกจอง" ในตาราง (L89): ต้องจองเอง (ไม่ใช่หัวหน้ามอบหมาย) ยังไม่ปิดการขาย และไม่ใช่ห้ามโทร */
export const canUnclaim = (l: Pick<Lead, 'owner' | 'claimedBy' | 'noCall' | 'status'>, meId: string): boolean =>
  l.owner === meId && l.claimedBy === meId && !l.noCall && l.status !== 'won';

/** ถังลูกค้า / popup ยืนยัน (L90): ไม่ต้องจองเอง */
export const canUnclaimAny = (l: Pick<Lead, 'owner' | 'noCall' | 'status'>, meId: string): boolean =>
  l.owner === meId && !l.noCall && l.status !== 'won';

export type StatusChip = 'all' | 'overdue' | 'today' | LeadStatus | 'nocall';
export const STATUS_CHIPS: readonly StatusChip[] = ['all', 'overdue', 'today', 'new', 'following', 'callback', 'won', 'unreachable', 'lost', 'nocall'];
const EXTRA: Partial<Record<StatusChip, string>> = { overdue: 'เลยนัด', today: 'นัดวันนี้', nocall: 'ไม่สะดวกให้โทร' };
export const CHIP_DOT: Record<Exclude<StatusChip, 'all'>, string> = {
  new: 'var(--grey)', following: 'var(--info)', callback: 'var(--warn)', won: 'var(--ok)', lost: 'var(--bad)', unreachable: 'var(--violet)',
  overdue: 'var(--bad)', today: 'var(--warn)', nocall: 'var(--bad)',
};
export const chipLabel = (s: StatusChip): string => (s === 'all' ? 'ทั้งหมด' : EXTRA[s] ?? STATUS[s as LeadStatus]);

type Matchable = Pick<Lead, 'callback' | 'noCall' | 'status'>;
export function matchStatus(l: Matchable, s: string, today: string): boolean {
  if (s === 'all') return true;
  if (s === 'today') return l.callback === today;
  if (s === 'overdue') return !!(l.callback && l.callback < today);
  if (s === 'nocall') return !!l.noCall;
  return l.status === s;
}

/** ตัวเลขในวงเล็บของชิปสถานะ (L220-221) นับจาก base ที่ผ่าน periodOk */
export function statusCounts(base: ReadonlyArray<Lead>, period: Period, today: string): Record<StatusChip, number> {
  const inRange = base.filter((l) => periodOk(l, period));
  return Object.fromEntries(STATUS_CHIPS.map((s) => [s, inRange.filter((l) => matchStatus(l, s, today)).length])) as Record<StatusChip, number>;
}

export type SortKey = UiFilters['sort'];

/** L181-185: due = วันนัดใกล้สุด (ไม่มีนัดไว้ท้าย), spend = ยอดซื้อมากสุด, none = ตามเดิม (sort ของ JS เสถียร) */
export function sortLeads(a: ReadonlyArray<Lead>, sort: SortKey): Lead[] {
  if (sort === 'due') return [...a].sort((x, y) => (x.callback || '9999').localeCompare(y.callback || '9999'));
  if (sort === 'spend') return [...a].sort((x, y) => total(y) - total(x));
  return [...a];
}

export interface LeadFilter { q: string; status: string; rep: string; camp: string; sort: SortKey; period: Period; today: string }

/** L165-180: ช่วงวันที่ → ชิปสถานะ → เซลล์ → แคมเปญ → คำค้น → เรียง */
export function filtered(base: ReadonlyArray<Lead>, f: LeadFilter): Lead[] {
  const q = f.q.trim().toLowerCase();
  const out = base.filter((l) => {
    if (!periodOk(l, f.period)) return false;
    if (!matchStatus(l, f.status, f.today)) return false;
    if (f.rep !== 'all' && l.owner !== f.rep) return false;
    if (f.camp !== 'all' && (f.camp === 'self' ? l.source !== 'self' : l.campaignId !== f.camp)) return false;
    if (!q) return true;
    return l.name.toLowerCase().includes(q) || l.phone.includes(q.replace(/-/g, '')) || bills(l).some((b) => b.includes(q)) || l.shop.toLowerCase().includes(q);
  });
  return sortLeads(out, f.sort);
}

/** ป้ายวันนัดใต้ badge สถานะ (L186-191) */
export function dueInfo(callback: string | null | undefined, today: string): { cls: '' | 'overdue' | 'today'; text: string } | null {
  if (!callback) return null;
  if (callback < today) return { cls: 'overdue', text: `เลยนัด ${fmtDate(callback)}` };
  if (callback === today) return { cls: 'today', text: `นัดวันนี้ ${fmtDate(callback)}` };
  return { cls: '', text: `นัดติดต่อ ${fmtDate(callback)}` };
}

/** ข้อความ toast เมื่อจองลีดแคมเปญไม่ได้ (L886-887; maxPerRep ตรวจฝั่ง client เท่านั้น) หรือ null = จองได้ */
export function claimBlock(
  l: Pick<Lead, 'owner'>, camp: Pick<Campaign, 'id' | 'maxPerRep'> | undefined, leads: ReadonlyArray<Pick<Lead, 'campaignId' | 'owner'>>, meId: string,
): string | null {
  if (l.owner) return 'ลีดนี้มีคนจองไปแล้ว';
  if (camp?.maxPerRep && leads.filter((x) => x.campaignId === camp.id && x.owner === meId).length >= camp.maxPerRep) {
    return `จองได้สูงสุด ${camp.maxPerRep} ลีดต่อคนในแคมเปญนี้`;
  }
  return null;
}
```

- [ ] **Step 5: รัน test ให้ผ่าน**

Run: `npm test`
Expected: `Test Files  16 passed (16)` · `Tests  84 passed (84)`

ถ้าค่าใน `leads.test.ts` ไม่ตรง ให้เทียบกับ prototype ตรง ๆ: เปิด prototype โหมดตัวอย่าง (เซลล์ = Dev MPD) แล้วดูตัวเลขบนชิป/ลำดับแถว — ต้องแก้ที่ `lib/domain/leads.ts` ไม่ใช่แก้ค่าใน test (ค่าใน test คำนวณจากโค้ด prototype ชุดเดียวกัน)

- [ ] **Step 6: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: typecheck ไม่มี output; lint `✔ No ESLint warnings or errors`

- [ ] **Step 7: Commit**

```bash
git add lib/domain/period.ts lib/domain/period.test.ts lib/domain/leads.ts lib/domain/leads.test.ts
git commit -m "feat(web): port lead visibility, period, filter, sort and unclaim rules from the prototype" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `lib/jst.ts` — ช่องทางแชต, เปิด JST, ตรวจทักแชท

**Files:**
- Create: `lib/jst.ts`
- Test: `lib/jst.test.ts`

- [ ] **Step 1: เขียน test ที่ยังไม่ผ่าน**

`lib/jst.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ db: () => ({ rpc }) }));

import type { ChatSessionJson, Lead } from '@/lib/api/types';
import { fixturePayload } from '@/lib/fixtures/load';
import {
  chatAria, chatCheckFor, chatCheckView, channelsOf, chatTitle, jstOpen, jstTarget, JST_TIMEOUT_MS, localChatCheck, nextChatCheck, platformOf,
  runVerify, summarizeChats, verifyTodo, type ChatCheckResult, type JstDeps, type JstTarget,
} from './jst';

const F = fixturePayload();
const byId = (id: string): Lead => {
  const l = F.leads.find((x) => x.id === id);
  if (!l) throw new Error(`fixture lead ${id} is missing`);
  return l;
};

const T: JstTarget = {
  phone: '0869684532', name: 'วีรวัฒน์ พงษ์ไทย', brand: 'hosttail', platform: 'shopee', shop: 'SH_hosttail', chat: 'mom_ploy114_sh', ms_id: null,
};
const mocks = () => ({
  fetch: vi.fn<JstDeps['fetch']>(),
  open: vi.fn<JstDeps['open']>(),
  writeText: vi.fn<(text: string) => Promise<void>>(),
  toast: vi.fn<(msg: string) => void>(),
});
type Mocks = ReturnType<typeof mocks>;
const depsOf = (m: Mocks, over: Partial<JstDeps> = {}): JstDeps => ({
  helperUrl: 'http://127.0.0.1:47321', urlTemplate: '', fetch: m.fetch, open: m.open, clipboard: { writeText: m.writeText }, toast: m.toast, ...over,
});

const S = (o: Partial<ChatSessionJson>): ChatSessionJson => ({
  ms_id: 1, channel: 'LINE', page: 'Bebeplay OA', chat_name: 'x', last_time: null, msg_count: 3, admin_msgs: 0,
  last_admin_time: null, last_admin_sender: null, last_customer_time: null, ...o,
});
const SESSIONS = [
  S({ ms_id: 1, admin_msgs: 2, last_admin_time: '2026-11-04T10:05:00', last_admin_sender: 'Ploy' }),
  S({ ms_id: 2, channel: 'Facebook', page: 'Hosttail FB', admin_msgs: 1, last_admin_time: '2026-11-04T11:30:00', last_admin_sender: 'Mint' }),
  S({ ms_id: 3 }),
];

beforeEach(() => rpc.mockReset());

describe('channels (prototype L397-411)', () => {
  it('platformOf reads the shop-code prefix', () => {
    expect(['SH_bebeplay', 'LOA_hosttail', 'LA_x', 'TT_x', 'FB_x', 'Web_bebeplay', 'IG_x', 'XX_x', '', null].map((s) => platformOf(s)))
      .toEqual(['shopee', 'line', 'lazada', 'tiktok', 'facebook', 'website', 'instagram', 'other', 'other', 'other']);
  });
  it('channelsOf normalises, puts LINE first and falls back to shop/chatName', () => {
    expect(channelsOf(byId('L1011'))).toEqual([
      { shop: 'SH_hosttail', chat: 'cat_lover111_sh', platform: 'shopee', ms_id: null },
      { shop: 'LA_hosttail', chat: 'happy_mom111_la', platform: 'lazada', ms_id: null },
      { shop: 'TT_hosttail', chat: 'mom_ploy111_tt', platform: 'tiktok', ms_id: null },
    ]);
    expect(channelsOf(byId('L1003')).map((c) => c.shop)).toEqual(['LOA_bebeplay', 'SH_bebeplay', 'Web_bebeplay']);
    expect(channelsOf({ channels: [], shop: 'SH_x', chatName: 'buyer1' })).toEqual([{ shop: 'SH_x', chat: 'buyer1', platform: 'shopee', ms_id: null }]);
    expect(channelsOf({ channels: [{ platform: 'facebook', shop: 'FB_x', chat_name: 'fb1', ms_id: 7 }] }))
      .toEqual([{ shop: 'FB_x', chat: 'fb1', platform: 'facebook', ms_id: 7 }]);
    expect(channelsOf({ channels: null, shop: '', chatName: '' })).toEqual([]);
  });
  it('jstTarget and the chat button labels', () => {
    const l = byId('L1014');
    expect(jstTarget(l, channelsOf(l)[0])).toEqual(T);
    const noChat = { shop: 'SH_x', chat: '', platform: 'shopee', ms_id: null };
    expect(jstTarget({ ...l, chatName: '' }, noChat).chat).toBe('วีรวัฒน์ พงษ์ไทย');
    expect(jstTarget({ ...l, chatName: 'buyer' }, noChat).chat).toBe('buyer');
    expect(chatTitle({ shop: 'SH_hosttail', chat: '', platform: 'shopee', ms_id: null })).toBe('Shopee · SH_hosttail — เปิดแชตใน JST');
    expect(chatTitle({ shop: '', chat: '', platform: 'line', ms_id: null })).toBe('LINE — เปิดแชตใน JST');
    expect(chatAria({ shop: 'SH_hosttail', chat: '', platform: 'shopee', ms_id: null })).toBe('เปิดแชต Shopee SH_hosttail ใน JST');
  });
});

describe('jstOpen (prototype L415-435)', () => {
  it('helper OK → toast (silent in auto mode) and true', async () => {
    const m = mocks();
    m.fetch.mockResolvedValue({ ok: true });
    await expect(jstOpen(T, 'Dev MPD', depsOf(m))).resolves.toBe(true);
    const [url, init] = m.fetch.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:47321/open');
    expect(init).toMatchObject({ method: 'POST', headers: { 'Content-Type': 'application/json' } });
    expect(JSON.parse(String(init.body))).toEqual({ ...T, rep: 'Dev MPD' });
    expect(m.toast).toHaveBeenCalledWith('เปิดแชตใน JST แล้ว');
    await expect(jstOpen(T, 'Dev MPD', depsOf(m), { auto: true })).resolves.toBe(true);
    expect(m.toast).toHaveBeenCalledTimes(1);
  });
  it('a helper that never answers is aborted after 2500 ms, then the chat name is copied', async () => {
    vi.useFakeTimers();
    try {
      const m = mocks();
      m.fetch.mockImplementation((_url, init) => new Promise<{ ok: boolean }>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      }));
      m.writeText.mockResolvedValue();
      const p = jstOpen(T, 'Dev MPD', depsOf(m));
      await vi.advanceTimersByTimeAsync(JST_TIMEOUT_MS - 1);
      expect(m.writeText).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      await expect(p).resolves.toBe(false);
      expect(m.writeText).toHaveBeenCalledWith('mom_ploy114_sh');
      expect(m.toast).toHaveBeenCalledWith('ยังไม่ได้รันตัวช่วย JST บนเครื่อง · คัดลอกชื่อแชตแล้ว นำไปค้นหาใน JST');
    } finally {
      vi.useRealTimers();
    }
  });
  it('falls back to the URL template with encoded payload values', async () => {
    const m = mocks();
    m.fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    const deps = depsOf(m, { urlTemplate: 'https://jst.example/chat?q={chat}&p={phone}&r={rep}&x={ms_id}' });
    await expect(jstOpen(T, 'Dev MPD', deps)).resolves.toBe(true);
    expect(m.open).toHaveBeenCalledWith('https://jst.example/chat?q=mom_ploy114_sh&p=0869684532&r=Dev%20MPD&x=');
    expect(m.writeText).not.toHaveBeenCalled();
  });
  it('clipboard failure shows the search text; auto mode never copies or toasts', async () => {
    const m = mocks();
    m.fetch.mockResolvedValue({ ok: false });
    m.writeText.mockRejectedValue(new Error('denied'));
    await expect(jstOpen({ ...T, chat: '' }, 'Dev MPD', depsOf(m))).resolves.toBe(false);
    expect(m.writeText).toHaveBeenCalledWith('0869684532');
    expect(m.toast).toHaveBeenCalledWith('ยังไม่ได้รันตัวช่วย JST · ค้นหาใน JST ด้วย: 0869684532');
    m.toast.mockClear();
    m.writeText.mockClear();
    await expect(jstOpen(T, 'Dev MPD', depsOf(m), { auto: true })).resolves.toBe(false);
    expect(m.writeText).not.toHaveBeenCalled();
    expect(m.toast).not.toHaveBeenCalled();
  });
});

describe('chat check (prototype L438-479)', () => {
  it('summarizeChats sums admin messages and takes the latest admin reply', () => {
    expect(summarizeChats(SESSIONS)).toEqual({ live: true, sessions: SESSIONS, found: 3, count: 3, sent: true, last: '2026-11-04T11:30:00', by: 'Mint' });
    expect(summarizeChats([])).toEqual({ live: true, sessions: [], found: 0, count: 0, sent: false, last: null, by: null });
  });
  it('chatCheckFor sends the raw claimed time as p_since; errors become a Thai message', async () => {
    rpc.mockResolvedValueOnce({ data: SESSIONS, error: null });
    const res = await chatCheckFor({ phone: '0812345678', claimedAtIso: '2026-11-04T02:05:00.123456+00:00' });
    expect(rpc).toHaveBeenCalledWith('dsales_customer_chats', { p_phone: '0812345678', p_since: '2026-11-04T02:05:00.123456+00:00' });
    expect(res).toMatchObject({ count: 3, sent: true });
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'not_member' } });
    await expect(chatCheckFor({ phone: '0812345678', claimedAtIso: null })).resolves.toEqual({ err: 'ตรวจไม่สำเร็จ: บัญชีนี้ยังไม่มีสิทธิ์ใช้งาน ติดต่อหัวหน้า' });
    expect(rpc).toHaveBeenLastCalledWith('dsales_customer_chats', { p_phone: '0812345678', p_since: null });
  });
  it('localChatCheck (fixture mode) counts in-app chat logs since the claim', () => {
    expect(localChatCheck(byId('L1011'), F.reps)).toEqual({ live: false, sessions: [], found: 1, count: 1, sent: true, last: '2026-10-03T11:20', by: 'กมลชนก ใจดี' });
    expect(localChatCheck({ ...byId('L1011'), claimedAt: '2026-10-04T00:00' }, F.reps)).toMatchObject({ count: 0, sent: false, found: 1, last: null, by: null });
    expect(localChatCheck(byId('L1014'), F.reps)).toMatchObject({ count: 0, sent: false });
  });
  it('chatCheckView: badge, detail and one line per session', () => {
    expect(chatCheckView({ err: 'ตรวจไม่สำเร็จ: x' }, null)).toEqual({ badge: { cls: 's-lost plain', text: 'ตรวจไม่ได้' }, detail: 'ตรวจไม่สำเร็จ: x', sessions: [] });
    const sent = chatCheckView(summarizeChats(SESSIONS), '2026-11-04T09:05');
    expect(sent.badge).toEqual({ cls: 's-won', text: 'ทักแชทแล้ว' });
    expect(sent.detail).toBe('เซลล์ส่ง 3 ข้อความ หลังจอง (4/11/2026 09:05) · ล่าสุด 4/11/2026 11:30 โดย Mint');
    expect(sent.sessions).toEqual([
      { key: '1-0', icon: 'line', page: 'Bebeplay OA', meta: 'ล่าสุด เซลล์ 4/11/2026 10:05 · Ploy · ส่ง 2' },
      { key: '2-1', icon: 'facebook', page: 'Hosttail FB', meta: 'ล่าสุด เซลล์ 4/11/2026 11:30 · Mint · ส่ง 1' },
      { key: '3-2', icon: 'line', page: 'Bebeplay OA', meta: 'ล่าสุด — · ส่ง 0' },
    ]);
    expect(chatCheckView(summarizeChats([S({ channel: 'WebChat', page: null, last_time: '2026-11-03T08:00:00' })]), null)).toEqual({
      badge: { cls: 's-callback plain', text: 'ยังไม่พบข้อความที่ส่ง' }, detail: 'เซลล์ยังไม่ได้ส่งข้อความ',
      sessions: [{ key: '1-0', icon: 'other', page: 'WebChat', meta: 'ล่าสุด 3/11/2026 08:00 · ส่ง 0' }],
    });
    expect(chatCheckView(summarizeChats([]), null)).toEqual({
      badge: { cls: 's-new plain', text: 'ไม่พบแชตใน JST' },
      detail: 'จับคู่แชตของลูกค้ารายนี้ไม่พบ (จับคู่ด้วยชื่อแชต/ชื่อผู้ซื้อ) ลองตรวจใน JST เอง', sessions: [],
    });
  });
  it('nextChatCheck marks the table dirty only when "sent" changes (ui.dirtyRows)', () => {
    const res = summarizeChats(SESSIONS);
    expect(nextChatCheck(null, res, '2026-11-04T12:00')).toEqual({ chatCheck: { at: '2026-11-04T12:00', sent: true, count: 3 }, dirty: true });
    expect(nextChatCheck({ at: 'x', sent: true, count: 1 }, res, 't')).toEqual({ chatCheck: { at: 't', sent: true, count: 3 }, dirty: false });
    expect(nextChatCheck({ at: 'x', sent: true, count: 1 }, summarizeChats([]), 't')?.dirty).toBe(true);
    expect(nextChatCheck(null, { err: 'x' }, 't')).toBeNull();
  });
});

describe('verifyMine (prototype L467-479)', () => {
  const mk = (i: number, over: Partial<Lead> = {}): Lead => ({
    ...byId('L1000'), id: `T${i}`, owner: 'r1', claimedAt: '2026-11-04T09:00', chatCheck: null, noCall: false, ...over,
  });
  it('verifyTodo: my claimed, not-yet-sent, callable leads — at most 10', () => {
    const others = [mk(20, { owner: 'r2' }), mk(21, { claimedAt: null }), mk(22, { chatCheck: { at: 'x', sent: true, count: 1 } }), mk(23, { noCall: true })];
    const leads = [...Array.from({ length: 12 }, (_, i) => mk(i)), ...others];
    expect(verifyTodo(leads, 'r1').map((l) => l.id)).toEqual(['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9']);
    expect(verifyTodo(others, 'r1')).toEqual([]);
  });
  it('runVerify checks one lead at a time, skips errors and returns only leads that became "sent"', async () => {
    const order: string[] = [];
    const check = vi.fn(async (l: Lead): Promise<ChatCheckResult> => {
      order.push(`start ${l.id}`);
      await Promise.resolve();
      order.push(`end ${l.id}`);
      if (l.id === 'T1') return { err: 'ตรวจไม่สำเร็จ: x' };
      return l.id === 'T2' ? summarizeChats([]) : summarizeChats(SESSIONS);
    });
    const todo = [mk(0), mk(1), mk(2), mk(3, { chatCheck: { at: 'x', sent: false, count: 0 } })];
    const changed = await runVerify(todo, check, () => '2026-11-04T12:00');
    expect(order).toEqual(['start T0', 'end T0', 'start T1', 'end T1', 'start T2', 'end T2', 'start T3', 'end T3']);
    expect(changed).toEqual([
      { id: 'T0', chatCheck: { at: '2026-11-04T12:00', sent: true, count: 3 } },
      { id: 'T3', chatCheck: { at: '2026-11-04T12:00', sent: true, count: 3 } },
    ]);
  });
});
```

- [ ] **Step 2: รัน test ให้เห็นว่าไม่ผ่าน**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./jst" from "lib/jst.test.ts". Does the file exist?` สรุป `Test Files  1 failed | 16 passed (17)` · `Tests  84 passed (84)`

- [ ] **Step 3: `lib/jst.ts`**

```ts
import { errorMessage } from '@/lib/api/errors';
import { getCustomerChats } from '@/lib/api/rpc';
import type { Channel, ChatCheck, ChatSessionJson, Lead, Rep } from '@/lib/api/types';
import { JST_HELPER_URL, JST_URL_TEMPLATE, PLAT, type Brand, type Platform } from '@/lib/constants';
import { fmtDT } from '@/lib/format';

// การเชื่อม JST ของ prototype (legacy/app.js L397-479): ช่องทางแชต, เปิดแชต, ตรวจว่าเซลล์ทักแชทแล้วหรือยัง

/* ---------- ช่องทางแชต ---------- */
// รหัสร้านตาม cdp.shops: SH_=Shopee, LOA_=LINE OA, LA_=Lazada, TT_=TikTok, FB_=Facebook, Web_=เว็บไซต์, IG_=Instagram
const SHOP_PREFIX: Readonly<Record<string, Platform>> = {
  SH: 'shopee', LOA: 'line', LA: 'lazada', TT: 'tiktok', FB: 'facebook', WEB: 'website', IG: 'instagram',
};
export const platformOf = (shop: string | null | undefined): Platform => SHOP_PREFIX[String(shop || '').split('_')[0].toUpperCase()] || 'other';
export const platLabel = (p: string): string => (PLAT as Readonly<Record<string, string>>)[p] || p;

export interface NormChannel { shop: string; chat: string; platform: string; ms_id: number | string | null }
export interface ChannelSource { channels?: Channel[] | null; shop?: string | null; chatName?: string | null }

/** ช่องทางของลูกค้า (L401-402): channels หรือร้านหลัก + ชื่อแชต, LINE ขึ้นก่อน */
export function channelsOf(x: ChannelSource): NormChannel[] {
  const raw: Channel[] = x.channels && x.channels.length ? x.channels : x.shop ? [{ shop: x.shop, chat: x.chatName ?? '' }] : [];
  return raw
    .map((c) => ({ shop: c.shop || '', chat: c.chat || c.chat_name || '', platform: c.platform || platformOf(c.shop), ms_id: c.ms_id || null }))
    .sort((a, b) => Number(b.platform === 'line') - Number(a.platform === 'line'));
}

export interface JstSource { phone: string; name: string; brand: Brand; chatName?: string | null }
export interface JstTarget { phone: string; name: string; brand: Brand; platform: string; shop: string; chat: string; ms_id: number | string | null }

export const jstTarget = (x: JstSource, c: NormChannel): JstTarget => ({
  phone: x.phone, name: x.name, brand: x.brand, platform: c.platform, shop: c.shop, chat: c.chat || x.chatName || x.name, ms_id: c.ms_id || null,
});
export const chatTitle = (c: NormChannel): string => `${platLabel(c.platform)}${c.shop ? ' · ' + c.shop : ''} — เปิดแชตใน JST`;
export const chatAria = (c: NormChannel): string => `เปิดแชต ${platLabel(c.platform)} ${c.shop} ใน JST`;

/* ---------- เปิดแชตใน JST ---------- */
export const JST_TIMEOUT_MS = 2500;

export interface JstDeps {
  helperUrl: string;
  urlTemplate: string;
  fetch: (url: string, init: RequestInit) => Promise<{ ok: boolean }>;
  open: (url: string) => void;
  clipboard: { writeText: (text: string) => Promise<void> } | undefined;
  toast: (msg: string) => void;
}

/**
 * L415-435: 1) ตัวช่วยบนเครื่องเซลล์ POST {helper}/open (ยกเลิกหลัง 2500 ms) 2) ลิงก์ตาม urlTemplate 3) คัดลอกชื่อแชต
 * auto = เปิดเองหลังจอง: ไม่ toast ตอนสำเร็จ และไม่คัดลอก
 */
export async function jstOpen(t: JstTarget, rep: string, deps: JstDeps, { auto = false }: { auto?: boolean } = {}): Promise<boolean> {
  const payload: Record<string, unknown> = { ...t, rep };
  if (deps.helperUrl) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), JST_TIMEOUT_MS);
    try {
      const r = await deps.fetch(deps.helperUrl + '/open', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: ac.signal,
      });
      clearTimeout(timer);
      if (r.ok) {
        if (!auto) deps.toast('เปิดแชตใน JST แล้ว');
        return true;
      }
    } catch {
      clearTimeout(timer);
    }
  }
  if (deps.urlTemplate) {
    deps.open(deps.urlTemplate.replace(/\{(\w+)\}/g, (_m, k: string) => encodeURIComponent(String(payload[k] ?? ''))));
    return true;
  }
  if (!auto && deps.clipboard) {
    const txt = t.chat || t.phone || '';
    try {
      await deps.clipboard.writeText(txt);
      deps.toast('ยังไม่ได้รันตัวช่วย JST บนเครื่อง · คัดลอกชื่อแชตแล้ว นำไปค้นหาใน JST');
    } catch {
      deps.toast('ยังไม่ได้รันตัวช่วย JST · ค้นหาใน JST ด้วย: ' + txt);
    }
  }
  return false;
}

/** deps จริงในเบราว์เซอร์ (เรียกจาก client component เท่านั้น) */
export function browserJstDeps(toast: (msg: string) => void): JstDeps {
  return {
    helperUrl: JST_HELPER_URL,
    urlTemplate: JST_URL_TEMPLATE,
    fetch: (url, init) => window.fetch(url, init),
    open: (url) => {
      window.open(url, '_blank', 'noopener');
    },
    clipboard: typeof navigator !== 'undefined' ? navigator.clipboard : undefined,
    toast,
  };
}

/* ---------- ตรวจทักแชท ---------- */
export interface ChatCheckOk {
  live: boolean; sessions: ChatSessionJson[]; found: number; count: number; sent: boolean; last: string | null; by: string | null;
}
export type ChatCheckResult = { err: string } | ChatCheckOk;

/** รวมผล dsales_customer_chats (L444-446): นับข้อความฝั่งเซลล์ และหาครั้งล่าสุดที่เซลล์ตอบ */
export function summarizeChats(sessions: ChatSessionJson[]): ChatCheckOk {
  const count = sessions.reduce((s, x) => s + Number(x.admin_msgs || 0), 0);
  const lastS = sessions
    .filter((x) => x.last_admin_time)
    .sort((a, b) => String(b.last_admin_time).localeCompare(String(a.last_admin_time)))[0];
  return { live: true, sessions, found: sessions.length, count, sent: count > 0, last: lastS?.last_admin_time ?? null, by: lastS?.last_admin_sender ?? null };
}

/** L438-447 (ล็อกอินจริง): p_since = เวลาจองดิบจาก server (claimedAtIso) ไม่ใช่เวลาท้องถิ่นที่ตัดเขตเวลาแล้ว */
export async function chatCheckFor(l: Pick<Lead, 'phone' | 'claimedAtIso'>): Promise<ChatCheckResult> {
  try {
    return summarizeChats((await getCustomerChats(l.phone, l.claimedAtIso ?? null)) || []);
  } catch (e) {
    return { err: 'ตรวจไม่สำเร็จ: ' + errorMessage(e) };
  }
}

/** L449-451 (โหมด fixture = โหมดตัวอย่างของ prototype): นับบันทึกแชตในแอปหลังเวลาจอง */
export function localChatCheck(l: Pick<Lead, 'interactions' | 'claimedAt'>, reps: ReadonlyArray<Pick<Rep, 'id' | 'name'>>): ChatCheckOk {
  const since = l.claimedAt || null;
  const chats = l.interactions.filter((i) => i.type === 'chat' && (!since || i.date >= since));
  const last = chats[chats.length - 1];
  return {
    live: false, sessions: [], found: 1, count: chats.length, sent: chats.length > 0,
    last: last?.date ?? null, by: (last && reps.find((r) => r.id === last.rep)?.name) || null,
  };
}

/** ไอคอนของ session (L463): line → line, webchat → other */
export const sessionIcon = (channel: string | null): string =>
  (channel || '').toLowerCase() === 'line' ? 'line' : (channel || 'other').toLowerCase().replace('webchat', 'other');

export interface ChatCheckView {
  badge: { cls: string; text: string };
  detail: string;
  sessions: Array<{ key: string; icon: string; page: string; meta: string }>;
}

/** เนื้อหา #chk-body (renderChatCheck L459-463) */
export function chatCheckView(res: ChatCheckResult, claimedAt: string | null | undefined): ChatCheckView {
  if ('err' in res) return { badge: { cls: 's-lost plain', text: 'ตรวจไม่ได้' }, detail: res.err, sessions: [] };
  const since = claimedAt ? ` หลังจอง (${fmtDT(claimedAt)})` : '';
  const badge = res.sent
    ? { cls: 's-won', text: 'ทักแชทแล้ว' }
    : res.found ? { cls: 's-callback plain', text: 'ยังไม่พบข้อความที่ส่ง' } : { cls: 's-new plain', text: 'ไม่พบแชตใน JST' };
  const detail = res.sent
    ? `เซลล์ส่ง ${res.count} ข้อความ${since} · ล่าสุด ${fmtDT(res.last)}${res.by ? ' โดย ' + res.by : ''}`
    : res.found ? `เซลล์ยังไม่ได้ส่งข้อความ${since}` : 'จับคู่แชตของลูกค้ารายนี้ไม่พบ (จับคู่ด้วยชื่อแชต/ชื่อผู้ซื้อ) ลองตรวจใน JST เอง';
  const sessions = res.sessions.map((x, i) => ({
    key: `${x.ms_id}-${i}`,
    icon: sessionIcon(x.channel),
    page: x.page || x.channel || '',
    meta: `ล่าสุด ${x.last_admin_time ? 'เซลล์ ' + fmtDT(x.last_admin_time) : x.last_time ? fmtDT(x.last_time) : '—'}${x.last_admin_sender ? ' · ' + x.last_admin_sender : ''} · ส่ง ${x.admin_msgs ?? 0}`,
  }));
  return { badge, detail, sessions };
}

/** L458: เก็บผลตรวจลงลีด; dirty = ป้าย "ทักแชทแล้ว" ในตารางต้องเปลี่ยน (ui.dirtyRows) */
export function nextChatCheck(prev: ChatCheck | null | undefined, res: ChatCheckResult, at: string): { chatCheck: ChatCheck; dirty: boolean } | null {
  if ('err' in res) return null;
  return { chatCheck: { at, sent: res.sent, count: res.count }, dirty: !!prev?.sent !== res.sent };
}

/** L470: ลีดของฉันที่จองแล้ว ยังไม่พบว่าทักแชท และไม่ใช่ห้ามโทร สูงสุด 10 ราย */
export const verifyTodo = (leads: ReadonlyArray<Lead>, meId: string): Lead[] =>
  leads.filter((l) => l.owner === meId && l.claimedAt && !l.chatCheck?.sent && !l.noCall).slice(0, 10);

/** L472-478: ตรวจทีละรายตามลำดับ ข้ามรายที่ error คืนเฉพาะรายที่เปลี่ยนจากยังไม่ทักเป็นทักแล้ว */
export async function runVerify(
  todo: ReadonlyArray<Lead>, check: (l: Lead) => Promise<ChatCheckResult>, at: () => string,
): Promise<Array<{ id: string; chatCheck: ChatCheck }>> {
  const changed: Array<{ id: string; chatCheck: ChatCheck }> = [];
  for (const l of todo) {
    const next = nextChatCheck(l.chatCheck, await check(l), at());
    if (next && !l.chatCheck?.sent && next.chatCheck.sent) changed.push({ id: l.id, chatCheck: next.chatCheck });
  }
  return changed;
}
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `npm test`
Expected: `Test Files  17 passed (17)` · `Tests  98 passed (98)`

- [ ] **Step 5: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: typecheck ไม่มี output; lint `✔ No ESLint warnings or errors`

- [ ] **Step 6: Commit**

```bash
git add lib/jst.ts lib/jst.test.ts
git commit -m "feat(web): port JST chat channels, helper/url/clipboard opener and chat-check logic" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: ชิ้นส่วน UI ที่ใช้ร่วมกัน (การ์ดช่วงวันที่, toolbar ลีด, ปุ่มโทร/แชต, badge)

markup / class / ข้อความ / ลำดับ attribute ที่มีผลกับหน้าตา ต้องตรงกับ `legacy/app.js` ตามเลขบรรทัดในคอมเมนต์ (ช่องว่างระหว่าง element ใน flex container ไม่มีผล แต่ช่องว่างในบรรทัดข้อความ เช่น `<dd>เบอร์ <button>` ต้องมีเหมือนเดิม) ทุกปุ่มคง `data-*` เดิมไว้ (`data-act`, `data-id`, `data-chip`, `data-pk` ฯลฯ) เพื่อให้ e2e ใช้ selector เดียวกันทั้งสองฝั่ง Task นี้ไม่มี unit test (Vitest เป็น environment `node`) — ตรวจด้วย typecheck/lint ตอนนี้ และเทียบภาพใน Task 7

**Files:**
- Create: `components/ui/ChIcon.tsx`, `components/ui/CloseButton.tsx`, `components/ui/StatusBadge.tsx`, `components/leads/useJst.ts`, `components/leads/ContactBar.tsx`, `components/leads/PeriodCard.tsx`, `components/leads/LeadToolbar.tsx`
- Modify: `lib/constants.ts`

- [ ] **Step 1: ข้อความโหมด fixture ใน `lib/constants.ts`** — เพิ่มใต้บรรทัด `export const JST_URL_TEMPLATE = …`:

```ts

/** โหมด fixture (next dev เท่านั้น): ปุ่มที่เขียนข้อมูลไม่เรียก RPC เพื่อไม่ให้ id ตัวอย่างวิ่งไป Supabase จริง */
export const FIXTURE_NO_WRITE = 'โหมด fixture: ไม่ได้บันทึกลง Supabase';
```

- [ ] **Step 2: `components/ui/ChIcon.tsx`** (prototype `icon()` L403)

```tsx
import { iconSrc } from '@/lib/icons';
import { platLabel } from '@/lib/jst';

/** ไอคอนช่องทางแชต (data URI จาก lib/icons.ts) */
export function ChIcon({ p, size }: { p: string; size: number }) {
  // data URI ขนาดเล็กแบบเดียวกับ prototype ไม่ต้องผ่าน next/image
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="ch-ico" width={size} height={size} alt={platLabel(p)} src={iconSrc(p)} />;
}
```

- [ ] **Step 3: `components/ui/CloseButton.tsx`** (prototype `X` L393)

```tsx
import { PATHS } from '@/lib/constants';

/** ปุ่ม X ของ popup — ModalRoot ปิด popup เมื่อคลิก [data-close] */
export function CloseButton() {
  return (
    <button className="icon-btn" data-close aria-label="ปิด">
      <svg viewBox="0 0 24 24"><path d={PATHS.close} /></svg>
    </button>
  );
}
```

- [ ] **Step 4: `components/ui/StatusBadge.tsx`** (badge สถานะ L205, ป้ายวันนัด `dueHtml` L186-191)

```tsx
import type { LeadStatus } from '@/lib/api/types';
import { STATUS } from '@/lib/constants';
import { dueInfo } from '@/lib/domain/leads';

export function StatusBadge({ status }: { status: LeadStatus }) {
  return <span className={`badge s-${status}`}>{STATUS[status]}</span>;
}

export function DueTag({ callback, today }: { callback: string | null; today: string }) {
  const d = dueInfo(callback, today);
  return d ? <div className={`due ${d.cls}`}>{d.text}</div> : null;
}
```

- [ ] **Step 5: `components/leads/useJst.ts`** (เปิดแชตด้วยชื่อเซลล์ที่ล็อกอิน L417)

```ts
'use client';

import { useCallback } from 'react';
import { browserJstDeps, jstOpen, type JstTarget } from '@/lib/jst';
import { useActions, useAppState } from '@/lib/state/AppProvider';

export function useJst(): (t: JstTarget, opts?: { auto?: boolean }) => void {
  const { reps, meId } = useAppState();
  const { toast } = useActions();
  const rep = reps.find((r) => r.id === meId)?.name || '';
  return useCallback(
    (t: JstTarget, opts: { auto?: boolean } = {}) => {
      void jstOpen(t, rep, browserJstDeps(toast), opts);
    },
    [rep, toast],
  );
}
```

- [ ] **Step 6: `components/leads/ContactBar.tsx`** (`callBtn` L406 + คลิกโทร L901-904, `chatBtn` L407, `contactBar` L408, `channelRow` L409-411)

```tsx
'use client';

import { ChIcon } from '@/components/ui/ChIcon';
import { PATHS } from '@/lib/constants';
import { chatAria, chatTitle, jstTarget, platLabel, type JstSource, type NormChannel } from '@/lib/jst';
import { useActions } from '@/lib/state/AppProvider';
import { useJst } from './useJst';

/** ปุ่มโทร: เปิดแอปโทร (tel:) พร้อมคัดลอกเบอร์ เผื่อเครื่องคอมไม่มีแอปโทร */
export function CallButton({ phone }: { phone: string }) {
  const { toast } = useActions();
  return (
    <a
      className="ch-btn call"
      href={`tel:${phone}`}
      data-call={phone}
      title={`โทร ${phone}`}
      aria-label={`โทร ${phone}`}
      onClick={() => {
        navigator.clipboard?.writeText(phone).catch(() => {});
        toast(`โทร ${phone} · คัดลอกเบอร์แล้ว`);
      }}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d={PATHS.phone} /></svg>
    </a>
  );
}

function ChatButton({ x, c, size }: { x: JstSource; c: NormChannel; size: number }) {
  const openJst = useJst();
  return (
    <button type="button" className="ch-btn" data-act="jst" title={chatTitle(c)} aria-label={chatAria(c)} onClick={() => openJst(jstTarget(x, c))}>
      <ChIcon p={c.platform} size={size} />
    </button>
  );
}

/** ปุ่มโทร + ปุ่มแชต: ในตาราง (mini) 4 ช่องทาง 16px, ใน popup 8 ช่องทาง 22px */
export function ContactBar({ x, chans, mini = false }: { x: JstSource; chans: NormChannel[]; mini?: boolean }) {
  return (
    <span className={`ch-bar ${mini ? 'mini' : ''}`}>
      <CallButton phone={x.phone} />
      {chans.slice(0, mini ? 4 : 8).map((c, i) => (
        <ChatButton key={`${c.shop}-${i}`} x={x} c={c} size={mini ? 16 : 22} />
      ))}
    </span>
  );
}

/** ช่องทางแชต (แยกตามร้าน) ใน popup รายละเอียดลูกค้า */
export function ChannelRow({ x, chans }: { x: JstSource; chans: NormChannel[] }) {
  const openJst = useJst();
  if (!chans.length) return <span className="sub">ไม่พบช่องทางแชต</span>;
  return (
    <div className="ch-chips">
      {chans.map((c, i) => (
        <button key={`${c.shop}-${i}`} type="button" className="ch-chip" data-act="jst" title="เปิดแชตใน JST" onClick={() => openJst(jstTarget(x, c))}>
          <ChIcon p={c.platform} size={18} />
          <span>{c.shop || platLabel(c.platform)}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 7: `components/leads/PeriodCard.tsx`** (`periodHtml` L57-66, `bindPeriod` L67-78)

```tsx
'use client';

import {
  customPeriod, monthPeriod, monthValue, periodNote, presetPeriod, PRESETS, yearOptions, yearPeriod, yearValue,
} from '@/lib/domain/period';
import type { Period } from '@/lib/state/reducer';
import { useActions, useAppState } from '@/lib/state/AppProvider';

/** การ์ดช่วงวันที่ (ทุกหน้ายกเว้นตั้งค่า) ค่าคงอยู่ข้ามหน้าใน state.ui.period */
export function PeriodCard() {
  const { ui, today } = useAppState();
  const { setUi, dispatch } = useActions();
  const P = ui.period;
  // prototype: เปลี่ยนช่วงแล้วถังลูกค้ากลับไปหน้าแรกและโหลดใหม่ (ui.pool.page = 0, loaded = false)
  const apply = (p: Period) => {
    setUi({ period: p });
    dispatch({ type: 'invalidatePool' });
  };
  return (
    <div className="period card">
      <div className="period-row">
        <b className="sub">ช่วงวันที่</b>
        {PRESETS.map(([k, label]) => (
          <button key={k} type="button" className={`chip ${P.key === k ? 'active' : ''}`} data-pk={k} onClick={() => apply(presetPeriod(k, today))}>
            {label}
          </button>
        ))}
        <input type="month" id="p-month" className="input pin" aria-label="เลือกเดือน" value={monthValue(P)} onChange={(e) => apply(monthPeriod(e.target.value))} />
        <select
          id="p-year"
          className="select"
          aria-label="เลือกปี"
          value={yearValue(P)}
          onChange={(e) => {
            const p = yearPeriod(e.target.value);
            if (p) apply(p);
          }}
        >
          <option value="">ปี…</option>
          {yearOptions(today).map((v) => (
            <option key={v} value={String(v)}>{v}</option>
          ))}
        </select>
        <input type="date" id="p-from" className="input pin" aria-label="ตั้งแต่วันที่" value={P.from} onChange={(e) => apply(customPeriod(e.target.value, P.to))} />
        <span className="sub">ถึง</span>
        <input type="date" id="p-to" className="input pin" aria-label="ถึงวันที่" value={P.to} onChange={(e) => apply(customPeriod(P.from, e.target.value))} />
      </div>
      <div className="sub">{periodNote(P)}</div>
    </div>
  );
}
```

- [ ] **Step 8: `components/leads/LeadToolbar.tsx`** (`toolbar` L219-235, `bindToolbar` L236-243)

```tsx
'use client';

import { useMemo } from 'react';
import type { Lead } from '@/lib/api/types';
import { PATHS } from '@/lib/constants';
import { CHIP_DOT, chipLabel, statusCounts, STATUS_CHIPS, type SortKey } from '@/lib/domain/leads';
import { useActions, useAppState } from '@/lib/state/AppProvider';

/**
 * toolbar ลีด: ค้นหา (กรองทุกตัวอักษร ไม่ debounce — input เดิมไม่ถูกสร้างใหม่ focus/caret จึงอยู่ที่เดิม),
 * ชิปสถานะพร้อมจำนวน (นับจาก base ที่ผ่านช่วงวันที่), แคมเปญ (หน้า Direct Sale), เรียง, เซลล์ (หัวหน้า)
 */
export function LeadToolbar({ base, withCampSelect }: { base: Lead[]; withCampSelect: boolean }) {
  const { ui, today, isAdmin, reps, campaigns } = useAppState();
  const { setUi } = useActions();
  const counts = useMemo(() => statusCounts(base, ui.period, today), [base, ui.period, today]);
  return (
    <div className="toolbar">
      <label className="search" htmlFor="q">
        <svg viewBox="0 0 24 24"><path d={PATHS.search} /></svg>
        <input id="q" type="search" placeholder="ค้นหา ชื่อ, เบอร์, เลขบิล, ร้านค้า" value={ui.q} onChange={(e) => setUi({ q: e.target.value })} />
      </label>
      {STATUS_CHIPS.map((s) => (
        <button key={s} className={`chip ${ui.status === s ? 'active' : ''}`} data-chip={s} onClick={() => setUi({ status: s })}>
          {s === 'all' ? null : <i className="dot" style={{ background: CHIP_DOT[s] }} />}
          {chipLabel(s)} ({counts[s]})
        </button>
      ))}
      {withCampSelect ? (
        <select id="camp-sel" className="select" aria-label="แคมเปญ" value={ui.camp} onChange={(e) => setUi({ camp: e.target.value })}>
          <option value="all">แคมเปญทั้งหมด</option>
          <option value="self">เซลล์ขุดเอง</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      ) : null}
      <select id="sort-sel" className="select" aria-label="เรียงตาม" value={ui.sort} onChange={(e) => setUi({ sort: e.target.value as SortKey })}>
        <option value="due">เรียง: วันนัดใกล้สุด</option>
        <option value="spend">เรียง: ยอดซื้อสูงสุด</option>
        <option value="none">เรียง: ตามเดิม</option>
      </select>
      {isAdmin ? (
        <select id="rep-sel" className="select" aria-label="เซลล์" value={ui.rep} onChange={(e) => setUi({ rep: e.target.value })}>
          <option value="all">เซลล์ทุกคน</option>
          {reps.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 9: Typecheck + lint + test**

Run: `npm run typecheck && npm run lint && npm test`
Expected: typecheck ไม่มี output; lint `✔ No ESLint warnings or errors`; `Test Files  17 passed (17)` · `Tests  98 passed (98)`

- [ ] **Step 10: Commit**

```bash
git add lib/constants.ts components/ui components/leads
git commit -m "feat(web): add period card, lead toolbar, call/chat buttons and status badges with prototype markup" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: popup A–D (รายละเอียดลูกค้า, บันทึกโทร/แชต, ยืนยันยกเลิกจอง, เลือกจากถัง)

ทำก่อนตาราง (Task 6) เพราะปุ่มในตารางเปิด popup เหล่านี้ popup ทุกตัวอ่านลีดจาก `useAppState()` ด้วย id (จึงวาดใหม่เองเมื่อลีดเปลี่ยน เช่นประวัติซื้อโหลดเสร็จ) และเขียนข้อมูลผ่าน `lib/api/rpc.ts` → `upsertLead` → `invalidatePool` → toast; error → `toastError`

**Files:**
- Create: `lib/domain/log.ts`, `components/modals/ChatCheckBody.tsx`, `components/modals/CustomerModal.tsx`, `components/modals/LogModal.tsx`, `components/modals/ConfirmUnclaimModal.tsx`, `components/modals/PickFromBucketModal.tsx`
- Test: `lib/domain/log.test.ts`, `lib/api/rpc.test.ts`

- [ ] **Step 1: เขียน test ที่ยังไม่ผ่าน**

`lib/domain/log.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Lead } from '@/lib/api/types';
import { fixturePayload } from '@/lib/fixtures/load';
import { buildLogSave, initialLogForm, LOG_WARN, logSections, logStatusOptions, splitBills, validateLog } from './log';

const F = fixturePayload();
const T = F.today;
const byId = (id: string): Lead => {
  const l = F.leads.find((x) => x.id === id);
  if (!l) throw new Error(`fixture lead ${id} is missing`);
  return l;
};
const base = initialLogForm(byId('L1000'), 'call', T);

describe('log modal (prototype logModal L524-600)', () => {
  it('initial values follow the lead', () => {
    expect(initialLogForm(byId('L1014'), 'call', T)).toEqual({
      type: 'call', result: 'คุยแล้ว', status: 'callback', callback: '', interest: 'เตียงนอนเด็ก', bills: '', amount: '', closed: '2026-11-04', note: '',
    });
    expect(initialLogForm(byId('L1019'), 'call', T)).toMatchObject({ status: 'callback', callback: '2026-11-06', interest: 'แผ่นรองคลาน' });
    expect(base).toMatchObject({ type: 'call', result: 'คุยแล้ว', status: 'following', interest: '' });
    expect(initialLogForm(byId('L1011'), 'call', T)).toMatchObject({ type: 'chat', result: 'ตอบกลับแล้ว', status: 'following', interest: 'ทรายแมว' });
    expect(initialLogForm(byId('L1012'), 'call', T)).toMatchObject({ status: 'won', bills: '369295', amount: '3290', closed: '2026-10-31' });
  });
  it('status options: every status except new, plus dnc/release unless the lead is no-call', () => {
    expect(logStatusOptions(false)).toEqual([
      ['following', 'กำลังติดตาม'], ['callback', 'รอติดต่อ'], ['won', 'ปิดการขายแล้ว'], ['lost', 'ไม่สนใจ'], ['unreachable', 'ติดต่อไม่ได้'],
      ['dnc', 'ไม่สะดวกให้โทร (ติดต่อทางแชตเท่านั้น)'], ['release', 'คัดออก (คืนให้คนอื่นโทร)'],
    ]);
    expect(logStatusOptions(true).map(([v]) => v)).toEqual(['following', 'callback', 'won', 'lost', 'unreachable']);
  });
  it('sections shown per status (cbToggle L550)', () => {
    expect(logSections('callback')).toEqual({ callback: true, won: false, warn: '' });
    expect(logSections('won')).toEqual({ callback: false, won: true, warn: '' });
    expect(logSections('following')).toEqual({ callback: false, won: false, warn: '' });
    expect(logSections('dnc').warn).toBe(LOG_WARN.dnc);
    expect(LOG_WARN.dnc).toBe('ลูกค้ารายนี้จะถูกทำเครื่องหมายห้ามโทรถาวร คุณติดต่อได้ทางแชตเท่านั้น (ยังเห็นในหน้า Direct Sale ของคุณ) เซลล์คนอื่นจะไม่เห็นลูกค้ารายนี้ และหัวหน้าเห็นในถังไม่สะดวกให้โทร');
    expect(logSections('release').warn).toBe('ลูกค้ารายนี้จะออกจากรายการของคุณและกลับเข้าถังให้เซลล์คนอื่นโทร คุณจะไม่เห็นลูกค้ารายนี้อีก');
  });
  it('splitBills splits on commas and whitespace', () => {
    expect(splitBills('312345, 312399  312400,,')).toEqual(['312345', '312399', '312400']);
    expect(splitBills(' , ')).toEqual([]);
  });
  it('validateLog checks in the prototype order and names the field to focus', () => {
    expect(validateLog({ ...base, status: 'callback', callback: '' }, T)).toEqual({ msg: 'เลือกวันที่นัดติดต่อก่อนบันทึก', field: 'callback' });
    expect(validateLog({ ...base, status: 'callback', callback: '2026-11-03' }, T)).toEqual({ msg: 'วันที่นัดติดต่อต้องไม่ย้อนหลัง', field: 'callback' });
    expect(validateLog({ ...base, status: 'callback', callback: '2026-11-04' }, T)).toBeNull();
    expect(validateLog({ ...base, status: 'dnc', note: '   ' }, T)).toEqual({ msg: 'ใส่เหตุผลในหมายเหตุก่อนบันทึก', field: 'note' });
    expect(validateLog({ ...base, status: 'release', note: '' }, T)?.field).toBe('note');
    expect(validateLog({ ...base, status: 'won', bills: ' , ' }, T)).toEqual({ msg: 'ใส่เลขบิลที่ขายได้ก่อนปิดการขาย', field: 'bills' });
    expect(validateLog({ ...base, status: 'won', bills: '312345' }, T)).toBeNull();
    expect(validateLog(base, T)).toBeNull();
  });
  it('buildLogSave maps the form to dsales_log arguments (live save L567-572)', () => {
    const l = { id: 'L1', status: 'new' as const };
    expect(buildLogSave({ ...base, note: '  ', interest: ' ทรายแมว ', callback: '2026-11-09' }, l)).toEqual({
      input: { leadId: 'L1', type: 'call', result: 'คุยแล้ว', note: '(ไม่มีหมายเหตุ)', status: 'following', callback: null, interest: 'ทรายแมว', bills: [], amount: null },
      then: null, msg: 'บันทึกแล้ว',
    });
    expect(buildLogSave({ ...base, status: 'callback', callback: '2026-11-09', bills: '1', amount: '50' }, l).input)
      .toMatchObject({ status: 'callback', callback: '2026-11-09', bills: [], amount: null });
    expect(buildLogSave({ ...base, status: 'won', bills: '312345, 312399', amount: '4990', note: 'ปิดได้' }, l).input)
      .toMatchObject({ status: 'won', bills: ['312345', '312399'], amount: 4990, note: 'ปิดได้' });
    expect(buildLogSave({ ...base, status: 'won', bills: '1', amount: '' }, l).input.amount).toBeNull();
  });
  it('buildLogSave: dnc keeps the previous status, release returns the lead to the pool', () => {
    expect(buildLogSave({ ...base, status: 'dnc', note: 'ลูกค้าขอ' }, { id: 'L1', status: 'new' })).toEqual({
      input: { leadId: 'L1', type: 'call', result: 'ไม่สะดวกให้โทร', note: 'ลูกค้าขอ', status: 'following', callback: null, interest: '', bills: [], amount: null },
      then: 'dnc', msg: 'ทำเครื่องหมายห้ามโทรแล้ว ติดต่อลูกค้ารายนี้ทางแชตเท่านั้น',
    });
    expect(buildLogSave({ ...base, status: 'dnc', note: 'x' }, { id: 'L1', status: 'callback' }).input.status).toBe('callback');
    expect(buildLogSave({ ...base, status: 'release', note: 'โทรไม่ติด 5 ครั้ง' }, { id: 'L1', status: 'following' })).toMatchObject({
      input: { status: 'new', result: 'คัดออก', note: 'โทรไม่ติด 5 ครั้ง' }, then: 'release', msg: 'คัดออกแล้ว ลูกค้ากลับเข้าถังให้เซลล์คนอื่นโทร',
    });
  });
});
```

ใน `lib/api/rpc.test.ts` แก้บรรทัด import

```ts
import { addMember, claimCustomer, getBaseCustomers, getMe } from './rpc';
```

เป็น

```ts
import { addMember, claimCustomer, getBaseCustomers, getMe, logContact } from './rpc';
```

และเพิ่ม test นี้ใน `describe('rpc wrappers', …)` ก่อน `});` บรรทัดสุดท้าย:

```ts
  it('logContact passes the dsales_log arguments of the prototype (L572)', async () => {
    rpc.mockResolvedValue({ data: { id: 'L1' }, error: null });
    await logContact({ leadId: 'L1', type: 'chat', result: 'ตอบกลับแล้ว', note: 'n', status: 'won', callback: null, interest: 'i', bills: ['1'], amount: 990 });
    expect(rpc).toHaveBeenCalledWith('dsales_log', {
      p_lead: 'L1', p_type: 'chat', p_result: 'ตอบกลับแล้ว', p_note: 'n', p_status: 'won', p_callback: null, p_interest: 'i', p_bills: ['1'], p_amount: 990,
    });
  });
```

- [ ] **Step 2: รัน test ให้เห็นว่าไม่ผ่าน**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./log" from "lib/domain/log.test.ts". Does the file exist?` สรุป `Test Files  1 failed | 17 passed (18)` · `Tests  99 passed (99)` (test ใหม่ของ `rpc.test.ts` ผ่านทันทีเพราะ wrapper `logContact` มีอยู่แล้วจากแผน A — เป็น regression test ของอาร์กิวเมนต์ที่ popup ใช้; wrapper อื่นที่ popup ใช้ `setNoCall`, `unclaimLead`, `getCustomerPurchases` ก็มีแล้ว ไม่ต้องเพิ่ม)

- [ ] **Step 3: `lib/domain/log.ts`**

```ts
import type { LogInput } from '@/lib/api/rpc';
import type { ContactType, Lead, LeadStatus } from '@/lib/api/types';
import { STATUS } from '@/lib/constants';

// ฟอร์ม popup บันทึกโทร/แชต (legacy/app.js L524-579) เป็นฟังก์ชันล้วน

export const LOG_RESULTS: Readonly<Record<ContactType, readonly string[]>> = {
  call: ['คุยแล้ว', 'ไม่รับสาย', 'สายไม่ว่าง', 'เบอร์ผิด'],
  chat: ['ตอบกลับแล้ว', 'อ่านแล้วไม่ตอบ', 'ส่งโปรโมชันแล้ว'],
};

export type LogStatus = Exclude<LeadStatus, 'new'> | 'dnc' | 'release';

export const LOG_WARN: Readonly<Partial<Record<LogStatus, string>>> = {
  dnc: 'ลูกค้ารายนี้จะถูกทำเครื่องหมายห้ามโทรถาวร คุณติดต่อได้ทางแชตเท่านั้น (ยังเห็นในหน้า Direct Sale ของคุณ) เซลล์คนอื่นจะไม่เห็นลูกค้ารายนี้ และหัวหน้าเห็นในถังไม่สะดวกให้โทร',
  release: 'ลูกค้ารายนี้จะออกจากรายการของคุณและกลับเข้าถังให้เซลล์คนอื่นโทร คุณจะไม่เห็นลูกค้ารายนี้อีก',
};

export interface LogForm {
  type: ContactType; result: string; status: LogStatus; callback: string; interest: string;
  bills: string; amount: string; closed: string; note: string;
}

type LogLead = Pick<Lead, 'noCall' | 'status' | 'callback' | 'interest' | 'closedBills' | 'closedAmount' | 'closedAt'>;

/** ค่าเริ่มของฟอร์ม (L527, L537-542): ห้ามโทร → แชตเท่านั้น; ลีดใหม่ → กำลังติดตาม; วันนัดเดิมที่ยังไม่ผ่าน */
export function initialLogForm(l: LogLead, type: ContactType, today: string): LogForm {
  const t: ContactType = l.noCall ? 'chat' : type;
  return {
    type: t,
    result: LOG_RESULTS[t][0],
    status: l.status === 'new' ? 'following' : l.status,
    callback: l.callback && l.callback >= today ? l.callback : '',
    interest: l.interest || '',
    bills: (l.closedBills || []).join(', '),
    amount: l.closedAmount == null ? '' : String(l.closedAmount),
    closed: l.closedAt || today,
    note: '',
  };
}

/** ตัวเลือก "สถานะลูกค้าหลังบันทึก" (L536-537) */
export function logStatusOptions(noCall: boolean): Array<[LogStatus, string]> {
  const statuses = (Object.keys(STATUS) as LeadStatus[])
    .filter((k): k is Exclude<LeadStatus, 'new'> => k !== 'new')
    .map((k): [LogStatus, string] => [k, STATUS[k]]);
  if (noCall) return statuses;
  return [...statuses, ['dnc', 'ไม่สะดวกให้โทร (ติดต่อทางแชตเท่านั้น)'], ['release', 'คัดออก (คืนให้คนอื่นโทร)']];
}

/** ส่วนของฟอร์มที่แสดงตามสถานะ (cbToggle L550): วันนัด, ข้อมูลปิดการขาย, คำเตือน (+ "* ใส่เหตุผล") */
export const logSections = (status: LogStatus): { callback: boolean; won: boolean; warn: string } => ({
  callback: status === 'callback', won: status === 'won', warn: LOG_WARN[status] ?? '',
});

export const splitBills = (s: string): string[] => s.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);

export type LogField = 'callback' | 'note' | 'bills';

/** ตรวจก่อนบันทึก ตามลำดับเดียวกับ prototype (L558-563) */
export function validateLog(f: LogForm, today: string): { msg: string; field: LogField } | null {
  if (f.status === 'callback' && !f.callback) return { msg: 'เลือกวันที่นัดติดต่อก่อนบันทึก', field: 'callback' };
  if (f.status === 'callback' && f.callback < today) return { msg: 'วันที่นัดติดต่อต้องไม่ย้อนหลัง', field: 'callback' };
  if ((f.status === 'dnc' || f.status === 'release') && !f.note.trim()) return { msg: 'ใส่เหตุผลในหมายเหตุก่อนบันทึก', field: 'note' };
  if (f.status === 'won' && !splitBills(f.bills).length) return { msg: 'ใส่เลขบิลที่ขายได้ก่อนปิดการขาย', field: 'bills' };
  return null;
}

export interface LogSave { input: LogInput; then: 'dnc' | 'release' | null; msg: string }

/**
 * แปลงฟอร์มเป็นอาร์กิวเมนต์ dsales_log (L567-575): dnc = สถานะเดิม (ใหม่ → กำลังติดตาม) + ผล "ไม่สะดวกให้โทร" แล้วตั้งห้ามโทร,
 * release = สถานะใหม่ + ผล "คัดออก" แล้วยกเลิกจอง; วันที่ปิดการขาย (#f-closed) ไม่ส่ง (เหมือน prototype)
 */
export function buildLogSave(f: LogForm, lead: Pick<Lead, 'id' | 'status'>): LogSave {
  let status: LeadStatus;
  let result = f.result;
  if (f.status === 'dnc') {
    status = lead.status === 'new' ? 'following' : lead.status;
    result = 'ไม่สะดวกให้โทร';
  } else if (f.status === 'release') {
    status = 'new';
    result = 'คัดออก';
  } else {
    status = f.status;
  }
  const won = status === 'won';
  return {
    input: {
      leadId: lead.id, type: f.type, result, note: f.note.trim() || '(ไม่มีหมายเหตุ)', status,
      callback: f.status === 'callback' ? f.callback : null, interest: f.interest.trim(),
      bills: won ? splitBills(f.bills) : [], amount: won && f.amount !== '' ? Number(f.amount) : null,
    },
    then: f.status === 'dnc' || f.status === 'release' ? f.status : null,
    msg: f.status === 'dnc' ? 'ทำเครื่องหมายห้ามโทรแล้ว ติดต่อลูกค้ารายนี้ทางแชตเท่านั้น'
      : f.status === 'release' ? 'คัดออกแล้ว ลูกค้ากลับเข้าถังให้เซลล์คนอื่นโทร' : 'บันทึกแล้ว',
  };
}
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `npm test`
Expected: `Test Files  18 passed (18)` · `Tests  106 passed (106)`

- [ ] **Step 5: `components/modals/ChatCheckBody.tsx`** (`renderChatCheck` L453-465 + `ui.dirtyRows` L392, L458)

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { ChIcon } from '@/components/ui/ChIcon';
import type { ChatCheck, Lead } from '@/lib/api/types';
import { nowStamp } from '@/lib/format';
import { chatCheckFor, chatCheckView, localChatCheck, nextChatCheck, type ChatCheckView } from '@/lib/jst';
import { useActions, useAppState } from '@/lib/state/AppProvider';

/**
 * เนื้อหา #chk-body: ตรวจใหม่ทุกครั้งที่ runKey เปลี่ยน (prototype ตรวจใหม่ทุกครั้งที่วาด popup: เปิด, สลับแท็บ, ประวัติซื้อโหลดเสร็จ, กดตรวจอีกครั้ง)
 * ผลตรวจเก็บไว้ใน ref แล้ว patchLead ตอน popup ปิด เฉพาะเมื่อ "ทักแชทแล้ว" เปลี่ยน = ui.dirtyRows (ตารางวาดใหม่ตอนปิด popup)
 */
export function ChatCheckBody({ lead, runKey }: { lead: Lead; runKey: string }) {
  const { live, reps, today } = useAppState();
  const { patchLead } = useActions();
  const [view, setView] = useState<ChatCheckView | null>(null);
  const box = useRef<{ dirty: boolean; pending: ChatCheck | null }>({ dirty: false, pending: null });

  useEffect(() => {
    let alive = true;
    setView(null);
    const run = live ? chatCheckFor(lead) : Promise.resolve(localChatCheck(lead, reps));
    void run.then((res) => {
      if (!alive) return;
      const b = box.current;
      const next = nextChatCheck(b.pending ?? lead.chatCheck, res, nowStamp(new Date(), today));
      if (next) {
        b.pending = next.chatCheck;
        if (next.dirty) b.dirty = true;
      }
      setView(chatCheckView(res, lead.claimedAt));
    });
    return () => {
      alive = false;
    };
    // ตรวจตาม runKey เท่านั้น (ไม่ตรวจซ้ำทุกครั้งที่ลีดใน state เปลี่ยน)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey]);

  useEffect(() => {
    const b = box.current;
    const id = lead.id;
    return () => {
      if (b.dirty && b.pending) patchLead(id, { chatCheck: b.pending });
    };
  }, [lead.id, patchLead]);

  return (
    <div id="chk-body">
      {view ? (
        <>
          <span className={`badge ${view.badge.cls}`}>{view.badge.text}</span>{' '}
          <span>{view.detail}</span>
          {view.sessions.length ? (
            <ul className="chk-list">
              {view.sessions.map((s) => (
                <li key={s.key}>
                  <ChIcon p={s.icon} size={16} /> <b>{s.page}</b> <span className="sub">{s.meta}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <span className="sub">กำลังตรวจจาก JST…</span>
      )}
    </div>
  );
}
```

- [ ] **Step 6: `components/modals/LogModal.tsx`** (popup B, `logModal` L524-600)

```tsx
'use client';

import { useRef, useState, type FormEvent } from 'react';
import { CloseButton } from '@/components/ui/CloseButton';
import { logContact, setNoCall, unclaimLead } from '@/lib/api/rpc';
import type { ContactType, Lead } from '@/lib/api/types';
import { FIXTURE_NO_WRITE } from '@/lib/constants';
import {
  buildLogSave, initialLogForm, LOG_RESULTS, logSections, logStatusOptions, validateLog, type LogField, type LogForm, type LogStatus,
} from '@/lib/domain/log';
import { useActions, useAppState } from '@/lib/state/AppProvider';

export function LogModal({ id, type }: { id: string; type: ContactType }) {
  const { leads } = useAppState();
  const l = leads.find((x) => x.id === id);
  return l ? <LogFormView lead={l} type={type} /> : null;
}

function LogFormView({ lead: l, type }: { lead: Lead; type: ContactType }) {
  const { today, live } = useAppState();
  const { closeModal, toast, toastError, upsertLead, dispatch } = useActions();
  const [f, setF] = useState<LogForm>(() => initialLogForm(l, type, today));
  const [prevStatus] = useState(l.status);
  const busy = useRef(false);
  const cbRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const billsRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<LogForm>) => setF((x) => ({ ...x, ...patch }));
  const sec = logSections(f.status);
  const focusField = (field: LogField) => ({ callback: cbRef, note: noteRef, bills: billsRef })[field].current?.focus();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const bad = validateLog(f, today);
    if (bad) {
      toast(bad.msg);
      focusField(bad.field);
      return;
    }
    if (!live) {
      toast(FIXTURE_NO_WRITE);
      return;
    }
    if (busy.current) return;
    busy.current = true;
    const plan = buildLogSave(f, { id: l.id, status: prevStatus });
    try {
      upsertLead(await logContact(plan.input));
      if (plan.then === 'dnc') upsertLead(await setNoCall(l.id, true));
      if (plan.then === 'release') upsertLead(await unclaimLead(l.id));
      closeModal();
      dispatch({ type: 'invalidatePool' });
      toast(plan.msg);
    } catch (err) {
      toastError(err);
    } finally {
      busy.current = false;
    }
  }

  return (
    <>
      <div className="modal-h"><h3>บันทึก · {l.name}</h3><CloseButton /></div>
      <form id="log-form" noValidate onSubmit={onSubmit}>
        <div className="modal-b">
          {l.noCall ? <div className="warn">ลูกค้ารายนี้ไม่สะดวกให้โทร ติดต่อได้ทางแชตเท่านั้น</div> : null}
          <div className="field">
            <label>ช่องทาง</label>
            <div className="seg" id="seg">
              <button
                type="button"
                data-t="call"
                className={f.type === 'call' ? 'active' : ''}
                disabled={!!l.noCall}
                title={l.noCall ? 'ลูกค้ารายนี้ห้ามโทร ติดต่อทางแชตเท่านั้น' : undefined}
                onClick={() => set({ type: 'call', result: LOG_RESULTS.call[0] })}
              >
                โทร
              </button>
              <button type="button" data-t="chat" className={f.type === 'chat' ? 'active' : ''} onClick={() => set({ type: 'chat', result: LOG_RESULTS.chat[0] })}>
                แชต
              </button>
            </div>
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="f-res">ผลการติดต่อ</label>
              <select className="select" id="f-res" value={f.result} onChange={(e) => set({ result: e.target.value })}>
                {LOG_RESULTS[f.type].map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-status">สถานะลูกค้าหลังบันทึก</label>
              <select className="select" id="f-status" value={f.status} onChange={(e) => set({ status: e.target.value as LogStatus })}>
                {logStatusOptions(!!l.noCall).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>
            <div className="field wide" id="cb-wrap" hidden={!sec.callback}>
              <label htmlFor="f-cb">วันที่นัดติดต่อ <span className="req">*</span></label>
              <input className="input" type="date" id="f-cb" ref={cbRef} min={today} value={f.callback} onChange={(e) => set({ callback: e.target.value })} />
            </div>
            <div className="field wide">
              <label htmlFor="f-interest">สินค้าที่ลูกค้าสนใจ</label>
              <input className="input" id="f-interest" value={f.interest} placeholder="เช่น เตียงนอนเด็ก, ทรายแมว" onChange={(e) => set({ interest: e.target.value })} />
            </div>
            <div className="field wide" id="won-wrap" hidden={!sec.won}>
              <label htmlFor="f-bills">เลขบิลที่ขายได้ (อ้างอิงตอนผูกข้อมูล คั่นหลายบิลด้วยจุลภาค)</label>
              <input className="input" id="f-bills" ref={billsRef} value={f.bills} placeholder="เช่น 312345, 312399" onChange={(e) => set({ bills: e.target.value })} />
              <label htmlFor="f-amount" style={{ marginTop: 8 }}>ยอดที่ปิดได้ (บาท)</label>
              <input className="input" id="f-amount" type="number" min="0" step="1" value={f.amount} onChange={(e) => set({ amount: e.target.value })} />
              <label htmlFor="f-closed" style={{ marginTop: 8 }}>วันที่ปิดการขาย</label>
              <input className="input" id="f-closed" type="date" value={f.closed} onChange={(e) => set({ closed: e.target.value })} />
            </div>
            <div className="field wide" id="warn-wrap" hidden={!sec.warn}>
              <div className="warn" id="warn-text">{sec.warn}</div>
            </div>
            <div className="field wide">
              <label htmlFor="f-note">หมายเหตุ <span className="req" id="note-req" hidden={!sec.warn}>* ใส่เหตุผล</span></label>
              <textarea className="textarea" id="f-note" ref={noteRef} placeholder="สรุปสิ่งที่คุยกับลูกค้า" value={f.note} onChange={(e) => set({ note: e.target.value })} />
            </div>
          </div>
        </div>
        <div className="modal-f">
          <button type="button" className="btn" data-close>ยกเลิก</button>
          <button className="btn primary">บันทึก</button>
        </div>
      </form>
    </>
  );
}
```

- [ ] **Step 7: `components/modals/CustomerModal.tsx`** (popup A, `customerModal` L481-522)

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { ChannelRow, ContactBar } from '@/components/leads/ContactBar';
import { CloseButton } from '@/components/ui/CloseButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { mapPurchase } from '@/lib/api/map';
import { getCustomerPurchases } from '@/lib/api/rpc';
import type { Lead } from '@/lib/api/types';
import { BRAND, PATHS } from '@/lib/constants';
import { repName, total } from '@/lib/domain/leads';
import { baht, fmtDate, fmtDT } from '@/lib/format';
import { channelsOf } from '@/lib/jst';
import { useActions, useAppState } from '@/lib/state/AppProvider';
import { ChatCheckBody } from './ChatCheckBody';
import { LogModal } from './LogModal';

type Tab = 'buy' | 'talk';

export function CustomerModal({ id }: { id: string }) {
  const { leads } = useAppState();
  const l = leads.find((x) => x.id === id);
  return l ? <CustomerDetail lead={l} /> : null;
}

function CustomerDetail({ lead: l }: { lead: Lead }) {
  const { live, reps } = useAppState();
  const { openModal, patchLead, toast } = useActions();
  const [tab, setTab] = useState<Tab>('buy');
  const [checks, setChecks] = useState(0);
  const refreshRef = useRef<HTMLButtonElement>(null);
  const loading = useRef(false);

  // ล็อกอินจริง: โหลดประวัติซื้อครั้งแรกที่เปิด แล้ว popup วาดใหม่เอง (L483)
  useEffect(() => {
    if (!live || l._pl || loading.current) return;
    loading.current = true;
    patchLead(l.id, { _pl: 'loading' });
    getCustomerPurchases(l.phone).then(
      (rows) => patchLead(l.id, { purchases: (rows || []).map(mapPurchase), _pl: 'done' }),
      () => patchLead(l.id, { _pl: 'done' }),
    );
  }, [live, l.id, l.phone, l._pl, patchLead]);

  const chans = channelsOf(l);
  const lastBuy = l.lastBuy || l.purchases[0]?.date;
  const hist = [...l.interactions].sort((a, b) => b.date.localeCompare(a.date));
  const logType = l.noCall ? 'chat' : 'call';
  // prototype สลับแท็บด้วยการเปิด popup ใหม่ → โฟกัสปุ่มแรก (#chk-refresh) และตรวจแชตใหม่
  const switchTab = (t: Tab) => {
    setTab(t);
    refreshRef.current?.focus();
  };
  const copyPhone = () => {
    navigator.clipboard?.writeText(l.phone).then(() => toast('คัดลอกเบอร์แล้ว'), () => toast(l.phone));
  };

  return (
    <>
      <div className="modal-h">
        <h3>{l.name}</h3>
        <StatusBadge status={l.status} />
        <span className={`tag ${l.brand === 'bebeplay' ? 'bebe' : 'host'}`}>{BRAND[l.brand]}</span>
        <ContactBar x={l} chans={chans} />
        <CloseButton />
      </div>
      <div className="modal-b">
        <dl className="info-grid" style={{ margin: 0 }}>
          <div><dt>ชื่อ</dt><dd>{l.name}</dd></div>
          <div>
            <dt>เบอร์</dt>
            <dd className="mono">{l.phone}{' '}<button className="copy" data-copy={l.phone} onClick={copyPhone}>คัดลอก</button></dd>
          </div>
          <div className="wide"><dt>ที่อยู่</dt><dd>{l.address}</dd></div>
          <div><dt>วันที่ซื้อล่าสุด</dt><dd>{fmtDate(lastBuy)}</dd></div>
          <div><dt>ยอดซื้อรวม</dt><dd className="num">{baht(total(l))}</dd></div>
          <div><dt>ร้านค้า</dt><dd>{l.shop}</dd></div>
          <div><dt>ผู้ดูแล</dt><dd>{repName(reps, l.owner) || '—'}</dd></div>
          <div><dt>สินค้าที่สนใจ</dt><dd>{l.interest || '—'}</dd></div>
          <div><dt>เลขบิลที่ปิดได้</dt><dd className="mono">{l.closedBills.length ? l.closedBills.join(', ') : '—'}</dd></div>
          <div><dt>วันที่ปิดการขาย</dt><dd>{l.closedAt ? fmtDate(l.closedAt) : '—'}</dd></div>
          <div className="wide"><dt>ช่องทางแชต (แยกตามร้าน)</dt><dd><ChannelRow x={l} chans={chans} /></dd></div>
        </dl>
        <div className="chk">
          <div className="chk-h">
            <b>การทักแชท (ตรวจจาก JST)</b>
            <button type="button" className="btn sm" id="chk-refresh" ref={refreshRef} onClick={() => setChecks((n) => n + 1)}>ตรวจอีกครั้ง</button>
          </div>
          <ChatCheckBody lead={l} runKey={`${tab}|${l._pl === 'done'}|${checks}`} />
        </div>
        <div className="tabs" role="tablist">
          <button className={`tab ${tab === 'buy' ? 'active' : ''}`} data-tab="buy" onClick={() => switchTab('buy')}>
            ประวัติการซื้อ ({l.purchases.length || l.orders || 0})
          </button>
          <button className={`tab ${tab === 'talk' ? 'active' : ''}`} data-tab="talk" onClick={() => switchTab('talk')}>
            ประวัติการโทร/แชต ({l.interactions.length})
          </button>
        </div>
        {tab === 'buy' ? (
          <div className="mini-table table-wrap">
            <table>
              <thead><tr><th>วัน/เดือน/ปี</th><th>SKU</th><th>ชื่อสินค้า</th><th className="r">ยอดซื้อ</th></tr></thead>
              <tbody>
                {l.purchases.map((p, i) => (
                  <tr key={`${p.bill}-${i}`}>
                    <td>{fmtDate(p.date)}</td>
                    <td className="mono">{p.sku}</td>
                    <td>{p.product}<div className="sub">บิล {p.bill} · ขายโดย {repName(reps, p.seller) || '—'}</div></td>
                    <td className="r num">{baht(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : hist.length ? (
          <ul className="timeline">
            {hist.map((i) => (
              <li key={i.id}>
                <span className={`feed-ic ${i.type}`}><svg viewBox="0 0 24 24"><path d={i.type === 'call' ? PATHS.phone : PATHS.chat} /></svg></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="tl-head">
                    <b>{i.type === 'call' ? 'โทร' : 'แชต'}</b>
                    <span className="sub">{fmtDT(i.date)} · {repName(reps, i.rep) || ''}</span>
                    <span className="tag">{i.result}</span>
                    {i.due ? <span className="tag s-callback">นัดติดต่อ {fmtDate(i.due)}</span> : null}
                  </div>
                  <div className="tl-note">{i.note}</div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty">ยังไม่เคยติดต่อลูกค้ารายนี้</div>
        )}
      </div>
      <div className="modal-f">
        <button className="btn primary" data-log={logType} onClick={() => openModal(<LogModal id={l.id} type={logType} />, 'sm')}>
          {l.noCall ? 'บันทึกแชต' : 'บันทึก'}
        </button>
      </div>
    </>
  );
}
```

- [ ] **Step 8: `components/modals/ConfirmUnclaimModal.tsx`** (popup C, `confirmUnclaim` L92-105 ส่วนล็อกอินจริง)

```tsx
'use client';

import { useRef } from 'react';
import { CloseButton } from '@/components/ui/CloseButton';
import { unclaimLead } from '@/lib/api/rpc';
import { FIXTURE_NO_WRITE } from '@/lib/constants';
import { useActions, useAppState } from '@/lib/state/AppProvider';

export function ConfirmUnclaimModal({ id }: { id: string }) {
  const { leads, isAdmin, live } = useAppState();
  const { closeModal, toast, toastError, upsertLead, dispatch } = useActions();
  const busy = useRef(false);
  const l = leads.find((x) => x.id === id);
  if (!l) return null;

  async function onConfirm() {
    if (!live) {
      toast(FIXTURE_NO_WRITE);
      return;
    }
    if (busy.current) return;
    busy.current = true;
    try {
      const nl = await unclaimLead(id);
      // ลีดที่เซลล์ขุดเอง (ไม่มีแคมเปญ) หายจากรายการของเซลล์ (L99)
      if (!nl.campaignId && !isAdmin) dispatch({ type: 'removeLead', id });
      else upsertLead(nl);
      closeModal();
      dispatch({ type: 'invalidatePool' });
      toast('ยกเลิกจองแล้ว');
    } catch (e) {
      toastError(e);
    } finally {
      busy.current = false;
    }
  }

  return (
    <>
      <div className="modal-h"><h3>ยกเลิกจอง?</h3><CloseButton /></div>
      <div className="modal-b">
        <p style={{ margin: 0 }}>ยืนยันยกเลิกการจอง <b>{l.name}</b> ใช่หรือไม่</p>
        <p className="help">ลูกค้าจะกลับเข้าถังให้เซลล์คนอื่นจองได้ ประวัติที่บันทึกไว้ยังอยู่</p>
      </div>
      <div className="modal-f">
        <button className="btn" data-close>ไม่ยกเลิก</button>
        <button className="btn danger solid" id="unclaim-ok" onClick={() => void onConfirm()}>ยืนยันยกเลิกจอง</button>
      </div>
    </>
  );
}
```

- [ ] **Step 9: `components/modals/PickFromBucketModal.tsx`** (popup D, `pickFromBucket` L602-610)

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { CloseButton } from '@/components/ui/CloseButton';
import type { Brand } from '@/lib/constants';
import { useActions } from '@/lib/state/AppProvider';

/** ไม่ให้พิมพ์ข้อมูลเอง: เลือกลูกค้าจากถัง "ลูกค้าทั้งหมด" ของแบรนด์แล้วกด จอง (ถังลูกค้าทำในแผน C) */
export function PickFromBucketModal() {
  const router = useRouter();
  const { setUi, dispatch, closeModal } = useActions();
  const open = (brand: Brand) => {
    setUi({ selCamp: 'ALL', focusSearch: true });
    dispatch({ type: 'invalidatePool' });
    closeModal();
    router.push(`/campaigns/${brand}`);
  };
  return (
    <>
      <div className="modal-h"><h3>เพิ่มลูกค้า</h3><CloseButton /></div>
      <div className="modal-b">
        <p style={{ margin: 0 }}>เลือกลูกค้าจากถัง <b>ลูกค้าทั้งหมด</b> ของแบรนด์ แล้วกด <b>จอง</b> (ไม่ต้องพิมพ์ข้อมูลเอง)</p>
        <p className="help">ค้นหาได้จาก เบอร์โทร, เลขบิลเดิมที่เคยซื้อ, ชื่อแชต หรือชื่อลูกค้า</p>
        <div className="form-grid">
          <button className="btn primary" data-open-bucket="bebeplay" onClick={() => open('bebeplay')}>ถังลูกค้าทั้งหมด Bebeplay</button>
          <button className="btn primary" data-open-bucket="hosttail" onClick={() => open('hosttail')}>ถังลูกค้าทั้งหมด Hosttail</button>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 10: Typecheck + lint + test**

Run: `npm run typecheck && npm run lint && npm test`
Expected: typecheck ไม่มี output; lint `✔ No ESLint warnings or errors`; `Test Files  18 passed (18)` · `Tests  106 passed (106)`

- [ ] **Step 11: Commit**

```bash
git add lib/domain/log.ts lib/domain/log.test.ts lib/api/rpc.test.ts components/modals
git commit -m "feat(web): add customer detail, call/chat log, unclaim confirm and pick-from-bucket popups" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: ตารางลีด + หน้า `/leads` + ตรวจทักแชทอัตโนมัติ

**Files:**
- Create: `components/leads/useLeadActions.tsx`, `components/leads/useVerifyMine.ts`, `components/leads/LeadTable.tsx`, `components/leads/LeadsPage.tsx`
- Modify: `app/(app)/leads/page.tsx`

- [ ] **Step 1: `components/leads/useLeadActions.tsx`** (ตัวจัดการคลิกในตาราง L873-900 ส่วนล็อกอินจริง)

```tsx
'use client';

import { ConfirmUnclaimModal } from '@/components/modals/ConfirmUnclaimModal';
import { CustomerModal } from '@/components/modals/CustomerModal';
import { LogModal } from '@/components/modals/LogModal';
import { assignLead, claimLead, setNoCall } from '@/lib/api/rpc';
import type { ContactType } from '@/lib/api/types';
import { FIXTURE_NO_WRITE } from '@/lib/constants';
import { canUnclaimAny, claimBlock } from '@/lib/domain/leads';
import { channelsOf, jstTarget } from '@/lib/jst';
import { useActions, useAppState } from '@/lib/state/AppProvider';
import { useJst } from './useJst';

/** ปุ่มดำเนินการของแถวลีด — เขียนข้อมูลแล้ว upsertLead + invalidatePool (= route() ของ prototype) + toast; error → toast */
export function useLeadActions() {
  const { leads, meId, reps, campaigns, live } = useAppState();
  const { openModal, toast, toastError, upsertLead, dispatch } = useActions();
  const openJst = useJst();
  const done = (msg: string) => {
    dispatch({ type: 'invalidatePool' });
    toast(msg);
  };
  return {
    openCustomer: (id: string) => openModal(<CustomerModal id={id} />),
    openLog: (id: string, type: ContactType) => openModal(<LogModal id={id} type={type} />, 'sm'),
    confirmUnclaim: (id: string) => {
      const l = leads.find((x) => x.id === id);
      if (!l || !canUnclaimAny(l, meId)) {
        toast('ยกเลิกจองรายการนี้ไม่ได้');
        return;
      }
      openModal(<ConfirmUnclaimModal id={id} />, 'sm');
    },
    restoreNoCall: async (id: string) => {
      if (!live) {
        toast(FIXTURE_NO_WRITE);
        return;
      }
      try {
        upsertLead(await setNoCall(id, false));
        done('ยกเลิกห้ามโทรแล้ว');
      } catch (e) {
        toastError(e);
      }
    },
    claim: async (id: string) => {
      const l = leads.find((x) => x.id === id);
      if (!l) return;
      const block = claimBlock(l, campaigns.find((c) => c.id === l.campaignId), leads, meId);
      if (block) {
        toast(block);
        return;
      }
      if (!live) {
        toast(FIXTURE_NO_WRITE);
        return;
      }
      try {
        const nl = await claimLead(id);
        upsertLead(nl);
        done('จองลีดแล้ว ลีดนี้ย้ายเข้าหน้า Direct Sale ของคุณ');
        // จองแล้วเด้งไปแชตของลูกค้าใน JST (L888)
        const c0 = channelsOf(nl)[0];
        if (c0) openJst(jstTarget(nl, c0), { auto: true });
      } catch (e) {
        toastError(e);
      }
    },
    assign: async (id: string, userId: string) => {
      if (!live) {
        toast(FIXTURE_NO_WRITE);
        return;
      }
      try {
        upsertLead(await assignLead(id, userId));
        done('มอบหมายแล้ว: ' + (reps.find((r) => r.id === userId)?.name || ''));
      } catch (e) {
        toastError(e);
      }
    },
  };
}

export type LeadActions = ReturnType<typeof useLeadActions>;
```

- [ ] **Step 2: `components/leads/useVerifyMine.ts`** (`verifyMine` L467-479: ทุกครั้งที่หน้า Direct Sale วาดใหม่)

```ts
'use client';

import { useEffect, useRef } from 'react';
import { nowStamp } from '@/lib/format';
import { chatCheckFor, runVerify, verifyTodo } from '@/lib/jst';
import { useActions, useAppState } from '@/lib/state/AppProvider';

/**
 * ล็อกอินจริงเท่านั้น: ตรวจลีดของฉันที่จองแล้วแต่ยังไม่พบว่าทักแชท (≤10 ราย ทีละราย กันรันซ้อน)
 * วาดตารางใหม่ (patchLead) เฉพาะรายที่เปลี่ยนเป็น "ทักแชทแล้ว" — รอบถัดไปจึงไม่ตรวจรายนั้นซ้ำ
 */
export function useVerifyMine(): void {
  const { live, leads, meId, today, ui } = useAppState();
  const { patchLead } = useActions();
  const running = useRef(false);

  useEffect(() => {
    if (!live || running.current) return;
    const todo = verifyTodo(leads, meId);
    if (!todo.length) return;
    running.current = true;
    void (async () => {
      let changed: Awaited<ReturnType<typeof runVerify>> = [];
      try {
        changed = await runVerify(todo, chatCheckFor, () => nowStamp(new Date(), today));
      } finally {
        running.current = false;
      }
      changed.forEach((c) => patchLead(c.id, { chatCheck: c.chatCheck }));
    })();
    // ui อยู่ใน deps เพื่อให้ตรวจทุกครั้งที่หน้าวาดใหม่เพราะตัวกรองเปลี่ยน (prototype เรียก verifyMine ทุก draw)
  }, [live, leads, meId, today, ui, patchLead]);
}
```

- [ ] **Step 3: `components/leads/LeadTable.tsx`** (`tableHtml` L212-216, `leadRows` L192-211, `claimCell` L106-113, `noteCell` L114-121, `unclaimBtn` L91)

```tsx
'use client';

import { Fragment } from 'react';
import { ContactBar } from '@/components/leads/ContactBar';
import { DueTag, StatusBadge } from '@/components/ui/StatusBadge';
import type { Campaign, ClaimMode, Lead, Rep } from '@/lib/api/types';
import { bills, canUnclaim, lastSeller, repName, total } from '@/lib/domain/leads';
import { baht, fmtDate } from '@/lib/format';
import { channelsOf } from '@/lib/jst';
import { useAppState } from '@/lib/state/AppProvider';
import { useLeadActions, type LeadActions } from './useLeadActions';

/** mode = วิธีจองของแคมเปญที่เลือก (หน้าแคมเปญแผน C); perCamp = มุม "ลูกค้าทุกแคมเปญ" ใช้วิธีจองของแคมเปญของแต่ละลีด */
export interface TableOpts { mode?: ClaimMode; perCamp?: boolean }

interface RowCtx { reps: Rep[]; campaigns: Campaign[]; meId: string; isAdmin: boolean; today: string; act: LeadActions }

export function LeadTable({ list, opts = {} }: { list: Lead[]; opts?: TableOpts }) {
  const { reps, campaigns, meId, isAdmin, today } = useAppState();
  const act = useLeadActions();
  const ctx: RowCtx = { reps, campaigns, meId, isAdmin, today, act };
  return (
    <div className="card table-wrap">
      <table>
        <thead>
          <tr>
            <th>ชื่อ / เบอร์</th><th>เลขบิลที่เคยซื้อ</th><th>ร้านค้า</th><th>แคมเปญ</th><th>พนักงานขาย</th>
            <th className="r">ยอดซื้อรวม</th><th>สถานะ</th><th>บันทึกล่าสุด</th><th>ปุ่มดำเนินการ</th>
          </tr>
        </thead>
        <tbody>
          {list.length ? (
            list.map((l) => {
              const mode = opts.perCamp ? campaigns.find((c) => c.id === l.campaignId)?.claimMode || 'self' : opts.mode;
              return <LeadRow key={l.id} l={l} mode={mode} ctx={ctx} />;
            })
          ) : (
            <tr><td colSpan={9} className="empty">ไม่พบรายการที่ตรงกับตัวกรอง</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function LeadRow({ l, mode, ctx }: { l: Lead; mode?: ClaimMode; ctx: RowCtx }) {
  const { reps, campaigns, meId, isAdmin, today, act } = ctx;
  const owner = repName(reps, l.owner);
  const seller = lastSeller(l, reps);
  const lastNote = l.interactions[l.interactions.length - 1]?.note;
  const logType = l.noCall ? 'chat' : 'call';
  return (
    <tr>
      <td>
        <button className="cust-name" data-act="open" data-id={l.id} onClick={() => act.openCustomer(l.id)}>{l.name}</button>
        <div className="sub mono">{l.phone}</div>
        <ContactBar x={l} chans={channelsOf(l)} mini />
      </td>
      <td>
        <div className="bills">{bills(l).map((b, i) => <span key={`${b}-${i}`} className="bill">{b}</span>)}</div>
      </td>
      <td>{l.shop}</td>
      <td>
        {l.source === 'self'
          ? <span className="tag self">เซลล์ขุดเอง</span>
          : <span className="camp-cell">{campaigns.find((c) => c.id === l.campaignId)?.name || '—'}</span>}
      </td>
      <td>
        {owner ? <span className="rep-name">{owner}</span> : <span className="sub">ยังไม่มีผู้ดูแล</span>}
        {seller ? <div className="sub">ขายล่าสุด: {repName(reps, seller) || ''}</div> : null}
      </td>
      <td className="r num">{baht(total(l))}</td>
      <td>
        <StatusBadge status={l.status} />
        <DueTag callback={l.callback} today={today} />
        {l.chatCheck?.sent ? <div><span className="tag chat-ok">ทักแชทแล้ว ✓</span></div> : null}
        {l.noCall ? (
          <>
            <div><span className="tag nocall">ห้ามโทร · แชตเท่านั้น</span></div>
            {isAdmin ? <div className="sub">แจ้งโดย {repName(reps, l.noCallBy) || '—'}{l.noCallAt ? ' · ' + fmtDate(l.noCallAt) : ''}</div> : null}
          </>
        ) : null}
        {isAdmin && l.releasedBy?.length && !l.owner ? (
          <div className="sub">คัดออกโดย {l.releasedBy.map((id) => repName(reps, id) || '').join(', ')}</div>
        ) : null}
      </td>
      <td className="note-cell">
        {l.interest ? <div><span className="sub">สนใจ:</span> {l.interest}</div> : null}
        {l.status === 'won' && l.closedBills.length ? (
          <div>
            <span className="sub">บิลที่ปิด:</span>{' '}
            {l.closedBills.map((b, i) => (
              <Fragment key={`${b}-${i}`}>{i ? ' ' : ''}<span className="bill">{b}</span></Fragment>
            ))}
          </div>
        ) : null}
        <div>{lastNote || '—'}</div>
      </td>
      <td>
        <div className="actions">
          <button className="btn sm primary" data-act="log" data-type={logType} data-id={l.id} onClick={() => act.openLog(l.id, logType)}>
            {l.noCall ? 'บันทึกแชต' : 'บันทึก'}
          </button>
          <ClaimCell l={l} mode={mode} ctx={ctx} />
          {canUnclaim(l, meId) ? (
            <button className="btn sm danger" data-act="unclaim" data-id={l.id} onClick={() => act.confirmUnclaim(l.id)}>ยกเลิกจอง</button>
          ) : null}
          {isAdmin && l.noCall ? (
            <button className="btn sm" data-act="dnc-restore" data-id={l.id} onClick={() => void act.restoreNoCall(l.id)}>ยกเลิกห้ามโทร</button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

/** L106-113: ไม่มีวิธีจองหรือมีเจ้าของแล้ว → ว่าง; หัวหน้าได้ select มอบหมาย */
function ClaimCell({ l, mode, ctx }: { l: Lead; mode?: ClaimMode; ctx: RowCtx }) {
  if (!mode || l.owner) return null;
  const assign = ctx.isAdmin ? (
    <select
      className="select"
      data-assign={l.id}
      aria-label="มอบหมายให้"
      defaultValue=""
      onChange={(e) => {
        if (e.target.value) void ctx.act.assign(l.id, e.target.value);
      }}
    >
      <option value="">มอบหมายให้…</option>
      {ctx.reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
    </select>
  ) : null;
  if (mode === 'self') {
    return (
      <>
        <button className="btn sm outline" data-act="claim" data-id={l.id} onClick={() => void ctx.act.claim(l.id)}>จอง</button>
        {assign}
      </>
    );
  }
  return assign ?? <span className="sub">{mode === 'assign' ? 'รอหัวหน้ามอบหมาย' : 'ไม่มียอดขายเดิมให้อ้างอิง'}</span>;
}
```

หมายเหตุ markup: `.badge`/`.due`/`.tag` ในคอลัมน์สถานะและ `<div>` ในคอลัมน์บันทึกล่าสุดเรียงตาม L205-206 ตรงตัว; `!!` ไม่จำเป็นที่ `l.releasedBy?.length && !l.owner` เพราะอยู่ในเงื่อนไขของ ternary (ไม่พิมพ์เลข 0 ออกหน้าจอ)

- [ ] **Step 4: `components/leads/LeadsPage.tsx`** (`renderLeads` L245-257 ไม่มี `.demo-note`)

```tsx
'use client';

import { useMemo } from 'react';
import { TopbarActions } from '@/components/shell/TopbarActions';
import { PickFromBucketModal } from '@/components/modals/PickFromBucketModal';
import { filtered, mineOrAll } from '@/lib/domain/leads';
import { useActions, useAppState } from '@/lib/state/AppProvider';
import { LeadTable } from './LeadTable';
import { LeadToolbar } from './LeadToolbar';
import { PeriodCard } from './PeriodCard';
import { useVerifyMine } from './useVerifyMine';

/** หน้า Direct Sale: หัวหน้าเห็นทุกลีด เซลล์เห็นเฉพาะของตัวเอง (mineOrAll) */
export function LeadsPage() {
  const { leads, meId, isAdmin, ui, today } = useAppState();
  const { openModal } = useActions();
  const base = useMemo(() => leads.filter((l) => mineOrAll(l, { meId, isAdmin })), [leads, meId, isAdmin]);
  const list = useMemo(() => filtered(base, { ...ui, today }), [base, ui, today]);
  useVerifyMine();
  return (
    <>
      <TopbarActions>
        <button className="btn primary" id="add-lead" onClick={() => openModal(<PickFromBucketModal />, 'sm')}>+ เพิ่มลูกค้าจากถังลูกค้าทั้งหมด</button>
      </TopbarActions>
      <PeriodCard />
      <LeadToolbar base={base} withCampSelect />
      <LeadTable list={list} />
    </>
  );
}
```

- [ ] **Step 5: `app/(app)/leads/page.tsx`** (แทนทั้งไฟล์)

```tsx
import { LeadsPage } from '@/components/leads/LeadsPage';

export default function Page() {
  return <LeadsPage />;
}
```

- [ ] **Step 6: Typecheck + lint + test + build**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: typecheck ไม่มี output; lint `✔ No ESLint warnings or errors`; `Test Files  18 passed (18)` · `Tests  106 passed (106)`; build สำเร็จ ตาราง Route มี `○ /leads`

- [ ] **Step 7: ดูด้วยตาในโหมด fixture** (ปิด `npm start` ที่เปิดค้างก่อน — ใช้ `.next` ร่วมกัน)

Run (2 terminal): `NEXT_PUBLIC_FIXTURES=1 npx next dev -p 3200 -H 127.0.0.1` และ `npx http-server legacy -p 4100 -c-1 -s`
เปิด http://127.0.0.1:3200/leads เทียบกับ http://127.0.0.1:4100/index.html (กด "ดูตัวอย่างโดยไม่ล็อกอิน") ที่กว้าง 1280px

Expected:
- ตาราง 28 แถว แถวแรก "วีรวัฒน์ พงษ์ไทย" มี `เลยนัด 3/11/2026` สีแดง; ชิป `ทั้งหมด (28)` `เลยนัด (2)` `นัดวันนี้ (1)` `ยังไม่ติดต่อ (12)` … `ไม่สะดวกให้โทร (2)`; select แคมเปญ/เรียง/เซลล์ ครบ; ปุ่ม "+ เพิ่มลูกค้าจากถังลูกค้าทั้งหมด" มุมขวาบน; ไม่มีกล่อง `.demo-note`
- กดชิป "เลยนัด" → เหลือ 2 แถว; พิมพ์ `ใจดี` ในช่องค้นหา → เหลือ 2 แถว และ focus/caret ยังอยู่ในช่อง; กด "เดือนนี้" → ข้อความใต้การ์ด "กรอง 1/11/2026 – 30/11/2026 · …" และเหลือ 10 แถว
- คลิกชื่อลูกค้า → popup รายละเอียด (แท็บประวัติการซื้อ, กล่อง "การทักแชท" ขึ้นป้าย); สลับแท็บได้; Esc / คลิกพื้นหลังปิดได้; กด "บันทึก" ในแถว → popup บันทึก เปลี่ยนสถานะเป็น "ปิดการขายแล้ว" แล้วช่องบิลโผล่, "ไม่สะดวกให้โทร…" แล้วคำเตือนแดง + "* ใส่เหตุผล"; กด "บันทึก" ในโหมด fixture → toast `โหมด fixture: ไม่ได้บันทึกลง Supabase`
- กดปุ่มโทรสีเขียว → toast "โทร 08… · คัดลอกเบอร์แล้ว"; กด "+ เพิ่มลูกค้าจากถังลูกค้าทั้งหมด" → popup "เพิ่มลูกค้า" กด "ถังลูกค้าทั้งหมด Bebeplay" → ไป `/campaigns/bebeplay` (หัวข้อ "แคมเปญ Bebeplay" เนื้อหา placeholder)

ปิด dev server ทั้งสองตัวเมื่อดูเสร็จ (พอร์ต 3200 ใช้ `.next` ร่วมกับ e2e)

- [ ] **Step 8: Commit**

```bash
git add components/leads 'app/(app)/leads/page.tsx'
git commit -m "feat(web): add the Direct Sale lead table and /leads page with row actions and automatic chat checks" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: เทียบหน้าตา `/leads` และ popup กับ prototype (Playwright)

เทียบในโหมด fixture (Next พอร์ต 3100) กับ prototype โหมดตัวอย่าง (พอร์ต 4100) ทั้งสองขนาดจอ: (1) ข้อความ/สี/สถานะของ DOM ต้องเท่ากันทุกตัว (`toEqual`) (2) element screenshot ของ `#view`, `.topbar`, `.modal` แบบเข้มเหมือน shell (threshold 0.1 + `maxDiffPixels` ต่อภาพที่วัดจาก 3 รอบ) ส่วนที่ตั้งใจต่างจาก prototype มีแค่ `.demo-note` และหมายเหตุ "ข้อมูลตัวอย่าง: …" ในกล่องตรวจแชต ซึ่งซ่อน/ลบฝั่ง prototype ก่อนถ่าย

**Files:**
- Modify: `lib/fixtures/load.ts`, `lib/state/AppProvider.tsx`, `e2e/visual-parity.spec.ts`
- Test: `lib/fixtures/load.test.ts`

- [ ] **Step 1: เขียน test ที่ยังไม่ผ่าน** — เพิ่มใน `describe('fixturePayload', …)` ของ `lib/fixtures/load.test.ts` ก่อน `});` บรรทัดสุดท้าย:

```ts
  it('?claim=<leadId> claims that lead as Dev MPD (popup ยกเลิกจอง ใน e2e)', () => {
    expect(fixturePayload().leads.filter((l) => l.claimedBy)).toEqual([]);
    const l = fixturePayload('?claim=L1002').leads.find((x) => x.id === 'L1002');
    expect(l).toMatchObject({ owner: 'r4', claimedBy: 'r4', claimedAt: '2026-11-04T10:00' });
  });
```

Run: `npm test`
Expected: FAIL 1 test — `expected { id: 'L1002', … } to match object { owner: 'r4', claimedBy: 'r4', … }` สรุป `Test Files  1 failed | 17 passed (18)` · `Tests  1 failed | 106 passed (107)`

- [ ] **Step 2: `?claim=` ใน `lib/fixtures/load.ts`** (แทนทั้งไฟล์)

```ts
import type { LoadedPayload } from '@/lib/state/reducer';
import { FIXTURE_DATA } from './data';

/** prototype โหมดตัวอย่างเริ่มที่ "Dev MPD" (หัวหน้า) */
export const FIXTURE_ME_ID = 'r4';

/**
 * search = window.location.search: `?claim=<leadId>` (ซ้ำได้) ทำเหมือน Dev MPD กด "จอง" ลีดนั้นในโหมดตัวอย่าง (prototype L889)
 * ใช้ใน e2e ของ popup ยกเลิกจอง เพราะข้อมูลตัวอย่างไม่มีลีดที่ claimedBy = ตัวเอง
 */
export function fixturePayload(search = ''): LoadedPayload {
  const d = structuredClone(FIXTURE_DATA);
  const me = d.reps.find((r) => r.id === FIXTURE_ME_ID);
  if (!me) throw new Error(`fixture rep ${FIXTURE_ME_ID} is missing`);
  for (const id of new URLSearchParams(search).getAll('claim')) {
    const l = d.leads.find((x) => x.id === id);
    if (l) Object.assign(l, { owner: me.id, claimedBy: me.id, claimedAt: `${d.today}T10:00` });
  }
  return {
    email: 'dev@fixtures.test',
    meId: me.id,
    isAdmin: me.role === 'admin',
    live: false,
    reps: d.reps,
    campaigns: d.campaigns.map((c) => ({ ...c, maxPerRep: null, active: true, criteria: [] })),
    leads: d.leads,
    today: d.today,
  };
}
```

ใน `lib/state/AppProvider.tsx` แก้

```tsx
          action = { type: 'loaded', payload: fixturePayload() };
```

เป็น

```tsx
          action = { type: 'loaded', payload: fixturePayload(window.location.search) };
```

Run: `npm test`
Expected: `Test Files  18 passed (18)` · `Tests  107 passed (107)` (`guard.test.ts` ยังผ่าน: dynamic import ยังอยู่ติดเงื่อนไข)

- [ ] **Step 3: เพิ่ม e2e** — ต่อท้าย `e2e/visual-parity.spec.ts` (ใช้ `LEGACY`, `APP`, `SIZES`, `INJECT`, `shootLegacy` ที่มีอยู่แล้วในไฟล์):

```ts

/* ---------- แผน B: หน้า /leads และ popup A–D ---------- */
const DEMO_KEY = 'mpd-directsale-preview-v5';
// ของที่เว็บใหม่ตั้งใจตัด (spec ข้อ 2): .demo-note และหมายเหตุ "ข้อมูลตัวอย่าง: …" ท้ายกล่องตรวจแชต
const LEGACY_DEMO_ONLY = '.demo-note, #chk-body > div.sub { display: none !important; }';
// PARITY_MEASURE=1 → maxDiffPixels = 0 ทุกภาพของแผน B เพื่ออ่านจำนวนพิกเซลที่ต่างจริงจากผลรัน (Step 6)
const MEASURE = !!process.env.PARITY_MEASURE;
// maxDiffPixels ต่อภาพที่ threshold 0.1 (ความต่าง anti-alias ของฟอนต์ CDN กับ next/font) — Step 6 แทนด้วยค่าที่วัดได้ ห้ามขยายเพื่อให้ผ่าน
const MAX_DIFF: Record<string, number> = {
  'leads-view-desktop': 1500, 'leads-view-mobile': 1000, 'leads-topbar-desktop': 50, 'leads-topbar-mobile': 50,
  'customer-buy-desktop': 600, 'customer-buy-mobile': 600, 'customer-talk-desktop': 500, 'customer-talk-mobile': 500,
  'customer-nocall-desktop': 500, 'customer-nocall-mobile': 500,
  'log-call-desktop': 300, 'log-call-mobile': 300, 'log-won-desktop': 400, 'log-won-mobile': 400,
  'log-dnc-desktop': 400, 'log-dnc-mobile': 400, 'log-chat-desktop': 300, 'log-chat-mobile': 300,
  'unclaim-desktop': 100, 'unclaim-mobile': 100, 'bucket-desktop': 150, 'bucket-mobile': 150,
};
const shot = (name: string) => ({ maxDiffPixels: MEASURE ? 0 : (MAX_DIFF[name] ?? 0), threshold: 0.1 }) as const;

async function settleWork(page: Page) {
  await page.mouse.move(0, 0); // ไม่ให้ :hover ของแถว/ปุ่มติดในภาพ
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.waitForTimeout(200);
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
    const t = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
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
    const t = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const cls = (el: Element) => (typeof el.className === 'string' ? el.className : '').split(/\s+/).filter(Boolean).join(' ');
    const m = document.querySelector('.modal');
    const all = (sel: string) => Array.from(m?.querySelectorAll(sel) ?? []);
    const active = document.activeElement;
    return {
      cls: m ? cls(m) : null,
      text: t(m),
      fields: all('input, select, textarea').map((el) => {
        const f = el as HTMLInputElement;
        return { id: f.id, value: f.value, disabled: f.disabled, shown: !f.closest('[hidden]') };
      }),
      hidden: all('[id]').map((el) => `${el.id}:${(el as HTMLElement).hidden}`),
      buttons: all('button, a.ch-btn').map((b) => `${cls(b)}|${t(b)}|${b.getAttribute('title') ?? ''}|${(b as HTMLButtonElement).disabled ?? ''}`),
      focused: active && m?.contains(active) ? active.id || cls(active) : null,
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
      await shootLegacy(page, `leads-view-${s.tag}`, '#view');
      await shootLegacy(page, `leads-topbar-${s.tag}`, '.topbar');
      await openAppLeads(page);
      expect(await leadsText(page)).toEqual(legacy);
      await expect.soft(page.locator('#view')).toHaveScreenshot(`leads-view-${s.tag}.png`, shot(`leads-view-${s.tag}`));
      await expect.soft(page.locator('.topbar')).toHaveScreenshot(`leads-topbar-${s.tag}.png`, shot(`leads-topbar-${s.tag}`));
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
```

- [ ] **Step 4: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: typecheck ไม่มี output; lint `✔ No ESLint warnings or errors`

- [ ] **Step 5: รัน e2e** (ปิด `npm start` / dev server ที่เปิดค้างก่อน; ต่ออินเทอร์เน็ต; พอร์ต 3100 และ 4100 ว่าง)

Run: `npm run test:e2e`
Expected: `15 passed` (เดิม 5 + แผน B: desktop/mobile × leads page, customer modal, log modal, unclaim confirm, pick-from-bucket)

ถ้าไม่ผ่าน:
- `toEqual` ของ `leadsText` / `modalState` ตก = markup/ข้อความ/ค่าในช่องกรอก/focus ต่างจริง → แก้ component ฝั่ง Next ให้ตรง `legacy/app.js` (ห้ามแก้ test ให้ยอมรับความต่าง)
- ภาพตก: `npx playwright show-report` ดู `-expected` (prototype) / `-actual` (Next) / `-diff` — ถ้า diff เป็นแค่ขอบตัวอักษรกระจายทั่วภาพ = ความต่าง anti-alias ของฟอนต์ ไปทำ Step 6; ถ้าเป็นก้อน/เส้น/ตำแหน่งเลื่อน = layout ต่าง → แก้ markup (ไม่แก้ `styles/prototype.css`)

- [ ] **Step 6: วัด `maxDiffPixels` จริง 3 รอบ แล้วตั้งค่า**

Run 3 ครั้ง: `PARITY_MEASURE=1 npx playwright test -g "leads (desktop|mobile)" 2>&1 | grep -E "pixels \(ratio|›.*\.png"`
Expected: ทุก test ตก (ตั้ง 0) และแต่ละภาพพิมพ์ `… N pixels (ratio 0.0x of all image pixels) are different.` — จดค่า N ของแต่ละชื่อภาพทั้ง 3 รอบ

แก้ `MAX_DIFF` ใน `e2e/visual-parity.spec.ts` ให้แต่ละภาพ = ค่าสูงสุดจาก 3 รอบ × 1.25 ปัดขึ้นเป็นหลัก 50 (ภาพที่ N = 0 ทุกรอบตั้ง 0) แล้วเพิ่มคอมเมนต์บรรทัดเหนือ `MAX_DIFF` ว่าวัดเมื่อวันที่เท่าไร เช่น `// วัด 3 รอบ 2026-11-xx (Chromium ของ Playwright 1.65)` ห้ามตั้งค่าเกิน 2% ของพื้นที่ภาพ (กว้าง×สูงของ element) — ถ้าวัดได้เกินนั้นแปลว่ามีความต่างจริง กลับไปแก้ตาม Step 5

Run: `npm run test:e2e`
Expected: `15 passed`

- [ ] **Step 7: ตรวจว่า test จับความต่างได้จริง (teeth check)**

Run: `PARITY_INJECT_CSS='.chip { padding-left: 13px !important; }' npx playwright test -g "leads page"`
Expected: `2 failed` — ทั้งสองขนาด `toHaveScreenshot(leads-view-…)` ตก (`… pixels … are different`)

Run: `PARITY_INJECT_CSS='.modal-h h3 { letter-spacing: .4px; }' npx playwright test -g "modal|confirm|bucket"`
Expected: `8 failed` — ทุก test popup ตกที่ `toHaveScreenshot` (ข้อความ/สถานะ DOM ยังเท่ากัน จึงตกเฉพาะภาพ)

Run: `npm run test:e2e`
Expected: `15 passed` (ไม่ได้ตั้ง `PARITY_INJECT_CSS` = ไม่ฉีดอะไร)

- [ ] **Step 8: Commit**

```bash
git add lib/fixtures/load.ts lib/fixtures/load.test.ts lib/state/AppProvider.tsx e2e/visual-parity.spec.ts
git commit -m "test(web): compare the leads page and lead popups with the prototype at 375 and 1280 px" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: ตรวจรอบสุดท้าย + อัปเดต `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md` (และไฟล์ที่ต้องแก้จากการตรวจ ถ้ามี)

- [ ] **Step 1: อัปเดต `CLAUDE.md`**

แก้

```md
- กำลังย้ายจาก prototype (HTML/JS ล้วน) เป็น Next.js ตามแผน A (ฐานราก) → B (หน้าลีด/แคมเปญ) → C (ลูกค้าของฉัน/ถังกลาง, Dashboard, ตั้งค่า, deploy)
```

เป็น

```md
- กำลังย้ายจาก prototype (HTML/JS ล้วน) เป็น Next.js ตามแผน A (ฐานราก) → B (หน้าลีด `/leads` + popup ลีด) → C (แคมเปญ + ถังลูกค้า, ลูกค้าของฉัน/ถังกลาง, Dashboard, ตั้งค่า, deploy)
```

แก้

```md
components/
  auth/NoAccess.tsx             # การ์ดยังไม่มีสิทธิ์ / กำลังโหลด / โหลดไม่สำเร็จ
  shell/                        # Shell, Sidebar, Topbar, TopbarActions, MeBox, Toast, ModalRoot
```

เป็น

```md
components/
  auth/NoAccess.tsx             # การ์ดยังไม่มีสิทธิ์ / กำลังโหลด / โหลดไม่สำเร็จ
  shell/                        # Shell, Sidebar, Topbar, TopbarActions, MeBox, Toast, ModalRoot
  ui/                           # ChIcon, CloseButton, StatusBadge/DueTag
  leads/                        # PeriodCard, LeadToolbar, ContactBar, LeadTable, LeadsPage, useJst, useLeadActions, useVerifyMine
  modals/                       # CustomerModal (+ChatCheckBody), LogModal, ConfirmUnclaimModal, PickFromBucketModal
```

แก้

```md
  state/                        # reducer + AppProvider (โหลด dsales_me → team/campaigns/my_leads ครั้งเดียว)
  domain/                       # กติกาลีด/ตัวกรอง/สถิติ (ฟังก์ชันล้วน มี test)
```

เป็น

```md
  state/                        # reducer + AppProvider (context แยก state / actions / toast / modal) + session.ts, toast.ts
  domain/                       # period, leads, log (ฟังก์ชันล้วน มี test)
  jst.ts                        # ช่องทางแชต, jstOpen, ตรวจทักแชท (chatCheckFor / verifyMine)
```

แก้

```md
ดึงข้อมูลฝั่ง client เป็นหลักเหมือน prototype: ทุก RPC เรียกผ่าน `lib/api/rpc.ts` (โยน `Error` ข้อความไทยจาก `toThaiError`) และหลังแก้ข้อมูลให้ `dispatch({ type: 'upsertLead', lead })` แทนการโหลดใหม่ทั้งหน้า
```

เป็น

```md
ดึงข้อมูลฝั่ง client เป็นหลักเหมือน prototype: ทุก RPC เรียกผ่าน `lib/api/rpc.ts` (โยน `Error` ข้อความไทยจาก `toThaiError`) และหลังแก้ข้อมูลให้ `upsertLead(lead)` แทนการโหลดใหม่ทั้งหน้า แล้ว `dispatch({ type: 'invalidatePool' })` (ถังลูกค้าโหลดใหม่ = `ui.pool.loaded = false` ของ prototype)
- component ที่ไม่ต้องอ่าน state ใช้ `useActions()` (คงที่ ไม่ re-render) อ่าน state ด้วย `useAppState()`; toast/modal อยู่คนละ context
- error ระหว่างใช้งานหน้าแสดงด้วย `toastError(e)` เท่านั้น (reducer ไม่รับ `failed` หลัง phase `ready`)
```

แก้

```md
- `lib/fixtures/data.ts` และ `lib/icons.ts` สร้างด้วยสคริปต์ ห้ามแก้มือ
```

เป็น

```md
- `lib/fixtures/data.ts` และ `lib/icons.ts` สร้างด้วยสคริปต์ ห้ามแก้มือ
- `state.live = false` ในโหมด fixture: ฝั่งอ่านทำแบบโหมดตัวอย่างของ prototype (ไม่โหลดประวัติซื้อ, ไม่รัน verifyMine, ตรวจแชตจากบันทึกในแอป) ปุ่มที่เขียนข้อมูลแสดง toast "โหมด fixture: ไม่ได้บันทึกลง Supabase"
- `/leads?claim=<leadId>` (เฉพาะโหมด fixture) ทำเหมือน Dev MPD จองลีดนั้น — e2e ใช้เปิด popup ยกเลิกจอง
```

แทนหัวข้อ `## งานค้างเล็กน้อยสำหรับแผน B` ทั้งหัวข้อ (6 bullet) ด้วย

```md
## งานค้างสำหรับแผน C

- `docs/DATABASE.md` และ `README.md` ยังอธิบายโครงสร้างเดิม (public/`index.html`/ลงทะเบียนอัตโนมัติ) ต้องอัปเดต
- หน้าแคมเปญใช้ `LeadTable` กับ `opts.mode` / `opts.perCamp` (ปุ่มจอง + `maxPerRep` + เปิด JST อัตโนมัติ, select มอบหมาย มีแล้ว) และโหลดถังใหม่เมื่อ `state.poolVersion` เปลี่ยน; ถ้า `ui.focusSearch` เป็นจริงให้ล้างคำค้นถัง โฟกัสช่อง `#pool-q` จนโหลดเสร็จแล้วตั้งกลับเป็น false
```

ในหัวข้อ `## เอกสาร` แก้

```md
- แผน: `docs/superpowers/plans/2026-11-17-dsales-phase-0-1.md` (DB เฟส 0–1), `docs/superpowers/plans/2026-11-17-nextjs-plan-a-foundation.md` (แผน A)
```

เป็น

```md
- แผน: `docs/superpowers/plans/2026-11-17-dsales-phase-0-1.md` (DB เฟส 0–1), `docs/superpowers/plans/2026-11-17-nextjs-plan-a-foundation.md` (แผน A), `docs/superpowers/plans/2026-11-18-nextjs-plan-b-leads.md` (แผน B)
```

- [ ] **Step 2: ตรวจอัตโนมัติตามลำดับ** (ปิด `npm start` / dev server ที่เปิดค้างก่อน)

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run check:fixtures
npm run test:e2e
npm run build
npm run check:fixtures
```

Expected:
- `typecheck`: ไม่มี output
- `lint`: `✔ No ESLint warnings or errors`
- `test`: `Test Files  18 passed (18)` · `Tests  107 passed (107)`
- `build` (ครั้งแรก): สำเร็จ ตาราง Route มี `○ /leads` และ `ƒ Middleware`
- `check:fixtures`: `ok: ไม่มีข้อมูล fixture ใน .next/static และ .next/server`
- `test:e2e`: `15 passed`
- `build` (ครั้งที่สอง — e2e เขียนทับ `.next` ด้วยผลของ dev): สำเร็จ
- `check:fixtures`: `ok: ไม่มีข้อมูล fixture ใน .next/static และ .next/server` (ยืนยันว่า `?claim=` และ `localChatCheck` ไม่ดึงข้อมูล fixture เข้า production)

- [ ] **Step 3: Checklist ให้ผู้ใช้ทดสอบด้วยบัญชีจริง** — `.env.local` ครบและ `NEXT_PUBLIC_FIXTURES=0`; `npm run build && npm start` แล้วเปิด http://localhost:3000

> **คำเตือน:** ข้อ 5–8 **เขียนข้อมูลจริงลง Supabase production** (ตาราง `dsales_leads` / ประวัติการติดต่อที่ทีมเห็น) ใช้เฉพาะ **ลูกค้าของตัวเองที่ใช้ทดสอบได้** หรือ **ลีดทดสอบในแคมเปญ** ที่ตกลงกับหัวหน้าไว้แล้ว และจดชื่อลูกค้าที่ใช้ไว้ ถ้าไม่มีลีดแบบนั้นให้ข้ามข้อ 5–8 (ทำตอนแผน C ที่มีหน้า `/mine`)

1. ล็อกอิน → `/leads` เห็นตารางลีด (หัวหน้าเห็นทุกคน, เซลล์เห็นของตัวเอง) ไม่มีกล่อง "ข้อมูลทั้งหมดเป็นตัวอย่าง…"; ตัวเลข badge "Direct Sale" บนเมนูเท่ากับจำนวนลีดของฉันที่สถานะยังไม่ติดต่อ+รอติดต่อ
2. ตัวกรอง: ชิปสถานะ (ตัวเลขในวงเล็บเปลี่ยนตามช่วงวันที่), ค้นหาเบอร์แบบมีขีด เช่น `081-234` เจอ, ค้นหาเลขบิล, เรียง "ยอดซื้อสูงสุด", ช่วงวันที่ เดือนนี้/เลือกเดือน/เลือกปี/กำหนดเอง, select แคมเปญ และ (หัวหน้า) select เซลล์ — ไป Dashboard แล้วกลับมา ตัวกรองยังอยู่
3. คลิกชื่อลูกค้า → popup: แท็บ "ประวัติการซื้อ (n)" โหลดรายการจาก Supabase ได้ (Network: `dsales_customer_purchases` 1 ครั้ง), กล่อง "การทักแชท (ตรวจจาก JST)" ขึ้นป้าย (Network: `dsales_customer_chats` ที่ `p_since` เป็นเวลาแบบมี `+00:00` ตรงกับเวลาจอง), "ตรวจอีกครั้ง" ตรวจใหม่, "คัดลอก" → toast "คัดลอกเบอร์แล้ว"; Esc / คลิกพื้นหลังปิดได้
4. ปุ่มโทรสีเขียว → เปิดแอปโทร (ถ้ามี) + toast "โทร … · คัดลอกเบอร์แล้ว"; ปุ่มแชต → ถ้ารันตัวช่วย JST (`tools/jst-helper`) อยู่: JST เปิดแชต + toast "เปิดแชตใน JST แล้ว"; ถ้าไม่ได้รัน: toast "ยังไม่ได้รันตัวช่วย JST บนเครื่อง · คัดลอกชื่อแชตแล้ว…" (ภายใน ~2.5 วิ)
5. (เขียนข้อมูลจริง) popup บันทึกของลูกค้าทดสอบ: เลือก "รอติดต่อ" ไม่ใส่วัน → toast "เลือกวันที่นัดติดต่อก่อนบันทึก"; เลือก "ปิดการขายแล้ว" ไม่ใส่บิล → toast "ใส่เลขบิลที่ขายได้ก่อนปิดการขาย"; เลือก "กำลังติดตาม" หมายเหตุ "ทดสอบระบบ Next.js" → บันทึก → toast "บันทึกแล้ว" แถวแสดงหมายเหตุใหม่ทันทีโดยไม่โหลดหน้าใหม่
6. (เขียนข้อมูลจริง) ยกเลิกจอง: ถ้ามีลีดที่จองเองจากถัง (ปุ่ม "ยกเลิกจอง" ในแถว) → popup "ยกเลิกจอง?" → "ยืนยันยกเลิกจอง" → toast "ยกเลิกจองแล้ว" แถวหาย (เซลล์) หรือเหลือ "ยังไม่มีผู้ดูแล" (หัวหน้า) — ถ้าต้องการลีดทดสอบ ให้จองลูกค้าทดสอบ 1 รายจากหน้าแคมเปญ → ถังลูกค้าทั้งหมด ของเว็บ prototype ที่ deploy อยู่ก่อน
7. (เขียนข้อมูลจริง ใช้กับลูกค้าทดสอบเท่านั้น) "ไม่สะดวกให้โทร" + เหตุผล → toast "ทำเครื่องหมายห้ามโทรแล้ว…" แถวขึ้น "ห้ามโทร · แชตเท่านั้น" ปุ่มเป็น "บันทึกแชต"; หัวหน้ากด "ยกเลิกห้ามโทร" → toast "ยกเลิกห้ามโทรแล้ว" (คืนค่าเดิม)
8. (เขียนข้อมูลจริง ใช้กับลูกค้าทดสอบเท่านั้น) "คัดออก" + เหตุผล → toast "คัดออกแล้ว…" ลีดออกจากรายการของเซลล์ (ย้อนไม่ได้จากหน้านี้ — หัวหน้ามอบหมายคืนได้ในแผน C)
9. ตรวจแชตอัตโนมัติ: Network ตอนเปิด `/leads` มี `dsales_customer_chats` ทีละครั้ง (ไม่ยิงพร้อมกัน) ไม่เกิน 10 ครั้ง; ลีดที่เซลล์ทักแล้วขึ้น "ทักแชทแล้ว ✓"; เปิด popup ลีดที่เพิ่งทัก → ปิด popup แล้วป้ายในตารางเปลี่ยนตาม
10. เครือข่ายล้ม: DevTools → Network → Offline แล้วกด F5 → การ์ด "โหลดข้อมูลจาก Supabase ไม่สำเร็จ: …" พร้อมปุ่ม "ลองใหม่"/"ออกจากระบบ" (ไม่เด้งไป `/login` วน) → Online แล้วกด "ลองใหม่" กลับมาใช้ได้
11. error ระหว่างใช้งาน: เปิดหน้าแล้วตั้ง Offline จากนั้นกด "บันทึก" ใน popup → toast ข้อความ error หน้ายังอยู่ (ไม่กลายเป็นการ์ด error)
12. "+ เพิ่มลูกค้าจากถังลูกค้าทั้งหมด" → popup "เพิ่มลูกค้า" → "ถังลูกค้าทั้งหมด Bebeplay" → ไป `/campaigns/bebeplay` (เนื้อหายังเป็น placeholder จนแผน C); ปุ่ม back กลับ `/leads`
13. จอมือถือ (DevTools 375px): ตารางเลื่อนแนวนอนได้, ช่องค้นหาเต็มแถว, popup ทุกตัวใช้ได้

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: record plan B structure, fixture switches and remaining plan C follow-ups in CLAUDE.md" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

ถ้า Step 2–3 ต้องแก้โค้ด ให้ commit แยก:

```bash
git add -A
git commit -m "fix(web): address final verification findings for the leads page" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## คำถามที่ยังเปิด (ถามผู้ใช้ก่อน/ระหว่างทำ)

1. **caret ของช่องค้นหา:** prototype ย้าย caret ไปท้ายข้อความทุกครั้งที่พิมพ์ (ผลข้างเคียงของการวาดใหม่ทั้งหน้า) แผนนี้คง caret ตามที่ผู้ใช้พิมพ์ (พิมพ์แก้กลางคำได้) ถ้าต้องการเหมือนเดิมเป๊ะ เพิ่ม `onChange` ให้ `setSelectionRange(len, len)` หลังวาด
2. **โหมด fixture ไม่เขียนข้อมูล:** prototype โหมดตัวอย่างบันทึกลง localStorage ได้ แผนนี้ให้ปุ่มเขียนข้อมูลแสดง toast แทน (กัน fixture ยิงไป production) — ถ้าอยากลอง flow บันทึกในโหมด fixture ต้องทำ reducer จำลองเพิ่ม
3. **`.brand-sub` "MPD Group · Preview v0.1"** ยังคงตาม prototype — ตัดสินใจเปลี่ยนในแผน C

## สิ่งที่แผนนี้ยังไม่ทำ (แผน C)

- **แคมเปญ `/campaigns/[brand]`:** การ์ดถัง "ลูกค้าทั้งหมด" (`dsales_customer_pool_v3` นับครั้งเดียวต่อแบรนด์) + การ์ด "ลูกค้าทุกแคมเปญ" + การ์ดแคมเปญ (badge กำลังดำเนินการ/ปิดอยู่/จบแล้ว, bar, สถิติ), แถบ quota, toolbar ไม่มี select แคมเปญ, `LeadTable` กับ `opts.mode` / `opts.perCamp`, ปุ่ม topbar ของหัวหน้า ("จัดสรรให้เซลล์ที่ขายล่าสุด" → toast "ไม่มีลีดที่ต้องจัดสรร", "+ สร้างแคมเปญ"), คลิกการ์ดรีเซ็ตชิปสถานะ
- **ถังลูกค้า (pool panel):** ค้นหา `#pool-q` debounce 300 ms + `focusSearch`, `dsales_customer_pool_v4` (ส่ง `p_from`/`p_to` เมื่อมีช่วงวันที่), แบ่งหน้า 50, ปุ่ม จอง/ยกเลิกจอง/จองแล้ว/จองโดย/ไม่สะดวกให้โทร, จองแล้วเปิด JST อัตโนมัติ (ดึง `dsales_customer_channels` ก่อน), โหลดใหม่ตาม `state.poolVersion`
- **popup E รายละเอียดลูกค้าในถัง** และ **popup F ตัวสร้างแคมเปญ** (แท็บ ข้อมูลพื้นฐาน/การตั้งค่า/กลุ่มลูกค้า, funnel, เงื่อนไข `CRIT`, insert `dsales_campaigns`)
- **Dashboard `/dashboard`:** KPI, เปรียบเทียบแยกแบรนด์, ตารางค่าคอมรายเดือน + คัดลอก TSV, ผลงานรายเซลล์, กิจกรรมล่าสุด (ใช้ `contactedIn` / `wonIn` / `mineOrAll` ของแผนนี้)
- **ตั้งค่า `/setup`:** ทีมเซลล์ (เพิ่มด้วยอีเมล `dsales_add_member`, ปิด/เปิด `dsales_set_member_active`), วิธีจองลีดของแคมเปญ, การ์ดผูก tag JST กับเซลล์ (`dsales_jst_admin_tags` / `dsales_member_tags` / `dsales_set_member_tags`)
- **หน้าใหม่เฟส 1:** `/mine` ลูกค้าของฉัน และ `/pool` ถังกลาง (`dsales_base_customers`, ปุ่มเริ่มติดตาม/จอง/ยกเลิกจอง, `no_call` disabled, แบรนด์สำหรับจอง, "เป็นลูกค้าของ <ชื่อ/tag>", `total_count` จากหน้าแรก)
- **รอบมือถือ:** ไล่ทุกหน้าที่ 375px + e2e เทียบภาพหน้าที่เหลือทุกหน้า/ทุก popup
- **เอกสาร:** อัปเดต `README.md` และ `docs/DATABASE.md` (โครงสร้าง Next.js, สมาชิกเท่านั้น, ไม่ลงทะเบียนอัตโนมัติ) และ `CLAUDE.md`
- **Deploy:** เปลี่ยน Framework Preset ของ Vercel เป็น Next.js + ตั้ง env (ถามผู้ใช้ก่อน), merge/push (ถามผู้ใช้ก่อน), ไล่ checklist บน production แล้วลบ `legacy/` (และ e2e ที่อ้าง `legacy/`)
