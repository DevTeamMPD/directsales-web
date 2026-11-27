# RFM Page — Plan 1 of 3: rules in the database + the `/rfm` page

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new page `/rfm` shows the customer-group map (F × R), the action context of the selected group and the customer list filtered by that group; the group rules move from a fixed SQL formula into a table (10 groups, Hot split from Warm).

**Architecture:** Rules live in `dsales.dsales_rfm_segments`; `dsales_rfm(orders, days)` reads them and a row trigger keeps `dsales_customer_base.rfm` current. Two read RPCs feed the web: `dsales_rfm_config_get()` (rules + action context, loaded once into app state) and `dsales_rfm_map(scope, brand, as)` (counts per group). The map layout is derived from the rules by a pure function (`rfmGrid`), and the customer list is the existing `BasePage` embedded with a locked group filter.

**Tech Stack:** PostgreSQL 17 (Supabase, schema `dsales`), Next.js 15 / React 19, TypeScript strict, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-26-rfm-page-design.md` · mockup https://claude.ai/artifact/8YtHZ539g5h8CCAkJkgAP5

**Scope of this plan:** spec delivery steps 1–2 (sections 3, 4.1, 4.2, `dsales_rfm_config_get` + `dsales_rfm_map` of 4.3, 5.1 `/rfm`, 5.2, 5.3, 5.5 first two bullets, 5.6 map). **Not in this plan:** `/rfm/settings` with `dsales_rfm_config_preview` / `_save` (Plan 2), `no_outreach` enforcement and the group's default template in the send popup (Plan 3). Until Plan 2 ships, rules and action context can only be changed with SQL.

**Read first:** repo `CLAUDE.md` (sections "Supabase", "Migration และ SQL test", "Coding Conventions"). Production database is shared: never touch other schemas, and **ask the user before `apply_migration`, before `git push`, and before merging**.

**Working directory:** `C:\Claude Ai\Directsale\directsales-web-rfm`, branch `feat/rfm-page` (already created from `main`; `node_modules` is a junction). Commits: English conventional message, blank line, then `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

## File structure

| File | Responsibility |
|---|---|
| `supabase/tests/32_rfm_config.sql` (new) | SQL test of rules table, `dsales_rfm`, trigger, `dsales_rfm_apply`, `dsales_rfm_config_get`, `dsales_rfm_map` |
| `supabase/migrations/20261126150000_dsales_rfm_config.sql` (new) | the migration |
| `supabase/tests/22_rfm_segments.sql` (modify) | Hot at (1, 0–30) |
| `lib/domain/rfm.ts` (rewrite) | `RfmSeg`, `DEFAULT_RFM_CONFIG`, `rfmSegment`, `rfmRuleText`, `rfmRule`, `rfmSlug`, chip order |
| `lib/domain/rfmGrid.ts` (new) | `rfmGrid(config)` → bands + merged rectangles |
| `lib/domain/rfmPage.ts` (new) | scopes, URL state, map statistics, texts of the `/rfm` page |
| `lib/api/types.ts`, `map.ts`, `rpc.ts` (modify) | `RfmSegJson`, `RfmMapRow`, `mapRfmConfig`, `getRfmConfig`, `getRfmMap` |
| `lib/state/reducer.ts`, `AppProvider.tsx`, `lib/fixtures/load.ts` (modify) | `rfmConfig` in app state |
| `lib/routes.ts`, `lib/nav.ts`, `lib/constants.ts` (modify) | route `rfm`, menu item, icon |
| `lib/domain/pool.ts` (modify) | `BaseScopeKey` gains `team` |
| `components/campaigns/BasePage.tsx` (modify) | `fixedRfm` prop (embedded mode), tooltips from config |
| `components/leads/LeadTable.tsx` (modify) | tooltip from config |
| `components/rfm/RfmMap.tsx`, `RfmActionCard.tsx`, `RfmPage.tsx` (new) | the page |
| `app/(app)/rfm/page.tsx` (new) | route |
| `styles/tokens.css`, `styles/app.css` (modify) | group colours (light + dark), page layout |
| `e2e/rfm.spec.ts` (new), `e2e/mobile-fit.spec.ts`, `e2e/visual-parity.spec.ts`, `e2e/outreach.spec.ts` (modify) | e2e |
| `CLAUDE.md`, `docs/DATABASE.md`, spec (modify) | docs |

---

### Task 1: SQL test for the rules table (must fail first)

**Files:**
- Create: `supabase/tests/32_rfm_config.sql`

- [ ] **Step 1: Write the test**

```sql
begin;
-- RFM config (20261126150000): rules table, dsales_rfm reads it, rfm column kept by a trigger,
-- dsales_rfm_apply, dsales_rfm_config_get, dsales_rfm_map. Rolled back.
create temp table _r (k text, v text) on commit drop;
grant all on _r to authenticated;
do $$
declare
  v_admin uuid; v_sales uuid; v_bad bigint; v_n bigint; v_sum bigint; v_un bigint; c jsonb; v_ok boolean;
begin
  -- (a) seed: 10 groups, Lost is the fallback and comes last
  assert (select count(*) from dsales.dsales_rfm_segments) = 10, '10 segments';
  assert (select key from dsales.dsales_rfm_segments where is_fallback) = 'Lost', 'Lost is the fallback';
  assert (select sort_order from dsales.dsales_rfm_segments where key = 'Lost') = (select max(sort_order) from dsales.dsales_rfm_segments), 'fallback is last';

  -- (b) same result as the old fixed rules at every boundary, plus Hot
  assert dsales.dsales_rfm(6, 30) = 'Champion' and dsales.dsales_rfm(6, 31) = 'Loyal' and dsales.dsales_rfm(6, 90) = 'Loyal' and dsales.dsales_rfm(6, 91) = 'Shouldn''t Lose', 'F>=6';
  assert dsales.dsales_rfm(4, 30) = 'Loyal' and dsales.dsales_rfm(4, 90) = 'Loyal' and dsales.dsales_rfm(5, 91) = 'Sleepers' and dsales.dsales_rfm(3, 91) = 'Sleepers', 'F 3-5';
  assert dsales.dsales_rfm(3, 60) = 'Promising' and dsales.dsales_rfm(2, 61) = 'Need Attention' and dsales.dsales_rfm(3, 90) = 'Need Attention', 'F 2-3';
  assert dsales.dsales_rfm(2, 91) = 'Lost' and dsales.dsales_rfm(1, 91) = 'Lost', 'F 1-2 > 90 = Lost';
  assert dsales.dsales_rfm(1, 0) = 'Hot' and dsales.dsales_rfm(1, 30) = 'Hot' and dsales.dsales_rfm(1, 31) = 'Warm' and dsales.dsales_rfm(1, 60) = 'Warm'
     and dsales.dsales_rfm(1, 61) = 'Cold' and dsales.dsales_rfm(1, 90) = 'Cold', 'one-time buyers: Hot / Warm / Cold';
  assert dsales.dsales_rfm(null, 10) is null and dsales.dsales_rfm(0, 10) is null and dsales.dsales_rfm(3, null) is null, 'no data = null';

  -- (c) stored column = function on every row; the trigger keeps it on write
  select count(*) into v_bad from dsales.dsales_customer_base b where b.rfm is distinct from dsales.dsales_rfm(b.order_count, b.dormant_days);
  assert v_bad = 0, format('rfm column mismatch on %s rows', v_bad);
  insert into dsales.dsales_customer_base (phone_normalized, name, order_count, dormant_days, last_order_date)
    values ('0899999951', 'ทดสอบ RFM config', 1, 10, current_date - 10);
  assert (select rfm from dsales.dsales_customer_base where phone_normalized = '0899999951') = 'Hot', 'insert sets rfm';
  update dsales.dsales_customer_base set dormant_days = 45 where phone_normalized = '0899999951';
  assert (select rfm from dsales.dsales_customer_base where phone_normalized = '0899999951') = 'Warm', 'update of dormant_days sets rfm';
  update dsales.dsales_customer_base set order_count = 7, dormant_days = 200 where phone_normalized = '0899999951';
  assert (select rfm from dsales.dsales_customer_base where phone_normalized = '0899999951') = 'Shouldn''t Lose', 'update of order_count sets rfm';

  -- changing a rule + dsales_rfm_apply moves customers, a second apply writes nothing
  update dsales.dsales_rfm_segments set r_max = 20 where key = 'Hot';
  update dsales.dsales_rfm_segments set r_min = 21 where key = 'Warm';
  assert dsales.dsales_rfm(1, 25) = 'Warm', 'a rule change is used at once';
  perform dsales.dsales_rfm_apply();
  select count(*) into v_bad from dsales.dsales_customer_base b where b.rfm is distinct from dsales.dsales_rfm(b.order_count, b.dormant_days);
  assert v_bad = 0, 'apply brings every row in line';
  assert dsales.dsales_rfm_apply() = 0, 'second apply writes nothing';
  update dsales.dsales_rfm_segments set r_max = 30 where key = 'Hot';
  update dsales.dsales_rfm_segments set r_min = 31 where key = 'Warm';
  perform dsales.dsales_rfm_apply();

  -- (d) config for the web: any member can read it, nobody can touch the table or run apply
  select user_id into v_admin from dsales.dsales_members where role = 'admin' and active order by created_at limit 1;
  select id into v_sales from auth.users where id not in (select user_id from dsales.dsales_members) limit 1;
  insert into dsales.dsales_members (user_id, role, display_name, active) values (v_sales, 'sales', 'Test Sales', true);
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_sales, 'role', 'authenticated')::text, true);
  c := dsales.dsales_rfm_config_get();
  assert jsonb_array_length(c) = 10, format('config has 10 segments, got %s', jsonb_array_length(c));
  assert c -> 0 ->> 'key' = 'Champion' and (c -> 0 ->> 'f_min')::int = 6 and c -> 0 -> 'f_max' = 'null'::jsonb and (c -> 0 ->> 'r_max')::int = 30,
         format('first rule, got %s', c -> 0);
  assert c -> 9 ->> 'key' = 'Lost' and (c -> 9 ->> 'fallback')::boolean, 'last = fallback';
  assert (c -> 0) ?& array['key', 'sort', 'f_min', 'f_max', 'r_min', 'r_max', 'fallback', 'tone', 'behavior', 'action', 'template_bebeplay', 'template_hosttail', 'no_outreach'],
         format('config keys, got %s', c -> 0);
  assert (select bool_and(e ->> 'tone' <> '' and e ->> 'behavior' <> '' and e ->> 'action' <> '') from jsonb_array_elements(c) e), 'every segment has its action context';
  v_ok := false;
  begin perform 1 from dsales.dsales_rfm_segments; exception when insufficient_privilege then v_ok := true; end;
  assert v_ok, 'members cannot read the table directly';
  v_ok := false;
  begin perform dsales.dsales_rfm_apply(); exception when insufficient_privilege then v_ok := true; end;
  assert v_ok, 'members cannot call dsales_rfm_apply';

  -- (e) map: a new rep owns nothing, team is for admins, pool: contactable = the chip counts and n >= contactable
  assert not exists (select 1 from dsales.dsales_rfm_map('mine', null)), 'new rep: empty mine map';
  assert not exists (select 1 from dsales.dsales_rfm_map('team', null)), 'team scope only for admins';
  select count(*) into v_bad
  from dsales.dsales_rfm_map('pool', null) m
  full join dsales.dsales_base_segment_counts('pool', null) s on s.segment = m.segment
  where m.segment is null or m.contactable is distinct from coalesce(s.n, 0) or m.n < m.contactable;
  assert v_bad = 0, format('pool map: contactable must equal the segment counts (%s rows differ)', v_bad);
  v_ok := false;
  begin perform dsales.dsales_rfm_map('mine', null, v_admin); exception when others then v_ok := sqlerrm = 'forbidden'; end;
  assert v_ok, 'p_as only for admins';
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  select coalesce(sum(n), 0), coalesce(sum(n) filter (where segment = ''), 0) into v_sum, v_un from dsales.dsales_rfm_map('team', null);
  reset role;
  select count(*) into v_n from dsales.dsales_customer_base b
  where not (b.phone_normalized = any (array(select x.phone from dsales.dsales_excluded_customers() x)));
  assert v_sum = v_n, format('team map covers the whole base: %s vs %s', v_sum, v_n);
  insert into _r values ('team_total', v_sum::text), ('unscored', v_un::text);
end $$;
select string_agg(k || '=' || v, ', ') || ' | OK 32_rfm_config' from _r;
rollback;
```

- [ ] **Step 2: Run it and see it fail**

Run the whole file with Supabase MCP `execute_sql` (`project_id = "nroyacasuchqniaiuirk"`).
Expected: `ERROR: relation "dsales.dsales_rfm_segments" does not exist`.

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/32_rfm_config.sql
git commit -m "test(db): RFM rules table, trigger, config and map RPCs" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Migration `dsales_rfm_config`

**Files:**
- Create: `supabase/migrations/20261126150000_dsales_rfm_config.sql`
- Modify: `supabase/tests/22_rfm_segments.sql:13`

- [ ] **Step 1: Write the migration**

