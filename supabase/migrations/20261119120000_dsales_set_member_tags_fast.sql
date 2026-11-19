-- Saving member JST tags used to call dsales_refresh_customer_base() (~8.6 s avg, 17 s max), which exceeds the
-- 8 s statement_timeout of the `authenticated` API role and rolled the save back. owner_tag is already computed
-- on dsales_customer_base, so only owner_id needs re-deriving: same tagmap rule as the refresh (active members'
-- jst_tags, case-insensitive, lowest user_id wins on duplicates), applied in place.
-- Same treatment for dsales_set_member_active: a deactivated member's tags no longer map, so ownership is dropped
-- (and restored on reactivation) immediately instead of waiting for the next scheduled refresh.

create or replace function dsales.dsales_set_member_tags(p_user uuid, p_tags text[])
returns text[]
language plpgsql
security definer
set search_path = dsales, public
as $function$
declare
  v_tags text[] := (select coalesce(array_agg(distinct btrim(t) order by btrim(t)), '{}')
                    from unnest(coalesce(p_tags, '{}')) as t where nullif(btrim(t), '') is not null);
  v_conflict text;
begin
  perform dsales.dsales_uid();
  if not dsales.dsales_is_admin() then raise exception 'forbidden'; end if;
  if not exists (select 1 from dsales.dsales_members where user_id = p_user) then raise exception 'member_not_found'; end if;
  select t into v_conflict
  from dsales.dsales_members m cross join unnest(m.jst_tags) as t
  where m.user_id <> p_user and lower(t) in (select lower(x) from unnest(v_tags) as x)
  limit 1;
  if v_conflict is not null then raise exception 'tag_taken: %', v_conflict; end if;
  update dsales.dsales_members set jst_tags = v_tags where user_id = p_user;

  with tagmap as (
    select distinct on (lower(t.tag)) lower(t.tag) as tag, m.user_id
    from dsales.dsales_members m cross join unnest(m.jst_tags) as t(tag)
    where m.active
    order by lower(t.tag), m.user_id
  )
  update dsales.dsales_customer_base b
  set owner_id = tm.user_id
  from (select b2.phone_normalized, tm2.user_id
        from dsales.dsales_customer_base b2
        left join tagmap tm2 on tm2.tag = lower(b2.owner_tag)
        where b2.owner_tag is not null or b2.owner_id is not null) tm
  where tm.phone_normalized = b.phone_normalized
    and b.owner_id is distinct from tm.user_id;

  return v_tags;
end $function$;

create or replace function dsales.dsales_set_member_active(p_user uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = dsales, public
as $function$
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

  with tagmap as (
    select distinct on (lower(t.tag)) lower(t.tag) as tag, m.user_id
    from dsales.dsales_members m cross join unnest(m.jst_tags) as t(tag)
    where m.active
    order by lower(t.tag), m.user_id
  )
  update dsales.dsales_customer_base b
  set owner_id = tm.user_id
  from (select b2.phone_normalized, tm2.user_id
        from dsales.dsales_customer_base b2
        left join tagmap tm2 on tm2.tag = lower(b2.owner_tag)
        where b2.owner_tag is not null or b2.owner_id is not null) tm
  where tm.phone_normalized = b.phone_normalized
    and b.owner_id is distinct from tm.user_id;
end $function$;
