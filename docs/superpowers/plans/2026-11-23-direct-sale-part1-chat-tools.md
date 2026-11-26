# Direct Sale ส่วนที่ 1 — เครื่องมือแชตในหน้า Direct Sale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** หน้า Direct Sale (`/leads`) มีไอคอนห้องแชตรายห้อง (JST / Meta Inbox) แบบเดียวกับ `/mine` ทั้งในตารางและ popup ลูกค้า และติ๊กลีดของตัวเองแล้วส่งข้อความผ่าน worker ได้

**Architecture:** RPC ใหม่ `dsales_rooms_for_phones` คืนห้องของหลายเบอร์ (JSON เดียวกับ `dsales_customer_rooms` + ชื่อห้อง) เฉพาะลีดที่ผู้เรียกเป็นเจ้าของ (หัวหน้าเห็นทุกเบอร์) · หน้าเว็บโหลดห้องผ่าน hook `useLeadRooms` (เก็บไว้ข้ามการกรอง โหลดเฉพาะเบอร์ที่ยังไม่มี) · แยกไอคอนห้องของ `/mine` (`ChannelCell`) เป็น component กลาง `RoomIcons` / `RoomChips` · แยกแถบเลือก + จำนวนสูงสุดต่อชุดของ `/mine` เป็น `SelectionBar` / `useOutreachMax` แล้วใช้ใน `LeadTable` ร่วมกับ `SendOutreachModal` เดิม

**Tech Stack:** Supabase (PostgreSQL, schema `dsales`, MCP `execute_sql` / `apply_migration`), Next.js 15 + React 19 + TypeScript strict, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-11-23-direct-sale-followup-design.md` ข้อ 5 · ทำงานใน worktree `C:\Claude Ai\Directsale\directsales-web-links` branch `feat/buyer-id-room-links` · commit ด้วย `git -c user.name=DevTeamMPD -c user.email=dev@mpdgroup.co commit` และจบข้อความด้วยบรรทัดว่าง + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` · `git add` เฉพาะไฟล์ที่แก้ (worktree มีไฟล์ที่ต่างแค่ line ending จำนวนมาก ห้าม `git add -A`)

---

## File Structure

| ไฟล์ | สร้าง/แก้ | หน้าที่ |
|---|---|---|
| `supabase/migrations/20261123080000_dsales_customer_rooms_name.sql` | มีแล้ว (commit `98ae556`) | `dsales_customer_rooms` คืน `name` ต่อห้อง |
| `supabase/tests/11_customer_rooms_name.sql` | มีแล้ว | test ของไฟล์บน |
| `supabase/migrations/20261123090000_dsales_rooms_for_phones.sql` | สร้าง | RPC ห้องของหลายเบอร์ + สิทธิ์ |
| `supabase/tests/12_rooms_for_phones.sql` | สร้าง | test สิทธิ์ / รูปแบบ / จำกัด / เวลา |
| `lib/api/types.ts` | แก้ | `RoomsForPhoneRow` |
| `lib/api/rpc.ts` (+ `rpc.test.ts`) | แก้ | `getRoomsForPhones` แบ่งทีละ 100 เบอร์ |
| `lib/api/errors.ts` (+ `errors.test.ts`) | แก้ | ข้อความไทย `too_many_phones` |
| `lib/domain/outreach.ts` (+ `outreach.test.ts`) | แก้ | `leadSelectable`, `leadSelRow` |
| `components/leads/RoomIcons.tsx` | สร้าง | ไอคอน/ชิปห้องรายห้อง (JST หรือ Meta) ใช้ร่วม `/mine` `/leads` popup |
| `components/campaigns/ChannelCell.tsx` | แก้ | ใช้ `RoomIcons` (พฤติกรรมเดิม) |
| `components/leads/useLeadRooms.ts` | สร้าง | โหลด/เก็บห้องของลีด |
| `components/campaigns/useOutreachMax.ts` | สร้าง | จำนวนสูงสุดต่อชุด (ย้ายจาก BasePage) |
| `components/campaigns/SelectionBar.tsx` | สร้าง | แถบลอยด้านล่าง (ย้ายจาก BasePage) |
| `components/campaigns/BasePage.tsx` | แก้ | ใช้ `useOutreachMax` + `SelectionBar` |
| `components/leads/LeadTable.tsx` | แก้ | ห้องรายห้อง + ช่องติ๊ก + แถบเลือก (เมื่อ `selectable`) |
| `components/leads/LeadsPage.tsx` | แก้ | ส่ง `selectable` |
| `components/modals/CustomerModal.tsx` | แก้ | ห้องรายห้องใน popup |
| `e2e/visual-parity.spec.ts` | แก้ | `leadsText` ข้ามคอลัมน์ `.sel-col` (ไม่มีใน prototype โดยตั้งใจ) |
| `CLAUDE.md`, `docs/DATABASE.md` | แก้ | บันทึก migration/RPC ใหม่ |

---

### Task 1: RPC `dsales_rooms_for_phones` (+ ลง migration ชื่อห้องที่ค้าง)

**Files:**
- Create: `supabase/tests/12_rooms_for_phones.sql`
- Create: `supabase/migrations/20261123090000_dsales_rooms_for_phones.sql`
- ใช้ไฟล์ที่มีแล้ว: `supabase/migrations/20261123080000_dsales_customer_rooms_name.sql`, `supabase/tests/11_customer_rooms_name.sql`

- [ ] **Step 1: เขียน test**

