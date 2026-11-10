'use strict';
// รัน: node --test tools/jst-helper/jst-helper.test.js   (Node 18+)
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
process.env.JST_HELPER_DRY_RUN = '1'; // ไม่เปิดเบราว์เซอร์/ไม่รันโปรแกรมจริงตอนทดสอบ
const { createServer, sanitize, fill } = require('./jst-helper.js');

const ALLOWED = 'https://directsales-web.vercel.app';
function start(cfg) {
  return new Promise((resolve) => {
    const server = createServer({ port: 0, allowedOrigins: [ALLOWED], mode: 'url', urlTemplate: 'https://jst.example/chat?c={chat}&s={shop}', command: [], maxBodyBytes: 512, ...cfg });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}
function call(port, { method = 'GET', path = '/ping', origin, body, raw }) {
  return new Promise((resolve, reject) => {
    const data = raw ?? (body === undefined ? null : JSON.stringify(body));
    const req = http.request({ host: '127.0.0.1', port, method, path, headers: { ...(origin ? { Origin: origin } : {}), ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}) } }, (res) => {
      let s = ''; res.on('data', (c) => (s += c)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, json: s ? JSON.parse(s) : null }));
    });
    req.on('error', reject); if (data) req.write(data); req.end();
  });
}

test('ping ตอบเฉพาะเว็บที่อนุญาต พร้อมหัว CORS และ Private Network Access', async () => {
  const { server, port } = await start({});
  const ok = await call(port, { origin: ALLOWED });
  assert.equal(ok.status, 200); assert.equal(ok.json.ok, true);
  assert.equal(ok.headers['access-control-allow-origin'], ALLOWED);
  assert.equal(ok.headers['access-control-allow-private-network'], 'true');
  const bad = await call(port, { origin: 'https://evil.example' });
  assert.equal(bad.status, 403); assert.equal(bad.headers['access-control-allow-origin'], undefined);
  const none = await call(port, {}); assert.equal(none.status, 200); // เรียกจากเครื่องตัวเอง (ไม่มี Origin)
  server.close();
});

test('preflight: เว็บที่อนุญาตผ่าน เว็บอื่นถูกปฏิเสธ', async () => {
  const { server, port } = await start({});
  const ok = await call(port, { method: 'OPTIONS', path: '/open', origin: ALLOWED });
  assert.equal(ok.status, 204); assert.match(ok.headers['access-control-allow-methods'], /POST/);
  assert.equal((await call(port, { method: 'OPTIONS', path: '/open', origin: 'https://evil.example' })).status, 403);
  server.close();
});

test('โหมด url: เติมค่าแบบเข้ารหัส และรับเฉพาะ http(s)', async () => {
  const { server, port } = await start({});
  const r = await call(port, { method: 'POST', path: '/open', origin: ALLOWED, body: { chat: 'baby love&x=1 ไทย', shop: 'SH_bebeplay' } });
  assert.equal(r.status, 200); assert.equal(r.json.dryRun, true);
  assert.equal(r.json.url, 'https://jst.example/chat?c=baby%20love%26x%3D1%20%E0%B9%84%E0%B8%97%E0%B8%A2&s=SH_bebeplay');
  server.close();
  const s2 = await start({ urlTemplate: 'file:///etc/passwd?{chat}' });
  const r2 = await call(s2.port, { method: 'POST', path: '/open', origin: ALLOWED, body: { chat: 'x' } });
  assert.equal(r2.status, 500); assert.match(r2.json.error, /http/);
  s2.server.close();
});

test('โหมด command: ค่าจากเว็บเป็นแค่อาร์กิวเมนต์ ไม่ถูกตีความเป็นคำสั่ง', async () => {
  const { server, port } = await start({ mode: 'command', command: ['python3', 'open_jst.py', '{chat}', '{shop}'] });
  const evil = '$(touch /tmp/pwn); rm -rf / ; `id` && echo hi';
  const r = await call(port, { method: 'POST', path: '/open', origin: ALLOWED, body: { chat: evil, shop: 'SH_x' } });
  assert.equal(r.status, 200); assert.equal(r.json.file, 'python3');
  assert.deepEqual(r.json.args, ['open_jst.py', evil, 'SH_x']); // ส่งทั้งก้อนเป็น argv ตัวเดียว
  server.close();
});

test('ตรวจคำขอ: json เสีย / ไม่มีข้อมูล / ใหญ่เกิน / ฟิลด์แปลกถูกตัดทิ้ง', async () => {
  const { server, port } = await start({});
  assert.equal((await call(port, { method: 'POST', path: '/open', origin: ALLOWED, raw: '{oops' })).status, 400);
  assert.equal((await call(port, { method: 'POST', path: '/open', origin: ALLOWED, body: { shop: 'x' } })).status, 400);
  let status; try { status = (await call(port, { method: 'POST', path: '/open', origin: ALLOWED, body: { chat: 'a'.repeat(5000) } })).status; } catch (e) { status = 'closed'; }
  assert.ok(status === 413 || status === 'closed');
  const v = sanitize({ chat: 'x'.repeat(500), evil: '<script>', phone: null, name: 'a\u0000b\nc' });
  assert.equal(v.chat.length, 200); assert.equal(v.evil, undefined); assert.equal(v.phone, ''); assert.equal(v.name, 'a b c');
  server.close();
});

test('ยังไม่ตั้งค่า: บอกให้ตั้งค่า ไม่พัง; เส้นทางอื่น 404', async () => {
  const { server, port } = await start({ urlTemplate: '' });
  const r = await call(port, { method: 'POST', path: '/open', origin: ALLOWED, body: { chat: 'x' } });
  assert.equal(r.status, 500); assert.match(r.json.error, /urlTemplate/);
  assert.equal((await call(port, { path: '/nope', origin: ALLOWED })).status, 404);
  assert.equal(fill('{a}-{b}', { a: '1' }, false), '1-');
  server.close();
});
