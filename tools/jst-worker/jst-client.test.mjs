// node --test   (ไม่มี network — fetch ปลอม)
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CaptchaRequired,
  createJstClient,
  extractPublicKey,
  JstError,
  LoginFailed,
  LoginUnavailable,
  parseSetCookie,
  SessionExpired,
  ShapeError,
} from './jst-client.mjs';
import { memoryStore } from './session-store.mjs';

const BASE = 'https://asia-web.jsterp.com';
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const PUB_B64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
const LOGIN_HTML = `<html><script>
  var vm = new Vue({ data: { accountId: '', publicKey: '${PUB_B64}', isNeedCaptcha: false } });
</script></html>`;

const tmpSession = () => join(mkdtempSync(join(tmpdir(), 'jstc-')), '.session.json');

function res(body, { status = 200, cookies = [], headers = {} } = {}) {
  const h = new Headers(headers);
  for (const c of cookies) h.append('set-cookie', c);
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: h });
}

/** fetch ปลอม: routes = { 'METHOD /path': (req) => Response } · เก็บทุก request ไว้ใน calls */
function fakeFetch(routes) {
  const calls = [];
  const fn = async (url, init = {}) => {
    const u = new URL(url);
    const key = `${init.method || 'GET'} ${u.pathname}`;
    const req = { url, key, method: init.method || 'GET', headers: init.headers || {}, body: init.body ? JSON.parse(init.body) : undefined, redirect: init.redirect };
    calls.push(req);
    const h = routes[key];
    if (!h) throw new Error(`unexpected request ${key}`);
    return h(req, calls);
  };
  fn.calls = calls;
  return fn;
}

const ROOM = { co_id: 9, ms_id: 555, chat_account_id: 77, session_provider: 'Line', outer_account_name: 'Bebeplay OA', name: 'คุณเอ ', is_expired: false, outer_user_id: 'U1' };

test('extractPublicKey reads the key from login HTML', () => {
  assert.equal(extractPublicKey(LOGIN_HTML), PUB_B64);
  assert.equal(extractPublicKey('<html>nothing</html>'), null);
});

test('parseSetCookie handles attributes and deletion', () => {
  assert.deepEqual(parseSetCookie('a=1=2; Path=/; HttpOnly'), { name: 'a', value: '1=2', remove: false });
  assert.equal(parseSetCookie('a=; Max-Age=0').remove, true);
  assert.equal(parseSetCookie('a=x; Expires=Thu, 01 Jan 1970 00:00:00 GMT').remove, true);
  assert.equal(parseSetCookie('garbage'), null);
});

test('login: key from page, IsNeedCaptcha, RSA-encrypted password, cookies saved', async () => {
  const sessionFile = tmpSession();
  const fetch = fakeFetch({
    'GET /Org/Account/Login/index': () => res(LOGIN_HTML, { cookies: ['pre=1; Path=/'] }),
    'POST /Org/Account/Login/IsNeedCaptcha': () => res({ success: true, data: '0' }),
    'POST /Org/Account/Login/Login': () => res({ success: true, data: null }, { cookies: ['auth=TOKEN; Path=/; HttpOnly', 'pre=; Max-Age=0'] }),
  });
  const c = createJstClient({ baseUrl: BASE, accountId: 'dev', password: 'sêcret-pw', sessionFile, fetch });
  assert.equal(await c.login(), true);

  const [, cap, login] = fetch.calls;
  assert.equal(cap.body.accountId, 'dev');
  assert.equal(cap.body.password, '');
  assert.equal(cap.body.policyChecked, true);
  assert.equal(cap.headers.Cookie, 'pre=1');
  assert.match(cap.body.cacheKey, /^[0-9a-f-]{36}$/);
  assert.equal(login.body.cacheKey, cap.body.cacheKey);
  assert.equal(login.body.isNeedCaptcha, false);
  assert.equal(login.redirect, 'manual');

  const enc = Buffer.from(login.body.password, 'base64');
  assert.equal(enc.length, 256);
  const plain = crypto.privateDecrypt({ key: privateKey, padding: crypto.constants.RSA_PKCS1_PADDING }, enc).toString('utf8');
  assert.equal(plain, 'sêcret-pw');

  assert.deepEqual(JSON.parse(readFileSync(sessionFile, 'utf8')), [{ name: 'auth', value: 'TOKEN' }]);
});