`supabase/tests/12_rooms_for_phones.sql`:
```sql
begin;
-- dsales_rooms_for_phones (20261123090000): เซลล์ได้เฉพาะเบอร์ของลีดที่ตัวเองเป็นเจ้าของ, หัวหน้าได้ทุกเบอร์,
-- JSON ห้อง = dsales_customer_rooms, เบอร์ซ้ำ/ว่างถูกตัด, เกิน 100 เบอร์ = too_many_phones, 100 เบอร์ < 0.3 วินาที. Rolled back.
create temp table _r (k text, v text) on commit drop;
grant all on _r to authenticated;
do $$
declare
  v_admin uuid; v_sales uuid; v_phones text[]; v_mine text; v_other text; v_json jsonb; v_n int; v_ok boolean;
  t0 timestamptz; v_secs numeric;
begin
  select user_id into v_admin from dsales.dsales_members where role = 'admin' and active order by created_at limit 1;
  select id into v_sales from auth.users where id not in (select user_id from dsales.dsales_members) limit 1;
  insert into dsales.dsales_members (user_id, role, display_name, active) values (v_sales, 'sales', 'S1', true);
  -- 100 เบอร์ที่มีห้องผูกและยังไม่มีลีด
  select array_agg(p) into v_phones from (
    select distinct l.phone_normalized as p from dsales.dsales_chat_links l
    where not exists (select 1 from dsales.dsales_leads x where x.phone_normalized = l.phone_normalized)
    order by 1 limit 100) z;
  assert cardinality(v_phones) = 100, 'fixture: 100 linked phones without a lead';
  v_mine := v_phones[1];
  v_other := v_phones[2];
  insert into dsales.dsales_leads (source, brand, name, phone, phone_normalized, owner_id, claimed_by, claimed_at, created_by)
    values ('self', 'bebeplay', 'ทดสอบ', v_mine, v_mine, v_sales, v_sales, now(), v_sales);
  v_json := dsales.dsales_customer_rooms(v_mine); -- ก่อนสลับ role (ฟังก์ชันนี้ไม่ให้ authenticated เรียก)

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_sales, 'role', 'authenticated')::text, true);
  select count(*) into v_n from dsales.dsales_rooms_for_phones(array[v_mine, v_other, v_mine, ' ', null]);
  assert v_n = 1, format('sales gets only phones of own leads, deduped, got %s rows', v_n);
  assert (select r.rooms from dsales.dsales_rooms_for_phones(array[v_mine]) r) = v_json, 'rooms JSON = dsales_customer_rooms';
  assert (select r.phone from dsales.dsales_rooms_for_phones(array[' ' || v_mine]) r) = v_mine, 'phone trimmed';
  v_ok := false;
  begin
    perform dsales.dsales_rooms_for_phones(v_phones || array['0800000000']);
  exception when others then v_ok := sqlerrm = 'too_many_phones';
  end;
  assert v_ok, '101 phones -> too_many_phones';

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  select count(*) into v_n from dsales.dsales_rooms_for_phones(array[v_mine, v_other]);
  assert v_n = 2, format('admin gets every phone, got %s', v_n);
  t0 := clock_timestamp();
  perform * from dsales.dsales_rooms_for_phones(v_phones);
  v_secs := extract(epoch from clock_timestamp() - t0);
  insert into _r values ('admin_100_s', round(v_secs, 3)::text);
  assert v_secs < 0.3, format('100 phones too slow: %s s', v_secs);
  reset role;
end $$;
select string_agg(k || '=' || v, ', ') || ' | OK 12_rooms_for_phones' from _r;
rollback;
```

- [ ] **Step 2: รัน test ให้เห็นว่าไม่ผ่าน**

รันเนื้อไฟล์ทั้งไฟล์ด้วย MCP `execute_sql` (`project_id = "nroyacasuchqniaiuirk"`)
Expected: ERROR `function dsales.dsales_rooms_for_phones(text[]) does not exist`

- [ ] **Step 3: เขียน migration**

`supabase/migrations/20261123090000_dsales_rooms_for_phones.sql`:
```sql
-- dsales: ห้องแชตของหลายเบอร์สำหรับหน้า Direct Sale (2026-11-23, spec 2026-11-23-direct-sale-followup-design.md ข้อ 5.2).
-- คืน (phone, rooms) โดย rooms = dsales_customer_rooms(phone) (ms_id, provider, page, brand, sendable, name,
-- และ outer_user_id / meta_page_id / meta_business_id ของ FB/IG) เฉพาะเบอร์ของลีดที่ผู้เรียกเป็นเจ้าของ — หัวหน้าได้ทุกเบอร์
-- เบอร์ซ้ำ/ว่างถูกตัด · เกิน 100 เบอร์ = too_many_phones (หน้าเว็บแบ่งส่งทีละ 100)
-- dsales_customer_rooms อ่านห้องผ่าน dsales_room_of (inline + index) จึงเร็ว (~0.5 ms/เบอร์)

create or replace function dsales.dsales_rooms_for_phones(p_phones text[])
returns table (phone text, rooms jsonb)
language plpgsql stable security definer set search_path = dsales, public as $$
declare me uuid := dsales.dsales_uid(); v_admin boolean := dsales.dsales_is_admin(); v_list text[];
begin
  select coalesce(array_agg(distinct btrim(x)), '{}') into v_list
  from unnest(coalesce(p_phones, '{}')) x where nullif(btrim(x), '') is not null;
  if cardinality(v_list) > 100 then raise exception 'too_many_phones'; end if;
  return query
  select p, dsales.dsales_customer_rooms(p)
  from unnest(v_list) p
  where v_admin or exists (select 1 from dsales.dsales_leads l where l.phone_normalized = p and l.owner_id = me);
end $$;

revoke all on function dsales.dsales_rooms_for_phones(text[]) from public, anon;
grant execute on function dsales.dsales_rooms_for_phones(text[]) to authenticated;
```

- [ ] **Step 4: Dry run**

`execute_sql` ครั้งเดียว = `begin;` + เนื้อ `20261123080000_dsales_customer_rooms_name.sql` + เนื้อ `20261123090000_dsales_rooms_for_phones.sql` + test 11 (ตัด `begin;`/`rollback;`) + test 12 (ตัด `begin;`/`rollback;`) + `rollback;`
Expected: แถวสุดท้าย `admin_100_s=0.0xx | OK 12_rooms_for_phones` ไม่มี ERROR

- [ ] **Step 5: ขออนุมัติผู้ใช้ก่อนลง production**

ถามผู้ใช้ตรง ๆ: "ลง migration `dsales_customer_rooms_name` และ `dsales_rooms_for_phones` ใน Supabase production ไหม" — ต้องได้คำตอบ yes ก่อน (ครั้งก่อน `apply_migration` ถูกระบบสิทธิ์บล็อกเมื่อยังไม่ได้รับอนุมัติ) ถ้ายังไม่อนุมัติ ข้ามไป Task 2–8 ได้ (หน้าเว็บ fallback เป็นช่องทางแบบเดิมเมื่อ RPC ยังไม่มี) แล้วกลับมาทำ Step 6–7 ก่อน Task 9

- [ ] **Step 6: ลง migration ทีละไฟล์**

`apply_migration` name `dsales_customer_rooms_name` (เนื้อไฟล์ 20261123080000) แล้ว `apply_migration` name `dsales_rooms_for_phones` (เนื้อไฟล์ 20261123090000)
Expected: `{"success":true}` ทั้งสองครั้ง

- [ ] **Step 7: รัน test + regression ทีละไฟล์ (1 ไฟล์ต่อ 1 การเรียก `execute_sql`)**

