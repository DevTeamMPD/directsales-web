#!/usr/bin/env node
/*
 * JST Helper — ตัวช่วยที่รันบนเครื่องเซลล์ ให้เว็บ MPD Direct Sale สั่ง "เปิดแชตของลูกค้าใน JST"
 *
 *   node jst-helper.js            (อ่านค่าจาก config.json ข้างไฟล์นี้)
 *
 * - ฟังเฉพาะ 127.0.0.1 (เครื่องตัวเอง) ไม่เปิดให้เครื่องอื่นในเครือข่ายเรียก
 * - รับคำขอเฉพาะจากเว็บที่อยู่ใน allowedOrigins
 * - mode "url"     เปิดลิงก์ JST (urlTemplate) ด้วยเบราว์เซอร์เริ่มต้น
 * - mode "command" รันโปรแกรม/สคริปต์ของคุณ (เช่น AutoHotkey, Python) โดยส่งค่าเป็นอาร์กิวเมนต์ ไม่ผ่านเชลล์
 * ไม่มีไลบรารีภายนอก ใช้ Node 18+
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const VERSION = '1.0.0';
const DEFAULTS = {
  port: 47321,
  allowedOrigins: ['https://directsales-web.vercel.app'],
  mode: 'url',
  urlTemplate: '',
  command: [],
  maxBodyBytes: 8192,
};
const FIELDS = ['phone', 'name', 'brand', 'platform', 'shop', 'chat', 'ms_id', 'rep'];

function loadConfig() {
  const file = process.env.JST_HELPER_CONFIG || path.join(__dirname, 'config.json');
  let user = {};
  if (fs.existsSync(file)) {
    try { user = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.error('อ่าน config.json ไม่ได้:', e.message); process.exit(1); }
  }
  const cfg = { ...DEFAULTS, ...user };
  if (process.env.JST_HELPER_PORT) cfg.port = Number(process.env.JST_HELPER_PORT);
  return cfg;
}

// เก็บเฉพาะฟิลด์ที่รู้จัก ตัดความยาว และบังคับเป็นข้อความ
function sanitize(body) {
  const out = {};
  for (const k of FIELDS) {
    const v = body && body[k];
    out[k] = v === null || v === undefined ? '' : String(v).replace(/[\u0000-\u001f]/g, ' ').slice(0, 200);
  }
  return out;
}
const fill = (tpl, vars, enc) => String(tpl).replace(/\{(\w+)\}/g, (_, k) => (enc ? encodeURIComponent(vars[k] ?? '') : String(vars[k] ?? '')));

function openUrl(url, dryRun) {
  if (!/^https?:\/\//i.test(url)) throw new Error('urlTemplate ต้องขึ้นต้นด้วย http:// หรือ https://');
  if (dryRun) return;
  const p = process.platform;
  const [cmd, args] = p === 'win32' ? ['rundll32', ['url.dll,FileProtocolHandler', url]] : p === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref(); // ไม่ผ่านเชลล์
}
function runCommand(command, vars, dryRun) {
  if (!Array.isArray(command) || !command.length) throw new Error('mode "command" ต้องตั้ง command เป็นรายการ เช่น ["python","open_jst.py","{chat}"]');
  const [file, ...args] = command.map((a) => fill(a, vars, false));
  if (dryRun) return { file, args };
  spawn(file, args, { detached: true, stdio: 'ignore', shell: false }).unref(); // ไม่ผ่านเชลล์ ค่าจากเว็บจึงเป็นแค่ข้อความ
  return { file, args };
}

function createServer(cfg) {
  const dryRun = !!process.env.JST_HELPER_DRY_RUN;
  const allowed = new Set(cfg.allowedOrigins);
  return http.createServer((req, res) => {
    const origin = req.headers.origin;
    const originOk = !origin || allowed.has(origin); // ไม่มี Origin = เรียกจากเครื่องตัวเอง (เช่น curl)
    const cors = {};
    if (origin && allowed.has(origin)) {
      Object.assign(cors, {
        'Access-Control-Allow-Origin': origin, 'Vary': 'Origin',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Private-Network': 'true', 'Access-Control-Max-Age': '600',
      });
    }
    const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', ...cors }); res.end(obj ? JSON.stringify(obj) : ''); };
    if (!originOk) return send(403, { ok: false, error: 'origin not allowed' });
    if (req.method === 'OPTIONS') return send(204);
    if (req.method === 'GET' && req.url === '/ping') return send(200, { ok: true, helper: 'jst-helper', version: VERSION, mode: cfg.mode });
    if (req.method === 'POST' && req.url === '/open') {
      let size = 0; const chunks = [];
      req.on('data', (c) => {
        size += c.length;
        if (size > cfg.maxBodyBytes) { send(413, { ok: false, error: 'body too large' }); req.destroy(); return; }
        chunks.push(c);
      });
      req.on('end', () => {
        if (res.writableEnded) return;
        let body;
        try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch (e) { return send(400, { ok: false, error: 'invalid json' }); }
        const v = sanitize(body);
        if (!v.chat && !v.phone) return send(400, { ok: false, error: 'chat or phone required' });
        try {
          if (cfg.mode === 'url') {
            if (!cfg.urlTemplate) throw new Error('ยังไม่ได้ตั้ง urlTemplate ใน config.json');
            const url = fill(cfg.urlTemplate, v, true);
            openUrl(url, dryRun);
            console.log(new Date().toISOString(), 'open url', dryRun ? '(dry-run)' : '', v.platform, v.shop);
            return send(200, { ok: true, mode: 'url', ...(dryRun ? { dryRun: true, url } : {}) });
          }
          if (cfg.mode === 'command') {
            const r = runCommand(cfg.command, v, dryRun);
            console.log(new Date().toISOString(), 'run command', dryRun ? '(dry-run)' : '', path.basename(r.file), v.platform, v.shop);
            return send(200, { ok: true, mode: 'command', ...(dryRun ? { dryRun: true, file: r.file, args: r.args } : {}) });
          }
          throw new Error('mode ต้องเป็น "url" หรือ "command"');
        } catch (e) { return send(500, { ok: false, error: e.message }); }
      });
      return;
    }
    send(404, { ok: false, error: 'not found' });
  });
}

if (require.main === module) {
  const cfg = loadConfig();
  createServer(cfg).listen(cfg.port, '127.0.0.1', () => {
    console.log(`JST Helper ${VERSION} พร้อมใช้งานที่ http://127.0.0.1:${cfg.port} (mode: ${cfg.mode})`);
    console.log('อนุญาตเว็บ:', cfg.allowedOrigins.join(', '));
  });
}
module.exports = { createServer, sanitize, fill, loadConfig };