test('login: captcha required → CaptchaRequired, Login never posted', async () => {
  const fetch = fakeFetch({
    'GET /Org/Account/Login/index': () => res(LOGIN_HTML),
    'POST /Org/Account/Login/IsNeedCaptcha': () => res({ success: true, data: '1' }),
  });
  const c = createJstClient({ accountId: 'dev', password: 'pw', sessionFile: tmpSession(), fetch });
  await assert.rejects(c.login(), CaptchaRequired);
  assert.equal(fetch.calls.length, 2);
});

test('login: success false → LoginFailed with JST message; no credentials → LoginUnavailable', async () => {
  const fetch = fakeFetch({
    'GET /Org/Account/Login/index': () => res(LOGIN_HTML),
    'POST /Org/Account/Login/IsNeedCaptcha': () => res({ success: true, data: '0' }),
    'POST /Org/Account/Login/Login': () => res({ success: false, message: 'รหัสผ่านไม่ถูกต้อง' }),
  });
  const c = createJstClient({ accountId: 'dev', password: 'bad', sessionFile: tmpSession(), fetch });
  await assert.rejects(c.login(), (e) => e instanceof LoginFailed && e.message === 'รหัสผ่านไม่ถูกต้อง');

  const none = createJstClient({ sessionFile: tmpSession(), fetch: fakeFetch({}) });
  await assert.rejects(none.login(), LoginUnavailable);
});

test('login: page without publicKey → ShapeError', async () => {
  const fetch = fakeFetch({ 'GET /Org/Account/Login/index': () => res('<html></html>') });
  const c = createJstClient({ accountId: 'dev', password: 'pw', sessionFile: tmpSession(), fetch });
  await assert.rejects(c.login(), ShapeError);
});

test('cookie jar: loads from file, sends Cookie header, merges Set-Cookie, persists', async () => {
  const sessionFile = tmpSession();
  writeFileSync(sessionFile, JSON.stringify([{ name: 'auth', value: 'OLD' }, { name: 'x', value: '1' }]));
  const fetch = fakeFetch({
    'POST /iim/getSessions': () => res({ success: true, data: { data: [ROOM] } }, { cookies: ['auth=NEW; Path=/', 'y=2'] }),
  });
  const c = createJstClient({ sessionFile, fetch });
  assert.equal(c.hasSession(), true);
  await c.room(555);
  assert.equal(fetch.calls[0].headers.Cookie, 'auth=OLD; x=1');
  assert.equal(fetch.calls[0].headers['Content-Type'], 'application/json;charset=UTF-8');
  assert.deepEqual(JSON.parse(readFileSync(sessionFile, 'utf8')), [
    { name: 'auth', value: 'NEW' },
    { name: 'x', value: '1' },
    { name: 'y', value: '2' },
  ]);
  await c.room(555);
  assert.equal(fetch.calls[1].headers.Cookie, 'auth=NEW; x=1; y=2');

  // reloadSession อ่านไฟล์ใหม่ (หลัง import-session)
  writeFileSync(sessionFile, JSON.stringify([{ name: 'auth', value: 'IMPORTED' }]));
  c.reloadSession();
  await c.room(555);
  assert.equal(fetch.calls[2].headers.Cookie, 'auth=IMPORTED');
});

