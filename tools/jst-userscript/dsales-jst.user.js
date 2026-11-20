// ==UserScript==
// @name         MPD Direct Sale — เปิดแชต JST อัตโนมัติ
// @namespace    https://directsales-web.vercel.app
// @version      1.1.0
// @description  กดไอคอนแชตในเว็บ Direct Sale แล้วหน้า JST ค้นหาชื่อลูกค้าและเปิดห้องแชตให้เอง
// @match        https://asia-web.jsterp.com/iim/index*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

/*
 * เว็บ Direct Sale เปิดหน้าแชต JST เป็น https://asia-web.jsterp.com/iim/index#dsales-chat=<ชื่อแชต>&dsales-ms=<ms_id>&dsales-t=<เวลา>
 * สคริปต์นี้อ่าน hash → ตั้งช่องค้นหาเป็น "Buyer Name" → พิมพ์ชื่อแล้วกด Enter → คลิกห้องที่ตรง (ms_id ก่อน, ชื่อตรงทุกตัวอักษร, หรือผลลัพธ์เดียว)
 * ทำผ่าน DOM เหมือนคนพิมพ์ ไม่เรียก API ตรง ไม่ส่งข้อมูลออกนอกหน้า
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

  /*
   * ใช้แค่ DOM (ไม่แตะตัวแปร JS ของหน้า JST เช่น __vue__) เพราะ Tampermonkey บน Chrome รุ่นใหม่รันสคริปต์ใน "โลก" แยกจากหน้าเว็บ
   * มองเห็น DOM เดียวกันแต่มองไม่เห็นตัวแปร JS ของหน้า — ทำเหมือนเซลล์พิมพ์ในช่องค้นหาแล้วกด Enter
   */
  function filterBox() {
    return Array.prototype.find.call(document.querySelectorAll('.panel_contacts-filter'), function (e) { return e.offsetParent; }) || null;
  }
  function searchInput() {
    var f = filterBox();
    return f ? Array.prototype.find.call(f.querySelectorAll('div.j-input > input'), function (i) { return i.offsetParent; }) || null : null;
  }
  /** ตัวเลือกแรกของช่องประเภทการค้นหา = Buyer Name (ไม่อิงข้อความ เผื่อ JST เป็นภาษาไทย) */
  function ensureBuyerName() {
    var f = filterBox();
    var first = f && f.querySelector('.j-select .j-option');
    if (first && !first.classList.contains('checked')) first.click();
  }
  function typeAndEnter(input, text) {
    var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    input.focus();
    setter.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
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
  var bar = null;
  function note(text, ms) {
    if (!bar) {
      bar = document.createElement('div');
      bar.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:99999;background:#1f2937;color:#fff;' +
        'padding:8px 14px;border-radius:8px;font:13px sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.25);max-width:80vw';
    }
    bar.textContent = 'Direct Sale: ' + text;
    if (!bar.isConnected) document.body.appendChild(bar);
    clearTimeout(note.timer);
    note.timer = setTimeout(function () { bar.remove(); }, ms || 5000);
    console.info('[dsales-jst]', text);
  }

  var running = 0;
  async function run() {
    var req = parseHash(location.hash);
    if (!req) return;
    history.replaceState(null, '', location.pathname + location.search); // รีเฟรชแล้วไม่ค้นหาซ้ำ
    var my = ++running;
    note('กำลังเปิดแชต ' + req.chat + ' …', 15000);

    var input = await waitFor(searchInput, 20000);
    if (!input) return note('ไม่พบช่องค้นหาของ JST (ล็อกอิน JST แล้วหรือยัง?) ค้นหาด้วย: ' + req.chat, 10000);
    await waitFor(function () { return document.querySelector('#session li'); }, 8000); // รอรายการแรกของหน้าโหลด ไม่ให้มาทับผลค้นหา
    if (my !== running) return;

    ensureBuyerName();
    await sleep(300);
    input = searchInput() || input;
    var before = idsOf(sessions());
    typeAndEnter(input, req.search);

    var hit = await waitFor(function () {
      if (my !== running) return 'stop';
      var items = sessions();
      var i = pickSession(items, req, idsOf(items) !== before);
      return i >= 0 ? items[i] : null;
    }, 10000);
    if (hit === 'stop') return;
    if (!hit) return note('ไม่พบห้องแชตชื่อ ' + req.chat + ' หรือมีหลายห้องชื่อซ้ำ — เลือกจากรายการเอง', 10000);

    if (!hit.li.classList.contains('active')) { // ค้นหาแล้ว JST มักเปิดห้องแรกให้เอง เปิดซ้ำเฉพาะเมื่อไม่ใช่ห้องที่ต้องการ
      hit.li.scrollIntoView({ block: 'nearest' });
      hit.li.click();
    }
    note('เปิดแชต ' + hit.name.trim() + ' แล้ว', 3000);
  }

  window.addEventListener('hashchange', run);
  run();
})();
