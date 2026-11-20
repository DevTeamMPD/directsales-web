-- Preview and enqueue a batch (spec §4.3). dsales_outreach_plan is the shared, read-only step:
-- dedupe phones, check ownership, pick the room, render the template. Enqueue then claims pool
-- customers (same rules as dsales_claim_customer) and writes the batch + queue rows.
-- "ห้ามโทร" (no_call) leads the rep already owns stay sendable (the flag only blocks phone calls);
-- an unowned no_call lead cannot be claimed, so enqueue skips it with reason no_call.

create or replace function dsales.dsales_outreach_plan(p_phones text[], p_template uuid, p_me uuid)
returns table (phone text, name text, lead_id uuid, ms_id bigint, page text, provider text, chat_name text, message text, skip text)
language plpgsql stable security definer set search_path = dsales, public as $$
declare
  t dsales.dsales_templates; v_max int := coalesce((dsales.dsales_setting('outreach_max_batch') #>> '{}')::int, 50);
  ph text; v_skip text; v_msg text; v_product text;
  v_in_base boolean; v_base_name text; v_base_owner uuid;
  v_lead uuid; v_lead_owner uuid; v_lead_name text;
  v_ms bigint; v_page text; v_prov text; v_chat text;
begin
  select * into t from dsales.dsales_templates where id = p_template and active;
  if not found then raise exception 'template_not_found'; end if;
  if (select count(distinct btrim(x)) from unnest(coalesce(p_phones, '{}')) x where nullif(btrim(x), '') is not null) > v_max then
    raise exception 'batch_too_large';
  end if;

  for ph in select distinct btrim(x) from unnest(coalesce(p_phones, '{}')) x where nullif(btrim(x), '') is not null loop
    v_skip := null; v_msg := null; v_ms := null; v_page := null; v_prov := null; v_chat := null;
    v_base_name := null; v_base_owner := null; v_lead := null; v_lead_owner := null; v_lead_name := null;
    select c.name, c.owner_id into v_base_name, v_base_owner from dsales.dsales_customer_base c where c.phone_normalized = ph;
    v_in_base := found;
    select x.id, x.owner_id, x.name into v_lead, v_lead_owner, v_lead_name from dsales.dsales_leads x where x.phone_normalized = ph;
    if not v_in_base and v_lead is null then v_skip := 'customer_not_found';
    elsif v_base_owner is not null and v_base_owner <> p_me then v_skip := 'taken';
    elsif v_lead_owner is not null and v_lead_owner <> p_me then v_skip := 'taken';
    elsif exists (select 1 from dsales.dsales_outreach_queue q where q.phone_normalized = ph and q.status in ('queued', 'sending')) then
      v_skip := 'already_queued';
    else
      select r.ms_id, r.page, r.provider, r.chat_name, r.skip into v_ms, v_page, v_prov, v_chat, v_skip
      from dsales.dsales_outreach_room(ph, t.brand) r;
    end if;
    if v_skip is null then
      v_product := '';
      if position('{สินค้าล่าสุด}' in t.body) > 0 then
        select coalesce(p.product_name, '') into v_product from dsales.dsales_customer_purchases(ph) p order by p.txn_date desc nulls last limit 1;
      end if;
      v_msg := replace(replace(replace(t.body,
                 '{ชื่อ}', coalesce(nullif(btrim(coalesce(v_lead_name, v_base_name)), ''), '')),
                 '{ร้าน}', coalesce(v_page, '')),
                 '{สินค้าล่าสุด}', coalesce(v_product, ''));
    end if;
    return query select ph, coalesce(v_lead_name, v_base_name), v_lead, v_ms, v_page, v_prov, v_chat, v_msg, v_skip;
  end loop;
end $$;
revoke all on function dsales.dsales_outreach_plan(text[], uuid, uuid) from public, anon, authenticated;

create or replace function dsales.dsales_outreach_preview(p_phones text[], p_template uuid) returns jsonb
language plpgsql stable security definer set search_path = dsales, public as $$
declare me uuid := dsales.dsales_uid();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('phone', x.phone, 'name', x.name, 'ms_id', x.ms_id, 'page', x.page, 'provider', x.provider,
                                        'chat_name', x.chat_name, 'message', x.message, 'skip', x.skip) order by x.skip nulls first, x.phone)
    from dsales.dsales_outreach_plan(p_phones, p_template, me) x
  ), '[]'::jsonb);
end $$;

create or replace function dsales.dsales_enqueue_outreach(p_phones text[], p_template uuid) returns jsonb
language plpgsql security definer set search_path = dsales, public as $$
declare
  me uuid := dsales.dsales_uid(); t dsales.dsales_templates; v_batch uuid; x record; v_lead uuid; v_owner uuid;
  v_skipped jsonb := '[]'::jsonb; v_queued int := 0;
begin
  select * into t from dsales.dsales_templates where id = p_template and active;
  if not found then raise exception 'template_not_found'; end if;
  insert into dsales.dsales_outreach_batches (requested_by, template_id, brand) values (me, t.id, t.brand) returning id into v_batch;

  for x in select * from dsales.dsales_outreach_plan(p_phones, p_template, me) loop
    if x.skip is not null then
      v_skipped := v_skipped || jsonb_build_object('phone', x.phone, 'reason', x.skip);
      continue;
    end if;
    v_lead := x.lead_id;
    v_owner := null;
    if v_lead is not null then
      select l.owner_id into v_owner from dsales.dsales_leads l where l.id = v_lead;
    end if;
    if v_lead is null or v_owner is null then
      begin
        v_lead := (dsales.dsales_claim_customer(x.phone, t.brand) ->> 'id')::uuid;
      exception when others then
        v_skipped := v_skipped || jsonb_build_object('phone', x.phone, 'reason', case when sqlerrm in ('taken', 'no_call', 'customer_not_found') then sqlerrm else 'claim_failed' end);
        continue;
      end;
    end if;
    insert into dsales.dsales_outreach_queue (batch_id, lead_id, phone_normalized, ms_id, page, provider, chat_name, message_text, requested_by)
    values (v_batch, v_lead, x.phone, x.ms_id, x.page, x.provider, x.chat_name, x.message, me);
    v_queued := v_queued + 1;
  end loop;

  update dsales.dsales_outreach_batches set total = v_queued, skipped = v_skipped where id = v_batch;
  return jsonb_build_object('batch_id', v_batch, 'queued', v_queued, 'skipped', v_skipped);
end $$;

revoke all on function dsales.dsales_outreach_preview(text[], uuid), dsales.dsales_enqueue_outreach(text[], uuid) from public, anon;
grant execute on function dsales.dsales_outreach_preview(text[], uuid), dsales.dsales_enqueue_outreach(text[], uuid) to authenticated;
