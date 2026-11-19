begin;
-- dsales_set_member_tags / dsales_set_member_active update ownership in place (no full refresh; API role has an 8s timeout)
do $$
declare
  v_admin uuid; v_tag text; v_n bigint; v_wrong bigint; v_t0 timestamptz; v_secs numeric; v_sales uuid;
begin
  select user_id into v_admin from dsales.dsales_members where role = 'admin' and active order by created_at limit 1;
  assert v_admin is not null, 'need an active admin';

  select owner_tag into v_tag from dsales.dsales_customer_base
  where owner_tag ilike 'admin\_%' group by owner_tag order by count(*) desc limit 1;
  assert v_tag is not null, 'need at least one Admin_* owner_tag in customer base';
  select count(*) into v_n from dsales.dsales_customer_base where lower(owner_tag) = lower(v_tag);

  -- test fixture (rolled back): no member holds any tag, no row has an owner
  update dsales.dsales_members set jst_tags = '{}';
  update dsales.dsales_customer_base set owner_id = null where owner_id is not null;

  assert position('dsales_refresh_customer_base' in pg_get_functiondef('dsales.dsales_set_member_tags(uuid,text[])'::regprocedure)) = 0,
         'set_member_tags must not call dsales_refresh_customer_base';

  set local statement_timeout = '8s';
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  v_t0 := clock_timestamp();
  perform dsales.dsales_set_member_tags(v_admin, array[v_tag]);
  v_secs := extract(epoch from clock_timestamp() - v_t0);
  reset role;
  raise notice 'assign % (% rows) took % s', v_tag, v_n, round(v_secs, 3);
  assert v_secs < 2, format('set_member_tags too slow: %s s', v_secs);

  select count(*) into v_wrong from dsales.dsales_customer_base
    where lower(owner_tag) = lower(v_tag) and owner_id is distinct from v_admin;
  assert v_wrong = 0, format('%s rows with tag %s not owned by admin', v_wrong, v_tag);
  select count(*) into v_wrong from dsales.dsales_customer_base
    where owner_id = v_admin and lower(owner_tag) is distinct from lower(v_tag);
  assert v_wrong = 0, format('%s rows owned by admin without the tag', v_wrong);

  -- set_member_active: deactivating a member drops ownership immediately, reactivating restores it
  select user_id into v_sales from dsales.dsales_members where user_id <> v_admin limit 1;
  if v_sales is not null then
    update dsales.dsales_members set jst_tags = '{}' where user_id = v_admin;
    update dsales.dsales_members set jst_tags = array[v_tag], active = false where user_id = v_sales;
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    perform dsales.dsales_set_member_active(v_sales, true);
    reset role;
    select count(*) into v_wrong from dsales.dsales_customer_base
      where lower(owner_tag) = lower(v_tag) and owner_id is distinct from v_sales;
    assert v_wrong = 0, 'reactivated member must own the tag rows';
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    perform dsales.dsales_set_member_active(v_sales, false);
    reset role;
    select count(*) into v_wrong from dsales.dsales_customer_base where owner_id = v_sales;
    assert v_wrong = 0, 'deactivated member must own no rows';
    update dsales.dsales_members set jst_tags = '{}' where user_id = v_sales;
  end if;

  -- assign then clear -> owner_id null
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform dsales.dsales_set_member_tags(v_admin, array[v_tag]);
  v_t0 := clock_timestamp();
  perform dsales.dsales_set_member_tags(v_admin, '{}');
  v_secs := extract(epoch from clock_timestamp() - v_t0);
  reset role;
  raise notice 'clear took % s', round(v_secs, 3);
  assert v_secs < 2, 'clear too slow';
  select count(*) into v_wrong from dsales.dsales_customer_base
    where lower(owner_tag) = lower(v_tag) and owner_id is not null;
  assert v_wrong = 0, 'cleared tag rows must have null owner_id';
  raise notice 'OK 07_member_tags_fast';
end $$;
rollback;