ลำดับ: `11_customer_rooms_name.sql`, `12_rooms_for_phones.sql`, `09_base_customers_chat.sql`, `10_buyer_id_room_links.sql`, `08c_outreach_room.sql`
Expected: ทุกไฟล์ผ่าน (09: `default_s` < 1, `has_chat_s` < 3)

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20261123090000_dsales_rooms_for_phones.sql supabase/tests/12_rooms_for_phones.sql
git commit -m "feat(db): dsales_rooms_for_phones — chat rooms of many phones for the Direct Sale page"
```

---

### Task 2: `getRoomsForPhones` ใน rpc.ts

**Files:**
- Modify: `lib/api/types.ts` (ต่อจาก `ChatRoomJson` บรรทัด ~65)
- Modify: `lib/api/rpc.ts` (หมวดลีด ต่อจาก `getMyLeads` บรรทัด ~38)
- Modify: `lib/api/errors.ts` (map ข้อความ ใกล้ `batch_too_large` บรรทัด ~22)
- Test: `lib/api/rpc.test.ts`, `lib/api/errors.test.ts`

- [ ] **Step 1: เขียน test ที่ล้ม**

ใน `lib/api/rpc.test.ts` เพิ่ม `getRoomsForPhones` ใน import จาก `./rpc` แล้วต่อท้ายไฟล์:
```ts
describe('getRoomsForPhones', () => {
  it('sends unique trimmed phones in chunks of 100 and joins the rows', async () => {
    rpc.mockImplementation(async (_fn: string, args: { p_phones: string[] }) => ({
      data: args.p_phones.map((p) => ({ phone: p, rooms: [] })), error: null,
    }));
    const phones = Array.from({ length: 250 }, (_, i) => `08${String(i).padStart(8, '0')}`);
    const rows = await getRoomsForPhones([...phones, ` ${phones[0]} `, '', '  ']);
    expect(rpc.mock.calls.map((c) => [c[0], (c[1] as { p_phones: string[] }).p_phones.length])).toEqual([
      ['dsales_rooms_for_phones', 100], ['dsales_rooms_for_phones', 100], ['dsales_rooms_for_phones', 50],
    ]);
    expect(rows).toHaveLength(250);
  });
  it('no phones = no call; null data = no rows', async () => {
    await expect(getRoomsForPhones([])).resolves.toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(getRoomsForPhones(['0812345678'])).resolves.toEqual([]);
  });
});
```
ใน `lib/api/errors.test.ts` ต่อท้าย describe แรกของไฟล์ (หรือท้ายไฟล์):
```ts
it('too_many_phones has a Thai message', () => {
  expect(toThaiError('too_many_phones')).toBe('ส่งเบอร์เกินจำนวนสูงสุดต่อครั้ง');
});
```
(ถ้า `toThaiError` ยังไม่ถูก import ใน errors.test.ts ให้เพิ่ม `import { toThaiError } from './errors';`)

- [ ] **Step 2: รัน test ให้ล้ม**

Run: `npx vitest run lib/api/rpc.test.ts lib/api/errors.test.ts`
Expected: FAIL — `getRoomsForPhones is not a function` / ข้อความ error ไม่ตรง

- [ ] **Step 3: เขียนโค้ด**

`lib/api/types.ts` ต่อจากบรรทัด `export interface ChatRoom …`:
```ts
/** แถวของ dsales_rooms_for_phones */
export interface RoomsForPhoneRow { phone: string; rooms: ChatRoomJson[] | null }
```
`lib/api/rpc.ts`: เพิ่ม `RoomsForPhoneRow` ใน import type จาก `./types` แล้วต่อจาก `getMyLeads`:
```ts
/** ห้องแชตของหลายเบอร์ (ลีดของฉัน; หัวหน้า = ทุกเบอร์) — ตัดซ้ำ/ว่าง แล้วส่งทีละ 100 เบอร์ (ขีดจำกัดของ RPC) */
export async function getRoomsForPhones(phones: ReadonlyArray<string>): Promise<RoomsForPhoneRow[]> {
  const uniq = [...new Set(phones.map((p) => p.trim()).filter(Boolean))];
  const out: RoomsForPhoneRow[] = [];
  for (let i = 0; i < uniq.length; i += 100) {
    out.push(...((await call<RoomsForPhoneRow[] | null>('dsales_rooms_for_phones', { p_phones: uniq.slice(i, i + 100) })) ?? []));
  }
  return out;
}
```
`lib/api/errors.ts` ใน object ข้อความ ต่อจาก `batch_too_large`:
```ts
  too_many_phones: 'ส่งเบอร์เกินจำนวนสูงสุดต่อครั้ง',
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `npx vitest run lib/api/rpc.test.ts lib/api/errors.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/api/types.ts lib/api/rpc.ts lib/api/rpc.test.ts lib/api/errors.ts lib/api/errors.test.ts
git commit -m "feat(web): getRoomsForPhones (dsales_rooms_for_phones in chunks of 100)"
```

---

### Task 3: เลือกลีดเพื่อส่งข้อความ (`leadSelectable`, `leadSelRow`)

**Files:**
- Modify: `lib/domain/outreach.ts` (ต่อจาก `toggleSelect` / `setPageSelected`)
- Test: `lib/domain/outreach.test.ts`

- [ ] **Step 1: เขียน test ที่ล้ม**

ต่อท้าย `lib/domain/outreach.test.ts` (เพิ่ม `leadSelectable, leadSelRow` ใน import จาก `./outreach` และ `import type { ChatRoom } from '@/lib/api/types';` ถ้ายังไม่มี):
```ts
describe('Direct Sale: tick leads to send a message', () => {
  const room = (over: Partial<ChatRoom>): ChatRoom => ({ msId: 1, provider: 'line', page: 'Bebeplayofficial', brand: 'bebeplay', sendable: true, ...over });
  const lead = { phone: '0811111111', name: 'คุณเอ', brand: 'hosttail' as const, chatName: 'เอ แชต', owner: 'u1' };
  it('only leads I own can be ticked', () => {
    expect(leadSelectable(lead, 'u1')).toBe(true);
    expect(leadSelectable(lead, 'u2')).toBe(false);
    expect(leadSelectable({ owner: null }, 'u1')).toBe(false);
    expect(leadSelectable(lead, '')).toBe(false);
  });
  it('builds the selection row from the lead and its rooms (sendable brands only)', () => {
    const rooms = [room({ msId: 1 }), room({ msId: 2, brand: 'hosttail', sendable: false }), room({ msId: 3, brand: null, sendable: false })];
    expect(leadSelRow(lead, rooms)).toEqual({
      phone: '0811111111', name: 'คุณเอ', brands: ['hosttail'], chat: 'เอ แชต', taken: null, mine: true, chatBrands: ['bebeplay'], chatRooms: rooms,
    });
    expect(leadSelRow(lead, undefined)).toEqual({
      phone: '0811111111', name: 'คุณเอ', brands: ['hosttail'], chat: 'เอ แชต', taken: null, mine: true, chatBrands: [],
    });
  });
});
```

