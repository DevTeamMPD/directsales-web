// คุยกับเว็บ JST ผ่าน endpoint ภายใน (fetch + cookie jar) — ไม่มี Playwright
// endpoint/body อ้างอิง docs/superpowers/plans/2026-11-20-outreach-contract.md §3
// ห้าม log รหัสผ่าน cookie หรือ header · error ที่โยนออกไปมีแค่ข้อความจาก JST / ชื่อ field
import crypto from 'node:crypto';
import { existsSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';

/* ---------- error ---------- */

export class JstError extends Error {
  constructor(message) {
    super(message);
    this.name = 'JstError';
  }
}
/** session หลุด (401 หรือถูก redirect ไปหน้าล็อกอิน) */
export class SessionExpired extends Error {
  constructor(message = 'session_expired') {
    super(message);
    this.name = 'SessionExpired';
  }
}
/** JST ขอ captcha — ต้องล็อกอินเองด้วย import-session.mjs */
export class CaptchaRequired extends Error {
  constructor(message = 'captcha_required') {
    super(message);
    this.name = 'CaptchaRequired';
  }
}
/** JST ตอบว่าล็อกอินไม่ผ่าน (รหัสผิด ฯลฯ) */
export class LoginFailed extends Error {
  constructor(message = 'login_failed') {
    super(message);
    this.name = 'LoginFailed';
  }
}
/** ไม่ได้ตั้ง accountId/password ใน config — ล็อกอินอัตโนมัติไม่ได้ */
export class LoginUnavailable extends Error {
  constructor(message = 'login_unavailable: no JST credentials configured') {
    super(message);
    this.name = 'LoginUnavailable';
  }
}
/** รูปแบบ response ไม่ตรงที่คาด (JST อาจเปลี่ยน endpoint) — ต้องให้ dev ตรวจ */
export class ShapeError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ShapeError';
  }
}

/* ---------- helper (export ไว้ให้ test) ---------- */

export const DEFAULT_BASE_URL = 'https://asia-web.jsterp.com';
const LOGIN_PAGE = '/Org/Account/Login/index';
const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export const isLoginUrl = (url) => /\/account\/login/i.test(String(url || ''));