test('no session file → no Cookie header and nothing written until a cookie arrives', async () => {
  const sessionFile = tmpSession();
  const fetch = fakeFetch({ 'POST /iim/getSessions': () => res({ success: true, data: { data: [ROOM] } }) });
  const c = createJstClient({ sessionFile, fetch });
  await c.room(555);
  assert.equal(fetch.calls[0].headers.Cookie, undefined);
  assert.equal(existsSync(sessionFile), false);
});

test('post: 401 and redirect to login → SessionExpired; non-JSON → ShapeError; 5xx → JstError', async () => {
  const mk = (r) => createJstClient({ sessionFile: tmpSession(), fetch: fakeFetch({ 'POST /iim/x': () => r }) });
  await assert.rejects(mk(res('', { status: 401 })).post('/iim/x', {}), SessionExpired);
  await assert.rejects(mk(res('', { status: 302, headers: { location: '/Org/Account/Login/index?ReturnUrl=%2Fiim' } })).post('/iim/x', {}), SessionExpired);
  await assert.rejects(mk(res('<html>hello</html>')).post('/iim/x', {}), ShapeError);
  await assert.rejects(mk(res('<html>publicKey: ...</html>')).post('/iim/x', {}), SessionExpired);
  await assert.rejects(mk(res('Bad Gateway', { status: 502 })).post('/iim/x', {}), JstError);
  assert.deepEqual(await mk(res({ success: true, data: 1 })).post('/iim/x', {}), { success: true, data: 1 });
});

test('network failure → JstError without leaking request details', async () => {
  const c = createJstClient({
    sessionFile: tmpSession(),
    fetch: async () => {
      throw new TypeError('fetch failed');
    },
  });
  await assert.rejects(c.post('/iim/x', {}), (e) => e instanceof JstError && !/Cookie/i.test(e.message));
});

test('room(): precise query body, maps fields', async () => {
  const fetch = fakeFetch({ 'POST /iim/getSessions': () => res({ success: true, data: { data: [ROOM] } }) });
  const c = createJstClient({ sessionFile: tmpSession(), fetch });
  const r = await c.room('555');
  assert.deepEqual(r, { msId: 555, chatAccountId: 77, coId: 9, provider: 'Line', page: 'Bebeplay OA', name: 'คุณเอ ', expired: false });
  const b = fetch.calls[0].body;
  assert.equal(b.is_precise_query, true);
  assert.deepEqual(b.precise_query_ms_ids, [555]);
  assert.equal(b.type, 'Private');
  assert.equal(b.page_size, 1);
  assert.match(b.max_ts, /^\d{13}$/);
});

test('room(): falls back to is_precise_query:false, returns null when not found', async () => {
  const fetch = fakeFetch({
    'POST /iim/getSessions': (req) =>
      res({ success: true, data: { data: req.body.is_precise_query ? [] : [{ ...ROOM, ms_id: 999 }] } }),
  });
  const c = createJstClient({ sessionFile: tmpSession(), fetch });
  assert.equal(await c.room(555), null);
  assert.deepEqual(fetch.calls.map((x) => x.body.is_precise_query), [true, false]);
});

test('room(): wrong field types → ShapeError; missing data.data → ShapeError; success:false → JstError', async () => {
  const mk = (body) => createJstClient({ sessionFile: tmpSession(), fetch: fakeFetch({ 'POST /iim/getSessions': () => res(body) }) });
  await assert.rejects(mk({ success: true, data: { data: [{ ...ROOM, chat_account_id: '77' }] } }).room(555), (e) => e instanceof ShapeError && /chat_account_id/.test(e.message));
  await assert.rejects(mk({ success: true, data: { data: [{ ...ROOM, is_expired: 0 }] } }).room(555), ShapeError);
  await assert.rejects(mk({ success: true, data: { data: [{ ...ROOM, name: null }] } }).room(555), ShapeError);
  await assert.rejects(mk({ success: true, data: { data: [{ ...ROOM, co_id: undefined }] } }).room(555), ShapeError);
  await assert.rejects(mk({ success: true, data: [] }).room(555), ShapeError);
  await assert.rejects(mk({ data: { data: [ROOM] } }).room(555), ShapeError);
  await assert.rejects(mk({ success: false, message: 'no permission' }).room(555), (e) => e instanceof JstError && e.message === 'no permission');
});

