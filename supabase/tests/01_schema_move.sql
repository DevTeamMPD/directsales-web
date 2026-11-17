begin;
do $$
declare v_user uuid; v_me record;
begin
  assert to_regclass('dsales.dsales_leads') is not null, 'dsales.dsales_leads should exist';
  assert to_regclass('dsales.dsales_members') is not null, 'dsales.dsales_members should exist';
  assert to_regclass('dsales.dsales_campaigns') is not null, 'dsales.dsales_campaigns should exist';
  assert to_regclass('dsales.dsales_interactions') is not null, 'dsales.dsales_interactions should exist';
  assert to_regclass('public.dsales_leads') is null, 'public.dsales_leads should be gone';
  assert not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                     where n.nspname = 'public' and p.proname like 'dsales\_%'), 'no dsales function left in public';
  assert (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'dsales' and p.proname like 'dsales\_%') >= 21, 'expected at least the 21 moved functions in dsales';
  assert to_regprocedure('dsales.dsales_customer_pool(text, integer, integer)') is null, 'unused dsales_customer_pool must be dropped';
  assert not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                     where n.nspname = 'dsales' and pg_get_functiondef(p.oid) ~ 'public\.dsales_'),
         'no function body may still reference public.dsales_';

  select user_id into v_user from dsales.dsales_members order by created_at limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  select * into v_me from dsales.dsales_me();
  assert v_me.user_id = v_user, 'dsales_me() should work after the move';
  perform dsales.dsales_team();
  perform dsales.dsales_my_leads(10, 0);
  perform dsales.dsales_customer_pool_v4(null, 1, 0, null, null, null);
end $$;
rollback;
