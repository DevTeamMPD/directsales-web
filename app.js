(function () {
  'use strict';
  const KEY = 'mpd-directsale-preview-v3';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const baht = (n) => Number(n || 0).toLocaleString('th-TH') + '.-';
  const fmtDate = (s) => { if (!s) return '—'; const [y, m, d] = s.slice(0, 10).split('-'); return `${+d}/${+m}/${y}`; };
  const fmtDT = (s) => fmtDate(s) + (s.length > 10 ? ' ' + s.slice(11, 16) : '');

  const STATUS = {
    new: 'ยังไม่ติดต่อ', following: 'กำลังติดตาม', callback: 'รอโทรกลับ',
    won: 'ปิดการขายแล้ว', lost: 'ไม่สนใจ', unreachable: 'ติดต่อไม่ได้',
  };
  const BRAND = { bebeplay: 'Bebeplay', hosttail: 'Hosttail' };

  let state;
  try { state = JSON.parse(localStorage.getItem(KEY)); } catch (e) { state = null; }
  if (!state || !state.leads) state = JSON.parse(JSON.stringify(window.DS_DATA));
  state.meId = state.meId || 'r4';
  state.customers = state.customers || JSON.parse(JSON.stringify(window.DS_DATA.customers));
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };
  const today = state.today;

  const ui = { q: '', status: 'all', camp: 'all', rep: 'all', selCamp: null };
  const rep = (id) => state.reps.find(r => r.id === id);
  const camp = (id) => state.campaigns.find(c => c.id === id);
  const lead = (id) => state.leads.find(l => l.id === id);
  const total = (l) => l.purchases.reduce((s, p) => s + p.amount, 0);
  const me = () => rep(state.meId);
  const isAdmin = () => me()?.role === 'admin';
  const visible = (l) => isAdmin() || !l.owner || l.owner === state.meId; // เซลล์เห็นเฉพาะลีดว่างกับของตัวเอง
  const mineOrAll = (l) => isAdmin() || l.owner === state.meId;
  const MODES = { self: 'เซลล์จองเอง', assign: 'หัวหน้ามอบหมาย', auto: 'เด้งเข้าเซลล์ที่ขายล่าสุด' };
  const lastSeller = (l) => l.purchases.find(p => p.seller && rep(p.seller))?.seller || null;
  function applyAuto(campId, quiet) {
    let n = 0;
    state.leads.filter(l => l.campaignId === campId && !l.owner).forEach(l => { const s = lastSeller(l); if (s) { l.owner = s; n++; } });
    if (n) { save(); if (!quiet || n) toast(`จัดสรรอัตโนมัติ ${n} ลีด ไปยังเซลล์ที่ขายล่าสุด`); }
    return n;
  }
  function claimCell(l, opts) {
    if (!opts.mode || l.owner) return '';
    const repOpts = state.reps.map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('');
    const assign = isAdmin() ? `<select class="select" data-assign="${l.id}" aria-label="มอบหมายให้"><option value="">มอบหมายให้…</option>${repOpts}</select>` : '';
    if (opts.mode === 'self') return `<button class="btn sm outline" data-act="claim" data-id="${l.id}">จองลีด</button>${assign}`;
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
    dashboard: { title: 'Dashboard', sub: 'ภาพรวมทีม Direct Sale', render: renderDashboard },
    setup: { title: 'ตั้งค่า', sub: '', render: renderSetup },
  };
  function route() {
    const name = (location.hash || '#leads').slice(1);
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
    return base.filter(l => {
      if (ui.status !== 'all' && l.status !== ui.status) return false;
      if (ui.rep === 'me' && l.owner !== state.meId) return false;
      if (ui.camp !== 'all' && (ui.camp === 'self' ? l.source !== 'self' : l.campaignId !== ui.camp)) return false;
      if (!q) return true;
      return l.name.toLowerCase().includes(q) || l.phone.includes(q.replace(/-/g, '')) ||
        bills(l).some(b => b.includes(q)) || l.shop.toLowerCase().includes(q);
    });
  }
  function dueHtml(l) {
    if (!l.callback) return '';
    const cls = l.callback < today ? 'overdue' : l.callback === today ? 'today' : '';
    const lbl = l.callback < today ? 'เลยกำหนด ' : l.callback === today ? 'วันนี้ ' : 'โทรกลับ ';
    return `<div class="due ${cls}">${lbl}${fmtDate(l.callback)}</div>`;
  }
  function leadRows(list, opts = {}) {
    if (!list.length) return `<tr><td colspan="9" class="empty">ไม่พบรายการที่ตรงกับตัวกรอง</td></tr>`;
    return list.map(l => {
      const o = rep(l.owner);
      const claim = claimCell(l, opts);
      return `<tr>
        <td><button class="cust-name" data-act="open" data-id="${l.id}">${esc(l.name)}</button>
          <div class="sub mono">${esc(l.phone)}</div></td>
        <td><div class="bills">${bills(l).map(b => `<span class="bill">${b}</span>`).join('')}</div></td>
        <td>${esc(l.shop)}</td>
        <td>${l.source === 'self' ? '<span class="tag self">เซลล์ขุดเอง</span>' : `<span class="camp-cell">${esc(camp(l.campaignId)?.name || '—')}</span>`}</td>
        <td>${o ? `<span class="rep-name">${esc(o.name)}</span>` : '<span class="sub">ยังไม่มีผู้ดูแล</span>'}${lastSeller(l) ? `<div class="sub">ขายล่าสุด: ${esc(rep(lastSeller(l))?.name || '')}</div>` : ''}</td>
        <td class="r num">${baht(total(l))}</td>
        <td><span class="badge s-${l.status}">${STATUS[l.status]}</span>${dueHtml(l)}</td>
        <td class="note-cell">${noteCell(l)}</td>
        <td><div class="actions">
          <button class="btn sm primary" data-act="log" data-type="call" data-id="${l.id}">บันทึกโทร</button>
          <button class="btn sm" data-act="log" data-type="chat" data-id="${l.id}">บันทึกแชต</button>${claim}
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
    const count = (s) => base.filter(l => s === 'all' || l.status === s).length;
    const dots = { new: 'var(--grey)', following: 'var(--info)', callback: 'var(--warn)', won: 'var(--ok)', lost: 'var(--bad)', unreachable: 'var(--violet)' };
    const chips = ['all', 'new', 'following', 'callback', 'won', 'unreachable', 'lost'].map(s =>
      `<button class="chip ${ui.status === s ? 'active' : ''}" data-chip="${s}">${s === 'all' ? '' : `<i class="dot" style="background:${dots[s]}"></i>`}${s === 'all' ? 'ทั้งหมด' : STATUS[s]} (${count(s)})</button>`).join('');
    const campOpts = `<option value="all">แคมเปญทั้งหมด</option><option value="self" ${ui.camp === 'self' ? 'selected' : ''}>เซลล์ขุดเอง</option>` +
      state.campaigns.map(c => `<option value="${c.id}" ${ui.camp === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
    return `<div class="toolbar">
      <label class="search" for="q">${SEARCH_SVG}<input id="q" type="search" placeholder="ค้นหา ชื่อ, เบอร์, เลขบิล, ร้านค้า" value="${esc(ui.q)}"></label>
      ${chips}
      ${withCampSelect ? `<select id="camp-sel" class="select" aria-label="แคมเปญ">${campOpts}</select>` : ''}
      ${isAdmin() ? `<select id="rep-sel" class="select" aria-label="ผู้ดูแล"><option value="all">ทุกคน</option><option value="me" ${ui.rep === 'me' ? 'selected' : ''}>ของฉัน</option></select>` : ''}
    </div>`;
  }
  function bindToolbar(redraw) {
    const q = $('#q'); if (q) q.addEventListener('input', () => { ui.q = q.value; redraw(true); });
    document.querySelectorAll('[data-chip]').forEach(b => b.onclick = () => { ui.status = b.dataset.chip; redraw(); });
    const cs = $('#camp-sel'); if (cs) cs.onchange = () => { ui.camp = cs.value; redraw(); };
    const rs = $('#rep-sel'); if (rs) rs.onchange = () => { ui.rep = rs.value; redraw(); };
  }

  function renderLeads() {
    $('#topbar-actions').innerHTML = `<button class="btn primary" id="add-lead">+ เพิ่มลูกค้า (ขุดเอง)</button>`;
    $('#add-lead').onclick = () => leadForm();
    const draw = (keepFocus) => {
      const base = state.leads.filter(mineOrAll);
      const list = filtered(base);
      $('#view').innerHTML = `<div class="demo-note">ข้อมูลทั้งหมดเป็นตัวอย่างสำหรับ Preview — กดบันทึกโทร/แชตได้จริง ข้อมูลเก็บในเบราว์เซอร์นี้เท่านั้น</div>${toolbar(base, true)}${tableHtml(list)}`;
      bindToolbar(draw);
      if (keepFocus) { const q = $('#q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
    };
    draw();
  }

  function renderCampaign(brand) {
    const cs = state.campaigns.filter(c => c.brand === brand);
    if (!ui.selCamp || camp(ui.selCamp)?.brand !== brand) ui.selCamp = cs[0]?.id;
    $('#page-sub').textContent = `${cs.length} แคมเปญ`;
    if (isAdmin()) { $('#topbar-actions').innerHTML = `<button class="btn" id="auto-run">จัดสรรให้เซลล์ที่ขายล่าสุด</button><button class="btn primary" id="new-camp">+ สร้างแคมเปญ</button>`; $('#new-camp').onclick = () => campaignForm(brand); $('#auto-run').onclick = () => { const n = applyAuto(ui.selCamp); if (!n) toast('ไม่มีลีดที่ต้องจัดสรร'); route(); }; }
    const draw = (keepFocus) => {
      const mode = camp(ui.selCamp)?.claimMode || 'self';
      if (mode === 'auto') applyAuto(ui.selCamp, true);
      const base = state.leads.filter(l => l.campaignId === ui.selCamp && visible(l));
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
      $('#view').innerHTML = `<div class="camp-grid">${cards}</div>
        <div class="quota card" style="padding:10px 14px">ลีดในแคมเปญนี้ <b>${base.length}</b> รายการ · ที่ฉันดูแล <b>${mineN}</b> · ยังไม่มีผู้ดูแล <b>${base.filter(l => !l.owner).length}</b> · วิธีจอง: <b>${MODES[mode]}</b></div>
        ${toolbar(base, false)}${tableHtml(list, { mode })}`;
      document.querySelectorAll('[data-camp]').forEach(b => b.onclick = () => { ui.selCamp = b.dataset.camp; ui.status = 'all'; draw(); });
      bindToolbar(draw);
      if (keepFocus) { const q = $('#q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
    };
    draw();
  }

  /* ---------- dashboard ---------- */
  function renderDashboard() {
    const L = state.leads.filter(mineOrAll);
    const won = L.filter(l => l.status === 'won');
    const contacted = L.filter(l => l.status !== 'new').length;
    const wonValue = won.reduce((s, l) => s + (l.closedAmount ?? l.purchases[0]?.amount ?? 0), 0);
    const overdue = L.filter(l => l.callback && l.callback < today).length;
    const kpi = (label, val, foot) => `<div class="kpi"><div class="kpi-label">${label}</div><div class="kpi-value">${val}</div><div class="kpi-foot">${foot}</div></div>`;
    const maxN = Math.max(1, ...state.reps.map(r => L.filter(l => l.owner === r.id).length));
    const repRows = state.reps.map(r => {
      const mine = L.filter(l => l.owner === r.id), w = mine.filter(l => l.status === 'won').length, c = mine.filter(l => l.status !== 'new').length;
      return `<div class="rep-row"><div>${esc(r.name)}</div>
        <div class="rep-bars"><div class="bar"><i style="width:${mine.length / maxN * 100}%"></i></div><div class="bar won"><i style="width:${mine.length ? w / maxN * 100 : 0}%"></i></div></div>
        <div class="sub num" style="text-align:right">${c}/${mine.length} · ปิด ${w}</div></div>`;
    }).join('');
    const feed = L.flatMap(l => l.interactions.map(i => ({ ...i, lead: l }))).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8)
      .map(i => `<li><span class="feed-ic ${i.type}"><svg viewBox="0 0 24 24"><path d="${i.type === 'call' ? 'M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z' : 'M4 4h16v12H7l-3 3z'}"/></svg></span>
        <div class="feed-body"><b>${esc(i.lead.name)}</b> <span class="sub">· ${esc(rep(i.rep)?.name || '')} · ${fmtDT(i.date)}</span><div>${esc(i.note)}</div></div></li>`).join('') || '<li class="empty">ยังไม่มีการบันทึก</li>';
    $('#view').innerHTML = `<div class="kpis">
      ${kpi('ลีดทั้งหมด', L.length, 'จากทุกแคมเปญและที่ขุดเอง')}
      ${kpi('ติดต่อแล้ว', contacted + ' <span class="sub">/ ' + L.length + '</span>', Math.round(contacted / L.length * 100) + '% ของลีดทั้งหมด')}
      ${kpi('ปิดการขาย', won.length, 'อัตราปิด ' + (contacted ? Math.round(won.length / contacted * 100) : 0) + '% ของที่ติดต่อแล้ว')}
      ${kpi('ยอดที่ปิดได้', baht(wonValue), 'จากยอดที่เซลล์บันทึกตอนปิดการขาย')}
      ${kpi('โทรกลับเลยกำหนด', overdue, overdue ? 'ควรติดตามวันนี้' : 'ไม่มีค้าง')}</div>
      <div class="grid-2">
        <div class="panel"><div class="panel-h"><h2>ผลงานรายเซลล์</h2><div class="legend"><span><i style="background:var(--accent)"></i>ลีดที่ดูแล</span><span><i style="background:var(--ok)"></i>ปิดการขาย</span></div></div><div class="panel-b">${repRows}</div></div>
        <div class="panel"><div class="panel-h"><h2>กิจกรรมล่าสุด</h2></div><div class="panel-b"><ul class="feed">${feed}</ul></div></div>
      </div>`;
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
      <div style="flex:1;min-width:0"><div class="tl-head"><b>${i.type === 'call' ? 'โทร' : 'แชต'}</b><span class="sub">${fmtDT(i.date)} · ${esc(rep(i.rep)?.name || '')}</span><span class="tag">${esc(i.result)}</span></div><div class="tl-note">${esc(i.note)}</div></div></li>`).join('');
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
          <div><dt>เลขบิลที่ปิดได้</dt><dd class="mono">${l.closedBills?.length ? esc(l.closedBills.join(', ')) : '—'}</dd></div></dl>
        <div class="tabs" role="tablist"><button class="tab ${tab === 'buy' ? 'active' : ''}" data-tab="buy">ประวัติการซื้อ (${l.purchases.length})</button>
          <button class="tab ${tab === 'talk' ? 'active' : ''}" data-tab="talk">ประวัติการโทร/แชต (${l.interactions.length})</button></div>
        ${tab === 'buy'
          ? `<div class="mini-table table-wrap"><table><thead><tr><th>วัน/เดือน/ปี</th><th>SKU</th><th>ชื่อสินค้า</th><th class="r">ยอดซื้อ</th></tr></thead><tbody>${buyRows}</tbody></table></div>`
          : (hist ? `<ul class="timeline">${hist}</ul>` : '<div class="empty">ยังไม่เคยติดต่อลูกค้ารายนี้</div>')}
      </div>
      <div class="modal-f"><button class="btn" data-log="chat">บันทึกแชต</button><button class="btn primary" data-log="call">บันทึกโทร</button></div>`);
    const m = $('.modal');
    m.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => customerModal(id, b.dataset.tab));
    m.querySelectorAll('[data-log]').forEach(b => b.onclick = () => logModal(id, b.dataset.log));
    m.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => {
      navigator.clipboard?.writeText(b.dataset.copy).then(() => toast('คัดลอกเบอร์แล้ว'), () => toast(b.dataset.copy));
    });
  }

  function logModal(id, type) {
    const l = lead(id); if (!l) return;
    const RES = { call: ['คุยแล้ว', 'ไม่รับสาย', 'สายไม่ว่าง', 'เบอร์ผิด'], chat: ['ตอบกลับแล้ว', 'อ่านแล้วไม่ตอบ', 'ส่งโปรโมชันแล้ว'] };
    openModal(`
      <div class="modal-h"><h3>บันทึก${type === 'call' ? 'โทร' : 'แชต'} · ${esc(l.name)}</h3>${X}</div>
      <form id="log-form"><div class="modal-b">
        <div class="field"><label>ช่องทาง</label><div class="seg" id="seg"><button type="button" data-t="call" class="${type === 'call' ? 'active' : ''}">โทร</button><button type="button" data-t="chat" class="${type === 'chat' ? 'active' : ''}">แชต</button></div></div>
        <div class="form-grid">
          <div class="field"><label for="f-res">ผลการติดต่อ</label><select class="select" id="f-res"></select></div>
          <div class="field"><label for="f-status">สถานะลูกค้าหลังบันทึก</label><select class="select" id="f-status">
            ${Object.entries(STATUS).filter(([k]) => k !== 'new').map(([k, v]) => `<option value="${k}" ${k === (l.status === 'new' ? 'following' : l.status) ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
          <div class="field wide" id="cb-wrap"><label for="f-cb">วันนัดโทรกลับ</label><input class="input" type="date" id="f-cb" min="${today}" value="${l.callback || ''}"></div>
          <div class="field wide"><label for="f-interest">สินค้าที่ลูกค้าสนใจ</label><input class="input" id="f-interest" value="${esc(l.interest || '')}" placeholder="เช่น เตียงนอนเด็ก, ทรายแมว"></div>
          <div class="field wide" id="won-wrap"><label for="f-bills">เลขบิลที่ขายได้ (อ้างอิงตอนผูกข้อมูล คั่นหลายบิลด้วยจุลภาค)</label><input class="input" id="f-bills" value="${esc((l.closedBills || []).join(', '))}" placeholder="เช่น 312345, 312399">
            <label for="f-amount" style="margin-top:8px">ยอดที่ปิดได้ (บาท)</label><input class="input" id="f-amount" type="number" min="0" step="1" value="${l.closedAmount ?? ''}"></div>
          <div class="field wide"><label for="f-note">หมายเหตุ</label><textarea class="textarea" id="f-note" placeholder="สรุปสิ่งที่คุยกับลูกค้า"></textarea></div>
        </div></div>
        <div class="modal-f"><button type="button" class="btn" data-close>ยกเลิก</button><button class="btn primary">บันทึก</button></div></form>`, 'sm');
    let cur = type;
    const fillRes = () => { $('#f-res').innerHTML = RES[cur].map(r => `<option>${r}</option>`).join(''); };
    const cbToggle = () => { $('#cb-wrap').hidden = $('#f-status').value !== 'callback'; $('#won-wrap').hidden = $('#f-status').value !== 'won'; };
    fillRes(); cbToggle();
    $('#f-status').onchange = cbToggle;
    document.querySelectorAll('#seg button').forEach(b => b.onclick = () => {
      cur = b.dataset.t; document.querySelectorAll('#seg button').forEach(x => x.classList.toggle('active', x === b)); fillRes();
    });
    $('#log-form').onsubmit = (e) => {
      e.preventDefault();
      const billList = $('#f-bills').value.split(/[,\s]+/).map(x => x.trim()).filter(Boolean);
      if ($('#f-status').value === 'won' && !billList.length) { toast('ใส่เลขบิลที่ขายได้ก่อนปิดการขาย'); $('#f-bills').focus(); return; }
      const now = new Date(); const pad = (n) => String(n).padStart(2, '0');
      l.interactions.push({ id: 'i' + Date.now(), type: cur, date: `${today}T${pad(now.getHours())}:${pad(now.getMinutes())}`, rep: state.meId,
        result: $('#f-res').value, note: $('#f-note').value.trim() || '(ไม่มีหมายเหตุ)' });
      l.status = $('#f-status').value;
      l.interest = $('#f-interest').value.trim();
      if (l.status === 'won') { l.closedBills = billList; l.closedAmount = $('#f-amount').value === '' ? null : Number($('#f-amount').value); }
      l.callback = l.status === 'callback' ? ($('#f-cb').value || null) : null;
      if (!l.owner) l.owner = state.meId;
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
    const f = { tab: 'base', name: '', desc: '', active: true, start: '', end: '', brand, mode: 'self', max: '', crits: [], prev: false };
    const funnel = () => {
      let cur = state.customers.filter(c => c.brand === f.brand);
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
    if (t.dataset.act === 'log') logModal(id, t.dataset.type);
    if (t.dataset.act === 'claim') {
      const l = lead(id), c = camp(l.campaignId);
      if (l.owner) { route(); return toast('ลีดนี้มีคนจองไปแล้ว'); }
      if (c?.maxPerRep && state.leads.filter(x => x.campaignId === c.id && x.owner === state.meId).length >= c.maxPerRep) return toast(`จองได้สูงสุด ${c.maxPerRep} ลีดต่อคนในแคมเปญนี้`);
      l.owner = state.meId; save(); route(); toast('จองลีดแล้ว ลีดนี้ย้ายเข้าหน้า Direct Sale ของคุณ');
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
  function enterAuth(user) {
    authUser = user.email;
    let r = state.reps.find(x => x.email === user.email);
    if (!r) {
      const nm = user.email.split('@')[0];
      r = { id: 'u' + user.id.slice(0, 8), name: nm, initials: nm.slice(0, 2).toUpperCase(), email: user.email, role: 'sales' };
      state.reps.push(r); save();
    }
    state.meId = r.id;
  }
  $('#login-form').onsubmit = async (e) => {
    e.preventDefault();
    if (!sb) return showLogin('โหลดระบบล็อกอินไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่ หรือเลือกดูตัวอย่าง');
    $('#l-submit').disabled = true;
    const { data, error } = await sb.auth.signInWithPassword({ email: $('#l-email').value.trim(), password: $('#l-pass').value });
    $('#l-submit').disabled = false;
    if (error || !data?.user) return showLogin('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    enterAuth(data.user); start();
  };
  $('#l-demo').onclick = () => { authUser = null; start(); };
  $('#logout').onclick = async () => { if (sb && authUser) await sb.auth.signOut(); authUser = null; $('#l-pass').value = ''; showLogin(''); };

  (async function boot() {
    if (!wantAuth) return start();
    if (!sb) return showLogin('โหลดระบบล็อกอินไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่ หรือเลือกดูตัวอย่าง');
    try {
      const { data } = await sb.auth.getSession();
      if (data?.session?.user) { enterAuth(data.session.user); return start(); }
    } catch (e) {}
    showLogin('');
  })();
})();