- [ ] **Step 2: รัน test ให้ล้ม**

Run: `npx vitest run lib/domain/outreach.test.ts`
Expected: FAIL — `leadSelectable is not a function`

- [ ] **Step 3: เขียนโค้ด**

ใน `lib/domain/outreach.ts` เพิ่ม `Lead` ใน import type จาก `@/lib/api/types` แล้วต่อจาก `pageCheckState`:
```ts
/* ---------- หน้า Direct Sale: ติ๊กลีดเพื่อส่งข้อความ ---------- */
/** ติ๊กได้เฉพาะลีดที่ฉันเป็นเจ้าของ (ลีดแคมเปญที่ยังไม่จอง/ของคนอื่น enqueue จะข้ามเป็น taken อยู่ดี) */
export const leadSelectable = (l: Pick<Lead, 'owner'>, meId: string): boolean => !!meId && l.owner === meId;

/** ภาพของลีดสำหรับ SendOutreachModal — chatBrands = แบรนด์ที่มีห้องส่งได้ (จาก useLeadRooms) */
export function leadSelRow(l: Pick<Lead, 'phone' | 'name' | 'brand' | 'chatName'>, rooms: ReadonlyArray<ChatRoom> | undefined): SelRow {
  const rs = rooms ?? [];
  const chatBrands = [...new Set(rs.filter((r) => r.sendable && r.brand).map((r) => r.brand as Brand))];
  return {
    phone: l.phone, name: l.name, brands: [l.brand], chat: l.chatName, taken: null, mine: true, chatBrands,
    ...(rs.length ? { chatRooms: [...rs] } : {}),
  };
}
```

- [ ] **Step 4: รัน test ให้ผ่าน**

Run: `npx vitest run lib/domain/outreach.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/domain/outreach.ts lib/domain/outreach.test.ts
git commit -m "feat(web): leadSelectable / leadSelRow for sending messages from Direct Sale"
```

---

### Task 4: component กลาง `RoomIcons` / `RoomChips` (ย้ายจาก ChannelCell)

**Files:**
- Create: `components/leads/RoomIcons.tsx`
- Modify: `components/campaigns/ChannelCell.tsx` (ทั้งไฟล์)

- [ ] **Step 1: สร้าง `components/leads/RoomIcons.tsx`**

```tsx
'use client';

import type { OpenJst } from '@/components/leads/ContactBar';
import { ChIcon } from '@/components/ui/ChIcon';
import type { ChatRoom } from '@/lib/api/types';
import type { Brand } from '@/lib/constants';
import { roomOpensMeta, roomSearchName, roomTitle } from '@/lib/domain/baseFilters';
import { browserJstDeps, jstTarget, metaOpen, platLabel, type JstTarget } from '@/lib/jst';
import { useActions } from '@/lib/state/AppProvider';

/** เจ้าของห้อง: ลูกค้า (เบอร์/ชื่อ/ชื่อแชตของลูกค้า/แบรนด์เริ่มต้นเมื่อห้องไม่มีแบรนด์) */
export interface RoomOwner { phone: string; name: string; chat: string; brand: Brand }

/** เป้าหมายเปิดแชต JST ของห้อง — คำค้น = ชื่อของห้องนั้น → ชื่อแชตลูกค้า → ชื่อลูกค้า */
export const roomTarget = (who: RoomOwner, room: ChatRoom): JstTarget =>
  jstTarget(
    { phone: who.phone, name: who.name, brand: room.brand ?? who.brand, chatName: who.chat },
    { shop: room.page, chat: roomSearchName(room, who), platform: room.provider, ms_id: room.msId },
  );

/** กดห้อง: FB/IG เกิน 24 ชม. ที่รู้ page id → Inbox ของเพจใน Meta (คัดลอกชื่อห้อง) · ห้องอื่น → แชตใน JST */
function useOpenRoom(openJst: OpenJst): (who: RoomOwner, room: ChatRoom) => void {
  const { toast } = useActions();
  return (who, room) => {
    const t = roomTarget(who, room);
    if (roomOpensMeta(room) && room.metaInbox) void metaOpen(room.metaInbox, t.chat, room.page, browserJstDeps(toast));
    else openJst(t);
  };
}

function roomProps(who: RoomOwner, room: ChatRoom) {
  const meta = roomOpensMeta(room);
  return {
    'data-act': meta ? 'meta' : 'jst',
    'data-room': room.msId,
    'data-sendable': room.sendable ? '1' : '0',
    'data-t': JSON.stringify(roomTarget(who, room)),
    title: roomTitle(room),
    'aria-label': meta ? `เปิด Inbox เพจ ${room.page} ใน Meta Business Suite` : `เปิดแชต ${platLabel(room.provider)} ${room.page} ใน JST`,
    style: room.sendable ? undefined : { opacity: 0.4 },
  };
}

/** ไอคอนห้องรายห้อง 16px (ในตาราง) — ห้องที่ worker ส่งไม่ได้แสดงจาง */
export function RoomIcons({ who, rooms, openJst }: { who: RoomOwner; rooms: ReadonlyArray<ChatRoom>; openJst: OpenJst }) {
  const open = useOpenRoom(openJst);
  return (
    <>
      {rooms.map((room) => (
        <button key={room.msId} type="button" className="ch-btn" {...roomProps(who, room)} onClick={() => open(who, room)}>
          <ChIcon p={room.provider} size={16} />
        </button>
      ))}
    </>
  );
}

/** ชิปห้องรายห้อง (ใน popup ลูกค้า): ไอคอน + เพจ + ชื่อห้อง */
export function RoomChips({ who, rooms, openJst }: { who: RoomOwner; rooms: ReadonlyArray<ChatRoom>; openJst: OpenJst }) {
  const open = useOpenRoom(openJst);
  if (!rooms.length) return <span className="sub">ไม่พบช่องทางแชต</span>;
  return (
    <div className="ch-chips">
      {rooms.map((room) => (
        <button key={room.msId} type="button" className="ch-chip" {...roomProps(who, room)} onClick={() => open(who, room)}>
          <ChIcon p={room.provider} size={18} />
          <span>{room.page || platLabel(room.provider)}{room.name ? ` · ${room.name}` : ''}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: แก้ `components/campaigns/ChannelCell.tsx` ให้ใช้ `RoomIcons`** (แทนทั้งไฟล์)

```tsx
'use client';

