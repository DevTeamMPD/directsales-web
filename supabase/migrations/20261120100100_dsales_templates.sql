-- Message templates per brand (admin manages, everyone reads active ones)

create or replace function dsales.dsales_template_json(t dsales.dsales_templates) returns jsonb
language sql immutable set search_path = dsales, public as $$
  select jsonb_build_object('id', t.id, 'brand', t.brand, 'name', t.name, 'body', t.body, 'active', t.active, 'updated_at', t.updated_at)
$$;
revoke all on function dsales.dsales_template_json(dsales.dsales_templates) from public, anon, authenticated;

create or replace function dsales.dsales_templates_list(p_brand text default null) returns jsonb
language plpgsql stable security definer set search_path = dsales, public as $$
declare v_admin boolean;
begin
  perform dsales.dsales_uid();
  v_admin := dsales.dsales_is_admin();
  return coalesce((
    select jsonb_agg(dsales.dsales_template_json(t) order by t.brand, t.name)
    from dsales.dsales_templates t
    where (p_brand is null or t.brand = p_brand) and (t.active or v_admin)
  ), '[]'::jsonb);
end $$;

create or replace function dsales.dsales_template_save(p_id uuid, p_brand text, p_name text, p_body text, p_active boolean)
returns jsonb language plpgsql security definer set search_path = dsales, public as $$
declare me uuid := dsales.dsales_uid(); t dsales.dsales_templates;
begin
  if not dsales.dsales_is_admin() then raise exception 'forbidden'; end if;
  if coalesce(p_brand, '') not in ('bebeplay', 'hosttail') or nullif(btrim(coalesce(p_name, '')), '') is null
     or nullif(btrim(coalesce(p_body, '')), '') is null or length(btrim(p_name)) > 100 or length(btrim(p_body)) > 2000 then
    raise exception 'invalid_template';
  end if;
  if p_id is null then
    insert into dsales.dsales_templates (brand, name, body, active, created_by)
    values (p_brand, btrim(p_name), btrim(p_body), coalesce(p_active, true), me) returning * into t;
  else
    update dsales.dsales_templates set brand = p_brand, name = btrim(p_name), body = btrim(p_body),
           active = coalesce(p_active, active), updated_at = now()
    where id = p_id returning * into t;
    if not found then raise exception 'not_found'; end if;
  end if;
  return dsales.dsales_template_json(t);
end $$;

revoke all on function dsales.dsales_templates_list(text), dsales.dsales_template_save(uuid, text, text, text, boolean) from public, anon;
grant execute on function dsales.dsales_templates_list(text), dsales.dsales_template_save(uuid, text, text, text, boolean) to authenticated;