test('recentMessages(): body and mapping (data[] and data.data[])', async () => {
  const msgs = [{ msg_id: 1, io_type: 'Out', msg_content: 'hi', status: 'Success', send_time: '2026-11-20 10:00:00' }];
  for (const data of [msgs, { data: msgs }]) {
    const fetch = fakeFetch({ 'POST /iim/getMsgs': () => res({ success: true, data }) });
    const c = createJstClient({ sessionFile: tmpSession(), fetch });
    const out = await c.recentMessages({ msId: 555, coId: 9 });
    assert.deepEqual(out, [{ msgId: 1, io: 'Out', content: 'hi', status: 'Success', sendTime: '2026-11-20 10:00:00' }]);
    assert.deepEqual(fetch.calls[0].body, { co_id: 9, ms_id: 555, msg_id: 0, ts: '0', page_size: 20, pull_model: 'old', is_first: true });
  }
  const bad = createJstClient({ sessionFile: tmpSession(), fetch: fakeFetch({ 'POST /iim/getMsgs': () => res({ success: true, data: 'x' }) }) });
  await assert.rejects(bad.recentMessages({ msId: 1, coId: 1 }), ShapeError);
});

test('send(): body per contract; success → {ok, raw}; failure → JstError', async () => {
  const fetch = fakeFetch({ 'POST /iim/SendMsg': () => res({ success: true, data: { msg_id: 42 } }) });
  const c = createJstClient({ sessionFile: tmpSession(), fetch });
  const room = { msId: 555, chatAccountId: 77, coId: 9 };
  const r = await c.send(room, 'สวัสดีค่ะ');
  assert.deepEqual(r, { ok: true, raw: { success: true, data: { msg_id: 42 } } });
  assert.deepEqual(fetch.calls[0].body, {
    ms_id: 555, chat_account_id: 77, content: 'สวัสดีค่ะ', translate_content: '', send_message_to_buyer_type: 'ChatAccount', template_type: 'txt',
  });

  const f = createJstClient({ sessionFile: tmpSession(), fetch: fakeFetch({ 'POST /iim/SendMsg': () => res({ Success: false, Message: 'chat account not authorized' }) }) });
  await assert.rejects(f.send(room, 'x'), (e) => e instanceof JstError && e.message === 'chat account not authorized');
});

test('baseUrl must be https *.jsterp.com', () => {
  assert.throws(() => createJstClient({ baseUrl: 'https://evil.example.com', fetch: async () => {} }), /jsterp/);
  assert.throws(() => createJstClient({ baseUrl: 'http://asia-web.jsterp.com', fetch: async () => {} }), /jsterp/);
});

test('searchByBuyerId(): outer_user_id query, keeps exact matches only, maps fields', async () => {
  const rooms = [
    { ...ROOM, ms_id: 1, outer_user_id: 'U1', is_expired: true, last_message_time_long: '1789961714887' },
    { ...ROOM, ms_id: 2, outer_user_id: 'U10' }, // ค้นแบบขึ้นต้นด้วยอาจได้คนอื่นมา — ต้องทิ้ง
    { ...ROOM, ms_id: 3, outer_user_id: 'U1', session_provider: 'Facebook', outer_account_name: 'Bebeplay', last_message_time_long: '' },
  ];
  const fetch = fakeFetch({ 'POST /iim/getSessions': () => res({ success: true, data: { data: rooms } }) });
  const c = createJstClient({ sessionFile: tmpSession(), fetch });
  const out = await c.searchByBuyerId(' U1 ');
  assert.deepEqual(out, [
    { ms_id: 1, outer_user_id: 'U1', provider: 'Line', page: 'Bebeplay OA', name: 'คุณเอ', expired: true, last_message_time: '2026-09-21T03:35:14.887Z' },
    { ms_id: 3, outer_user_id: 'U1', provider: 'Facebook', page: 'Bebeplay', name: 'คุณเอ', expired: false, last_message_time: null },
  ]);
  const b = fetch.calls[0].body;
  assert.equal(b.query_type, 'outer_user_id');
  assert.equal(b.name, 'U1');
  assert.equal(b.is_precise_query, false);
  assert.deepEqual(b.precise_query_ms_ids, []);
  assert.equal(b.page_size, 20);
});