import { CallButton, type OpenJst } from '@/components/leads/ContactBar';
import { RoomIcons } from '@/components/leads/RoomIcons';
import type { PoolRow } from '@/lib/api/types';
import type { Brand } from '@/lib/constants';

/** ปุ่มโทร + ไอคอนห้องแชตของลูกค้า (chat_rooms) — กดแล้วคัดลอกชื่อห้อง + เปิด JST หรือ Meta Inbox (RoomIcons) */
export function ChannelCell({ r, brand, openJst }: { r: PoolRow; brand: Brand; openJst: OpenJst }) {
  return (
    <span className="ch-bar mini ch-cell">
      <CallButton phone={r.phone} />
      <RoomIcons who={{ phone: r.phone, name: r.name, chat: r.chat, brand }} rooms={r.chatRooms} openJst={openJst} />
    </span>
  );
}
```

- [ ] **Step 3: ตรวจ type/lint/test**

Run: `npm run typecheck && npx next lint --dir components && npx vitest run`
Expected: tsc ไม่มี error, `✔ No ESLint warnings or errors`, Vitest ผ่านทั้งหมด

- [ ] **Step 4: ตรวจ /mine ยังทำงานเหมือนเดิม**

เปิด dev server `directsale-links-live` (port 3220, ดู `.claude/launch.json`) ในแท็บแยก ไปที่ `/mine` แล้วรันใน javascript_tool:
```js
[...document.querySelectorAll('button.ch-btn[data-room]')].slice(0, 4).map(b => [b.dataset.act, b.dataset.sendable, b.title])
```
Expected: ห้อง FB Bebeplay ที่จาง = `meta`, ห้องอื่น = `jst`, title มีชื่อเพจ (เหมือนก่อนแก้)

- [ ] **Step 5: Commit**

```bash
git add components/leads/RoomIcons.tsx components/campaigns/ChannelCell.tsx
git commit -m "refactor(web): shared RoomIcons / RoomChips for per-room chat buttons"
```

---

### Task 5: hook `useLeadRooms`

**Files:**
- Create: `components/leads/useLeadRooms.ts`

- [ ] **Step 1: สร้างไฟล์**

```ts
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { mapChatRoom } from '@/lib/api/map';
import { getRoomsForPhones } from '@/lib/api/rpc';
import type { ChatRoom, Lead } from '@/lib/api/types';
import { useActions, useAppState } from '@/lib/state/AppProvider';

/**
 * ห้องแชตของลีด (dsales_rooms_for_phones) — เฉพาะลีดที่มีเจ้าของ: ของฉัน (หัวหน้า: ทุกคน) ตรงกับสิทธิ์ของ RPC
 * เก็บไว้ข้ามการกรอง/ค้นหา โหลดเฉพาะเบอร์ที่ยังไม่เคยขอ · โหลดไม่สำเร็จ = toast ครั้งเดียว แล้วใช้ช่องทางแบบเดิม (map ว่าง)
 * โหมด fixture: ไม่โหลด (คืน map ว่าง → ตารางใช้ ContactBar แบบเดิม)
 */
export function useLeadRooms(leads: ReadonlyArray<Pick<Lead, 'phone' | 'owner'>>): ReadonlyMap<string, ChatRoom[]> {
  const { live, meId, isAdmin } = useAppState();
  const { toast, handleAuthError } = useActions();
  const [rooms, setRooms] = useState<ReadonlyMap<string, ChatRoom[]>>(() => new Map());
  const asked = useRef(new Set<string>());
  const warned = useRef(false);
  const want = useMemo(
    () => leads.filter((l) => l.owner && (isAdmin || l.owner === meId)).map((l) => l.phone),
    [leads, isAdmin, meId],
  );

  useEffect(() => {
    if (!live) return;
    const missing = want.filter((p) => !asked.current.has(p));
    if (!missing.length) return;
    for (const p of missing) asked.current.add(p);
    getRoomsForPhones(missing).then(
      (rows) => {
        setRooms((prev) => {
          const next = new Map(prev);
          for (const p of missing) next.set(p, []);
          for (const r of rows) next.set(r.phone, (r.rooms ?? []).map(mapChatRoom));
          return next;
        });
      },
      (e: unknown) => {
        for (const p of missing) asked.current.delete(p);
        if (handleAuthError(e) || warned.current) return;
        warned.current = true;
        toast('โหลดห้องแชตไม่สำเร็จ ใช้ช่องทางแชตแบบเดิมไปก่อน');
      },
    );
  }, [live, want, toast, handleAuthError]);

  return rooms;
}
```

- [ ] **Step 2: ตรวจ type/lint**

Run: `npm run typecheck && npx next lint --dir components`
Expected: ไม่มี error

- [ ] **Step 3: Commit**

```bash
git add components/leads/useLeadRooms.ts
git commit -m "feat(web): useLeadRooms loads chat rooms of the leads on screen"
```

---

### Task 6: แยก `useOutreachMax` + `SelectionBar` ออกจาก BasePage

**Files:**
- Create: `components/campaigns/useOutreachMax.ts`
- Create: `components/campaigns/SelectionBar.tsx`
- Modify: `components/campaigns/BasePage.tsx` (state `liveMax` + effect บรรทัด ~64–85, แถบ `#sel-bar` บรรทัด ~299–318, import บรรทัด 10 และ 20)

- [ ] **Step 1: สร้าง `components/campaigns/useOutreachMax.ts`**

```ts
'use client';

import { useEffect, useState } from 'react';
import { getWorkerStatus } from '@/lib/api/rpc';
import { maxBatch } from '@/lib/domain/outreach';
import { useActions, useAppState } from '@/lib/state/AppProvider';

/** จำนวนสูงสุดต่อชุดจาก dsales_worker_status_get — โหลดครั้งแรกเมื่อ active (เริ่มติ๊ก); ล้มเหลว = ค่าเริ่มต้น 50 · โหมด fixture = ค่าตัวอย่าง */
export function useOutreachMax(active: boolean): number {
  const { live, outreachDemo } = useAppState();
  const { handleAuthError } = useActions();
  const [liveMax, setLiveMax] = useState<number | null>(null);
  const want = live && active && liveMax === null;
  useEffect(() => {
    if (!want) return;
    let alive = true;
    getWorkerStatus().then(
      (s) => {
        if (alive) setLiveMax(maxBatch(s?.settings));
      },
      (e: unknown) => {
        if (alive && !handleAuthError(e)) setLiveMax(maxBatch(null));
      },
    );
    return () => {
      alive = false;
    };
  }, [want, handleAuthError]);
  return live ? (liveMax ?? maxBatch(null)) : maxBatch(outreachDemo?.worker.settings);
}
```

