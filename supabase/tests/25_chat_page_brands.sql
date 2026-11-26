begin;
-- แบรนด์ของลูกค้า = แบรนด์จาก CDP (identity_brands) รวมกับแบรนด์ของเพจที่ห้องแชตของลูกค้าอยู่ (page_brand_map)
-- (20261126100000) เดิมใช้ identity_brands อย่างเดียว ซึ่งหยุดอัปเดตตั้งแต่ 2026-06-21 ลูกค้า 68% จึงไม่มีแบรนด์
-- หนัก: เรียก dsales_refresh_customer_base() 1 ครั้ง (เหมือน 04/04b) รันเฉพาะเมื่อแก้ฐานลูกค้า. Rolled back.
create temp table _r (k text, v text) on commit drop;
do $$
declare
  v_bebe_page text := dsales.dsales_setting('page_brand_map') -> 'bebeplay' ->> 0;
  v_host_page text := dsales.dsales_setting('page_brand_map') -> 'hosttail' ->> 0;
  v_iim_room bigint;
  p_none text[];      -- เบอร์ที่ไม่มีแบรนด์และไม่มีห้องแชต (ใช้ 3 เบอร์)
  p_host text;        -- เบอร์ที่ CDP ให้แบรนด์ hosttail อย่างเดียว ไม่มีห้องแชต
  p_keep text;        -- เบอร์ที่มีแบรนด์จาก CDP และไม่มีห้องแชต (ต้องไม่เปลี่ยน)
  v_keep text[];
  v_got text[];
  v_bad bigint;
  v_before bigint;
  v_after bigint;
begin
  assert v_bebe_page is not null and v_host_page is not null, 'page_brand_map must list pages for bebeplay and hosttail';

  select array_agg(x.phone_normalized) into p_none from (
    select b.phone_normalized from dsales.dsales_customer_base b
    where b.brands = '{}' and b.identity_id is not null
      and not exists (select 1 from dsales.dsales_chat_links l where l.phone_normalized = b.phone_normalized)
    order by b.phone_normalized limit 3) x;
  assert cardinality(p_none) = 3, 'need 3 customers without brand and without chat room';

  select b.phone_normalized into p_host from dsales.dsales_customer_base b
  where b.brands = '{hosttail}'
    and not exists (select 1 from dsales.dsales_chat_links l where l.phone_normalized = b.phone_normalized)
  order by b.phone_normalized limit 1;
  assert p_host is not null, 'need a hosttail-only customer without chat room';

  select b.phone_normalized, b.brands into p_keep, v_keep from dsales.dsales_customer_base b
  where cardinality(b.brands) > 0 and b.phone_normalized <> p_host
    and not exists (select 1 from dsales.dsales_chat_links l where l.phone_normalized = b.phone_normalized)
  order by b.phone_normalized limit 1;
  assert p_keep is not null, 'need a customer with a CDP brand and no chat room';

  -- ห้องจริงใน iim_sessions บนเพจของ bebeplay (ไม่มีแถวใน dsales_jst_rooms ที่ทับชื่อเพจ)
  select s.ms_id into v_iim_room from public.iim_sessions s
  where s.page = v_bebe_page and not exists (select 1 from dsales.dsales_jst_rooms j where j.ms_id = s.ms_id)
  order by s.ms_id limit 1;
  assert v_iim_room is not null, format('need an iim_sessions room on page %s', v_bebe_page);

  -- ห้องที่มีเฉพาะใน dsales_jst_rooms (หาเจอจาก buyer ID แต่ไม่มีใน iim_sessions)
  insert into dsales.dsales_jst_rooms (ms_id, outer_user_id, provider, page, name, expired, last_message_time, fetched_at) values
    (-9001, 't25-a', 'Line', v_bebe_page, 'T25 A', false, now(), now()),
    (-9002, 't25-b', 'Line', v_host_page, 'T25 B', true,  now(), now()),
    (-9003, 't25-c', 'Line', 'T25 เพจที่ไม่ได้ผูกแบรนด์', 'T25 C', false, now(), now());

  insert into dsales.dsales_chat_links (ms_id, phone_normalized, method, evidence, confidence) values
    (v_iim_room, p_none[1], 'manual', 't25', 'high'),   -- ไม่มีแบรนด์ + ห้อง iim บนเพจ bebeplay
    (-9002,      p_none[2], 'manual', 't25', 'high'),   -- ไม่มีแบรนด์ + ห้อง jst-only บนเพจ hosttail (หมดอายุแล้วก็ยังนับ)
    (-9003,      p_none[3], 'manual', 't25', 'high'),   -- ไม่มีแบรนด์ + ห้องบนเพจที่ไม่ได้ผูกแบรนด์
    (-9001,      p_host,    'manual', 't25', 'high'),   -- CDP = hosttail + ห้องบนเพจ bebeplay
    (-9002,      p_host,    'manual', 't25', 'high');   -- แบรนด์ซ้ำกับ CDP ต้องไม่ซ้ำในผลลัพธ์

  select count(*) into v_before from dsales.dsales_customer_base where eligible and brands = '{}';
  perform dsales.dsales_refresh_customer_base();

  select brands into v_got from dsales.dsales_customer_base where phone_normalized = p_none[1];
  assert v_got = '{bebeplay}', format('iim room on a bebeplay page: expected {bebeplay}, got %s', v_got);

  select brands into v_got from dsales.dsales_customer_base where phone_normalized = p_none[2];
  assert v_got = '{hosttail}', format('jst-only room on a hosttail page: expected {hosttail}, got %s', v_got);

  select brands into v_got from dsales.dsales_customer_base where phone_normalized = p_none[3];
  assert v_got = '{}', format('room on an unmapped page gives no brand, got %s', v_got);

  select brands into v_got from dsales.dsales_customer_base where phone_normalized = p_host;
  assert v_got = '{bebeplay,hosttail}', format('CDP brand + chat page brand: expected {bebeplay,hosttail}, got %s', v_got);

  select brands into v_got from dsales.dsales_customer_base where phone_normalized = p_keep;
  assert v_got = v_keep, format('customer without chat room keeps CDP brands %s, got %s', v_keep, v_got);

  -- ทุกแถว: แบรนด์เรียงตามตัวอักษรและไม่ซ้ำ (ค่าต้องนิ่ง ไม่งั้น refresh แบบเขียนเฉพาะแถวที่เปลี่ยนจะเขียนซ้ำทุกรอบ)
  select count(*) into v_bad from dsales.dsales_customer_base b
  where b.brands is distinct from coalesce((select array_agg(distinct c order by c) from unnest(b.brands) c), '{}');
  assert v_bad = 0, format('%s rows have unsorted or duplicate brands', v_bad);

  -- แบรนด์จาก CDP ยังอยู่ครบทุกแถว
  select count(*) into v_bad
  from dsales.dsales_customer_base b
  join (select ib.identity_id, array_agg(distinct br.code) as codes
        from public.identity_brands ib join public.brands br on br.id = ib.brand_id group by 1) c on c.identity_id = b.identity_id
  where not (b.brands @> c.codes);
  assert v_bad = 0, format('%s rows lost a CDP brand', v_bad);

  select count(*) into v_after from dsales.dsales_customer_base where eligible and brands = '{}';
  insert into _r values ('eligible_no_brand_before', v_before::text), ('eligible_no_brand_after', v_after::text);
end $$;
select string_agg(k || '=' || v, ', ') || ' | OK 25_chat_page_brands' from _r;
rollback;
