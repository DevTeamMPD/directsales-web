// ==UserScript==
// @name         MPD Direct Sale — เปิดแชต JST อัตโนมัติ
// @namespace    https://directsales-web.vercel.app
// @version      1.0.0
// @description  กดไอคอนแชตในเว็บ Direct Sale แล้วหน้า JST ค้นหาชื่อลูกค้าและเปิดห้องแชตให้เอง
// @match        https://asia-web.jsterp.com/iim/index*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

/*
 * เว็บ Direct Sale เปิดหน้าแชต JST เป็น https://asia-web.jsterp.com/iim/index#dsales-chat=<ชื่อแชต>&dsales-ms=<ms_id>&dsales-t=<เวลา>
 * สคริปต์นี้อ่าน hash → ตั้งช่องค้นหาเป็น "Buyer Name" → ค้นหา → คลิกห้องที่ตรง (ms_id ก่อน, ชื่อตรงทุกตัวอักษร, หรือผลลัพธ์เดียว)
 * ใช้ฟังก์ชันค้นหาของหน้า JST เอง ไม่เรียก API ตรง ไม่ส่งข้อมูลออกนอกหน้า
 */
(function () {
  'use strict';

  var MAX_SEARCH = 50; // ช่องค้นหาของ JST รับได้ 50 ตัวอักษร

  /** อ่าน hash ที่เว็บ Direct Sale ส่งมา: null = ไม่ใช่คำสั่งของเรา */
  function parseHash(hash) {
    var p = new URLSearchParams(String(hash || '').replace(/^#/, ''));
    var chat = (p.get('dsales-chat') || '').trim();
    if (!chat) return null;
    var ms = (p.get('dsales-ms') || '').trim();
    return { chat: chat, search: Array.from(chat).slice(0, MAX_SEARCH).join(''), ms: /^\d+$/.test(ms) ? ms : '' };
  }

  /**
   * เลือกห้องจากรายการ [{ ms, name }]: ms_id ตรง → ชื่อตรงทุกตัวอักษร (ต้องมีห้องเดียว) → ผลค้นหามีห้องเดียว (เฉพาะเมื่อรายการเปลี่ยนแล้ว)
   * คืน index หรือ -1 (ให้เซลล์เลือกเอง)
   */
  function pickSession(items, req, listChanged) {
    if (req.ms) {
      for (var i = 0; i < items.length; i++) if (items[i].ms === req.ms) return i;
    }
    var exact = [];
    for (var j = 0; j < items.length; j++) if (items[j].name.trim() === req.chat) exact.push(j);
    if (exact.length === 1) return exact[0];
    if (listChanged && items.length === 1) return 0;
    return -1;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseHash: parseHash, pickSession: pickSession };
    return;
  }

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }
  async function waitFor(fn, timeout) {
    var end = Date.now() + timeout;
    while (Date.now() < end) {
      var v = fn();
      if (v) return v;
      await sleep(200);
    }
    return null;
  }

  /** Vue instance หลักของหน้าแชต (ช่องค้นหาผูกกับ buyerRequest.name) */
  function chatApp() {
    var el = document.querySelector('.panel_contacts-filter .j-input');
    var vm = el && el.__vue__ && el.__vue__.$parent;
    return vm && vm.buyerRequest && typeof vm.handleChangeMsgType === 'function' ? vm : null;
  }
  function sessions() {
    return Array.prototype.map.call(document.querySelectorAll('#session li[data-ms-id]'), function (li) {
      var n = li.querySelector('.name-text');
      return { li: li, ms: li.getAttribute('data-ms-id'), name: n ? n.textContent : '' };
    });
  }
  function idsOf(items) {
    return items.map(function (x) { return x.ms; }).join(',');
  }
  function note(text) {
    var d = document.createElement('div');
    d.textContent = 'Direct Sale: ' + text;
    d.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:99999;background:#1f2937;color:#fff;' +
      'padding:8px 14px;border-radius:8px;font:13px sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.25)';
    document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 5000);
  }

  var running = 0;
  async function run() {
    var req = parseHash(location.hash);
    if (!req) return;
    history.replaceState(null, '', location.pathname + location.search); // รีเฟรชแล้วไม่ค้นหาซ้ำ
    var my = ++running;

    var vm = await waitFor(chatApp, 20000);
    if (!vm) return note('หน้าแชต JST ยังไม่พร้อม (ล็อกอิน JST แล้วหรือยัง?) ค้นหาด้วย: ' + req.chat);
    await waitFor(function () { return document.querySelector('#session li'); }, 8000); // รอรายการแรกของหน้าโหลด ไม่ให้มาทับผลค้นหา
    if (my !== running) return;

    if (vm.buyerRequest.query_type !== 'name') {
      vm.buyerRequest.query_type = 'name';
      if (typeof vm.queryTypeChange === 'function') vm.queryTypeChange();
    }
    var before = idsOf(sessions());
    vm.buyerRequest.name = req.search;
    vm.handleChangeMsgType();

    var hit = await waitFor(function () {
      if (my !== running) return 'stop';
      var items = sessions();
      var i = pickSession(items, req, idsOf(items) !== before);
      return i >= 0 ? items[i] : null;
    }, 10000);
    if (hit === 'stop') return;
    if (!hit) return note('พบหลายห้องหรือไม่พบห้องที่ชื่อตรง เลือกจากรายการเอง: ' + req.chat);

    var cur = window.SESSION_DATA_CURRENT && window.SESSION_DATA_CURRENT.$data;
    if (cur && String(cur.ms_id) === hit.ms) return; // เปิดห้องนี้อยู่แล้ว
    hit.li.scrollIntoView({ block: 'nearest' });
    hit.li.click();
  }

  window.addEventListener('hashchange', run);
  run();
})();