```sql
-- dsales: กติกากลุ่มลูกค้า RFM อยู่ในตาราง (แก้ได้) + Action Context ต่อกลุ่ม + ข้อมูลของหน้า /rfm (2026-11-26)
-- spec: docs/superpowers/specs/2026-11-26-rfm-page-design.md (ข้อ 3, 4.1, 4.2, 4.3 เฉพาะ config_get / rfm_map)
-- 1) dsales_rfm_segments: 10 กลุ่มคงที่ เช็กตาม sort_order ข้อแรกที่ตรง = กลุ่มนั้น, Lost = fallback รับที่เหลือ
--    seed = กติกาเดิมของ dsales_rfm (20261125140000) + แยก Hot (ซื้อครั้งเดียว 0–30 วัน) ออกจาก Warm
-- 2) dsales_rfm(orders, days) อ่านกติกาจากตาราง (stable) · dsales_customer_base.rfm เลิกเป็น generated,
--    trigger ตั้งค่าเมื่อ insert / update order_count, dormant_days (refresh ของ cron ไม่ต้องแก้) · dsales_rfm_apply() คำนวณทั้งตาราง
-- 3) dsales_rfm_config_get(): กติกา + Action Context ให้เว็บ (สมาชิกทุกคน)
-- 4) dsales_rfm_map(p_scope, p_brand, p_as): จำนวนลูกค้าต่อกลุ่มของหน้า /rfm — n = ทุกคนที่อยู่ในขอบเขต,
--    contactable = เฉพาะ eligible (ไม่ซื้อมา >= 30 วัน) ขอบเขต/แบรนด์/ตัด CS-B2B เหมือน dsales_base_segment_counts
-- Rollback: drop function dsales.dsales_rfm_map(text, text, uuid), dsales.dsales_rfm_config_get(), dsales.dsales_rfm_apply();
--   drop trigger dsales_customer_base_set_rfm on dsales.dsales_customer_base; drop function dsales.dsales_customer_base_set_rfm();
--   สร้าง dsales_rfm แบบ immutable จาก 20261125140000 ใหม่; alter table dsales.dsales_customer_base drop column rfm,
--   add column rfm text generated always as (dsales.dsales_rfm(order_count, dormant_days)) stored; drop table dsales.dsales_rfm_segments

-- 1)
create table if not exists dsales.dsales_rfm_segments (
  key text primary key,
  sort_order integer not null unique,
  f_min integer, f_max integer, r_min integer, r_max integer,
  is_fallback boolean not null default false,
  tone text not null default '',
  behavior text not null default '',
  action text not null default '',
  template_bebeplay uuid references dsales.dsales_templates(id) on delete set null,
  template_hosttail uuid references dsales.dsales_templates(id) on delete set null,
  no_outreach boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint dsales_rfm_segments_range check (
    is_fallback or (f_min is not null and r_min is not null and f_min >= 1 and r_min >= 0
                    and (f_max is null or f_max >= f_min) and (r_max is null or r_max >= r_min)))
);
alter table dsales.dsales_rfm_segments enable row level security;
revoke all on dsales.dsales_rfm_segments from public, anon, authenticated;

insert into dsales.dsales_rfm_segments (key, sort_order, f_min, f_max, r_min, r_max, is_fallback, tone, behavior, action) values
  ('Champion', 1, 6, null, 0, 30, false, 'ดูแลพิเศษ', 'ลูกค้าแชมป์เปี้ยน มาบ่อย ซื้อเยอะ',
   'บริการพิเศษ ขอรีวิว ส่งสินค้าใหม่ให้ลองฟรี ของขวัญวันเกิด ต้องดูแลรักษาไว้ให้ดีที่สุด'),
  ('Shouldn''t Lose', 2, 6, null, 91, null, false, 'Hard winback', 'ลูกค้ายอดสูงที่หายจากเราไปนานแล้ว อาจไปซื้อคู่แข่ง',
   'Hard winback: จัดโปรแรงในสินค้าที่เคยซื้อ แนะนำสินค้าใหม่ที่น่าถูกใจ'),
  ('Loyal', 3, 4, null, 0, 90, false, 'กระตุ้นซื้อซ้ำ', 'ลูกค้าประจำ มาบ่อย ซื้อเยอะ แต่ห่างไปช่วงสั้น ๆ แล้ว',
   'สะสมแต้มทุกสัปดาห์/เดือน ของขวัญวันเกิด เพื่อเพิ่ม Recency'),
  ('Sleepers', 4, 3, 5, 91, null, false, 'Soft winback', 'ลูกค้าที่ซื้อยอดกลาง ๆ ที่หายไปสักพักแล้ว',
   'Soft winback: จัดโปรเบา ๆ ให้ลูกค้ากลับมาซื้อ แนะนำสินค้าที่น่าถูกใจ'),
  ('Promising', 5, 2, 3, 0, 60, false, 'Up-sell', 'ลูกค้ามาบ่อยพอสมควร ซื้อขนาดกลาง ๆ',
   'Up-sell: แนะนำสินค้าที่ลูกค้าน่าจะถูกใจ อัปเกรดเลเวลสมาชิก เพื่อเพิ่ม Frequency + Monetary'),
  ('Need Attention', 6, 2, 3, 61, 90, false, 'Up-sell / Cross-sell', 'ลูกค้าที่ซื้อมาสักระยะ มีศักยภาพที่จะขายได้เพิ่ม',
   'Up-sell, Cross-sell: แนะนำสินค้าที่ถูกใจ โปรพิเศษตามเลเวลสมาชิก เพื่อเพิ่ม Frequency + Monetary'),
  ('Hot', 7, 1, 1, 0, 30, false, 'ต้อนรับ', 'ลูกค้าหน้าใหม่ เพิ่งมาซื้อครั้งแรก',
   'สร้างความสัมพันธ์ ต้อนรับสมาชิกใหม่ ชวนรับข่าวสารจากแบรนด์ สะสมแต้ม'),
  ('Warm', 8, 1, 1, 31, 60, false, 'Hard conversation', 'ลูกค้าที่เคยซื้อครั้งเดียวแล้วหายไป ยังตามกลับมาได้ทัน',
   'Hard conversation: ติดต่อกลับให้เร็วที่สุด ผ่านช่องทางที่ลูกค้าต้องการให้ติดต่อ สร้างความมั่นใจ'),
  ('Cold', 9, 1, 1, 61, 90, false, 'Soft conversation', 'ลูกค้าที่เคยซื้อครั้งเดียวแล้วหายไป ตามกลับมาไม่ทันแล้ว',
   'Soft conversation: สร้างความมั่นใจ ไม่ปล่อยให้ห่างเหิน แต่ไม่รบกวนเกินไป ติดต่อด้วยสื่อที่ไม่รบกวนมาก'),
  ('Lost', 10, null, null, null, null, true, 'หยุดส่ง', 'ลูกค้าที่ซื้อน้อย ไม่บ่อย และหายไปนานแล้ว',
   'หยุดส่งแคมเปญ เอางบและเวลาไปลงกับกลุ่มอื่นดีกว่า')
on conflict (key) do nothing;

-- 2)
alter table dsales.dsales_customer_base alter column rfm drop expression;

create or replace function dsales.dsales_rfm(p_orders integer, p_days integer) returns text
language sql stable set search_path = dsales, public as $$
  select case when p_orders is null or p_orders < 1 or p_days is null then null else (
    select s.key from dsales.dsales_rfm_segments s
    where s.is_fallback
       or (p_orders >= s.f_min and (s.f_max is null or p_orders <= s.f_max) and p_days >= s.r_min and (s.r_max is null or p_days <= s.r_max))
    order by s.sort_order limit 1) end
$$;
revoke all on function dsales.dsales_rfm(integer, integer) from public, anon, authenticated;

create or replace function dsales.dsales_customer_base_set_rfm() returns trigger
language plpgsql security definer set search_path = dsales, public as $$
begin
  new.rfm := dsales.dsales_rfm(new.order_count, new.dormant_days);
  return new;
end $$;
revoke all on function dsales.dsales_customer_base_set_rfm() from public, anon, authenticated;
drop trigger if exists dsales_customer_base_set_rfm on dsales.dsales_customer_base;
create trigger dsales_customer_base_set_rfm
  before insert or update of order_count, dormant_days on dsales.dsales_customer_base
  for each row execute function dsales.dsales_customer_base_set_rfm();

create or replace function dsales.dsales_rfm_apply() returns integer
language plpgsql security definer set search_path = dsales, public as $$
declare n integer;
begin
  update dsales.dsales_customer_base b set rfm = dsales.dsales_rfm(b.order_count, b.dormant_days)
  where b.rfm is distinct from dsales.dsales_rfm(b.order_count, b.dormant_days);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function dsales.dsales_rfm_apply() from public, anon, authenticated;

-- 3)
create or replace function dsales.dsales_rfm_config_get() returns jsonb
language plpgsql stable security definer set search_path = dsales, public as $$
begin
  perform dsales.dsales_uid();
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'key', s.key, 'sort', s.sort_order, 'f_min', s.f_min, 'f_max', s.f_max, 'r_min', s.r_min, 'r_max', s.r_max, 'fallback', s.is_fallback,
      'tone', s.tone, 'behavior', s.behavior, 'action', s.action,
      'template_bebeplay', s.template_bebeplay, 'template_hosttail', s.template_hosttail, 'no_outreach', s.no_outreach) order by s.sort_order), '[]'::jsonb)
    from dsales.dsales_rfm_segments s);
end $$;
revoke all on function dsales.dsales_rfm_config_get() from public, anon;
grant execute on function dsales.dsales_rfm_config_get() to authenticated;

-- 4)
create or replace function dsales.dsales_rfm_map(p_scope text, p_brand text default null, p_as uuid default null)
returns table(segment text, n bigint, contactable bigint)
language plpgsql stable security definer set search_path = dsales, public as $$
declare v_uid uuid := dsales.dsales_uid(); v_admin boolean := dsales.dsales_is_admin();
begin
  if p_as is not null then
    if not v_admin then raise exception 'forbidden'; end if;
    v_uid := p_as;
  end if;
  return query
  with ex as (select coalesce(array_agg(x.phone), '{}') as phones from dsales.dsales_excluded_customers() x)
  select coalesce(b.rfm, '') as segment, count(*) as n, count(*) filter (where b.eligible) as contactable
  from dsales.dsales_customer_base b
  left join dsales.dsales_leads l on l.phone_normalized = b.phone_normalized
  cross join ex
  where (nullif(btrim(p_brand), '') is null or lower(btrim(p_brand)) = any (b.brands))
    and not (b.phone_normalized = any (ex.phones))
    and case p_scope when 'mine' then coalesce(l.owner_id, b.owner_id) = v_uid
                     when 'pool' then coalesce(l.owner_id, b.owner_id) is null
                     when 'team' then v_admin
                     else false end
  group by 1;
end $$;
revoke all on function dsales.dsales_rfm_map(text, text, uuid) from public, anon;
grant execute on function dsales.dsales_rfm_map(text, text, uuid) to authenticated;

-- ลูกค้าซื้อครั้งเดียว 0–30 วัน ย้ายจาก Warm เป็น Hot
select dsales.dsales_rfm_apply();
```

- [ ] **Step 2: Update test 22 for Hot**

In `supabase/tests/22_rfm_segments.sql` replace line 13

```sql
  assert dsales.dsales_rfm(1, 10) = 'Warm' and dsales.dsales_rfm(1, 60) = 'Warm' and dsales.dsales_rfm(1, 61) = 'Cold' and dsales.dsales_rfm(1, 90) = 'Cold', 'one-time buyers';
```

with

```sql
  assert dsales.dsales_rfm(1, 10) = 'Hot' and dsales.dsales_rfm(1, 31) = 'Warm' and dsales.dsales_rfm(1, 60) = 'Warm' and dsales.dsales_rfm(1, 61) = 'Cold' and dsales.dsales_rfm(1, 90) = 'Cold', 'one-time buyers';
```

- [ ] **Step 3: Dry run with timing (nothing is kept)**

One `execute_sql` call: `begin;` + the whole migration file + the body of `32_rfm_config.sql` without its own `begin;` / `rollback;` lines + this block + `rollback;`

```sql
create temp table _t (what text, ms numeric) on commit drop;
do $$
declare t0 timestamptz;
begin
  t0 := clock_timestamp();
  update dsales.dsales_customer_base set dormant_days = dormant_days;   -- fires the trigger on every row, like the first refresh of a day
  insert into _t values ('trigger_all_rows', round(extract(epoch from clock_timestamp() - t0) * 1000));
  t0 := clock_timestamp();
  update dsales.dsales_customer_base set rfm = null;
  perform dsales.dsales_rfm_apply();                                     -- worst case of a rule change
  insert into _t values ('apply_all_rows', round(extract(epoch from clock_timestamp() - t0) * 1000));
end $$;
select string_agg(what || '=' || ms || 'ms', ', ') from _t;
```

Expected: the test's `OK 32_rfm_config` assertions pass (no error) and both timings are under 3000 ms.
This holds row locks on the ~18k rows of `dsales_customer_base` for the length of the call, then rolls back — tell the user before running it.
If `trigger_all_rows` is over 3000 ms, replace the body of `dsales_customer_base_set_rfm()` with the same `select s.key into new.rfm …` query that `dsales_rfm` uses (guarded by the same null check) and repeat this step.

