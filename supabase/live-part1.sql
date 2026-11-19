-- MPD Direct Sale (ข้อมูลจริง) ส่วนที่ 1: คอลัมน์เพิ่ม + สิทธิ์ที่เข้มขึ้น + ฟังก์ชันอ่านข้อมูล
-- วางทั้งไฟล์ใน Supabase Dashboard > SQL Editor แล้วกด Run (ตาราง dsales_* ยังว่าง ไม่มีข้อมูลหาย)

alter table public.dsales_campaigns
  add column if not exists criteria jsonb not null default '[]'::jsonb,
  add column if not exists max_per_rep integer;

alter table public.dsales_leads
  add column if not exists identity_id uuid,
  add column if not exists chat_name text,
  add column if not exists channels jsonb not null default '[]'::jsonb,
  add column if not exists claimed_by uuid references auth.users(id) on delete set null,
  add column if not exists claimed_at timestamptz,
  add column if not exists closed_at date,
  add column if not exists no_call boolean not null default false,
  add column if not exists no_call_by uuid references auth.users(id) on delete set null,
  add column if not exists no_call_at date,
  add column if not exists released_by uuid[] not null default '{}',
  add column if not exists auto_skip boolean not null default false;
create unique index if not exists dsales_leads_phone_uq on public.dsales_leads (phone_normalized);
create index if not exists dsales_leads_identity_idx on public.dsales_leads (identity_id);
alter table public.dsales_interactions add column if not exists due date;

-- สิทธิ์: เซลล์เห็นเฉพาะของตัวเอง เขียนผ่านฟังก์ชันเท่านั้น
drop policy if exists dsales_leads_select on public.dsales_leads;
drop policy if exists dsales_leads_insert on public.dsales_leads;
drop policy if exists dsales_leads_update on public.dsales_leads;
drop policy if exists dsales_leads_delete on public.dsales_leads;
create policy dsales_leads_select on public.dsales_leads for select to authenticated
  using (public.dsales_is_admin() or owner_id = (select auth.uid()));
create policy dsales_leads_admin_write on public.dsales_leads for all to authenticated
  using (public.dsales_is_admin()) with check (public.dsales_is_admin());

drop policy if exists dsales_interactions_select on public.dsales_interactions;
drop policy if exists dsales_interactions_insert on public.dsales_interactions;
drop policy if exists dsales_interactions_delete on public.dsales_interactions;
create policy dsales_interactions_select on public.dsales_interactions for select to authenticated
  using (public.dsales_is_admin() or exists (select 1 from public.dsales_leads l where l.id = lead_id and l.owner_id = (select auth.uid())));
create policy dsales_interactions_admin_delete on public.dsales_interactions for delete to authenticated using (public.dsales_is_admin());

drop policy if exists dsales_members_select on public.dsales_members;
create policy dsales_members_select on public.dsales_members for select to authenticated
  using (public.dsales_is_admin() or user_id = (select auth.uid()));
revoke insert, update on public.dsales_interactions from authenticated;

-- ตัวช่วย
create or replace function public.dsales_valid_phone(p text) returns boolean
language sql immutable as $$ select btrim(coalesce(p, '')) ~ '^[0-9]{9,10}$' and btrim(coalesce(p, '')) !~ '^(.)\1+$' $$;

create or replace function public.dsales_uid() returns uuid
language plpgsql stable as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  return u;
end $$;

create or replace function public.dsales_norm_platform(p_platform text, p_shop text) returns text
language sql stable set search_path = public as $$
  select coalesce((select s.platform from cdp.shops s where s.shop = p_shop),
    case lower(btrim(coalesce(p_platform, '')))
      when 'shopee' then 'shopee' when 'lazada' then 'lazada' when 'tiktok' then 'tiktok' when 'line' then 'line'
      when 'facebook' then 'facebook' when 'instagram' then 'instagram'
      when 'shopify' then 'website' when 'minishop' then 'website' when 'shopss' then 'website' when 'sapo' then 'website'
      else 'other' end) $$;

