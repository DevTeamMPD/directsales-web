#!/usr/bin/env node
// แปลง snapshot function public.dsales_* (จาก tools/db/dump-dsales-functions.sql) เป็น migration ย้ายเข้า schema dsales
// ใช้: node tools/db/rewrite-dsales.mjs <baseline.sql> <out.sql>
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const SKIP = new Set(['dsales_customer_pool', 'dsales_customer_pool_v2']); // ไม่มีโค้ดเรียกแล้ว
export const TABLES = ['dsales_members', 'dsales_campaigns', 'dsales_leads', 'dsales_interactions'];

export function splitFunctions(sql) {
  const marks = [...sql.matchAll(/^-- FUNCTION: (\w+)\((.*)\)$/gm)];
  return marks.map((m, i) => ({
    name: m[1],
    args: m[2],
    def: sql.slice(m.index + m[0].length, i + 1 < marks.length ? marks[i + 1].index : sql.length).trim(),
  }));
}

export function rewriteDef(def) {
  return def
    .replace(/\bpublic\.(dsales_\w+)/g, 'dsales.$1')
    .replace(/SET search_path TO 'public'/g, "SET search_path TO 'dsales', 'public'");
}

export function buildMigration(baseline) {
  const fns = splitFunctions(baseline);
  const keep = fns.filter(f => !SKIP.has(f.name));
  const drop = fns.filter(f => SKIP.has(f.name));
  return [
    '-- สร้างโดย tools/db/rewrite-dsales.mjs จาก 20261117090000_baseline_public_dsales_functions.sql (ห้ามแก้มือ ให้แก้สคริปต์แล้วสร้างใหม่)',
    'create schema if not exists dsales;',
    'grant usage on schema dsales to anon, authenticated, service_role;',
    '',
    ...drop.map(f => `drop function if exists public.${f.name}(${f.args});`),
    '',
    ...TABLES.map(t => `alter table public.${t} set schema dsales;`),
    '',
    'set local search_path = dsales, public;',
    ...keep.map(f => `alter function public.${f.name}(${f.args}) set schema dsales;`),
    '',
    ...keep.map(f => rewriteDef(f.def) + '\n'),
  ].join('\n') + '\n';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , input, output] = process.argv;
  if (!input || !output) { console.error('usage: node tools/db/rewrite-dsales.mjs <baseline.sql> <out.sql>'); process.exit(2); }
  writeFileSync(output, buildMigration(readFileSync(input, 'utf8')));
  console.log(`wrote ${output}`);
}