- [ ] **Step 4: Ask the user, then apply**

Ask: "Apply migration `dsales_rfm_config` to production? It moves about 480 customers from Warm to Hot." Only after a yes:
`apply_migration` with `project_id = "nroyacasuchqniaiuirk"`, `name = "dsales_rfm_config"`, `query` = the file content.

- [ ] **Step 5: Run the test and the regressions, one file per `execute_sql` call**

`32_rfm_config.sql` → last row contains `OK 32_rfm_config`.
Then `22_rfm_segments.sql`, `31_lead_json_rfm.sql`, `09_base_customers_chat.sql`, `23_admin_view_as.sql` → each ends with its `OK …` row / no error.
Do **not** run `04`, `04b`, `25` (they recompute the whole customer base).

- [ ] **Step 6: Check the next cron refresh**

After the next `dsales-refresh-customer-base` run (07:05, 12:05 or 16:05 Bangkok) run:

```sql
select start_time, round(extract(epoch from end_time - start_time)::numeric, 1) as seconds, status
from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'dsales-refresh-customer-base')
order by start_time desc limit 6;
```

Expected: `succeeded`, and the newest run is not more than about 3 seconds slower than the runs before the migration. Report the numbers to the user.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20261126150000_dsales_rfm_config.sql supabase/tests/22_rfm_segments.sql
git commit -m "feat(db): RFM rules in a table, Hot split from Warm, config and map RPCs" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `lib/domain/rfm.ts` — rules from a config

**Files:**
- Modify (rewrite): `lib/domain/rfm.ts`
- Test (rewrite): `lib/domain/rfm.test.ts`

- [ ] **Step 1: Replace the test file**

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_RFM_CONFIG, RFM_SEGMENTS, rfmCountMap, rfmRule, rfmRuleText, rfmSegment, rfmSlug, type RfmSeg } from './rfm';

describe('RFM segments (same rules as the seed of dsales.dsales_rfm_segments)', () => {
  it('first matching rule wins, with the agreed boundaries', () => {
    const cases: Array<[number | null, number | null, string | null]> = [
      [6, 30, 'Champion'], [6, 31, 'Loyal'], [6, 90, 'Loyal'], [6, 91, "Shouldn't Lose"],
      [4, 30, 'Loyal'], [4, 90, 'Loyal'], [5, 91, 'Sleepers'], [3, 91, 'Sleepers'],
      [3, 60, 'Promising'], [2, 61, 'Need Attention'], [3, 90, 'Need Attention'],
      [2, 91, 'Lost'], [1, 91, 'Lost'], [1, 0, 'Hot'], [1, 30, 'Hot'], [1, 31, 'Warm'], [1, 60, 'Warm'], [1, 61, 'Cold'], [1, 90, 'Cold'],
      [null, 10, null], [0, 10, null], [3, null, null],
    ];
    for (const [o, d, want] of cases) expect([o, d, rfmSegment(o, d)]).toEqual([o, d, want]);
  });
  it('uses the config it is given', () => {
    const cfg: RfmSeg[] = DEFAULT_RFM_CONFIG.map((s) => (s.key === 'Hot' ? { ...s, rMax: 20 } : s.key === 'Warm' ? { ...s, rMin: 21 } : s));
    expect([rfmSegment(1, 20, cfg), rfmSegment(1, 21, cfg), rfmSegment(1, 25)]).toEqual(['Hot', 'Warm', 'Hot']);
    expect(rfmSegment(1, 10, cfg.filter((s) => !s.fallback && s.key !== 'Hot'))).toBeNull();
  });
  it('default config: 10 segments in rule order, Lost is the fallback, every segment has its action context', () => {
    expect(DEFAULT_RFM_CONFIG.map((s) => s.key)).toEqual(['Champion', "Shouldn't Lose", 'Loyal', 'Sleepers', 'Promising', 'Need Attention', 'Hot', 'Warm', 'Cold', 'Lost']);
    expect(DEFAULT_RFM_CONFIG.map((s) => s.sort)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(DEFAULT_RFM_CONFIG.filter((s) => s.fallback).map((s) => s.key)).toEqual(['Lost']);
    expect(DEFAULT_RFM_CONFIG.every((s) => s.tone && s.behavior && s.action)).toBe(true);
  });
  it('lists the ten segments in chip order', () => {
    expect(RFM_SEGMENTS.map((s) => s.key)).toEqual(['Champion', 'Loyal', 'Promising', 'Need Attention', 'Hot', 'Warm', 'Cold', "Shouldn't Lose", 'Sleepers', 'Lost']);
    expect(RFM_SEGMENTS.every((s) => s.label === s.key)).toBe(true);
  });
  it('writes the rule of a segment in Thai from its numbers', () => {
    expect(rfmRule('Champion')).toBe('ซื้อ 6 ครั้งขึ้นไป · ซื้อล่าสุดไม่เกิน 30 วัน');
    expect(rfmRule("Shouldn't Lose")).toBe('ซื้อ 6 ครั้งขึ้นไป · หายไปเกิน 90 วัน');
    expect(rfmRule('Sleepers')).toBe('ซื้อ 3–5 ครั้ง · หายไปเกิน 90 วัน');
    expect(rfmRule('Need Attention')).toBe('ซื้อ 2–3 ครั้ง · ซื้อล่าสุด 61–90 วัน');
    expect(rfmRule('Hot')).toBe('ซื้อครั้งเดียว · ซื้อล่าสุดไม่เกิน 30 วัน');
    expect(rfmRule('Warm')).toBe('ซื้อครั้งเดียว · ซื้อล่าสุด 31–60 วัน');
    expect(rfmRule('Lost')).toBe('ลูกค้าที่เหลือทั้งหมดที่ไม่เข้ากลุ่มอื่น');
    expect(rfmRule('อื่น')).toBe('');
    expect(rfmRuleText({ ...DEFAULT_RFM_CONFIG[4], fMin: 2, fMax: 2, rMin: 10, rMax: 20 })).toBe('ซื้อ 2 ครั้ง · ซื้อล่าสุด 10–20 วัน');
    expect(rfmRule('Hot', DEFAULT_RFM_CONFIG.map((s) => (s.key === 'Hot' ? { ...s, rMax: 20 } : s)))).toBe('ซื้อครั้งเดียว · ซื้อล่าสุดไม่เกิน 20 วัน');
  });
  it('rfmSlug gives the CSS name of a segment', () => {
    expect(DEFAULT_RFM_CONFIG.map((s) => rfmSlug(s.key))).toEqual(['champion', 'shouldn-t-lose', 'loyal', 'sleepers', 'promising', 'need-attention', 'hot', 'warm', 'cold', 'lost']);
  });
  it('rfmCountMap turns RPC rows / demo rows into counts', () => {
    expect(rfmCountMap([{ segment: 'Warm' }, { segment: 'Warm' }, { segment: null }].map((r) => ({ segment: r.segment ?? '', n: 1 })))).toEqual({ Warm: 2, '': 1 });
    expect(rfmCountMap([{ segment: 'Lost', n: '12' }])).toEqual({ Lost: 12 });
  });
});
```

- [ ] **Step 2: Run and see it fail**

Run: `npx vitest run lib/domain/rfm.test.ts`
Expected: FAIL — `DEFAULT_RFM_CONFIG` / `rfmRuleText` / `rfmSlug` are not exported, and `[1, 0]` gives `Warm`.

- [ ] **Step 3: Replace `lib/domain/rfm.ts`**

```ts
/**
 * กลุ่มลูกค้า RFM — กติกาอ่านจาก config (dsales.dsales_rfm_segments ผ่าน dsales_rfm_config_get)
 * F = จำนวนออเดอร์, R = วันที่ไม่ได้ซื้อ · เช็กตามลำดับ (sort) ข้อแรกที่ตรง = กลุ่มนั้น · กลุ่ม fallback (Lost) รับที่เหลือ
 * DEFAULT_RFM_CONFIG ต้องตรงกับ seed ใน supabase/migrations/20261126150000_dsales_rfm_config.sql
 * (ใช้กับโหมด fixture และเมื่อโหลด config จาก server ไม่ได้)
 */
export interface RfmSeg {
  key: string; sort: number;
  /** ช่วงรวมขอบ · max null = ไม่จำกัด · กลุ่ม fallback ไม่มีช่วง (null ทั้งหมด) */
  fMin: number | null; fMax: number | null; rMin: number | null; rMax: number | null; fallback: boolean;
  tone: string; behavior: string; action: string;
  templateBebeplay: string | null; templateHosttail: string | null; noOutreach: boolean;
}

const seg = (
  sort: number, key: string, f: [number, number | null] | null, r: [number, number | null] | null, tone: string, behavior: string, action: string,
): RfmSeg => ({
  key, sort, fMin: f ? f[0] : null, fMax: f ? f[1] : null, rMin: r ? r[0] : null, rMax: r ? r[1] : null, fallback: !f,
  tone, behavior, action, templateBebeplay: null, templateHosttail: null, noOutreach: false,
});

export const DEFAULT_RFM_CONFIG: ReadonlyArray<RfmSeg> = [
  seg(1, 'Champion', [6, null], [0, 30], 'ดูแลพิเศษ', 'ลูกค้าแชมป์เปี้ยน มาบ่อย ซื้อเยอะ',
    'บริการพิเศษ ขอรีวิว ส่งสินค้าใหม่ให้ลองฟรี ของขวัญวันเกิด ต้องดูแลรักษาไว้ให้ดีที่สุด'),
  seg(2, "Shouldn't Lose", [6, null], [91, null], 'Hard winback', 'ลูกค้ายอดสูงที่หายจากเราไปนานแล้ว อาจไปซื้อคู่แข่ง',
    'Hard winback: จัดโปรแรงในสินค้าที่เคยซื้อ แนะนำสินค้าใหม่ที่น่าถูกใจ'),
  seg(3, 'Loyal', [4, null], [0, 90], 'กระตุ้นซื้อซ้ำ', 'ลูกค้าประจำ มาบ่อย ซื้อเยอะ แต่ห่างไปช่วงสั้น ๆ แล้ว',
    'สะสมแต้มทุกสัปดาห์/เดือน ของขวัญวันเกิด เพื่อเพิ่ม Recency'),
  seg(4, 'Sleepers', [3, 5], [91, null], 'Soft winback', 'ลูกค้าที่ซื้อยอดกลาง ๆ ที่หายไปสักพักแล้ว',
    'Soft winback: จัดโปรเบา ๆ ให้ลูกค้ากลับมาซื้อ แนะนำสินค้าที่น่าถูกใจ'),
  seg(5, 'Promising', [2, 3], [0, 60], 'Up-sell', 'ลูกค้ามาบ่อยพอสมควร ซื้อขนาดกลาง ๆ',
    'Up-sell: แนะนำสินค้าที่ลูกค้าน่าจะถูกใจ อัปเกรดเลเวลสมาชิก เพื่อเพิ่ม Frequency + Monetary'),
  seg(6, 'Need Attention', [2, 3], [61, 90], 'Up-sell / Cross-sell', 'ลูกค้าที่ซื้อมาสักระยะ มีศักยภาพที่จะขายได้เพิ่ม',
    'Up-sell, Cross-sell: แนะนำสินค้าที่ถูกใจ โปรพิเศษตามเลเวลสมาชิก เพื่อเพิ่ม Frequency + Monetary'),
  seg(7, 'Hot', [1, 1], [0, 30], 'ต้อนรับ', 'ลูกค้าหน้าใหม่ เพิ่งมาซื้อครั้งแรก',
    'สร้างความสัมพันธ์ ต้อนรับสมาชิกใหม่ ชวนรับข่าวสารจากแบรนด์ สะสมแต้ม'),
  seg(8, 'Warm', [1, 1], [31, 60], 'Hard conversation', 'ลูกค้าที่เคยซื้อครั้งเดียวแล้วหายไป ยังตามกลับมาได้ทัน',
    'Hard conversation: ติดต่อกลับให้เร็วที่สุด ผ่านช่องทางที่ลูกค้าต้องการให้ติดต่อ สร้างความมั่นใจ'),
  seg(9, 'Cold', [1, 1], [61, 90], 'Soft conversation', 'ลูกค้าที่เคยซื้อครั้งเดียวแล้วหายไป ตามกลับมาไม่ทันแล้ว',
    'Soft conversation: สร้างความมั่นใจ ไม่ปล่อยให้ห่างเหิน แต่ไม่รบกวนเกินไป ติดต่อด้วยสื่อที่ไม่รบกวนมาก'),
  seg(10, 'Lost', null, null, 'หยุดส่ง', 'ลูกค้าที่ซื้อน้อย ไม่บ่อย และหายไปนานแล้ว',
    'หยุดส่งแคมเปญ เอางบและเวลาไปลงกับกลุ่มอื่นดีกว่า'),
];

const matches = (s: RfmSeg, orders: number, days: number): boolean =>
  s.fallback || (s.fMin != null && s.rMin != null && orders >= s.fMin && (s.fMax == null || orders <= s.fMax) && days >= s.rMin && (s.rMax == null || days <= s.rMax));

/** config ต้องเรียงตาม sort แล้ว (mapRfmConfig / DEFAULT_RFM_CONFIG เรียงให้) */
export function rfmSegment(orders: number | null | undefined, days: number | null | undefined, config: ReadonlyArray<RfmSeg> = DEFAULT_RFM_CONFIG): string | null {
  if (orders == null || orders < 1 || days == null) return null;
  return config.find((s) => matches(s, orders, days))?.key ?? null;
}

/** ข้อความเงื่อนไขของกลุ่มจากตัวเลขกติกา (tooltip ของป้ายกลุ่ม, การ์ดแนวทางในหน้า /rfm) */
export function rfmRuleText(s: RfmSeg): string {
  if (s.fallback || s.fMin == null || s.rMin == null) return 'ลูกค้าที่เหลือทั้งหมดที่ไม่เข้ากลุ่มอื่น';
  const f = s.fMax == null ? `ซื้อ ${s.fMin} ครั้งขึ้นไป` : s.fMax === s.fMin ? (s.fMin === 1 ? 'ซื้อครั้งเดียว' : `ซื้อ ${s.fMin} ครั้ง`) : `ซื้อ ${s.fMin}–${s.fMax} ครั้ง`;
  const r = s.rMax == null ? `หายไปเกิน ${s.rMin - 1} วัน` : s.rMin === 0 ? `ซื้อล่าสุดไม่เกิน ${s.rMax} วัน` : `ซื้อล่าสุด ${s.rMin}–${s.rMax} วัน`;
  return `${f} · ${r}`;
}

export const rfmRule = (key: string, config: ReadonlyArray<RfmSeg> = DEFAULT_RFM_CONFIG): string => {
  const s = config.find((x) => x.key === key);
  return s ? rfmRuleText(s) : '';
};

/** ชื่อกลุ่ม → ชื่อใน CSS (.rfm-seg-<slug>, --rfm-<slug>) */
export const rfmSlug = (key: string): string => key.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export interface RfmSegmentDef { key: string; label: string }
/** ลำดับชิปของ /mine /pool: กลุ่มที่ยังซื้ออยู่ → ซื้อครั้งเดียว → หายไปนาน */
export const RFM_SEGMENTS: ReadonlyArray<RfmSegmentDef> =
  ['Champion', 'Loyal', 'Promising', 'Need Attention', 'Hot', 'Warm', 'Cold', "Shouldn't Lose", 'Sleepers', 'Lost'].map((key) => ({ key, label: key }));

/** แถวของ dsales_base_segment_counts ('' = ยังไม่จัดกลุ่ม) → { กลุ่ม: จำนวน } */
export function rfmCountMap(rows: ReadonlyArray<{ segment: string; n: number | string }>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.segment] = (out[r.segment] ?? 0) + Number(r.n);
  return out;
}
```

- [ ] **Step 4: Run the test, then the whole unit suite**

Run: `npx vitest run lib/domain/rfm.test.ts` → PASS.
Run: `npm test` → everything passes except possibly tests that expected the old chip list; none in `lib/` do (`baseFilters.test.ts` only checks the last option). If one fails, it must be because of the Hot chip — fix the expectation, not the code.
Run: `npm run typecheck` → no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/rfm.ts lib/domain/rfm.test.ts
git commit -m "feat(web): RFM rules from a config, Hot segment, rule text from the numbers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `rfmGrid` — the map layout from the rules

**Files:**
- Create: `lib/domain/rfmGrid.ts`
- Test: `lib/domain/rfmGrid.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_RFM_CONFIG } from './rfm';
import { rfmGrid } from './rfmGrid';

