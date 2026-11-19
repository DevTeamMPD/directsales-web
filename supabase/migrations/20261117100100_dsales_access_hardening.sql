-- Task 1b: เสริมความปลอดภัยหลังรีวิว Task 1
-- สมาชิกที่ถูกปิดใช้งานต้องอ่านลีด/แคมเปญผ่าน RLS ตรงไม่ได้, ตาราง dsales_members แก้ผ่าน RPC เท่านั้น,
-- และกันแข่งกันลด/ปิดหัวหน้า (last_admin) ด้วย advisory lock

-- 1) helper: เป็นสมาชิก active หรือไม่ (ไม่ raise; ใช้ใน RLS)
create or replace function dsales.dsales_is_member() returns boolean
language sql stable security definer set search_path = dsales, public as $$
  select exists (select 1 from dsales.dsales_members m where m.user_id = auth.uid() and m.active);
$$;
revoke all on function dsales.dsales_is_member() from public, anon;
grant execute on function dsales.dsales_is_member() to authenticated, service_role;

-- 2) RLS: อ่านตรงได้เฉพาะสมาชิก active
drop policy dsales_leads_select on dsales.dsales_leads;
create policy dsales_leads_select on dsales.dsales_leads for select
  using (dsales.dsales_is_admin() or (owner_id = (select auth.uid()) and dsales.dsales_is_member()));

drop policy dsales_interactions_select on dsales.dsales_interactions;
create policy dsales_interactions_select on dsales.dsales_interactions for select
  using (dsales.dsales_is_admin() or (dsales.dsales_is_member()
         and exists (select 1 from dsales.dsales_leads l where l.id = lead_id and l.owner_id = (select auth.uid()))));

drop policy dsales_campaigns_select on dsales.dsales_campaigns;
create policy dsales_campaigns_select on dsales.dsales_campaigns for select
  using (dsales.dsales_is_member());

-- 3) dsales_members แก้ผ่าน definer RPC เท่านั้น (ตัด TRUNCATE/TRIGGER/REFERENCES ด้วย เพราะ TRUNCATE ข้าม RLS)
revoke insert, update, delete, truncate, trigger, references on dsales.dsales_members from authenticated, anon;

-- 4) กันแข่งกัน: serialize ทุกการเปลี่ยนแปลงสมาชิก/หัวหน้า (เนื้อหาเหมือน Task 1 + advisory lock)
create or replace function dsales.dsales_add_member(p_email text, p_role text default 'sales') returns jsonb
language plpgsql security definer set search_path = dsales, public as $$
declare v_role text := lower(btrim(coalesce(p_role, ''))); v_user uuid; v_email text; v_name text; v_res jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('dsales_admin_guard'));
  perform dsales.dsales_uid();
  if not dsales.dsales_is_admin() then raise exception 'forbidden'; end if;
  if v_role not in ('sales', 'admin') then raise exception 'invalid_role'; end if;
  select u.id, u.email::text, coalesce(nullif(btrim(p.full_name), ''), split_part(u.email::text, '@', 1))
    into v_user, v_email, v_name
  from auth.users u left join public.profiles p on p.id = u.id
  where lower(u.email::text) = lower(btrim(coalesce(p_email, '')))
  limit 1;
  if v_user is null then raise exception 'user_not_found'; end if;
  -- ลดบทบาทหัวหน้าเป็นเซลล์ได้เมื่อยังเหลือหัวหน้า active คนอื่น
  if v_role = 'sales'
     and exists (select 1 from dsales.dsales_members where user_id = v_user and role = 'admin' and active)
     and not exists (select 1 from dsales.dsales_members where role = 'admin' and active and user_id <> v_user) then
    raise exception 'last_admin';
  end if;
  insert into dsales.dsales_members as m (user_id, role, display_name, active)
  values (v_user, v_role, v_name, true)
  on conflict (user_id) do update
    set role = excluded.role, active = true,
        display_name = coalesce(nullif(btrim(m.display_name), ''), excluded.display_name);
  select jsonb_build_object('user_id', m.user_id, 'email', v_email, 'display_name', m.display_name, 'role', m.role, 'active', m.active)
    into v_res
  from dsales.dsales_members m where m.user_id = v_user;
  return v_res;
end $$;

create or replace function dsales.dsales_set_member_active(p_user uuid, p_active boolean) returns void
language plpgsql security definer set search_path = dsales, public as $$
declare me uuid := dsales.dsales_uid();
begin
  perform pg_advisory_xact_lock(hashtext('dsales_admin_guard'));
  if not dsales.dsales_is_admin() then raise exception 'forbidden'; end if;
  if not coalesce(p_active, false)
     and exists (select 1 from dsales.dsales_members where user_id = p_user and role = 'admin' and active)
     and not exists (select 1 from dsales.dsales_members where role = 'admin' and active and user_id <> p_user) then
    raise exception 'last_admin';
  end if;
  if p_user = me and not coalesce(p_active, false) then raise exception 'cannot_deactivate_self'; end if;
  update dsales.dsales_members set active = coalesce(p_active, false) where user_id = p_user;
  if not found then raise exception 'member_not_found'; end if;
end $$;

-- 5) dsales_uid ไม่เปิดให้ anon/public
revoke execute on function dsales.dsales_uid() from anon, public;
grant execute on function dsales.dsales_uid() to authenticated, service_role;
