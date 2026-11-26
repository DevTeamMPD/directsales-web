begin;
-- tick kick: fires only when enabled and both Vault secrets exist; posts to the tick route with
-- the bearer secret; nobody but cron (postgres) may call it; the cron job runs every minute
do $$
declare v_id bigint; v_ok boolean; v_n int;
begin
  delete from vault.secrets where name in ('dsales_app_url', 'dsales_cron_secret');
  insert into dsales.dsales_settings (key, value) values ('worker_tick_enabled', 'true'::jsonb)
    on conflict (key) do update set value = excluded.value;
  assert dsales.dsales_tick_kick() is null, 'no secrets -> no request';
  perform vault.create_secret('https://example.invalid/', 'dsales_app_url');
  perform vault.create_secret('s3cret-27', 'dsales_cron_secret');
  update dsales.dsales_settings set value = 'false'::jsonb where key = 'worker_tick_enabled';
  assert dsales.dsales_tick_kick() is null, 'switch off -> no request';
  update dsales.dsales_settings set value = 'true'::jsonb where key = 'worker_tick_enabled';
  v_id := dsales.dsales_tick_kick();
  assert v_id is not null, 'enabled + secrets -> a request is queued';
  select count(*) into v_n from net.http_request_queue q
   where q.id = v_id and q.url = 'https://example.invalid/api/cron/outreach-tick' and q.headers ->> 'Authorization' = 'Bearer s3cret-27';
  assert v_n = 1, 'the request goes to the tick route with the bearer secret';
  select count(*) into v_n from cron.job where jobname = 'dsales-outreach-tick' and schedule = '* * * * *';
  assert v_n = 1, 'the cron job runs every minute';
  set local role authenticated;
  v_ok := false;
  begin perform dsales.dsales_tick_kick(); exception when insufficient_privilege then v_ok := true; end;
  assert v_ok, 'authenticated cannot call the kick';
  reset role;
  assert not has_function_privilege('anon', 'dsales.dsales_tick_kick()', 'execute'), 'anon cannot call the kick';
  raise notice 'OK 30_tick_kick';
end $$;
rollback;