- [ ] **Step 2: สร้าง `components/campaigns/SelectionBar.tsx`**

```tsx
'use client';

import type { ReactNode } from 'react';
import { selectionBar } from '@/lib/domain/outreach';

/** แถบลอยด้านล่าง "เลือก N คน" + ล้าง + ปุ่มเพิ่ม (extra) + ส่งข้อความ — ซ่อนเมื่อไม่ได้เลือก (id เดิมของ /mine: #sel-bar #sel-clear #sel-send) */
export function SelectionBar({ count, max, onClear, onSend, extra }: {
  count: number; max: number; onClear: () => void; onSend: () => void; extra?: ReactNode;
}) {
  if (!count) return null;
  const bar = selectionBar(count, max);
  return (
    <div className="panel" id="sel-bar" style={{ position: 'sticky', bottom: 12, zIndex: 4, boxShadow: 'var(--shadow)' }}>
      <div className="panel-b toolbar">
        <b className="num">{bar.text}</b>
        {bar.over ? <span className="sub" style={{ color: 'var(--bad)' }}>{bar.over}</span> : <span className="sub">สูงสุด {max} คนต่อชุด</span>}
        <span style={{ flex: 1 }} />
        <button className="btn" id="sel-clear" onClick={onClear}>ล้าง</button>
        {extra}
        <button className="btn primary" id="sel-send" disabled={!bar.canSend} onClick={onSend}>{bar.text} · ส่งข้อความ</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: แก้ BasePage ให้ใช้ทั้งสอง**

ใน `components/campaigns/BasePage.tsx`:
1. ลบ state `liveMax`, ตัวแปร `wantMax`, effect ที่เรียก `getWorkerStatus()` ทั้งก้อน และบรรทัด `const max = live ? (liveMax ?? maxBatch(null)) : maxBatch(outreachDemo?.worker.settings);` แล้วใส่แทน:
```tsx
  const max = useOutreachMax(sel.size > 0);
```
2. import: เอา `getWorkerStatus` ออกจาก import ของ `@/lib/api/rpc`; เอา `maxBatch` ออกจาก import ของ `@/lib/domain/outreach`; เพิ่ม
```tsx
import { SelectionBar } from './SelectionBar';
import { useOutreachMax } from './useOutreachMax';
```
3. แทนก้อน `{sel.size ? ( <div className="panel" id="sel-bar" … </div> ) : null}` ทั้งก้อนด้วย:
```tsx
      <SelectionBar
        count={sel.size} max={max} onClear={() => setSel(new Map())} onSend={openSend}
        extra={scope === 'mine' ? (
          <button
            className="btn" id="sel-follow" disabled={!bar.canSend} title="ส่งลูกค้าที่เลือกเข้าหน้า Direct Sale เพื่อติดตามใกล้ชิด"
            onClick={() => void bulkFollow([...sel.values()], f.brand, () => setSel(new Map()))}
          >
            เข้า Direct Sale
          </button>
        ) : null}
      />
```
(`bar` ยังใช้ใน `openSend` และปุ่ม `sel-follow` — คงบรรทัด `const bar = selectionBar(sel.size, max);` ไว้; ถ้า `outreachDemo` ไม่ถูกใช้แล้วให้เอาออกจาก destructure ของ `useAppState()`)

- [ ] **Step 4: ตรวจ type/lint/test**

Run: `npm run typecheck && npx next lint --dir components && npx vitest run`
Expected: ไม่มี error, Vitest ผ่านทั้งหมด

- [ ] **Step 5: ตรวจ /mine ยังเหมือนเดิม**

ในแท็บแยกของ dev server ไป `/mine` แล้วรัน:
```js
for (let i = 0; i < 20 && !document.querySelector('input[data-sel]'); i++) await new Promise(r => setTimeout(r, 1000));
[...document.querySelectorAll('input[data-sel]')].slice(0, 2).forEach(b => b.click());
await new Promise(r => setTimeout(r, 400));
document.querySelector('#sel-bar').innerText.replace(/\n/g, ' | ')
```
Expected: `เลือก 2 คน | สูงสุด 50 คนต่อชุด | ล้าง | เข้า Direct Sale | เลือก 2 คน · ส่งข้อความ` (ห้ามกดปุ่ม — เขียนข้อมูลจริง)

- [ ] **Step 6: Commit**

```bash
git add components/campaigns/useOutreachMax.ts components/campaigns/SelectionBar.tsx components/campaigns/BasePage.tsx
git commit -m "refactor(web): SelectionBar and useOutreachMax shared by /mine and Direct Sale"
```

---

### Task 7: ตาราง Direct Sale — ห้องรายห้อง + ติ๊กส่งข้อความ

**Files:**
- Modify: `components/leads/LeadTable.tsx`
- Modify: `components/leads/LeadsPage.tsx:29`
- Modify: `e2e/visual-parity.spec.ts` (ฟังก์ชัน `leadsText` บรรทัด ~216–242)

- [ ] **Step 1: แก้ e2e ก่อน — `leadsText` ข้ามคอลัมน์ติ๊ก**

ใน `leadsText` เปลี่ยนสองบรรทัด `head` / `rows` เป็น:
```ts
      // คอลัมน์ติ๊กส่งข้อความ (.sel-col) มีเฉพาะฝั่ง Next (spec 2026-11-23 ข้อ 5.3) — ไม่เทียบกับ prototype
      head: all('thead th:not(.sel-col)').map(t),
      rows: all('tbody tr').map((tr) => Array.from(tr.children).filter((c) => !c.classList.contains('sel-col')).map(t)),
```

- [ ] **Step 2: แก้ `LeadTable.tsx`**

2.1 import เพิ่ม (รวมกับ import เดิมของไฟล์):
```tsx
import { useState } from 'react';
import { SelectionBar } from '@/components/campaigns/SelectionBar';
import { useOutreachMax } from '@/components/campaigns/useOutreachMax';
import { CallButton } from '@/components/leads/ContactBar';
import { SendOutreachModal } from '@/components/modals/SendOutreachModal';
import type { ChatRoom } from '@/lib/api/types';
import { defaultOutreachBrand, leadSelectable, leadSelRow, pageCheckState, setPageSelected, toggleSelect, type SelRow } from '@/lib/domain/outreach';
import { useActions } from '@/lib/state/AppProvider';
import { RoomIcons } from './RoomIcons';
import { useLeadRooms } from './useLeadRooms';
```
(`useState` รวมเข้ากับ `import { Fragment, memo, useMemo } from 'react';` และ `useActions` รวมกับ import `useAppState` เดิม)

2.2 `RowCtx` และ props:
```tsx
export interface TableOpts { mode?: ClaimMode; perCamp?: boolean; selectable?: boolean }