/** `publicKey: '...'` ในหน้า HTML ล็อกอิน */
export function extractPublicKey(html) {
  const m = /publicKey\s*[:=]\s*['"]([A-Za-z0-9+/=\s]+)['"]/.exec(String(html || ''));
  return m ? m[1].replace(/\s+/g, '') : null;
}

export function toPem(base64Key) {
  const lines = base64Key.match(/.{1,64}/g) || [];
  return `-----BEGIN PUBLIC KEY-----\n${lines.join('\n')}\n-----END PUBLIC KEY-----`;
}

/** RSA PKCS#1 v1.5 → base64 (กุญแจ 2048 bit = 256 ไบต์) */
export function encryptPassword(base64Key, password) {
  const out = crypto.publicEncrypt(
    { key: toPem(base64Key), padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(String(password), 'utf8'),
  );
  return out.toString('base64');
}

/** 'name=value; Path=/; ...' → { name, value, remove } */
export function parseSetCookie(line) {
  const parts = String(line).split(';');
  const first = parts.shift() || '';
  const eq = first.indexOf('=');
  if (eq <= 0) return null;
  const name = first.slice(0, eq).trim();
  const value = first.slice(eq + 1).trim();
  let remove = false;
  for (const p of parts) {
    const [k, ...rest] = p.split('=');
    const key = k.trim().toLowerCase();
    const v = rest.join('=').trim();
    if (key === 'max-age' && Number(v) <= 0) remove = true;
    if (key === 'expires') {
      const t = Date.parse(v);
      if (!Number.isNaN(t) && t <= Date.now()) remove = true;
    }
  }
  return { name, value, remove };
}

/** success / Success , message / Message (JST ใช้ทั้งสองแบบ) */
export const okOf = (body) => (body && typeof body === 'object' ? (body.success ?? body.Success) : undefined);
export const messageOf = (body) =>
  body && typeof body === 'object' ? String(body.message ?? body.Message ?? '').slice(0, 300) : '';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/* ---------- client ---------- */

export function createJstClient({
  baseUrl = DEFAULT_BASE_URL,
  accountId,
  password,
  sessionFile,
  fetch = globalThis.fetch,
  userAgent = DEFAULT_UA,
} = {}) {
  const base = new URL(baseUrl);
  // รหัสผ่าน/cookie ส่งได้เฉพาะ JST เท่านั้น
  if (base.protocol !== 'https:' || !/(^|\.)jsterp\.com$/i.test(base.hostname)) {
    throw new Error(`baseUrl must be https://*.jsterp.com (got ${base.origin})`);
  }
  const origin = base.origin;
  const jar = new Map();

  function loadSession() {
    jar.clear();
    if (!sessionFile || !existsSync(sessionFile)) return false;
    try {
      const arr = JSON.parse(readFileSync(sessionFile, 'utf8'));
      if (!Array.isArray(arr)) return false;
      for (const c of arr) if (c && typeof c.name === 'string' && typeof c.value === 'string') jar.set(c.name, c.value);
      return jar.size > 0;
    } catch {
      return false;
    }
  }

  function saveSession() {
    if (!sessionFile) return;
    const data = JSON.stringify([...jar].map(([name, value]) => ({ name, value })), null, 2);
    const tmp = `${sessionFile}.tmp`;
    writeFileSync(tmp, data, { mode: 0o600 });
    renameSync(tmp, sessionFile);
  }

  function mergeCookies(res) {
    const lines = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
    let changed = false;
    for (const line of lines) {
      const c = parseSetCookie(line);
      if (!c) continue;
      if (c.remove || c.value === '') changed = jar.delete(c.name) || changed;
      else if (jar.get(c.name) !== c.value) {
        jar.set(c.name, c.value);
        changed = true;
      }
    }
    if (changed) saveSession();
  }

  const cookieHeader = () => [...jar].map(([n, v]) => `${n}=${v}`).join('; ');

  async function rawRequest(method, path, { body, referer } = {}) {
    const headers = {
      Accept: 'application/json, text/plain, */*',
      'User-Agent': userAgent,
      'X-Requested-With': 'XMLHttpRequest',
      Origin: origin,
      Referer: origin + (referer || '/iim/index'),
    };
    if (jar.size) headers.Cookie = cookieHeader();
    if (body !== undefined) headers['Content-Type'] = 'application/json;charset=UTF-8';
    let res;
    try {
      res = await fetch(origin + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: 'manual',
      });
    } catch (e) {
      // ห้ามแนบ request (มี cookie) ไปกับ error
      throw new JstError(`network: ${String(e?.message || e).slice(0, 200)}`);
    }
    mergeCookies(res);
    return res;
  }

  /** POST JSON ที่ต้องล็อกอินแล้ว */
  async function post(path, body, { referer } = {}) {
    const res = await rawRequest('POST', path, { body, referer });
    if (res.status === 401) throw new SessionExpired('session_expired: http 401');
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location') || '';
      if (isLoginUrl(loc)) throw new SessionExpired('session_expired: redirect to login');
      throw new ShapeError(`${path}: unexpected redirect ${res.status}`);
    }
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      // บางครั้งเซิร์ฟเวอร์ตอบหน้า HTML ล็อกอินด้วย 200 แทน redirect
      if (/publicKey|\/Account\/Login/i.test(text)) throw new SessionExpired('session_expired: login page returned');
      if (res.status >= 500) throw new JstError(`http ${res.status}`);
      throw new ShapeError(`${path}: response is not JSON (http ${res.status})`);
    }
    if (res.status >= 500) throw new JstError(messageOf(json) || `http ${res.status}`);
    if (json === null || typeof json !== 'object') throw new ShapeError(`${path}: response is not an object`);
    return json;
  }

  function requireSuccess(path, body) {
    const ok = okOf(body);
    if (typeof ok !== 'boolean') throw new ShapeError(`${path}: missing success flag`);
    if (!ok) throw new JstError(messageOf(body) || `${path} failed`);
  }

  async function login() {
    if (!accountId || !password) throw new LoginUnavailable();
    const page = await rawRequest('GET', LOGIN_PAGE, { referer: LOGIN_PAGE });
    const html = await page.text();
    const publicKey = extractPublicKey(html);
    if (!publicKey) throw new ShapeError('login page: publicKey not found');

    const cacheKey = crypto.randomUUID();
    const common = { accountId, captchaCode: '', cacheKey, clientIp: '', address: '' };

    const capRes = await rawRequest('POST', '/Org/Account/Login/IsNeedCaptcha', {
      body: { ...common, password: '', policyChecked: true },
      referer: LOGIN_PAGE,
    });
    let cap;
    try {
      cap = JSON.parse(await capRes.text());
    } catch {
      throw new ShapeError('IsNeedCaptcha: response is not JSON');
    }
    const capData = cap?.data ?? cap?.Data;
    if (String(capData) === '1') throw new CaptchaRequired();

    const encrypted = encryptPassword(publicKey, password);
    const loginRes = await rawRequest('POST', '/Org/Account/Login/Login', {
      body: { ...common, password: encrypted, clientTimeZone: '', isNeedCaptcha: false, redirectUrl: '' },
      referer: LOGIN_PAGE,
    });
    let result;
    try {
      result = JSON.parse(await loginRes.text());
    } catch {
      throw new ShapeError('Login: response is not JSON');
    }
    if (okOf(result) !== true) throw new LoginFailed(messageOf(result) || 'login_failed');
    saveSession();
    return true;
  }

  function sessionBody(msId, precise) {
    return {
      type: 'Private',
      query_type: 'name',
      name: '',
      order_id: '',
      chat_account_ids: [],
      label_codes: [],
      order_statuses: [],
      session_statuses: [],
      is_first_query: false,
      pull_model: 'old',
      page_size: 1,
      max_ts: String(Date.now()),
      min_ts: 0,
      msg_id: '',
      ms_id: 0,
      last_message_time: '',
      created: [],
      is_precise_query: precise,
      precise_query_ms_ids: [msId],
    };
  }

  async function findSession(msId, precise) {
    const body = await post('/iim/getSessions', sessionBody(msId, precise));
    requireSuccess('/iim/getSessions', body);
    const list = body.data?.data;
    if (!Array.isArray(list)) throw new ShapeError('/iim/getSessions: data.data is not an array');
    return list.find((s) => s && Number(s.ms_id) === msId) || null;
  }

  /** ห้องตาม ms_id → { msId, chatAccountId, coId, provider, page, name, expired } หรือ null */
  async function room(msIdInput) {
    const msId = Number(msIdInput);
    if (!Number.isSafeInteger(msId) || msId <= 0) throw new Error(`invalid ms_id: ${msIdInput}`);
    // สัญญา §3: ถ้า is_precise_query: true ไม่ได้ผล ให้ลอง false + precise_query_ms_ids
    const s = (await findSession(msId, true)) || (await findSession(msId, false));
    if (!s) return null;
    const bad = [];
    if (!isNum(s.ms_id)) bad.push('ms_id');
    if (!isNum(s.chat_account_id)) bad.push('chat_account_id');
    if (typeof s.name !== 'string') bad.push('name');
    if (typeof s.is_expired !== 'boolean') bad.push('is_expired');
    if (!isNum(s.co_id)) bad.push('co_id');
    if (bad.length) throw new ShapeError(`/iim/getSessions: bad field(s) ${bad.join(', ')}`);
    return {
      msId: s.ms_id,
      chatAccountId: s.chat_account_id,
      coId: s.co_id,
      provider: s.session_provider ?? null,
      page: s.outer_account_name ?? null,
      name: s.name,
      expired: s.is_expired,
    };
  }

  /** ข้อความล่าสุด 20 รายการของห้อง */
  async function recentMessages(r) {
    const body = await post('/iim/getMsgs', {
      co_id: r.coId,
      ms_id: r.msId,
      msg_id: 0,
      ts: '0',
      page_size: 20,
      pull_model: 'old',
      is_first: true,
    });
    requireSuccess('/iim/getMsgs', body);
    const list = Array.isArray(body.data) ? body.data : Array.isArray(body.data?.data) ? body.data.data : null;
    if (!list) throw new ShapeError('/iim/getMsgs: data is not an array');
    return list
      .filter((m) => m && typeof m === 'object')
      .map((m) => ({
        msgId: m.msg_id ?? null,
        io: m.io_type ?? null,
        content: typeof m.msg_content === 'string' ? m.msg_content : '',
        status: m.status ?? null,
        sendTime: m.send_time ?? null,
      }));
  }

  /** ส่งข้อความ → { ok: true, raw } · JST ตอบ success:false → JstError */
  async function send(r, text) {
    const body = await post('/iim/SendMsg', {
      ms_id: r.msId,
      chat_account_id: r.chatAccountId,
      content: text,
      translate_content: '',
      send_message_to_buyer_type: 'ChatAccount',
      template_type: 'txt',
    });
    requireSuccess('/iim/SendMsg', body);
    return { ok: true, raw: body };
  }

  function sessionMtime() {
    try {
      return sessionFile ? statSync(sessionFile).mtimeMs : 0;
    } catch {
      return 0;
    }
  }

  loadSession();

  return {
    login,
    post,
    room,
    recentMessages,
    send,
    /** โหลด cookie จากไฟล์ใหม่ (หลัง import-session.mjs) */
    reloadSession: loadSession,
    sessionMtime,
    hasSession: () => jar.size > 0,
  };
}
