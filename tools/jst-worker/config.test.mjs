// node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadSupabaseConfig, readEnvFile } from './config.mjs';

const dir = () => mkdtempSync(join(tmpdir(), 'jstcfg-'));

test('readEnvFile parses KEY=VALUE lines and strips quotes; a missing file is empty', () => {
  const p = join(dir(), '.env.local');
  writeFileSync(p, 'A=1\n# c\nB="two words"\n\nbad line\nC=\n');
  assert.deepEqual(readEnvFile(p), { A: '1', B: 'two words', C: '' });
  assert.deepEqual(readEnvFile(join(dir(), 'none')), {});
});

test('loadSupabaseConfig: config.json first, then process env, then .env.local', () => {
  const d = dir();
  const configPath = join(d, 'config.json');
  const envPath = join(d, '.env.local');
  writeFileSync(configPath, JSON.stringify({ supabase: { url: 'https://c.supabase.co', email: '' } }));
  writeFileSync(envPath, 'NEXT_PUBLIC_SUPABASE_ANON_KEY=file-key\nDSALES_WORKER_EMAIL=file@x\nDSALES_WORKER_PASSWORD=file-pw\n');
  const got = loadSupabaseConfig({
    configPath,
    envPath,
    env: { DSALES_WORKER_EMAIL: 'env@x', NEXT_PUBLIC_SUPABASE_URL: 'https://env.supabase.co' },
  });
  assert.deepEqual(got, { url: 'https://c.supabase.co', anonKey: 'file-key', email: 'env@x', password: 'file-pw' });
});

test('loadSupabaseConfig: broken config.json throws without quoting its content', () => {
  const d = dir();
  const configPath = join(d, 'config.json');
  writeFileSync(configPath, '{"supabase": {"password": "hunter2-secret" oops}');
  assert.throws(
    () => loadSupabaseConfig({ configPath, envPath: join(d, '.env.local'), env: {} }),
    (e) => /ไม่ใช่ JSON ที่ถูกต้อง/.test(e.message) && !e.message.includes('hunter2') && !e.message.includes('oops'),
  );
});

test('loadSupabaseConfig works without config.json and names what is missing', () => {
  const d = dir();
  assert.throws(
    () => loadSupabaseConfig({ configPath: join(d, 'config.json'), envPath: join(d, '.env.local'), env: { NEXT_PUBLIC_SUPABASE_URL: 'https://e.supabase.co' } }),
    (e) => /supabase\.anonKey, supabase\.email, supabase\.password/.test(e.message) && !e.message.includes('e.supabase.co'),
  );
});
