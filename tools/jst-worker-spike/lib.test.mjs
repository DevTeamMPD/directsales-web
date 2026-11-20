// node --test tools/jst-worker-spike/lib.test.mjs   (ไม่ต้องใช้เบราว์เซอร์)
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { allowedChat, isLoginUrl, loadConfig, parseArgs, redactExchange } from './lib.mjs';

test('parseArgs reads values and flags', () => {
  assert.deepEqual(parseArgs(['--ms', '130427', '--text', 'สวัสดี ค่ะ', '--confirm']), { ms: '130427', text: 'สวัสดี ค่ะ', confirm: true });
  assert.deepEqual(parseArgs(['--headed', '--chat', 'A o m']), { headed: true, chat: 'A o m' });
});

test('loadConfig fills defaults; allowedChat only accepts listed ms_ids', () => {
  const dir = mkdtempSync(join(tmpdir(), 'spike-'));
  const p = join(dir, 'config.json');
  writeFileSync(p, JSON.stringify({ testChats: [{ name: 'ทดสอบ LINE', msId: 111 }, { name: 'ตัวอย่าง', msId: 0 }] }));
  const c = loadConfig(p);
  assert.equal(c.jstUrl, 'https://asia-web.jsterp.com/iim/index');
  assert.equal(c.probeMinutes, 30);
  assert.equal(allowedChat(c, '111').name, 'ทดสอบ LINE');
  assert.equal(allowedChat(c, 111).name, 'ทดสอบ LINE');
  assert.equal(allowedChat(c, '222'), null);
  assert.equal(allowedChat(c, '111 or 1=1'), null);
  assert.equal(allowedChat(c, undefined), null);
  assert.equal(allowedChat(c, '0'), null); // ค่าตัวอย่างใน config.example.json ห้ามผ่าน
  assert.throws(() => loadConfig(join(dir, 'missing.json')), /config\.example\.json/);
});

test('redactExchange keeps the path, payload and response, never headers', () => {
  const r = redactExchange({
    url: 'https://asia-web.jsterp.com/iim/SendMsg?x=1', method: 'POST', postData: '{"ms_id":1,"content":"hi"}', status: 200, body: '{"success":true}',
  });
  assert.deepEqual(r, { path: '/iim/SendMsg', method: 'POST', request: { ms_id: 1, content: 'hi' }, status: 200, response: { success: true } });
  assert.equal(redactExchange({ url: 'https://a/b', method: 'POST', postData: 'a=1', status: 500, body: '' }).request, 'a=1');
});

test('isLoginUrl spots the JST login redirect', () => {
  assert.equal(isLoginUrl('https://asia-web.jsterp.com/Org/Account/Login/index?ReturnUrl=x'), true);
  assert.equal(isLoginUrl('https://asia-web.jsterp.com/iim/index'), false);
});
