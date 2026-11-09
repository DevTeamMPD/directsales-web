(function () {
  'use strict';
  const KEY = 'mpd-directsale-preview-v5';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const baht = (n) => Number(n || 0).toLocaleString('th-TH') + '.-';
  const fmtDate = (s) => { if (!s) return '—'; const [y, m, d] = s.slice(0, 10).split('-'); return `${+d}/${+m}/${y}`; };
  const fmtDT = (s) => fmtDate(s) + (s.length > 10 ? ' ' + s.slice(11, 16) : '');

  const STATUS = {
    new: 'ยังไม่ติดต่อ', following: 'กำลังติดตาม', callback: 'รอติดต่อ',
    won: 'ปิดการขายแล้ว', lost: 'ไม่สนใจ', unreachable: 'ติดต่อไม่ได้',
  };
  const BRAND = { bebeplay: 'Bebeplay', hosttail: 'Hosttail' };

  let state;
  try { state = JSON.parse(localStorage.getItem(KEY)); } catch (e) { state = null; }
  if (!state || !state.leads) state = JSON.parse(JSON.stringify(window.DS_DATA));
  state.meId = state.meId || 'r4';
  state.customers = state.customers || JSON.parse(JSON.stringify(window.DS_DATA.customers));
  state.leads.forEach(l => { if (l.status === 'dnc') { l.noCall = true; l.noCallAt = l.dncAt; l.noCallBy = l.dncBy; l.status = 'following'; } }); // ย้ายข้อมูลรุ่นเก่า
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };
  save();
  const today = state.today;

  const ui = { q: '', status: 'all', camp: 'all', rep: 'all', selCamp: null, sort: 'due', dashBrand: 'all', period: { from: '', to: '', key: 'all' } };
  const rep = (id) => state.reps.find(r => r.id === id);
  const camp = (id) => state.campaigns.find(c => c.id === id);
  const lead = (id) => state.leads.find(l => l.id === id);
  const total = (l) => l.purchases.reduce((s, p) => s + p.amount, 0);
  const me = () => rep(state.meId);
  const isAdmin = () => me()?.role === 'admin';
  // ถังไม่สะดวกให้โทร (dnc) ไม่แสดงในหน้าไหนเลยนอกจากถังของหัวหน้า / คนที่คัดออกแล้วไม่เห็นลีดนั้นอีก (คนอื่นเห็นและจองได้)
  const isDnc = (phone) => state.leads.some(l => l.phone === phone && l.noCall); // ห้ามโทร: ไม่อยู่ในถัง/แคมเปญ ให้เฉพาะเซลล์ที่แจ้งเห็นใน Direct Sale และติดต่อทางแชต
  const releasedByMe = (l) => !isAdmin() && !!l.releasedBy?.includes(state.meId);
  const visible = (l) => !l.noCall && !releasedByMe(l) && (isAdmin() || !l.owner || l.owner === state.meId); // เซลล์เห็นเฉพาะลีดว่างกับของตัวเอง
  const mineOrAll = (l) => isAdmin() || l.owner === state.meId;
  /* ---------- ตัวกรองช่วงวันที่ (ใช้ร่วมทุกหน้า) ---------- */
  const hasPeriod = () => !!(ui.period.from || ui.period.to);
  const inPeriod = (d) => !!d && (!ui.period.from || d.slice(0, 10) >= ui.period.from) && (!ui.period.to || d.slice(0, 10) <= ui.period.to);
  // ลีดที่ยังไม่มีผู้ดูแลแสดงเสมอ (ให้เซลล์จองได้) ส่วนลีดอื่นแสดงเมื่อมีการติดต่อ นัด หรือปิดการขายในช่วงนั้น
  const periodOk = (l) => !hasPeriod() || !l.owner || l.interactions.some(i => inPeriod(i.date)) || inPeriod(l.callback) || inPeriod(l.closedAt);
  const contactedIn = (l) => hasPeriod() ? l.interactions.some(i => inPeriod(i.date)) : l.status !== 'new';
  const wonIn = (l) => l.status === 'won' && (!hasPeriod() || inPeriod(l.closedAt));
  const ymd = (d) => d.toISOString().slice(0, 10);
  function presetRange(k) {
    const t = new Date(today + 'T00:00:00Z'), y = t.getUTCFullYear(), m = t.getUTCMonth();
    const D = (yy, mm, dd) => ymd(new Date(Date.UTC(yy, mm, dd)));
    if (k === 'today') return [today, today];
    if (k === '7d') return [ymd(new Date(t.getTime() - 6 * 864e5)), today];
    if (k === 'm0') return [D(y, m, 1), D(y, m + 1, 0)];
    if (k === 'm1') return [D(y, m - 1, 1), D(y, m, 0)];
    if (k === 'y0') return [D(y, 0, 1), D(y, 11, 31)];
    return ['', ''];
  }
  function periodHtml() {
    const P = ui.period, y = +today.slice(0, 4);
    const chip = (k, t) => `<button type="button" class="chip ${P.key === k ? 'active' : ''}" data-pk="${k}">${t}</button>`;
    return `<div class="period card"><div class="period-row"><b class="sub">ช่วงวันที่</b>
      ${chip('all', 'ทั้งหมด')}${chip('today', 'วันนี้')}${chip('7d', '7 วันล่าสุด')}${chip('m0', 'เดือนนี้')}${chip('m1', 'เดือนก่อน')}${chip('y0', 'ปีนี้')}
      <input type="month" id="p-month" class="input pin" aria-label="เลือกเดือน" value="${P.key === 'month' ? P.from.slice(0, 7) : ''}">
      <select id="p-year" class="select" aria-label="เลือกปี"><option value="">ปี…</option>${[y, y - 1, y - 2].map(v => `<option value="${v}" ${P.key === 'year' && P.from.startsWith(String(v)) ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <input type="date" id="p-from" class="input pin" aria-label="ตั้งแต่วันที่" value="${P.from}"><span class="sub">ถึง</span><input type="date" id="p-to" class="input pin" aria-label="ถึงวันที่" value="${P.to}"></div>
      <div class="sub">${hasPeriod() ? `กรอง ${P.from ? fmtDate(P.from) : '…'} – ${P.to ? fmtDate(P.to) : '…'} · แสดงลีดที่มีการติดต่อ นัด หรือปิดการขายในช่วงนี้ (ลีดที่ยังไม่มีผู้ดูแลแสดงเสมอ)` : 'ยังไม่ได้กรองช่วงวันที่'}</div></div>`;
  }
  function bindPeriod(redraw) {
    const apply = (from, to, key) => { Object.assign(ui.period, { from, to, key }); ui.pool.page = 0; ui.pool.loaded = false; redraw(); };
    document.querySelectorAll('[data-pk]').forEach(b => b.onclick = () => { const [f, t] = presetRange(b.dataset.pk); apply(f, t, b.dataset.pk); });
    const mo = $('#p-month'); if (mo) mo.onchange = () => {
      if (!mo.value) return apply('', '', 'all');
      const [yy, mm] = mo.value.split('-').map(Number); apply(`${mo.value}-01`, ymd(new Date(Date.UTC(yy, mm, 0))), 'month');
    };
    const yr = $('#p-year'); if (yr) yr.onchange = () => { if (yr.value) apply(`${yr.value}-01-01`, `${yr.value}-12-31`, 'year'); };
    const fr = $('#p-from'), to = $('#p-to');
    const custom = () => apply(fr.value, to.value, (fr.value || to.value) ? 'custom' : 'all');
    if (fr) fr.onchange = custom; if (to) to.onchange = custom;
  }
  const MODES = { self: 'เซลล์จองเอง', assign: 'หัวหน้ามอบหมาย', auto: 'เด้งเข้าเซลล์ที่ขายล่าสุด' };
  const lastSeller = (l) => l.purchases.find(p => p.seller && rep(p.seller))?.seller || null;
  function applyAuto(campId, quiet) {
    let n = 0;
    state.leads.filter(l => l.campaignId === campId && !l.owner && !l.noCall && !l.autoSkip).forEach(l => { const s = lastSeller(l); if (s && !(l.releasedBy || []).includes(s)) { l.owner = s; n++; } }); // ไม่ส่งลีดที่คัดออกกลับไปหาคนที่คัดออก
    if (n) { save(); if (!quiet) toast(`จัดสรรอัตโนมัติ ${n} ลีด ไปยังเซลล์ที่ขายล่าสุด`); }
    return n;
  }
  // ยกเลิกจองได้เฉพาะลีดที่เซลล์จองเอง (ไม่ใช่ที่ระบบ/หัวหน้าจัดให้) และยังไม่ปิดการขาย / ไม่ใช่ลูกค้าห้ามโทร
  const canUnclaim = (l) => l.owner === state.meId && l.claimedBy === state.meId && !l.noCall && l.status !== 'won';
  const canUnclaimAny = (l) => l.owner === state.meId && !l.noCall && l.status !== 'won'; // ในถังลูกค้า: ทุกรายที่ขึ้น "จองแล้ว" ของตัวเอง (ยกเว้นปิดการขายแล้ว/ห้ามโทร)
  const unclaimBtn = (l) => canUnclaim(l) ? `<button class="btn sm danger" data-act="unclaim" data-id="${l.id}">ยกเลิกจอง</button>` : '';
  function confirmUnclaim(id) { // ถามยืนยันอีกชั้น กันกดผิด
    const l = lead(id); if (!l || !canUnclaimAny(l)) return toast('ยกเลิกจองรายการนี้ไม่ได้');
    openModal(`<div class="modal-h"><h3>ยกเลิกจอง?</h3>${X}</div>
      <div class="modal-b"><p style="margin:0">ยืนยันยกเลิกการจอง <b>${esc(l.name)}</b> ใช่หรือไม่</p>
        <p class="help">ลูกค้าจะกลับเข้าถังให้เซลล์คนอื่นจองได้ ประวัติที่บันทึกไว้ยังอยู่</p></div>
      <div class="modal-f"><button class="btn" data-close>ไม่ยกเลิก</button><button class="btn danger solid" id="unclaim-ok">ยืนยันยกเลิกจอง</button></div>`, 'sm');
    $('#unclaim-ok').onclick = () => {
      const mineOnlyMined = l.claimedBy === state.meId && l.source === 'self' && !l.campaignId && !l.interactions.length; // ลีดที่เกิดจากการจองในถังและยังไม่เคยบันทึก ลบทิ้ง
      if (mineOnlyMined) state.leads = state.leads.filter(x => x !== l);
      else Object.assign(l, { owner: null, claimedBy: null, status: 'new', callback: null, autoSkip: !!l.campaignId || !!l.autoSkip }); // กันแคมเปญแบบ auto ส่งกลับมาหาเซลล์เดิมทันที
      save(); closeModal(); ui.pool.loaded = false; route(); toast('ยกเลิกจองแล้ว');
    };
  }
  function claimCell(l, opts) {
    if (!opts.mode || l.owner) return '';
    const repOpts = state.reps.map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('');
    const assign = isAdmin() ? `<select class="select" data-assign="${l.id}" aria-label="มอบหมายให้"><option value="">มอบหมายให้…</option>${repOpts}</select>` : '';
    if (opts.mode === 'self') return `<button class="btn sm outline" data-act="claim" data-id="${l.id}">จอง</button>${assign}`;
    if (opts.mode === 'assign') return assign || '<span class="sub">รอหัวหน้ามอบหมาย</span>';
    return assign || '<span class="sub">ไม่มียอดขายเดิมให้อ้างอิง</span>';
  }
  function noteCell(l) {
    const last = l.interactions[l.interactions.length - 1]?.note;
    const bits = [];
    if (l.interest) bits.push(`<div><span class="sub">สนใจ:</span> ${esc(l.interest)}</div>`);
    if (l.status === 'won' && l.closedBills?.length) bits.push(`<div><span class="sub">บิลที่ปิด:</span> ${l.closedBills.map(b => `<span class="bill">${esc(b)}</span>`).join(' ')}</div>`);
    bits.push(`<div>${esc(last || '—')}</div>`);
    return bits.join('');
  }
  const bills = (l) => [...new Set(l.purchases.map(p => p.bill))];

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.h); toast.h = setTimeout(() => { t.hidden = true; }, 2200);
  }

  /* ---------- routing ---------- */
  const routes = {
    leads: { title: 'Direct Sale', sub: 'ลูกค้าเก่า Direct Sale Lead', render: renderLeads },
    'campaign-bebeplay': { title: 'แคมเปญ Bebeplay', sub: '', render: () => renderCampaign('bebeplay') },
    'campaign-hosttail': { title: 'แคมเปญ Hosttail', sub: '', render: () => renderCampaign('hosttail') },
    dnc: { title: 'ถังไม่สะดวกให้โทร', sub: 'เห็นเฉพาะหัวหน้า', render: renderDnc },
    dashboard: { title: 'Dashboard', sub: 'ภาพรวมทีม Direct Sale', render: renderDashboard },
    setup: { title: 'ตั้งค่า', sub: '', render: renderSetup },
  };
  function route() {
    state.campaigns.filter(c => c.claimMode === 'auto').forEach(c => applyAuto(c.id, true)); // แคมเปญแบบ auto เด้งเข้าถังเซลล์ทันทีที่มีข้อมูล
    const name = (location.hash || '#leads').slice(1);
    if ((name === 'dnc' || name === 'setup') && !isAdmin()) { location.hash = '#leads'; return; } // หลังบ้านเฉพาะหัวหน้า
    $('#nav-dnc').hidden = !isAdmin(); $('#nav-setup').hidden = !isAdmin(); $('#nav-tool').hidden = !isAdmin();
    const r = routes[name] || routes.leads;
    $('#page-title').textContent = r.title;
    $('#page-sub').textContent = r.sub;
    document.querySelectorAll('.nav-item').forEach(a => a.classList.toggle('active', a.dataset.route === (routes[name] ? name : 'leads')));
    $('#topbar-actions').innerHTML = '';
    r.render();
    closeMenu();
    updateBadges();
  }
  function updateBadges() {
    const mine = (l) => l.owner === state.meId;
    const open = (l) => l.status === 'new' || l.status === 'callback';
    const set = (id, n) => { const b = $(id); b.textContent = n || ''; };
    set('#badge-dnc', state.leads.filter(l => l.noCall).length);
    set('#badge-leads', state.leads.filter(l => mine(l) && open(l)).length);
    ['bebeplay', 'hosttail'].forEach(b => {
      const n = state.leads.filter(l => l.brand === b && l.source === 'campaign' && l.status === 'new' && !l.owner).length;
      set('#badge-' + b, n); $('#badge-' + b).classList.add('soft');
    });
  }
  const openMenu = () => { $('#sidebar').classList.add('open'); $('#scrim').classList.add('open'); };
  const closeMenu = () => { $('#sidebar').classList.remove('open'); $('#scrim').classList.remove('open'); };

  /* ---------- lead table ---------- */
  function filtered(base) {
    const q = ui.q.trim().toLowerCase();
    const out = base.filter(l => {
      if (!periodOk(l)) return false;
      if (ui.status === 'today') { if (l.callback !== today) return false; }
      else if (ui.status === 'overdue') { if (!(l.callback && l.callback < today)) return false; }
      else if (ui.status === 'nocall') { if (!l.noCall) return false; }
      else if (ui.status !== 'all' && l.status !== ui.status) return false;
      if (ui.rep === 'me' && l.owner !== state.meId) return false;
      if (ui.camp !== 'all' && (ui.camp === 'self' ? l.source !== 'self' : l.campaignId !== ui.camp)) return false;
      if (!q) return true;
      return l.name.toLowerCase().includes(q) || l.phone.includes(q.replace(/-/g, '')) ||
        bills(l).some(b => b.includes(q)) || l.shop.toLowerCase().includes(q);
    });
    return sortLeads(out);
  }
  function sortLeads(a) {
    if (ui.sort === 'due') return [...a].sort((x, y) => (x.callback || '9999').localeCompare(y.callback || '9999')); // วันนัดใกล้สุดก่อน ไม่มีนัดไว้ท้าย
    if (ui.sort === 'spend') return [...a].sort((x, y) => total(y) - total(x));
    return a;
  }
  function dueHtml(l) {
    if (!l.callback) return '';
    const cls = l.callback < today ? 'overdue' : l.callback === today ? 'today' : '';
    const lbl = l.callback < today ? 'เลยนัด ' : l.callback === today ? 'นัดวันนี้ ' : 'นัดติดต่อ ';
    return `<div class="due ${cls}">${lbl}${fmtDate(l.callback)}</div>`;
  }
  function leadRows(list, opts = {}) {
    if (!list.length) return `<tr><td colspan="9" class="empty">ไม่พบรายการที่ตรงกับตัวกรอง</td></tr>`;
    return list.map(l => {
      const o = rep(l.owner);
      const claim = claimCell(l, opts.perCamp ? { ...opts, mode: camp(l.campaignId)?.claimMode || 'self' } : opts);
      return `<tr>
        <td><button class="cust-name" data-act="open" data-id="${l.id}">${esc(l.name)}</button>
          <div class="sub mono">${esc(l.phone)}</div></td>
        <td><div class="bills">${bills(l).map(b => `<span class="bill">${b}</span>`).join('')}</div></td>
        <td>${esc(l.shop)}</td>
        <td>${l.source === 'self' ? '<span class="tag self">เซลล์ขุดเอง</span>' : `<span class="camp-cell">${esc(camp(l.campaignId)?.name || '—')}</span>`}</td>
        <td>${o ? `<span class="rep-name">${esc(o.name)}</span>` : '<span class="sub">ยังไม่มีผู้ดูแล</span>'}${lastSeller(l) ? `<div class="sub">ขายล่าสุด: ${esc(rep(lastSeller(l))?.name || '')}</div>` : ''}</td>
        <td class="r num">${baht(total(l))}</td>
        <td><span class="badge s-${l.status}">${STATUS[l.status]}</span>${dueHtml(l)}${l.noCall ? '<div><span class="tag nocall">ห้ามโทร · แชตเท่านั้น</span></div>' : ''}${isAdmin() && l.releasedBy?.length && !l.owner ? `<div class="sub">คัดออกโดย ${esc(l.releasedBy.map(id => rep(id)?.name || '').join(', '))}</div>` : ''}</td>
        <td class="note-cell">${noteCell(l)}</td>
        <td><div class="actions">
          <button class="btn sm primary" data-act="log" data-type="${l.noCall ? 'chat' : 'call'}" data-id="${l.id}">${l.noCall ? 'บันทึกแชต' : 'บันทึก'}</button>${claim}${unclaimBtn(l)}
        </div></td></tr>`;
    }).join('');
  }
  function tableHtml(list, opts) {
    return `<div class="card table-wrap"><table>
      <thead><tr><th>ชื่อ / เบอร์</th><th>เลขบิลที่เคยซื้อ</th><th>ร้านค้า</th><th>แคมเปญ</th><th>พนักงานขาย</th><th class="r">ยอดซื้อรวม</th><th>สถานะ</th><th>บันทึกล่าสุด</th><th>ปุ่มดำเนินการ</th></tr></thead>
      <tbody>${leadRows(list, opts)}</tbody></table></div>`;
  }
  const SEARCH_SVG = '<svg viewBox="0 0 24 24"><path d="M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 14 15.5l.3.3v.8l5 5 1.5-1.5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z"/></svg>';

  function toolbar(base, withCampSelect) {
    const match = (l, s) => s === 'all' ? true : s === 'today' ? l.callback === today : s === 'overdue' ? !!(l.callback && l.callback < today) : s === 'nocall' ? !!l.noCall : l.status === s;
    const count = (s) => base.filter(l => periodOk(l) && match(l, s)).length;
    const EXTRA = { overdue: 'เลยนัด', today: 'นัดวันนี้', nocall: 'ไม่สะดวกให้โทร' };
    const dots = { new: 'var(--grey)', following: 'var(--info)', callback: 'var(--warn)', won: 'var(--ok)', lost: 'var(--bad)', unreachable: 'var(--violet)', overdue: 'var(--bad)', today: 'var(--warn)', nocall: 'var(--bad)' };
    const chips = ['all', 'overdue', 'today', 'new', 'following', 'callback', 'won', 'unreachable', 'lost', 'nocall'].map(s =>
      `<button class="chip ${ui.status === s ? 'active' : ''}" data-chip="${s}">${s === 'all' ? '' : `<i class="dot" style="background:${dots[s]}"></i>`}${s === 'all' ? 'ทั้งหมด' : (EXTRA[s] || STATUS[s])} (${count(s)})</button>`).join('');
    const campOpts = `<option value="all">แคมเปญทั้งหมด</option><option value="self" ${ui.camp === 'self' ? 'selected' : ''}>เซลล์ขุดเอง</option>` +
      state.campaigns.map(c => `<option value="${c.id}" ${ui.camp === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
    return `<div class="toolbar">
      <label class="search" for="q">${SEARCH_SVG}<input id="q" type="search" placeholder="ค้นหา ชื่อ, เบอร์, เลขบิล, ร้านค้า" value="${esc(ui.q)}"></label>
      ${chips}
      ${withCampSelect ? `<select id="camp-sel" class="select" aria-label="แคมเปญ">${campOpts}</select>` : ''}
      <select id="sort-sel" class="select" aria-label="เรียงตาม"><option value="due" ${ui.sort === 'due' ? 'selected' : ''}>เรียง: วันนัดใกล้สุด</option><option value="spend" ${ui.sort === 'spend' ? 'selected' : ''}>เรียง: ยอดซื้อสูงสุด</option><option value="none" ${ui.sort === 'none' ? 'selected' : ''}>เรียง: ตามเดิม</option></select>
      ${isAdmin() ? `<select id="rep-sel" class="select" aria-label="ผู้ดูแล"><option value="all">ทุกคน</option><option value="me" ${ui.rep === 'me' ? 'selected' : ''}>ของฉัน</option></select>` : ''}
    </div>`;
  }
  function bindToolbar(redraw) {
    bindPeriod(redraw);
    const q = $('#q'); if (q) q.addEventListener('input', () => { ui.q = q.value; redraw(true); });
    document.querySelectorAll('[data-chip]').forEach(b => b.onclick = () => { ui.status = b.dataset.chip; redraw(); });
    const cs = $('#camp-sel'); if (cs) cs.onchange = () => { ui.camp = cs.value; redraw(); };
    const ss = $('#sort-sel'); if (ss) ss.onchange = () => { ui.sort = ss.value; redraw(); };
    const rs = $('#rep-sel'); if (rs) rs.onchange = () => { ui.rep = rs.value; redraw(); };
  }

  function renderLeads() {
    $('#topbar-actions').innerHTML = `<button class="btn primary" id="add-lead">+ เพิ่มลูกค้า (ขุดเอง)</button>`;
    $('#add-lead').onclick = () => leadForm();
    const draw = (keepFocus) => {
      const base = state.leads.filter(mineOrAll);
      const list = filtered(base);
      $('#view').innerHTML = `<div class="demo-note">ข้อมูลทั้งหมดเป็นตัวอย่างสำหรับ Preview — กดบันทึกได้จริง ข้อมูลเก็บในเบราว์เซอร์นี้เท่านั้น</div>${periodHtml()}${toolbar(base, true)}${tableHtml(list)}`;
      bindToolbar(draw);
      if (keepFocus) { const q = $('#q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
    };
    draw();
  }

  function renderCampaign(brand) {
    const cs = state.campaigns.filter(c => c.brand === brand);
    if (!ui.selCamp || (ui.selCamp !== 'ALL' && ui.selCamp !== 'CAMPS' && camp(ui.selCamp)?.brand !== brand)) ui.selCamp = 'ALL';
    $('#page-sub').textContent = `${cs.length} แคมเปญ`;
    ui.pool.loaded = false; // โหลดถังใหม่ทุกครั้งที่เข้าหน้า/เปลี่ยนผู้ใช้ เพื่อไม่ให้เห็นรายชื่อที่คนอื่นจองไปแล้ว
    if (ui.pool.brand !== brand) Object.assign(ui.pool, { brand, loaded: false, page: 0, q: '', total: null, rows: [], grand: null, grandFor: null }); // ถังเป็นของแบรนด์ที่เปิดอยู่เท่านั้น
    if (isAdmin()) { $('#topbar-actions').innerHTML = `<button class="btn" id="auto-run">จัดสรรให้เซลล์ที่ขายล่าสุด</button><button class="btn primary" id="new-camp">+ สร้างแคมเปญ</button>`; $('#new-camp').onclick = () => campaignForm(brand); $('#auto-run').onclick = () => { const n = applyAuto(ui.selCamp); if (!n) toast('ไม่มีลีดที่ต้องจัดสรร'); route(); }; }
    const draw = (keepFocus) => {
      const isAll = ui.selCamp === 'ALL', isCamps = ui.selCamp === 'CAMPS';
      if (!ui.pool.loaded && !ui.pool.loading) poolLoad(draw);
      const mode = camp(ui.selCamp)?.claimMode || 'self';
      if (mode === 'auto') applyAuto(ui.selCamp, true);
      const campIds = new Set(cs.map(c => c.id));
      const base = state.leads.filter(l => (isCamps ? campIds.has(l.campaignId) : l.campaignId === ui.selCamp) && visible(l));
      const list = filtered(base);
      const cards = cs.map(c => {
        const ls = state.leads.filter(l => l.campaignId === c.id && visible(l));
        const done = ls.filter(l => l.status !== 'new').length;
        const won = ls.filter(l => l.status === 'won').length;
        const active = c.active !== false && (!c.end || c.end >= today);
        return `<button class="camp ${c.id === ui.selCamp ? 'active' : ''}" data-camp="${c.id}">
          <div class="camp-top"><span class="camp-name">${esc(c.name)}</span>
            <span class="badge ${active ? 's-won' : 's-new'}">${active ? 'กำลังดำเนินการ' : (c.active === false ? 'ปิดอยู่' : 'จบแล้ว')}</span></div>
          <div class="camp-meta">${fmtDate(c.start)} – ${fmtDate(c.end)}</div>
          <div class="camp-meta">${esc(c.note)}</div>
          <div class="bar"><i style="width:${ls.length ? Math.round(done / ls.length * 100) : 0}%"></i></div>
          <div class="camp-stats"><span>ติดต่อแล้ว ${done}/${ls.length}</span><span>ปิดการขาย ${won}</span></div></button>`;
      }).join('') || `<div class="empty">ยังไม่มีแคมเปญ${isAdmin() ? ' — กด "+ สร้างแคมเปญ" ด้านบน' : ''}</div>`;
      const mineN = base.filter(l => l.owner === state.meId).length;
      $('#view').innerHTML = `<div class="camp-grid">${poolCard()}${campsCard()}${cards}</div>
        ${periodHtml()}
        ${isAll ? poolPanel() : `<div class="quota card" style="padding:10px 14px">ลีดในแคมเปญนี้ <b>${base.length}</b> รายการ · ที่ฉันดูแล <b>${mineN}</b> · ยังไม่มีผู้ดูแล <b>${base.filter(l => !l.owner).length}</b> · วิธีจอง: <b>${isCamps ? 'ตามที่ตั้งไว้ในแต่ละแคมเปญ' : MODES[mode]}</b></div>
        ${toolbar(base, false)}${tableHtml(list, { mode, perCamp: isCamps })}`}`;
      document.querySelectorAll('[data-camp]').forEach(b => b.onclick = () => { ui.selCamp = b.dataset.camp; ui.status = 'all'; draw(); });
      bindToolbar(draw); if (isAll) bindPool(draw);
      if (keepFocus) { const q = $(isAll ? '#pool-q' : '#q'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }
    };
    draw();
  }

  /* ---------- dashboard ---------- */
  function renderDashboard() {
    const A = state.leads.filter(mineOrAll);
    const L = ui.dashBrand === 'all' ? A : A.filter(l => l.brand === ui.dashBrand);
    const stat = (arr) => {
      const w = arr.filter(wonIn);
      return { n: arr.length, c: arr.filter(contactedIn).length, w: w.length,
        val: w.reduce((s, l) => s + (l.closedAmount ?? l.purchases[0]?.amount ?? 0), 0),
        due: arr.filter(l => l.callback && l.callback < today).length, wait: arr.filter(l => l.status === 'callback').length };
    };
    const s = stat(L), pct = (a, b) => b ? Math.round(a / b * 100) : 0;
    const kpi = (label, val, foot) => `<div class="kpi"><div class="kpi-label">${label}</div><div class="kpi-value">${val}</div><div class="kpi-foot">${foot}</div></div>`;
    const scope = ui.dashBrand === 'all' ? 'ทุกแบรนด์' : BRAND[ui.dashBrand];
    const maxN = Math.max(1, ...state.reps.map(r => L.filter(l => l.owner === r.id).length));
    const repRows = state.reps.map(r => {
      const mine = L.filter(l => l.owner === r.id), w = mine.filter(wonIn).length, c = mine.filter(contactedIn).length;
      return `<div class="rep-row"><div>${esc(r.name)}</div>
        <div class="rep-bars"><div class="bar"><i style="width:${mine.length / maxN * 100}%"></i></div><div class="bar won"><i style="width:${mine.length ? w / maxN * 100 : 0}%"></i></div></div>
        <div class="sub num" style="text-align:right">${c}/${mine.length} · ปิด ${w}</div></div>`;
    }).join('');
    const feed = L.flatMap(l => l.interactions.filter(i => !hasPeriod() || inPeriod(i.date)).map(i => ({ ...i, lead: l }))).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8)
      .map(i => `<li><span class="feed-ic ${i.type}"><svg viewBox="0 0 24 24"><path d="${i.type === 'call' ? 'M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z' : 'M4 4h16v12H7l-3 3z'}"/></svg></span>
        <div class="feed-body"><b>${esc(i.lead.name)}</b> <span class="sub">· ${esc(rep(i.rep)?.name || '')} · ${fmtDT(i.date)}</span><div>${esc(i.note)}</div></div></li>`).join('') || '<li class="empty">ยังไม่มีการบันทึก</li>';
    const brandChips = [['all', 'ทุกแบรนด์', A.length], ['bebeplay', 'Bebeplay', A.filter(l => l.brand === 'bebeplay').length], ['hosttail', 'Hosttail', A.filter(l => l.brand === 'hosttail').length]]
      .map(([k, t, n]) => `<button class="chip ${ui.dashBrand === k ? 'active' : ''}" data-brand="${k}">${k === 'all' ? '' : `<i class="dot" style="background:var(--${k === 'bebeplay' ? 'bebe' : 'host'})"></i>`}${t} (${n})</button>`).join('');
    const brandRow = (k, t) => { const x = stat(A.filter(l => l.brand === k)); return `<tr class="${ui.dashBrand === k ? 'sel' : ''}"><td><span class="tag ${k === 'bebeplay' ? 'bebe' : 'host'}">${t}</span></td>
      <td class="r num">${x.n}</td><td class="r num">${x.c} <span class="sub">(${pct(x.c, x.n)}%)</span></td><td class="r num">${x.wait}</td><td class="r num">${x.due}</td><td class="r num">${x.w} <span class="sub">(${pct(x.w, x.c)}%)</span></td><td class="r num">${baht(x.val)}</td></tr>`; };
    const all = stat(A);
    const TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const mLabel = (k) => k === 'none' ? 'ไม่ระบุวันที่' : `${TH[+k.slice(5, 7) - 1]} ${k.slice(0, 4)}`;
    const wonLeads = L.filter(wonIn).filter(l => l.owner);
    const mkey = (l) => l.closedAt ? l.closedAt.slice(0, 7) : 'none';
    const months = [...new Set(wonLeads.map(mkey))].sort();
    const rate = Number(state.commissionRate) || 0;
    const commRows = state.reps.map(r => {
      const mine = wonLeads.filter(l => l.owner === r.id);
      const byM = months.map(m => mine.filter(l => mkey(l) === m).reduce((s, l) => s + (l.closedAmount ?? 0), 0));
      const sum = byM.reduce((a, b) => a + b, 0);
      return { name: r.name, byM, sum, bills: mine.reduce((s, l) => s + l.closedBills.length, 0), cnt: mine.length, comm: sum * rate / 100 };
    }).filter(r => r.cnt);
    const colSum = months.map((_, i) => commRows.reduce((s, r) => s + r.byM[i], 0)), grand = colSum.reduce((a, b) => a + b, 0);
    const commTable = commRows.length ? `<div class="table-wrap"><table><thead><tr><th>เซลล์</th>${months.map(m => `<th class="r">${mLabel(m)}</th>`).join('')}<th class="r">ยอดรวม</th><th class="r">จำนวนบิล</th><th class="r">ค่าคอม${rate ? ` (${rate}%)` : ''}</th></tr></thead><tbody>${commRows.map(r => `<tr><td>${esc(r.name)}</td>${r.byM.map(v => `<td class="r num">${v ? baht(v) : '—'}</td>`).join('')}<td class="r num"><b>${baht(r.sum)}</b></td><td class="r num">${r.bills}</td><td class="r num">${rate ? baht(Math.round(r.comm)) : '—'}</td></tr>`).join('')}<tr class="total"><td><b>รวม</b></td>${colSum.map(v => `<td class="r num">${baht(v)}</td>`).join('')}<td class="r num"><b>${baht(grand)}</b></td><td class="r num">${commRows.reduce((s, r) => s + r.bills, 0)}</td><td class="r num">${rate ? baht(Math.round(grand * rate / 100)) : '—'}</td></tr></tbody></table></div>` : '<div class="empty">ไม่มียอดที่ปิดได้ในช่วงนี้</div>';
    $('#view').innerHTML = `${periodHtml()}<div class="toolbar">${brandChips}</div><div class="kpis">
      ${kpi('ลีดทั้งหมด', s.n, scope)}
      ${kpi('ติดต่อแล้ว', s.c + ' <span class="sub">/ ' + s.n + '</span>', pct(s.c, s.n) + '% ของลีด · ' + scope)}
      ${kpi('ปิดการขาย', s.w, 'อัตราปิด ' + pct(s.w, s.c) + '% ของที่ติดต่อแล้ว')}
      ${kpi('ยอดที่ปิดได้', baht(s.val), 'จากยอดที่เซลล์บันทึกตอนปิดการขาย')}
      ${kpi('นัดติดต่อเลยกำหนด', s.due, s.due ? 'ควรติดตามวันนี้' : 'ไม่มีค้าง')}</div>
      <div class="panel"><div class="panel-h"><h2>เปรียบเทียบแยกแบรนด์</h2></div>
        <div class="table-wrap"><table><thead><tr><th>แบรนด์</th><th class="r">ลีด</th><th class="r">ติดต่อแล้ว</th><th class="r">รอติดต่อ</th><th class="r">เลยนัด</th><th class="r">ปิดการขาย</th><th class="r">ยอดที่ปิดได้</th></tr></thead>
        <tbody>${brandRow('bebeplay', 'Bebeplay')}${brandRow('hosttail', 'Hosttail')}
        <tr class="total"><td><b>รวม</b></td><td class="r num">${all.n}</td><td class="r num">${all.c} <span class="sub">(${pct(all.c, all.n)}%)</span></td><td class="r num">${all.wait}</td><td class="r num">${all.due}</td><td class="r num">${all.w} <span class="sub">(${pct(all.w, all.c)}%)</span></td><td class="r num">${baht(all.val)}</td></tr></tbody></table></div></div>
      <div class="panel"><div class="panel-h"><h2>ยอดที่ปิดได้รายเดือนต่อเซลล์ (สำหรับคิดค่าคอม) · ${scope}</h2>
        <div class="toolbar"><label class="sub" for="comm-rate">อัตราค่าคอม (%)</label><input class="input pin" id="comm-rate" type="number" min="0" step="0.1" value="${rate || ''}" placeholder="เช่น 3" style="width:90px"><button class="btn sm" id="comm-copy">คัดลอกตาราง</button></div></div>${commTable}</div>
      <div class="grid-2">
        <div class="panel"><div class="panel-h"><h2>ผลงานรายเซลล์ · ${scope}</h2><div class="legend"><span><i style="background:var(--accent)"></i>ลีดที่ดูแล</span><span><i style="background:var(--ok)"></i>ปิดการขาย</span></div></div><div class="panel-b">${repRows}</div></div>
        <div class="panel"><div class="panel-h"><h2>กิจกรรมล่าสุด · ${scope}</h2></div><div class="panel-b"><ul class="feed">${feed}</ul></div></div>
      </div>`;
    document.querySelectorAll('[data-brand]').forEach(btn => btn.onclick = () => { ui.dashBrand = btn.dataset.brand; renderDashboard(); });
    bindPeriod(renderDashboard);
    $('#comm-rate').onchange = (e) => { state.commissionRate = Number(e.target.value) || 0; save(); renderDashboard(); };
    $('#comm-copy').onclick = () => {
      const rows = [['เซลล์', ...months.map(mLabel), 'ยอดรวม', 'จำนวนบิล', 'ค่าคอม'], ...commRows.map(r => [r.name, ...r.byM, r.sum, r.bills, rate ? Math.round(r.comm) : ''])];
      const tsv = rows.map(r => r.join('\t')).join('\n');
      navigator.clipboard?.writeText(tsv).then(() => toast('คัดลอกตารางแล้ว วางใน Excel ได้เลย'), () => toast('คัดลอกไม่สำเร็จ'));
    };
  }

  /* ---------- ถังไม่สะดวกให้โทร (หัวหน้า) ---------- */
  function renderDnc() {
    const all = state.leads.filter(l => l.noCall);
    ui.dncRep = ui.dncRep || 'all';
    const L = ui.dncRep === 'all' ? all : all.filter(l => l.noCallBy === ui.dncRep);
    const byRep = [...new Set(all.map(l => l.noCallBy))].map(id => [id, all.filter(l => l.noCallBy === id).length]);
    const rows = L.map(l => {
      const why = [...l.interactions].reverse().find(i => i.result === 'ไม่สะดวกให้โทร') || l.interactions[l.interactions.length - 1];
      return `<tr><td><button class="cust-name" data-act="open" data-id="${l.id}">${esc(l.name)}</button><div class="sub mono">${esc(l.phone)}</div></td>
        <td><span class="tag ${l.brand === 'bebeplay' ? 'bebe' : 'host'}">${BRAND[l.brand]}</span></td>
        <td>${l.source === 'self' ? '<span class="tag self">เซลล์ขุดเอง</span>' : esc(camp(l.campaignId)?.name || '—')}</td>
        <td>${esc(rep(l.noCallBy)?.name || '—')}</td><td>${l.noCallAt ? fmtDate(l.noCallAt) : '—'}</td><td><span class="badge s-${l.status}">${STATUS[l.status] || '—'}</span></td>
        <td class="note-cell">${esc(why?.note || '—')}</td><td class="r num">${baht(total(l))}</td>
        <td><button class="btn sm" data-act="dnc-restore" data-id="${l.id}">ยกเลิกห้ามโทร</button></td></tr>`;
    }).join('');
    $('#view').innerHTML = `<div class="demo-note">ลูกค้าที่ไม่สะดวกให้โทร: ห้ามโทรถาวร เซลล์ที่แจ้งติดต่อได้ทางแชตเท่านั้นและเห็นลูกค้าในหน้า Direct Sale ของตัวเอง เซลล์คนอื่นไม่เห็น ("ยกเลิกห้ามโทร" ใช้เมื่อกดผิด)</div>
      <div class="toolbar"><label class="sub" for="dnc-rep">พนักงานขายที่แจ้ง</label><select class="select" id="dnc-rep"><option value="all">ทุกคน (${all.length})</option>${byRep.map(([id, n]) => `<option value="${esc(id)}" ${ui.dncRep === id ? 'selected' : ''}>${esc(rep(id)?.name || id)} (${n})</option>`).join('')}</select></div>
      <div class="card table-wrap"><table><thead><tr><th>ชื่อ / เบอร์</th><th>แบรนด์</th><th>แคมเปญ</th><th>พนักงานขายที่แจ้ง</th><th>วันที่</th><th>สถานะตอนนี้</th><th>เหตุผล</th><th class="r">ยอดซื้อรวม</th><th></th></tr></thead>
      <tbody>${rows || '<tr><td colspan="9" class="empty">ยังไม่มีลูกค้าในถังนี้</td></tr>'}</tbody></table></div>`;
    $('#dnc-rep').onchange = (e) => { ui.dncRep = e.target.value; renderDnc(); };
  }

  /* ---------- setup ---------- */
  function renderSetup() {
    $('#view').innerHTML = `<div class="settings">
      <div class="panel"><div class="panel-h"><h2>ทีมเซลล์</h2></div><div class="panel-b">
        ${state.reps.map(r => `<div class="list-row"><div><b>${esc(r.name)}</b></div><span class="tag">${r.role === 'admin' ? 'หัวหน้า' : 'เซลล์'}</span><span class="sub">${state.leads.filter(l => l.owner === r.id).length} ลีด</span></div>`).join('')}
        <form class="inline-form" id="rep-form"><input class="input" id="rep-name" placeholder="ชื่อเซลล์ใหม่" required><select class="select" id="rep-role"><option value="sales">เซลล์</option><option value="admin">หัวหน้า</option></select><button class="btn primary">เพิ่ม</button></form></div></div>
      <div class="panel"><div class="panel-h"><h2>แคมเปญ</h2></div><div class="panel-b">
        ${state.campaigns.map(c => `<div class="list-row"><div><b>${esc(c.name)}</b><div class="sub">${fmtDate(c.start)} – ${fmtDate(c.end)}</div></div><span class="tag ${c.brand === 'bebeplay' ? 'bebe' : 'host'}">${BRAND[c.brand]}</span><select class="select" data-claimmode="${c.id}" aria-label="วิธีจองลีด">${Object.entries(MODES).map(([k, v]) => `<option value="${k}" ${(c.claimMode || 'self') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>`).join('')}
        <p class="help" style="margin-top:10px">สร้างแคมเปญใหม่ได้ที่เมนู แคมเปญ → Bebeplay / Hosttail (เฉพาะหัวหน้า)</p></div></div>
      <div class="panel"><div class="panel-h"><h2>ข้อมูลตัวอย่าง</h2></div><div class="panel-b">
        <p class="help">ล้างสิ่งที่บันทึกไว้ในเบราว์เซอร์นี้ แล้วกลับไปใช้ข้อมูลตัวอย่างตั้งต้น</p><br><button class="btn danger" id="reset">รีเซ็ตข้อมูลตัวอย่าง</button></div></div></div>`;
    $('#rep-form').onsubmit = (e) => { e.preventDefault(); const n = $('#rep-name').value.trim(); if (!n) return;
      state.reps.push({ id: 'r' + Date.now(), name: n, initials: n.slice(0, 2), role: $('#rep-role').value }); save(); fillMe(); renderSetup(); toast('เพิ่มเซลล์แล้ว'); };
    $('#reset').onclick = () => { try { localStorage.removeItem(KEY); } catch (e) {} location.reload(); };
  }

  /* ---------- modals ---------- */
  function openModal(html, cls = '') {
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal ${cls}" role="dialog" aria-modal="true">${html}</div>`;
    root.hidden = false;
    root.onmousedown = (e) => { if (e.target === root) closeModal(); };
    const f = root.querySelector('input,select,textarea,button.btn'); if (f) f.focus();
  }
  function closeModal() { const r = $('#modal-root'); r.hidden = true; r.innerHTML = ''; }
  const X = '<button class="icon-btn" data-close aria-label="ปิด"><svg viewBox="0 0 24 24"><path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7l1.4-1.4 6.3 6.3 6.3-6.3z"/></svg></button>';

  function customerModal(id, tab = 'buy') {
    const l = lead(id); if (!l) return;
    const lastBuy = l.purchases[0]?.date;
    const buyRows = l.purchases.map(p => `<tr><td>${fmtDate(p.date)}</td><td class="mono">${esc(p.sku)}</td><td>${esc(p.product)}<div class="sub">บิล ${esc(p.bill)} · ขายโดย ${esc(rep(p.seller)?.name || '—')}</div></td><td class="r num">${baht(p.amount)}</td></tr>`).join('');
    const hist = [...l.interactions].sort((a, b) => b.date.localeCompare(a.date)).map(i => `<li>
      <span class="feed-ic ${i.type}"><svg viewBox="0 0 24 24"><path d="${i.type === 'call' ? 'M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z' : 'M4 4h16v12H7l-3 3z'}"/></svg></span>
      <div style="flex:1;min-width:0"><div class="tl-head"><b>${i.type === 'call' ? 'โทร' : 'แชต'}</b><span class="sub">${fmtDT(i.date)} · ${esc(rep(i.rep)?.name || '')}</span><span class="tag">${esc(i.result)}</span>${i.due ? `<span class="tag s-callback">นัดติดต่อ ${fmtDate(i.due)}</span>` : ''}</div><div class="tl-note">${esc(i.note)}</div></div></li>`).join('');
    openModal(`
      <div class="modal-h"><h3>${esc(l.name)}</h3><span class="badge s-${l.status}">${STATUS[l.status]}</span>
        <span class="tag ${l.brand === 'bebeplay' ? 'bebe' : 'host'}">${BRAND[l.brand]}</span>${X}</div>
      <div class="modal-b">
        <dl class="info-grid" style="margin:0">
          <div><dt>ชื่อ</dt><dd>${esc(l.name)}</dd></div>
          <div><dt>เบอร์</dt><dd class="mono">${esc(l.phone)} <button class="copy" data-copy="${esc(l.phone)}">คัดลอก</button></dd></div>
          <div class="wide"><dt>ที่อยู่</dt><dd>${esc(l.address)}</dd></div>
          <div><dt>วันที่ซื้อล่าสุด</dt><dd>${fmtDate(lastBuy)}</dd></div>
          <div><dt>ยอดซื้อรวม</dt><dd class="num">${baht(total(l))}</dd></div>
          <div><dt>ร้านค้า</dt><dd>${esc(l.shop)}</dd></div>
          <div><dt>ผู้ดูแล</dt><dd>${esc(rep(l.owner)?.name || '—')}</dd></div>
          <div><dt>สินค้าที่สนใจ</dt><dd>${esc(l.interest || '—')}</dd></div>
          <div><dt>เลขบิลที่ปิดได้</dt><dd class="mono">${l.closedBills?.length ? esc(l.closedBills.join(', ')) : '—'}</dd></div>
          <div><dt>วันที่ปิดการขาย</dt><dd>${l.closedAt ? fmtDate(l.closedAt) : '—'}</dd></div></dl>
        <div class="tabs" role="tablist"><button class="tab ${tab === 'buy' ? 'active' : ''}" data-tab="buy">ประวัติการซื้อ (${l.purchases.length})</button>
          <button class="tab ${tab === 'talk' ? 'active' : ''}" data-tab="talk">ประวัติการโทร/แชต (${l.interactions.length})</button></div>
        ${tab === 'buy'
          ? `<div class="mini-table table-wrap"><table><thead><tr><th>วัน/เดือน/ปี</th><th>SKU</th><th>ชื่อสินค้า</th><th class="r">ยอดซื้อ</th></tr></thead><tbody>${buyRows}</tbody></table></div>`
          : (hist ? `<ul class="timeline">${hist}</ul>` : '<div class="empty">ยังไม่เคยติดต่อลูกค้ารายนี้</div>')}
      </div>
      <div class="modal-f"><button class="btn primary" data-log="${l.noCall ? 'chat' : 'call'}">${l.noCall ? 'บันทึกแชต' : 'บันทึก'}</button></div>`);
    const m = $('.modal');
    m.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => customerModal(id, b.dataset.tab));
    m.querySelectorAll('[data-log]').forEach(b => b.onclick = () => logModal(id, b.dataset.log));
    m.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => {
      navigator.clipboard?.writeText(b.dataset.copy).then(() => toast('คัดลอกเบอร์แล้ว'), () => toast(b.dataset.copy));
    });
  }

  function logModal(id, type) {
    const l = lead(id); if (!l) return;
    const prevStatus = l.status;
    if (l.noCall) type = 'chat'; // ห้ามโทร: ติดต่อและบันทึกได้ทางแชตเท่านั้น
    const RES = { call: ['คุยแล้ว', 'ไม่รับสาย', 'สายไม่ว่าง', 'เบอร์ผิด'], chat: ['ตอบกลับแล้ว', 'อ่านแล้วไม่ตอบ', 'ส่งโปรโมชันแล้ว'] };
    openModal(`
      <div class="modal-h"><h3>บันทึก · ${esc(l.name)}</h3>${X}</div>
      <form id="log-form" novalidate><div class="modal-b">
        ${l.noCall ? '<div class="warn">ลูกค้ารายนี้ไม่สะดวกให้โทร ติดต่อได้ทางแชตเท่านั้น</div>' : ''}
        <div class="field"><label>ช่องทาง</label><div class="seg" id="seg"><button type="button" data-t="call" class="${type === 'call' ? 'active' : ''}" ${l.noCall ? 'disabled title="ลูกค้ารายนี้ห้ามโทร ติดต่อทางแชตเท่านั้น"' : ''}>โทร</button><button type="button" data-t="chat" class="${type === 'chat' ? 'active' : ''}">แชต</button></div></div>
        <div class="form-grid">
          <div class="field"><label for="f-res">ผลการติดต่อ</label><select class="select" id="f-res"></select></div>
          <div class="field"><label for="f-status">สถานะลูกค้าหลังบันทึก</label><select class="select" id="f-status">
            ${Object.entries(STATUS).filter(([k]) => k !== 'new').map(([k, v]) => `<option value="${k}" ${k === (l.status === 'new' ? 'following' : l.status) ? 'selected' : ''}>${v}</option>`).join('')}${l.noCall ? '' : '<option value="dnc">ไม่สะดวกให้โทร (ติดต่อทางแชตเท่านั้น)</option><option value="release">คัดออก (คืนให้คนอื่นโทร)</option>'}</select></div>
          <div class="field wide" id="cb-wrap"><label for="f-cb">วันที่นัดติดต่อ <span class="req">*</span></label><input class="input" type="date" id="f-cb" min="${today}" value="${l.callback && l.callback >= today ? l.callback : ''}"></div>
          <div class="field wide"><label for="f-interest">สินค้าที่ลูกค้าสนใจ</label><input class="input" id="f-interest" value="${esc(l.interest || '')}" placeholder="เช่น เตียงนอนเด็ก, ทรายแมว"></div>
          <div class="field wide" id="won-wrap"><label for="f-bills">เลขบิลที่ขายได้ (อ้างอิงตอนผูกข้อมูล คั่นหลายบิลด้วยจุลภาค)</label><input class="input" id="f-bills" value="${esc((l.closedBills || []).join(', '))}" placeholder="เช่น 312345, 312399">
            <label for="f-amount" style="margin-top:8px">ยอดที่ปิดได้ (บาท)</label><input class="input" id="f-amount" type="number" min="0" step="1" value="${l.closedAmount ?? ''}">
            <label for="f-closed" style="margin-top:8px">วันที่ปิดการขาย</label><input class="input" id="f-closed" type="date" value="${l.closedAt || today}"></div>
          <div class="field wide" id="warn-wrap" hidden><div class="warn" id="warn-text"></div></div>
          <div class="field wide"><label for="f-note">หมายเหตุ <span class="req" id="note-req" hidden>* ใส่เหตุผล</span></label><textarea class="textarea" id="f-note" placeholder="สรุปสิ่งที่คุยกับลูกค้า"></textarea></div>
        </div></div>
        <div class="modal-f"><button type="button" class="btn" data-close>ยกเลิก</button><button class="btn primary">บันทึก</button></div></form>`, 'sm');
    let cur = type;
    const fillRes = () => { $('#f-res').innerHTML = RES[cur].map(r => `<option>${r}</option>`).join(''); };
    const WARN = { dnc: 'ลูกค้ารายนี้จะถูกทำเครื่องหมายห้ามโทรถาวร คุณติดต่อได้ทางแชตเท่านั้น (ยังเห็นในหน้า Direct Sale ของคุณ) เซลล์คนอื่นจะไม่เห็นลูกค้ารายนี้ และหัวหน้าเห็นในถังไม่สะดวกให้โทร', release: 'ลูกค้ารายนี้จะออกจากรายการของคุณและกลับเข้าถังให้เซลล์คนอื่นโทร คุณจะไม่เห็นลูกค้ารายนี้อีก' };
    const cbToggle = () => { const v = $('#f-status').value; $('#cb-wrap').hidden = v !== 'callback'; $('#won-wrap').hidden = v !== 'won'; $('#warn-wrap').hidden = !WARN[v]; $('#warn-text').textContent = WARN[v] || ''; $('#note-req').hidden = !WARN[v]; };
    fillRes(); cbToggle();
    $('#f-status').onchange = cbToggle;
    document.querySelectorAll('#seg button').forEach(b => b.onclick = () => {
      cur = b.dataset.t; document.querySelectorAll('#seg button').forEach(x => x.classList.toggle('active', x === b)); fillRes();
    });
    $('#log-form').onsubmit = (e) => {
      e.preventDefault();
      if ($('#f-status').value === 'callback' && !$('#f-cb').value) { toast('เลือกวันที่นัดติดต่อก่อนบันทึก'); $('#f-cb').focus(); return; }
      if ($('#f-status').value === 'callback' && $('#f-cb').value < today) { toast('วันที่นัดติดต่อต้องไม่ย้อนหลัง'); $('#f-cb').focus(); return; }
      const sv = $('#f-status').value;
      if ((sv === 'dnc' || sv === 'release') && !$('#f-note').value.trim()) { toast('ใส่เหตุผลในหมายเหตุก่อนบันทึก'); $('#f-note').focus(); return; }
      const billList = $('#f-bills').value.split(/[,\s]+/).map(x => x.trim()).filter(Boolean);
      if ($('#f-status').value === 'won' && !billList.length) { toast('ใส่เลขบิลที่ขายได้ก่อนปิดการขาย'); $('#f-bills').focus(); return; }
      const now = new Date(); const pad = (n) => String(n).padStart(2, '0');
      l.interactions.push({ id: 'i' + Date.now(), type: cur, date: `${today}T${pad(now.getHours())}:${pad(now.getMinutes())}`, rep: state.meId,
        result: $('#f-res').value, due: $('#f-status').value === 'callback' ? $('#f-cb').value : null, note: $('#f-note').value.trim() || '(ไม่มีหมายเหตุ)' });
      l.status = $('#f-status').value;
      l.interest = $('#f-interest').value.trim();
      if (l.status === 'won') { l.closedBills = billList; l.closedAmount = $('#f-amount').value === '' ? null : Number($('#f-amount').value); l.closedAt = $('#f-closed').value || today; }
      l.callback = l.status === 'callback' ? ($('#f-cb').value || null) : null;
      if (!l.owner) l.owner = state.meId;
      const last = l.interactions[l.interactions.length - 1];
      if (sv === 'dnc') { // ห้ามโทรถาวร: ยังเป็นลูกค้าของเซลล์คนนี้ ติดต่อทางแชตเท่านั้น และหัวหน้าเห็นในถังไม่สะดวกให้โทร
        Object.assign(l, { noCall: true, noCallAt: today, noCallBy: state.meId, status: prevStatus === 'new' ? 'following' : prevStatus, callback: null }); last.result = 'ไม่สะดวกให้โทร';
        save(); closeModal(); route(); return toast('ทำเครื่องหมายห้ามโทรแล้ว ติดต่อลูกค้ารายนี้ทางแชตเท่านั้น');
      }
      if (sv === 'release') { // โทรเท่าไหร่ก็ปิดไม่ได้ -> คืนเข้าถังให้คนอื่น
        Object.assign(l, { status: 'new', callback: null, owner: null, releasedBy: [...new Set([...(l.releasedBy || []), state.meId])] }); last.result = 'คัดออก';
        save(); closeModal(); route(); return toast('คัดออกแล้ว ลูกค้ากลับเข้าถังให้เซลล์คนอื่นโทร');
      }
      save(); closeModal(); route(); toast('บันทึกแล้ว');
    };
  }

  function leadForm() {
    openModal(`
      <div class="modal-h"><h3>เพิ่มลูกค้าที่ขุดเอง</h3>${X}</div>
      <form id="lead-form"><div class="modal-b"><div class="form-grid">
        <div class="field"><label for="n-name">ชื่อ</label><input class="input" id="n-name" required></div>
        <div class="field"><label for="n-phone">เบอร์โทร</label><input class="input" id="n-phone" inputmode="tel" required></div>
        <div class="field"><label for="n-brand">แบรนด์</label><select class="select" id="n-brand"><option value="bebeplay">Bebeplay</option><option value="hosttail">Hosttail</option></select></div>
        <div class="field"><label for="n-shop">ร้านค้า</label><input class="input" id="n-shop" placeholder="เช่น Loo_bebeplay"></div>
        <div class="field wide"><label for="n-addr">ที่อยู่</label><input class="input" id="n-addr"></div>
      </div></div>
      <div class="modal-f"><button type="button" class="btn" data-close>ยกเลิก</button><button class="btn primary">เพิ่ม</button></div></form>`, 'sm');
    $('#lead-form').onsubmit = (e) => {
      e.preventDefault();
      state.leads.unshift({ id: 'L' + Date.now(), name: $('#n-name').value.trim(), phone: $('#n-phone').value.trim(), address: $('#n-addr').value.trim() || '—',
        shop: $('#n-shop').value.trim() || '—', source: 'self', brand: $('#n-brand').value, campaignId: null, owner: state.meId,
        status: 'new', callback: null, purchases: [], interactions: [] });
      save(); closeModal(); route(); toast('เพิ่มลูกค้าแล้ว');
    };
  }



  /* ---------- ถังกลาง "ลูกค้าทั้งหมด" (เหมือนกันทั้งสองแบรนด์) ---------- */
  const PAGE = 50;
  ui.pool = { brand: null, q: '', page: 0, rows: [], total: null, loaded: false, loading: false, err: '', live: false, t: null };
  const takenLead = (c) => state.leads.find(l => l.phone === c.phone && l.owner);
  const takenBy = (c) => state.leads.find(l => l.phone === c.phone && l.owner)?.owner || null;
  const hiddenFromMe = (c) => {
    if (isDnc(c.phone)) return true; // ไม่สะดวกให้โทร: ไม่มีใครเห็นในถัง
    if (state.leads.some(l => l.phone === c.phone && releasedByMe(l))) return true; // คนที่คัดออกแล้วไม่เห็นอีก
    const o = takenBy(c); return !!o && !isAdmin() && o !== state.meId; // จองแล้ว คนอื่นต้องไม่เห็นชื่อ
  };
  const isLive = () => !!(typeof sb !== 'undefined' && sb && authUser);
  async function poolLoad(redraw, keepFocus) {
    const P = ui.pool; P.loading = true; P.err = '';
    try {
      if (isLive() && P.grandFor !== P.brand) { // จำนวนลูกค้าทั้งแบรนด์ (ไม่ขึ้นกับคำค้น/ช่วงวันที่)
        const g = await sb.rpc('dsales_customer_pool_v2', { p_limit: 1, p_offset: 0, p_brand: P.brand || null });
        if (!g.error) { P.grand = g.data.length ? Number(g.data[0].total_count) : 0; P.grandFor = P.brand; }
      }
      if (isLive()) {
        const { data, error } = await sb.rpc('dsales_customer_pool_v2', { p_search: P.q.trim() || null, p_limit: PAGE, p_offset: P.page * PAGE, p_brand: P.brand || null, ...(hasPeriod() ? { p_from: ui.period.from || null, p_to: ui.period.to || null } : {}) });
        if (error) throw error;
        P.live = true; P.total = data.length ? Number(data[0].total_count) : 0;
        P.rows = data.map(r => ({ id: r.identity_id, name: r.name, phone: r.phone, segment: r.rfm_segment || r.segment || '', ltv: r.ltv, orders: r.order_count, last: r.last_order_date, brands: r.brands || [] }));
      } else {
        const q = P.q.trim().toLowerCase(), qd = q.replace(/\D/g, '');
        const all = state.customers.filter(c => (!P.brand || c.brand === P.brand) && !hiddenFromMe(c) && (!q || c.name.toLowerCase().includes(q) || (qd && c.phone.includes(qd))))
          .filter(c => !hasPeriod() || inPeriod(c.purchases[0]?.date)).sort((a, b) => total(b) - total(a));
        P.live = false; P.total = all.length;
        P.rows = all.slice(P.page * PAGE, P.page * PAGE + PAGE).map(c => ({ id: c.id, name: c.name, phone: c.phone, segment: '', ltv: total(c), orders: c.purchases.length, last: c.purchases[0]?.date, brands: [c.brand], taken: takenBy(c), leadId: takenLead(c)?.id, mineReserved: takenLead(c)?.owner === state.meId && !takenLead(c)?.noCall && takenLead(c)?.status !== 'won' }));
      }
      if (!isLive()) { P.grand = state.customers.filter(c => c.brand === P.brand && !hiddenFromMe(c)).length; P.grandFor = P.brand; }
      P.loaded = true;
    } catch (e) { P.err = 'โหลดลูกค้าไม่สำเร็จ: ' + (e.message || e); }
    P.loading = false; redraw(keepFocus);
  }
  const brandCampIds = () => new Set(state.campaigns.filter(c => c.brand === ui.pool.brand).map(c => c.id));
  function inCampLine() { // ลูกค้าในถังที่อยู่ในแคมเปญของแบรนด์นี้แล้ว / ยังไม่เข้า (จับคู่ด้วยเบอร์)
    const ids = brandCampIds(), phones = new Set(state.leads.filter(l => ids.has(l.campaignId)).map(l => l.phone));
    const mine = state.customers.filter(c => c.brand === ui.pool.brand && !hiddenFromMe(c));
    const inC = mine.filter(c => phones.has(c.phone)).length;
    return `เข้าแคมเปญแล้ว ${inC} · ยังไม่เข้า ${mine.length - inC}`;
  }
  function campsCard() {
    const ids = brandCampIds(), ls = state.leads.filter(l => ids.has(l.campaignId) && visible(l));
    const done = ls.filter(l => l.status !== 'new').length, won = ls.filter(l => l.status === 'won').length;
    return `<button class="camp ${ui.selCamp === 'CAMPS' ? 'active' : ''}" data-camp="CAMPS">
      <div class="camp-top"><span class="camp-name">ลูกค้าทุกแคมเปญ</span><span class="badge s-following plain">${ids.size} แคมเปญ</span></div>
      <div class="camp-meta">ลูกค้าที่อยู่ในแคมเปญต่างๆ ของ ${BRAND[ui.pool.brand] || ''} รวมกัน</div>
      <div class="kpi-value num" style="font-size:22px">${ls.length} <span class="sub" style="font-size:13px;font-weight:400">ราย</span></div>
      <div class="bar"><i style="width:${ls.length ? Math.round(done / ls.length * 100) : 0}%"></i></div>
      <div class="camp-stats"><span>ติดต่อแล้ว ${done}/${ls.length}</span><span>ปิดการขาย ${won}</span></div></button>`;
  }
  function poolCard() {
    const P = ui.pool;
    return `<button class="camp all ${ui.selCamp === 'ALL' ? 'active' : ''}" data-camp="ALL">
      <div class="camp-top"><span class="camp-name">ลูกค้าทั้งหมด</span><span class="badge ${P.live ? 's-won' : 's-new'}">${P.live ? 'ข้อมูลจริง' : 'ตัวอย่าง'}</span></div>
      <div class="camp-meta">ลูกค้าทั้งหมดของ ${BRAND[P.brand] || 'ทุกแบรนด์'}</div>
      <div class="kpi-value num" style="font-size:22px">${P.grand == null ? '…' : P.grand.toLocaleString('th-TH')} <span class="sub" style="font-size:13px;font-weight:400">ราย</span></div>
      <div class="camp-stats"><span>${P.live ? 'ทั้งที่เข้าและยังไม่เข้าแคมเปญ' : inCampLine()}</span></div></button>`;
  }
  function poolPanel() {
    const P = ui.pool, from = P.page * PAGE;
    const rows = P.rows.map(r => `<tr><td><button class="cust-name" data-pool-open="${esc(r.id)}">${esc(r.name)}</button><div class="sub mono">${esc(r.phone)}</div></td>
      <td>${poolCampCell(r)}</td>
      <td>${r.segment ? `<span class="tag">${esc(r.segment)}</span>` : '<span class="sub">—</span>'}</td>
      <td class="r num">${r.ltv == null ? '—' : baht(Math.round(r.ltv))}</td><td class="r num">${r.orders ?? '—'}</td>
      <td>${r.last ? fmtDate(r.last) : '—'}</td>
      <td>${r.brands.length ? r.brands.map(b => `<span class="tag ${b === 'bebeplay' ? 'bebe' : b === 'hosttail' ? 'host' : ''}">${esc(BRAND[b] || b)}</span>`).join(' ') : '<span class="sub">—</span>'}</td><td>${poolAction(r)}</td></tr>`).join('');
    return `<div class="toolbar"><label class="search" for="pool-q">${SEARCH_SVG}<input id="pool-q" type="search" placeholder="ค้นหา ชื่อ หรือเบอร์โทร" value="${esc(P.q)}"></label>
        ${P.loading ? '<span class="sub">กำลังโหลด…</span>' : ''}</div>
      ${P.err ? `<div class="login-err">${esc(P.err)}</div>` : ''}
      <div class="card table-wrap"><table><thead><tr><th>ชื่อ / เบอร์</th><th>แคมเปญ</th><th>กลุ่มลูกค้า</th><th class="r">ยอดซื้อสะสม</th><th class="r">ออเดอร์</th><th>ซื้อล่าสุด</th><th>แบรนด์</th><th></th></tr></thead>
        <tbody>${rows || `<tr><td colspan="8" class="empty">${P.loading ? 'กำลังโหลด…' : 'ไม่พบลูกค้าที่ตรงกับคำค้น'}</td></tr>`}</tbody></table></div>
      <div class="toolbar"><button class="btn sm" data-pool="prev" ${P.page === 0 ? 'disabled' : ''}>← ก่อนหน้า</button>
        <span class="sub num">${P.total ? `${(from + 1).toLocaleString('th-TH')}–${(from + P.rows.length).toLocaleString('th-TH')} จาก ${P.total.toLocaleString('th-TH')}` : ''}</span>
        <button class="btn sm" data-pool="next" ${(P.total === null || from + P.rows.length >= P.total) ? 'disabled' : ''}>ถัดไป →</button></div>`;
  }
  function poolCampCell(r) {
    if (isLive()) return '<span class="sub">—</span>';
    const names = state.leads.filter(l => l.phone === r.phone && l.campaignId).map(l => camp(l.campaignId)?.name).filter(Boolean);
    return names.length ? names.map(n => `<div class="camp-cell">${esc(n)}</div>`).join('') : '<span class="sub">ยังไม่เข้าแคมเปญ</span>';
  }
  function poolAction(r) {
    if (isLive()) return '<button class="btn sm outline" disabled title="ยังไม่ได้เชื่อมการจองกับฐานข้อมูลจริง">จอง</button>';
    if (r.taken) return r.taken === state.meId ? (r.mineReserved ? `<button class="btn sm danger" data-act="unclaim" data-id="${esc(r.leadId)}">ยกเลิกจอง</button>` : '<span class="badge s-won plain">จองแล้ว</span>') : `<span class="badge s-new plain">จองโดย ${esc(rep(r.taken)?.name || '')}</span>`;
    return `<button class="btn sm outline" data-pool-claim="${esc(r.id)}">จอง</button>`;
  }
  function poolClaim(id) {
    const c = state.customers.find(x => x.id === id); if (!c) return;
    const ex = state.leads.find(l => l.phone === c.phone);
    if (ex && ex.noCall) return toast('ลูกค้ารายนี้ไม่สะดวกให้โทร จองไม่ได้');
    if (ex && ex.releasedBy?.includes(state.meId)) return toast('คุณคัดออกลูกค้ารายนี้ไปแล้ว');
    if (ex && ex.owner && ex.owner !== state.meId) { ui.pool.loaded = false; route(); return toast('ลูกค้ารายนี้มีคนจองไปแล้ว'); }
    if (ex && ex.owner === state.meId) return toast('คุณจองลูกค้ารายนี้แล้ว');
    if (ex) { ex.owner = state.meId; ex.claimedBy = state.meId; } // มีลีดว่างอยู่แล้ว (จากแคมเปญ) จองลีดเดิม ไม่สร้างซ้ำ
    else state.leads.unshift({ id: 'L' + Date.now(), name: c.name, phone: c.phone, address: c.address, shop: c.shop, source: 'self', brand: c.brand, campaignId: null, owner: state.meId, claimedBy: state.meId,
      status: 'new', callback: null, purchases: JSON.parse(JSON.stringify(c.purchases)), interactions: [], interest: '', closedBills: [], closedAmount: null, closedAt: null });
    save(); closeModal(); ui.pool.loaded = false; route(); toast('จองแล้ว ลูกค้าย้ายเข้าหน้า Direct Sale ของคุณ');
  }
  async function poolDetail(id) {
    const r = ui.pool.rows.find(x => x.id === id); if (!r) return;
    const cu = state.customers.find(c => c.id === id);
    let lines = null, err = '';
    const render = () => {
      const body = lines === null ? '<div class="empty">กำลังโหลดประวัติการซื้อ…</div>' : err ? `<div class="login-err">${esc(err)}</div>`
        : lines.length ? `<div class="mini-table table-wrap"><table><thead><tr><th>วัน/เดือน/ปี</th><th>SKU</th><th>ชื่อสินค้า</th><th class="r">ยอดซื้อ</th></tr></thead><tbody>${lines.map(p => `<tr><td>${fmtDate(p.date)}</td><td class="mono">${esc(p.sku || '—')}</td><td>${esc(p.product || '—')}<div class="sub">บิล ${esc(p.bill || '—')}${p.seller ? ' · ขายโดย ' + esc(p.seller) : ''}</div></td><td class="r num">${p.amount == null ? '—' : baht(p.amount)}</td></tr>`).join('')}</tbody></table></div>`
        : '<div class="empty">ไม่พบประวัติการซื้อรายรายการ</div>';
      openModal(`<div class="modal-h"><h3>${esc(r.name)}</h3>${r.brands.map(b => `<span class="tag ${b === 'bebeplay' ? 'bebe' : b === 'hosttail' ? 'host' : ''}">${esc(BRAND[b] || b)}</span>`).join(' ')}${r.taken ? `<span class="badge s-new plain">จองโดย ${esc(rep(r.taken)?.name || '')}</span>` : ''}${X}</div>
        <div class="modal-b"><dl class="info-grid" style="margin:0">
          <div><dt>เบอร์</dt><dd class="mono">${esc(r.phone)} <button class="copy" data-copy="${esc(r.phone)}">คัดลอก</button></dd></div>
          <div><dt>กลุ่มลูกค้า</dt><dd>${esc(r.segment || '—')}</dd></div>
          <div><dt>ยอดซื้อสะสม</dt><dd class="num">${r.ltv == null ? '—' : baht(Math.round(r.ltv))}</dd></div>
          <div><dt>จำนวนออเดอร์</dt><dd class="num">${r.orders ?? '—'}</dd></div>
          <div><dt>ซื้อล่าสุด</dt><dd>${r.last ? fmtDate(r.last) : '—'}</dd></div>
          <div><dt>ที่อยู่</dt><dd>${esc(cu?.address || '—')}</dd></div></dl>
          <div class="sub"><b>ประวัติการซื้อ</b></div>${body}</div>
        ${!isLive() && !r.taken ? `<div class="modal-f"><button class="btn primary" data-pool-claim="${esc(id)}">จอง</button></div>` : ''}${!isLive() && r.taken === state.meId && r.mineReserved ? `<div class="modal-f"><button class="btn danger" data-act="unclaim" data-id="${esc(r.leadId)}">ยกเลิกจอง</button></div>` : ''}`);
      const m = $('.modal');
      m.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => { navigator.clipboard?.writeText(b.dataset.copy).then(() => toast('คัดลอกเบอร์แล้ว'), () => toast(b.dataset.copy)); });
      m.querySelectorAll('[data-pool-claim]').forEach(b => b.onclick = () => poolClaim(b.dataset.poolClaim));
    };
    if (isLive()) {
      render();
      const { data, error } = await sb.rpc('dsales_customer_purchases', { p_phone: r.phone });
      if (error) err = 'โหลดประวัติการซื้อไม่สำเร็จ'; else lines = data.map(x => ({ date: x.txn_date, bill: x.bill_no || x.order_no, sku: x.sku, product: x.product_name, amount: x.amount }));
      if (lines === null) lines = [];
    } else lines = (cu?.purchases || []).map(p => ({ date: p.date, bill: p.bill, sku: p.sku, product: p.product, amount: p.amount, seller: rep(p.seller)?.name }));
    render();
  }
  function bindPool(draw) {
    document.querySelectorAll('[data-pool-open]').forEach(b => b.onclick = () => poolDetail(b.dataset.poolOpen));
    document.querySelectorAll('[data-pool-claim]').forEach(b => b.onclick = () => poolClaim(b.dataset.poolClaim));
    const P = ui.pool, q = $('#pool-q');
    if (q) q.addEventListener('input', () => { P.q = q.value; P.page = 0; clearTimeout(P.t); P.t = setTimeout(() => poolLoad(draw, true), 300); });
    document.querySelectorAll('[data-pool]').forEach(b => b.onclick = () => { P.page += b.dataset.pool === 'next' ? 1 : -1; poolLoad(draw); });
  }

  /* ---------- campaign builder (หัวหน้า/Dev) ---------- */
  const CRIT = {
    product: { label: 'เคยซื้อสินค้า (ชื่อ / SKU)', fields: [['text', 'kw', 'เช่น เตียงนอน หรือ BBP-BED']] },
    total: { label: 'ยอดซื้อรวม (บาท)', fields: [['number', 'min', 'ตั้งแต่'], ['number', 'max', 'ถึง']] },
    dates: { label: 'ซื้อเมื่อ (ช่วงวันที่)', fields: [['date', 'from', 'ตั้งแต่วันที่'], ['date', 'to', 'ถึงวันที่']] },
    order: { label: 'ยอดสั่งซื้อต่อบิลตั้งแต่ (บาท)', fields: [['number', 'min', 'ตั้งแต่ขึ้นไป']] },
    times: { label: 'ซื้อมากกว่า (ครั้ง)', fields: [['number', 'min', 'มากกว่ากี่ครั้ง']] },
  };
  const has = (v) => v !== undefined && v !== null && String(v) !== '';
  function matchOne(c, cr) {
    const P = c.purchases;
    if (cr.type === 'product') { const k = (cr.kw || '').trim().toLowerCase(); return !k || P.some(p => (p.product + ' ' + p.sku).toLowerCase().includes(k)); }
    if (cr.type === 'total') { const t = P.reduce((s, p) => s + p.amount, 0); return (!has(cr.min) || t >= +cr.min) && (!has(cr.max) || t <= +cr.max); }
    if (cr.type === 'dates') return P.some(p => (!cr.from || p.date >= cr.from) && (!cr.to || p.date <= cr.to));
    if (cr.type === 'order') return !has(cr.min) || P.some(p => p.amount >= +cr.min);
    if (cr.type === 'times') return !has(cr.min) || P.length > +cr.min;
    return true;
  }
  const TRASH = '<svg viewBox="0 0 24 24"><path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z"/></svg>';

  function campaignForm(brand) {
    if (!isAdmin()) return toast('เฉพาะหัวหน้าเท่านั้นที่สร้างแคมเปญได้');
    const f = { tab: 'base', name: '', desc: '', active: true, start: '', end: '', brand, mode: 'self', max: '', crits: [], prev: false };
    const funnel = () => {
      let cur = state.customers.filter(c => c.brand === f.brand && !isDnc(c.phone));
      const steps = [{ label: `ลูกค้าทั้งหมด · ${BRAND[f.brand]}`, n: cur.length }];
      f.crits.forEach((cr, i) => { cur = cur.filter(c => matchOne(c, cr)); steps.push({ label: `เงื่อนไข ${i + 1} · ${CRIT[cr.type].label}`, n: cur.length }); });
      return { steps, result: cur };
    };
    const funnelHtml = () => {
      const { steps, result } = funnel(); const top = steps[0].n || 1;
      let h = `<div class="funnel">${steps.map((s, i) => `<div class="funnel-row ${i === 0 ? 'first' : ''}"><span>${esc(s.label)}</span><b class="num">${s.n.toLocaleString('th-TH')} คน</b><div class="bar"><i style="width:${Math.round(s.n / top * 100)}%"></i></div></div>`).join('')}</div>`;
      if (f.prev) {
        h += result.length
          ? `<div class="mini-table table-wrap"><table><thead><tr><th>ชื่อ</th><th>เบอร์</th><th class="r">ยอดซื้อรวม</th><th class="r">ซื้อ (ครั้ง)</th></tr></thead><tbody>${result.slice(0, 8).map(c => `<tr><td>${esc(c.name)}</td><td class="mono">${esc(c.phone)}</td><td class="r num">${baht(total(c))}</td><td class="r num">${c.purchases.length}</td></tr>`).join('')}</tbody></table></div><div class="sub">แสดง ${Math.min(8, result.length)} จาก ${result.length} คน</div>`
          : '<div class="empty">ไม่มีลูกค้าที่ตรงเงื่อนไขทั้งหมด</div>';
      }
      return h;
    };
    const critRow = (cr, i) => `<div class="crit-row"><select class="select" data-ct="${i}" aria-label="ประเภทเงื่อนไข">${Object.entries(CRIT).map(([k, v]) => `<option value="${k}" ${cr.type === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select>
      ${CRIT[cr.type].fields.map(([t, n, ph]) => `<input class="input" type="${t}" ${t === 'number' ? 'min="0"' : ''} data-cf="${i}:${n}" placeholder="${ph}" aria-label="${ph}" value="${esc(cr[n] ?? '')}">`).join('')}
      <button type="button" class="icon-btn" data-ca="del" data-i="${i}" aria-label="ลบเงื่อนไข">${TRASH}</button></div>`;
    const body = () => {
      if (f.tab === 'base') return `
        <div class="field"><label for="cf-name">ชื่อแคมเปญ <span class="req">*</span></label><input class="input" id="cf-name" data-k="name" value="${esc(f.name)}" placeholder="เช่น ${f.brand === 'hosttail' ? 'Hosttail Q4 2026' : 'Bebeplay Q4 2026'}"></div>
        <div class="field"><label for="cf-desc">คำอธิบาย <span class="opt">(ไม่บังคับ)</span></label><textarea class="textarea" id="cf-desc" data-k="desc" placeholder="สรุปวัตถุประสงค์ของแคมเปญนี้…">${esc(f.desc)}</textarea></div>
        <div class="form-grid"><div class="field"><label for="cf-brand">แบรนด์</label><select class="select" id="cf-brand" data-k="brand"><option value="bebeplay" ${f.brand === 'bebeplay' ? 'selected' : ''}>Bebeplay</option><option value="hosttail" ${f.brand === 'hosttail' ? 'selected' : ''}>Hosttail</option></select></div>
          <div class="field" style="justify-content:flex-end"><label class="switch"><input type="checkbox" data-k="active" ${f.active ? 'checked' : ''}><span></span>เปิดใช้งานทันที</label></div></div>
        <div class="form-grid"><div class="field"><label for="cf-start">วันเริ่มต้น <span class="opt">(ไม่บังคับ)</span></label><input class="input" type="date" id="cf-start" data-k="start" value="${f.start}"></div>
          <div class="field"><label for="cf-end">วันสิ้นสุด <span class="opt">(ไม่บังคับ)</span></label><input class="input" type="date" id="cf-end" data-k="end" value="${f.end}"></div></div>`;
      if (f.tab === 'set') return `
        <div class="field"><label>วิธีจองลีดของแคมเปญนี้</label>
          ${Object.entries(MODES).map(([k, v]) => `<label class="radio-card"><input type="radio" name="cf-mode" data-k="mode" value="${k}" ${f.mode === k ? 'checked' : ''}><span><b>${v}</b><span class="sub">${{ self: 'เซลล์กดจองลีดที่ยังว่างเอง ลีดที่จองแล้วคนอื่นจะไม่เห็น', assign: 'หัวหน้าเลือกมอบหมายลีดให้เซลล์แต่ละคน', auto: 'ลีดเข้าถังของเซลล์ที่เคยขายให้ลูกค้ารายนั้นล่าสุดทันที ที่เหลือให้จองเอง' }[k]}</span></span></label>`).join('')}</div>
        <div class="field"><label for="cf-max">จำนวนลีดสูงสุดที่เซลล์แต่ละคนจองได้ <span class="opt">(ไม่บังคับ)</span></label><input class="input" id="cf-max" type="number" min="1" data-k="max" value="${esc(f.max)}" placeholder="ไม่จำกัด"></div>`;
      return `<p class="help">กำหนดเงื่อนไขกรองลูกค้าที่จะเข้าแคมเปญนี้ ถ้าไม่กำหนดจะใช้ลูกค้าทั้งหมดของ ${BRAND[f.brand]}</p>
        <div id="funnel">${funnelHtml()}</div>
        ${f.crits.map(critRow).join('')}
        <div class="crit-actions"><button type="button" class="btn sm" data-ca="add">+ เพิ่มเงื่อนไข</button><button type="button" class="btn sm" data-ca="prev">${f.prev ? 'ซ่อนตัวอย่าง' : 'ดูตัวอย่าง'}</button></div>`;
    };
    const draw = () => {
      const tab = (k, t) => `<button type="button" class="utab ${f.tab === k ? 'active' : ''}" data-ca="tab" data-tab="${k}">${t}${k === 'aud' && f.crits.length ? `<span class="count">${f.crits.length}</span>` : ''}</button>`;
      const foot = f.tab === 'aud'
        ? `<button type="button" class="btn" data-ca="back">← ย้อนกลับ</button><button type="button" class="btn primary" data-ca="create">สร้างแคมเปญ</button>`
        : `<button type="button" class="btn" data-close>ยกเลิก</button><button type="button" class="btn primary" data-ca="next" ${f.name.trim() ? '' : 'disabled'}>ถัดไป →</button>`;
      openModal(`<div class="modal-h"><h3>สร้างแคมเปญใหม่</h3>${X}</div>
        <div class="utabs">${tab('base', 'ข้อมูลพื้นฐาน')}${tab('set', 'การตั้งค่า')}${tab('aud', 'กลุ่มลูกค้า')}</div>
        <div class="modal-b" style="padding-top:16px">${body()}</div><div class="modal-f">${foot}</div>`);
      const m = $('.modal');
      m.oninput = (e) => {
        const t = e.target;
        if (t.dataset.k) {
          f[t.dataset.k] = t.type === 'checkbox' ? t.checked : t.value;
          if (t.dataset.k === 'name') { const nx = m.querySelector('[data-ca="next"]'); if (nx) nx.disabled = !f.name.trim(); }
        }
        if (t.dataset.cf) { const [i, n] = t.dataset.cf.split(':'); f.crits[+i][n] = t.value; $('#funnel').innerHTML = funnelHtml(); }
      };
      m.onchange = (e) => { if (e.target.dataset.ct !== undefined) { f.crits[+e.target.dataset.ct] = { type: e.target.value }; draw(); } };
      m.onclick = (e) => {
        const b = e.target.closest('[data-ca]'); if (!b) return;
        const a = b.dataset.ca;
        if (a === 'tab') { f.tab = b.dataset.tab; draw(); }
        else if (a === 'next') { if (!f.name.trim()) return; f.tab = f.tab === 'base' ? 'set' : 'aud'; draw(); }
        else if (a === 'back') { f.tab = 'set'; draw(); }
        else if (a === 'add') { f.crits.push({ type: 'product' }); draw(); }
        else if (a === 'del') { f.crits.splice(+b.dataset.i, 1); draw(); }
        else if (a === 'prev') { f.prev = !f.prev; draw(); }
        else if (a === 'create') {
          if (!f.name.trim()) { f.tab = 'base'; draw(); return toast('ใส่ชื่อแคมเปญก่อน'); }
          const { result } = funnel();
          const c = { id: 'c' + Date.now(), brand: f.brand, name: f.name.trim(), note: f.desc.trim(), start: f.start || today, end: f.end || '', claimMode: f.mode, maxPerRep: f.max ? Number(f.max) : null, active: f.active, criteria: f.crits };
          state.campaigns.push(c);
          result.forEach((cu, k) => state.leads.push({ id: 'L' + Date.now() + k, name: cu.name, phone: cu.phone, address: cu.address, shop: cu.shop, source: 'campaign', brand: c.brand, campaignId: c.id, owner: null,
            status: 'new', callback: null, purchases: JSON.parse(JSON.stringify(cu.purchases)), interactions: [], interest: '', closedBills: [], closedAmount: null }));
          if (c.claimMode === 'auto') applyAuto(c.id, true);
          ui.selCamp = c.id; ui.status = 'all'; save(); closeModal();
          location.hash = '#campaign-' + c.brand; route(); toast(`สร้างแคมเปญแล้ว · เพิ่ม ${result.length} ลีดเข้าถัง`);
        }
      };
      if (f.tab === 'base' && !f.name) $('#cf-name')?.focus();
    };
    draw();
  }

  /* ---------- global events ---------- */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act],[data-close]'); if (!t) return;
    if (t.hasAttribute('data-close')) return closeModal();
    const id = t.dataset.id;
    if (t.dataset.act === 'open') customerModal(id);
    if (t.dataset.act === 'unclaim') confirmUnclaim(id);
    if (t.dataset.act === 'dnc-restore') { Object.assign(lead(id), { noCall: false, noCallAt: null, noCallBy: null }); save(); route(); toast('ยกเลิกห้ามโทรแล้ว'); }
    if (t.dataset.act === 'log') logModal(id, t.dataset.type);
    if (t.dataset.act === 'claim') {
      const l = lead(id), c = camp(l.campaignId);
      if (l.owner) { route(); return toast('ลีดนี้มีคนจองไปแล้ว'); }
      if (c?.maxPerRep && state.leads.filter(x => x.campaignId === c.id && x.owner === state.meId).length >= c.maxPerRep) return toast(`จองได้สูงสุด ${c.maxPerRep} ลีดต่อคนในแคมเปญนี้`);
      l.owner = state.meId; l.claimedBy = state.meId; save(); route(); toast('จองลีดแล้ว ลีดนี้ย้ายเข้าหน้า Direct Sale ของคุณ');
    }
  });
  document.addEventListener('change', (e) => {
    const a = e.target.closest('[data-assign]');
    if (a && a.value) { const l = lead(a.dataset.assign); l.owner = a.value; save(); route(); toast('มอบหมายแล้ว: ' + (rep(a.value)?.name || '')); }
    const m = e.target.closest('[data-claimmode]');
    if (m) { camp(m.dataset.claimmode).claimMode = m.value; save(); toast('บันทึกวิธีจองลีดแล้ว'); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
  $('#menu-btn').onclick = openMenu;
  $('#scrim').onclick = closeMenu;

  /* ---------- auth + boot ---------- */
  const cfg = window.DS_CONFIG || {};
  const wantAuth = !!(cfg.url && cfg.key);
  const sb = wantAuth && window.supabase ? window.supabase.createClient(cfg.url, cfg.key) : null;
  let authUser = null, started = false;

  function fillMe() {
    const sel = $('#me-select');
    if (authUser) {
      sel.innerHTML = `<option>${esc(me()?.name || authUser)}</option>`; sel.disabled = true;
      $('#me-label').textContent = 'เข้าสู่ระบบแล้ว';
    } else {
      sel.disabled = false; $('#me-label').textContent = 'โหมดตัวอย่าง · ใช้งานในชื่อ';
      sel.innerHTML = state.reps.map(r => `<option value="${r.id}" ${r.id === state.meId ? 'selected' : ''}>${esc(r.name)}</option>`).join('');
    }
    $('#me-avatar').textContent = (me()?.initials || '?').slice(0, 2);
  }
  $('#me-select').onchange = (e) => { state.meId = e.target.value; save(); fillMe(); route(); };
  function start() {
    $('#login').hidden = true;
    fillMe();
    if (!started) { started = true; window.addEventListener('hashchange', route); }
    route();
  }
  function showLogin(msg) {
    $('#login').hidden = false;
    const err = $('#l-err'); err.hidden = !msg; err.textContent = msg || '';
  }
  async function enterAuth(user) {
    authUser = user.email;
    let name = null, admin = null;
    try { // ชื่อจาก profiles ของพนักงาน สิทธิ์หัวหน้าจาก dsales_members (ฝั่ง Supabase)
      const { data, error } = await sb.rpc('dsales_me');
      if (!error && data && data[0]) { name = data[0].display_name; admin = !!data[0].is_admin; }
    } catch (e) {}
    if (admin === null) admin = user.email.toLowerCase() === 'dev@mpdgroup.co'; // สำรองเมื่อเรียกฟังก์ชันไม่ได้
    const nm = name || user.email.split('@')[0];
    let r = state.reps.find(x => x.email === user.email);
    if (!r) { r = { id: 'u' + user.id.slice(0, 8), email: user.email }; state.reps.push(r); }
    Object.assign(r, { name: nm, initials: nm.slice(0, 2).toUpperCase(), role: admin ? 'admin' : 'sales' });
    state.meId = r.id; save();
  }
  $('#login-form').onsubmit = async (e) => {
    e.preventDefault();
    if (!sb) return showLogin('โหลดระบบล็อกอินไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่ หรือเลือกดูตัวอย่าง');
    $('#l-submit').disabled = true;
    const { data, error } = await sb.auth.signInWithPassword({ email: $('#l-email').value.trim(), password: $('#l-pass').value });
    $('#l-submit').disabled = false;
    if (error || !data?.user) return showLogin('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    await enterAuth(data.user); start();
  };
  $('#l-demo').onclick = () => { authUser = null; if (me()?.email) { state.meId = 'r4'; save(); } start(); }; // โหมดตัวอย่างไม่ใช้ตัวตนของผู้ใช้จริง
  $('#logout').onclick = async () => { if (sb && authUser) await sb.auth.signOut(); authUser = null; $('#l-pass').value = ''; showLogin(''); };

  (async function boot() {
    if (!wantAuth) return start();
    if (!sb) return showLogin('โหลดระบบล็อกอินไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่ หรือเลือกดูตัวอย่าง');
    try {
      const { data } = await sb.auth.getSession();
      if (data?.session?.user) { await enterAuth(data.session.user); return start(); }
    } catch (e) {}
    showLogin('');
  })();
})();