const rect = (key: string, row: number, col: number, rowSpan = 1, colSpan = 1, primary = true) => ({ key, row, col, rowSpan, colSpan, primary });

describe('rfmGrid (map of the /rfm page)', () => {
  it('default rules: F bands top-down from the most frequent, R bands left-to-right from the longest gone', () => {
    const g = rfmGrid(DEFAULT_RFM_CONFIG);
    expect(g.fBands.map((b) => b.label)).toEqual(['6+ ครั้ง', '4–5 ครั้ง', '3 ครั้ง', '2 ครั้ง', '1 ครั้ง']);
    expect(g.fBands.map((b) => b.short)).toEqual(['6+', '4–5', '3', '2', '1']);
    expect(g.rBands.map((b) => b.label)).toEqual(['เกิน 90 วัน', '61–90 วัน', '31–60 วัน', '0–30 วัน']);
    expect(g.rBands.map((b) => b.short)).toEqual(['เกิน 90', '61–90', '31–60', '0–30']);
    expect(g.rBands[0]).toMatchObject({ min: 91, max: null });
  });
  it('default rules: the layout of the approved mockup, one primary rectangle per segment', () => {
    expect(rfmGrid(DEFAULT_RFM_CONFIG).rects).toEqual([
      rect("Shouldn't Lose", 0, 0), rect('Loyal', 0, 1, 2, 2), rect('Champion', 0, 3),
      rect('Sleepers', 1, 0, 2, 1), rect('Loyal', 1, 3, 1, 1, false),
      rect('Need Attention', 2, 1, 2, 1), rect('Promising', 2, 2, 2, 2),
      rect('Lost', 3, 0, 2, 1),
      rect('Cold', 4, 1), rect('Warm', 4, 2), rect('Hot', 4, 3),
    ]);
  });
  it('moving a boundary adds a band and moves the rectangles', () => {
    const cfg = DEFAULT_RFM_CONFIG.map((s) => (s.key === 'Hot' ? { ...s, rMax: 20 } : s.key === 'Warm' ? { ...s, rMin: 21 } : s));
    const g = rfmGrid(cfg);
    expect(g.rBands.map((b) => b.short)).toEqual(['เกิน 90', '61–90', '31–60', '21–30', '0–20']);
    expect(g.rects.find((x) => x.key === 'Hot')).toEqual(rect('Hot', 4, 4));
    expect(g.rects.find((x) => x.key === 'Warm')).toEqual(rect('Warm', 4, 2, 1, 2));
  });
  it('a segment whose rule is shadowed by earlier rules has no rectangle; every cell belongs to exactly one rectangle', () => {
    const cfg = DEFAULT_RFM_CONFIG.map((s) => (s.key === 'Cold' ? { ...s, rMin: 31, rMax: 60 } : s));
    const g = rfmGrid(cfg);
    expect(g.rects.some((x) => x.key === 'Cold')).toBe(false);
    const area = g.rects.reduce((n, x) => n + x.rowSpan * x.colSpan, 0);
    expect(area).toBe(g.fBands.length * g.rBands.length);
  });
});
```

- [ ] **Step 2: Run and see it fail**

Run: `npx vitest run lib/domain/rfmGrid.test.ts`
Expected: FAIL — cannot resolve `./rfmGrid`.

- [ ] **Step 3: Write `lib/domain/rfmGrid.ts`**

```ts
import { rfmSegment, type RfmSeg } from './rfm';

/**
 * ผังของแผนที่กลุ่มลูกค้า (หน้า /rfm) สร้างจากกติกา ไม่วางตำแหน่งตายตัว
 * - แถบ F / R ตัดที่ทุกค่าขอบที่มีในกติกา → ทุกจุดในช่องเดียวกันได้กลุ่มเดียวกัน
 * - แถวบนสุด = ซื้อบ่อยสุด, คอลัมน์ซ้ายสุด = หายไปนานสุด (เหมือนกราฟ RFM เดิมของทีม)
 * - ช่องติดกันที่เป็นกลุ่มเดียวกันรวมเป็นสี่เหลี่ยม · กลุ่มหนึ่งมีได้หลายสี่เหลี่ยม: ชื่อ + จำนวนแสดงที่ primary (พื้นที่มากสุด)
 */
export interface RfmBand { min: number; max: number | null; label: string; short: string }
export interface RfmRect { key: string; row: number; col: number; rowSpan: number; colSpan: number; primary: boolean }
export interface RfmGrid { fBands: RfmBand[]; rBands: RfmBand[]; rects: RfmRect[] }

type Range = { min: number; max: number | null };

function ranges(config: ReadonlyArray<RfmSeg>, lo: 'fMin' | 'rMin', hi: 'fMax' | 'rMax', floor: number): Range[] {
  const starts = new Set<number>([floor]);
  for (const s of config) {
    if (s.fallback) continue;
    const a = s[lo];
    const b = s[hi];
    if (a != null && a > floor) starts.add(a);
    if (b != null) starts.add(b + 1);
  }
  const st = [...starts].sort((x, y) => x - y);
  return st.map((min, i) => ({ min, max: i + 1 < st.length ? st[i + 1] - 1 : null }));
}

const span = (b: Range): string => (b.max === b.min ? String(b.min) : `${b.min}–${b.max}`);
const fBand = (b: Range): RfmBand => {
  const short = b.max == null ? `${b.min}+` : span(b);
  return { ...b, short, label: `${short} ครั้ง` };
};
const rBand = (b: Range): RfmBand => {
  const short = b.max == null ? (b.min > 0 ? `เกิน ${b.min - 1}` : 'ทุกช่วง') : span(b);
  return { ...b, short, label: b.max == null && b.min === 0 ? short : `${short} วัน` };
};