create or replace function public.dsales_lead_json(l public.dsales_leads) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', l.id, 'name', l.name, 'phone', l.phone, 'address', l.address, 'shop', l.shop, 'chatName', l.chat_name, 'channels', l.channels,
    'brand', l.brand, 'source', l.source, 'campaignId', l.campaign_id, 'owner', l.owner_id, 'status', l.status, 'callback', l.callback_date,
    'interest', coalesce(l.interest, ''), 'closedBills', to_jsonb(l.closed_bills), 'closedAmount', l.closed_amount, 'closedAt', l.closed_at,
    'claimedBy', l.claimed_by, 'claimedAt', l.claimed_at, 'noCall', l.no_call, 'noCallBy', l.no_call_by, 'noCallAt', l.no_call_at,
    'releasedBy', to_jsonb(l.released_by), 'autoSkip', l.auto_skip, 'identityId', l.identity_id,
    'bills', coalesce(pl.bills, '[]'::jsonb), 'total', coalesce(pl.total, 0), 'lastBuy', pl.last_buy, 'orders', coalesce(pl.orders, 0),
    'interactions', coalesce(ix.items, '[]'::jsonb))
  from (select 1) x
  left join lateral (
    select to_jsonb(coalesce((array_agg(distinct nullif(btrim(p.bill_no), '') order by nullif(btrim(p.bill_no), '') desc))[1:6], '{}'::text[])) as bills,
           sum(coalesce(p.amount, p.estimated_amount)) as total, max(p.txn_date) as last_buy,
           count(distinct coalesce(nullif(btrim(p.bill_no), ''), p.order_no)) as orders
    from public.lendi_purchase_lines p where p.phone = l.phone_normalized) pl on true
  left join lateral (
    select jsonb_agg(jsonb_build_object('id', i.id, 'type', i.type, 'date', i.created_at, 'rep', i.rep_id, 'result', i.result, 'note', i.note, 'due', i.due, 'bills', to_jsonb(i.bills)) order by i.created_at) as items
    from (select * from public.dsales_interactions where lead_id = l.id order by created_at desc limit 30) i) ix on true
$$;
revoke all on function public.dsales_lead_json(public.dsales_leads) from public, anon, authenticated;

create or replace function public.dsales_register() returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.dsales_uid();
begin
  insert into public.dsales_members (user_id, role, display_name)
  select u.id, 'sales', coalesce(nullif(btrim(p.full_name), ''), split_part(u.email::text, '@', 1))
  from auth.users u left join public.profiles p on p.id = u.id where u.id = me
  on conflict (user_id) do nothing;
end $$;
revoke all on function public.dsales_register() from public, anon;
grant execute on function public.dsales_register() to authenticated;

create or replace function public.dsales_team() returns table (user_id uuid, display_name text, role text, active boolean, email text)
language sql stable security definer set search_path = public as $$
  select m.user_id, coalesce(nullif(btrim(m.display_name), ''), nullif(btrim(p.full_name), ''), split_part(u.email::text, '@', 1)), m.role, m.active, u.email::text
  from public.dsales_members m join auth.users u on u.id = m.user_id left join public.profiles p on p.id = m.user_id
  where public.dsales_uid() is not null and (public.dsales_is_admin() or m.user_id = auth.uid())
  order by m.role, 2 $$;
revoke all on function public.dsales_team() from public, anon;
grant execute on function public.dsales_team() to authenticated;

create or replace function public.dsales_my_leads(p_limit integer default 500, p_offset integer default 0) returns setof jsonb
language sql stable security definer set search_path = public as $$
  select public.dsales_lead_json(l)
  from public.dsales_leads l
  where public.dsales_uid() is not null and (
    public.dsales_is_admin() or l.owner_id = auth.uid()
    or (l.owner_id is null and not l.no_call and l.campaign_id is not null and not (auth.uid() = any (l.released_by))))
  order by l.updated_at desc, l.id
  limit least(greatest(coalesce(p_limit, 500), 1), 1000) offset greatest(coalesce(p_offset, 0), 0) $$;
revoke all on function public.dsales_my_leads(integer, integer) from public, anon;
grant execute on function public.dsales_my_leads(integer, integer) to authenticated;
