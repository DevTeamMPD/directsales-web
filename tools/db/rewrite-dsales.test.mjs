import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitFunctions, rewriteDef, buildMigration } from './rewrite-dsales.mjs';

const BASELINE = `-- baseline
-- FUNCTION: dsales_is_admin()
CREATE OR REPLACE FUNCTION public.dsales_is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.dsales_members m where m.user_id = auth.uid());
$function$
;
-- FUNCTION: dsales_customer_pool(p_search text, p_limit integer, p_offset integer)
CREATE OR REPLACE FUNCTION public.dsales_customer_pool(p_search text, p_limit integer, p_offset integer)
 RETURNS void LANGUAGE sql AS $function$ select $function$
;
-- FUNCTION: dsales_lead_json(l dsales_leads)
CREATE OR REPLACE FUNCTION public.dsales_lead_json(l dsales_leads)
 RETURNS jsonb LANGUAGE sql SET search_path TO 'public'
AS $function$ select to_jsonb(l) || jsonb_build_object('x', (select count(*) from public.lds_customers)) $function$
;
`;

test('splitFunctions reads name, args and body of each function', () => {
  const fns = splitFunctions(BASELINE);
  assert.deepEqual(fns.map(f => f.name), ['dsales_is_admin', 'dsales_customer_pool', 'dsales_lead_json']);
  assert.equal(fns[1].args, 'p_search text, p_limit integer, p_offset integer');
  assert.equal(fns[2].args, 'l dsales_leads');
  assert.ok(fns[0].def.startsWith('CREATE OR REPLACE FUNCTION public.dsales_is_admin()'));
  assert.ok(fns[0].def.endsWith(';'));
});

test('rewriteDef moves dsales references and search_path but keeps other public tables', () => {
  const out = rewriteDef(splitFunctions(BASELINE)[2].def);
  assert.match(out, /CREATE OR REPLACE FUNCTION dsales\.dsales_lead_json\(l dsales_leads\)/);
  assert.match(out, /SET search_path TO 'dsales', 'public'/);
  assert.match(out, /public\.lds_customers/);
  assert.doesNotMatch(out, /public\.dsales_/);
});

test('buildMigration drops unused pool functions, moves tables and functions, then recreates bodies', () => {
  const sql = buildMigration(BASELINE);
  assert.match(sql, /create schema if not exists dsales;/);
  assert.match(sql, /drop function if exists public\.dsales_customer_pool\(p_search text, p_limit integer, p_offset integer\);/);
  for (const t of ['dsales_members', 'dsales_campaigns', 'dsales_leads', 'dsales_interactions']) {
    assert.match(sql, new RegExp(`alter table public\.${t} set schema dsales;`));
  }
  assert.match(sql, /set local search_path = dsales, public;/);
  assert.match(sql, /alter function public\.dsales_lead_json\(l dsales_leads\) set schema dsales;/);
  assert.doesNotMatch(sql, /alter function public\.dsales_customer_pool\(/);
  assert.doesNotMatch(sql, /FUNCTION dsales\.dsales_customer_pool\(/);
  assert.ok(sql.indexOf('set local search_path') < sql.indexOf('alter function'));
  assert.ok(sql.lastIndexOf('alter function') < sql.indexOf('CREATE OR REPLACE FUNCTION dsales.dsales_is_admin'));
});

test('buildMigration normalizes CRLF input to LF output', () => {
  const sql = buildMigration(BASELINE.replace(/\n/g, '\r\n'));
  assert.ok(!sql.includes('\r'));
  assert.match(sql, /alter function public\.dsales_lead_json\(l dsales_leads\) set schema dsales;/);
});