export function rfmGrid(config: ReadonlyArray<RfmSeg>): RfmGrid {
  const f = ranges(config, 'fMin', 'fMax', 1).reverse();
  const r = ranges(config, 'rMin', 'rMax', 0).reverse();
  const cell = f.map((fb) => r.map((rb) => rfmSegment(fb.min, rb.min, config) ?? ''));
  const used = f.map(() => r.map(() => false));
  const rects: RfmRect[] = [];
  for (let i = 0; i < f.length; i++) {
    for (let j = 0; j < r.length; j++) {
      const key = cell[i][j];
      if (used[i][j] || !key) continue;
      let w = 1;
      while (j + w < r.length && !used[i][j + w] && cell[i][j + w] === key) w++;
      let h = 1;
      const rowFits = (row: number): boolean => {
        for (let c = j; c < j + w; c++) if (used[row][c] || cell[row][c] !== key) return false;
        return true;
      };
      while (i + h < f.length && rowFits(i + h)) h++;
      for (let a = i; a < i + h; a++) for (let c = j; c < j + w; c++) used[a][c] = true;
      rects.push({ key, row: i, col: j, rowSpan: h, colSpan: w, primary: false });
    }
  }
  const best = new Map<string, RfmRect>();
  for (const x of rects) {
    const cur = best.get(x.key);
    if (!cur || x.rowSpan * x.colSpan > cur.rowSpan * cur.colSpan) best.set(x.key, x);
  }
  for (const x of best.values()) x.primary = true;
  return { fBands: f.map(fBand), rBands: r.map(rBand), rects };
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run lib/domain/rfmGrid.test.ts` → PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/domain/rfmGrid.ts lib/domain/rfmGrid.test.ts
git commit -m "feat(web): derive the RFM map layout from the rules" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: API layer — config and map

**Files:**
- Modify: `lib/api/types.ts` (append), `lib/api/map.ts` (append), `lib/api/rpc.ts` (after `getBaseSegmentCounts`)
- Test: `lib/api/map.test.ts`, `lib/api/rpc.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `lib/api/map.test.ts` (add `mapRfmConfig` to the import from `./map`, and `import { DEFAULT_RFM_CONFIG } from '@/lib/domain/rfm';`):

```ts
describe('mapRfmConfig (dsales_rfm_config_get)', () => {
  const row = (over: object) => ({
    key: 'Hot', sort: 7, f_min: 1, f_max: 1, r_min: 0, r_max: 30, fallback: false, tone: 'ต้อนรับ', behavior: 'ใหม่', action: 'ทักทาย',
    template_bebeplay: null, template_hosttail: 't-1', no_outreach: null, ...over,
  });
  it('maps the rows and sorts them by rule order', () => {
    const out = mapRfmConfig([row({ key: 'Lost', sort: 10, f_min: null, f_max: null, r_min: null, r_max: null, fallback: true, tone: null }), row({})]);
    expect(out.map((s) => s.key)).toEqual(['Hot', 'Lost']);
    expect(out[0]).toEqual({
      key: 'Hot', sort: 7, fMin: 1, fMax: 1, rMin: 0, rMax: 30, fallback: false, tone: 'ต้อนรับ', behavior: 'ใหม่', action: 'ทักทาย',
      templateBebeplay: null, templateHosttail: 't-1', noOutreach: false,
    });
    expect(out[1]).toMatchObject({ fallback: true, fMin: null, tone: '' });
  });
  it('falls back to the built-in rules when the server has none', () => {
    expect(mapRfmConfig(null)).toEqual([...DEFAULT_RFM_CONFIG]);
    expect(mapRfmConfig([])).toEqual([...DEFAULT_RFM_CONFIG]);
  });
});
```

Append to `lib/api/rpc.test.ts` (add `getRfmConfig, getRfmMap` to the import from `./rpc`):

```ts
describe('RFM page RPCs', () => {
  it('reads the config and the map with scope, brand and view-as', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await getRfmConfig();
    expect(rpc).toHaveBeenLastCalledWith('dsales_rfm_config_get', undefined);
    await getRfmMap('team', null);
    expect(rpc).toHaveBeenLastCalledWith('dsales_rfm_map', { p_scope: 'team', p_brand: null });
    await getRfmMap('mine', 'hosttail', 'u-9');
    expect(rpc).toHaveBeenLastCalledWith('dsales_rfm_map', { p_scope: 'mine', p_brand: 'hosttail', p_as: 'u-9' });
  });
});
```

- [ ] **Step 2: Run and see them fail**

Run: `npx vitest run lib/api/map.test.ts lib/api/rpc.test.ts`
Expected: FAIL — `mapRfmConfig`, `getRfmConfig`, `getRfmMap` are not exported.

- [ ] **Step 3: Implement**

Append to `lib/api/types.ts`:

```ts
/** แถวของ dsales_rfm_config_get (20261126150000) — เรียงตาม sort */
export interface RfmSegJson {
  key: string; sort: number; f_min: number | null; f_max: number | null; r_min: number | null; r_max: number | null; fallback: boolean;
  tone: string | null; behavior: string | null; action: string | null;
  template_bebeplay: string | null; template_hosttail: string | null; no_outreach: boolean | null;
}
/** แถวของ dsales_rfm_map: segment '' = ยังไม่มีกลุ่ม · n = ทุกคนในขอบเขต · contactable = ไม่ซื้อมา ≥ 30 วัน (จอง/ทักได้) */
export interface RfmMapRow { segment: string; n: number | string; contactable: number | string }
```

In `lib/api/map.ts` add to the type import list `RfmSegJson`, add `import { DEFAULT_RFM_CONFIG, type RfmSeg } from '@/lib/domain/rfm';` and append:

```ts
/** dsales_rfm_config_get → RfmSeg เรียงตามลำดับกติกา · server ไม่มีกติกา (หรือโหลดไม่ได้ = null) → กติกาเริ่มต้นในโค้ด */
export function mapRfmConfig(rows: ReadonlyArray<RfmSegJson> | null | undefined): RfmSeg[] {
  if (!rows?.length) return [...DEFAULT_RFM_CONFIG];
  return [...rows]
    .sort((a, b) => a.sort - b.sort)
    .map((r) => ({
      key: r.key, sort: r.sort, fMin: r.f_min, fMax: r.f_max, rMin: r.r_min, rMax: r.r_max, fallback: !!r.fallback,
      tone: r.tone || '', behavior: r.behavior || '', action: r.action || '',
      templateBebeplay: r.template_bebeplay ?? null, templateHosttail: r.template_hosttail ?? null, noOutreach: !!r.no_outreach,
    }));
}
```

In `lib/api/rpc.ts` add `RfmMapRow, RfmSegJson` to the type import and insert after `getBaseSegmentCounts`:

```ts
/** กติกา + Action Context ของกลุ่ม RFM (โหลดครั้งเดียวตอนเปิดแอป) */
export const getRfmConfig = () => call<RfmSegJson[]>('dsales_rfm_config_get');
/** จำนวนลูกค้าต่อกลุ่มของหน้า /rfm ตามขอบเขต + แบรนด์ ('' = ยังไม่มีกลุ่ม) */
export const getRfmMap = (scope: BaseScope, brand: Brand | null, asUser?: string | null) =>
  call<RfmMapRow[]>('dsales_rfm_map', { p_scope: scope, p_brand: brand || null, ...(asUser ? { p_as: asUser } : {}) });
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run lib/api/map.test.ts lib/api/rpc.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/api
git commit -m "feat(web): API wrappers for the RFM config and map" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `rfmConfig` in app state, tooltips read it

**Files:**
- Modify: `lib/state/reducer.ts:30-52`, `lib/state/reducer.test.ts:6`, `lib/state/AppProvider.tsx:82-88`, `lib/fixtures/load.ts`
- Modify: `components/campaigns/BasePage.tsx`, `components/leads/LeadTable.tsx`

- [ ] **Step 1: Write the failing test**

In `lib/state/reducer.test.ts` add `import { DEFAULT_RFM_CONFIG } from '@/lib/domain/rfm';`, add the property `rfmConfig: DEFAULT_RFM_CONFIG.filter((s) => s.key !== 'Hot'),` to the `payload` object literal at line 6, and append:

```ts
describe('rfmConfig', () => {
  it('starts with the built-in rules and takes the loaded ones', () => {
    expect(initialState.rfmConfig.map((s) => s.key)).toContain('Hot');
    expect(ready.rfmConfig.map((s) => s.key)).not.toContain('Hot');
  });
});
```

In `lib/fixtures/load.test.ts` append inside the existing `describe`:

```ts
  it('carries the built-in RFM rules', () => {
    expect(fixturePayload().rfmConfig.map((s) => s.key)).toHaveLength(10);
  });
```

- [ ] **Step 2: Run and see it fail**

Run: `npx vitest run lib/state/reducer.test.ts lib/fixtures/load.test.ts`
Expected: FAIL — `rfmConfig` is undefined.

- [ ] **Step 3: Implement the state**

`lib/state/reducer.ts` — add `import { DEFAULT_RFM_CONFIG, type RfmSeg } from '@/lib/domain/rfm';`, then in `LoadedPayload` after `today: string;`:

```ts
  /** กติกา + Action Context ของกลุ่ม RFM (dsales_rfm_config_get; โหลดไม่ได้/โหมด fixture = ค่าเริ่มต้นในโค้ด) */
  rfmConfig: RfmSeg[];
```

and in `initialState` add `rfmConfig: [...DEFAULT_RFM_CONFIG],` after `today: '',`.

`lib/state/AppProvider.tsx` — add `getRfmConfig` to the import from `@/lib/api/rpc` and `mapRfmConfig` to the import from `@/lib/api/map`; replace the `Promise.all` line and the payload:

```ts
  // กติกา RFM โหลดไม่ได้ (เช่น migration ยังไม่ขึ้น) ไม่ทำให้แอปเปิดไม่ได้ — ใช้กติกาเริ่มต้นในโค้ดแทน
  const [team, campaigns, leads, rfm] = await Promise.all([getTeam(), listCampaigns(), getMyLeads(1000, 0), getRfmConfig().catch(() => null)]);
  return {
    type: 'loaded',
    payload: {
      email, meId: me.user_id, isAdmin: me.is_admin, live: true, reps: buildReps(team, me),
      campaigns: campaigns.map(mapCampaign), leads: leads.map(mapLead), customers: [], today: todayBangkok(), rfmConfig: mapRfmConfig(rfm),
    },
  };
```

`lib/fixtures/load.ts` — add `import { DEFAULT_RFM_CONFIG } from '@/lib/domain/rfm';` and the property `rfmConfig: [...DEFAULT_RFM_CONFIG],` after `today: d.today,`.

- [ ] **Step 4: Tooltips read the config**

`components/campaigns/BasePage.tsx`:
- line 61: add `rfmConfig` to the destructuring of `useAppState()`.
- chip title (`title={rfmRule(o.value) || 'ไม่มีจำนวนออเดอร์หรือวันซื้อล่าสุด'}`) → `title={rfmRule(o.value, rfmConfig) || 'ไม่มีจำนวนออเดอร์หรือวันซื้อล่าสุด'}`
- table cell (`title={rfmRule(r.segment)}`) → `title={rfmRule(r.segment, rfmConfig)}`

`components/leads/LeadTable.tsx`:
- add `import type { RfmSeg } from '@/lib/domain/rfm';` next to the existing `rfmRule` import (keep `rfmRule`).
- `RowCtx`: add `rfmConfig: ReadonlyArray<RfmSeg>;`
- in `LeadTable`: add `rfmConfig` to the `useAppState()` destructuring, to the `ctx` object and to its dependency array.
- in `LeadRow`: add `rfmConfig` to the `ctx` destructuring and render `<RfmCell l={l} today={today} config={rfmConfig} />`.
- `RfmCell` signature `({ l, today, config }: { l: Lead; today: string; config: ReadonlyArray<RfmSeg> })` and `title={rfmRule(r.segment, config)}`.

- [ ] **Step 5: Run everything**

Run: `npm test` → PASS. Run: `npm run typecheck` → no errors. Run: `npm run lint` → no warnings.

- [ ] **Step 6: Commit**

```bash
git add lib/state lib/fixtures components/campaigns/BasePage.tsx components/leads/LeadTable.tsx
git commit -m "feat(web): load the RFM config into app state and use it for the segment tooltips" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Route, menu item, page helpers

**Files:**
- Modify: `lib/routes.ts`, `lib/routes.test.ts`, `lib/nav.ts`, `lib/constants.ts` (PATHS), `lib/domain/pool.ts:112`, `lib/domain/pool.test.ts`
- Create: `lib/domain/rfmPage.ts`, `lib/domain/rfmPage.test.ts`

- [ ] **Step 1: Write the failing tests**

`lib/routes.test.ts` — add inside the first `it`: `expect(routeKey('/rfm')).toBe('rfm');` and inside the second:

```ts
    expect(routeMeta('/rfm', [])).toEqual({ key: 'rfm', title: 'กลุ่มลูกค้า RFM', sub: 'แตะกลุ่มในแผนที่เพื่อดูแนวทางและกรองรายชื่อ' });
```

`lib/domain/pool.test.ts` — append inside the `describe` that contains `demoBase carries the fixture chat rooms…`:

```ts
  it('demoBase scope team = every customer, whoever owns it', () => {
    const o = { brand: null, q: '', page: 0, today: F.today, meId: 'r4' };
    const team = demoBase(F.customers, F.leads, 'team', o).total;
    expect(team).toBe(F.customers.length);
    expect(team).toBeGreaterThan(demoBase(F.customers, F.leads, 'pool', o).total);
  });
```

Create `lib/domain/rfmPage.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_RFM_CONFIG } from './rfm';
import { RFM_SCOPE_LABEL, rfmMapStats, rfmPageFromQuery, rfmPageToQuery, rfmPercent, rfmScopes, rfmSummaryText } from './rfmPage';

describe('/rfm page state', () => {
  it('scopes: the team view is for a head who is not viewing as a rep', () => {
    expect(rfmScopes(true)).toEqual(['team', 'mine', 'pool']);
    expect(rfmScopes(false)).toEqual(['mine', 'pool']);
    expect(RFM_SCOPE_LABEL).toEqual({ team: 'ทั้งทีม', mine: 'ลูกค้าของฉัน', pool: 'ถังกลาง' });
  });
  it('reads segment and scope from the URL, dropping unknown values', () => {
    const head = rfmScopes(true);
    const rep = rfmScopes(false);
    expect(rfmPageFromQuery('?seg=Sleepers&scope=pool', head, DEFAULT_RFM_CONFIG)).toEqual({ seg: 'Sleepers', scope: 'pool' });
    expect(rfmPageFromQuery("?seg=Shouldn't+Lose", head, DEFAULT_RFM_CONFIG)).toEqual({ seg: "Shouldn't Lose", scope: 'team' });
    expect(rfmPageFromQuery('?seg=Nope&scope=team', rep, DEFAULT_RFM_CONFIG)).toEqual({ seg: '', scope: 'mine' });
    expect(rfmPageFromQuery('', rep, DEFAULT_RFM_CONFIG)).toEqual({ seg: '', scope: 'mine' });
  });
  it('writes only what differs from the default', () => {
    expect(rfmPageToQuery({ seg: '', scope: 'team' }, 'team')).toBe('');
    expect(rfmPageToQuery({ seg: 'Need Attention', scope: 'team' }, 'team')).toBe('seg=Need+Attention');
    expect(rfmPageToQuery({ seg: 'Lost', scope: 'pool' }, 'mine')).toBe('seg=Lost&scope=pool');
  });
  it('map statistics, percent and summary text', () => {
    const st = rfmMapStats([{ segment: 'Lost', n: '6938', contactable: 6938 }, { segment: 'Hot', n: 483, contactable: '12' }, { segment: '', n: 9389, contactable: 0 }]);
    expect(st).toEqual({ n: { Lost: 6938, Hot: 483, '': 9389 }, contactable: { Lost: 6938, Hot: 12, '': 0 }, scored: 7421, unscored: 9389 });
    expect([rfmPercent(232, 9082), rfmPercent(6938, 9082), rfmPercent(24, 9082), rfmPercent(1, 0)]).toEqual(['2.6%', '76.4%', '0.3%', '—']);
    expect(rfmSummaryText(9082, 9389)).toBe('จัดกลุ่มแล้ว 9,082 ราย · ยังไม่มีข้อมูลการซื้อ 9,389 ราย');
  });
});
```

- [ ] **Step 2: Run and see them fail**

Run: `npx vitest run lib/routes.test.ts lib/domain/pool.test.ts lib/domain/rfmPage.test.ts`
Expected: FAIL — `/rfm` maps to `leads`, `'team'` is not a `BaseScopeKey` (type error surfaces as a wrong total), `./rfmPage` not found.

- [ ] **Step 3: Implement**

`lib/routes.ts`:

```ts
export type RouteKey = 'leads' | 'mine' | 'pool' | 'rfm' | 'outreach' | 'campaign-bebeplay' | 'campaign-hosttail' | 'dashboard' | 'setup';
```

add `'/rfm': 'rfm',` to `PATH_KEYS` (after `'/pool': 'pool',`) and to `TITLES` (after `pool`):

```ts
  rfm: ['กลุ่มลูกค้า RFM', 'แตะกลุ่มในแผนที่เพื่อดูแนวทางและกรองรายชื่อ'],
```

`lib/constants.ts` — add to `PATHS` (after `grid`):

```ts
  /** แผนที่กลุ่มลูกค้า RFM (สี่เหลี่ยมไม่เท่ากัน 4 ช่อง) */
  rfm: 'M3 3h11v9H3zm13 0h5v9h-5zM3 14h7v7H3zm9 0h9v7h-9z',
```

`lib/nav.ts` — in the group `ฐานลูกค้าเก่า`, between `pool` and `outreach`:

```ts
      { key: 'rfm', href: '/rfm', label: 'กลุ่ม RFM', icon: PATHS.rfm },
```

`lib/domain/pool.ts`:
- line 112: `export type BaseScopeKey = 'mine' | 'pool' | 'team';`
- in `demoBase` replace `return (scope === 'mine' ? owner === o.meId : owner === null) && …` with

```ts
        const inScope = scope === 'team' ? true : scope === 'mine' ? owner === o.meId : owner === null;
        return inScope && (!o.brand || c.brand === o.brand)
          && (!q || c.name.toLowerCase().includes(q) || (c.chatName || '').toLowerCase().includes(q) || (!!qd && c.phone.includes(qd)));
```

Create `lib/domain/rfmPage.ts`:

```ts
import type { RfmMapRow } from '@/lib/api/types';
import type { BaseScopeKey } from './pool';
import type { RfmSeg } from './rfm';

// สถานะและข้อความของหน้า /rfm — ฟังก์ชันล้วน

export const RFM_SCOPE_LABEL: Record<BaseScopeKey, string> = { team: 'ทั้งทีม', mine: 'ลูกค้าของฉัน', pool: 'ถังกลาง' };

/** หัวหน้า (ไม่ได้ดูในมุมมองเซลล์) เห็น "ทั้งทีม" และเริ่มที่นั่น · เซลล์ / หัวหน้าในมุมมองเซลล์ = ลูกค้าของฉัน, ถังกลาง */
export const rfmScopes = (teamView: boolean): BaseScopeKey[] => (teamView ? ['team', 'mine', 'pool'] : ['mine', 'pool']);

export interface RfmPageState { seg: string; scope: BaseScopeKey }

/** /rfm?seg=<กลุ่ม>&scope=<ขอบเขต> — ค่าที่ไม่รู้จักถูกทิ้ง (ไม่เลือกกลุ่ม / ขอบเขตแรกของผู้ใช้) */
export function rfmPageFromQuery(search: string, scopes: ReadonlyArray<BaseScopeKey>, config: ReadonlyArray<Pick<RfmSeg, 'key'>>): RfmPageState {
  const q = new URLSearchParams(search);
  const seg = q.get('seg') ?? '';
  const scope = scopes.find((s) => s === q.get('scope')) ?? scopes[0];
  return { seg: config.some((s) => s.key === seg) ? seg : '', scope };
}

export function rfmPageToQuery(st: RfmPageState, defaultScope: BaseScopeKey): string {
  const q = new URLSearchParams();
  if (st.seg) q.set('seg', st.seg);
  if (st.scope !== defaultScope) q.set('scope', st.scope);
  return q.toString();
}

export interface RfmMapStats { n: Record<string, number>; contactable: Record<string, number>; scored: number; unscored: number }

/** แถวของ dsales_rfm_map → จำนวนต่อกลุ่ม + ยอดที่จัดกลุ่มแล้ว / ยังไม่มีกลุ่ม ('') */
export function rfmMapStats(rows: ReadonlyArray<RfmMapRow>): RfmMapStats {
  const n: Record<string, number> = {};
  const contactable: Record<string, number> = {};
  for (const r of rows) {
    n[r.segment] = (n[r.segment] ?? 0) + Number(r.n);
    contactable[r.segment] = (contactable[r.segment] ?? 0) + Number(r.contactable);
  }
  const unscored = n[''] ?? 0;
  const scored = Object.values(n).reduce((a, b) => a + b, 0) - unscored;
  return { n, contactable, scored, unscored };
}

export const rfmPercent = (n: number, total: number): string => (total > 0 ? `${(Math.round((n / total) * 1000) / 10).toLocaleString('th-TH')}%` : '—');

export const rfmSummaryText = (scored: number, unscored: number): string =>
  `จัดกลุ่มแล้ว ${scored.toLocaleString('th-TH')} ราย · ยังไม่มีข้อมูลการซื้อ ${unscored.toLocaleString('th-TH')} ราย`;
```

- [ ] **Step 4: Run the tests and typecheck**

Run: `npx vitest run lib/routes.test.ts lib/domain/pool.test.ts lib/domain/rfmPage.test.ts` → PASS.
Run: `npm run typecheck` → no errors (the `Record<…RouteKey…>` in `routes.ts` forces the new title).

- [ ] **Step 5: Commit**

```bash
git add lib/routes.ts lib/routes.test.ts lib/nav.ts lib/constants.ts lib/domain/pool.ts lib/domain/pool.test.ts lib/domain/rfmPage.ts lib/domain/rfmPage.test.ts
git commit -m "feat(web): /rfm route, menu item, team scope and page helpers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: `BasePage` embedded mode (`fixedRfm`)

`BasePage` is the customer table of `/mine` and `/pool`. On `/rfm` it is embedded under the map with the group locked. It has no unit test (it is exercised by e2e); this task is checked by typecheck here and by the e2e of Task 10.

**Files:**
- Modify: `components/campaigns/BasePage.tsx`

- [ ] **Step 1: Signature and initial state**

Replace

```tsx
export function BasePage({ scope }: { scope: BaseScopeKey }) {
```

with

```tsx
/** fixedRfm = ฝังในหน้า /rfm: ล็อกตัวกรองกลุ่มลูกค้าเป็นกลุ่มนี้ ซ่อนชิปกลุ่ม และไม่อ่าน/เขียนตัวกรองใน URL (URL เป็นของหน้า /rfm) */
export function BasePage({ scope, fixedRfm }: { scope: BaseScopeKey; fixedRfm?: string }) {
  const embedded = fixedRfm !== undefined;
```

Replace `const [f, setF] = useState<BaseFilter>(initialFilter);` with

```tsx
  const [f, setF] = useState<BaseFilter>(() => (embedded ? { q: '', page: 0, filters: EMPTY_FILTERS } : initialFilter()));
```

Replace `const [linkBrand] = useState(() => urlState().brand);` with

```tsx
  const [linkBrand] = useState(() => (embedded ? '' : urlState().brand));
```

After the `prevBrand` block add:

```tsx
  // เปลี่ยนกลุ่มที่ล็อกไว้ (กดกลุ่มอื่นในแผนที่) = กลับหน้าแรก
  const [prevRfm, setPrevRfm] = useState(fixedRfm);
  if (prevRfm !== fixedRfm) {
    setPrevRfm(fixedRfm);
    setF((x) => (x.page ? { ...x, page: 0 } : x));
  }
  /** ตัวกรองที่ใช้โหลดจริง: โหมดฝัง = ตัวกรองของผู้ใช้ + กลุ่มที่ล็อกไว้ */
  const filters = useMemo<BaseFilters>(() => (embedded ? { ...f.filters, rfm: [fixedRfm ?? ''] } : f.filters), [embedded, fixedRfm, f.filters]);
```

- [ ] **Step 2: Counts, URL, loading and the fixture rows use the embedded rules**

- counts effect: first line `if (!live) return;` → `if (!live || embedded) return;` and add `embedded` to its dependency array.
- `demoCounts`: `if (live) return null;` → `if (live || embedded) return null;` and add `embedded` to its dependency array.
- URL effect: add `if (embedded) return;` as its first line and `embedded` to its dependency array.
- load effect: `filters: { ...buildFilterJson(f.filters), …}` → `filters: { ...buildFilterJson(filters), …}` and in its dependency array replace `f.filters` with `filters`.
- `demo` memo: `filters: f.filters` → `filters` and in its dependency array replace `f.filters` with `filters`.

(`const filtered = hasFilters(f.filters);` stays as it is: "ล้างตัวกรอง" only clears what the user chose.)

- [ ] **Step 3: Hide the group chips when embedded**

Replace

```tsx
          <span className="sub">กลุ่มลูกค้า</span>
          {RFM_OPTIONS.map((o) => {
```

with

```tsx
          {embedded ? <span className="tag" id="base-fixed-rfm">กลุ่ม: {fixedRfm}</span> : <span className="sub">กลุ่มลูกค้า</span>}
          {(embedded ? [] : RFM_OPTIONS).map((o) => {
```

- [ ] **Step 4: Typecheck, lint, unit tests**

Run: `npm run typecheck` → no errors. Run: `npm run lint` → no warnings. Run: `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add components/campaigns/BasePage.tsx
git commit -m "feat(web): BasePage can be embedded with a locked customer group" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: The `/rfm` page

**Files:**
- Create: `components/rfm/RfmMap.tsx`, `components/rfm/RfmActionCard.tsx`, `components/rfm/RfmPage.tsx`, `app/(app)/rfm/page.tsx`
- Modify: `styles/tokens.css`, `styles/app.css`

- [ ] **Step 1: Group colours in `styles/tokens.css`**

In `:root`, after the `/* brands */` block:

```css
  /* RFM groups on the /rfm map (.rfm-seg-<slug>) — neighbours differ in lightness, not only hue */
  --rfm-champion: #0E2A5E;        --rfm-champion-fg: #FFFFFF;
  --rfm-shouldn-t-lose: #6A3FB5;  --rfm-shouldn-t-lose-fg: #FFFFFF;
  --rfm-loyal: #1557C0;           --rfm-loyal-fg: #FFFFFF;
  --rfm-sleepers: #DCCBF5;        --rfm-sleepers-fg: #2C1A57;
  --rfm-promising: #BCD3FA;       --rfm-promising-fg: #0E2A5E;
  --rfm-need-attention: #F6D9EC;  --rfm-need-attention-fg: #561A40;
  --rfm-hot: #157F3D;             --rfm-hot-fg: #FFFFFF;
  --rfm-warm: #8FD3A8;            --rfm-warm-fg: #0E3D20;
  --rfm-cold: #DDF2E4;            --rfm-cold-fg: #0E3D20;
  --rfm-lost: #FDECC8;            --rfm-lost-fg: #4A2B05;
```

In **both** dark blocks (`@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }` and `:root[data-theme="dark"] { … }`), before `color-scheme: dark;`:

```css
    --rfm-champion: #A9C4F7; --rfm-champion-fg: #0B1B3A; --rfm-shouldn-t-lose: #B79AF0; --rfm-shouldn-t-lose-fg: #1F1140;
    --rfm-loyal: #4C8DF6; --rfm-loyal-fg: #06132B; --rfm-sleepers: #3D2C6B; --rfm-sleepers-fg: #E6DAFB;
    --rfm-promising: #24406F; --rfm-promising-fg: #D6E4FD; --rfm-need-attention: #5A2748; --rfm-need-attention-fg: #F8DDEE;
    --rfm-hot: #6FD69A; --rfm-hot-fg: #06281A; --rfm-warm: #2E6B46; --rfm-warm-fg: #DFF5E7;
    --rfm-cold: #1D3A29; --rfm-cold-fg: #CFEBD9; --rfm-lost: #4A3A1A; --rfm-lost-fg: #FBE7BF;
```

- [ ] **Step 2: Page styles in `styles/app.css`**

Insert before the first `@media (max-width: 900px)` block:

```css
/* /rfm: customer-group map (F × R), action card, embedded customer list */
.rfm-top { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 16px; align-items: stretch; }
.rfm-card { padding: 16px 18px; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.rfm-card h2 { margin: 0; font-size: 16px; font-weight: 600; }
.rfm-head, .rfm-foot { display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; justify-content: space-between; }
.rfm-map { --rfm-row: 78px; --rfm-axis: 72px; display: grid; gap: 4px; }
.rfm-axis { display: flex; align-items: center; color: var(--fg-2); font-size: 12.5px; min-width: 0; }
.rfm-axis.x { align-items: flex-start; padding-top: 4px; }
.rfm-cell {
  border: 0; border-radius: var(--radius); padding: 10px 12px; text-align: left; cursor: pointer; font: inherit;
  display: flex; flex-direction: column; min-width: 0; min-height: 0; overflow: hidden;
}
.rfm-cell .nm { font-size: 13px; font-weight: 600; }
.rfm-cell .n { font-size: 24px; font-weight: 600; line-height: 1.2; font-variant-numeric: tabular-nums; }
.rfm-cell.on { outline: 3px solid var(--fg); outline-offset: 2px; }
.rfm-cell:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
.rfm-seg-champion { background: var(--rfm-champion); color: var(--rfm-champion-fg); }
.rfm-seg-shouldn-t-lose { background: var(--rfm-shouldn-t-lose); color: var(--rfm-shouldn-t-lose-fg); }
.rfm-seg-loyal { background: var(--rfm-loyal); color: var(--rfm-loyal-fg); }
.rfm-seg-sleepers { background: var(--rfm-sleepers); color: var(--rfm-sleepers-fg); }
.rfm-seg-promising { background: var(--rfm-promising); color: var(--rfm-promising-fg); }
.rfm-seg-need-attention { background: var(--rfm-need-attention); color: var(--rfm-need-attention-fg); }
.rfm-seg-hot { background: var(--rfm-hot); color: var(--rfm-hot-fg); }
.rfm-seg-warm { background: var(--rfm-warm); color: var(--rfm-warm-fg); }
.rfm-seg-cold { background: var(--rfm-cold); color: var(--rfm-cold-fg); }
.rfm-seg-lost { background: var(--rfm-lost); color: var(--rfm-lost-fg); }
.rfm-title { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; }
.rfm-title h2 { display: flex; gap: 10px; align-items: center; font-size: 18px; }
.rfm-dot { width: 14px; height: 14px; border-radius: 4px; flex: none; }
.rfm-stats { display: flex; flex-wrap: wrap; gap: 20px; }
.rfm-stats b { display: block; font-size: 26px; font-weight: 600; line-height: 1.2; font-variant-numeric: tabular-nums; }
.rfm-advice { background: var(--accent-soft); border-radius: var(--radius); padding: 12px 14px; }
.rfm-advice .h { color: var(--accent-strong); font-size: 12.5px; font-weight: 600; }
.rfm-warn { background: var(--warn-soft); color: var(--warn); border-radius: var(--radius); padding: 10px 14px; font-size: 13px; }
.rfm-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: auto; }
.rfm-list { display: flex; flex-direction: column; gap: 16px; scroll-margin-top: 80px; }
```

Inside the existing `@media (max-width: 900px) { … }` block add:

```css
  .rfm-top { grid-template-columns: minmax(0, 1fr); }
```

Inside the existing `@media (max-width: 760px) { … }` block add:

```css
  .rfm-card { padding: 12px; }
  .rfm-map { --rfm-row: 52px; --rfm-axis: 32px; }
  .rfm-cell { padding: 5px 7px; border-radius: 8px; }
  .rfm-cell .nm { font-size: 11px; }
  .rfm-cell .n { font-size: 16px; }
  .rfm-axis { font-size: 12px; }
```

- [ ] **Step 3: `components/rfm/RfmMap.tsx`**

```tsx
'use client';

import type { CSSProperties } from 'react';
import { rfmSlug } from '@/lib/domain/rfm';
import type { RfmGrid } from '@/lib/domain/rfmGrid';

/**
 * แผนที่กลุ่มลูกค้า: แกนตั้ง F (ความถี่) แกนนอน R (ซื้อล่าสุด) — ผังมาจาก rfmGrid(config)
 * ทุกสี่เหลี่ยมเป็นปุ่ม กด = เลือกกลุ่ม (กดซ้ำกลุ่มเดิม = เลิกเลือก ทำที่ผู้เรียก) · counts null = ยังโหลดไม่เสร็จ (ไม่แสดงตัวเลข)
 */
export function RfmMap({ grid, counts, selected, onSelect }: {
  grid: RfmGrid; counts: Readonly<Record<string, number>> | null; selected: string; onSelect: (key: string) => void;
}) {
  const cols = grid.rBands.map((_, j) => (j === 0 ? 'minmax(0, 1.6fr)' : 'minmax(0, 1fr)')).join(' ');
  const style: CSSProperties = { gridTemplateColumns: `var(--rfm-axis) ${cols}`, gridTemplateRows: `repeat(${grid.fBands.length}, var(--rfm-row)) auto` };
  return (
    <div className="rfm-map" id="rfm-map" style={style}>
      {grid.fBands.map((b, i) => (
        <div key={`f${b.min}`} className="rfm-axis" style={{ gridColumn: 1, gridRow: i + 1 }}>
          <span className="lbl-long">{b.label}</span><span className="lbl-short">{b.short}</span>
        </div>
      ))}
      {grid.rects.map((x) => {
        const on = selected === x.key;
        const n = counts ? (counts[x.key] ?? 0) : null;
        return (
          <button
            key={`${x.key}-${x.row}-${x.col}`} type="button" className={`rfm-cell rfm-seg-${rfmSlug(x.key)}${on ? ' on' : ''}`}
            data-seg={x.key} aria-pressed={on} aria-label={x.primary ? undefined : x.key}
            style={{ gridColumn: `${x.col + 2} / span ${x.colSpan}`, gridRow: `${x.row + 1} / span ${x.rowSpan}` }}
            onClick={() => onSelect(x.key)}
          >
            {x.primary ? (
              <>
                <span className="nm">{x.key}</span>
                <span className="n">{n === null ? '' : n.toLocaleString('th-TH')}</span>
              </>
            ) : null}
          </button>
        );
      })}
      {grid.rBands.map((b, j) => (
        <div key={`r${b.min}`} className="rfm-axis x" style={{ gridColumn: j + 2, gridRow: grid.fBands.length + 1 }}>
          <span className="lbl-long">{b.label}</span><span className="lbl-short">{b.short}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: `components/rfm/RfmActionCard.tsx`**

```tsx
'use client';

import { rfmRuleText, rfmSlug, type RfmSeg } from '@/lib/domain/rfm';
import { rfmPercent } from '@/lib/domain/rfmPage';

const num = (n: number | null): string => (n === null ? '—' : n.toLocaleString('th-TH'));

/** การ์ดแนวทางของกลุ่มที่เลือก (Action Context): เงื่อนไข, พฤติกรรมลูกค้า, แคมเปญแนะนำ · n / contactable = null ระหว่างโหลด */
export function RfmActionCard({ seg, n, contactable, scored }: { seg: RfmSeg | null; n: number | null; contactable: number | null; scored: number | null }) {
  if (!seg) {
    return (
      <section className="card rfm-card" id="rfm-action">
        <h2>แนวทางของกลุ่ม</h2>
        <div className="sub">แตะกลุ่มในแผนที่เพื่อดูพฤติกรรมลูกค้า แคมเปญแนะนำ และรายชื่อลูกค้าของกลุ่มนั้น</div>
      </section>
    );
  }
  return (
    <section className="card rfm-card" id="rfm-action" data-seg={seg.key}>
      <div className="rfm-title">
        <h2><span className={`rfm-dot rfm-seg-${rfmSlug(seg.key)}`} aria-hidden="true" />{seg.key}</h2>
        {seg.tone ? <span className="tag">{seg.tone}</span> : null}
      </div>
      <div className="rfm-stats">
        <div><b id="rfm-n">{num(n)}</b><span className="sub">ราย</span></div>
        <div><b>{n !== null && scored !== null ? rfmPercent(n, scored) : '—'}</b><span className="sub">ของลูกค้าที่จัดกลุ่มแล้ว</span></div>
        <div><b id="rfm-contactable">{num(contactable)}</b><span className="sub">ติดต่อได้ตอนนี้</span></div>
      </div>
      <div><div className="sub">เงื่อนไขของกลุ่ม</div><div>{rfmRuleText(seg)}</div></div>
      {seg.behavior ? <div><div className="sub">พฤติกรรมลูกค้า</div><div>{seg.behavior}</div></div> : null}
      {seg.action ? <div className="rfm-advice"><div className="h">แคมเปญแนะนำ</div><div>{seg.action}</div></div> : null}
      {seg.noOutreach ? <div className="rfm-warn">กลุ่มนี้ตั้งค่าไว้ว่า &quot;ไม่ส่งข้อความเป็นชุด&quot;</div> : null}
      <div className="rfm-actions">
        <a className="btn primary" href="#rfm-list">ดูรายชื่อที่ติดต่อได้ {num(contactable)} ราย</a>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: `components/rfm/RfmPage.tsx`**

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { BasePage } from '@/components/campaigns/BasePage';
import { errorMessage } from '@/lib/api/errors';
import { getRfmMap } from '@/lib/api/rpc';
import type { RfmMapRow } from '@/lib/api/types';
import { EMPTY_FILTERS } from '@/lib/domain/baseFilters';
import { pageBrand } from '@/lib/domain/brand';
import { demoBase } from '@/lib/domain/pool';
import { rfmGrid } from '@/lib/domain/rfmGrid';
import { RFM_SCOPE_LABEL, rfmMapStats, rfmPageFromQuery, rfmPageToQuery, rfmScopes, rfmSummaryText, type RfmPageState } from '@/lib/domain/rfmPage';
import { useActions, useAppState } from '@/lib/state/AppProvider';
import { useActor } from '@/lib/state/useActor';
import { RfmActionCard } from './RfmActionCard';
import { RfmMap } from './RfmMap';

/**
 * หน้า "กลุ่มลูกค้า RFM" (spec 2026-11-26): แผนที่กลุ่ม → การ์ดแนวทางของกลุ่มที่เลือก → รายชื่อลูกค้าของกลุ่ม (BasePage ฝัง)
 * - ขอบเขต: หัวหน้า = ทั้งทีม / ลูกค้าของฉัน / ถังกลาง · เซลล์และหัวหน้าในมุมมองเซลล์ = ลูกค้าของฉัน / ถังกลาง
 * - ตัวเลขบนแผนที่ = ลูกค้าทุกคนในขอบเขตที่มีกลุ่ม (dsales_rfm_map.n) · รายชื่อ = เฉพาะคนที่ติดต่อได้ (≥ 30 วัน) ตามกติกาเดิม
 * - กลุ่มและขอบเขตเก็บใน URL (?seg=&scope=) · แบรนด์ = แบรนด์ใหญ่ใน topbar
 */
export function RfmPage() {
  const { live, isAdmin, viewAs, brand: scopeBrand, poolVersion, customers, leads, today, rfmConfig } = useAppState();
  const { actorId: meId, forUser } = useActor();
  const { handleAuthError } = useActions();
  const b = pageBrand(scopeBrand);
  const scopes = useMemo(() => rfmScopes(isAdmin && !viewAs), [isAdmin, viewAs]);
  const [st, setSt] = useState<RfmPageState>(() => rfmPageFromQuery(typeof window === 'undefined' ? '' : window.location.search, scopes, rfmConfig));
  // เปลี่ยนมุมมอง (หัวหน้าเข้า/ออกจากมุมมองเซลล์) แล้วขอบเขตเดิมใช้ไม่ได้ = ขอบเขตแรกของมุมมองใหม่
  const scope = scopes.includes(st.scope) ? st.scope : scopes[0];
  const seg = rfmConfig.find((s) => s.key === st.seg) ?? null;

  useEffect(() => {
    const qs = rfmPageToQuery({ seg: seg?.key ?? '', scope }, scopes[0]);
    if (qs === window.location.search.replace(/^\?/, '')) return;
    window.history.replaceState(window.history.state, '', qs ? `?${qs}` : window.location.pathname);
  }, [seg, scope, scopes]);

  const [liveMap, setLiveMap] = useState<{ key: string; rows: RfmMapRow[]; err: string } | null>(null);
  const mapKey = `${scope}|${b}|${poolVersion}|${forUser ?? ''}`;
  useEffect(() => {
    if (!live) return;
    let alive = true;
    getRfmMap(scope, b || null, scope === 'mine' ? forUser : null).then(
      (rows) => {
        if (alive) setLiveMap({ key: mapKey, rows: rows || [], err: '' });
      },
      (e: unknown) => {
        if (alive && !handleAuthError(e)) setLiveMap({ key: mapKey, rows: [], err: 'โหลดจำนวนลูกค้าต่อกลุ่มไม่สำเร็จ: ' + errorMessage(e) });
      },
    );
    return () => {
      alive = false;
    };
  }, [live, scope, b, mapKey, forUser, handleAuthError]);

  // โหมด fixture: นับจากลูกค้าตัวอย่างด้วยกติกาเดียวกับ /mine /pool (ไม่มีกติกา 30 วัน → ติดต่อได้ = ทั้งหมด)
  const demoRows = useMemo<RfmMapRow[] | null>(() => {
    if (live) return null;
    return [...rfmConfig.map((s) => s.key), ''].map((key) => {
      const n = demoBase(customers, leads, scope, { brand: b || null, q: '', page: 0, today, meId, filters: { ...EMPTY_FILTERS, rfm: [key] } }).total;
      return { segment: key, n, contactable: n };
    });
  }, [live, rfmConfig, customers, leads, scope, b, today, meId]);

  const current = live ? (liveMap?.key === mapKey ? liveMap : null) : null;
  const rows = demoRows ?? (current && !current.err ? current.rows : null);
  const stats = useMemo(() => (rows ? rfmMapStats(rows) : null), [rows]);
  const grid = useMemo(() => rfmGrid(rfmConfig), [rfmConfig]);
  const pick = (key: string) => setSt((x) => ({ ...x, scope, seg: x.seg === key ? '' : key }));

  return (
    <>
      <div className="toolbar" id="rfm-scope">
        {scopes.map((s) => (
          <button key={s} type="button" className={`chip ${scope === s ? 'active' : ''}`} data-scope={s} aria-pressed={scope === s} onClick={() => setSt((x) => ({ ...x, scope: s }))}>
            {RFM_SCOPE_LABEL[s]}
          </button>
        ))}
        <span className="sub num" id="rfm-summary">{stats ? rfmSummaryText(stats.scored, stats.unscored) : current?.err ? '' : 'กำลังโหลด…'}</span>
      </div>
      {current?.err ? <div className="login-err">{current.err}</div> : null}
      <div className="rfm-top">
        <section className="card rfm-card" aria-label="แผนที่กลุ่มลูกค้า">
          <div className="rfm-head">
            <h2>แผนที่กลุ่มลูกค้า</h2>
            <span className="sub">แกนตั้ง F = ความถี่ · แกนนอน R = ซื้อล่าสุด</span>
          </div>
          <RfmMap grid={grid} counts={stats ? stats.n : null} selected={seg?.key ?? ''} onSelect={pick} />
          <div className="rfm-foot sub">
            <span>← หายไปนาน</span>
            <span className="lbl-long">ซื้อล่าสุด (R) · จำนวนวันนับจากวันที่ซื้อครั้งล่าสุด</span>
            <span>เพิ่งซื้อ →</span>
          </div>
        </section>
        <RfmActionCard
          seg={seg} n={seg && stats ? (stats.n[seg.key] ?? 0) : null}
          contactable={seg && stats ? (stats.contactable[seg.key] ?? 0) : null} scored={stats ? stats.scored : null}
        />
      </div>
      {seg ? (
        <div className="rfm-list" id="rfm-list">
          <BasePage key={scope} scope={scope} fixedRfm={seg.key} />
        </div>
      ) : null}
    </>
  );
}
```

- [ ] **Step 6: Route `app/(app)/rfm/page.tsx`**

```tsx
import { RfmPage } from '@/components/rfm/RfmPage';

export default function RfmRoute() {
  return <RfmPage />;
}
```

- [ ] **Step 7: Typecheck, lint, unit tests**

Run: `npm run typecheck` → no errors. Run: `npm run lint` → no warnings. Run: `npm test` → PASS.

- [ ] **Step 8: Look at it in the browser (fixture mode)**

Start the preview `directsale-rfm-fixtures` (port 3260, defined in `C:\Claude Ai\Directsale\.claude\launch.json`) and open `http://localhost:3260/rfm`.
Check, at the default width and at 390px:
1. Menu has "กลุ่ม RFM" and it is active; title "กลุ่มลูกค้า RFM".
2. The map has 11 buttons (10 groups; Loyal has two), axis labels as in the mockup, a number on each named block.
3. Clicking "Lost" outlines it, the card shows tone "หยุดส่ง", the rule text, the behaviour, the recommended campaign; the URL becomes `/rfm?seg=Lost`; the table below shows only "Lost" rows and the tag "กลุ่ม: Lost" instead of the group chips.
4. Clicking "Lost" again clears the selection and removes the list.
5. Scope chips "ทั้งทีม / ลูกค้าของฉัน / ถังกลาง" change the numbers; reload keeps scope and group.
6. At 390px the page does not scroll sideways (`document.documentElement.scrollWidth <= window.innerWidth`).
7. Dark mode (`resize_window` with `colorScheme: "dark"`): every block is readable.
Stop the preview server afterwards.

- [ ] **Step 9: Commit**

```bash
git add components/rfm "app/(app)/rfm" styles/tokens.css styles/app.css
git commit -m "feat(web): /rfm page with the customer-group map, action card and filtered list" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: e2e

**Files:**
- Create: `e2e/rfm.spec.ts`
- Modify: `e2e/mobile-fit.spec.ts:7,53`, `e2e/visual-parity.spec.ts` (`openLegacyShell`), `e2e/outreach.spec.ts:98`

Before running: no dev server may be running in this worktree and ports 3100 / 4100 must be free (Playwright starts its own servers).

- [ ] **Step 1: Write `e2e/rfm.spec.ts`**

```ts
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
```

- [ ] **Step 2: Run it**

Run: `npx playwright test e2e/rfm.spec.ts --reporter=list`
Expected: 2 passed. (The feature exists already — this test pins it. If it fails, fix the page, not the test, unless the fixture data has no customer in Lost; then pick the segment with the largest number on the map and use its texts.)

- [ ] **Step 3: Update the specs that list the menu, the pages and the chips**

`e2e/mobile-fit.spec.ts`:
- line 7: `const PAGES = ['/leads', '/mine', '/pool', '/rfm', '/outreach', '/campaigns/bebeplay', '/campaigns/hosttail', '/dashboard', '/setup'];`
- line 10 comment `(8 เมนู)` → `(9 เมนู)`; line 53: `await expect(items).toHaveCount(9);`

`e2e/visual-parity.spec.ts`, function `openLegacyShell`: add the RFM item to the HTML injected into the prototype, between the `pool` and `outreach` links, and pass the icon:

```ts
        `<a class="nav-item" href="#rfm" data-route="rfm"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${rfm}"></path></svg><span>กลุ่ม RFM</span></a>` +
```

and change the callback signature / argument to `({ person, list, send, rfm })` and `{ person: PATHS.person, list: PATHS.list, send: PATHS.send, rfm: PATHS.rfm }`; update the comment above it to "(+ กลุ่ม RFM, ส่งข้อความ)".

`e2e/outreach.spec.ts:98`:

```ts
      await expect(page.locator('[data-rfm] .lbl')).toHaveText(['Champion', 'Loyal', 'Promising', 'Need Attention', 'Hot', 'Warm', 'Cold', "Shouldn't Lose", 'Sleepers', 'Lost']);
```

- [ ] **Step 4: Run the affected e2e**

Run: `npx playwright test e2e/mobile-fit.spec.ts e2e/rfm.spec.ts --reporter=list`
Expected: all pass, including `fits a 390px phone: /rfm` and the menu drawer test with 9 items.

Run: `npx playwright test e2e/visual-parity.spec.ts -g "shell" --reporter=list`
Expected: the text comparison of the shell passes. Screenshot comparisons of the shell (`shell-*.png`) fail because the menu has one more item — that is intended: run `npx playwright test e2e/visual-parity.spec.ts -g "shell" --update-snapshots=changed`, open the changed PNGs under `e2e/__screenshots__/` and check by eye that the only difference is the new menu item.
Known and unrelated (see repo `CLAUDE.md` "งานค้าง" and PR #11): `leads page matches the prototype` fails on `main` because of the head's "ยกเลิกจอง" button, and the `send-outreach-*` / `outreach-*` baselines are stale. Do not try to fix those here; report them as pre-existing.

- [ ] **Step 5: Commit**

```bash
git add e2e
git commit -m "test(e2e): /rfm page, menu item and Hot chip" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Docs, final checks, hand-over

**Files:**
- Modify: `CLAUDE.md`, `docs/DATABASE.md`, `docs/superpowers/specs/2026-11-26-rfm-page-design.md`

- [ ] **Step 1: `CLAUDE.md`**

- Architecture tree: under `components/` add the line `  rfm/                          # RfmPage (/rfm), RfmMap, RfmActionCard` and change the routes line to `(app)/leads|mine|pool|rfm|dashboard|setup/page.tsx`.
- Migration list: after the `20261126140000_dsales_lead_json_rfm.sql` entry add:

```md
  - `20261126150000_dsales_rfm_config.sql` — **กติกากลุ่ม RFM อยู่ในตาราง + หน้า `/rfm`** (spec `docs/superpowers/specs/2026-11-26-rfm-page-design.md`): `dsales_rfm_segments` (ภายใน ไม่มี grant; 10 กลุ่มคงที่ เช็กตาม `sort_order`, Lost = fallback, เก็บ Action Context: tone / behavior / action / template ต่อแบรนด์ / no_outreach) · **Hot แยกจาก Warm** (ซื้อครั้งเดียว 0–30 วัน) · `dsales_rfm(orders, days)` อ่านตาราง (stable) · `dsales_customer_base.rfm` เป็นคอลัมน์ปกติ ตั้งโดย trigger `dsales_customer_base_set_rfm` ตอน insert / update `order_count`, `dormant_days` · `dsales_rfm_apply()` (ภายใน) คำนวณทั้งตารางหลังแก้กติกา · `dsales_rfm_config_get()` (สมาชิก) → เว็บโหลดครั้งเดียวเก็บใน `state.rfmConfig` · `dsales_rfm_map(p_scope, p_brand, p_as)` จำนวนต่อกลุ่มของหน้า `/rfm` (`n` = ทุกคน, `contactable` = `eligible`) · เว็บ: `lib/domain/rfm.ts` (`DEFAULT_RFM_CONFIG` ต้องตรงกับ seed), `rfmGrid` สร้างผังแผนที่จากกติกา, `BasePage` ฝังด้วย `fixedRfm` · ยังไม่มีหน้าตั้งค่า (แผน 2) และยังไม่บังคับ `no_outreach` (แผน 3) — แก้กติกาตอนนี้ต้อง update ตารางแล้วเรียก `dsales_rfm_apply()`; test `32_rfm_config.sql`
```

- In "งานค้าง" replace the `RFM:` bullet with:

```md
- RFM: หน้า `/rfm` + กติกาในตารางเสร็จแล้ว (20261126150000) — ยังค้าง: หน้า `/rfm/settings` (preview/save), บังคับ "ไม่ส่งข้อความเป็นชุด" + template เริ่มต้นของกลุ่มใน popup ส่งข้อความ, AI ช่วยเขียนข้อความจาก Action Context (ดู spec ข้อ 6)
```

- [ ] **Step 2: `docs/DATABASE.md`**

In the table of section 3 add a row for `dsales_rfm_segments` (columns as in the migration; "ภายใน — ไม่มี grant") and in the RPC table of section 4 add:

```md
| `dsales_rfm_config_get()` | กติกา + Action Context ของ 10 กลุ่ม RFM เรียงตามลำดับเช็ก | ตอนเปิดแอป |
| `dsales_rfm_map(p_scope, p_brand, p_as)` | จำนวนลูกค้าต่อกลุ่ม: `n` ทุกคนในขอบเขต, `contactable` เฉพาะที่ไม่ซื้อมา ≥ 30 วัน (`''` = ยังไม่มีกลุ่ม) | `/rfm` |
```

- [ ] **Step 3: Spec — record the two decisions made while planning**

In `docs/superpowers/specs/2026-11-26-rfm-page-design.md`:
- section 3 table: Sleepers "F ถึง" `—` → `5`; Promising and Need Attention "F ถึง" `—` → `3` (same result as before because of the rule order, but the rule text is exact).
- section 8: add the line `แผนลงมือทำ: แผน 1 = ข้อ 1–2 (docs/superpowers/plans/2026-11-26-rfm-page-plan-1.md) · แผน 2 = ข้อ 3 พร้อม RPC preview/save · แผน 3 = ข้อ 4`.

- [ ] **Step 4: Full verification**

Run each and read the output:
- `npm test` → all pass
- `npm run typecheck` → no errors
- `npm run lint` → no warnings or errors
- `npm run build` → succeeds, then `npm run check:fixtures` → no fixture data in `.next`

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md docs
git commit -m "docs: RFM page, rules table and RPCs" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Hand over to the user**

Report: what was built, the timings from Task 2 Step 3 and Step 6, the test results, and what is not verified (the page against real data after login). Then ask, one question at a time and only when the previous one is answered:
1. push `feat/rfm-page` and open a PR into `main` (use `GH_TOKEN=$(gh auth token --user DevTeamMPD)`; plain `git push` hangs on the credential manager),
2. merge after the user has looked at the Preview deployment.

The migration must be applied (Task 2 Step 4) before the PR is merged: without it the page shows the map with "โหลดจำนวนลูกค้าต่อกลุ่มไม่สำเร็จ" and the config falls back to the built-in rules.

---

## Self-review notes

- Spec coverage: §3 → Tasks 1–3; §4.1, 4.2 → Task 2; §4.3 `config_get` / `rfm_map` → Tasks 1–2, 5; §4.5 (this plan's part) → Task 1; §5.1 `/rfm` → Task 7; §5.2 → Tasks 8–9; §5.3 → Tasks 4, 9; §5.5 bullets 1–2 → Tasks 3, 6; §5.6 (map) → Task 9; §7 → Tasks 3–7, 10. Left for Plan 2: §4.3 preview/save, §5.1 `/rfm/settings`, §5.4, §5.6 settings. Left for Plan 3: §4.4, §5.5 bullets 3–4.
- Names used across tasks: `RfmSeg` (`fMin`, `fMax`, `rMin`, `rMax`, `fallback`, `noOutreach`, `templateBebeplay`, `templateHosttail`), `DEFAULT_RFM_CONFIG`, `rfmSegment(orders, days, config?)`, `rfmRule(key, config?)`, `rfmRuleText(seg)`, `rfmSlug(key)`, `rfmGrid(config)`, `RfmMapRow`, `mapRfmConfig`, `getRfmConfig`, `getRfmMap(scope, brand, asUser?)`, `state.rfmConfig`, `BaseScopeKey` with `team`, `BasePage` prop `fixedRfm`.