test('searchByBuyerId(): empty id rejected; bad shape → ShapeError; success:false → JstError', async () => {
  const mk = (body) => createJstClient({ sessionFile: tmpSession(), fetch: fakeFetch({ 'POST /iim/getSessions': () => res(body) }) });
  await assert.rejects(mk({ success: true, data: { data: [] } }).searchByBuyerId('  '), /invalid buyer id/);
  await assert.rejects(mk({ success: true, data: { data: [{ ...ROOM, ms_id: '1' }] } }).searchByBuyerId('U1'), (e) => e instanceof ShapeError && /ms_id/.test(e.message));
  await assert.rejects(mk({ success: true, data: { data: [{ ...ROOM, outer_user_id: 5 }] } }).searchByBuyerId('U1'), ShapeError);
  await assert.rejects(mk({ success: true, data: { data: [{ ...ROOM, is_expired: 'no' }] } }).searchByBuyerId('U1'), ShapeError);
  await assert.rejects(mk({ success: true, data: {} }).searchByBuyerId('U1'), ShapeError);
  await assert.rejects(mk({ success: false, message: 'busy' }).searchByBuyerId('U1'), (e) => e instanceof JstError && e.message === 'busy');
  assert.deepEqual(await mk({ success: true, data: { data: [] } }).searchByBuyerId('U1'), []);
});

test('sessionStore: cookies are read from and written to the store, not a file', async () => {
  const store = memoryStore([{ name: 'auth', value: 'OLD' }]);
  const fetch = fakeFetch({
    'POST /iim/getSessions': (req) => {
      assert.match(req.headers.Cookie, /auth=OLD/);
      return res({ success: true, data: { data: [ROOM] } }, { cookies: ['auth=NEW; Path=/'] });
    },
  });
  const jst = createJstClient({ accountId: 'u', password: 'p', sessionStore: store, fetch });
  assert.equal(jst.hasSession(), true);
  assert.equal(store.dirty, false);
  assert.equal(await jst.ping(), true);
  assert.equal(store.dirty, true);
  assert.deepEqual(store.cookies(), [{ name: 'auth', value: 'NEW' }]);
  assert.equal(jst.sessionMtime(), 0);
});

test('ping: asks for one session with no ids; 401 → SessionExpired; bad shape → ShapeError', async () => {
  let seen;
  const ok = createJstClient({
    sessionStore: memoryStore([{ name: 'auth', value: 'T' }]),
    fetch: fakeFetch({ 'POST /iim/getSessions': (req) => ((seen = req.body), res({ success: true, data: { data: [] } })) }),
  });
  assert.equal(await ok.ping(), true);
  assert.equal(seen.page_size, 1);
  assert.deepEqual(seen.precise_query_ms_ids, []);
  assert.equal(seen.is_precise_query, false);

  const expired = createJstClient({ sessionStore: memoryStore(), fetch: fakeFetch({ 'POST /iim/getSessions': () => res('', { status: 401 }) }) });
  await assert.rejects(expired.ping(), SessionExpired);

  const odd = createJstClient({ sessionStore: memoryStore(), fetch: fakeFetch({ 'POST /iim/getSessions': () => res({ success: true, data: {} }) }) });
  await assert.rejects(odd.ping(), ShapeError);
});
