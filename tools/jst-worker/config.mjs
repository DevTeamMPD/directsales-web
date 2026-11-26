// อ่านค่าตั้งของ worker: config.json (นอก git) → environment → .env.local ที่รากโปรเจกต์
import { existsSync, readFileSync } from 'node:fs';

/** KEY=VALUE จากไฟล์ env (ไม่มีไฟล์ = {}) */
export function readEnvFile(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

/** ค่าที่ใช้ล็อกอิน Supabase ด้วยบัญชี worker — ไม่ต้องมี config.json (ใช้กับ import-session.mjs --upload) */
export function loadSupabaseConfig({ configPath, envPath, env = process.env }) {
  let c = {};
  if (configPath && existsSync(configPath)) c = JSON.parse(readFileSync(configPath, 'utf8'))?.supabase || {};
  const e = { ...readEnvFile(envPath), ...env };
  const out = {
    url: c.url || e.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: c.anonKey || e.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    email: c.email || e.DSALES_WORKER_EMAIL || '',
    password: c.password || e.DSALES_WORKER_PASSWORD || '',
  };
  const missing = Object.entries(out).filter(([, v]) => !v).map(([k]) => `supabase.${k}`);
  if (missing.length) throw new Error(`ขาดค่า: ${missing.join(', ')} (config.json หรือ .env.local)`);
  return out;
}