interface RowCtx {
  reps: Rep[]; campaigns: Campaign[]; meId: string; isAdmin: boolean; today: string; act: LeadActions; openJst: OpenJst;
  rooms: ReadonlyMap<string, ChatRoom[]>; selectable: boolean; sel: ReadonlyMap<string, SelRow>; toggle: (l: Lead) => void;
}
```

2.3 ตัว `LeadTable` (แทนทั้ง function):
```tsx
export function LeadTable({ list, opts = {} }: { list: Lead[]; opts?: TableOpts }) {
  const { reps, campaigns, meId, isAdmin, today } = useAppState();
  const { openModal } = useActions();
  const act = useLeadActions();
  const openJst = useJst();
  const rooms = useLeadRooms(list);
  const selectable = !!opts.selectable;
  const [sel, setSel] = useState<ReadonlyMap<string, SelRow>>(() => new Map());
  const max = useOutreachMax(sel.size > 0);
  const pickable = useMemo(
    () => (selectable ? list.filter((l) => leadSelectable(l, meId)).map((l) => leadSelRow(l, rooms.get(l.phone))) : []),
    [selectable, list, meId, rooms],
  );
  const pageState = pageCheckState(sel, pickable);
  const toggle = useMemo(() => (l: Lead) => setSel((m) => toggleSelect(m, leadSelRow(l, rooms.get(l.phone)))), [rooms]);
  // ctx คงที่จนกว่าทีม/แคมเปญ/วันนี้/ห้อง/ที่เลือกเปลี่ยน → พิมพ์ค้นหาแล้วแถวที่ลีดไม่เปลี่ยนไม่ต้องวาดใหม่ (memo)
  const ctx = useMemo<RowCtx>(
    () => ({ reps, campaigns, meId, isAdmin, today, act, openJst, rooms, selectable, sel, toggle }),
    [reps, campaigns, meId, isAdmin, today, act, openJst, rooms, selectable, sel, toggle],
  );
  const openSend = () => {
    const picked = [...sel.values()];
    openModal(<SendOutreachModal rows={picked} defaultBrand={defaultOutreachBrand(picked, null)} onSent={() => setSel(new Map())} />);
  };
  return (
    <>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              {selectable ? (
                <th className="sel-col" style={{ width: 1 }}>
                  <input
                    type="checkbox" id="lead-sel-page" aria-label="เลือกลีดของฉันทุกแถวที่แสดง" disabled={!pickable.length}
                    checked={pageState === 'all' && pickable.length > 0}
                    onChange={(e) => setSel((m) => setPageSelected(m, pickable, e.target.checked))}
                  />
                </th>
              ) : null}
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
              <tr><td colSpan={selectable ? 10 : 9} className="empty">ไม่พบรายการที่ตรงกับตัวกรอง</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {selectable ? <SelectionBar count={sel.size} max={max} onClear={() => setSel(new Map())} onSend={openSend} /> : null}
    </>
  );
}
```

2.4 ใน `LeadRow`: destructure เพิ่ม `rooms, selectable, sel, toggle` จาก `ctx`; ให้ `<tr>` เป็น `<tr className={sel.has(l.phone) ? 'sel' : undefined}>`; ใส่เป็น cell แรกของแถว:
```tsx
      {selectable ? (
        <td className="sel-col">
          {leadSelectable(l, meId) ? (
            <input type="checkbox" data-lead-sel={l.phone} aria-label={`เลือก ${l.name}`} checked={sel.has(l.phone)} onChange={() => toggle(l)} />
          ) : null}
        </td>
      ) : null}
```
และแทนบรรทัด `<ContactBar x={l} chans={channelsOf(l)} mini openJst={openJst} />` ด้วย:
```tsx
        {rooms.get(l.phone)?.length ? (
          <span className="ch-bar mini">
            <CallButton phone={l.phone} />
            <RoomIcons who={{ phone: l.phone, name: l.name, chat: l.chatName, brand: l.brand }} rooms={rooms.get(l.phone) ?? []} openJst={openJst} />
          </span>
        ) : (
          <ContactBar x={l} chans={channelsOf(l)} mini openJst={openJst} />
        )}
```

- [ ] **Step 3: เปิดใช้ในหน้า Direct Sale**

`components/leads/LeadsPage.tsx:29`: `<LeadTable list={list} />` → `<LeadTable list={list} opts={{ selectable: true }} />`
(หน้าแคมเปญ `CampaignPage.tsx:95` ไม่ส่ง `selectable` → ไม่มีคอลัมน์ติ๊ก แต่ได้ไอคอนห้องรายห้องด้วย)

- [ ] **Step 4: ตรวจ type/lint/test**

Run: `npm run typecheck && npx next lint --dir components && npx vitest run`
Expected: ไม่มี error, Vitest ผ่านทั้งหมด

- [ ] **Step 5: ตรวจใน dev server (ข้อมูลจริง, แท็บแยก, ห้ามกดส่ง)**

ไป `/leads` แล้วรัน:
```js
for (let i = 0; i < 20 && !document.querySelector('tbody tr td'); i++) await new Promise(r => setTimeout(r, 1000));
await new Promise(r => setTimeout(r, 2000));
const boxes = [...document.querySelectorAll('input[data-lead-sel]')];
boxes.slice(0, 2).forEach(b => b.click());
await new Promise(r => setTimeout(r, 400));
({ ticks: boxes.length, roomIcons: document.querySelectorAll('tbody button.ch-btn[data-room]').length,
   bar: document.querySelector('#sel-bar')?.innerText.replace(/\n/g, ' | ') })
```
Expected: `ticks` = จำนวนลีดของฉันในหน้า, `roomIcons` > 0 (ถ้า Task 1 ลง migration แล้ว), `bar` = `เลือก 2 คน | สูงสุด 50 คนต่อชุด | ล้าง | เลือก 2 คน · ส่งข้อความ` · กด `#sel-send` แล้วดูว่า popup ส่งข้อความเปิดและ preview ขึ้น จากนั้นกดปิด popup (ห้ามกดปุ่ม "ส่ง N รายการ")

- [ ] **Step 6: Commit**

```bash
git add components/leads/LeadTable.tsx components/leads/LeadsPage.tsx e2e/visual-parity.spec.ts
git commit -m "feat(web): Direct Sale table — per-room chat buttons and tick leads to send a message"
```

---

### Task 8: popup ลูกค้า — ห้องรายห้อง

**Files:**
- Modify: `components/modals/CustomerModal.tsx` (บรรทัด ~4 import, ~75 header, ~93 แถว "ช่องทางแชต")

- [ ] **Step 1: แก้ CustomerModal**

import เพิ่ม:
```tsx
import { CallButton } from '@/components/leads/ContactBar';
import { RoomChips, RoomIcons } from '@/components/leads/RoomIcons';
import { useLeadRooms } from '@/components/leads/useLeadRooms';
```
(รวม `CallButton` เข้ากับ import `ChannelRow, ContactBar` เดิมจาก `@/components/leads/ContactBar`)

ในตัว component หลังจากได้ `l` (ลีด) และ `chans`:
```tsx
  const leadRooms = useLeadRooms(useMemo(() => [l], [l]));
  const rooms = leadRooms.get(l.phone) ?? [];
  const who = { phone: l.phone, name: l.name, chat: l.chatName, brand: l.brand };
```
(เพิ่ม `useMemo` ใน import จาก `react` ถ้ายังไม่มี — hook ต้องอยู่ก่อน `return` ใด ๆ ที่มีเงื่อนไข)

header: แทน `<ContactBar x={l} chans={chans} openJst={openJst} />` ด้วย
```tsx
        {rooms.length ? (
          <span className="ch-bar"><CallButton phone={l.phone} /><RoomIcons who={who} rooms={rooms} openJst={openJst} /></span>
        ) : (
          <ContactBar x={l} chans={chans} openJst={openJst} />
        )}
```
แถว "ช่องทางแชต (แยกตามร้าน)": แทน `<ChannelRow x={l} chans={chans} openJst={openJst} />` ด้วย
```tsx
{rooms.length ? <RoomChips who={who} rooms={rooms} openJst={openJst} /> : <ChannelRow x={l} chans={chans} openJst={openJst} />}
```

- [ ] **Step 2: ตรวจ type/lint/test**

Run: `npm run typecheck && npx next lint --dir components && npx vitest run`
Expected: ไม่มี error

- [ ] **Step 3: ตรวจใน dev server**

ใน `/leads` คลิกชื่อลีดของฉันที่มีห้อง (`button.cust-name`) แล้วรัน:
```js
[...document.querySelectorAll('.modal .ch-chip[data-room]')].map(b => [b.dataset.act, b.innerText.trim()])
```
Expected: ชิปรายห้อง แสดง "เพจ · ชื่อห้อง" และ FB Bebeplay ที่เกิน 24 ชม. เป็น `meta`

- [ ] **Step 4: Commit**

```bash
git add components/modals/CustomerModal.tsx
git commit -m "feat(web): customer popup shows per-room chat chips (JST / Meta)"
```

---

### Task 9: ตรวจทั้งหมด

- [ ] **Step 1: Unit + type + lint**

Run: `npm run typecheck && npm run lint && npx vitest run`
Expected: ผ่านทั้งหมด

- [ ] **Step 2: e2e (โหมด fixture)**

ปิด `npm start` ถ้าเปิดอยู่ แล้ว Run: `npm run test:e2e`
Expected: ผ่าน ยกเว้นภาพที่ตั้งใจเปลี่ยน (`/leads` มีคอลัมน์ติ๊กที่ 1440 และ 390) → Run `npx playwright test --update-snapshots=changed` แล้ว**เปิดดูภาพที่เปลี่ยนใน `e2e/__screenshots__/` ทีละภาพ** ต้องเห็นแค่คอลัมน์ติ๊กเพิ่ม ไม่มีส่วนอื่นเพี้ยน · `e2e/mobile-fit.spec.ts` ต้องผ่าน (ไม่เลื่อนแนวนอนที่ 390px, ปุ่ม ≥ 44px)

- [ ] **Step 3: build + ตรวจ fixture ไม่หลุด**

Run: `npm run build && npm run check:fixtures`
Expected: build สำเร็จ, check ผ่าน

- [ ] **Step 4: ตรวจข้อมูลจริงที่ 1440 และ 390**

ใน dev server แท็บแยก `/leads` ทำ Task 7 Step 5 ซ้ำ แล้ว `resize_window` 390×844 รัน:
```js
({ scroll: document.documentElement.scrollWidth, vw: innerWidth,
   send: document.querySelector('#sel-send')?.getBoundingClientRect().height })
```
Expected: `scroll` = `vw` (ไม่ล้น), `send` ≥ 44 · คืนขนาดด้วย preset `desktop` และปิดแท็บทดสอบ

- [ ] **Step 5: Commit snapshot (ถ้ามี)**

```bash
git add e2e/__screenshots__
git commit -m "test(e2e): Direct Sale baselines with the tick column"
```

---

### Task 10: เอกสาร

**Files:**
- Modify: `CLAUDE.md` (รายการ migration ในหัวข้อ Supabase)
- Modify: `docs/DATABASE.md` (หัวข้อ "ผูกห้องแชตด้วยรหัสผู้ซื้อ")

- [ ] **Step 1: เพิ่มบรรทัดใน `CLAUDE.md`** ต่อท้าย bullet ของ `20261120150000_dsales_buyer_id_room_links.sql`:
```markdown
  - `20261123080000_dsales_customer_rooms_name.sql` / `20261123090000_dsales_rooms_for_phones.sql` — `dsales_customer_rooms` คืนชื่อของแต่ละห้อง (`name`) และ RPC `dsales_rooms_for_phones(p_phones)` ห้องของหลายเบอร์สำหรับหน้า Direct Sale (เซลล์ = ลีดของตัวเอง, หัวหน้า = ทุกเบอร์, ≤ 100 เบอร์/ครั้ง); test `11_customer_rooms_name.sql`, `12_rooms_for_phones.sql`
```

- [ ] **Step 2: เพิ่มใน `docs/DATABASE.md`** ท้ายหัวข้อ "ผูกห้องแชตด้วยรหัสผู้ซื้อ":
```markdown
- หน้า Direct Sale (2026-11-23): `dsales_rooms_for_phones(p_phones text[])` → `(phone, rooms)` โดย `rooms` = `dsales_customer_rooms(phone)` (มี `name` = ชื่อของห้องนั้นใน JST) เฉพาะเบอร์ของลีดที่ผู้เรียกเป็นเจ้าของ (หัวหน้าได้ทุกเบอร์) · เกิน 100 เบอร์ = `too_many_phones` (เว็บแบ่งส่งทีละ 100) · ~0.5 ms/เบอร์
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md docs/DATABASE.md
git commit -m "docs: rooms_for_phones and per-room names"
```
